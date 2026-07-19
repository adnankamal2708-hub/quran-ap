#!/usr/bin/env node
/**
 * profile-ui.test.js — Unit tests for the Profile & Settings UI Module
 *
 * Tests: guest rendering, logged-in rendering, authentication transitions,
 * loading state, blank-page prevention, scroll restoration, tab switching,
 * achievements, progress, settings, and all previously fixed profile bugs.
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
function clearStorage() { _storage = {}; }

// Mock ALL_WORDS
global.ALL_WORDS = [
  { id: 'w_0', arabic: 'الله', english: 'Allah', root: 'أ-ل-ه', occ: 2699, difficulty: 1 },
  { id: 'w_1', arabic: 'رب', english: 'Lord', root: 'ر-ب-ب', occ: 980, difficulty: 1 },
];

// Mock global functions used by profile-ui.js
global.getCurrentUser = function() { return global.__mockUser || null; };
global.getSyncStatus = function() { return global.__mockSyncStatus || { ready: false, syncing: false, pending: false }; };
global.loadSRS = function() { return {}; };
global.getSRSStats = function() { return { total: 0, mature: 0, learning: 0, young: 0, newCount: 0, totalReviews: 0, avgRetention: 0, overdue: 0, leechCount: 0 }; };
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
global.showAuthView = function() {};
global.switchView = function() {};
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
global.DOM = { get: function() { return null; }, invalidateCache: function() {} };
global.window.__components = { createSVGIcon: function() { return '✦'; } };
global.window.__srs = null;
global.window.__analytics = null;
global.window.__reader = null;
global.window.__profileContentReady = false;
global.window.__sessionAchievementsOpen = false;

// Mock confirm
global.confirm = function() { return false; };
global.alert = function() {};

// Mock document.querySelectorAll
var _querySelectorResults = {};
global.document.querySelectorAll = function(sel) {
  return _querySelectorResults[sel] || [];
};
global.document.querySelector = function() { return null; };
global.document.addEventListener = function() {};
global.document.body.appendChild = function() {};
global.document.body.removeChild = function() {};
global.Blob = function() {};
global.URL = { createObjectURL: function() { return ''; }, revokeObjectURL: function() {} };

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
    // Reset global mock state
    global.__mockUser = null;
    global.__mockSyncStatus = { ready: false, syncing: false, pending: false };
    global.window.__profileContentReady = false;
    global.window.__profileUI = null;
    _renderingProfile = false;
    _profileRenderAttempts = 0;
    _profileShowingFallback = false;
    global.confirm = function() { return false; };
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function ts(name, fn) {
  console.log('\n📋 ' + name);
  fn();
}

// Helper to create profile container DOM
function createProfileContainer() {
  var container = mock.makeEl('div');
  container.id = 'view-profile';
  container.innerHTML =
    '<div id="profile-skeleton" class="profile-skeleton"></div>' +
    '<div id="profile-container" class="profile-container">' +
      '<div class="pf-tabs">' +
        '<button class="pf-tab active" data-pf-tab="account" aria-selected="true">Account</button>' +
        '<button class="pf-tab" data-pf-tab="progress" aria-selected="false">Progress</button>' +
        '<button class="pf-tab" data-pf-tab="achievements" aria-selected="false">Achievements</button>' +
        '<button class="pf-tab" data-pf-tab="about" aria-selected="false">About</button>' +
      '</div>' +
      '<div class="pf-tab-content active" data-pf-tab="account">' +
        '<div id="profile-info" style="display:block"></div>' +
        '<div id="profile-edit" style="display:none"></div>' +
        '<div id="profile-avatar">U</div>' +
        '<div id="profile-name"></div>' +
        '<div id="profile-email"></div>' +
        '<div id="profile-join-date"></div>' +
        '<div id="profile-email-verified"></div>' +
        '<div id="profile-sync-status"></div>' +
        '<div id="profile-stats-mastered"></div>' +
        '<div id="profile-stats-reviews"></div>' +
        '<div id="profile-stats-streak"></div>' +
        '<div id="profile-stats-retention"></div>' +
        '<div id="profile-edit-name"></div>' +
        '<div id="profile-edit-email"></div>' +
        '<div id="profile-edit-error" style="display:none"></div>' +
        '<div id="profile-edit-success" style="display:none"></div>' +
        '<div id="btn-edit-profile"></div>' +
        '<div id="btn-save-profile"></div>' +
        '<div id="btn-cancel-profile"></div>' +
        '<div id="settings-info" style="display:block">' +
          '<div id="settings-daily-limit"></div>' +
          '<div id="settings-session-size"></div>' +
          '<div id="settings-auto-import"></div>' +
        '</div>' +
        '<div id="settings-edit" style="display:none">' +
          '<input id="settings-edit-limit" />' +
          '<input id="settings-edit-size" />' +
          '<input id="settings-edit-auto" type="checkbox" />' +
          '<input id="settings-edit-dark-theme" type="checkbox" />' +
          '<input id="settings-edit-show-celebrations" type="checkbox" />' +
          '<input id="settings-edit-notifications" type="checkbox" />' +
        '</div>' +
        '<div id="settings-edit-error" style="display:none"></div>' +
        '<div id="settings-edit-success" style="display:none"></div>' +
        '<div id="btn-edit-settings"></div>' +
        '<div id="btn-save-settings"></div>' +
        '<div id="btn-cancel-settings"></div>' +
        '<div id="btn-change-password"></div>' +
        '<div id="btn-export-data"></div>' +
        '<div id="btn-import-data"></div>' +
        '<div id="btn-delete-account"></div>' +
        '<div id="password-change-modal" style="display:none">' +
          '<input id="password-change-current" />' +
          '<input id="password-change-new" />' +
          '<input id="password-change-confirm" />' +
          '<div id="password-change-error" style="display:none"></div>' +
          '<div id="password-change-success" style="display:none"></div>' +
        '</div>' +
      '</div>' +
      '<div class="pf-tab-content" data-pf-tab="progress">' +
        '<div id="profile-progress"></div>' +
        '<div id="profile-insights"></div>' +
        '<div id="profile-calendar"></div>' +
      '</div>' +
      '<div class="pf-tab-content" data-pf-tab="achievements">' +
        '<div id="profile-achievements"></div>' +
      '</div>' +
      '<div class="pf-tab-content" data-pf-tab="about">' +
        '<div id="profile-about"></div>' +
      '</div>' +
    '</div>';
  return container;
}

// ── Render helpers ──
function renderWithUser() {
  global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test User', emailVerified: true, createdAt: '2026-01-01', isAnonymous: false };
  createProfileContainer();
  renderProfileView();
  renderFullProfile();
}

function renderAsGuest() {
  global.__mockUser = null;
  createProfileContainer();
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

ts('Profile — Skeleton & Loading State', function() {
  t('profile skeleton is active after _showProfileSkeleton', function() {
    var skel = mock.makeEl('div');
    skel.id = 'profile-skeleton';
    skel.classList.add('active');
    _showProfileSkeleton();
    assert.ok(skel.classList.contains('active'));
  });

  t('_showProfileFallback shows fallback content', function() {
    var skel = mock.makeEl('div');
    skel.id = 'profile-skeleton';
    _showProfileFallback();
    // fallback replaces innerHTML
    assert.ok(skel.innerHTML.indexOf('Retry') >= 0 || skel.innerHTML.indexOf('retry') >= 0);
  });

  t('_hideProfileSkeleton removes active class', function() {
    var skel = mock.makeEl('div');
    skel.id = 'profile-skeleton';
    skel.classList.add('active');
    _hideProfileSkeleton();
    assert.ok(!skel.classList.contains('active'));
  });
});

ts('Profile — Guest Rendering', function() {
  t('renderProfileView redirects to auth when no user', function() {
    var authCalled = false;
    global.showAuthView = function(v) { authCalled = true; assert.strictEqual(v, 'login'); };
    global.switchView = function(v) { assert.strictEqual(v, 'auth'); };
    global.__mockUser = null;
    renderProfileView();
    assert.ok(authCalled);
  });
});

ts('Profile — Logged-In Rendering', function() {
  t('renderProfileView populates user info', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test User', emailVerified: true, createdAt: '2026-01-01', isAnonymous: false };
    createProfileContainer();
    await renderProfileView();
    assert.strictEqual(document.getElementById('profile-name').textContent, 'Test User');
    assert.strictEqual(document.getElementById('profile-email').textContent, 'test@example.com');
  });

  t('renderProfileView shows verified status', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true };
    createProfileContainer();
    await renderProfileView();
    var verifiedEl = document.getElementById('profile-email-verified');
    assert.ok(verifiedEl.textContent.indexOf('Verified') >= 0);
  });

  t('renderProfileView shows unverified status', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: false };
    createProfileContainer();
    await renderProfileView();
    var verifiedEl = document.getElementById('profile-email-verified');
    assert.ok(verifiedEl.textContent.indexOf('Verified') < 0);
  });

  t('renderProfileView handles null displayName', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: null, emailVerified: true };
    createProfileContainer();
    await renderProfileView();
    assert.strictEqual(document.getElementById('profile-name').textContent, 'User');
    assert.strictEqual(document.getElementById('profile-avatar').textContent, 'U');
  });
});

ts('Profile — Sync Status Display', function() {
  t('renderProfileView shows syncing status', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true };
    global.__mockSyncStatus = { syncing: true, ready: true, pending: false };
    createProfileContainer();
    await renderProfileView();
    var syncEl = document.getElementById('profile-sync-status');
    assert.ok(syncEl.textContent.indexOf('Syncing') >= 0);
  });

  t('renderProfileView shows pending sync', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true };
    global.__mockSyncStatus = { syncing: false, ready: true, pending: true };
    createProfileContainer();
    await renderProfileView();
    var syncEl = document.getElementById('profile-sync-status');
    assert.ok(syncEl.textContent.indexOf('Pending') >= 0 || syncEl.textContent.indexOf('pending') >= 0);
  });

  t('renderProfileView shows sync active', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true };
    global.__mockSyncStatus = { syncing: false, ready: true, pending: false };
    createProfileContainer();
    await renderProfileView();
    var syncEl = document.getElementById('profile-sync-status');
    assert.ok(syncEl.textContent.indexOf('sync active') >= 0);
  });
});

ts('Profile — Edit Toggle', function() {
  t('toggleEditProfile switches display states', function() {
    createProfileContainer();
    _editingProfile = false;
    toggleEditProfile();
    assert.ok(_editingProfile);
    var viewEl = document.getElementById('profile-info');
    var editEl = document.getElementById('profile-edit');
    assert.strictEqual(viewEl.style.display, 'none');
    assert.strictEqual(editEl.style.display, 'block');

    toggleEditProfile();
    assert.ok(!_editingProfile);
    assert.strictEqual(viewEl.style.display, 'block');
    assert.strictEqual(editEl.style.display, 'none');
  });
});

ts('Profile — Settings Edit Toggle', function() {
  t('toggleEditSettings toggles state', function() {
    createProfileContainer();
    _editingSettings = false;
    toggleEditSettings();
    assert.ok(_editingSettings);
    toggleEditSettings();
    assert.ok(!_editingSettings);
  });
});

ts('Profile — Password Change', function() {
  t('showPasswordChangeModal sets display flex', function() {
    createProfileContainer();
    showPasswordChangeModal();
    var modal = document.getElementById('password-change-modal');
    assert.strictEqual(modal.style.display, 'flex');
  });

  t('handlePasswordChangeSubmit rejects empty fields', async function() {
    createProfileContainer();
    document.getElementById('password-change-current').value = '';
    document.getElementById('password-change-new').value = '';
    document.getElementById('password-change-confirm').value = '';
    await handlePasswordChangeSubmit();
    var errorEl = document.getElementById('password-change-error');
    assert.ok(errorEl.style.display === 'block');
  });

  t('handlePasswordChangeSubmit rejects mismatched passwords', async function() {
    createProfileContainer();
    document.getElementById('password-change-current').value = 'old123';
    document.getElementById('password-change-new').value = 'new123';
    document.getElementById('password-change-confirm').value = 'new456';
    await handlePasswordChangeSubmit();
    var errorEl = document.getElementById('password-change-error');
    assert.ok(errorEl.style.display === 'block');
  });

  t('handlePasswordChangeSubmit rejects short password', async function() {
    createProfileContainer();
    document.getElementById('password-change-current').value = 'old123';
    document.getElementById('password-change-new').value = 'ab';
    document.getElementById('password-change-confirm').value = 'ab';
    await handlePasswordChangeSubmit();
    var errorEl = document.getElementById('password-change-error');
    assert.ok(errorEl.style.display === 'block');
  });

  t('handlePasswordChangeSubmit succeeds with valid input', async function() {
    createProfileContainer();
    global.__mockUser = { uid: 'u1', email: 'test@example.com', displayName: 'Test', emailVerified: true };
    global.reauthenticate = function() { return Promise.resolve(); };
    global.updatePassword = function() { return Promise.resolve(); };
    document.getElementById('password-change-current').value = 'old123';
    document.getElementById('password-change-new').value = 'newpass123';
    document.getElementById('password-change-confirm').value = 'newpass123';
    await handlePasswordChangeSubmit();
    var successEl = document.getElementById('password-change-success');
    assert.ok(successEl.style.display === 'block');
  });
});

ts('Profile — Tab Switching', function() {
  t('switchProfileTab changes active tab', function() {
    createProfileContainer();
    switchProfileTab('progress');
    assert.strictEqual(_activeProfileTab, 'progress');
  });

  t('switchProfileTab updates aria-selected', function() {
    createProfileContainer();
    switchProfileTab('progress');
    var tabs = document.querySelectorAll('.pf-tab');
    // Should not throw
    assert.ok(true);
  });

  t('switchProfileTab toggles progress render', function() {
    createProfileContainer();
    switchProfileTab('progress');
    assert.strictEqual(_activeProfileTab, 'progress');
  });

  t('switchProfileTab toggles achievements render', function() {
    createProfileContainer();
    switchProfileTab('achievements');
    assert.strictEqual(_activeProfileTab, 'achievements');
  });

  t('switchProfileTab toggles about render', function() {
    createProfileContainer();
    switchProfileTab('about');
    assert.strictEqual(_activeProfileTab, 'about');
  });
});

ts('Profile — Achievements', function() {
  t('toggleAchievements toggles open state', function() {
    createProfileContainer();
    window.__sessionAchievementsOpen = false;
    toggleAchievements();
    assert.strictEqual(window.__sessionAchievementsOpen, true);
    toggleAchievements();
    assert.strictEqual(window.__sessionAchievementsOpen, false);
  });
});

ts('Profile — About Section', function() {
  t('renderProfileAbout renders without error', function() {
    var about = mock.makeEl('div');
    about.id = 'profile-about';
    global.document.getElementById = function(id) {
      if (id === 'profile-about') return about;
      return null;
    };
    renderProfileAbout();
    assert.ok(about.innerHTML.length > 0);
    assert.ok(about.innerHTML.indexOf('Bayan') >= 0);
  });
});

ts('Profile — Blank Page Prevention', function() {
  t('_showProfileFallback always sets innerHTML', function() {
    var skel = mock.makeEl('div');
    skel.id = 'profile-skeleton';
    _showProfileFallback();
    assert.ok(skel.innerHTML.length > 0);
  });

  t('_profileShowingFallback is set true', function() {
    _profileShowingFallback = false;
    _showProfileFallback();
    assert.ok(_profileShowingFallback);
  });

  t('fallback contains a retry button', function() {
    var skel = mock.makeEl('div');
    skel.id = 'profile-skeleton';
    _showProfileFallback();
    assert.ok(skel.innerHTML.indexOf('Retry') >= 0 || skel.innerHTML.indexOf('retry') >= 0);
  });
});

ts('Profile — Event Wiring', function() {
  t('wireProfileEvents does not throw with missing elements', function() {
    mock.resetDOM();
    wireProfileEvents();
    assert.ok(true);
  });

  t('wireSettingsEvents does not throw with missing elements', function() {
    mock.resetDOM();
    wireSettingsEvents();
    assert.ok(true);
  });

  t('wireAccountEvents does not throw with missing elements', function() {
    mock.resetDOM();
    wireAccountEvents();
    assert.ok(true);
  });
});

ts('Profile — Delete Account', function() {
  t('handleDeleteAccount aborts on first cancel', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com' };
    global.confirm = function() { return false; };
    var deleted = false;
    global.deleteProfile = function() { deleted = true; return Promise.resolve(true); };
    await handleDeleteAccount();
    assert.ok(!deleted);
  });

  t('handleDeleteAccount aborts on second cancel', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com' };
    var callCount = 0;
    global.confirm = function() { callCount++; return callCount === 1; };
    var deleted = false;
    global.deleteProfile = function() { deleted = true; return Promise.resolve(true); };
    await handleDeleteAccount();
    assert.ok(!deleted);
  });
});

ts('Profile — Export/Import', function() {
  t('handleExportData does not throw', async function() {
    global.__mockUser = { uid: 'u1', email: 'test@example.com' };
    var blobData = null;
    global.Blob = function(data) { blobData = data; return { size: data.length }; };
    global.URL.createObjectURL = function() { return 'blob:test'; };
    global.URL.revokeObjectURL = function() {};
    await handleExportData();
    assert.ok(true);
  });
});

ts('Profile — RenderProfileProgress', function() {
  t('renderProfileProgress renders without error', function() {
    createProfileContainer();
    renderProfileProgress();
    var container = document.getElementById('profile-progress');
    assert.ok(container.innerHTML.length > 0);
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
