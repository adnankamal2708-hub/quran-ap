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
  checkActionCodeOnLoad();

  // Watch auth state to update UI
  onAuthChange(function (user) {
    updateAuthUI(user);
  });
}

// ── Auth View Switching ───────────────────────────────────────

/**
 * Show a specific auth sub-view (login, signup, forgot, reset).
 */
function showAuthView(viewName) {
  _currentAuthView = viewName;
  var views = ['auth-login', 'auth-signup', 'auth-forgot', 'auth-reset', 'auth-verify'];
  views.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = (id === 'auth-' + viewName) ? 'block' : 'none';
  });

  // Update title
  var titleEl = document.getElementById('auth-title');
  var titles = {
    'login': 'Welcome Back',
    'signup': 'Create Account',
    'forgot': 'Reset Password',
    'reset': 'Set New Password',
    'verify': 'Verify Email',
  };
  if (titleEl) titleEl.textContent = titles[viewName] || 'Account';
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
  // User button in top bar
  var userBtn = document.getElementById('user-btn');
  if (userBtn) {
    userBtn.onclick = function () {
      try {
        var user = getCurrentUser();
        if (user) {
          switchView('profile');
        } else {
          showAuthView('login');
          switchView('auth');
        }
      } catch (e) {
        console.error('[auth] Profile button handler error:', e.message, e.stack);
      }
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
    // Just do a cloud download in case there's data on the server
    var cloudData = await downloadFromCloud(user.uid);
    if (cloudData) {
      importLocalData(cloudData);
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

// ── UI Update ─────────────────────────────────────────────────

/**
 * Update UI elements based on authentication state.
 */
function updateAuthUI(user) {
  var userBtn = document.getElementById('user-btn');
  var guestBadge = document.getElementById('guest-badge');
  var authViews = ['view-auth', 'view-profile', 'view-settings'];

  if (user) {
    // Update user button text
    if (userBtn) {
      var initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
      userBtn.innerHTML = '<span class="user-avatar-small">' + escapeHtml(initial) + '</span>';
      userBtn.title = user.displayName || user.email || 'Account';
    }
    if (guestBadge) guestBadge.style.display = 'none';

    // Update profile view if it's visible
    if (currentView === 'profile' || currentView === 'settings') {
      renderProfileView();
    }
  } else {
    if (userBtn) {
      userBtn.innerHTML = '<span class="user-avatar-small" style="font-size:12px">👤</span>';
      userBtn.title = 'Sign in';
    }
    if (guestBadge) guestBadge.style.display = 'inline';
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
