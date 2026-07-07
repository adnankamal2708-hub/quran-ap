// ═══════════════════════════════════════════════════════════════
// config.js — Firebase Configuration & Initialization
//
// 🔐 SECURITY NOTE:
// Firebase API keys are designed to be public — they identify your
// project to Google's servers. Security is enforced through
// Firebase Security Rules (Firestore) and Firebase App Check.
//
// To set up:
//   1. Go to https://console.firebase.google.com
//   2. Create a project (or use existing)
//   3. Enable Authentication → Sign-in method → Email/Password
//   4. Create a Firestore database (start in test mode, then lock down)
//   5. Go to Project Settings → General → Your apps → Web app
//   6. Copy the config values below
//   7. (Optional) Enable Firebase App Check for extra security
// ═══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  // ── Paste your Firebase Web App config here ──────────────
  apiKey:            "AIzaSyActPDi21DFbyGl7KeecPC_CFuJuor9fxo",
  authDomain:        "bayan-quran-vocabulary.firebaseapp.com",
  projectId:         "bayan-quran-vocabulary",
  storageBucket:     "bayan-quran-vocabulary.firebasestorage.app",
  messagingSenderId: "857901285463",
  appId:             "1:857901285463:web:9dc416c77b0add0e366312",
};

// ── Feature flags ─────────────────────────────────────────────

/** Automatically sync data on login (no prompt). If false, user is asked. */
const AUTO_IMPORT_ON_LOGIN = true;

/** Debounce delay (ms) for sync writes to Firestore */
const SYNC_DEBOUNCE_MS = 2000;

/** Firestore collection name for user learning data */
const FIRESTORE_LEARNING_COLLECTION = 'learning';

/** Firestore collection name for user profiles */
const FIRESTORE_PROFILE_COLLECTION = 'profiles';

/** LocalStorage key for pending sync queue (offline changes) */
const PENDING_SYNC_KEY = 'quran_sync_pending';
