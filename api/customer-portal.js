/**
 * POST /api/customer-portal
 *
 * Creates a Polar customer-portal session for the caller so they can
 * manage their subscription (cancel, change payment method, invoices).
 *
 * Authorization header: Bearer <Firebase ID token>
 *
 * The Polar customer is looked up by external_customer_id, which checkout
 * sets to the Firebase uid — the uid always comes from the verified token,
 * never from the request body.
 *
 * Returns: { url } — the portal URL to redirect the browser to
 * Errors:  401 bad token · 404 no Polar customer for this account ·
 *          502 Polar error · 500 server configuration
 */

const { admin, isAdminReady } = require('./_lib/firebase-admin');
const { getAppUrl } = require('./_lib/app-url');

const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh';
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;

const handler = async (req, res) => {
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

  if (!isAdminReady() || !POLAR_ACCESS_TOKEN) {
    console.error('[customer-portal] Firebase Admin or POLAR_ACCESS_TOKEN not configured');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1])).uid;
  } catch (err) {
    console.error('[customer-portal] Token verification failed:', err.message || err);
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  try {
    const polarResponse = await fetch(`${POLAR_API_URL}/v1/customer-sessions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ external_customer_id: uid, return_url: `${getAppUrl()}/` }),
    });
    const data = await polarResponse.json().catch(() => null);

    if (polarResponse.ok && data && data.customer_portal_url) {
      res.status(200).json({ url: data.customer_portal_url });
      return;
    }

    // Polar rejects an external ID it has no customer for — this account
    // never completed a Polar checkout.
    // Logged because a 422 could also be another validation problem.
    if (polarResponse.status === 404 || polarResponse.status === 422) {
      console.warn('[customer-portal] No Polar customer for', uid, polarResponse.status, JSON.stringify(data));
      res.status(404).json({ error: 'No subscription found for this account.' });
      return;
    }

    console.error('[customer-portal] Polar error:', polarResponse.status, JSON.stringify(data));
    res.status(502).json({ error: 'Subscription provider error' });
  } catch (err) {
    console.error('[customer-portal] Error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
};

// The request carries no body; cap it like the other endpoints.
handler.config = {
  api: {
    bodyParser: { sizeLimit: '1kb' },
  },
};

module.exports = handler;
