#!/usr/bin/env node
/**
 * auth-service.test.js — Sign In with Google (auth-service.js source tests)
 *
 * Eval's the REAL js/services/auth-service.js source with a mocked
 * window.__firebaseCore (auth-service has no ES module imports of its own —
 * it reads Firebase functions off the core bridge), then exercises
 * signInWithGoogle() end-to-end:
 *
 *   - popup success returns the Firebase user
 *   - cancelled popups throw errors marked `silent` (UI must ignore them)
 *   - account-exists-with-different-credential → clear, non-technical message
 *   - popup-blocked / unauthorized-domain / operation-not-allowed / network
 *   - unknown codes fall back to the shared _translateFirebaseError
 *
 * Run: node test/auth-service.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var passed = 0;
var failed = 0;
var failedNames = [];

function loadAuthService(mockCore, extraGlobals) {
  var windowObj = { __firebaseCore: mockCore };
  var sandbox = Object.assign({
    window: windowObj,
    console: { log: function () {}, warn: function () {}, error: function () {} },
    URLSearchParams: require('url').URLSearchParams,
  }, extraGlobals || {});
  var src = fs.readFileSync(path.join(__dirname, '..', 'js/services/auth-service.js'), 'utf8');
  vm.runInNewContext(src, sandbox);
  return {
    signInWithGoogle: windowObj.signInWithGoogle,
    auth: windowObj.__auth,
  };
}

function makeCore(popupError) {
  var calls = { popup: 0, provider: null };
  var core = {
    getAuth: function () { return { _mockAuth: true }; },
    signInWithPopup: function (auth, provider) {
      calls.popup++;
      calls.provider = provider;
      if (popupError) return Promise.reject(popupError);
      return Promise.resolve({ user: { uid: 'uid-1', email: 'google@example.com', displayName: 'G User' } });
    },
    GoogleAuthProvider: function GoogleAuthProvider() {
      this.providerId = 'google.com';
    },
  };
  return { core: core, calls: calls };
}

function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      passed++;
      console.log('  \u2705 ' + name);
    })
    .catch(function (e) {
      failed++;
      failedNames.push(name);
      console.log('  \u2717 ' + name + ': ' + (e.message || e).split('\n')[0]);
    });
}

async function run() {
  console.log('\n\ud83d\udccb Auth Service — Sign In with Google\n');

  await t('signInWithGoogle resolves with the Firebase user via popup', async function () {
    var m = makeCore(null);
    var svc = loadAuthService(m.core);
    var result = await svc.signInWithGoogle();
    assert.strictEqual(result.user.uid, 'uid-1');
    assert.strictEqual(m.calls.popup, 1, 'signInWithPopup called exactly once');
    assert.ok(m.calls.provider instanceof m.core.GoogleAuthProvider, 'uses GoogleAuthProvider');
  });

  await t('exposes signInWithGoogle on window.__auth', function () {
    var m = makeCore(null);
    var svc = loadAuthService(m.core);
    assert.strictEqual(typeof svc.auth.signInWithGoogle, 'function');
    assert.strictEqual(typeof svc.signInWithGoogle, 'function');
  });

  await t('auth/popup-closed-by-user throws a SILENT error (UI must not show it)', async function () {
    var m = makeCore({ code: 'auth/popup-closed-by-user', message: 'The popup has been closed by the user before the final operation completed.' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw, 'should throw');
    assert.strictEqual(threw.silent, true, 'error flagged silent');
  });

  await t('auth/cancelled-popup-request throws a SILENT error', async function () {
    var m = makeCore({ code: 'auth/cancelled-popup-request', message: 'Cancelled.' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.strictEqual(threw.silent, true);
  });

  await t('auth/account-exists-with-different-credential → use original sign-in method message', async function () {
    var m = makeCore({ code: 'auth/account-exists-with-different-credential', message: 'raw' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.ok(threw.message.indexOf('email and password') >= 0, 'non-technical message: ' + threw.message);
    assert.strictEqual(threw.silent, undefined, 'not flagged silent — must be shown');
  });

  await t('auth/popup-blocked → helpful allow-popups message', async function () {
    var m = makeCore({ code: 'auth/popup-blocked', message: 'raw' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.ok(threw.message.indexOf('allow popups') >= 0, threw.message);
  });

  await t('auth/unauthorized-domain → clear message', async function () {
    var m = makeCore({ code: 'auth/unauthorized-domain', message: 'raw' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.ok(threw.message.indexOf('domain') >= 0, threw.message);
  });

  await t('auth/operation-not-allowed → clear message', async function () {
    var m = makeCore({ code: 'auth/operation-not-allowed', message: 'raw' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.ok(threw.message.indexOf('not enabled') >= 0, threw.message);
  });

  await t('auth/network-request-failed → network message', async function () {
    var m = makeCore({ code: 'auth/network-request-failed', message: 'raw' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.ok(threw.message.indexOf('Network error') >= 0, threw.message);
  });

  await t('unknown Google error code falls back to shared translation', async function () {
    var m = makeCore({ code: 'auth/whatever-unknown', message: 'raw' });
    var svc = loadAuthService(m.core);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.strictEqual(threw.message, 'Something went wrong. Please try again.');
  });

  await t('throws "Authentication service is not available." when core is missing', async function () {
    var svc = loadAuthService(null);
    var threw = null;
    try { await svc.signInWithGoogle(); } catch (e) { threw = e; }
    assert.ok(threw);
    assert.ok(threw.message.indexOf('not available') >= 0);
  });

  // ── Account deletion ─────────────────────────────────
  console.log('\n📋 Auth Service — Delete Account\n');

  function makeDeleteCore(providerIds, log) {
    var currentUser = {
      providerData: providerIds.map(function (id) { return { providerId: id }; }),
      getIdToken: function (force) { log.push('token:' + force); return Promise.resolve('id-token'); },
    };
    return {
      getAuth: function () { return { currentUser: currentUser }; },
      signOut: function () { log.push('signOut'); return Promise.resolve(); },
      reauthenticateWithPopup: function (user, provider) {
        log.push('popup:' + provider.providerId);
        return Promise.resolve();
      },
      GoogleAuthProvider: function GoogleAuthProvider() { this.providerId = 'google.com'; },
    };
  }

  function loadWithFetch(core, response, log) {
    return loadAuthService(core, {
      API_BASE_URL: 'https://api.example',
      fetch: function (url, opts) {
        log.push('fetch:' + opts.method + ' ' + url + ' ' + opts.headers.Authorization);
        return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
      },
    }).auth;
  }

  function jsonRes(status, body) {
    return { ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(body); } };
  }

  await t('deleteAccount posts a fresh ID token to the server, then signs out', async function () {
    var log = [];
    var auth = loadWithFetch(makeDeleteCore(['password'], log), jsonRes(200, { deleted: true }), log);
    assert.strictEqual(await auth.deleteAccount(), true);
    assert.deepStrictEqual(log, [
      'token:true',
      'fetch:POST https://api.example/api/delete-account Bearer id-token',
      'signOut',
    ]);
  });

  await t('deleteAccount maps requires-recent-login to a friendly message', async function () {
    var log = [];
    var auth = loadWithFetch(makeDeleteCore(['password'], log),
      jsonRes(401, { error: 'x', code: 'requires-recent-login' }), log);
    var threw = null;
    try { await auth.deleteAccount(); } catch (e) { threw = e; }
    assert.ok(threw && /confirm your identity/.test(threw.message));
    assert.ok(log.indexOf('signOut') < 0, 'must stay signed in on failure');
  });

  await t('deleteAccount surfaces the server error and stays signed in', async function () {
    var log = [];
    var auth = loadWithFetch(makeDeleteCore(['password'], log),
      jsonRes(500, { error: 'Could not delete the account. Please try again.' }), log);
    var threw = null;
    try { await auth.deleteAccount(); } catch (e) { threw = e; }
    assert.strictEqual(threw.message, 'Could not delete the account. Please try again.');
    assert.ok(log.indexOf('signOut') < 0);
  });

  await t('deleteAccount reports a network failure clearly', async function () {
    var log = [];
    var auth = loadWithFetch(makeDeleteCore(['password'], log), new TypeError('Failed to fetch'), log);
    var threw = null;
    try { await auth.deleteAccount(); } catch (e) { threw = e; }
    assert.ok(threw && /reach the server/.test(threw.message));
  });

  await t('getReauthMethod: password when a password credential exists', async function () {
    var log = [];
    assert.strictEqual(loadWithFetch(makeDeleteCore(['google.com', 'password'], log), null, log).getReauthMethod(), 'password');
    assert.strictEqual(loadWithFetch(makeDeleteCore(['google.com'], log), null, log).getReauthMethod(), 'google.com');
  });

  await t('reauthenticateWithGoogle uses the popup with a Google provider', async function () {
    var log = [];
    var auth = loadWithFetch(makeDeleteCore(['google.com'], log), null, log);
    await auth.reauthenticateWithGoogle();
    assert.deepStrictEqual(log, ['popup:google.com']);
  });

  await t('reauthenticateWithGoogle explains a different-account pick', async function () {
    var log = [];
    var core = makeDeleteCore(['google.com'], log);
    core.reauthenticateWithPopup = function () { return Promise.reject({ code: 'auth/user-mismatch' }); };
    var auth = loadWithFetch(core, null, log);
    var threw = null;
    try { await auth.reauthenticateWithGoogle(); } catch (e) { threw = e; }
    assert.strictEqual(threw.message, 'Please choose the Google account you signed in with.');
  });

  var total = passed + failed;
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

run();