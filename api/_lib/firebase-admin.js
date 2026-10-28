/**
 * Shared Firebase Admin initialization for the api/ handlers.
 *
 * Vercel does not expose files under api/_lib as endpoints (underscore
 * prefix), so this is a plain module the handlers require.
 *
 * Initialization never throws at module load: a missing or malformed
 * FIREBASE_SERVICE_ACCOUNT used to crash the function before it could
 * respond. Handlers check isAdminReady() and return a clear
 * "Server configuration error" instead.
 */

const admin = require('firebase-admin');

let initError = null;

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (err) {
    initError = err;
    console.error('[firebase-admin] Initialization failed — check FIREBASE_SERVICE_ACCOUNT:', err.message || err);
  }
}

/** Whether Firebase Admin initialized and can be used. */
function isAdminReady() {
  return !initError && admin.apps.length > 0;
}

module.exports = { admin, isAdminReady };
