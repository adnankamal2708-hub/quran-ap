// ═══════════════════════════════════════════════════════════════
// firebase-core.js — Firebase v12 Modular SDK Core
//
// SINGLE entry point for Firebase v12 modular SDK.
// Load this as <script type="module"> before all other scripts.
//
// All Firebase functions are attached to window.__firebaseCore
// so that non-module scripts (auth-service, sync-service, etc.)
// can access them without their own import statements.
//
// The app and sign-in come from firebase-auth-core.js (which the landing
// page loads alone); this module adds Firestore for the app.
// ═══════════════════════════════════════════════════════════════

import { authCore, initAuthCore, getFirebaseApp } from './firebase-auth-core.js';

// ── Firebase Firestore ─────────────────────────────────────────
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

// ── Internal State ─────────────────────────────────────────────

let db = null;
let _initialized = false;

// ── Initialization ─────────────────────────────────────────────

/**
 * Initialize Firebase services. Safe to call multiple times.
 * Returns true on success, false if Firebase is unavailable.
 */
function initCore() {
  if (_initialized) return true;
  if (!initAuthCore()) return false;

  try {
    // Multi-tab offline persistence via FirestoreSettings.cache
    // (replaces the deprecated enableMultiTabIndexedDbPersistence())
    db = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    _initialized = true;
    console.log('[firebase] Firebase v12 modular SDK initialized.');
    return true;
  } catch (e) {
    console.warn('[firebase] Init failed:', e.message);
    return false;
  }
}

/**
 * Check if Firebase is initialized.
 */
function isReady() {
  return _initialized;
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

window.__firebaseCore = Object.assign({}, authCore, {
  // Core
  initCore: initCore,
  isReady: isReady,
  getDb: getDb,

  // Firestore functions
  doc: doc,
  getDoc: getDoc,
  onSnapshot: onSnapshot,
  setDoc: setDoc,
  deleteDoc: deleteDoc,
  serverTimestamp: serverTimestamp,
});

console.log('[firebase] Core module loaded. Firebase v12 APIs attached to window.__firebaseCore.');

// The app may already be running (index.html imports this module in the
// background): tell it Firebase is here.
window.dispatchEvent(new Event('firebase-core-ready'));
