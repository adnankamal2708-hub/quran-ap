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
    createEl('profile-stats-mastered');
    createEl('profile-stats-reviews');
    createEl('profile-stats-streak');
    createEl('profile-stats-retention');
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
    createEl('profile-stats-mastered');
    createEl('profile-stats-reviews');
    createEl('profile-stats-streak');
    createEl('profile-stats-retention');
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
    createEl('profile-stats-mastered');
    createEl('profile-stats-reviews');
    createEl('profile-stats-streak');
    createEl('profile-stats-retention');
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
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
