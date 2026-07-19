#!/usr/bin/env node
/**
 * auth-ui.test.js — Unit tests for the Authentication UI Module
 *
 * Tests: login, signup, forgot password, reset password, guest mode,
 * logout, form validation, error states, loading states, auth transitions.
 *
 * Run: node test/auth-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var mock = require('./shared-mock');
mock.setup();

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

// Mock auth functions
global.loginWithEmail = function(email, password, rememberMe) {
  if (global.__authFail) return Promise.reject(new Error(global.__authFail));
  return Promise.resolve({ user: { uid: 'u1', email: email, emailVerified: global.__emailVerified !== false } });
};
global.signUpWithEmail = function(email, password, name) {
  if (global.__authFail) return Promise.reject(new Error(global.__authFail));
  return Promise.resolve({ user: { uid: 'u_new', email: email, displayName: name } });
};
global.sendPasswordResetEmail = function(email) {
  if (global.__authFail) return Promise.reject(new Error(global.__authFail));
  return Promise.resolve('Password reset email sent.');
};
global.confirmPasswordReset = function(code, password) {
  if (global.__authFail) return Promise.reject(new Error(global.__authFail));
  return Promise.resolve('Password has been reset successfully.');
};
global.resendVerificationEmail = function() {
  if (global.__authFail) return Promise.reject(new Error(global.__authFail));
  return Promise.resolve('Verification email sent.');
};
global.logout = function() { return Promise.resolve(); };
global.getCurrentUser = function() { return global.__mockUser || null; };
global.onAuthChange = function(fn) { fn(global.__mockUser); };
global.switchView = function(v) { global.__lastView = v; };
global.saveProfile = function() { return Promise.resolve(true); };
global.getDefaultSettings = function() { return { dailyReviewLimit: 25, sessionSize: 20, autoImportOnLogin: true }; };
global.exportLocalData = function() { return {}; };
global.importLocalData = function() {};
global.downloadFromCloud = function() { return Promise.resolve(null); };
global.fullSync = function() { return Promise.resolve(true); };
global.hasPendingSync = function() { return false; };
global.uploadToCloud = function() { return Promise.resolve(true); };
global.checkActionCode = function() { return { mode: null, oobCode: null, continueUrl: null }; };

// Mock document functions needed by auth-ui
global.document.getElementById = function(id) {
  if (!global.__authElements) return null;
  return global.__authElements[id] || null;
};
global.document.querySelector = function() { return null; };
global.document.querySelectorAll = function() { return []; };
global.document.addEventListener = function() {};
global.document.title = '';
global.window.__authUI = {};
global.window.__profileUI = { isRendering: function() { return false; } };
global.window.__viewHasBeenSet = false;
global.renderProfileView = function() {};

// Load the auth UI module
var authCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth-ui.js'), 'utf8');
eval(authCode);

// We need to re-mock document.getElementById after eval since auth-ui overwrites it
var _origGetElementById = global.document.getElementById;

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function t(name, fn) {
  try {
    mock.resetDOM();
    global.__authFail = null;
    global.__emailVerified = true;
    global.__mockUser = null;
    global.__lastView = null;
    global.AUTO_IMPORT_ON_LOGIN = false;
    _currentAuthView = 'none';
    _importPrompted = false;
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function ts(name, fn) {
  console.log('\n📋 ' + name);
  fn();
}

// Helper: create auth form elements
function createAuthElements() {
  var els = {};
  var ids = [
    'auth-login', 'auth-signup', 'auth-forgot', 'auth-reset', 'auth-verify',
    'auth-login-form', 'auth-login-email', 'auth-login-password', 'auth-login-error',
    'auth-login-submit', 'auth-remember',
    'auth-signup-form', 'auth-signup-name', 'auth-signup-email', 'auth-signup-password',
    'auth-signup-confirm', 'auth-signup-error', 'auth-signup-submit',
    'auth-forgot-form', 'auth-forgot-email', 'auth-forgot-error', 'auth-forgot-success',
    'auth-forgot-submit',
    'auth-reset-form', 'auth-reset-code', 'auth-reset-password', 'auth-reset-confirm',
    'auth-reset-error', 'auth-reset-success', 'auth-reset-submit',
    'auth-verify-email', 'auth-verify-error', 'auth-verify-success', 'auth-resend-verify',
    'auth-title', 'auth-forgot-link', 'auth-signup-link', 'auth-login-link',
    'auth-back-login',
    'user-avatar-display', 'guest-badge', 'btn-logout',
  ];
  ids.forEach(function(id) {
    var el = mock.makeEl('div');
    el.id = id;
    el.style = {};
    el.style.display = '';
    el.textContent = '';
    el.value = '';
    el.checked = false;
    el.disabled = false;
    el._originalText = '';
    el.setAttribute = function(a, v) { this.attributes[a] = v; };
    el.getAttribute = function(a) { return this.attributes[a] || null; };
    els[id] = el;
  });
  global.__authElements = els;
  return els;
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

ts('Auth — View Switching', function() {
  t('showAuthView shows login view', function() {
    createAuthElements();
    showAuthView('login');
    assert.strictEqual(_currentAuthView, 'login');
    assert.strictEqual(global.__authElements['auth-login'].style.display, 'block');
    assert.strictEqual(global.__authElements['auth-signup'].style.display, 'none');
  });

  t('showAuthView shows signup view', function() {
    createAuthElements();
    showAuthView('signup');
    assert.strictEqual(_currentAuthView, 'signup');
    assert.strictEqual(global.__authElements['auth-login'].style.display, 'none');
    assert.strictEqual(global.__authElements['auth-signup'].style.display, 'block');
  });

  t('showAuthView shows forgot password view', function() {
    createAuthElements();
    showAuthView('forgot');
    assert.strictEqual(_currentAuthView, 'forgot');
  });

  t('showAuthView shows reset password view', function() {
    createAuthElements();
    showAuthView('reset');
    assert.strictEqual(_currentAuthView, 'reset');
  });

  t('showAuthView shows email verify view', function() {
    createAuthElements();
    showAuthView('verify');
    assert.strictEqual(_currentAuthView, 'verify');
  });

  t('showAuthView updates title for login', function() {
    createAuthElements();
    showAuthView('login');
    assert.strictEqual(global.__authElements['auth-title'].textContent, 'Welcome Back');
  });

  t('showAuthView updates title for signup', function() {
    createAuthElements();
    showAuthView('signup');
    assert.strictEqual(global.__authElements['auth-title'].textContent, 'Create Account');
  });
});

ts('Auth — Login Validation', function() {
  t('handleLogin rejects empty email', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-login-email'].value = '';
    els['auth-login-password'].value = '';
    await handleLogin();
    assert.ok(els['auth-login-error'].style.display === 'block');
    assert.ok(els['auth-login-error'].textContent.length > 0);
  });

  t('handleLogin rejects empty password', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-login-email'].value = 'test@example.com';
    els['auth-login-password'].value = '';
    await handleLogin();
    assert.ok(els['auth-login-error'].style.display === 'block');
  });

  t('handleLogin succeeds with valid credentials', async function() {
    createAuthElements();
    global.__emailVerified = true;
    var els = global.__authElements;
    els['auth-login-email'].value = 'test@example.com';
    els['auth-login-password'].value = 'password123';
    els['auth-remember'].checked = true;
    await handleLogin();
    // Should navigate to learn view
    assert.strictEqual(global.__lastView, 'learn');
  });

  t('handleLogin shows verify view for unverified email', async function() {
    createAuthElements();
    global.__emailVerified = false;
    var els = global.__authElements;
    els['auth-login-email'].value = 'test@example.com';
    els['auth-login-password'].value = 'password123';
    await handleLogin();
    assert.strictEqual(_currentAuthView, 'verify');
  });

  t('handleLogin shows error on auth failure', async function() {
    createAuthElements();
    global.__authFail = 'Invalid email or password.';
    var els = global.__authElements;
    els['auth-login-email'].value = 'test@example.com';
    els['auth-login-password'].value = 'wrong';
    await handleLogin();
    assert.ok(els['auth-login-error'].style.display === 'block');
  });
});

ts('Auth — Signup Validation', function() {
  t('handleSignUp rejects empty fields', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-signup-name'].value = '';
    els['auth-signup-email'].value = '';
    els['auth-signup-password'].value = '';
    els['auth-signup-confirm'].value = '';
    await handleSignUp();
    assert.ok(els['auth-signup-error'].style.display === 'block');
  });

  t('handleSignUp rejects mismatched passwords', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-signup-name'].value = 'Test User';
    els['auth-signup-email'].value = 'test@example.com';
    els['auth-signup-password'].value = 'password123';
    els['auth-signup-confirm'].value = 'different';
    await handleSignUp();
    assert.ok(els['auth-signup-error'].textContent.indexOf('match') >= 0);
  });

  t('handleSignUp rejects short password', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-signup-name'].value = 'Test User';
    els['auth-signup-email'].value = 'test@example.com';
    els['auth-signup-password'].value = 'ab';
    els['auth-signup-confirm'].value = 'ab';
    await handleSignUp();
    assert.ok(els['auth-signup-error'].textContent.indexOf('6 characters') >= 0);
  });

  t('handleSignUp succeeds with valid input', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-signup-name'].value = 'Test User';
    els['auth-signup-email'].value = 'test@example.com';
    els['auth-signup-password'].value = 'password123';
    els['auth-signup-confirm'].value = 'password123';
    await handleSignUp();
    assert.strictEqual(_currentAuthView, 'verify');
  });

  t('handleSignUp shows error on auth failure', async function() {
    createAuthElements();
    global.__authFail = 'Email already in use.';
    var els = global.__authElements;
    els['auth-signup-name'].value = 'Test User';
    els['auth-signup-email'].value = 'existing@example.com';
    els['auth-signup-password'].value = 'password123';
    els['auth-signup-confirm'].value = 'password123';
    await handleSignUp();
    assert.ok(els['auth-signup-error'].style.display === 'block');
  });
});

ts('Auth — Forgot Password', function() {
  t('handleForgotPassword rejects empty email', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-forgot-email'].value = '';
    await handleForgotPassword();
    assert.ok(els['auth-forgot-error'].style.display === 'block');
  });

  t('handleForgotPassword succeeds with valid email', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-forgot-email'].value = 'test@example.com';
    await handleForgotPassword();
    assert.ok(els['auth-forgot-success'].style.display === 'block');
  });

  t('handleForgotPassword shows error on failure', async function() {
    createAuthElements();
    global.__authFail = 'User not found.';
    var els = global.__authElements;
    els['auth-forgot-email'].value = 'unknown@example.com';
    await handleForgotPassword();
    assert.ok(els['auth-forgot-error'].style.display === 'block');
  });
});

ts('Auth — Reset Password', function() {
  t('handleResetPassword rejects empty fields', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-reset-password'].value = '';
    els['auth-reset-confirm'].value = '';
    await handleResetPassword();
    assert.ok(els['auth-reset-error'].style.display === 'block');
  });

  t('handleResetPassword rejects mismatched passwords', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-reset-password'].value = 'new123';
    els['auth-reset-confirm'].value = 'new456';
    els['auth-reset-code'].value = 'valid-code';
    await handleResetPassword();
    assert.ok(els['auth-reset-error'].textContent.indexOf('match') >= 0);
  });

  t('handleResetPassword rejects short password', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-reset-password'].value = 'ab';
    els['auth-reset-confirm'].value = 'ab';
    els['auth-reset-code'].value = 'valid-code';
    await handleResetPassword();
    assert.ok(els['auth-reset-error'].textContent.indexOf('6 characters') >= 0);
  });

  t('handleResetPassword succeeds with valid input and code', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-reset-password'].value = 'newpass123';
    els['auth-reset-confirm'].value = 'newpass123';
    els['auth-reset-code'].value = 'valid-code';
    await handleResetPassword();
    assert.ok(els['auth-reset-success'].style.display === 'block');
  });

  t('handleResetPassword requires reset code', async function() {
    createAuthElements();
    var els = global.__authElements;
    els['auth-reset-password'].value = 'newpass123';
    els['auth-reset-confirm'].value = 'newpass123';
    els['auth-reset-code'].value = '';
    await handleResetPassword();
    assert.ok(els['auth-reset-error'].textContent.indexOf('code') >= 0 || els['auth-reset-error'].textContent.indexOf('link') >= 0);
  });
});

ts('Auth — Email Verification', function() {
  t('handleResendVerification succeeds', async function() {
    createAuthElements();
    var els = global.__authElements;
    await handleResendVerification();
    assert.ok(els['auth-verify-success'].style.display === 'block');
  });

  t('handleResendVerification shows error on failure', async function() {
    createAuthElements();
    global.__authFail = 'Network error.';
    var els = global.__authElements;
    await handleResendVerification();
    assert.ok(els['auth-verify-error'].style.display === 'block');
  });
});

ts('Auth — Logout', function() {
  t('handleLogout navigates to auth view', async function() {
    createAuthElements();
    global.__mockUser = { uid: 'u1', email: 'test@example.com' };
    await handleLogout();
    assert.strictEqual(_currentAuthView, 'login');
    assert.strictEqual(global.__lastView, 'auth');
  });
});

ts('Auth — Button Loading State', function() {
  t('setButtonLoading sets disabled and changes text', function() {
    var btn = mock.makeEl('button');
    btn.textContent = 'Sign In';
    setButtonLoading(btn, true);
    assert.ok(btn.disabled);
    assert.ok(btn.textContent.indexOf('Processing') >= 0);
    setButtonLoading(btn, false);
    assert.ok(!btn.disabled);
    assert.strictEqual(btn.textContent, 'Sign In');
  });

  t('setButtonLoading handles null button', function() {
    setButtonLoading(null, true);
    assert.ok(true);
  });
});

ts('Auth — Error Display', function() {
  t('showAuthError sets text and shows element', function() {
    var el = mock.makeEl('div');
    el.style = {};
    showAuthError(el, 'Test error');
    assert.strictEqual(el.textContent, 'Test error');
    assert.strictEqual(el.style.display, 'block');
  });

  t('hideAuthError clears text and hides element', function() {
    var el = mock.makeEl('div');
    el.style = {};
    el.textContent = 'Old error';
    el.style.display = 'block';
    hideAuthError(el);
    assert.strictEqual(el.textContent, '');
    assert.strictEqual(el.style.display, 'none');
  });

  t('showAuthError handles null element', function() {
    showAuthError(null, 'error');
    assert.ok(true);
  });
});

ts('Auth — Escape HTML', function() {
  t('escapeHtml escapes special characters', function() {
    assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
    assert.strictEqual(escapeHtml('"test"'), '&quot;test&quot;');
    assert.strictEqual(escapeHtml("'test'"), '&#39;test&#39;');
    assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
  });

  t('escapeHtml handles null input', function() {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
  });
});

ts('Auth — Action Code Detection', function() {
  t('checkActionCodeOnLoad returns false when no action code', function() {
    global.checkActionCode = function() { return { mode: null, oobCode: null }; };
    var result = checkActionCodeOnLoad();
    assert.strictEqual(result, false);
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
