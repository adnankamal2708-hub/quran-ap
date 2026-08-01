/**
 * POST /api/create-checkout-session
 *
 * Creates a Polar Checkout session for a premium subscription.
 * Verifies the caller's Firebase ID token server-side (never trusts
 * a uid sent from the client without verification).
 *
 * Request body: { plan: 'monthly' | 'yearly' }
 * Authorization header: Bearer <Firebase ID token>
 *
 * Returns: { url: 'https://...' } — the hosted Polar Checkout URL.
 * The frontend redirects the browser to this URL (unchanged contract,
 * so js/services/premium.js needs no changes).
 */

const admin = require('firebase-admin');

// ── Firebase Admin (singleton) ──────────────────────────────────
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ── Polar ───────────────────────────────────────────────────────
// Sandbox vs production is a config change, not a code change:
//   sandbox:    POLAR_API_URL=https://sandbox-api.polar.sh + sandbox OAT
//   production: POLAR_API_URL unset → defaults to https://api.polar.sh
const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh';
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;

// Map friendly plan names to Polar product IDs.
// ⚠ Must stay in sync with PRODUCT_TO_PLAN in webhook.js
const PRODUCT_IDS = {
  monthly: process.env.POLAR_PRODUCT_ID_MONTHLY,
  yearly:  process.env.POLAR_PRODUCT_ID_YEARLY,
};

// ── Handler ─────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // CORS (the frontend will call this from a different domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // ── 1. Verify Firebase ID token ──────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // ── 2. Validate plan & config ────────────────────────────────
    const { plan } = req.body || {};
    if (!plan || (plan !== 'monthly' && plan !== 'yearly')) {
      res.status(400).json({
        error: 'Invalid plan. Use "monthly" or "yearly".',
      });
      return;
    }

    // Distinguish client errors from server configuration errors so a
    // missing env var doesn't masquerade as an invalid plan.
    if (!PRODUCT_IDS[plan]) {
      console.error(`[create-checkout-session] Product ID env var for "${plan}" is not set`);
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    if (!POLAR_ACCESS_TOKEN) {
      console.error('[create-checkout-session] POLAR_ACCESS_TOKEN is not set');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // ── 3. Create Polar Checkout session ─────────────────────────
    // Metadata set here is copied by Polar to the resulting order AND
    // subscription; external_customer_id lets the webhook map the
    // purchase back to the Firebase uid without trusting client input.
    const appUrl = process.env.APP_URL || 'https://bayan.app';

    const checkoutBody = {
      products: [PRODUCT_IDS[plan]],
      success_url: `${appUrl}/?checkout=success`,
      return_url: `${appUrl}/?checkout=cancel`,
      external_customer_id: uid,
      metadata: { uid },
      allow_trial: false, // match existing behavior — no trial period
      allow_discount_codes: false,
    };
    if (decodedToken.email) checkoutBody.customer_email = decodedToken.email;

    const polarResponse = await fetch(`${POLAR_API_URL}/v1/checkouts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutBody),
    });

    const data = await polarResponse.json().catch(() => null);

    if (!polarResponse.ok || !data || !data.url) {
      console.error(
        '[create-checkout-session] Polar error:',
        polarResponse.status,
        JSON.stringify(data)
      );
      res.status(502).json({ error: 'Checkout provider error' });
      return;
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error('[create-checkout-session] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
