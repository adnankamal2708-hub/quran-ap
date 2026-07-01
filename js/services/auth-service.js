// ═══════════════════════════════════════════════════════════════
// auth-service.js — Firebase Authentication Service (v12 Modular SDK)
//
// Wraps Firebase Auth with a clean interface for the app.
// All public functions are attached to window for backward
// compatibility with non-module app scripts.
//
// Firebase v12 modular functions are accessed through
// window.__firebaseCore (provided by firebase-core.js module).
// ═══════════════════════════════════════════════════════════════

// ── Import Firebase functions from the core bridge ─────────────
// Use `var` (not `const`) so that when build.js concatenates multiple
// service files, the same variable names can be safely re-declared.
var {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail: _sendPasswordResetEmail,
  confirmPasswordReset: _confirmPasswordReset,
  applyActionCode: _applyActionCode,
  updateProfile,
  updateEmail: _updateEmail,
  updatePassword: _updatePassword,
  sendEmailVerification,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} = window.__firebaseCore || {};

// Also need firestore funcs for user document creation
var {
  doc: _doc,
  setDoc: _setDoc,
  serverTimestamp: _serverTimestamp,
} = window.__firebaseCore || {};

/** @type {boolean} Whether Firebase Auth is available */
let _authReady = false;

/** @type {Set<Function>} Auth state change listeners */
const _listeners = new Set();

/** @type {Object|null} Current user info cache */
let _currentUser = null;

/** @type {Function|null} Unsubscribe function for auth state listener */
let _unsubscribeAuth = null;

// ── Initialization ────────────────────────────────────────────

/**
 * Initialize the auth service. Must be called once after DOM ready.
 * Returns true if successful, false if Firebase is not available.
 */
function initAuth() {
  const ok = window.__firebaseCore ? window.__firebaseCore.initCore() : false;
  if (!ok) {
    console.warn('[auth] Firebase core not available — auth disabled.');
    _authReady = false;
    return false;
  }

  try {
    // Subscribe to auth state changes using modular SDK
    _unsubscribeAuth = window.__firebaseCore.subscribeToAuth(function (user) {
      if (user) {
        _currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          createdAt: user.metadata ? user.metadata.creationTime : null,
          lastSignIn: user.metadata ? user.metadata.lastSignInTime : null,
          photoURL: user.photoURL || null,
          isAnonymous: user.isAnonymous || false,
        };
      } else {
        _currentUser = null;
      }

      // Notify listeners
      _listeners.forEach(function (fn) {
        try { fn(_currentUser); } catch (e) { console.warn('[auth] listener error:', e); }
      });
    });

    _authReady = true;
    return true;
  } catch (e) {
    console.warn('[auth] Init failed:', e.message);
    _authReady = false;
    return false;
  }
}

/**
 * Check if Firebase Auth is initialized and available.
 */
function isAuthReady() {
  return _authReady;
}

// ── Auth State ────────────────────────────────────────────────

/**
 * Get the current user (cached, synchronous).
 */
function getCurrentUser() {
  return _currentUser;
}

/**
 * Get a fresh user object from Firebase (async).
 * Returns user object or null.
 */
async function fetchCurrentUser() {
  if (!_authReady) {
    _currentUser = null;
    return null;
  }
  try {
    const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
    if (!auth || !auth.currentUser) {
      _currentUser = null;
      return null;
    }
    await auth.currentUser.reload();
    const user = auth.currentUser;
    _currentUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      createdAt: user.metadata ? user.metadata.creationTime : null,
      lastSignIn: user.metadata ? user.metadata.lastSignInTime : null,
      photoURL: user.photoURL || null,
      isAnonymous: user.isAnonymous || false,
    };
    return _currentUser;
  } catch (e) {
    console.warn('[auth] Error fetching user:', e.message);
    return _currentUser;
  }
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
function onAuthChange(fn) {
  _listeners.add(fn);
  // Immediately call with current state if available
  if (_currentUser !== null) {
    try { fn(_currentUser); } catch (e) { /* ignore */ }
  }
  return function () {
    _listeners.delete(fn);
  };
}

// ── Sign Up ───────────────────────────────────────────────────

/**
 * Create a new account with email and password.
 */
async function signUpWithEmail(email, password, displayName) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  const db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;

  if (!auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Set display name
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName: displayName });
    }

    // Send verification email
    if (result.user && !result.user.emailVerified) {
      await sendEmailVerification(result.user, {
        url: window.location.origin + '/',
        handleCodeInApp: true,
      });
    }

    return { user: result.user };
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

// ── Login ─────────────────────────────────────────────────────

/**
 * Sign in with email and password.
 */
async function loginWithEmail(email, password, rememberMe) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;

  if (!auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    if (rememberMe) {
      await setPersistence(auth, browserLocalPersistence);
    } else {
      await setPersistence(auth, browserSessionPersistence);
    }

    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user };
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

// ── Logout ────────────────────────────────────────────────────

/**
 * Sign out the current user.
 */
async function logout() {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth) return;
  try {
    await signOut(auth);
    _currentUser = null;
  } catch (e) {
    console.warn('[auth] Logout error:', e.message);
  }
}

// ── Password Reset ────────────────────────────────────────────

/**
 * Send a password reset email.
 */
