// ═══════════════════════════════════════════════════════════════
// firebase-auth-core.js — Firebase app and sign-in, without Firestore
//
// The landing page loads only this module: it just needs to know whether
// someone is signed in, so it skips downloading Firestore. The app loads
// firebase-core.js, which builds on this module and adds Firestore.
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getAuth,
  onIdTokenChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  applyActionCode,
  updateProfile,
  updateEmail,
  updatePassword,
  sendEmailVerification,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';

// Duplicated from js/services/config.js: an ES module cannot read the
// `const` of a classic script. Must stay in sync with js/services/config.js.
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyActPDi21DFbyGl7KeecPC_CFuJuor9fxo",
  authDomain:        "bayan-quran-vocabulary.firebaseapp.com",
  projectId:         "bayan-quran-vocabulary",
  storageBucket:     "bayan-quran-vocabulary.firebasestorage.app",
  messagingSenderId: "857901285463",
  appId:             "1:857901285463:web:9dc416c77b0add0e366312",
};

let app = null;
let auth = null;

/**
 * Start the Firebase app and Auth. Safe to call more than once.
 * Returns true on success, false if Firebase is unavailable.
 */
export function initAuthCore() {
  if (auth) return true;
  try {
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    return true;
  } catch (e) {
    console.warn('[firebase] Auth init failed:', e.message);
    return false;
  }
}

/** The Firebase app, once initAuthCore() has run (null before). */
export function getFirebaseApp() {
  return app;
}

/** Subscribe to sign-in changes. Returns an unsubscribe function. */
function subscribeToAuth(callback) {
  if (!auth) {
    console.warn('[firebase] Auth not initialized.');
    return function () {};
  }
  return onIdTokenChanged(auth, callback);
}

/**
 * What auth-service.js reads from window.__firebaseCore. The landing page
 * uses it as is; firebase-core.js adds Firestore to it for the app.
 */
export const authCore = {
  initCore: initAuthCore,
  subscribeToAuth: subscribeToAuth,
  isReady: function () { return auth !== null; },
  getAuth: function () { return auth; },

  createUserWithEmailAndPassword: createUserWithEmailAndPassword,
  signInWithEmailAndPassword: signInWithEmailAndPassword,
  signOut: signOut,
  sendPasswordResetEmail: sendPasswordResetEmail,
  confirmPasswordReset: confirmPasswordReset,
  applyActionCode: applyActionCode,
  updateProfile: updateProfile,
  updateEmail: updateEmail,
  updatePassword: updatePassword,
  sendEmailVerification: sendEmailVerification,
  deleteUser: deleteUser,
  reauthenticateWithCredential: reauthenticateWithCredential,
  reauthenticateWithPopup: reauthenticateWithPopup,
  EmailAuthProvider: EmailAuthProvider,
  GoogleAuthProvider: GoogleAuthProvider,
  signInWithPopup: signInWithPopup,
  setPersistence: setPersistence,
  browserLocalPersistence: browserLocalPersistence,
  browserSessionPersistence: browserSessionPersistence,
};
