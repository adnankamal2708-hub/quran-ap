// ═══════════════════════════════════════════════════════════════
// api-webhook.test.js — Polar webhook handler tests
//
// Exercises the signature verification (Standard Webhooks HMAC),
// replay protection, event routing, and the exact Firestore doc shape
// that premium.js isPremium() depends on. A regression here would
// either reject real purchases or accept forged events — both are
// covered below.
// ═══════════════════════════════════════════════════════════════

var assert = require('assert');
var helpers = require('./api-handler-helpers');

var installModuleStubs = helpers.installModuleStubs;
var loadHandler = helpers.loadHandler;
var makeReq = helpers.makeReq;
var makeRes = helpers.makeRes;
var signedHeaders = helpers.signedHeaders;
var runTest = helpers.runTest;
var printSummary = helpers.printSummary;

var stubs = installModuleStubs();

// Valid base64 secret so the module's startup self-check stays quiet.
var SECRET = 'whsec_dGVzdC1zZWNyZXQ=';

var BASE_ENV = {
  FIREBASE_SERVICE_ACCOUNT: '{}',
  POLAR_WEBHOOK_SECRET: SECRET,
  POLAR_ACCESS_TOKEN: 'polar_oat_test',
  POLAR_PRODUCT_ID_MONTHLY: 'prod-monthly',
  POLAR_PRODUCT_ID_YEARLY: 'prod-yearly',
  POLAR_API_URL: 'https://api.polar.sh',
};

var webhookHandler = null;

function setupWebhook(envOverrides) {
  webhookHandler = loadHandler('webhook.js', Object.assign({}, BASE_ENV, envOverrides || {}));
  stubs.firestoreWrites.length = 0; // fresh write log per test
  Object.keys(stubs.firestoreDocs).forEach(function (k) { delete stubs.firestoreDocs[k]; });
}

/**
 * Deliver a raw JSON event to the handler exactly as Vercel would:
 * bodyParser disabled, so the handler reads the raw body via buffer(req).
 */
function deliver(event, opts) {
  var rawBody = JSON.stringify(event);
  var headers = signedHeaders(rawBody, SECRET, opts || {});
  stubs.setRawBody(rawBody);
  var req = makeReq({ headers: headers });
  var res = makeRes();
  return webhookHandler(req, res).then(function () {
    return res;
  });
}

// ── Shared fixtures ────────────────────────────────────────
function activeSubscription(overrides) {
  return Object.assign(
    {
      id: 'sub-1',
      customer_id: 'cust-1',
      customer: { external_id: 'user-123' },
      metadata: { uid: 'user-123' },
      product_id: 'prod-monthly',
      status: 'active',
      current_period_end: '2026-09-01T00:00:00.000Z',
    },
    overrides || {}
  );
}

