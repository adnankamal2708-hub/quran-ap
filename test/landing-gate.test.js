#!/usr/bin/env node
/**
 * landing-gate.test.js — Unit tests for the landing page auth gate
 * (js/landing/landing-auth-gate.js)
 *
 * The landing page must NEVER be shown to an already signed-in returning
 * user (free or premium). The gate script:
 *   • redirects immediately if a session is already known
 *   • subscribes to auth changes: restored session → redirect, signed out → reveal
 *   • falls back to revealing after a short timeout if auth never resolves
 *   • reveals if the auth service itself is unavailable
 *
 * Run: node test/landing-gate.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var mock = require('./shared-mock');
mock.setup();

var GATE_PATH = path.join(__dirname, '..', 'js', 'landing', 'landing-auth-gate.js');

// ── Test state ─────────────────────────────────────────────────
var redirects = [];
var reveals = 0;
var authMock = null;
var scheduledTimers = [];

// ── Globals the gate script reads ─────────────────────────────
global.window.__auth = null;

// Mock location.replace so we can observe redirects without navigating
global.window.location = {
  replace: function (url) { redirects.push(url); },
};

// documentElement with a working classList (shared-mock's makeEl has one)
global.document.documentElement = mock.makeEl('html');

// Timer capture so the 3s fallback can be tested synchronously
var _origSetTimeout = global.setTimeout;
var _origClearTimeout = global.clearTimeout;
global.setTimeout = function (fn, ms) {
  scheduledTimers.push({ fn: fn, ms: ms });
  return scheduledTimers.length;
};
global.clearTimeout = function (id) { /* captured; no-op */ };

// ── Test helpers ──────────────────────────────────────────────

function reset() {
  mock.resetDOM();
  redirects = [];
  reveals = 0;
  scheduledTimers = [];
  authMock = null;
  global.window.__auth = null;
  global.document.documentElement = mock.makeEl('html');
  global.document.documentElement.classList.remove('landing-ready');
}

function makeAuth(overrides) {
  var api = {
    init: function () { api._initCalls = (api._initCalls || 0) + 1; },
    getCurrentUser: function () { return api._currentUser || null; },
    onAuthChange: function (fn) {
      api._listener = fn;
      return function () { api._listener = null; };
    },
    _currentUser: null,
    _listener: null,
    _initCalls: 0,
  };
  for (var k in overrides) api[k] = overrides[k];
  return api;
}

function loadGate() {
  var code = fs.readFileSync(GATE_PATH, 'utf8');
  eval(code);
}

function fireAuth(user) {
  if (authMock && authMock._listener) authMock._listener(user);
}

function runTimers() {
  var timers = scheduledTimers.slice();
  scheduledTimers = [];
  timers.forEach(function (t) { t.fn(); });
}

// ── Tests ─────────────────────────────────────────────────────

var passed = 0, failed = 0;

function t(name, fn) {
  try {
    reset();
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e).split('\n')[0]);
  }
}

function ts(name, fn) {
  console.log('\n📋 ' + name);
  fn();
}

