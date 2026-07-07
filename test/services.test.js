#!/usr/bin/env node
/**
 * services.test.js — Service Layer Pure Function Tests
 *
 * Tests the pure functions from auth-service, sync-service, and
 * user-service without requiring ES module imports (which Node.js
 * cannot resolve from CDN URLs).
 *
 * Pure functions tested:
 *   - _translateFirebaseError (auth-service)
 *   - checkActionCode (auth-service)
 *   - exportLocalData (sync-service)
 *   - importLocalData (sync-service)
 *   - mergeData (sync-service)
 *   - mergeSettings (user-service)
 *   - computeLearningSummary (user-service)
 *
 * Run: node test/services.test.js
 */

var assert = require('assert');

// ── Mock Setup ──
var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};
function clearStorage() { _storage = {}; }

var OriginalDate = global.Date;
var _mockNow = new Date('2026-07-07T12:00:00Z').getTime();
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

global.window = {};
// Keep console.log for test output, only suppress warn/error to avoid noise
global.console = { log: console.log, warn: function() {}, error: function() {} };
global.URLSearchParams = require('url').URLSearchParams;

// ═══════════════════════════════════════════════════════════════
// Copied Pure Functions (from service files)
//
// These are copied directly because the source files use ES module
// import statements (e.g., from CDN URLs) that Node.js cannot eval.
// ═══════════════════════════════════════════════════════════════

// ── From auth-service.js ──

function _translateFirebaseError(error) {
  var code = error.code || error.message || 'unknown';

  switch (code) {
    case 'auth/email-already-in-use':
      return new Error('This email is already registered. Try signing in instead.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid email address.');
    case 'auth/user-disabled':
      return new Error('This account has been disabled.');
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return new Error('Invalid email or password.');
    case 'auth/weak-password':
      return new Error('Password should be at least 6 characters.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Please try again later.');
    case 'auth/requires-recent-login':
      return new Error('Please sign in again before making this change.');
    case 'auth/network-request-failed':
      return new Error('Network error. Check your connection and try again.');
    case 'auth/operation-not-allowed':
      return new Error('Email/password sign-in is not enabled. Please contact support.');
    case 'auth/expired-action-code':
      return new Error('This verification link has expired. Please request a new one.');
    case 'auth/invalid-action-code':
      return new Error('This verification link is invalid. Please request a new one.');
    default:
      console.warn('[auth] Untranslated error:', code);
      return new Error('Something went wrong. Please try again.');
  }
}

function checkActionCode() {
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode');
  var oobCode = params.get('oobCode');
  var continueUrl = params.get('continueUrl');

  if (mode === 'resetPassword' && oobCode) {
    return { mode: 'resetPassword', oobCode: oobCode, continueUrl: continueUrl };
  }
  if (mode === 'verifyEmail' && oobCode) {
    return { mode: 'verifyEmail', oobCode: oobCode, continueUrl: continueUrl };
  }
  return { mode: null, oobCode: null, continueUrl: null };
}

// ── From sync-service.js ──

function exportLocalData() {
  var data = {};

  function tryParse(key, lsKey) {
    try {
      var raw = localStorage.getItem(lsKey || key);
      if (raw) data[key] = JSON.parse(raw);
    } catch (e) { /* skip */ }
  }

  tryParse('srsData', 'quran_srs_data');
  tryParse('favorites', 'quran_favorites');
  tryParse('notes', 'quran_notes');
  tryParse('streak', 'quran_streak');
  tryParse('quiz', 'quran_quiz');
  tryParse('settings', 'quran_settings');
  tryParse('lessonProgress', 'quran_lesson_progress');
  tryParse('surahProgress', 'quran_surah_progress');
  tryParse('foundationProgress', 'quran_foundation_progress');
  tryParse('analyticsHistory', 'quran_analytics_history');
  tryParse('analyticsAchievements', 'quran_analytics_achievements');
  tryParse('analyticsSessions', 'quran_analytics_sessions');

  data._exportedAt = new Date().toISOString();
  return data;
}

