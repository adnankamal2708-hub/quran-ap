/**
 * test/api-handler-helpers.js — Shared Test Infrastructure for the Vercel API
 *
 * The Vercel payment handlers (api/create-checkout-session.js, api/webhook.js)
 * require 'firebase-admin' and 'micro' at module top-level. Those packages are
 * NOT installed in the repo root (they live in api/package.json for the Vercel
 * runtime), so tests stub them via Module._load interception — no dependencies
 * and no network access required.
 *
 * Also provides:
 *   - makeReq / makeRes: minimal req/res objects matching what Vercel passes
 *   - polarSign: computes a valid Standard-Webhooks signature for a raw body
 *     (mirrors the exact algorithm in api/webhook.js verifySignature)
 *   - runTest / summary: the repo's plain-Node assert convention, printing
 *     "Results: N passed, N failed" for test/run-all.js to parse
 */

var crypto = require('crypto');
var path = require('path');
var Module = require('module');

// ═══════════════════════════════════════════════════════════════
// Module stubbing — firebase-admin + micro
// ═══════════════════════════════════════════════════════════════

/**
 * Install the firebase-admin / micro stubs and return handles the tests
 * can assert against. `firestoreWrites` collects every set() call made
 * through the mocked Firestore, so tests can verify the subscription
 * document shape without a real database.
 */
function installModuleStubs() {
  var firestoreWrites = [];

  var mockDb = {
    collection: function (name) {
      return {
        doc: function (id) {
          return {
            set: function (data, opts) {
              firestoreWrites.push({ name: name, id: id, data: data, opts: opts });
              return Promise.resolve();
            },
          };
        },
      };
    },
  };

  var mockAdmin = {
    // Non-empty so the handlers' `if (!admin.apps.length)` init block is
    // skipped — we are not testing firebase-admin itself.
    apps: [{}],
    initializeApp: function () {},
    auth: function () {
      return {
        verifyIdToken: function (token) {
          if (token === 'valid-token') {
            return Promise.resolve({ uid: 'user-123', email: 'user@example.com' });
          }
          if (token === 'valid-token-no-email') {
            return Promise.resolve({ uid: 'user-123' });
          }
          return Promise.reject(new Error('Firebase ID token has invalid signature'));
        },
      };
    },
    firestore: function () {
      return mockDb;
    },
  };

  // webhook.js destructures `const { buffer } = require('micro')` at module
  // LOAD time, so the mock must be a stable function that reads a mutable
  // slot set per-test — assigning buffer after a reload would capture null.
  var mockRawBody = '';
  var mockMicro = {
    buffer: async function () {
      return Buffer.from(mockRawBody, 'utf8');
    },
  };

  var originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'firebase-admin') return mockAdmin;
    if (request === 'micro') return mockMicro;
    return originalLoad.apply(this, arguments);
  };

  return {
    admin: mockAdmin,
    micro: mockMicro,
    firestoreWrites: firestoreWrites,
    setRawBody: function (body) {
      mockRawBody = body;
    },
    restore: function () {
      Module._load = originalLoad;
    },
  };
}

/**
 * Load a handler module fresh (cleared require cache) so it re-reads
 * process.env at require time — required because the handlers capture
 * env (POLAR_ACCESS_TOKEN, PRODUCT_IDS, webhook secret) at module load.
 */
function loadHandler(apiFile, env) {
  var apiPath = path.join(__dirname, '..', 'api', apiFile);
  delete require.cache[require.resolve(apiPath)];

  Object.keys(env).forEach(function (key) {
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  });

  return require(apiPath);
}

// ═══════════════════════════════════════════════════════════════
// Request / response mocks
// ═══════════════════════════════════════════════════════════════

function makeReq(overrides) {
  return Object.assign(
    {
      method: 'POST',
      headers: {},
      body: {},
    },
    overrides || {}
  );
}

function makeRes() {
  var res = {
    statusCode: 0,
    body: null,
    headers: {},
    status: function (code) {
      res.statusCode = code;
      return res;
    },
    json: function (obj) {
      res.body = obj;
      return res;
    },
    send: function (str) {
      res.body = str;
      return res;
    },
    end: function () {
      return res;
    },
    setHeader: function (name, value) {
      res.headers[name] = value;
    },
  };
  return res;
}

// ═══════════════════════════════════════════════════════════════
// Polar Standard-Webhooks signature helper
// ═══════════════════════════════════════════════════════════════

/**
 * Compute a valid Polar webhook signature for a raw body, matching the
 * algorithm in api/webhook.js verifySignature: the signed message is
 * `${id}.${timestamp}.${rawBody}` and the HMAC key is the RAW UTF-8 bytes
 * of the secret string (whsec_ prefix included — the Polar SDK behavior
 * that webhook.js accepts as its first candidate).
 */
function polarSign(id, timestamp, rawBody, secret) {
  var message = id + '.' + timestamp + '.' + rawBody;
  var sig = crypto
    .createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(message, 'utf8')
    .digest('base64');
  return 'v1,' + sig;
}

/** Build the full webhook header set for a signed raw body. */
function signedHeaders(rawBody, secret, opts) {
  var ts = opts && opts.timestamp !== undefined ? opts.timestamp : Math.floor(Date.now() / 1000);
  var id = (opts && opts.id) || 'evt_test_123';
  return {
    'webhook-id': id,
    'webhook-timestamp': String(ts),
    'webhook-signature': opts && opts.signature !== undefined ? opts.signature : polarSign(id, String(ts), rawBody, secret),
  };
}

// ═══════════════════════════════════════════════════════════════
// Tiny async test runner (plain-Node, matches repo convention)
// ═══════════════════════════════════════════════════════════════

var _passed = 0;
var _failed = 0;
var _failedNames = [];

async function runTest(name, fn) {
  try {
    await fn();
    _passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    _failed++;
    _failedNames.push(name);
    console.log('  \u2717 ' + name + ': ' + (e && e.message ? e.message : e));
  }
}

function printSummary() {
  var total = _passed + _failed;
  console.log('');
  console.log('Results: ' + _passed + ' passed, ' + _failed + ' failed, ' + total + ' total');
  if (_failed > 0) {
    console.log('  Failed: ' + _failedNames.join(', '));
  }
  process.exit(_failed > 0 ? 1 : 0);
}

module.exports = {
  installModuleStubs: installModuleStubs,
  loadHandler: loadHandler,
  makeReq: makeReq,
  makeRes: makeRes,
  polarSign: polarSign,
  signedHeaders: signedHeaders,
  runTest: runTest,
  printSummary: printSummary,
};
