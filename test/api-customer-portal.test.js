// ═══════════════════════════════════════════════════════════════
// api-customer-portal.test.js — customer-portal handler tests
//
// The portal lets a subscriber cancel or update billing. The uid sent
// to Polar must come from the verified token (never the request body),
// and every failure must map to a clear status without leaking details.
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
  APP_URL: undefined,
};

var captured = null;

function mockPolar(status, body) {
  captured = null;
  global.fetch = async function (url, opts) {
    captured = { url: url, opts: opts };
    return { ok: status >= 200 && status < 300, status: status, json: async function () { return body; } };
  };
}

var handler = null;
function setup(env) {
  handler = loadHandler('customer-portal.js', Object.assign({}, BASE_ENV, env || {}));
}

async function call(token, body) {
  var res = makeRes();
  await handler(makeReq({ headers: token ? { authorization: 'Bearer ' + token } : {}, body: body || {} }), res);
  return res;
}

function run() {
  return (async function () {
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

    await runTest('missing token returns 401 without calling Polar', async function () {
      setup();
      mockPolar(201, {});
      var res = await call(null);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(captured, null);
    });

    await runTest('invalid token returns 401 without leaking details', async function () {
      setup();
      mockPolar(201, {});
      var res = await call('forged-token');
      assert.strictEqual(res.statusCode, 401);
      assert.ok(!/signature/i.test(JSON.stringify(res.body)));
    });

    await runTest('creates a session for the verified uid and returns the portal URL', async function () {
      setup();
      mockPolar(201, { token: 't', customer_portal_url: 'https://polar.sh/portal/abc', expires_at: 'x' });
      var res = await call('valid-token', { external_customer_id: 'someone-else' });
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.body, { url: 'https://polar.sh/portal/abc' });
      assert.strictEqual(captured.url, 'https://api.polar.sh/v1/customer-sessions/');
      assert.strictEqual(captured.opts.method, 'POST');
      assert.strictEqual(captured.opts.headers.Authorization, 'Bearer polar_oat_test');
      var sent = JSON.parse(captured.opts.body);
      assert.strictEqual(sent.external_customer_id, 'user-123', 'uid from the token, not the body');
      assert.strictEqual(sent.return_url, 'https://adnankamal2708-hub.github.io/quran-ap/');
    });

    await runTest('APP_URL overrides the return URL', async function () {
      setup({ APP_URL: 'https://example.com/' });
      mockPolar(201, { customer_portal_url: 'https://polar.sh/portal/abc' });
      await call('valid-token');
      assert.strictEqual(JSON.parse(captured.opts.body).return_url, 'https://example.com/');
    });

    await runTest('no Polar customer (422/404) returns 404 with a clear message', async function () {
      setup();
      mockPolar(422, { detail: [{ msg: 'Customer does not exist.' }] });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error, 'No subscription found for this account.');
      mockPolar(404, { error: 'ResourceNotFound' });
      res = await call('valid-token');
      assert.strictEqual(res.statusCode, 404);
    });

    await runTest('other Polar errors return 502 without provider details', async function () {
      setup();
      mockPolar(500, { error: 'InternalServerError', detail: 'polar internals' });
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 502);
      assert.ok(!/internals/.test(JSON.stringify(res.body)));
    });

    await runTest('missing POLAR_ACCESS_TOKEN returns 500', async function () {
      setup({ POLAR_ACCESS_TOKEN: undefined });
      mockPolar(201, {});
      var res = await call('valid-token');
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Server configuration error');
      assert.strictEqual(captured, null);
    });

    await runTest('missing service account returns 500 instead of crashing', async function () {
      var apps = stubs.admin.apps;
      stubs.admin.apps = [];
      try {
        setup({ FIREBASE_SERVICE_ACCOUNT: undefined });
        var res = await call('valid-token');
        assert.strictEqual(res.statusCode, 500);
      } finally {
        stubs.admin.apps = apps;
      }
    });

    stubs.restore();
    printSummary();
  })();
}

run();
