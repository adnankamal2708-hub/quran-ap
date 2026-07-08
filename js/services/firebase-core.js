// ═══════════════════════════════════════════════════════════════
// firebase-core.js — Firebase v12 Modular SDK Core
//
// SINGLE entry point for Firebase v12 modular SDK.
// Load this as <script type="module"> before all other scripts.
//
// All Firebase functions are attached to window.__firebaseCore
// so that non-module scripts (auth-service, sync-service, etc.)
// can access them without their own import statements.
// ═══════════════════════════════════════════════════════════════

// ── Firebase App ───────────────────────────────────────────────
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';

// ── Firebase Auth ──────────────────────────────────────────────
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
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';

// ── Firebase Firestore ─────────────────────────────────────────
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

// ── Firebase Configuration ─────────────────────────────────────
// Duplicated from js/services/config.js for ES module self-containment.
// ES modules have isolated scope and cannot access `const` from non-module scripts.
// Must stay in sync with js/services/config.js.
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyActPDi21DFbyGl7KeecPC_CFuJuor9fxo",
  authDomain:        "bayan-quran-vocabulary.firebaseapp.com",
  projectId:         "bayan-quran-vocabulary",
  storageBucket:     "bayan-quran-vocabulary.firebasestorage.app",
  messagingSenderId: "857901285463",
  appId:             "1:857901285463:web:9dc416c77b0add0e366312",
};

// ── Internal State ─────────────────────────────────────────────

let app = null;
let auth = null;
let db = null;
let _initialized = false;

// ── Initialization ─────────────────────────────────────────────

/**
 * Initialize Firebase services. Safe to call multiple times.
 * Returns true on success, false if Firebase is unavailable.
 */
function initCore() {
  console.log('[startup] [firebase] initCore called, _initialized:', _initialized);
  if (_initialized) return true;

  try {
    console.log('[startup] [firebase] initializeApp...');
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(FIREBASE_CONFIG);
    console.log('[startup] [firebase] App initialized');
    auth = getAuth(app);
    console.log('[startup] [firebase] Auth instance obtained');
    // Initialize Firestore with multi-tab offline persistence via FirestoreSettings.cache
    // (replaces the deprecated enableMultiTabIndexedDbPersistence())
    console.log('[startup] [firebase] Initializing Firestore with persistence...');
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    console.log('[startup] [firebase] Firestore initialized with persistence');

    _initialized = true;
    console.log('[firebase] Firebase v12 modular SDK initialized.');
    return true;
  } catch (e) {
    console.warn('[firebase] Init failed:', e.message);
    return false;
  }
}

/**
 * Subscribe to auth state changes using the modular SDK.
 * Returns an unsubscribe function.
 */
function subscribeToAuth(callback) {
  if (!auth) {
    console.warn('[firebase] Auth not initialized.');
    return function () {};
  }
  console.log('[startup] [firebase] subscribeToAuth — registering onIdTokenChanged listener');
  var unsub = onIdTokenChanged(auth, callback);
  console.log('[startup] [firebase] onIdTokenChanged listener registered');
  return unsub;
}

/**
 * Check if Firebase is initialized.
 */
function isReady() {
  return _initialized;
}

/**
 * Get the Auth instance.
 */
function getAuthInstance() {
  return auth;
}

/**
 * Get the Firestore instance.
 */
function getDb() {
  return db;
}

// ═══════════════════════════════════════════════════════════════
// Attach ALL Firebase module functions to window.__firebaseCore
// so non-module scripts can use them without import statements.
// ═══════════════════════════════════════════════════════════════

window.__firebaseCore = {
  // Core
  initCore: initCore,
  subscribeToAuth: subscribeToAuth,
  isReady: isReady,
  getAuth: getAuthInstance,
  getDb: getDb,

  // Auth functions
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
  EmailAuthProvider: EmailAuthProvider,
  setPersistence: setPersistence,
  browserLocalPersistence: browserLocalPersistence,
  browserSessionPersistence: browserSessionPersistence,

  // Firestore functions
  doc: doc,
  getDoc: getDoc,
  setDoc: setDoc,
  deleteDoc: deleteDoc,
  serverTimestamp: serverTimestamp,
  // NOTE: enableMultiTabIndexedDbPersistence is deprecated in v12.
  // Persistence is now configured via initializeFirestore({ localCache: ... }).
  // The legacy function is no longer exported.
};

console.log('[firebase] Core module loaded. Firebase v12 APIs attached to window.__firebaseCore.');
