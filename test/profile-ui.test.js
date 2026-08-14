#!/usr/bin/env node
/**
 * profile-ui.test.js — Unit tests for the Profile & Settings UI Module
 *
 * Tests: guest rendering, logged-in rendering, authentication transitions,
 * loading state, blank-page prevention, tab switching, achievements,
 * progress, settings, and all previously fixed profile bugs.
 *
 * Run: node test/profile-ui.test.js
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

global.ALL_WORDS = [
  { id: 'w_0', arabic: 'الله', english: 'Allah', root: 'أ-ل-ه', occ: 2699, difficulty: 1 },
  { id: 'w_1', arabic: 'رب', english: 'Lord', root: 'ر-ب-ب', occ: 980, difficulty: 1 },
];

// Global mock functions
global.getCurrentUser = function() { return global.__mockUser || null; };
global.getSyncStatus = function() { return global.__mockSyncStatus || { ready: false, syncing: false, pending: false }; };
global.loadSRS = function() { return {}; };
global.getSRSStats = function() { return { total: 0, mature: 0, learning: 0, young: 0, newCount: 0, totalReviews: 0, avgRetention: 0, avgEaseFactor: 2.5, overdue: 0, leechCount: 0, reviewsToday: 0 }; };
global.loadStreakData = function() { return { streak: 0, lastDate: null }; };
global.computeLearningSummary = function() { return { totalWords: 0, wordsMastered: 0, totalReviews: 0, streak: 0, averageRetention: 0 }; };
global.loadProfile = function() { return Promise.resolve(null); };
global.saveProfile = function() { return Promise.resolve(true); };
global.mergeSettings = function(s) { return s || { dailyReviewLimit: 25, sessionSize: 20, autoImportOnLogin: true }; };
global.getDefaultSettings = function() { return { dailyReviewLimit: 25, sessionSize: 20, autoImportOnLogin: true }; };
global.getFoundationLessonCount = function() { return 10; };
global.getCompletedFoundationLessonCount = function() { return 0; };
global.calculateCoverage = function() { return { coveragePercent: 0, estimatedComprehension: 0, masteredWords: 0, totalWords: 0, masteredOccurrences: 0, totalOccurrences: 0, wordMasteryPercent: 0 }; };
global.getFoundationCoverage = function() { return { foundationCoveragePercent: 0, foundationProgressPercent: 0 }; };
global.getSurahsWithVocabulary = function() { return [1, 36]; };
global.getAllSurahComprehension = function() { return []; };
global.getCompletedSurahCount = function() { return 0; };
global.getTotalRootFamilyCount = function() { return 0; };
global.getCompletedRootFamilyCount = function() { return 0; };
global.getRootFamilyMastery = function() { return null; };
global.loadQuizHistory = function() { return null; };
global.getMilestoneStatus = function() { return { currentMilestone: null, nextMilestone: { icon: '⭐', label: 'Test', pct: 5 }, wordsToNextMilestone: 50, lessonsToNextMilestone: 5 }; };
global.showAuthView = function(v) { global.__lastAuthView = v; };
global.switchView = function(v) { global.__lastView = v; };
global.trapFocus = function() {};
global.closePasswordModal = function() {};
global.reauthenticate = function() { return Promise.resolve(); };
global.updatePassword = function() { return Promise.resolve(); };
global.updateDisplayName = function() { return Promise.resolve(); };
global.updateEmail = function() { return Promise.resolve(); };
global.deleteProfile = function() { return Promise.resolve(true); };
global.deleteAccount = function() { return Promise.resolve(); };
global.exportAccountData = function() { return Promise.resolve({}); };
global.exportLocalData = function() { return {}; };
global.importLocalData = function() { return { imported: [], skipped: [] }; };
global.getSurahInfo = function(id) { var info = { 1: { name: 'Al-Fatiha', verses: 7 }, 36: { name: 'Ya-Seen', verses: 83 } }; return info[id] || null; };
global.SURAH_INFO = { 1: { name: 'Al-Fatiha', verses: 7 }, 36: { name: 'Ya-Seen', verses: 83 } };
global.DOM = { get: function(id) { return document.getElementById(id); }, invalidateCache: function() {} };
global.window.__components = { createSVGIcon: function() { return '✦'; } };
global.window.__srs = null;
global.window.__analytics = null;
global.window.__reader = null;
global.window.__profileContentReady = false;
global.window.__sessionAchievementsOpen = false;
// Note: document.querySelector/querySelectorAll are provided by shared-mock.js mockDocument()

// Load the profile UI module
var profileCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'profile-ui.js'), 'utf8');
eval(profileCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function t(name, fn) {
  try {
    mock.resetDOM();
    mock.clearStorage();
    global.__mockUser = null;
    global.__mockSyncStatus = { ready: false, syncing: false, pending: false };
    global.__lastView = null;
    global.__lastAuthView = null;
    global.window.__profileContentReady = false;
    global.window.__sessionAchievementsOpen = false;
    global.confirm = function() { return false; };
    global.alert = function() {};
    // Note: we cannot reset module-level `let` variables from eval'd code
    // (e.g. _editingProfile, _editingSettings) because they're scoped to the eval block.
    // Tests avoid depending on starting module state.
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

function createEl(id) {
  var el = mock.makeEl('div');
  el.id = id;
  return el;
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

ts('Profile — Skeleton & Loading State', function() {
  t('_showProfileSkeleton adds active class to skeleton', function() {
    var skel = createEl('profile-skeleton');
    _showProfileSkeleton();
    assert.ok(skel.classList.contains('active'));
  });

  t('_showProfileFallback populates skeleton HTML', function() {
    var skel = createEl('profile-skeleton');
    _showProfileFallback();
    assert.ok(skel.innerHTML.length > 0);
  });

  t('fallback HTML contains a retry button', function() {
    var skel = createEl('profile-skeleton');
    _showProfileFallback();
    assert.ok(skel.innerHTML.indexOf('Retry') >= 0 || skel.innerHTML.indexOf('retry') >= 0);
  });

  t('_hideProfileSkeleton removes active class', function() {
    var skel = createEl('profile-skeleton');
    skel.classList.add('active');
    _hideProfileSkeleton();
    assert.ok(!skel.classList.contains('active'));
  });
});

ts('Profile — Guest Rendering', function() {
  t('renderProfileView redirects to auth when no user', function() {
    global.__mockUser = null;
    renderProfileView();
    assert.strictEqual(global.__lastAuthView, 'login');
    assert.strictEqual(global.__lastView, 'auth');
  });
});

ts('Profile — Logged-In Rendering', function() {
  t('renderProfileView populates user name and email', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test User', emailVerified: true, createdAt: '2026-01-01', isAnonymous: false };
    createEl('profile-name');
    createEl('profile-email');
    createEl('profile-join-date');
    createEl('profile-avatar');
    createEl('profile-email-verified');
    createEl('profile-sync-status');
    createEl('settings-daily-limit');
    createEl('settings-session-size');
    createEl('settings-auto-import');
    await renderProfileView();
    assert.strictEqual(document.getElementById('profile-name').textContent, 'Test User');
    assert.strictEqual(document.getElementById('profile-email').textContent, 'test@example.com');
    assert.strictEqual(document.getElementById('profile-avatar').textContent, 'T');
  });

  t('renderProfileView shows verified status', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true, createdAt: '2026-01-01', isAnonymous: false };
    createEl('profile-name');
    createEl('profile-email');
    createEl('profile-email-verified');
    createEl('profile-sync-status');
    createEl('profile-avatar');
    createEl('profile-join-date');
    createEl('settings-daily-limit');
    createEl('settings-session-size');
    createEl('settings-auto-import');
    await renderProfileView();
    var ve = document.getElementById('profile-email-verified');
    assert.ok(ve.textContent.indexOf('Verified') >= 0);
  });

  t('renderProfileView handles null displayName', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: null, emailVerified: true, createdAt: '2026-01-01', isAnonymous: false };
    createEl('profile-name');
    createEl('profile-email');
    createEl('profile-avatar');
    createEl('profile-email-verified');
    createEl('profile-sync-status');
    createEl('profile-join-date');
    createEl('settings-daily-limit');
    createEl('settings-session-size');
    createEl('settings-auto-import');
    await renderProfileView();
    assert.strictEqual(document.getElementById('profile-name').textContent, 'User');
    assert.strictEqual(document.getElementById('profile-avatar').textContent, 'U');
  });
});

ts('Profile — Edit Toggle', function() {
  t('toggleEditProfile shows edit section', function() {
    createEl('profile-info');
    createEl('profile-edit');
    createEl('profile-edit-name');
    createEl('profile-edit-email');
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test User', emailVerified: true };
    toggleEditProfile();
    var infoEl = document.getElementById('profile-info');
    var editEl = document.getElementById('profile-edit');
    assert.strictEqual(infoEl.style.display, 'none');
    assert.strictEqual(editEl.style.display, 'block');
  });

  t('toggleEditProfile toggles between view and edit', function() {
    createEl('profile-info');
    createEl('profile-edit');
    createEl('profile-edit-name');
    createEl('profile-edit-email');
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test User', emailVerified: true };
    
    // Capture state after first toggle (starting state is unknown due to eval scoping)
    toggleEditProfile();
    var infoEl = document.getElementById('profile-info');
    var editEl = document.getElementById('profile-edit');
    var infoState1 = infoEl.style.display;
    var editState1 = editEl.style.display;
    
    // After one toggle, view and edit must have opposite display values
    assert.notStrictEqual(infoState1, editState1, 'view and edit should be opposite after one toggle');
    
    // Second toggle flips both
    toggleEditProfile();
    var infoState2 = infoEl.style.display;
    var editState2 = editEl.style.display;
    assert.notStrictEqual(infoState2, editState2, 'view and edit should be opposite after two toggles');
    
    // After two toggles, the display values should be flipped from first state
    assert.strictEqual(infoState1, editState2, 'info after first toggle should equal edit after second toggle');
    assert.strictEqual(editState1, infoState2, 'edit after first toggle should equal info after second toggle');
  });
});

ts('Profile — Password Change', function() {
  t('showPasswordChangeModal displays modal', function() {
    createEl('password-change-modal');
    createEl('password-change-error');
    createEl('password-change-success');
    createEl('password-change-current');
    createEl('password-change-new');
    createEl('password-change-confirm');
    showPasswordChangeModal();
    assert.strictEqual(document.getElementById('password-change-modal').style.display, 'flex');
  });

  t('handlePasswordChangeSubmit rejects empty fields', async function() {
    createEl('password-change-current');
    createEl('password-change-new');
    createEl('password-change-confirm');
    createEl('password-change-error');
    createEl('password-change-success');
    document.getElementById('password-change-current').value = '';
    document.getElementById('password-change-new').value = '';
    document.getElementById('password-change-confirm').value = '';
    await handlePasswordChangeSubmit();
    var errorEl = document.getElementById('password-change-error');
    assert.strictEqual(errorEl.style.display, 'block');
  });

  t('handlePasswordChangeSubmit rejects mismatched passwords', async function() {
    createEl('password-change-current');
    createEl('password-change-new');
    createEl('password-change-confirm');
    createEl('password-change-error');
    createEl('password-change-success');
    document.getElementById('password-change-current').value = 'old123';
    document.getElementById('password-change-new').value = 'new123';
    document.getElementById('password-change-confirm').value = 'new456';
    await handlePasswordChangeSubmit();
    var errorEl = document.getElementById('password-change-error');
    assert.strictEqual(errorEl.style.display, 'block');
  });

  t('handlePasswordChangeSubmit succeeds with valid input', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true };
    createEl('password-change-current');
    createEl('password-change-new');
    createEl('password-change-confirm');
    createEl('password-change-error');
    createEl('password-change-success');
    document.getElementById('password-change-current').value = 'old123';
    document.getElementById('password-change-new').value = 'newpass123';
    document.getElementById('password-change-confirm').value = 'newpass123';
    await handlePasswordChangeSubmit();
    var successEl = document.getElementById('password-change-success');
    assert.strictEqual(successEl.style.display, 'block');
  });
});

ts('Profile — About Section', function() {
  t('renderProfileAbout renders app name', function() {
    createEl('profile-about');
    renderProfileAbout();
    var about = document.getElementById('profile-about');
    assert.ok(about.innerHTML.indexOf('Bayan') >= 0);
  });
});

ts('Profile — Blank Page Prevention', function() {
  t('_showProfileFallback populates skeleton HTML', function() {
    createEl('profile-skeleton');
    _showProfileFallback();
    var skel = document.getElementById('profile-skeleton');
    assert.ok(skel.innerHTML.length > 0);
  });

  t('fallback HTML contains a retry button', function() {
    createEl('profile-skeleton');
    _showProfileFallback();
    var skel = document.getElementById('profile-skeleton');
    assert.ok(skel.innerHTML.indexOf('Retry') >= 0);
  });
});

ts('Profile — Event Wiring', function() {
  t('wireProfileEvents does not throw', function() {
    wireProfileEvents();
    assert.ok(true);
  });

  t('wireSettingsEvents does not throw', function() {
    wireSettingsEvents();
    assert.ok(true);
  });

  t('wireAccountEvents does not throw', function() {
    wireAccountEvents();
    assert.ok(true);
  });
});

ts('Profile — Delete Account', function() {
  t('handleDeleteAccount aborts on cancel', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com' };
    global.confirm = function() { return false; };
    var deleted = false;
    global.deleteProfile = function() { deleted = true; return Promise.resolve(true); };
    await handleDeleteAccount();
    assert.ok(!deleted);
  });
});

ts('Profile — RenderProfileProgress', function() {
  t('renderProfileProgress populates container', function() {
    createEl('profile-progress');
    renderProfileProgress();
    var container = document.getElementById('profile-progress');
    assert.ok(container.innerHTML.length > 0);
  });
});

ts('Profile — Progress: Lowest Comprehension gating', function() {
  var _origComp = global.getAllSurahComprehension;
  var _origInfo = global.getSurahInfo;

  // Build surah comprehension data: first `studied` surahs have real
  // (non-zero) progress, the rest are untouched at 0%.
  function makeComp(studied, total) {
    var out = [];
    for (var i = 1; i <= total; i++) {
      out.push({
        surahId: i,
        masteredWords: i <= studied ? 5 : 0,
        estimatedComprehension: i <= studied ? Math.round((i / total) * 40) : 0,
      });
    }
    return out;
  }

  t('hidden when fewer than 5 surahs have real progress', function() {
    createEl('profile-progress');
    global.getAllSurahComprehension = function() { return makeComp(3, 8); };
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('Lowest comprehension') < 0, 'list hidden below threshold');
  });

  t('shown once 5+ surahs have real progress', function() {
    createEl('profile-progress');
    global.getAllSurahComprehension = function() { return makeComp(6, 6); };
    global.getSurahInfo = function(id) { return { name: 'Surah ' + id }; };
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('Lowest comprehension') >= 0, 'list visible at/above threshold');
    assert.ok(html.indexOf('Surah 1') >= 0, 'lowest surah listed first');
  });

  t('untouched 0% surahs are excluded even above threshold', function() {
    createEl('profile-progress');
    global.getAllSurahComprehension = function() { return makeComp(5, 6); };
    global.getSurahInfo = function(id) { return { name: 'Surah ' + id }; };
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('Lowest comprehension') >= 0, 'list visible (5 studied)');
    assert.ok(html.indexOf('Surah 6') < 0, '0% surah excluded from list');
  });

  global.getAllSurahComprehension = _origComp;
  global.getSurahInfo = _origInfo;
});

ts('Profile — Progress: visual elements', function() {
  var _origStats = global.getSRSStats;

  function withReviews(n) {
    global.getSRSStats = function() {
      return { total: n, mature: 3, learning: 1, young: 1, newCount: 0, totalReviews: n, avgRetention: 42, avgEaseFactor: 2.5, overdue: 0, leechCount: 0, reviewsToday: 0 };
    };
  }

  t('segmented stage bar or hint + legend render', function() {
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('profile-stage-bar') >= 0 || html.indexOf('profile-stage-hint') >= 0, 'stage bar or hint present');
    assert.ok(html.indexOf('profile-stage-legend') >= 0, 'legend present');
    assert.ok(html.indexOf('profile-stage-dot') >= 0, 'legend dots present');
  });

  t('gradient bar fills and forecast indicators render (with 5+ reviews)', function() {
    withReviews(12);
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('profile-bar-fill profile-fill-gold') >= 0, 'foundation bar uses gold fill');
    assert.ok(html.indexOf('profile-fill-blue') >= 0, 'surah bar uses blue fill');
    assert.ok(html.indexOf('profile-fill-purple') >= 0, 'root bar uses purple fill');
    assert.ok(html.indexOf('profile-forecast-dot') >= 0, 'forecast dots present');
    assert.ok(html.indexOf('SRS Health') >= 0, 'SRS Health shown with 5+ reviews');
    global.getSRSStats = _origStats;
  });
});

ts('Profile — Progress: zero-data gating (new user)', function() {
  var _origStats = global.getSRSStats;
  var _origCoverage = global.calculateCoverage;

  // Force zero data explicitly
  global.getSRSStats = function() { return { total: 0, mature: 0, learning: 0, young: 0, newCount: 0, totalReviews: 0, avgRetention: 0, avgEaseFactor: 2.5, overdue: 0, leechCount: 0, reviewsToday: 0 }; };
  global.calculateCoverage = function() { return { coveragePercent: 0, estimatedComprehension: 0, masteredWords: 0, totalWords: 0, masteredOccurrences: 0, totalOccurrences: 0, wordMasteryPercent: 0 }; };

  t('comprehension & avg retention cells hidden at zero reviews', function() {
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('Quran Comprehension') < 0, 'comprehension cell hidden at zero reviews');
    assert.ok(html.indexOf('Avg Retention') < 0, 'avg retention cell hidden at zero reviews');
    assert.ok(html.indexOf('Words Mastered') >= 0, 'mastered count stays (informative zero)');
    assert.ok(html.indexOf('Total Reviews') >= 0, 'total reviews stays (informative zero)');
    assert.ok(html.indexOf('Streak (days)') >= 0, 'streak stays (informative zero)');
  });

  t('SRS Health hidden at zero reviews', function() {
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('SRS Health') < 0, 'SRS Health hidden for new user');
    assert.ok(html.indexOf('Avg Ease') < 0, 'raw Avg Ease parameter hidden for new user');
  });

  t('Review Forecast hidden at zero reviews', function() {
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('Review Forecast') < 0, 'forecast hidden for new user');
    assert.ok(html.indexOf('profile-forecast-dot') < 0, 'no forecast dots for new user');
  });

  t('sections render with full data for returning user (5+ reviews)', function() {
    global.getSRSStats = function() { return { total: 12, mature: 5, learning: 2, young: 2, newCount: 0, totalReviews: 12, avgRetention: 58, avgEaseFactor: 2.5, overdue: 1, leechCount: 0, reviewsToday: 3 }; };
    global.calculateCoverage = function() { return { coveragePercent: 14, estimatedComprehension: 18, masteredWords: 5, totalWords: 1207, masteredOccurrences: 100, totalOccurrences: 1000, wordMasteryPercent: 10 }; };
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    assert.ok(html.indexOf('Quran Comprehension') >= 0, 'comprehension cell shown with 5+ reviews');
    assert.ok(html.indexOf('Avg Retention') >= 0, 'avg retention cell shown with 5+ reviews');
    assert.ok(html.indexOf('18%') >= 0, 'real comprehension value shown');
    assert.ok(html.indexOf('SRS Health') >= 0, 'SRS Health shown with 5+ reviews');
    assert.ok(html.indexOf('Review Forecast') >= 0, 'forecast shown with 5+ reviews');
  });

  global.getSRSStats = _origStats;
  global.calculateCoverage = _origCoverage;
});

ts('Profile — Sync status de-emphasis (new user vs returning)', function() {
  var _origSummary = global.computeLearningSummary;
  var _origPremium = global.window.__premium;

  function setupSyncEl() {
    createEl('profile-sync-status');
    createEl('profile-name');
    createEl('profile-email');
    createEl('profile-join-date');
    createEl('profile-avatar');
    createEl('profile-premium-badge');
    createEl('profile-learner-stage');
    createEl('profile-email-verified');
    createEl('settings-daily-limit');
    createEl('settings-session-size');
    createEl('settings-auto-import');
  }

  t('zero-data free user sees muted Cloud sync line, no Upgrade link', async function() {
    global.__mockUser = { uid: 'u1', email: 'a@b.c', displayName: 'T', emailVerified: true, createdAt: '2026-01-01' };
    global.computeLearningSummary = function() { return { totalWords: 0, wordsMastered: 0, totalReviews: 0, streak: 0, averageRetention: 0 }; };
    global.window.__premium = { isPremium: function() { return false; }, requestUpgrade: function() {} };
    global.__mockSyncStatus = { ready: true, syncing: false, pending: false };
    setupSyncEl();
    await renderProfileView();
    var el = document.getElementById('profile-sync-status');
    assert.ok(el.textContent.indexOf('Upgrade') < 0, 'no Upgrade link at zero data');
    assert.ok(el.textContent.indexOf('Cloud sync') >= 0, 'muted Cloud sync line present');
    assert.ok(document.getElementById('sync-upgrade-link') === null, 'no upgrade anchor created');
  });

  t('free user WITH data sees the Upgrade messaging (real news)', async function() {
    global.__mockUser = { uid: 'u1', email: 'a@b.c', displayName: 'T', emailVerified: true, createdAt: '2026-01-01' };
    global.computeLearningSummary = function() { return { totalWords: 10, wordsMastered: 3, totalReviews: 25, streak: 2, averageRetention: 40 }; };
    global.window.__premium = { isPremium: function() { return false; }, requestUpgrade: function() {} };
    global.__mockSyncStatus = { ready: true, syncing: false, pending: false };
    setupSyncEl();
    await renderProfileView();
    var el = document.getElementById('profile-sync-status');
    assert.ok(el.textContent.indexOf('Upgrade') >= 0, 'Upgrade link shown when data exists');
    assert.ok(document.getElementById('sync-upgrade-link') !== null, 'upgrade anchor present');
  });

  t('premium user sees Cloud sync active', async function() {
    global.__mockUser = { uid: 'u1', email: 'a@b.c', displayName: 'T', emailVerified: true, createdAt: '2026-01-01' };
    global.computeLearningSummary = function() { return { totalWords: 0, wordsMastered: 0, totalReviews: 0, streak: 0, averageRetention: 0 }; };
    global.window.__premium = { isPremium: function() { return true; }, requestUpgrade: function() {} };
    global.__mockSyncStatus = { ready: true, syncing: false, pending: false };
    setupSyncEl();
    await renderProfileView();
    var el = document.getElementById('profile-sync-status');
    assert.ok(el.textContent.indexOf('Cloud sync active') >= 0, 'premium sees active sync');
  });

  t('pending sync state still reports real news regardless of data', async function() {
    global.__mockUser = { uid: 'u1', email: 'a@b.c', displayName: 'T', emailVerified: true, createdAt: '2026-01-01' };
    global.computeLearningSummary = function() { return { totalWords: 0, wordsMastered: 0, totalReviews: 0, streak: 0, averageRetention: 0 }; };
    global.window.__premium = { isPremium: function() { return false; }, requestUpgrade: function() {} };
    global.__mockSyncStatus = { ready: true, syncing: false, pending: true };
    setupSyncEl();
    await renderProfileView();
    var el = document.getElementById('profile-sync-status');
    assert.ok(el.textContent.indexOf('Pending sync') >= 0, 'pending state shown');
  });

  global.computeLearningSummary = _origSummary;
  global.window.__premium = _origPremium;
});

ts('Profile — Insights premium leak (free vs advanced)', function() {
  var _origAnalytics = global.window.__analytics;
  var _origPremium = global.window.__premium;

  function insightsData() {
    return {
      profile: {
        strongRoots: [{ root: 'ر-ب-ب', rootMeaning: 'Lord', masteryScore: 90 }],
        weakRoots: [],
      },
      periods: {
        week: { gainMastered: 1, totalReviews: 4, daysActive: 2, avgReviewsPerDay: 2 },
        month: { gainMastered: 3, totalReviews: 12, daysActive: 5 },
        consistency: 40,
      },
      forecasts: { predictedMastered: { '7': 5, '30': 10, '90': 20 } },
    };
  }

  t('free user (no Advanced Insights) sees ONLY the locked panel', function() {
    createEl('profile-insights');
    global.window.__analytics = { getComprehensiveInsights: function() { return insightsData(); } };
    global.window.__premium = {
      FEATURES: { ADVANCED_INSIGHTS: 'advancedInsights' },
      hasFeature: function() { return false; },
    };
    renderProfileInsights();
    var html = document.getElementById('profile-insights').innerHTML;
    assert.ok(html.indexOf('Advanced Insights') >= 0, 'locked panel shown');
    assert.ok(html.indexOf('This Week') < 0, 'weekly summary NOT leaked');
    assert.ok(html.indexOf('This Month') < 0, 'monthly summary NOT leaked');
    assert.ok(html.indexOf('Strongest Roots') < 0, 'root breakdown NOT leaked');
    assert.ok(html.indexOf('Forecasts') < 0, 'forecasts NOT leaked');
    assert.ok(html.indexOf('Upgrade to Premium') >= 0, 'upgrade CTA present');
  });

  t('premium user with Advanced Insights sees full content', function() {
    createEl('profile-insights');
    global.window.__analytics = { getComprehensiveInsights: function() { return insightsData(); } };
    global.window.__premium = {
      FEATURES: { ADVANCED_INSIGHTS: 'advancedInsights' },
      hasFeature: function() { return true; },
    };
    renderProfileInsights();
    var html = document.getElementById('profile-insights').innerHTML;
    assert.ok(html.indexOf('This Week') >= 0, 'weekly summary shown for premium');
    assert.ok(html.indexOf('This Month') >= 0, 'monthly summary shown for premium');
    assert.ok(html.indexOf('Strongest Roots') >= 0, 'root breakdown shown for premium');
    assert.ok(html.indexOf('Upgrade to Premium') < 0, 'no locked panel for premium');
  });

  global.window.__analytics = _origAnalytics;
  global.window.__premium = _origPremium;
});

ts('Profile — Progress tab duplicate stats row removed', function() {
  t('top-level stats row element no longer present in index.html', function() {
    var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(html.indexOf('profile-stats-row') < 0, 'top stats row removed from index.html');
    assert.ok(html.indexOf('profile-stats-mastered') < 0, 'duplicate mastered stat removed');
  });

  t('renderProfileProgress renders the single metrics grid', function() {
    createEl('profile-progress');
    renderProfileProgress();
    var html = document.getElementById('profile-progress').innerHTML;
    var gridCount = (html.match(/profile-progress-grid/g) || []).length;
    assert.strictEqual(gridCount, 1, 'exactly one metrics grid renders');
  });
});

ts('Profile — Subsection Tab Interactivity (Regression)', function() {
  function buildLayout() {
    var bar = mock.makeEl('div');
    bar.className = 'pf-tab-bar';
    bar.id = 'pf-tab-bar';
    var tabs = {};
    var panels = {};
    ['account', 'progress', 'achievements', 'about'].forEach(function(t) {
      var tab = mock.makeEl('button');
      tab.className = 'pf-tab';
      tab.setAttribute('data-pf-tab', t);
      tab.id = 'pf-tab-' + t;
      bar.appendChild(tab);
      tabs[t] = tab;
      var panel = mock.makeEl('div');
      panel.className = 'pf-tab-content';
      panel.setAttribute('data-pf-tab', t);
      document.body.appendChild(panel);
      panels[t] = panel;
    });
    document.body.appendChild(bar);
    tabs.account.classList.add('active');
    panels.account.classList.add('active');
    return { bar: bar, tabs: tabs, panels: panels };
  }

  t('Progress tab click activates progress panel via delegation', function() {
    _tabEventsWired = false;
    var layout = buildLayout();
    wireProfileTabEvents();
    assert.ok(layout.panels.account.classList.contains('active'));
    layout.tabs.progress.click();
    assert.ok(layout.panels.progress.classList.contains('active'), 'progress panel visible');
    assert.ok(!layout.panels.account.classList.contains('active'), 'account panel hidden');
    assert.ok(layout.tabs.progress.classList.contains('active'), 'progress tab active');
  });

  t('Click on bar background does not switch tab', function() {
    _tabEventsWired = false;
    var layout = buildLayout();
    wireProfileTabEvents();
    layout.bar.click();
    assert.ok(layout.panels.account.classList.contains('active'), 'account unchanged');
  });

  t('Direct switchProfileTab switches panels correctly', function() {
    _tabEventsWired = false;
    var layout = buildLayout();
    wireProfileTabEvents();
    switchProfileTab('progress');
    assert.ok(layout.panels.progress.classList.contains('active'));
    switchProfileTab('achievements');
    assert.ok(layout.panels.achievements.classList.contains('active'));
    switchProfileTab('about');
    assert.ok(layout.panels.about.classList.contains('active'));
    switchProfileTab('account');
    assert.ok(layout.panels.account.classList.contains('active'));
    switchProfileTab('progress');
    assert.ok(layout.panels.progress.classList.contains('active'));
  });
});

// ═══════════════════════════════════════════════════════════════
// DATA EXPORT / IMPORT — live premium gating (regression)
// Premium state is read live at click time so premium users never see a
// stale locked button (previous bug: captured hasFeature() once at init).
// ═══════════════════════════════════════════════════════════════

(function () {
  var premiumReason = null;
  var exportCalled = false;

  function setupExportButtons() {
    var exp = mock.makeEl('button');
    exp.id = 'btn-export-data';
    var imp = mock.makeEl('button');
    imp.id = 'btn-import-data';
    document.body.appendChild(exp);
    document.body.appendChild(imp);
    return { exp: exp, imp: imp };
  }

  function mockPremium(hasExport) {
    premiumReason = null;
    global.window.__premium = {
      FEATURES: { DATA_EXPORT: 'dataExport' },
      hasFeature: function () { return hasExport; },
      requestUpgrade: function (reason) { premiumReason = reason; },
    };
  }

  t('Export/Import locked for free users — routes to upgrade, not export', function () {
    var btns = setupExportButtons();
    mockPremium(false);
    wireAccountEvents();
    _refreshDataExportButtons();
    assert.ok(btns.exp.innerHTML.indexOf('🔒') >= 0, 'export shows locked label');
    assert.ok(btns.imp.innerHTML.indexOf('🔒') >= 0, 'import shows locked label');
    btns.exp.click();
    assert.strictEqual(premiumReason, 'data-export', 'free click routes to requestUpgrade');
    assert.ok(!exportCalled, 'export flow NOT triggered for free user');
  });

  t('Export/Import read LIVE premium state — premium user exports successfully', function () {
    var btns = setupExportButtons();
    mockPremium(true);
    wireAccountEvents();
    _refreshDataExportButtons();
    assert.ok(btns.exp.innerHTML.indexOf('🔒') < 0, 'export label unlocked');
    assert.ok(btns.imp.innerHTML.indexOf('🔒') < 0, 'import label unlocked');
    global.__mockUser = { uid: 'u-1', email: 'a@b.c', displayName: 'T' };
    var origExport = global.exportAccountData;
    global.exportAccountData = function () {
      exportCalled = true;
      // Never resolve — keeps handleExportData suspended so the mock-DOM
      // download step never runs inside the test.
      return new Promise(function () {});
    };
    btns.exp.click();
    assert.ok(exportCalled, 'exportAccountData invoked for premium user');
    global.exportAccountData = origExport;
    global.__mockUser = null;
  });

  t('Refresh helper flips button labels when premium state changes live', function () {
    var btns = setupExportButtons();
    mockPremium(false);
    _refreshDataExportButtons();
    assert.ok(btns.exp.innerHTML.indexOf('🔒') >= 0, 'locked while free');
    mockPremium(true);
    _refreshDataExportButtons();
    assert.ok(btns.exp.innerHTML.indexOf('🔒') < 0, 'unlocked after premium flips');
    assert.ok(btns.imp.innerHTML.indexOf('🔒') < 0, 'import unlocked too');
  });

  global.window.__premium = undefined;
})();

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
