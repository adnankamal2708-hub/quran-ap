// ═══════════════════════════════════════════════════════════════
// api-delete-account.test.js — delete-account handler tests
//
// Covers the guarantees account deletion must keep: a deleted user is
// never billed again (live Polar subscriptions are revoked first, and a
// Polar failure aborts before anything is deleted), all per-user
// Firestore docs and the auth user are removed, and only a recent
// sign-in may delete an account.
// ═══════════════════════════════════════════════════════════════

var assert = require('assert');
var helpers = require('./api-handler-helpers');

var installModuleStubs = helpers.installModuleStubs;
var loadHandler = helpers.loadHandler;
var makeReq = helpers.makeReq;
var makeRes = helpers.makeRes;
var runTest = helpers.runTest;
var printSummary = helpers.printSummary;

var stubs = installModuleStubs();

var BASE_ENV = {
  FIREBASE_SERVICE_ACCOUNT: '{}',
  POLAR_ACCESS_TOKEN: 'polar_oat_test',
  POLAR_API_URL: 'https://api.polar.sh',
};

// ── fetch mock: routes list (GET) and revoke (DELETE) calls ─────────
var polarCalls = [];

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status: status, json: async function () { return body; } };
}

/**
 * opts.listItems  — subscriptions returned by the list endpoint
 * opts.listStatus — HTTP status of the list call (default 200)
 * opts.revoke     — function(id) → response for a DELETE (default 200)
 */
function mockPolar(opts) {
  opts = opts || {};
  polarCalls = [];
  global.fetch = async function (url, init) {
    var method = (init && init.method) || 'GET';
    polarCalls.push({ url: url, method: method, init: init });
    if (method === 'GET') {
      var status = opts.listStatus || 200;
      return jsonResponse(status, status === 200 ? { items: opts.listItems || [], pagination: {} } : { detail: 'err' });
    }
    var id = decodeURIComponent(url.split('/v1/subscriptions/')[1]);
    return opts.revoke ? opts.revoke(id) : jsonResponse(200, { id: id, status: 'canceled' });
  };
}

var handler = null;

function setup(envOverrides) {
  handler = loadHandler('delete-account.js', Object.assign({}, BASE_ENV, envOverrides || {}));
  stubs.firestoreDeletes.length = 0;
  stubs.deletedAuthUsers.length = 0;
  stubs.authCalls.verifyIdTokenCheckRevoked.length = 0;
  Object.keys(stubs.firestoreDocs).forEach(function (k) { delete stubs.firestoreDocs[k]; });
}

function authReq(token) {
  return makeReq({ headers: { authorization: 'Bearer ' + token } });
}

async function call(token) {
  var res = makeRes();
  await handler(authReq(token), res);
  return res;
}

function deletedDocs() {
  return stubs.firestoreDeletes.map(function (d) { return d.name + '/' + d.id; });
}

