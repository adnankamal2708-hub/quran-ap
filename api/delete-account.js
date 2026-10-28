/**
 * POST /api/delete-account
 *
 * Permanently deletes the caller's Bayan account:
 *   1. Revokes every live Polar subscription for the user (so a deleted
 *      account is never billed again)
 *   2. Deletes Firestore profiles/{uid}, learning/{uid}, subscriptions/{uid}
 *   3. Deletes the Firebase Auth user
 *
 * Runs server-side because subscriptions/{uid} is not client-writable and
 * revoking needs the Polar access token. Steps run in this order so any
 * failure before step 3 leaves the account intact and the request can be
 * retried safely (every step is idempotent).
 *
 * Authorization header: Bearer <Firebase ID token>, from a sign-in or
 * re-authentication within the last RECENT_LOGIN_MAX_AGE_S seconds —
 * otherwise 401 { code: 'requires-recent-login' }.
 *
 * Returns: { deleted: true }
 */

const { admin, isAdminReady } = require('./_lib/firebase-admin');

// ── Polar ───────────────────────────────────────────────────────
const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh';
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;

/** Deleting an account requires a sign-in at most this many seconds old. */
const RECENT_LOGIN_MAX_AGE_S = 5 * 60;

/** Polar statuses that can still bill or grant access — these get revoked. */
const LIVE_STATUSES = ['incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused'];

/** Firestore collections holding per-user documents keyed by uid. */
const USER_COLLECTIONS = ['profiles', 'learning', 'subscriptions'];

// ── Polar helpers ───────────────────────────────────────────────

function polarHeaders() {
  return { Authorization: `Bearer ${POLAR_ACCESS_TOKEN}` };
}

/**
 * Find the user's live Polar subscription IDs, looked up by the
 * external customer ID (set to the Firebase uid at checkout). Also
 * includes the ID recorded in subscriptions/{uid}, in case Polar's
 * customer link is missing. Throws if Polar can't be queried, so the
 * account is never deleted while a subscription might still bill.
 */
async function findLiveSubscriptionIds(uid, subscriptionDoc) {
  const ids = new Set();

  const params = new URLSearchParams({ external_customer_id: uid, limit: '100' });
  LIVE_STATUSES.forEach((s) => params.append('status', s));
  const res = await fetch(`${POLAR_API_URL}/v1/subscriptions/?${params}`, { headers: polarHeaders() });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.items)) {
    throw new Error(`Polar subscription lookup failed: ${res.status}`);
  }
  body.items.forEach((sub) => { if (sub && sub.id) ids.add(sub.id); });

  if (subscriptionDoc && subscriptionDoc.polarSubscriptionId && subscriptionDoc.status !== 'canceled') {
    ids.add(subscriptionDoc.polarSubscriptionId);
  }
  return Array.from(ids);
}

/**
 * Revoke (cancel immediately) one Polar subscription. Already-revoked
 * (403 AlreadyCanceledSubscription) and unknown (404) count as done.
 */
async function revokeSubscription(id) {
  const res = await fetch(`${POLAR_API_URL}/v1/subscriptions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: polarHeaders(),
  });
  if (res.ok || res.status === 404) return;
  const body = await res.json().catch(() => null);
  if (res.status === 403 && body && body.error === 'AlreadyCanceledSubscription') return;
  throw new Error(`Polar revoke failed for ${id}: ${res.status} ${JSON.stringify(body)}`);
}

// ── Firestore helpers ───────────────────────────────────────────

async function deleteUserDocs(db, uid, collections) {
  const batch = db.batch();
  collections.forEach((name) => batch.delete(db.collection(name).doc(uid)));
  await batch.commit();
}

// ── Handler ─────────────────────────────────────────────────────
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

  if (!isAdminReady()) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // ── 1. Verify Firebase ID token (revocation checked) ───────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1], true);
  } catch (err) {
    console.error('[delete-account] Token verification failed:', err.message || err);
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const uid = decodedToken.uid;
  const ageSeconds = Math.floor(Date.now() / 1000) - (decodedToken.auth_time || 0);
  if (ageSeconds > RECENT_LOGIN_MAX_AGE_S) {
    res.status(401).json({ error: 'Please confirm your identity again.', code: 'requires-recent-login' });
    return;
  }

  if (!POLAR_ACCESS_TOKEN) {
    console.error('[delete-account] POLAR_ACCESS_TOKEN is not set');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const db = admin.firestore();

    // ── 2. Stop billing first — abort deletion if this fails ─────
    const subSnap = await db.collection('subscriptions').doc(uid).get();
    const subscriptionDoc = subSnap.exists ? subSnap.data() : null;
    const liveIds = await findLiveSubscriptionIds(uid, subscriptionDoc);
    for (const id of liveIds) {
      await revokeSubscription(id);
    }

    // ── 3. Delete user data, then the auth user ──────────────────
    await deleteUserDocs(db, uid, USER_COLLECTIONS);
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    // The revoke above triggers a Polar webhook that may have re-created
    // subscriptions/{uid} before the auth user was gone. webhook.js skips
    // writes for deleted users from here on; clear anything that slipped in.
    await deleteUserDocs(db, uid, ['subscriptions']);

    console.log(`[delete-account] Deleted account ${uid} (revoked ${liveIds.length} subscription(s))`);
    res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('[delete-account] Error:', err);
    res.status(500).json({ error: 'Could not delete the account. Please try again.' });
  }
};

// The request carries no body; cap it like the checkout endpoint does.
handler.config = {
  api: {
    bodyParser: { sizeLimit: '1kb' },
  },
};

module.exports = handler;