function importLocalData(data) {
  var imported = [];
  var skipped = [];

  if (!data || typeof data !== 'object') {
    return { imported: [], skipped: [], error: 'Invalid data format.' };
  }

  function trySet(key, lsKey, value) {
    try {
      localStorage.setItem(lsKey || key, JSON.stringify(value));
      imported.push(key);
    } catch (e) {
      skipped.push(key);
    }
  }

  var mappings = {
    srsData: 'quran_srs_data',
    favorites: 'quran_favorites',
    notes: 'quran_notes',
    streak: 'quran_streak',
    quiz: 'quran_quiz',
    settings: 'quran_settings',
    lessonProgress: 'quran_lesson_progress',
    surahProgress: 'quran_surah_progress',
    foundationProgress: 'quran_foundation_progress',
    analyticsHistory: 'quran_analytics_history',
    analyticsAchievements: 'quran_analytics_achievements',
    analyticsSessions: 'quran_analytics_sessions',
  };

  Object.keys(mappings).forEach(function (key) {
    if (data[key] !== undefined) {
      trySet(key, mappings[key], data[key]);
    }
  });

  return { imported: imported, skipped: skipped };
}

function mergeData(localData, cloudData) {
  if (!cloudData) return localData || {};
  if (!localData) return cloudData || {};

  var merged = {};

  // Merge SRS data: keep the entry with more total reviews (active data wins)
  if (localData.srsData || cloudData.srsData) {
    var localSRS = localData.srsData || {};
    var cloudSRS = cloudData.srsData || {};
    merged.srsData = {};

    var allKeys = [];
    Object.keys(localSRS).forEach(function (k) { if (allKeys.indexOf(k) < 0) allKeys.push(k); });
    Object.keys(cloudSRS).forEach(function (k) { if (allKeys.indexOf(k) < 0) allKeys.push(k); });

    allKeys.forEach(function (key) {
      var local = localSRS[key];
      var cloud = cloudSRS[key];

      if (!local) {
        merged.srsData[key] = cloud;
      } else if (!cloud) {
        merged.srsData[key] = local;
      } else {
        var localReviews = local.totalReviews || 0;
        var cloudReviews = cloud.totalReviews || 0;
        merged.srsData[key] = localReviews >= cloudReviews ? local : cloud;
      }
    });
  }

  // Merge favorites: union (keep if favorited in either)
  if (localData.favorites || cloudData.favorites) {
    merged.favorites = {};
    var localFav = localData.favorites || {};
    var cloudFav = cloudData.favorites || {};
    Object.keys(localFav).forEach(function (k) { merged.favorites[k] = true; });
    Object.keys(cloudFav).forEach(function (k) { merged.favorites[k] = true; });
  }

  // Merge notes: local preferred (most recent edits)
  if (localData.notes || cloudData.notes) {
    merged.notes = {};
    var localNotes = localData.notes || {};
    var cloudNotes = cloudData.notes || {};
    Object.keys(cloudNotes).forEach(function (k) { merged.notes[k] = cloudNotes[k]; });
    Object.keys(localNotes).forEach(function (k) { merged.notes[k] = localNotes[k]; });
  }

  // Streak: keep the higher streak value
  if (localData.streak || cloudData.streak) {
    var localStreak = localData.streak || { streak: 0, lastDate: null };
    var cloudStreak = cloudData.streak || { streak: 0, lastDate: null };
    merged.streak = (localStreak.streak >= cloudStreak.streak) ? localStreak : cloudStreak;
  }

  // Settings: local preferred (most recent)
  merged.settings = localData.settings || cloudData.settings || null;

  // Quiz history: take max
  if (localData.quiz || cloudData.quiz) {
    var localQuiz = localData.quiz || { correct: 0, total: 0 };
    var cloudQuiz = cloudData.quiz || { correct: 0, total: 0 };
    merged.quiz = {
      correct: Math.max(localQuiz.correct || 0, cloudQuiz.correct || 0),
      total: Math.max(localQuiz.total || 0, cloudQuiz.total || 0),
    };
  }

  // Surah progress: take the one with more completed surahs
  if (localData.surahProgress || cloudData.surahProgress) {
    var localSP = localData.surahProgress || { completedSurahs: [], quizPassed: {} };
    var cloudSP = cloudData.surahProgress || { completedSurahs: [], quizPassed: {} };
    merged.surahProgress = (localSP.completedSurahs || []).length >= (cloudSP.completedSurahs || []).length
      ? localSP : cloudSP;
  }

  // Foundation progress: take the one with more completed lessons
  if (localData.foundationProgress || cloudData.foundationProgress) {
    var localFP = localData.foundationProgress || { completedLessons: [] };
    var cloudFP = cloudData.foundationProgress || { completedLessons: [] };
    merged.foundationProgress = (localFP.completedLessons || []).length >= (cloudFP.completedLessons || []).length
      ? localFP : cloudFP;
  }

  return merged;
}

// ── From user-service.js ──

