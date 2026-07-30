/**
 * POST /api/webhook
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed   → create subscription document
 *   - customer.subscription.updated → sync status/period changes
 *   - customer.subscription.deleted → mark as canceled
 *
 * Reads the raw request body via micro/buffer for signature
 * verification (Vercel parses JSON by default; Stripe needs
 * the exact raw payload).
 */

const Stripe = require('stripe');
const admin = require('firebase-admin');
const { buffer } = require('micro');

// ── Firebase Admin (singleton) ──────────────────────────────────
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ── Stripe ──────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Map Price IDs back to friendly plan names
// ⚠ Must stay in sync with PRICE_IDS in create-checkout-session.js
const PRICE_TO_PLAN = {
  'price_1TyY1cJnXmhhfyEH18x38jpl': 'monthly',
  'price_1TyY2TJnXmhhfyEHO65teR9t': 'yearly',
};

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Extract the plan name from a subscription's price ID.
 */
function planFromSubscription(subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return PRICE_TO_PLAN[priceId] || 'monthly'; // safe default
}

/**
 * Upsert a subscription document in Firestore.
 */
async function upsertSubscription(uid, data) {
  if (!uid) return;
  await db.collection('subscriptions').doc(uid).set(
    {
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId,
      plan: data.plan,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Look up uid from a subscription ID by fetching the originating
 * Checkout Session (fallback for subscription events that arrive
 * without metadata.uid).
 */
async function lookupUidBySubscription(subscriptionId) {
  const sessions = await stripe.checkout.sessions.list({
    subscription: subscriptionId,
    limit: 100, // generous limit; rarely needed since subscription_data.metadata.uid is set
  });
  return sessions.data[0]?.metadata?.uid || null;
}

/**
 * Safely extract current_period_end from a subscription object.
 * Stripe API versions may put this at the top level or inside
 * items.data[0].  Returns an ISO string, or null if unavailable.
 * When null is returned, the caller should omit currentPeriodEnd
 * from the Firestore write so { merge: true } leaves existing
 * values untouched.
 */
function safeCurrentPeriodEnd(subscription) {
  let ts = subscription.current_period_end;
  if (typeof ts !== 'number' || !isFinite(ts)) {
    ts = subscription.items?.data?.[0]?.current_period_end;
  }
  if (typeof ts !== 'number' || !isFinite(ts)) {
    console.warn('[webhook] current_period_end missing or invalid — skipping field');
    return null;
  }
  return new Date(ts * 1000).toISOString();
}

// ── Event Handlers ──────────────────────────────────────────────

async function handleCheckoutCompleted(session) {
  const uid = session.metadata?.uid;
  if (!uid) {
    console.error('[webhook] checkout.session.completed missing uid in metadata');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const plan = planFromSubscription(subscription);
  const periodEnd = safeCurrentPeriodEnd(subscription);
  const data = {
    status: subscription.status,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    plan,
  };
  if (periodEnd) data.currentPeriodEnd = periodEnd;

  await upsertSubscription(uid, data);

  console.log(`[webhook] Subscription created for ${uid}: ${plan} (${subscription.status})`);
}

async function handleSubscriptionUpdated(subscription) {
  const uid =
    subscription.metadata?.uid ||
    (await lookupUidBySubscription(subscription.id));

  if (!uid) {
    console.error('[webhook] subscription.updated: could not resolve uid');
    return;
  }

  const periodEnd = safeCurrentPeriodEnd(subscription);
  const data = {
    status: subscription.status,
    stripeSubscriptionId: subscription.id,
    plan: planFromSubscription(subscription),
  };
  if (periodEnd) data.currentPeriodEnd = periodEnd;

  await upsertSubscription(uid, data);

  console.log(`[webhook] Subscription updated for ${uid}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const uid =
    subscription.metadata?.uid ||
    (await lookupUidBySubscription(subscription.id));

  if (!uid) {
    console.error('[webhook] subscription.deleted: could not resolve uid');
    return;
  }

  const periodEnd = safeCurrentPeriodEnd(subscription);
  const data = {
    status: 'canceled',
    stripeSubscriptionId: subscription.id,
    plan: planFromSubscription(subscription),
  };
  if (periodEnd) data.currentPeriodEnd = periodEnd;

  await upsertSubscription(uid, data);

  console.log(`[webhook] Subscription canceled for ${uid}`);
}

// ── Handler ─────────────────────────────────────────────────────
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 1. Verify Stripe signature using the raw request body
  let event;
  try {
    const rawBody = await buffer(req); // Buffer with exact raw payload
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // 2. Process event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Vercel: disable auto-parsing so buffer(req) gets the raw body for Stripe signature verification
handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
