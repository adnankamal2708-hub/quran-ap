// ═══════════════════════════════════════════════════════════════
// auth-ui.js — Authentication UI Module
//
// Renders and manages the auth forms (login, signup, forgot/
// reset password, email verification), the user menu in the
// top bar, and the auth guard for protected actions.
//
// All forms match the existing dark theme with gold accents.
// ═══════════════════════════════════════════════════════════════

/** Currently active auth sub-view: 'login' | 'signup' | 'forgot' | 'reset' | 'verify' | 'none' */
let _currentAuthView = 'none';

/** Track if user was prompted to import data */
let _importPrompted = false;

// ── Initialization ────────────────────────────────────────────

/**
 * Initialize auth UI. Attaches event listeners to auth forms.
 * Called after DOM is ready and Firebase is initialized.
 */
function initAuthUI() {
  wireAuthFormEvents();
  wireUserMenuEvents();
  wireGuestNoticeEvents();
  checkActionCodeOnLoad();

  // Watch auth state to update UI
  onAuthChange(function (user) {
    updateAuthUI(user);
  });
}

// ── Auth View Switching ───────────────────────────────────────

/**
 * Show a specific auth sub-view (login, signup, forgot, reset).
 *
 * @param {string} viewName — one of 'login' | 'signup' | 'forgot' | 'reset' | 'verify'
 * @param {Object} [opts] — { google: boolean } enables the Google sign-in
 *   option for this view. Used for the staged rollout: only the Profile-tab
 *   entry point passes { google: true } in Stage A; other entry points
 *   (header sign-in link, post-lesson prompt) keep it hidden until Stage B.
 */
function showAuthView(viewName, opts) {
  _currentAuthView = viewName;
  var enableGoogle = !!(opts && opts.google);
  var views = ['auth-login', 'auth-signup', 'auth-forgot', 'auth-reset', 'auth-verify'];
  views.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = (id === 'auth-' + viewName) ? 'block' : 'none';
  });

  // Update title
  var titleEl = document.getElementById('auth-title');
  var titles = {
    'login': 'Sign In',
    'signup': 'Create Account',
    'forgot': 'Reset Password',
    'reset': 'Set New Password',
    'verify': 'Verify Email',
  };
  if (titleEl) titleEl.textContent = titles[viewName] || 'Account';

  _applyGoogleVisibility(viewName, enableGoogle);
}

/**
 * Toggle the "Sign in with Google" sections based on the active view and
 * whether the entry point enabled Google sign-in (Stage A gate).
 */
function _applyGoogleVisibility(viewName, enableGoogle) {
  var loginSection = document.getElementById('auth-google-login');
  var signupSection = document.getElementById('auth-google-signup');
  if (loginSection) {
    loginSection.style.display = (viewName === 'login' && enableGoogle) ? 'block' : 'none';
  }
  if (signupSection) {
    signupSection.style.display = (viewName === 'signup' && enableGoogle) ? 'block' : 'none';
  }
}

// ── Event Wiring ──────────────────────────────────────────────

function wireAuthFormEvents() {
  // ── Login ──
  var loginForm = document.getElementById('auth-login-form');
  if (loginForm) {
    loginForm.onsubmit = function (e) {
      e.preventDefault();
      handleLogin();
    };
  }

  // Forgot password link on login form
  var forgotLink = document.getElementById('auth-forgot-link');
  if (forgotLink) {
    forgotLink.onclick = function (e) {
      e.preventDefault();
      showAuthView('forgot');
    };
  }

  // Sign up link on login form
  var signupLink = document.getElementById('auth-signup-link');
  if (signupLink) {
    signupLink.onclick = function (e) {
      e.preventDefault();
      showAuthView('signup');
    };
  }

  // ── Sign Up ──
  var signupForm = document.getElementById('auth-signup-form');
  if (signupForm) {
    signupForm.onsubmit = function (e) {
      e.preventDefault();
      handleSignUp();
    };
  }

  // Login link on signup form
  var loginLink = document.getElementById('auth-login-link');
  if (loginLink) {
    loginLink.onclick = function (e) {
      e.preventDefault();
      showAuthView('login');
    };
  }

  // ── Sign In with Google ──
  var googleLoginBtn = document.getElementById('auth-google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.onclick = handleGoogleSignIn;
  }
  var googleSignupBtn = document.getElementById('auth-google-signup-btn');
  if (googleSignupBtn) {
    googleSignupBtn.onclick = handleGoogleSignIn;
  }

  // ── Forgot Password ──
  var forgotForm = document.getElementById('auth-forgot-form');
  if (forgotForm) {
    forgotForm.onsubmit = function (e) {
      e.preventDefault();
      handleForgotPassword();
    };
  }

  // Back to login link on forgot form
  var backLogin = document.getElementById('auth-back-login');
  if (backLogin) {
    backLogin.onclick = function (e) {
      e.preventDefault();
      showAuthView('login');
    };
  }

  // ── Reset Password ──
  var resetForm = document.getElementById('auth-reset-form');
  if (resetForm) {
    resetForm.onsubmit = function (e) {
      e.preventDefault();
      handleResetPassword();
    };
  }

  // ── Verify Email ──
  var resendBtn = document.getElementById('auth-resend-verify');
  if (resendBtn) {
    resendBtn.onclick = function () {
      handleResendVerification();
    };
  }
}