ts('Landing Gate — Signed-in redirect (critical)', function () {
  t('redirects a signed-in FREE user immediately, never reveals', function () {
    authMock = makeAuth();
    authMock._currentUser = { uid: 'u-free', isAnonymous: false, emailVerified: true };
    global.window.__auth = authMock;
    loadGate();
    assert.strictEqual(redirects.length, 1);
    assert.strictEqual(redirects[0], './');
    assert.strictEqual(reveals, 0);
    assert.ok(!global.document.documentElement.classList.contains('landing-ready'));
  });

  t('redirects a signed-in PREMIUM user immediately, never reveals', function () {
    authMock = makeAuth();
    authMock._currentUser = { uid: 'u-prem', isAnonymous: false, emailVerified: true };
    global.window.__auth = authMock;
    loadGate();
    assert.strictEqual(redirects.length, 1);
    assert.strictEqual(redirects[0], './');
    assert.ok(!global.document.documentElement.classList.contains('landing-ready'));
  });

  t('redirects an anonymous (guest-to-account) user too', function () {
    authMock = makeAuth();
    authMock._currentUser = { uid: 'u-anon', isAnonymous: true };
    global.window.__auth = authMock;
    loadGate();
    assert.strictEqual(redirects.length, 1);
  });

  t('redirects when a session is restored asynchronously via onAuthChange', function () {
    authMock = makeAuth();
    global.window.__auth = authMock;
    loadGate();
    assert.strictEqual(redirects.length, 0, 'no redirect before restore');
    assert.strictEqual(reveals, 0, 'page not revealed while auth unresolved');
    fireAuth({ uid: 'u-restored', isAnonymous: false });
    assert.strictEqual(redirects.length, 1);
    assert.strictEqual(redirects[0], './');
    assert.ok(!global.document.documentElement.classList.contains('landing-ready'));
  });

  t('redirects a late sign-in that happens while the page is open', function () {
    authMock = makeAuth();
    global.window.__auth = authMock;
    loadGate();
    // Auth resolves signed-out first → reveal
    fireAuth(null);
    assert.ok(global.document.documentElement.classList.contains('landing-ready'));
    // User signs in while the page is still open → redirect
    fireAuth({ uid: 'u-late', isAnonymous: false });
    assert.strictEqual(redirects.length, 1);
    assert.strictEqual(redirects[0], './');
  });
});

ts('Landing Gate — Signed-out reveal', function () {
  t('reveals for a confirmed signed-out visitor', function () {
    authMock = makeAuth();
    global.window.__auth = authMock;
    loadGate();
    assert.ok(!global.document.documentElement.classList.contains('landing-ready'), 'gate holds while auth unresolved');
    fireAuth(null);
    assert.ok(global.document.documentElement.classList.contains('landing-ready'));
    assert.strictEqual(redirects.length, 0);
  });

  t('initializes the auth service', function () {
    authMock = makeAuth();
    global.window.__auth = authMock;
    loadGate();
    assert.ok(authMock._initCalls >= 1, 'auth.init() should be called');
  });
});

ts('Landing Gate — Timeout fallback', function () {
  t('reveals after the wait window if auth never resolves and no user is known', function () {
    authMock = makeAuth();
    // getCurrentUser always null, onAuthChange listener never fires
    global.window.__auth = authMock;
    loadGate();
    assert.strictEqual(redirects.length, 0);
    assert.ok(!global.document.documentElement.classList.contains('landing-ready'));
    assert.ok(scheduledTimers.length >= 1, 'a fallback timer should be scheduled');
    runTimers();
    assert.ok(global.document.documentElement.classList.contains('landing-ready'), 'page revealed after timeout');
  });

  t('does NOT reveal after timeout if a user is actually signed in', function () {
    authMock = makeAuth();
    authMock._currentUser = { uid: 'u-1', isAnonymous: false };
    global.window.__auth = authMock;
    loadGate();
    // Immediate redirect path already resolved; no reveal should ever occur
    assert.strictEqual(redirects.length, 1);
    runTimers();
    assert.ok(!global.document.documentElement.classList.contains('landing-ready'));
  });
});

ts('Landing Gate — No auth service', function () {
  t('reveals the page when the auth service is unavailable', function () {
    global.window.__auth = null;
    loadGate();
    assert.ok(global.document.documentElement.classList.contains('landing-ready'));
    assert.strictEqual(redirects.length, 0);
  });

  t('reveals the page when the auth service is missing expected methods', function () {
    global.window.__auth = { init: undefined, onAuthChange: undefined, getCurrentUser: undefined };
    loadGate();
    assert.ok(global.document.documentElement.classList.contains('landing-ready'));
  });
});

// ── Summary ───────────────────────────────────────────────────

global.setTimeout = _origSetTimeout;
global.clearTimeout = _origClearTimeout;

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
