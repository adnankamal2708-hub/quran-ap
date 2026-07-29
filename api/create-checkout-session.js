/**
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout Session for a premium subscription.
 * Verifies the caller's Firebase ID token server-side (never trusts
 * a uid sent from the client without verification).
 *
 * Request body: { plan: 'monthly' | 'yearly' }
 * Authorization header: Bearer <Firebase ID token>
 *
 * Returns: { url: 'https://checkout.stripe.com/...' }
 */

const Stripe = require('stripe');
const admin = require('firebase-admin');

// ── Firebase Admin (singleton) ──────────────────────────────────
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ── Stripe ──────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Map friendly plan names to Stripe Price IDs
// ⚠ Must stay in sync with PRICE_TO_PLAN in webhook.js
const PRICE_IDS = {
  monthly: 'price_1TyY1cJnXmhhfyEH18x38jpl',
  yearly:  'price_1TyY2TJnXmhhfyEHO65teR9t',
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

    // ── 2. Validate plan ─────────────────────────────────────────
    const { plan } = req.body || {};
    if (!plan || !PRICE_IDS[plan]) {
      res.status(400).json({
        error: 'Invalid plan. Use "monthly" or "yearly".',
      });
      return;
    }

    // ── 3. Create Stripe Checkout Session (subscription mode) ────
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      client_reference_id: uid,
      metadata: { uid },
      subscription_data: {
        metadata: { uid }, // so webhook events carry uid
      },
      success_url: `${process.env.APP_URL || 'https://bayan.app'}/?checkout=success`,
      cancel_url:  `${process.env.APP_URL || 'https://bayan.app'}/?checkout=cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