function wireUserMenuEvents() {
  // Avatar display in top bar (clickable but routes to profile via nav tab)
  var avatarDisplay = document.getElementById('user-avatar-display');
  if (avatarDisplay) {
    avatarDisplay.onclick = function () {
      switchView('profile');
    };
  }

  // Logout button
  var logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = function () {
      handleLogout();
    };
  }
}

// ── Auth Action Handlers ──────────────────────────────────────

async function handleLogin() {
  var email = document.getElementById('auth-login-email').value.trim();
  var password = document.getElementById('auth-login-password').value;
  var rememberMe = document.getElementById('auth-remember').checked;
  var errorEl = document.getElementById('auth-login-error');
  var submitBtn = document.getElementById('auth-login-submit');

  // Validate
  if (!email || !password) {
    showAuthError(errorEl, 'Please fill in all fields.');
    // Link error to form inputs for screen readers
    var emailInput = document.getElementById('auth-login-email');
    var pwdInput = document.getElementById('auth-login-password');
    if (emailInput) emailInput.setAttribute('aria-describedby', 'auth-login-error');
    if (pwdInput) pwdInput.setAttribute('aria-describedby', 'auth-login-error');
    return;
  }

  setButtonLoading(submitBtn, true);
  hideAuthError(errorEl);

  try {
    var result = await loginWithEmail(email, password, rememberMe);

    // Check email verification
    if (result.user && !result.user.emailVerified) {
      showAuthView('verify');
      var verifyEmailEl = document.getElementById('auth-verify-email');
      if (verifyEmailEl) verifyEmailEl.textContent = email;
      setButtonLoading(submitBtn, false);
      return;
    }

    // Prompt to import local data
    await promptImportLocalData();

    // Navigate to learn view
    switchView('learn');
    setButtonLoading(submitBtn, false);
  } catch (e) {
    showAuthError(errorEl, e.message);
    setButtonLoading(submitBtn, false);
  }
}

async function handleGoogleSignIn() {
  // Show errors in whichever auth view is active (login or signup).
  var isSignup = (_currentAuthView === 'signup');
  var errorEl = document.getElementById(isSignup ? 'auth-signup-error' : 'auth-login-error');
  var btn = document.getElementById(isSignup ? 'auth-google-signup-btn' : 'auth-google-login-btn');

  hideAuthError(errorEl);
  setButtonLoading(btn, true);

  try {
    var result = await signInWithGoogle();
    var user = result.user;

    // Google-verified emails skip the email-verification step.
    // Ensure the Firestore profile doc exists (same shape as email/password
    // signup: profiles/{uid} with displayName/email/settings). Create only if
    // missing so returning users' saved settings are never overwritten.
    try {
      var existingProfile = (typeof loadProfile === 'function') ? await loadProfile(user.uid) : null;
      if (!existingProfile && typeof saveProfile === 'function') {
        var profileData = {
          displayName: user.displayName || (user.email || 'User'),
          email: user.email,
          settings: getDefaultSettings(),
        };
        if (user.photoURL) profileData.avatarUrl = user.photoURL;
        await saveProfile(user.uid, profileData);
      }
    } catch (e) {
      // Profile creation is non-fatal — auth/premium/sync key off the UID,
      // so a profile write failure must never block sign-in.
      console.warn('[auth] Could not ensure profile doc for Google user:', e && e.message || e);
    }

    // Prompt to import local data (same post-login flow as email/password)
    await promptImportLocalData();

    setButtonLoading(btn, false);
    switchView('learn');
  } catch (e) {
    setButtonLoading(btn, false);
    // User closing the popup is not a failure — stay silent.
    if (e && e.silent) return;
    showAuthError(errorEl, (e && e.message) || 'Something went wrong. Please try again.');
  }
}

