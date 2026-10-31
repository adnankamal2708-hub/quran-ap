#!/usr/bin/env node
/**
 * account-progress.test.js — an account's progress leaves the device's guest
 * view on sign-out and comes back when that account signs in again.
 *
 * Tests: stashAccountProgress, restoreAccountProgress, the auth-change
 * handler (sign-in, sign-out, session restore, account deletion).
 *
 * Run: node test/account-progress.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var _storage = {};
global.localStorage = {
  getItem: function(k) { return Object.prototype.hasOwnProperty.call(_storage, k) ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
  key: function(i) { return Object.keys(_storage)[i] || null; },
  get length() { return Object.keys(_storage).length; },
};
global.window = {};
global.console = { log: console.log, warn: function() {}, error: function() {} };

var refreshed = 0;
global.invalidateSRSMemoryCache = function() { refreshed++; };

// The real sync merge, so restore merges exactly as cloud sync does.
['js/services/config.js', 'js/data-core/tracks.js', 'js/services/sync-service.js', 'js/services/account-progress.js'].forEach(function(f) {
  var full = path.join(__dirname, '..', f);
  vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
});

var reloads = 0;
accountProgressReload = function() { reloads++; };

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;
function test(name, fn) {
  _storage = {};
  reloads = 0;
  refreshed = 0;
  resetAccountProgressState();
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function get(key) { var raw = localStorage.getItem(key); return raw === null ? null : JSON.parse(raw); }

/** What a signed-in learner with one finished lesson has on the device. */
function seedAccount() {
  set('quran_foundation_progress', { completedLessons: [0], quizPassed: { 0: true }, currentLesson: 1 });
  set('quran_srs_data', { cw_1: { stage: 2, totalReviews: 3 } });
  set('quran_streak', { count: 4, lastDate: '2026-10-30' });
  set('quran_tracks', { version: 1, main: 'words', tracks: { words: { joined: true, level: 1, percentHigh: 5.1 } } });
  set('bayan_guided_reading', { completed: [1] });
  set('quran_quran_last', { surahId: 2, ayah: 5 });
  // Device settings — not anyone's progress.
  localStorage.setItem('bayan_theme', 'dark');
  localStorage.setItem('quran_onboarding_done', 'true');
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\n🔐 Account progress on sign-out and sign-in');

test('sign-out takes the account\'s progress off the guest view', function() {
  seedAccount();
  stashAccountProgress('u1');
  ['quran_foundation_progress', 'quran_srs_data', 'quran_streak', 'quran_tracks', 'bayan_guided_reading', 'quran_quran_last']
    .forEach(function(k) { assert.strictEqual(localStorage.getItem(k), null, k + ' left behind'); });
});

test('device settings stay on sign-out', function() {
  seedAccount();
  stashAccountProgress('u1');
  assert.strictEqual(localStorage.getItem('bayan_theme'), 'dark');
  assert.strictEqual(localStorage.getItem('quran_onboarding_done'), 'true');
});

test('signing the same account back in restores exactly what it had', function() {
  seedAccount();
  var before = Object.assign({}, _storage);
  var tracksBefore = loadTracks();
  stashAccountProgress('u1');
  assert.strictEqual(restoreAccountProgress('u1'), true);
  // The tracks entry comes back normalised (same content, every track listed).
  var after = Object.assign({}, _storage);
  delete before.quran_tracks;
  delete after.quran_tracks;
  assert.deepStrictEqual(after, before);
  assert.deepStrictEqual(loadTracks().tracks.words, tracksBefore.tracks.words);
  assert.strictEqual(loadTracks().main, tracksBefore.main);
  assert.strictEqual(localStorage.getItem(ACCOUNT_STASH_PREFIX + 'u1'), null, 'stash removed once restored');
});

test('a different account signing in does not get the first account\'s progress', function() {
  seedAccount();
  stashAccountProgress('u1');
  assert.strictEqual(restoreAccountProgress('u2'), false);
  assert.strictEqual(localStorage.getItem('quran_foundation_progress'), null);
  assert.ok(localStorage.getItem(ACCOUNT_STASH_PREFIX + 'u1'), 'u1 still put aside');
});

test('guest progress made while signed out is merged into the account on sign-in', function() {
  seedAccount();
  stashAccountProgress('u1');
  set('quran_srs_data', { cw_9: { stage: 1, totalReviews: 1 } });
  restoreAccountProgress('u1');
  var srs = get('quran_srs_data');
  assert.ok(srs.cw_1, 'account word kept');
  assert.ok(srs.cw_9, 'guest word kept');
  assert.deepStrictEqual(get('quran_foundation_progress').completedLessons, [0]);
});

test('putting progress aside twice never loses the older copy', function() {
  seedAccount();
  stashAccountProgress('u1');
  // A sign-in that never restored (e.g. an unverified email), then sign-out again.
  set('quran_srs_data', { cw_9: { stage: 1, totalReviews: 1 } });
  stashAccountProgress('u1');
  restoreAccountProgress('u1');
  var srs = get('quran_srs_data');
  assert.ok(srs.cw_1 && srs.cw_9, 'both copies merged');
  assert.deepStrictEqual(get('quran_foundation_progress').completedLessons, [0]);
});

test('restoring refreshes the in-memory review cache', function() {
  seedAccount();
  stashAccountProgress('u1');
  restoreAccountProgress('u1');
  assert.ok(refreshed >= 1);
});

console.log('\n🔁 Auth changes');

test('a session found at start-up changes nothing', function() {
  seedAccount();
  var before = JSON.stringify(_storage);
  handleAccountAuthChange({ uid: 'u1' });
  assert.strictEqual(JSON.stringify(_storage), before);
  assert.strictEqual(reloads, 0);
});

test('signing out puts progress aside and reloads into a clean guest app', function() {
  seedAccount();
  handleAccountAuthChange({ uid: 'u1' });
  handleAccountAuthChange(null);
  assert.strictEqual(localStorage.getItem('quran_foundation_progress'), null);
  assert.ok(localStorage.getItem(ACCOUNT_STASH_PREFIX + 'u1'));
  assert.strictEqual(reloads, 1);
});

test('starting signed out does nothing', function() {
  seedAccount();
  handleAccountAuthChange(null);
  assert.ok(localStorage.getItem('quran_foundation_progress'));
  assert.strictEqual(reloads, 0);
});

test('signing back in restores the put-aside progress', function() {
  seedAccount();
  handleAccountAuthChange({ uid: 'u1' });
  handleAccountAuthChange(null);
  handleAccountAuthChange({ uid: 'u1' });
  assert.deepStrictEqual(get('quran_foundation_progress').completedLessons, [0]);
});

test('a repeated sign-in notification does not restore twice', function() {
  seedAccount();
  stashAccountProgress('u1');
  handleAccountAuthChange({ uid: 'u1' });
  var after = JSON.stringify(_storage);
  handleAccountAuthChange({ uid: 'u1' });
  assert.strictEqual(JSON.stringify(_storage), after);
});

test('deleting the account puts nothing aside and does not reload', function() {
  seedAccount();
  handleAccountAuthChange({ uid: 'u1' });
  skipNextSignOutStash(true);
  handleAccountAuthChange(null);
  assert.strictEqual(localStorage.getItem(ACCOUNT_STASH_PREFIX + 'u1'), null);
  assert.strictEqual(reloads, 0);
});

test('a failed deletion does not affect a later sign-out', function() {
  seedAccount();
  handleAccountAuthChange({ uid: 'u1' });
  skipNextSignOutStash(true);
  skipNextSignOutStash(false);
  handleAccountAuthChange(null);
  assert.ok(localStorage.getItem(ACCOUNT_STASH_PREFIX + 'u1'));
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