function run() {
  return (async function () {
    // ── HTTP method + auth ───────────────────────────────
    await runTest('OPTIONS preflight returns 200', async function () {
      setup();
      var res = makeRes();
      await handler(makeReq({ method: 'OPTIONS' }), res);
      assert.strictEqual(res.statusCode, 200);
    });

    await runTest('GET returns 405', async function () {
      setup();
      var res = makeRes();
      await handler(makeReq({ method: 'GET' }), res);
      assert.strictEqual(res.statusCode, 405);
    });

    await runTest('missing Authorization header returns 401 and deletes nothing', async function () {
      setup();
      mockPolar();
      var res = makeRes();
      await handler(makeReq(), res);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
      assert.strictEqual(polarCalls.length, 0);
    });

    await runTest('invalid token returns 401 without leaking details', async function () {
      setup();
      mockPolar();
      var res = await call('forged-token');
      assert.strictEqual(res.statusCode, 401);
      assert.ok(!/signature/i.test(JSON.stringify(res.body)), 'internal error text must not leak');
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
    });

    await runTest('token is verified with revocation check', async function () {
      setup();
      mockPolar();
      await call('valid-token');
      assert.deepStrictEqual(stubs.authCalls.verifyIdTokenCheckRevoked, [true]);
    });

    await runTest('stale sign-in returns requires-recent-login and deletes nothing', async function () {
      setup();
      mockPolar();
      var res = await call('stale-login-token');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, 'requires-recent-login');
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
      assert.strictEqual(stubs.firestoreDeletes.length, 0);
      assert.strictEqual(polarCalls.length, 0);
    });

    await runTest('missing POLAR_ACCESS_TOKEN returns 500 and deletes nothing', async function () {
      setup({ POLAR_ACCESS_TOKEN: undefined });
      mockPolar();
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Server configuration error');
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
    });

    // ── Happy paths ──────────────────────────────────────
    await runTest('free user: deletes all user docs and the auth user', async function () {
      setup();
      mockPolar({ listItems: [] });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.body, { deleted: true });
      ['profiles/user-123', 'learning/user-123', 'subscriptions/user-123'].forEach(function (d) {
        assert.ok(deletedDocs().indexOf(d) >= 0, d + ' should be deleted');
      });
      assert.deepStrictEqual(stubs.deletedAuthUsers, ['user-123']);
      assert.ok(polarCalls.every(function (c) { return c.method === 'GET'; }), 'no revoke calls');
    });

    await runTest('looks up subscriptions by external customer id and live statuses', async function () {
      setup();
      mockPolar();
      await call('valid-token');
      var url = new URL(polarCalls[0].url);
      assert.strictEqual(url.origin + url.pathname, 'https://api.polar.sh/v1/subscriptions/');
      assert.strictEqual(url.searchParams.get('external_customer_id'), 'user-123');
      var statuses = url.searchParams.getAll('status');
      ['active', 'trialing', 'past_due'].forEach(function (s) { assert.ok(statuses.indexOf(s) >= 0, s); });
      assert.strictEqual(polarCalls[0].init.headers.Authorization, 'Bearer polar_oat_test');
    });

    await runTest('premium user: revokes live subscriptions before deleting', async function () {
      setup();
      mockPolar({ listItems: [{ id: 'sub-a', status: 'active' }, { id: 'sub-b', status: 'past_due' }] });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 200);
      var revoked = polarCalls.filter(function (c) { return c.method === 'DELETE'; }).map(function (c) { return c.url; });
      assert.deepStrictEqual(revoked, [
        'https://api.polar.sh/v1/subscriptions/sub-a',
        'https://api.polar.sh/v1/subscriptions/sub-b',
      ]);
      assert.deepStrictEqual(stubs.deletedAuthUsers, ['user-123']);
    });

    await runTest('also revokes the subscription recorded in Firestore', async function () {
      setup();
      stubs.firestoreDocs['subscriptions/user-123'] = { status: 'active', polarSubscriptionId: 'sub-doc' };
      mockPolar({ listItems: [] });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(polarCalls.some(function (c) {
        return c.method === 'DELETE' && /\/sub-doc$/.test(c.url);
      }), 'doc subscription id should be revoked');
    });

    await runTest('already-canceled (403) and missing (404) subscriptions count as done', async function () {
      setup();
      mockPolar({
        listItems: [{ id: 'sub-gone' }, { id: 'sub-cancelled' }],
        revoke: function (id) {
          return id === 'sub-gone'
            ? jsonResponse(404, { error: 'ResourceNotFound' })
            : jsonResponse(403, { error: 'AlreadyCanceledSubscription' });
        },
      });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(stubs.deletedAuthUsers, ['user-123']);
    });

    // ── Failure safety: never delete while billing may continue ──
    await runTest('Polar lookup failure aborts before deleting anything', async function () {
      setup();
      mockPolar({ listStatus: 500 });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
      assert.strictEqual(stubs.firestoreDeletes.length, 0);
    });

    await runTest('revoke failure aborts before deleting anything', async function () {
      setup();
      mockPolar({
        listItems: [{ id: 'sub-a' }],
        revoke: function () { return jsonResponse(409, { error: 'SubscriptionLocked' }); },
      });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 500);
      assert.ok(!/SubscriptionLocked|polar/i.test(JSON.stringify(res.body)), 'provider details must not leak');
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
      assert.strictEqual(stubs.firestoreDeletes.length, 0);
    });

    await runTest('a 403 that is not AlreadyCanceledSubscription aborts', async function () {
      setup();
      mockPolar({
        listItems: [{ id: 'sub-a' }],
        revoke: function () { return jsonResponse(403, { error: 'InsufficientScope' }); },
      });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(stubs.deletedAuthUsers.length, 0);
    });

    await runTest('subscription doc is cleared again after the auth user is deleted', async function () {
      // A revoke webhook may re-create subscriptions/{uid} mid-request.
      setup();
      mockPolar({ listItems: [{ id: 'sub-a' }] });
      await call('valid-token');
      var subDeletes = stubs.firestoreDeletes.filter(function (d) { return d.name === 'subscriptions'; });
      assert.strictEqual(subDeletes.length, 2);
    });

    stubs.restore();
    printSummary();
  })();
}

run();