async function handleSignUp() {
  var name = document.getElementById('auth-signup-name').value.trim();
  var email = document.getElementById('auth-signup-email').value.trim();
  var password = document.getElementById('auth-signup-password').value;
  var confirm = document.getElementById('auth-signup-confirm').value;
  var errorEl = document.getElementById('auth-signup-error');
  var submitBtn = document.getElementById('auth-signup-submit');

  // Validate
  if (!name || !email || !password || !confirm) {
    showAuthError(errorEl, 'Please fill in all fields.');
    document.getElementById('auth-signup-name').setAttribute('aria-describedby', 'auth-signup-error');
    document.getElementById('auth-signup-email').setAttribute('aria-describedby', 'auth-signup-error');
    document.getElementById('auth-signup-password').setAttribute('aria-describedby', 'auth-signup-error');
    document.getElementById('auth-signup-confirm').setAttribute('aria-describedby', 'auth-signup-error');
    return;
  }
  if (password !== confirm) {
    showAuthError(errorEl, 'Passwords do not match.');
    document.getElementById('auth-signup-password').setAttribute('aria-describedby', 'auth-signup-error');
    document.getElementById('auth-signup-confirm').setAttribute('aria-describedby', 'auth-signup-error');
    return;
  }
  if (password.length < 6) {
    showAuthError(errorEl, 'Password must be at least 6 characters.');
    document.getElementById('auth-signup-password').setAttribute('aria-describedby', 'auth-signup-error');
    return;
  }

  setButtonLoading(submitBtn, true);
  hideAuthError(errorEl);

  try {
    var result = await signUpWithEmail(email, password, name);

    // Create user profile in Firestore
    var userId = result.user.uid;
    var defaultSettings = getDefaultSettings();
    await saveProfile(userId, {
      displayName: name,
      email: email,
      settings: defaultSettings,
    });

    // Prompt to import local data
    await promptImportLocalData();

    // Show verification notice
    showAuthView('verify');
    var verifyEmailEl = document.getElementById('auth-verify-email');
    if (verifyEmailEl) verifyEmailEl.textContent = email;

    setButtonLoading(submitBtn, false);
  } catch (e) {
    showAuthError(errorEl, e.message);
    setButtonLoading(submitBtn, false);
  }
}

async function handleForgotPassword() {
  var email = document.getElementById('auth-forgot-email').value.trim();
  var errorEl = document.getElementById('auth-forgot-error');
  var successEl = document.getElementById('auth-forgot-success');
  var submitBtn = document.getElementById('auth-forgot-submit');

  if (!email) {
    showAuthError(errorEl, 'Please enter your email address.');
    document.getElementById('auth-forgot-email').setAttribute('aria-describedby', 'auth-forgot-error');
    return;
  }

  setButtonLoading(submitBtn, true);
  hideAuthError(errorEl);
  if (successEl) successEl.style.display = 'none';

  try {
    var msg = await sendPasswordResetEmail(email);
    setButtonLoading(submitBtn, false);
    if (successEl) {
      successEl.textContent = msg;
      successEl.style.display = 'block';
    }
  } catch (e) {
    showAuthError(errorEl, e.message);
    setButtonLoading(submitBtn, false);
  }
}