function run() {
  return (async function () {
    // ── Method handling ──────────────────────────────────
    await runTest('GET returns 405', async function () {
      setupWebhook();
      var res = makeRes();
      await webhookHandler(makeReq({ method: 'GET' }), res);
      assert.strictEqual(res.statusCode, 405);
    });

    // ── Signature verification ───────────────────────────
    await runTest('missing signature headers returns 403', async function () {
      setupWebhook();
      var res = makeRes();
      await webhookHandler(makeReq(), res);
      assert.strictEqual(res.statusCode, 403);
    });

    await runTest('tampered signature returns 403', async function () {
      setupWebhook();
      var rawBody = JSON.stringify({ type: 'order.created', data: {} });
      var headers = signedHeaders(rawBody, SECRET, { signature: 'v1,QUFBQUFBQQ==' });
      stubs.setRawBody(rawBody);
      var res = makeRes();
      await webhookHandler(makeReq({ headers: headers }), res);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(stubs.firestoreWrites.length, 0);
    });

    await runTest('replayed event (timestamp >5min old) returns 403', async function () {
      setupWebhook();
      var event = { type: 'subscription.updated', data: activeSubscription() };
      var res = await deliver(event, { timestamp: Math.floor(Date.now() / 1000) - 600 });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(stubs.firestoreWrites.length, 0);
    });

    await runTest('missing webhook secret env returns 403', async function () {
      setupWebhook({ POLAR_WEBHOOK_SECRET: undefined });
      var event = { type: 'subscription.updated', data: activeSubscription() };
      var res = await deliver(event);
      assert.strictEqual(res.statusCode, 403);
    });

    // ── order.created ────────────────────────────────────
    await runTest('order.created writes the subscription doc in premium.js shape', async function () {
      setupWebhook();
      var event = {
        type: 'order.created',
        data: {
          id: 'order-1',
          customer: { external_id: 'user-123' },
          metadata: { uid: 'user-123' },
          subscription: activeSubscription(),
        },
      };
      var res = await deliver(event);

      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.body, { received: true });
      assert.strictEqual(stubs.firestoreWrites.length, 1);

      var write = stubs.firestoreWrites[0];
      assert.strictEqual(write.name, 'subscriptions');
      assert.strictEqual(write.id, 'user-123');
      assert.strictEqual(write.opts.merge, true);
      // The contract premium.js isPremium() reads:
      assert.strictEqual(write.data.status, 'active');
      assert.strictEqual(write.data.currentPeriodEnd, '2026-09-01T00:00:00.000Z');
      assert.strictEqual(write.data.plan, 'monthly');
      assert.strictEqual(write.data.polarCustomerId, 'cust-1');
      assert.strictEqual(write.data.polarSubscriptionId, 'sub-1');
      assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(write.data.updatedAt), 'updatedAt is an ISO timestamp');
    });

    await runTest('order.created backfills subscription from Polar API when status missing', async function () {
      setupWebhook();
      var capturedFetch = null;
      global.fetch = async function (url, opts) {
        capturedFetch = { url: url, opts: opts };
        return {
          ok: true,
          json: async function () {
            return {
              id: 'sub-9',
              customer_id: 'cust-9',
              product_id: 'prod-yearly',
              status: 'active',
              current_period_end: '2026-10-01T00:00:00.000Z',
            };
          },
        };
      };

      var event = {
        type: 'order.created',
        data: {
          id: 'order-9',
          customer: { external_id: 'user-123' },
          subscription_id: 'sub-9',
          subscription: { id: 'sub-9', customer_id: 'cust-9' }, // no status → backfill
        },
      };
      var res = await deliver(event);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(capturedFetch, 'Polar API should be called for backfill');
      assert.strictEqual(capturedFetch.url, 'https://api.polar.sh/v1/subscriptions/sub-9');
      assert.strictEqual(stubs.firestoreWrites.length, 1);
      assert.strictEqual(stubs.firestoreWrites[0].data.plan, 'yearly');
      assert.strictEqual(stubs.firestoreWrites[0].data.status, 'active');
      delete global.fetch;
    });

    await runTest('order.created with no subscription data writes nothing (waits for updated)', async function () {
      setupWebhook();
      var event = {
        type: 'order.created',
        data: {
          id: 'order-2',
          customer: { external_id: 'user-123' },
          // no subscription, no subscription_id
        },
      };
      var res = await deliver(event);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(stubs.firestoreWrites.length, 0);
    });

    // ── subscription lifecycle events ────────────────────
    await runTest('subscription.updated (active) syncs the doc', async function () {
      setupWebhook();
      var res = await deliver({ type: 'subscription.updated', data: activeSubscription() });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(stubs.firestoreWrites[0].data.status, 'active');
    });

    await runTest('subscription.revoked (canceled) drops premium', async function () {
      setupWebhook();
      var res = await deliver({
        type: 'subscription.revoked',
        data: activeSubscription({ status: 'canceled' }),
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(stubs.firestoreWrites[0].data.status, 'canceled');
    });

    await runTest('event for a deleted user does not re-create the doc', async function () {
      // Account deletion revokes the subscription; the resulting webhook
      // must not write subscriptions/{uid} back for a user that is gone.
      setupWebhook();
      stubs.missingAuthUsers['user-123'] = true;
      try {
        var res = await deliver({
          type: 'subscription.revoked',
          data: activeSubscription({ status: 'canceled' }),
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(stubs.firestoreWrites.length, 0);
      } finally {
        delete stubs.missingAuthUsers['user-123'];
      }
    });

    // ── Out-of-order delivery ────────────────────────────
    await runTest('records polarModifiedAt from the subscription', async function () {
      setupWebhook();
      await deliver({ type: 'subscription.updated', data: activeSubscription({ modified_at: '2026-08-01T10:00:00Z' }) });
      assert.strictEqual(stubs.firestoreWrites[0].data.polarModifiedAt, '2026-08-01T10:00:00.000Z');
    });

    await runTest('an older event for the same subscription is ignored', async function () {
      setupWebhook();
      await deliver({ type: 'subscription.revoked', data: activeSubscription({ status: 'canceled', modified_at: '2026-08-02T10:00:00Z' }) });
      var res = await deliver({ type: 'subscription.updated', data: activeSubscription({ status: 'active', modified_at: '2026-08-01T10:00:00Z' }) });
      assert.strictEqual(res.statusCode, 200, 'still acknowledged so Polar stops retrying');
      assert.strictEqual(stubs.firestoreWrites.length, 1, 'stale active event not written');
      assert.strictEqual(stubs.firestoreDocs['subscriptions/user-123'].status, 'canceled');
    });

    await runTest('a newer event for the same subscription is applied', async function () {
      setupWebhook();
      await deliver({ type: 'subscription.updated', data: activeSubscription({ modified_at: '2026-08-01T10:00:00Z' }) });
      await deliver({ type: 'subscription.revoked', data: activeSubscription({ status: 'canceled', modified_at: '2026-08-02T10:00:00Z' }) });
      assert.strictEqual(stubs.firestoreDocs['subscriptions/user-123'].status, 'canceled');
    });

    await runTest('a redelivery with the same timestamp is written (idempotent)', async function () {
      setupWebhook();
      var event = { type: 'subscription.updated', data: activeSubscription({ modified_at: '2026-08-01T10:00:00Z' }) };
      await deliver(event);
      await deliver(event);
      assert.strictEqual(stubs.firestoreWrites.length, 2);
    });

    await runTest("an old plan's revoke does not end a different active subscription", async function () {
      // User switched plans: new subscription sub-2 is active, then the
      // old sub-1's final revoke arrives (with a later timestamp).
      setupWebhook();
      await deliver({ type: 'subscription.updated', data: activeSubscription({ id: 'sub-2', product_id: 'prod-yearly', modified_at: '2026-08-05T10:00:00Z' }) });
      await deliver({ type: 'subscription.revoked', data: activeSubscription({ id: 'sub-1', status: 'canceled', modified_at: '2026-09-01T10:00:00Z' }) });
      var doc = stubs.firestoreDocs['subscriptions/user-123'];
      assert.strictEqual(doc.status, 'active');
      assert.strictEqual(doc.polarSubscriptionId, 'sub-2');
    });

    await runTest('a new active subscription replaces a canceled one', async function () {
      setupWebhook();
      await deliver({ type: 'subscription.revoked', data: activeSubscription({ id: 'sub-1', status: 'canceled', modified_at: '2026-09-01T10:00:00Z' }) });
      await deliver({ type: 'subscription.updated', data: activeSubscription({ id: 'sub-2', modified_at: '2026-08-05T10:00:00Z' }) });
      var doc = stubs.firestoreDocs['subscriptions/user-123'];
      assert.strictEqual(doc.status, 'active');
      assert.strictEqual(doc.polarSubscriptionId, 'sub-2');
    });

    await runTest('missing service account returns 500 so Polar retries', async function () {
      var apps = stubs.admin.apps;
      stubs.admin.apps = [];
      try {
        setupWebhook({ FIREBASE_SERVICE_ACCOUNT: undefined });
        var res = await deliver({ type: 'subscription.updated', data: activeSubscription() });
        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.error, 'Server configuration error');
        assert.strictEqual(stubs.firestoreWrites.length, 0);
      } finally {
        stubs.admin.apps = apps;
      }
    });

    await runTest('subscription.past_due writes past_due status', async function () {
      setupWebhook();
      var res = await deliver({
        type: 'subscription.past_due',
        data: activeSubscription({ status: 'past_due' }),
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(stubs.firestoreWrites[0].data.status, 'past_due');
    });

    // ── Edge cases ───────────────────────────────────────
    await runTest('unhandled event type acknowledges without writing', async function () {
      setupWebhook();
      var res = await deliver({ type: 'something.else', data: { id: 'x' } });
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.body, { received: true });
      assert.strictEqual(stubs.firestoreWrites.length, 0);
    });

    await runTest('subscription event with unresolvable uid writes nothing', async function () {
      setupWebhook();
      var res = await deliver({
        type: 'subscription.updated',
        data: activeSubscription({ customer: { external_id: null }, metadata: {} }),
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(stubs.firestoreWrites.length, 0);
    });

    await runTest('malformed event (no data) returns 400', async function () {
      setupWebhook();
      var res = await deliver({ type: 'order.created' });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, 'Malformed event payload');
    });

    await runTest('invalid JSON body returns 400 after valid signature', async function () {
      setupWebhook();
      var rawBody = 'this is not json {{{';
      var headers = signedHeaders(rawBody, SECRET);
      stubs.setRawBody(rawBody);
      var res = makeRes();
      await webhookHandler(makeReq({ headers: headers }), res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body, 'Invalid webhook payload');
    });

    stubs.restore();
    printSummary();
  })();
}

run();
