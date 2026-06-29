// ═══════════════════════════════════════════════════════════════
// auth-service.js — Firebase Authentication Service
//
// Wraps Firebase Auth with a clean interface for the app.
// Handles: login, signup, logout, password reset, email
// verification, session persistence (remember me), and
// auth state observation.
//
// All public functions return Promises or values — no Firebase
// objects leak outside this module.
// ═══════════════════════════════════════════════════════════════

/** @type {firebase.auth.Auth|null} */
let _auth = null;

/** @type {boolean} Whether Firebase Auth is available */
let _authReady = false;

/** @type {Set<Function>} Auth state change listeners */
const _listeners = new Set();

/** @type {Object|null} Current user info cache */
let _currentUser = null;

// ── Initialization ────────────────────────────────────────────

/**
 * Initialize the auth service. Must be called once after Firebase SDK loads.
 * Returns true if successful, false if Firebase is not available.
 */
function initAuth() {
  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.warn('[auth] Firebase SDK not loaded — auth disabled.');
    _authReady = false;
    return false;
  }

  try {
    // Initialize Firebase app (safe to call multiple times)
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _auth = firebase.auth();

    // Watch auth state
    _auth.onIdTokenChanged(function (user) {
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
 * Returns { uid, email, displayName, emailVerified, createdAt, lastSignIn, photoURL, isAnonymous } or null.
 */
function getCurrentUser() {
  return _currentUser;
}

/**
 * Get a fresh user object from Firebase (async, may trigger re-fetch).
 * Returns user object or null.
 */
async function fetchCurrentUser() {
  if (!_authReady || !_auth || !_auth.currentUser) {
    _currentUser = null;
    return null;
  }
  try {
    await _auth.currentUser.reload();
    var user = _auth.currentUser;
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
 * Returns { user } on success.
 * Throws an Error with a user-friendly message on failure.
 */
async function signUpWithEmail(email, password, displayName) {
  if (!_authReady || !_auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    var result = await _auth.createUserWithEmailAndPassword(email, password);

    // Set display name
    if (displayName && result.user) {
      await result.user.updateProfile({ displayName: displayName });
    }

    // Send verification email
    if (result.user && !result.user.emailVerified) {
      await result.user.sendEmailVerification({
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
 * @param {string} email
 * @param {string} password
 * @param {boolean} rememberMe - If true, persist session across browser restarts
 * @returns {Promise<{user: Object}>}
 */
async function loginWithEmail(email, password, rememberMe) {
  if (!_authReady || !_auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    if (rememberMe) {
      await _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } else {
      await _auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    }

    var result = await _auth.signInWithEmailAndPassword(email, password);
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
  if (!_authReady || !_auth) return;
  try {
    await _auth.signOut();
    _currentUser = null;
  } catch (e) {
    console.warn('[auth] Logout error:', e.message);
  }
}

// ── Password Reset ────────────────────────────────────────────

/**
 * Send a password reset email.
 * Returns success message string.
 */
async function sendPasswordResetEmail(email) {
  if (!_authReady || !_auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    await _auth.sendPasswordResetEmail(email, {
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
 * Used when the user is on the reset-password page with an oobCode.
 */
async function confirmPasswordReset(oobCode, newPassword) {
  if (!_authReady || !_auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    await _auth.confirmPasswordReset(oobCode, newPassword);
    return 'Password has been reset successfully. Please sign in.';
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Check if the URL contains a password reset or email verification code.
 * Returns { mode: 'resetPassword'|'verifyEmail'|null, oobCode: string|null, continueUrl: string|null }
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
  if (!_authReady || !_auth) {
    throw new Error('Authentication service is not available.');
  }

  try {
    await _auth.applyActionCode(oobCode);
    // Reload user to update emailVerified
    if (_auth.currentUser) {
      await _auth.currentUser.reload();
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
  if (!_authReady || !_auth || !_auth.currentUser) {
    throw new Error('No user is signed in.');
  }

  try {
    await _auth.currentUser.sendEmailVerification({
      url: window.location.origin + '/',
      handleCodeInApp: true,
    });
    return 'Verification email sent.';
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

// ── Update Profile (from profile page) ────────────────────────

/**
 * Update the current user's display name.
 */
async function updateDisplayName(newName) {
  if (!_authReady || !_auth || !_auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await _auth.currentUser.updateProfile({ displayName: newName });
    // Update cache
    if (_currentUser) _currentUser.displayName = newName;
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Update the current user's email address.
 * Sends a verification email to the new address.
 */
async function updateEmail(newEmail) {
  if (!_authReady || !_auth || !_auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await _auth.currentUser.updateEmail(newEmail);
    if (_currentUser) _currentUser.email = newEmail;
    // New email needs to be verified
    await _auth.currentUser.sendEmailVerification({
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
  if (!_authReady || !_auth || !_auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    await _auth.currentUser.updatePassword(newPassword);
    return true;
  } catch (e) {
    // If credential error, user should re-authenticate
    throw _translateFirebaseError(e);
  }
}

/**
 * Re-authenticate the user before sensitive operations.
 */
async function reauthenticate(email, password) {
  if (!_authReady || !_auth || !_auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    var credential = firebase.auth.EmailAuthProvider.credential(email, password);
    await _auth.currentUser.reauthenticateWithCredential(credential);
    return true;
  } catch (e) {
    throw _translateFirebaseError(e);
  }
}

/**
 * Delete the current user's account.
 */
async function deleteAccount() {
  if (!_authReady || !_auth || !_auth.currentUser) {
    throw new Error('No user is signed in.');
  }
  try {
    // Note: User should be re-authenticated before this call
    await _auth.currentUser.delete();
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
      // Log unexpected errors for debugging
      console.warn('[auth] Untranslated error:', code);
      return new Error('Something went wrong. Please try again.');
  }
}

// ── Export ────────────────────────────────────────────────────

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