async function handleResetPassword() {
  var password = document.getElementById('auth-reset-password').value;
  var confirm = document.getElementById('auth-reset-confirm').value;
  var errorEl = document.getElementById('auth-reset-error');
  var successEl = document.getElementById('auth-reset-success');
  var submitBtn = document.getElementById('auth-reset-submit');

  if (!password || !confirm) {
    showAuthError(errorEl, 'Please fill in all fields.');
    document.getElementById('auth-reset-password').setAttribute('aria-describedby', 'auth-reset-error');
    document.getElementById('auth-reset-confirm').setAttribute('aria-describedby', 'auth-reset-error');
    return;
  }
  if (password !== confirm) {
    showAuthError(errorEl, 'Passwords do not match.');
    document.getElementById('auth-reset-password').setAttribute('aria-describedby', 'auth-reset-error');
    document.getElementById('auth-reset-confirm').setAttribute('aria-describedby', 'auth-reset-error');
    return;
  }
  if (password.length < 6) {
    showAuthError(errorEl, 'Password must be at least 6 characters.');
    document.getElementById('auth-reset-password').setAttribute('aria-describedby', 'auth-reset-error');
    return;
  }

  var actionCode = document.getElementById('auth-reset-code');
  var oobCode = actionCode ? actionCode.value : null;
  if (!oobCode) {
    showAuthError(errorEl, 'Invalid or expired reset link. Please request a new one.');
    return;
  }

  setButtonLoading(submitBtn, true);
  hideAuthError(errorEl);
  if (successEl) successEl.style.display = 'none';

  try {
    var msg = await confirmPasswordReset(oobCode, password);
    setButtonLoading(submitBtn, false);
    if (successEl) {
      successEl.textContent = msg;
      successEl.style.display = 'block';
    }
    // Show login after reset
    setTimeout(function () {
      showAuthView('login');
    }, 2000);
  } catch (e) {
    showAuthError(errorEl, e.message);
    setButtonLoading(submitBtn, false);
  }
}

async function handleResendVerification() {
  var errorEl = document.getElementById('auth-verify-error');
  var successEl = document.getElementById('auth-verify-success');
  var resendBtn = document.getElementById('auth-resend-verify');

  hideAuthError(errorEl);
  if (successEl) successEl.style.display = 'none';

  try {
    var msg = await resendVerificationEmail();
    if (successEl) {
      successEl.textContent = msg;
      successEl.style.display = 'block';
    }
  } catch (e) {
    showAuthError(errorEl, e.message);
  }
}

async function handleLogout() {
  // Check if there's pending sync
  if (hasPendingSync && hasPendingSync()) {
    console.log('[auth] Pending sync data — uploading before logout...');
    var user = getCurrentUser();
    if (user) {
      await uploadToCloud(user.uid);
    }
  }

  await logout();

  // Clear auth view
  showAuthView('login');
  switchView('auth');
}

// ── Import Local Data Prompt ──────────────────────────────────

/**
 * After login, offer to import existing local data into the cloud account.
 */
async function promptImportLocalData() {
  if (_importPrompted) return;

  var user = getCurrentUser();
  if (!user) return;

  // Check if there's local data worth importing
  var localData = exportLocalData ? exportLocalData() : {};
  var hasData = localData.srsData && Object.keys(localData.srsData).length > 0;

  if (!hasData) {
    // Pull any cloud data, merging rather than overwriting: local may still
    // hold non-SRS progress (lessons, goal, analytics) the cloud doesn't have.
    var cloudData = await downloadFromCloud(user.uid);
    if (cloudData) {
      importLocalData(mergeData(localData, cloudData));
    }
    _importPrompted = true;
    return;
  }

  if (AUTO_IMPORT_ON_LOGIN) {
    // Auto-import without asking
    await fullSync(user.uid);
    _importPrompted = true;
    return;
  }

  // Ask the user
  var confirmed = confirm('You have local learning progress. Would you like to sync it with your account to access it from any device?');
  if (confirmed) {
    await fullSync(user.uid);
  }
  _importPrompted = true;
}

// ── Action Code Detection ─────────────────────────────────────

/**
 * Check if the URL contains a password-reset or email-verification code.
 */
function checkActionCodeOnLoad() {
  var action = checkActionCode();

  if (action.mode === 'resetPassword' && action.oobCode) {
    // Navigate to auth view with reset form pre-filled
    var codeInput = document.getElementById('auth-reset-code');
    if (codeInput) codeInput.value = action.oobCode;
    showAuthView('reset');
    switchView('auth');
    return true;
  }

  if (action.mode === 'verifyEmail' && action.oobCode) {
    // Apply the verification code
    applyVerificationCode(action.oobCode)
      .then(function (msg) {
        var user = getCurrentUser();
        if (user) {
          // Data was verified — redirect to app
          switchView('learn');
        } else {
          showAuthView('login');
          switchView('auth');
        }
      })
      .catch(function (e) {
        showAuthView('login');
        switchView('auth');
      });
    return true;
  }

  return false;
}

