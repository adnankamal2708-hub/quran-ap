// ═══════════════════════════════════════════════════════════════
// api-checkout.test.js — create-checkout-session handler tests
//
// Exercises the Vercel function that turns a verified Firebase ID token
// + plan into a Polar Checkout session. Covers auth rejection, plan
// validation, the exact Polar request payload (metadata.uid /
// external_customer_id), provider-error mapping, and the guarantee that
// internal error text never leaks to callers.
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

// Base environment — every loadHandler call starts from these and
// individual tests override/delete specific keys.
var BASE_ENV = {
  FIREBASE_SERVICE_ACCOUNT: '{}',
  POLAR_ACCESS_TOKEN: 'polar_oat_test',
  POLAR_PRODUCT_ID_MONTHLY: 'prod-monthly',
  POLAR_PRODUCT_ID_YEARLY: 'prod-yearly',
  POLAR_API_URL: 'https://api.polar.sh',
  APP_URL: 'https://bayan.app',
};

// ── fetch mock ─────────────────────────────────────────────
var capturedPolar = null; // { url, opts } of the last Polar API call

function mockPolarFetch(response) {
  global.fetch = async function (url, opts) {
    capturedPolar = { url: url, opts: opts };
    return response;
  };
}

function polarOkResponse() {
  return { ok: true, status: 200, json: async function () { return { url: 'https://checkout.polar.sh/cs_test_xyz' }; } };
}

var checkoutHandler = null;

function setupCheckout(envOverrides) {
  checkoutHandler = loadHandler('create-checkout-session.js', Object.assign({}, BASE_ENV, envOverrides || {}));
}

function authReq(token, body) {
  return makeReq({
    headers: { authorization: 'Bearer ' + token },
    body: body || { plan: 'monthly' },
  });
}

function run() {
  return (async function () {
    // ── HTTP method handling ─────────────────────────────
    await runTest('OPTIONS preflight returns 200', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(makeReq({ method: 'OPTIONS' }), res);
      assert.strictEqual(res.statusCode, 200);
    });

    await runTest('GET returns 405', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(makeReq({ method: 'GET' }), res);
      assert.strictEqual(res.statusCode, 405);
      assert.strictEqual(res.body.error, 'Method not allowed');
    });

    // ── Auth ─────────────────────────────────────────────
    await runTest('missing Authorization header returns 401', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(makeReq(), res);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error, 'Missing or invalid Authorization header');
    });

    await runTest('non-Bearer Authorization header returns 401', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(makeReq({ headers: { authorization: 'Basic abc123' } }), res);
      assert.strictEqual(res.statusCode, 401);
    });

    // ── Plan validation ──────────────────────────────────
    await runTest('invalid plan value returns 400', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(authReq('valid-token', { plan: 'lifetime' }), res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, 'Invalid plan. Use "monthly" or "yearly".');
    });

    await runTest('missing plan body returns 400', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(authReq('valid-token', {}), res);
      assert.strictEqual(res.statusCode, 400);
    });

    // ── Configuration errors are distinct from client errors ──
    await runTest('missing product ID env var returns 500 (config, not 400)', async function () {
      setupCheckout({ POLAR_PRODUCT_ID_MONTHLY: undefined });
      var res = makeRes();
      await checkoutHandler(authReq('valid-token', { plan: 'monthly' }), res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Server configuration error');
    });

    await runTest('missing POLAR_ACCESS_TOKEN returns 500 (config)', async function () {
      setupCheckout({ POLAR_ACCESS_TOKEN: undefined });
      var res = makeRes();
      await checkoutHandler(authReq('valid-token'), res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Server configuration error');
    });

    // ── Successful checkout — monthly ────────────────────
    await runTest('monthly plan creates Polar checkout with uid metadata', async function () {
      setupCheckout();
      mockPolarFetch(polarOkResponse());
      var res = makeRes();
      await checkoutHandler(authReq('valid-token-no-email', { plan: 'monthly' }), res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.url, 'https://checkout.polar.sh/cs_test_xyz');

      // Correct Polar endpoint + auth
      assert.strictEqual(capturedPolar.url, 'https://api.polar.sh/v1/checkouts/');
      assert.strictEqual(capturedPolar.opts.headers.Authorization, 'Bearer polar_oat_test');
      assert.strictEqual(capturedPolar.opts.headers['Content-Type'], 'application/json');

      var body = JSON.parse(capturedPolar.opts.body);
      assert.deepStrictEqual(body.products, ['prod-monthly']);
      // The uid must travel via metadata + external_customer_id so the
      // webhook can map the purchase back without trusting client input.
      assert.strictEqual(body.external_customer_id, 'user-123');
      assert.strictEqual(body.metadata.uid, 'user-123');
      assert.strictEqual(body.success_url, 'https://bayan.app/?checkout=success');
      assert.strictEqual(body.return_url, 'https://bayan.app/?checkout=cancel');
      assert.strictEqual(body.allow_trial, false);
      assert.strictEqual(body.allow_discount_codes, false);
      // No email in the token → no customer_email on the checkout
      assert.strictEqual(body.customer_email, undefined);
      delete global.fetch;
    });

    // ── Successful checkout — yearly + email ─────────────
    await runTest('yearly plan passes email through to Polar', async function () {
      setupCheckout();
      mockPolarFetch(polarOkResponse());
      var res = makeRes();
      await checkoutHandler(authReq('valid-token', { plan: 'yearly' }), res);

      assert.strictEqual(res.statusCode, 200);
      var body = JSON.parse(capturedPolar.opts.body);
      assert.deepStrictEqual(body.products, ['prod-yearly']);
      assert.strictEqual(body.customer_email, 'user@example.com');
      delete global.fetch;
    });

    // ── Provider errors ──────────────────────────────────
    await runTest('Polar provider error maps to 502 (not a leaky 500)', async function () {
      setupCheckout();
      mockPolarFetch({ ok: false, status: 400, json: async function () { return { error: 'invalid product' }; } });
      var res = makeRes();
      await checkoutHandler(authReq('valid-token'), res);
      assert.strictEqual(res.statusCode, 502);
      assert.strictEqual(res.body.error, 'Checkout provider error');
      delete global.fetch;
    });

    await runTest('Polar response without url maps to 502', async function () {
      setupCheckout();
      mockPolarFetch({ ok: true, status: 200, json: async function () { return { status: 'ok' }; } });
      var res = makeRes();
      await checkoutHandler(authReq('valid-token'), res);
      assert.strictEqual(res.statusCode, 502);
      assert.strictEqual(res.body.error, 'Checkout provider error');
      delete global.fetch;
    });

    // ── Token verification failure ───────────────────────
    await runTest('invalid Firebase token returns generic 500 (no error leak)', async function () {
      setupCheckout();
      var res = makeRes();
      await checkoutHandler(authReq('bad-token'), res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Internal error');
      // The Firebase error detail must never reach the caller
      assert.strictEqual(JSON.stringify(res.body).indexOf('invalid signature'), -1);
    });

    stubs.restore();
    printSummary();
  })();
}

run();