function mergeSettings(saved) {
  var defaults = { dailyLimit: 25, sessionSize: 20, autoImport: true };
  if (!saved || typeof saved !== 'object') return defaults;

  var result = {};
  Object.keys(defaults).forEach(function (key) {
    result[key] = (saved[key] !== undefined) ? saved[key] : defaults[key];
  });
  return result;
}

function computeLearningSummary() {
  var srsStats = typeof getSRSStats === 'function' ? getSRSStats() : { total: 0, mature: 0, totalReviews: 0 };
  var streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };

  return {
    totalWords: srsStats.total || 0,
    wordsMastered: srsStats.mature || 0,
    totalReviews: srsStats.totalReviews || 0,
    streak: streakData.streak || 0,
    averageRetention: srsStats.avgRetention || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { clearStorage(); fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// Auth — _translateFirebaseError
// ═══════════════════════════════════════════════════════════════

suite('Auth — _translateFirebaseError', function() {
  test('auth/user-not-found returns message about email', function() {
    var err = _translateFirebaseError({ code: 'auth/user-not-found' });
    assert.ok(err.message.indexOf('email') >= 0 || err.message.indexOf('Invalid') >= 0);
  });

  test('auth/wrong-password returns message about password', function() {
    var err = _translateFirebaseError({ code: 'auth/wrong-password' });
    assert.ok(err.message.indexOf('password') >= 0 || err.message.indexOf('Invalid') >= 0);
  });

  test('auth/invalid-credential returns invalid message', function() {
    var err = _translateFirebaseError({ code: 'auth/invalid-credential' });
    assert.ok(err.message.length > 0);
  });

  test('auth/email-already-in-use returns appropriate message', function() {
    var err = _translateFirebaseError({ code: 'auth/email-already-in-use' });
    assert.ok(err.message.indexOf('already') >= 0);
  });

  test('auth/weak-password returns message about 6 characters', function() {
    var err = _translateFirebaseError({ code: 'auth/weak-password' });
    assert.ok(err.message.indexOf('6') >= 0);
  });

  test('auth/invalid-email returns message about valid email', function() {
    var err = _translateFirebaseError({ code: 'auth/invalid-email' });
    assert.ok(err.message.indexOf('email') >= 0);
  });

  test('auth/too-many-requests returns message about try later', function() {
    var err = _translateFirebaseError({ code: 'auth/too-many-requests' });
    assert.ok(err.message.indexOf('later') >= 0);
  });

  test('auth/network-request-failed returns message about network', function() {
    var err = _translateFirebaseError({ code: 'auth/network-request-failed' });
    assert.ok(err.message.toLowerCase().indexOf('network') >= 0 || err.message.toLowerCase().indexOf('connection') >= 0);
  });

  test('auth/requires-recent-login returns message about sign in again', function() {
    var err = _translateFirebaseError({ code: 'auth/requires-recent-login' });
    assert.ok(err.message.indexOf('sign in') >= 0);
  });

  test('auth/expired-action-code returns message about expired', function() {
    var err = _translateFirebaseError({ code: 'auth/expired-action-code' });
    assert.ok(err.message.indexOf('expired') >= 0);
  });

  test('auth/invalid-action-code returns message about invalid', function() {
    var err = _translateFirebaseError({ code: 'auth/invalid-action-code' });
    assert.ok(err.message.indexOf('invalid') >= 0);
  });

  test('auth/user-disabled returns message about disabled', function() {
    var err = _translateFirebaseError({ code: 'auth/user-disabled' });
    assert.ok(err.message.indexOf('disabled') >= 0);
  });

  test('auth/operation-not-allowed returns message about not enabled', function() {
    var err = _translateFirebaseError({ code: 'auth/operation-not-allowed' });
    assert.ok(err.message.indexOf('not enabled') >= 0);
  });

  test('unknown error code returns fallback message', function() {
    var err = _translateFirebaseError({ code: 'auth/some-unknown-error' });
    assert.ok(err.message.indexOf('try again') >= 0);
  });

  test('handles error object with message instead of code', function() {
    var err = _translateFirebaseError({ message: 'auth/user-not-found' });
    assert.ok(err.message.length > 0);
  });

  test('handles error with no code or message', function() {
    var err = _translateFirebaseError({});
    assert.ok(err.message.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Auth — checkActionCode
// ═══════════════════════════════════════════════════════════════

suite('Auth — checkActionCode', function() {
  test('returns null mode when no URL params', function() {
    window.location = { search: '' };
    var result = checkActionCode();
    assert.strictEqual(result.mode, null);
    assert.strictEqual(result.oobCode, null);
  });

  test('detects resetPassword mode', function() {
    window.location = { search: '?mode=resetPassword&oobCode=abc123&continueUrl=/' };
    var result = checkActionCode();
    assert.strictEqual(result.mode, 'resetPassword');
    assert.strictEqual(result.oobCode, 'abc123');
    assert.strictEqual(result.continueUrl, '/');
  });

  test('detects verifyEmail mode', function() {
    window.location = { search: '?mode=verifyEmail&oobCode=xyz789' };
    var result = checkActionCode();
    assert.strictEqual(result.mode, 'verifyEmail');
    assert.strictEqual(result.oobCode, 'xyz789');
  });

  test('returns null when mode is present but no oobCode', function() {
    window.location = { search: '?mode=resetPassword' };
    var result = checkActionCode();
    assert.strictEqual(result.mode, null);
  });

  test('returns null for unknown mode', function() {
    window.location = { search: '?mode=unknown&oobCode=abc' };
    var result = checkActionCode();
    assert.strictEqual(result.mode, null);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sync — exportLocalData
// ═══════════════════════════════════════════════════════════════

suite('Sync — exportLocalData', function() {
  test('exports multiple localStorage keys', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({ w1: { stage: 3 } }));
    localStorage.setItem('quran_favorites', JSON.stringify({ w1: true }));
    localStorage.setItem('quran_streak', JSON.stringify({ streak: 5 }));
    localStorage.setItem('quran_settings', JSON.stringify({ dailyLimit: 50 }));

    var data = exportLocalData();
    assert.ok(data.srsData !== undefined, 'should include srsData');
    assert.ok(data.favorites !== undefined, 'should include favorites');
    assert.ok(data.streak !== undefined, 'should include streak');
    assert.ok(data.settings !== undefined, 'should include settings');
    assert.ok(data._exportedAt !== undefined, 'should include timestamp');
    assert.strictEqual(data.srsData.w1.stage, 3);
    assert.strictEqual(data.streak.streak, 5);
  });

  test('exportLocalData handles empty localStorage', function() {
    clearStorage();
    var data = exportLocalData();
    assert.ok(typeof data === 'object');
    assert.ok(data._exportedAt !== undefined);
    // No keys should be present
    assert.strictEqual(data.srsData, undefined);
  });

  test('exportLocalData skips corrupted JSON gracefully', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', '{bad json');
    var data = exportLocalData();
    assert.ok(data._exportedAt !== undefined, 'should not crash');
    assert.strictEqual(data.srsData, undefined, 'should skip corrupted data');
  });

  test('exports all known data keys', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', '{}');
    localStorage.setItem('quran_favorites', '{}');
    localStorage.setItem('quran_notes', '{}');
    localStorage.setItem('quran_streak', '{}');
    localStorage.setItem('quran_quiz', '{}');
    localStorage.setItem('quran_settings', '{}');
    localStorage.setItem('quran_lesson_progress', '{}');
    localStorage.setItem('quran_surah_progress', '{}');
    localStorage.setItem('quran_foundation_progress', '{}');
    localStorage.setItem('quran_analytics_history', '{}');
    localStorage.setItem('quran_analytics_achievements', '{}');
    localStorage.setItem('quran_analytics_sessions', '{}');

    var data = exportLocalData();
    assert.ok(data.srsData !== undefined, 'srsData');
    assert.ok(data.favorites !== undefined, 'favorites');
    assert.ok(data.notes !== undefined, 'notes');
    assert.ok(data.streak !== undefined, 'streak');
    assert.ok(data.quiz !== undefined, 'quiz');
    assert.ok(data.settings !== undefined, 'settings');
    assert.ok(data.lessonProgress !== undefined, 'lessonProgress');
    assert.ok(data.surahProgress !== undefined, 'surahProgress');
    assert.ok(data.foundationProgress !== undefined, 'foundationProgress');
    assert.ok(data.analyticsHistory !== undefined, 'analyticsHistory');
    assert.ok(data.analyticsAchievements !== undefined, 'analyticsAchievements');
    assert.ok(data.analyticsSessions !== undefined, 'analyticsSessions');
  });
});

// ═══════════════════════════════════════════════════════════════
// Sync — importLocalData
// ═══════════════════════════════════════════════════════════════

suite('Sync — importLocalData', function() {
  test('imports data from object into localStorage', function() {
    clearStorage();
    var result = importLocalData({
      srsData: { w1: { stage: 3 } },
      favorites: { w1: true },
      streak: { streak: 10 },
    });
    assert.ok(result.imported.length >= 3, 'should import 3 keys');
    assert.strictEqual(result.skipped.length, 0);
    assert.strictEqual(JSON.parse(localStorage.getItem('quran_srs_data')).w1.stage, 3);
    assert.strictEqual(JSON.parse(localStorage.getItem('quran_streak')).streak, 10);
  });

  test('importLocalData returns error for null input', function() {
    var result = importLocalData(null);
    assert.ok(result.error !== undefined);
  });

  test('importLocalData returns error for non-object input', function() {
    var result = importLocalData('string');
    assert.ok(result.error !== undefined);
  });

  test('importLocalData handles empty object', function() {
    var result = importLocalData({});
    assert.strictEqual(result.imported.length, 0);
    assert.strictEqual(result.skipped.length, 0);
  });

  test('importLocalData skips unknown keys', function() {
    var result = importLocalData({ unknownKey: 'test' });
    assert.strictEqual(result.imported.length, 0);
    assert.strictEqual(result.skipped.length, 0);
  });

  test('import restores all known data keys', function() {
    clearStorage();
    var data = {};
    var mappings = ['srsData','favorites','notes','streak','quiz','settings',
      'lessonProgress','surahProgress','foundationProgress',
      'analyticsHistory','analyticsAchievements','analyticsSessions'];
    mappings.forEach(function(k) { data[k] = {}; });
    data.srsData = { w1: { stage: 3 } };
    data.favorites = { w1: true };
    data.streak = { streak: 7 };

    var result = importLocalData(data);
    assert.ok(result.imported.length >= 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sync — mergeData
// ═══════════════════════════════════════════════════════════════

suite('Sync — mergeData', function() {
  test('returns local when cloud is null', function() {
    var merged = mergeData({ srsData: { w1: { stage: 2 } }, favorites: {} }, null);
    assert.strictEqual(merged.srsData.w1.stage, 2);
  });

  test('returns cloud when local is null', function() {
    var merged = mergeData(null, { srsData: { w1: { stage: 3 } }, favorites: {} });
    assert.strictEqual(merged.srsData.w1.stage, 3);
  });

  test('returns empty object when both null', function() {
    var merged = mergeData(null, null);
    assert.ok(typeof merged === 'object');
  });

  test('SRS merge keeps entry with more reviews (local wins)', function() {
    var local = { srsData: { w1: { stage: 3, totalReviews: 15 } }, favorites: {} };
    var cloud = { srsData: { w1: { stage: 1, totalReviews: 5 } }, favorites: {} };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.srsData.w1.stage, 3);
  });

  test('SRS merge keeps entry with more reviews (cloud wins)', function() {
    var local = { srsData: { w1: { stage: 1, totalReviews: 5 } }, favorites: {} };
    var cloud = { srsData: { w1: { stage: 3, totalReviews: 15 } }, favorites: {} };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.srsData.w1.stage, 3);
  });

  test('SRS merge handles unique keys from both sides', function() {
    var local = { srsData: { w1: { stage: 1 } }, favorites: {} };
    var cloud = { srsData: { w2: { stage: 3 } }, favorites: {} };
    var merged = mergeData(local, cloud);
    assert.ok(merged.srsData.w1 !== undefined);
    assert.ok(merged.srsData.w2 !== undefined);
  });

  test('favorites merge is a union', function() {
    var local = { srsData: {}, favorites: { w1: true, w3: true } };
    var cloud = { srsData: {}, favorites: { w2: true, w3: true } };
    var merged = mergeData(local, cloud);
    assert.ok(merged.favorites.w1, 'local favorite preserved');
    assert.ok(merged.favorites.w2, 'cloud favorite included');
    assert.ok(merged.favorites.w3, 'shared favorite preserved');
    assert.strictEqual(Object.keys(merged.favorites).length, 3);
  });

  test('notes merge prefers local', function() {
    var local = { srsData: {}, notes: { w1: 'local note', w2: 'also local' } };
    var cloud = { srsData: {}, notes: { w1: 'cloud note', w3: 'cloud only' } };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.notes.w1, 'local note', 'local note wins');
    assert.strictEqual(merged.notes.w2, 'also local', 'local-only preserved');
    assert.strictEqual(merged.notes.w3, 'cloud only', 'cloud-only included');
  });

  test('streak keeps the higher value', function() {
    var local = { srsData: {}, streak: { streak: 3, lastDate: '2026-07-05' } };
    var cloud = { srsData: {}, streak: { streak: 7, lastDate: '2026-07-07' } };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.streak.streak, 7);
  });

  test('quiz takes max correct and total', function() {
    var local = { srsData: {}, quiz: { correct: 10, total: 20 } };
    var cloud = { srsData: {}, quiz: { correct: 15, total: 25 } };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.quiz.correct, 15);
    assert.strictEqual(merged.quiz.total, 25);
  });

  test('settings prefers local', function() {
    var local = { srsData: {}, settings: { dailyLimit: 50 } };
    var cloud = { srsData: {}, settings: { dailyLimit: 25 } };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.settings.dailyLimit, 50);
  });

  test('surahProgress takes the one with more completed surahs', function() {
    var local = { srsData: {}, surahProgress: { completedSurahs: [1, 2], quizPassed: {} } };
    var cloud = { srsData: {}, surahProgress: { completedSurahs: [1, 2, 3], quizPassed: {} } };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.surahProgress.completedSurahs.length, 3);
  });

  test('foundationProgress takes the one with more completed lessons', function() {
    var local = { srsData: {}, foundationProgress: { completedLessons: ['l1', 'l2', 'l3'] } };
    var cloud = { srsData: {}, foundationProgress: { completedLessons: ['l1'] } };
    var merged = mergeData(local, cloud);
    assert.strictEqual(merged.foundationProgress.completedLessons.length, 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// User Service — mergeSettings
// ═══════════════════════════════════════════════════════════════

suite('User Service — mergeSettings', function() {
  test('returns defaults when saved is null', function() {
    var merged = mergeSettings(null);
    assert.strictEqual(merged.dailyLimit, 25);
    assert.strictEqual(merged.sessionSize, 20);
    assert.strictEqual(merged.autoImport, true);
  });

  test('returns defaults when saved is not an object', function() {
    var merged = mergeSettings('invalid');
    assert.strictEqual(merged.dailyLimit, 25);
  });

  test('saved values override defaults', function() {
    var merged = mergeSettings({ dailyLimit: 50, sessionSize: 15 });
    assert.strictEqual(merged.dailyLimit, 50);
    assert.strictEqual(merged.sessionSize, 15);
    assert.strictEqual(merged.autoImport, true);
  });

  test('partial saved does not override unspecified defaults', function() {
    var merged = mergeSettings({ dailyLimit: 100 });
    assert.strictEqual(merged.dailyLimit, 100);
    assert.strictEqual(merged.sessionSize, 20);
    assert.strictEqual(merged.autoImport, true);
  });

  test('saved falsey values override defaults', function() {
    var merged = mergeSettings({ autoImport: false });
    assert.strictEqual(merged.autoImport, false);
  });
});

// ═══════════════════════════════════════════════════════════════
// User Service — computeLearningSummary
// ═══════════════════════════════════════════════════════════════

suite('User Service — computeLearningSummary', function() {
  test('returns zeros when SRS functions are missing', function() {
    var summary = computeLearningSummary();
    assert.strictEqual(summary.totalWords, 0);
    assert.strictEqual(summary.wordsMastered, 0);
    assert.strictEqual(summary.totalReviews, 0);
    assert.strictEqual(summary.streak, 0);
    assert.strictEqual(summary.averageRetention, 0);
  });

  test('uses real getSRSStats when available', function() {
    global.getSRSStats = function() {
      return { total: 50, mature: 20, totalReviews: 150, avgRetention: 0.85 };
    };
    global.loadStreakData = function() {
      return { streak: 10 };
    };
    var summary = computeLearningSummary();
    assert.strictEqual(summary.totalWords, 50);
    assert.strictEqual(summary.wordsMastered, 20);
    assert.strictEqual(summary.totalReviews, 150);
    assert.strictEqual(summary.streak, 10);
    assert.strictEqual(summary.averageRetention, 0.85);

    // Cleanup
    delete global.getSRSStats;
    delete global.loadStreakData;
  });

  test('handles getSRSStats returning undefined fields', function() {
    global.getSRSStats = function() { return { }; };
    global.loadStreakData = function() { return { }; };
    var summary = computeLearningSummary();
    assert.strictEqual(summary.totalWords, 0);
    assert.strictEqual(summary.wordsMastered, 0);
    assert.strictEqual(summary.streak, 0);
    delete global.getSRSStats;
    delete global.loadStreakData;
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exitCode = failed > 0 ? 1 : 0;