// ── Guest Notice ─────────────────────────────────────────────

/** localStorage key remembering that the user dismissed the guest notice */
var GUEST_NOTICE_DISMISS_KEY = 'bayan_guest_notice_dismissed';

function isGuestNoticeDismissed() {
  try { return localStorage.getItem(GUEST_NOTICE_DISMISS_KEY) === 'true'; } catch (e) { return false; }
}

/** Wire dismiss + sign-up actions for the guest notice banner. */
function wireGuestNoticeEvents() {
  var closeBtn = document.getElementById('guest-notice-close');
  if (closeBtn) {
    closeBtn.onclick = function () {
      var notice = document.getElementById('guest-notice');
      if (notice) notice.hidden = true;
      try { localStorage.setItem(GUEST_NOTICE_DISMISS_KEY, 'true'); } catch (e) { /* ignore */ }
    };
  }

  var signupBtn = document.getElementById('guest-notice-signup');
  if (signupBtn) {
    signupBtn.onclick = function () {
      if (typeof showAuthView === 'function') showAuthView('signup');
      if (typeof switchView === 'function') switchView('auth');
    };
  }

  // Header sign-in link — opens login for guest users
  var headerSignin = document.getElementById('header-signin-link');
  if (headerSignin) {
    headerSignin.onclick = function (e) {
      e.preventDefault();
      if (typeof showAuthView === 'function') showAuthView('login');
      if (typeof switchView === 'function') switchView('auth');
    };
  }

  // Sync with current auth state (covers startup before the first auth event fires)
  updateGuestNotice(getCurrentUser ? getCurrentUser() : null);
}

/**
 * Show the guest notice only for signed-out users who haven't dismissed it.
 * Informational only — never blocks or interrupts usage.
 */
function updateGuestNotice(user) {
  var notice = document.getElementById('guest-notice');
  if (!notice) return;
  notice.hidden = !!(user || isGuestNoticeDismissed());
}

// ── UI Update ─────────────────────────────────────────────────

/**
 * Update UI elements based on authentication state.
 */
function updateAuthUI(user) {
  var avatarDisplay = document.getElementById('user-avatar-display');
  var guestBadge = document.getElementById('guest-badge');
  var headerSignin = document.getElementById('header-signin-link');
  var authViews = ['view-auth', 'view-profile', 'view-settings'];

  updateGuestNotice(user);

  if (user) {
    // Update avatar display
    if (avatarDisplay) {
      var initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
      avatarDisplay.textContent = initial;
      avatarDisplay.title = user.displayName || user.email || 'Account';
    }
    if (guestBadge) guestBadge.style.display = 'none';
    if (headerSignin) headerSignin.style.display = 'none';

    // Update profile view if it's visible, but ONLY if a full profile
    // render (renderFullProfile) is NOT already in progress. This prevents
    // a race condition where updateAuthUI fires during the async render,
    // causing a double render with stale auth state.
    var _profileBusy = window.__profileUI && typeof window.__profileUI.isRendering === 'function' && window.__profileUI.isRendering();
    if ((currentView === 'profile' || currentView === 'settings') && !_profileBusy) {
      renderProfileView();
    }
  } else {
    if (avatarDisplay) {
      avatarDisplay.textContent = 'U';
      avatarDisplay.title = 'Sign in';
    }
    if (guestBadge) guestBadge.style.display = 'inline';
    if (headerSignin) headerSignin.style.display = 'inline';
  }
}

// ── Helpers ───────────────────────────────────────────────────

function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAuthError(el) {
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._originalText = btn.textContent;
    btn.textContent = '⏳ Processing...';
  } else {
    btn.textContent = btn._originalText || btn.textContent;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (c) {
    var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return m[c] || c;
  });
}

// ── Export ────────────────────────────────────────────────────

window.__authUI = {
  init: initAuthUI,
  showView: showAuthView,
  updateUI: updateAuthUI,
};
