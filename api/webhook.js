/**
 * POST /api/webhook
 *
 * Handles Polar webhook events (Standard Webhooks spec):
 *   - order.created           → sync subscription after purchase/renewal
 *   - subscription.updated    → catch-all: active / canceled / past_due / paused / ...
 *   - subscription.revoked    → subscription definitively ended (status 'canceled')
 *   - subscription.past_due   → payment failed
 *
 * Verifies the webhook signature against the raw request body
 * (Vercel parses JSON by default; Polar signs the exact raw payload,
 * so the bodyParser: false workaround is required — same as Stripe).
 *
 * Writes to Firestore subscriptions/{uid} with { merge: true } using
 * the SAME doc shape the previous Stripe implementation used
 * (status / currentPeriodEnd / plan / updatedAt), plus Polar-specific
 * ID fields — so premium.js's isPremium() needs no changes at all.
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const { buffer } = require('micro');

// ── Firebase Admin (singleton) ──────────────────────────────────
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ── Polar ───────────────────────────────────────────────────────
const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh';
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;
const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

// ── Startup self-check ─────────────────────────────────────────
// Surface a misconfigured webhook secret immediately instead of
// silently failing every signature check (which would get the Polar
// endpoint auto-disabled after 10 consecutive 403 deliveries).
// Log-only — never blocks the module from loading.
(function validateWebhookSecret() {
  if (!webhookSecret) return;
  const s = String(webhookSecret).replace(/^whsec_/, '');
  const normalized = (x) => x.replace(/=+$/, '');
  const reEncoded = Buffer.from(s, 'base64').toString('base64');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || normalized(reEncoded) !== normalized(s)) {
    console.error(
      '[webhook] ⚠ POLAR_WEBHOOK_SECRET does not look like valid base64 — signature verification will fail. ' +
      'Re-copy the secret from the Polar dashboard with no extra spaces or characters.'
    );
  }
})();

// Map Polar product IDs back to friendly plan names.
// ⚠ Must stay in sync with PRODUCT_IDS in create-checkout-session.js
const PRODUCT_TO_PLAN = {
  [process.env.POLAR_PRODUCT_ID_MONTHLY]: 'monthly',
  [process.env.POLAR_PRODUCT_ID_YEARLY]: 'yearly',
};

// ── Signature Verification (Standard Webhooks) ──────────────────

/**
 * Verify a Polar webhook signature.
 *
 * Standard Webhooks spec:
 *   - Headers: webhook-id, webhook-timestamp (unix seconds), webhook-signature
 *   - webhook-signature is a SPACE-delimited list of "v1,<base64sig>" tokens
 *     (multiple tokens support zero-downtime secret rotation)
 *   - Signed message: `${id}.${timestamp}.${rawBody}`
 *   - HMAC-SHA256 keyed with the base64-DECODED secret (Polar's docs call
 *     this base64-secret convention out explicitly)
 */