async function sendPasswordResetEmail(email) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    await _sendPasswordResetEmail(auth, email, {
      url: window.location.origin + '/',
      handleCodeInApp: true,
    });
    return 'Password reset email sent. Check your inbox.';
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Confirm password reset with code and new password.
 */
async function confirmPasswordReset(oobCode, newPassword) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    await _confirmPasswordReset(auth, oobCode, newPassword);
    return 'Password has been reset successfully. Please sign in.';
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Check if the URL contains a password reset or email verification code.
 */
function checkActionCode() {
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode');
  var oobCode = params.get('oobCode');
  var continueUrl = params.get('continueUrl');

  if (mode === 'resetPassword' && oobCode) {
    return { mode: 'resetPassword', oobCode: oobCode, continueUrl: continueUrl };
  }
  if (mode === 'verifyEmail' && oobCode) {
    return { mode: 'verifyEmail', oobCode: oobCode, continueUrl: continueUrl };
  }
  return { mode: null, oobCode: null, continueUrl: null };
}

/**
 * Apply an email verification code.
 */
async function applyVerificationCode(oobCode) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    await _applyActionCode(auth, oobCode);
    // Reload user to update emailVerified
    if (auth.currentUser) {
      await auth.currentUser.reload();
    }
    return 'Email verified successfully!';
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

// ── Resend Verification Email ─────────────────────────────────

/**
 * Resend the email verification email.
 */
async function resendVerificationEmail() {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth || !auth.currentUser) {
    throw new Error('No user is signed in.');
  }

  try {
    await sendEmailVerification(auth.currentUser, {
      url: window.location.origin + '/',
      handleCodeInApp: true,
    });
    return 'Verification email sent.';
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

// ── Update Profile ────────────────────────────────────────────

/**
 * Update the current user's display name.
 */
async function updateDisplayName(newName) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth || !auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await updateProfile(auth.currentUser, { displayName: newName });
    if (_currentUser) _currentUser.displayName = newName;
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Update the current user's email address.
 */
async function updateEmail(newEmail) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth || !auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await _updateEmail(auth.currentUser, newEmail);
    if (_currentUser) _currentUser.email = newEmail;
    // New email needs to be verified
    await sendEmailVerification(auth.currentUser, {
      url: window.location.origin + '/',
      handleCodeInApp: true,
    });
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Update the current user's password (requires recent login).
 */
async function updatePassword(newPassword) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth || !auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await _updatePassword(auth.currentUser, newPassword);
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Re-authenticate the user before sensitive operations.
 */
async function reauthenticate(email, password) {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth || !auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Delete the current user's account.
 */
async function deleteAccount() {
  const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
  if (!auth || !auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await deleteUser(auth.currentUser);
    _currentUser = null;
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

// ── Error Translation ─────────────────────────────────────────

/**
 * Translate Firebase auth error codes into user-friendly messages.
 */
function _translateFirebaseError(error) {
  var code = error.code || error.message || 'unknown';

  switch (code) {
    case 'auth/email-already-in-use':
      return new Error('This email is already registered. Try signing in instead.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid email address.');
    case 'auth/user-disabled':
      return new Error('This account has been disabled.');
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return new Error('Invalid email or password.');
    case 'auth/weak-password':
      return new Error('Password should be at least 6 characters.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Please try again later.');
    case 'auth/requires-recent-login':
      return new Error('Please sign in again before making this change.');
    case 'auth/network-request-failed':
      return new Error('Network error. Check your connection and try again.');
    case 'auth/operation-not-allowed':
      return new Error('Email/password sign-in is not enabled. Please contact support.');
    case 'auth/expired-action-code':
      return new Error('This verification link has expired. Please request a new one.');
    case 'auth/invalid-action-code':
      return new Error('This verification link is invalid. Please request a new one.');
    default:
      console.warn('[auth] Untranslated error:', code);
      return new Error('Something went wrong. Please try again.');
  }
}

// ── Export ────────────────────────────────────────────────────

// Attach all public functions to window for non-module scripts
window.getCurrentUser = getCurrentUser;
window.initAuth = initAuth;
window.fetchCurrentUser = fetchCurrentUser;
window.onAuthChange = onAuthChange;
window.signUpWithEmail = signUpWithEmail;
window.loginWithEmail = loginWithEmail;
window.logout = logout;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.confirmPasswordReset = confirmPasswordReset;
window.checkActionCode = checkActionCode;
window.applyVerificationCode = applyVerificationCode;
window.resendVerificationEmail = resendVerificationEmail;
window.updateDisplayName = updateDisplayName;
window.updateEmail = updateEmail;
window.updatePassword = updatePassword;
window.reauthenticate = reauthenticate;
window.deleteAccount = deleteAccount;

window.__auth = {
  init: initAuth,
  isReady: isAuthReady,
  getCurrentUser: getCurrentUser,
  fetchCurrentUser: fetchCurrentUser,
  onAuthChange: onAuthChange,
  signUp: signUpWithEmail,
  login: loginWithEmail,
  logout: logout,
  sendPasswordReset: sendPasswordResetEmail,
  confirmPasswordReset: confirmPasswordReset,
  checkActionCode: checkActionCode,
  applyVerificationCode: applyVerificationCode,
  resendVerification: resendVerificationEmail,
  updateDisplayName: updateDisplayName,
  updateEmail: updateEmail,
  updatePassword: updatePassword,
  reauthenticate: reauthenticate,
  deleteAccount: deleteAccount,
};