function verifySignature(rawBody, headers) {
  if (!webhookSecret) {
    console.error('[webhook] POLAR_WEBHOOK_SECRET is not set');
    return false;
  }

  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatureHeader = headers['webhook-signature'];
  if (!id || !timestamp || !signatureHeader) {
    console.error('[webhook] Missing webhook signature headers');
    return false;
  }

  // Replay protection: reject events outside a 5-minute tolerance
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) {
    console.error('[webhook] Invalid webhook timestamp');
    return false;
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - ts;
  if (Math.abs(ageSeconds) > 300) {
    console.error('[webhook] Webhook timestamp out of tolerance');
    return false;
  }

  // Standard Webhooks: the secret is base64-encoded (optionally whsec_-prefixed)
  const encodedSecret = String(webhookSecret).replace(/^whsec_/, '');
  let key = Buffer.from(encodedSecret, 'base64');
  if (key.length === 0) key = Buffer.from(encodedSecret, 'utf8'); // defensive fallback

  const message = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', key)
    .update(message)
    .digest('base64');

  const tokens = String(signatureHeader).split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const [version, sig] = token.split(',');
    if (version !== 'v1' || !sig) continue;
    const sigBuf = Buffer.from(sig, 'base64');
    const expectedBuf = Buffer.from(expected, 'base64');
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * GET a resource from the Polar API (used to backfill the full
 * subscription when an event payload only carries a subset).
 */
async function polarGet(path) {
  if (!POLAR_ACCESS_TOKEN) {
    console.warn('[webhook] POLAR_ACCESS_TOKEN is not set — skipping Polar API call');
    return null;
  }
  try {
    const res = await fetch(`${POLAR_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${POLAR_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      console.warn(`[webhook] Polar GET ${path} failed: ${res.status}`);
      return null;
    }
    return res.json().catch(() => null);
  } catch (err) {
    console.warn(`[webhook] Polar GET ${path} error:`, err.message || err);
    return null;
  }
}

/**
 * Safely extract current_period_end from a Polar subscription.
 *
 * Polar provides it as an ISO-8601 date-time string. Returns an ISO
 * string, or null if missing/invalid. When null is returned, the
 * caller omits currentPeriodEnd from the Firestore write so
 * { merge: true } leaves existing values untouched — the same
 * fail-safe philosophy as the old Stripe implementation (an active
 * doc without currentPeriodEnd stays premium, and the field is
 * backfilled by the next event, which carries it reliably).
 */
function safeCurrentPeriodEnd(subscription) {
  const value = subscription && subscription.current_period_end;
  if (!value) {
    console.warn('[webhook] current_period_end missing — skipping field');
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    console.warn('[webhook] current_period_end invalid — skipping field');
    return null;
  }
  return date.toISOString();
}

/** Map a Polar product ID to a friendly plan name (safe default: monthly). */
function planFromProduct(productId) {
  const plan = PRODUCT_TO_PLAN[productId];
  if (!plan) {
    console.warn(`[webhook] Unknown Polar product ID "${productId}" — defaulting plan to 'monthly'`);
    return 'monthly';
  }
  return plan;
}

/**
 * Resolve the Firebase uid from a payload's customer + metadata.
 * external_customer_id is set to the uid at checkout, so
 * customer.external_id is the primary source; metadata.uid is a
 * redundant fallback (checkout metadata is copied to order + subscription).
 */
function resolveUid(customer, metadata) {
  return (
    (customer && customer.external_id) ||
    (metadata && metadata.uid) ||
    null
  );
}

/** Build the Firestore document fields from a Polar subscription object. */
function buildSubscriptionData(subscription) {
  const data = {
    status: subscription.status,
    polarCustomerId: subscription.customer_id || null,
    polarSubscriptionId: subscription.id || null,
    plan: planFromProduct(subscription.product_id),
  };
  const periodEnd = safeCurrentPeriodEnd(subscription);
  if (periodEnd) data.currentPeriodEnd = periodEnd;
  return data;
}

/**
 * Upsert a subscription document in Firestore.
 * Field names match the previous Stripe shape (status/currentPeriodEnd/
 * plan/updatedAt) so isPremium() reads identically; only the ID fields
 * are renamed to their Polar equivalents.
 */
async function upsertSubscription(uid, data) {
  if (!uid) return;
  await db.collection('subscriptions').doc(uid).set(
    {
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      polarCustomerId: data.polarCustomerId || null,
      polarSubscriptionId: data.polarSubscriptionId || null,
      plan: data.plan,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// ── Event Handlers ──────────────────────────────────────────────

/** subscription.updated / subscription.revoked / subscription.past_due */
async function handleSubscriptionEvent(subscription) {
  const uid = resolveUid(subscription && subscription.customer, subscription && subscription.metadata);
  if (!uid) {
    console.error('[webhook] subscription event: could not resolve uid');
    return;
  }
  await upsertSubscription(uid, buildSubscriptionData(subscription));
  console.log(`[webhook] Subscription synced for ${uid}: ${subscription.status}`);
}

/**
 * order.created — fires on initial purchase, renewals and upgrades.
 * The order embeds the subscription object (including
 * current_period_end), so the FIRST event after checkout already
 * carries the period end. If the embedded object lacks a status
 * (OrderSubscription is a subset), backfill via the Polar API.
 */
async function handleOrderCreated(order) {
  const uid = resolveUid(order && order.customer, order && order.metadata);
  if (!uid) {
    console.error('[webhook] order.created: could not resolve uid');
    return;
  }

  let subscription = order.subscription || null;

  if ((!subscription || !subscription.status) && order.subscription_id) {
    subscription = await polarGet(`/v1/subscriptions/${order.subscription_id}`);
  }

  if (!subscription || !subscription.status) {
    console.warn('[webhook] order.created: no subscription data available — relying on subscription.updated');
    return;
  }

  await upsertSubscription(uid, buildSubscriptionData(subscription));
  console.log(`[webhook] Order created → subscription synced for ${uid}: ${subscription.status}`);
}

// ── Handler ─────────────────────────────────────────────────────
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 1. Verify Polar signature using the raw request body
  let event;
  try {
    const rawBody = await buffer(req); // Buffer with exact raw payload
    if (!verifySignature(rawBody, req.headers)) {
      console.error('[webhook] Signature verification failed');
      res.status(403).send('Signature verification failed');
      return;
    }
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('[webhook] Webhook verify/parse error:', err.message || err);
    res.status(400).send(`Webhook Error: ${err.message || err}`);
    return;
  }    // 2. Process event
    // Note: webhook-id is validated (in the signature) but not used as an
    // idempotency key — acceptable here because upsertSubscription uses
    // set(..., { merge: true }), so Polar's delivery retries (up to 10×)
    // simply re-write identical state to the same doc.
    try {
      const type = event && event.type;
      const data = event && event.data;

    if (!type || !data) {
      console.error('[webhook] Malformed event payload:', type);
      res.status(400).json({ error: 'Malformed event payload' });
      return;
    }

    switch (type) {
      case 'order.created':
        await handleOrderCreated(data);
        break;

      case 'subscription.updated':
      case 'subscription.revoked':
      case 'subscription.past_due':
        await handleSubscriptionEvent(data);
        break;

      default:
        console.log(`[webhook] Unhandled event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Vercel: disable auto-parsing so buffer(req) gets the raw body for
// Polar signature verification (same workaround Stripe required).
handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
