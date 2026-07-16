// ═══════════════════════════════════════════════════════════════
// profile-ui.js — Profile & Settings UI Module
//
// Renders the profile view (name, email, stats, join date),
// settings (daily review limit, session size, auto-import),
// account actions (change password, delete account, export/import).
// ═══════════════════════════════════════════════════════════════

/** @type {boolean} Whether we're editing profile */
let _editingProfile = false;

/** @type {boolean} Whether we're editing settings */
let _editingSettings = false;

// ── Initialization ────────────────────────────────────────────

function initProfileUI() {
  wireProfileEvents();
  wireSettingsEvents();
  wireAccountEvents();
}

// ── Event Wiring ──────────────────────────────────────────────

function wireProfileEvents() {
  // Edit profile button
  var editBtn = document.getElementById('btn-edit-profile');
  if (editBtn) {
    editBtn.onclick = function () {
      toggleEditProfile();
    };
  }

  // Save profile button
  var saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) {
    saveBtn.onclick = function () {
      saveProfileChanges();
    };
  }

  // Cancel edit
  var cancelBtn = document.getElementById('btn-cancel-profile');
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      toggleEditProfile();
    };
  }
}

function wireSettingsEvents() {
  var editBtn = document.getElementById('btn-edit-settings');
  if (editBtn) {
    editBtn.onclick = function () {
      toggleEditSettings();
    };
  }

  var saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.onclick = function () {
      saveSettingsChanges();
    };
  }

  var cancelBtn = document.getElementById('btn-cancel-settings');
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      toggleEditSettings();
    };
  }
}

function wireAccountEvents() {
  // Change password
  var changePwdBtn = document.getElementById('btn-change-password');
  if (changePwdBtn) {
    changePwdBtn.onclick = function () {
      showPasswordChangeModal();
    };
  }

  // Export data
  var exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) {
    exportBtn.onclick = function () {
      handleExportData();
    };
  }

  // Import data
  var importBtn = document.getElementById('btn-import-data');
  if (importBtn) {
    importBtn.onclick = function () {
      handleImportData();
    };
  }

  // Delete account
  var deleteBtn = document.getElementById('btn-delete-account');
  if (deleteBtn) {
    deleteBtn.onclick = function () {
      handleDeleteAccount();
    };
  }

  // Password change form
  var pwdForm = document.getElementById('password-change-form');
  if (pwdForm) {
    pwdForm.onsubmit = function (e) {
      e.preventDefault();
      handlePasswordChangeSubmit();
    };
  }

  var pwdCancel = document.getElementById('btn-cancel-password');
  if (pwdCancel) {
    pwdCancel.onclick = function () {
      document.getElementById('password-change-modal').style.display = 'none';
    };
  }
}

// ── Render Profile View ───────────────────────────────────────

async function renderProfileView() {
  var user = getCurrentUser();
  if (!user) {
    showAuthView('login');
    switchView('auth');
    return;
  }

  var nameEl = document.getElementById('profile-name');
  var emailEl = document.getElementById('profile-email');
  var joinDateEl = document.getElementById('profile-join-date');
  var avatarEl = document.getElementById('profile-avatar');

  if (nameEl) nameEl.textContent = user.displayName || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
  if (joinDateEl) {
    joinDateEl.textContent = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
  }

  if (avatarEl) {
    var initial = (user.displayName || 'U').charAt(0).toUpperCase();
    avatarEl.textContent = initial;
  }

  // Load stats
  var stats = computeLearningSummary && typeof computeLearningSummary === 'function' ? computeLearningSummary() : {};
  // Stats elements — guard against missing DOM (moved to new Profile sections)
  var $pMastered = document.getElementById('profile-stats-mastered');
  if ($pMastered) $pMastered.textContent = stats.wordsMastered || 0;
  var $pReviews = document.getElementById('profile-stats-reviews');
  if ($pReviews) $pReviews.textContent = stats.totalReviews || 0;
  var $pStreak = document.getElementById('profile-stats-streak');
  if ($pStreak) $pStreak.textContent = (stats.streak || 0) + ' days';
  var $pRetention = document.getElementById('profile-stats-retention');
  if ($pRetention) $pRetention.textContent = (stats.averageRetention || 0) + '%';

  // Load profile from server for settings
  var profile = await loadProfile(user.uid);
  if (profile && profile.settings) {
    var settings = mergeSettings(profile.settings);
    document.getElementById('settings-daily-limit').textContent = settings.dailyReviewLimit;
    document.getElementById('settings-session-size').textContent = settings.sessionSize;
    document.getElementById('settings-auto-import').textContent = settings.autoImportOnLogin ? 'On' : 'Off';
  } else {
    var defaults = getDefaultSettings();
    document.getElementById('settings-daily-limit').textContent = defaults.dailyReviewLimit;
    document.getElementById('settings-session-size').textContent = defaults.sessionSize;
    document.getElementById('settings-auto-import').textContent = defaults.autoImportOnLogin ? 'On' : 'Off';
  }

  // Show email verified status
  var verifiedEl = document.getElementById('profile-email-verified');
  if (verifiedEl) {
    if (user.emailVerified) {
      verifiedEl.textContent = '✓ Verified';
      verifiedEl.style.color = 'var(--green)';
    } else {
      verifiedEl.textContent = '⚠ Not verified — check your inbox';
      verifiedEl.style.color = 'var(--red)';
    }
  }

  // Sync status
  var syncStatus = getSyncStatus ? getSyncStatus() : {};
  var syncEl = document.getElementById('profile-sync-status');
  if (syncEl) {
    if (syncStatus.syncing) {
      syncEl.textContent = 'Syncing...';
      syncEl.style.color = 'var(--gold)';
    } else if (syncStatus.pending) {
      syncEl.textContent = '⚠ Pending sync — changes not saved to cloud';
      syncEl.style.color = 'var(--red)';
    } else if (syncStatus.ready) {
      syncEl.textContent = '✓ Cloud sync active';
      syncEl.style.color = 'var(--green)';
    } else {
      syncEl.textContent = '○ Cloud sync inactive (offline mode)';
      syncEl.style.color = 'var(--text-muted)';
    }
  }
}

// ── Edit Profile Toggle ───────────────────────────────────────

function toggleEditProfile() {
  _editingProfile = !_editingProfile;
  var viewEl = document.getElementById('profile-info');
  var editEl = document.getElementById('profile-edit');

  if (viewEl) viewEl.style.display = _editingProfile ? 'none' : 'block';
  if (editEl) editEl.style.display = _editingProfile ? 'block' : 'none';

  if (_editingProfile) {
    var user = getCurrentUser();
    var nameInput = document.getElementById('profile-edit-name');
    if (nameInput && user) nameInput.value = user.displayName || '';
    var emailInput = document.getElementById('profile-edit-email');
    if (emailInput && user) emailInput.value = user.email || '';
  }
}

// ── Save Profile Changes ──────────────────────────────────────

async function saveProfileChanges() {
  var user = getCurrentUser();
  if (!user) return;

  var nameInput = document.getElementById('profile-edit-name');
  var emailInput = document.getElementById('profile-edit-email');
  var errorEl = document.getElementById('profile-edit-error');
  var successEl = document.getElementById('profile-edit-success');

  hideProfileMessage(errorEl);
  hideProfileMessage(successEl);

  var newName = nameInput ? nameInput.value.trim() : '';
  var newEmail = emailInput ? emailInput.value.trim() : '';

  try {
    // Update display name
    if (newName && newName !== user.displayName) {
      await updateDisplayName(newName);
    }

    // Update email (if changed)
    if (newEmail && newEmail !== user.email) {
      await updateEmail(newEmail);
    }

    // Update Firestore profile
    await saveProfile(user.uid, {
      displayName: newName || user.displayName,
      email: newEmail || user.email,
    });

    if (successEl) {
      successEl.textContent = 'Profile updated successfully.';
      successEl.style.display = 'block';
    }

    toggleEditProfile();
  } catch (e) {
    if (errorEl) {
      errorEl.textContent = e.message;
      errorEl.style.display = 'block';
    }
  }
}

// ── Settings Edit Toggle ──────────────────────────────────────

function toggleEditSettings() {
  _editingSettings = !_editingSettings;
  var viewEl = document.getElementById('settings-info');
  var editEl = document.getElementById('settings-edit');

  if (viewEl) viewEl.style.display = _editingSettings ? 'none' : 'block';
  if (editEl) editEl.style.display = _editingSettings ? 'block' : 'none';

  if (_editingSettings) {
    var user = getCurrentUser();
    if (user) {
      loadProfile(user.uid).then(function (profile) {
        var settings = profile && profile.settings ? mergeSettings(profile.settings) : getDefaultSettings();
        var limitInput = document.getElementById('settings-edit-limit');
        if (limitInput) limitInput.value = settings.dailyReviewLimit;
        var sizeInput = document.getElementById('settings-edit-size');
        if (sizeInput) sizeInput.value = settings.sessionSize;
        var autoInput = document.getElementById('settings-edit-auto');
        if (autoInput) autoInput.checked = settings.autoImportOnLogin;
        var themeInput = document.getElementById('settings-edit-dark-theme');
        if (themeInput) themeInput.checked = settings.darkTheme !== false;
        var celebrationInput = document.getElementById('settings-edit-show-celebrations');
        if (celebrationInput) celebrationInput.checked = settings.showCelebrations !== false;
        var notifyInput = document.getElementById('settings-edit-notifications');
        if (notifyInput) notifyInput.checked = settings.notificationsEnabled === true;
      });
    }
  }
}

// ── Save Settings Changes ─────────────────────────────────────

async function saveSettingsChanges() {
  var user = getCurrentUser();
  if (!user) return;

  var limitInput = document.getElementById('settings-edit-limit');
  var sizeInput = document.getElementById('settings-edit-size');
  var autoInput = document.getElementById('settings-edit-auto');
  var errorEl = document.getElementById('settings-edit-error');
  var successEl = document.getElementById('settings-edit-success');

  hideProfileMessage(errorEl);
  hideProfileMessage(successEl);

  var newSettings = {
    dailyReviewLimit: parseInt(limitInput ? limitInput.value : 25, 10) || 25,
    sessionSize: parseInt(sizeInput ? sizeInput.value : 20, 10) || 20,
    autoImportOnLogin: autoInput ? autoInput.checked : true,
    darkTheme: document.getElementById('settings-edit-dark-theme') ? document.getElementById('settings-edit-dark-theme').checked : true,
    showCelebrations: document.getElementById('settings-edit-show-celebrations') ? document.getElementById('settings-edit-show-celebrations').checked : true,
    notificationsEnabled: document.getElementById('settings-edit-notifications') ? document.getElementById('settings-edit-notifications').checked : false,
  };

  // Clamp values
  newSettings.dailyReviewLimit = Math.max(5, Math.min(100, newSettings.dailyReviewLimit));
  newSettings.sessionSize = Math.max(5, Math.min(ALL_WORDS.length, newSettings.sessionSize));

  try {
    await saveProfile(user.uid, { settings: newSettings });

    if (successEl) {
      successEl.textContent = 'Settings saved. Some changes take effect after reload.';
      successEl.style.display = 'block';
    }

    toggleEditSettings();
  } catch (e) {
    if (errorEl) {
      errorEl.textContent = e.message;
      errorEl.style.display = 'block';
    }
  }
}

// ── Password Change Modal ─────────────────────────────────────

function showPasswordChangeModal() {
  var modal = document.getElementById('password-change-modal');
  if (modal) {
    modal.style.display = 'flex';
    // Backdrop click to close
    modal.onclick = function(e) {
      if (e.target === modal) closePasswordModal();
    };
  }

  // Manage aria-hidden on app container and trap focus
  var appEl = document.querySelector('.app');
  if (appEl) appEl.setAttribute('aria-hidden', 'true');
  trapFocus(modal);

  // Clear previous
  document.getElementById('password-change-error').style.display = 'none';
  document.getElementById('password-change-success').style.display = 'none';
  document.getElementById('password-change-current').value = '';
  document.getElementById('password-change-new').value = '';
  document.getElementById('password-change-confirm').value = '';
}

async function handlePasswordChangeSubmit() {
  var currentPwd = document.getElementById('password-change-current').value;
  var newPwd = document.getElementById('password-change-new').value;
  var confirmPwd = document.getElementById('password-change-confirm').value;
  var errorEl = document.getElementById('password-change-error');
  var successEl = document.getElementById('password-change-success');
  var user = getCurrentUser();

  hideProfileMessage(errorEl);
  hideProfileMessage(successEl);

  // Link validation errors to form inputs for screen readers
  var currentInput = document.getElementById('password-change-current');
  var newInput = document.getElementById('password-change-new');
  var confirmInput = document.getElementById('password-change-confirm');

  if (!currentPwd || !newPwd || !confirmPwd) {
    errorEl.textContent = 'Please fill in all fields.';
    errorEl.style.display = 'block';
    errorEl.id = 'password-change-error';
    if (currentInput) currentInput.setAttribute('aria-describedby', 'password-change-error');
    if (newInput) newInput.setAttribute('aria-describedby', 'password-change-error');
    if (confirmInput) confirmInput.setAttribute('aria-describedby', 'password-change-error');
    return;
  }

  if (newPwd !== confirmPwd) {
    errorEl.textContent = 'New passwords do not match.';
    errorEl.style.display = 'block';
    errorEl.id = 'password-change-error';
    if (newInput) newInput.setAttribute('aria-describedby', 'password-change-error');
    if (confirmInput) confirmInput.setAttribute('aria-describedby', 'password-change-error');
    return;
  }

  if (newPwd.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters.';
    errorEl.style.display = 'block';
    errorEl.id = 'password-change-error';
    if (newInput) newInput.setAttribute('aria-describedby', 'password-change-error');
    return;
  }

  try {
    // Re-authenticate first
    await reauthenticate(user.email, currentPwd);

    // Then update password
    await updatePassword(newPwd);

    successEl.textContent = 'Password changed successfully.';
    successEl.style.display = 'block';

    // Close modal after delay
    setTimeout(function () {
      closePasswordModal();
    }, 2000);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  }
}

// ── Delete Account ────────────────────────────────────────────

async function handleDeleteAccount() {
  var user = getCurrentUser();
  if (!user) return;

  // Confirm with the user
  var confirm1 = confirm('Are you sure you want to delete your account? This cannot be undone.');
  if (!confirm1) return;

  var confirm2 = confirm('Type "DELETE" to confirm permanent account deletion.');
  if (!confirm2) return;

  try {
    // Delete profile data from Firestore
    await deleteProfile(user.uid);

    // Delete auth account
    await deleteAccount();

    // Clear local data
    localStorage.clear();

    // Navigate to auth view
    showAuthView('login');
    switchView('auth');
  } catch (e) {
    alert('Failed to delete account: ' + e.message);
  }
}

// ── Export / Import Data ──────────────────────────────────────

async function handleExportData() {
  var user = getCurrentUser();
  var data;

  if (user) {
    data = await exportAccountData(user.uid);
  } else {
    data = exportLocalData ? exportLocalData() : {};
  }

  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'bayan-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImportData() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var result = importLocalData ? importLocalData(data) : { imported: [], skipped: [] };
        if (result.error) {
          alert('Import error: ' + result.error);
        } else {
          alert('Imported ' + result.imported.length + ' data categories successfully.' +
            (result.skipped.length > 0 ? ' (' + result.skipped.length + ' skipped)' : '') +
            '\nPlease reload the app.');
        }
      } catch (err) {
        alert('Invalid backup file. Please choose a valid .json file.');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

// ── SVG icon helper ────────────────────────────────────────────

function _pIcon(name, size) {
  var icons = window.__components && window.__components.createSVGIcon;
  if (icons) return icons(name, { size: size || 16 });
  var fallback = {
    fire: '🔥', book: '📖', star: '⭐', brain: '🧠', repeat: '🔄',
    leaf: '🌱', award: '🏆', target: '🎯', layers: '📚', bolt: '⚡',
    chart: '📊', clock: '⏰', calendar: '📅', heart: '❤️',
    check: '✓', 'check-circle': '✅', trending: '📈', lightbulb: '💡',
    'book-open': '📖', crown: '👑', zap: '⚡', 'arrow-right': '→',
  };
  return fallback[name] || '✦';
}

// ═══════════════════════════════════════════════════════════════
// PROFILE — Progress Section (moved from Stats view)
// ═══════════════════════════════════════════════════════════════

function renderProfileProgress() {
  var container = document.getElementById('profile-progress');
  if (!container) return;

  var srsObj = window.__srs;
  var srsStats = (srsObj && srsObj.getStats) ? srsObj.getStats() : (typeof getSRSStats === 'function' ? getSRSStats() : {});
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();

  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fPct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;

  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var compPct = coverage ? coverage.estimatedComprehension : 0;

  var h = '';

  // Core progress metrics grid
  h += '<div class="profile-progress-grid">';
  h += '<div class="profile-pstat"><div class="profile-pstat-value">' + (srsStats.mature || 0) + '</div><div class="profile-pstat-label">Words Mastered</div></div>';
  h += '<div class="profile-pstat"><div class="profile-pstat-value">' + compPct + '%</div><div class="profile-pstat-label">Quran Comprehension</div></div>';
  h += '<div class="profile-pstat"><div class="profile-pstat-value">' + (srsStats.totalReviews || 0).toLocaleString() + '</div><div class="profile-pstat-label">Total Reviews</div></div>';
  h += '<div class="profile-pstat"><div class="profile-pstat-value">' + (srsStats.avgRetention || 0) + '%</div><div class="profile-pstat-label">Avg Retention</div></div>';
  h += '</div>';

  // Foundation Course
  if (fTotal > 0) {
    h += '<div class="profile-subsection">';
    h += '<div class="profile-subsection-title">📘 Foundation Course</div>';
    h += '<div class="profile-bar-row"><span class="profile-bar-label">Progress</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + fPct + '%;background:var(--gold)"></div></div><span class="profile-bar-value">' + fCompleted + '/' + fTotal + '</span></div>';
    if (coverage) {
      var foundCov = typeof getFoundationCoverage === 'function' ? getFoundationCoverage() : null;
      h += '<div class="profile-bar-row"><span class="profile-bar-label">Coverage</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + (foundCov ? foundCov.foundationCoveragePercent : 0) + '%;background:var(--green)"></div></div><span class="profile-bar-value">' + (foundCov ? foundCov.foundationCoveragePercent : 0) + '%</span></div>';
    }
    h += '</div>';
  }

  // Surah Progress
  var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  var surahComp = typeof getAllSurahComprehension === 'function' ? getAllSurahComprehension() : [];
  var sCompleted = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;
  h += '<div class="profile-subsection">';
  h += '<div class="profile-subsection-title">📖 Surah Learning</div>';
  h += '<div class="profile-bar-row"><span class="profile-bar-label">Studied</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + (surahIds.length > 0 ? Math.round((sCompleted / surahIds.length) * 100) : 0) + '%;background:var(--blue)"></div></div><span class="profile-bar-value">' + sCompleted + '/' + surahIds.length + '</span></div>';

  // Show top 5 surahs by comprehension
  if (surahComp.length > 0) {
    surahComp.sort(function(a, b) { return a.estimatedComprehension - b.estimatedComprehension; });
    h += '<div class="pui-text-sm pui-muted" style="margin:6px 0 4px">Lowest comprehension:</div>';
    for (var si = 0; si < Math.min(3, surahComp.length); si++) {
      var sc = surahComp[si];
      var sName = typeof getSurahInfo === 'function' && getSurahInfo(sc.surahId) ? getSurahInfo(sc.surahId).name : 'Surah ' + sc.surahId;
      h += '<div class="profile-bar-row"><span class="profile-bar-label" style="font-size:10px;min-width:70px">' + sName + '</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + Math.max(1, sc.estimatedComprehension) + '%;background:' + (sc.estimatedComprehension >= 50 ? 'var(--gold)' : 'var(--red)') + '"></div></div><span class="profile-bar-value" style="font-size:10px">' + sc.estimatedComprehension + '%</span></div>';
    }
    if (surahComp.length > 3) {
      h += '<div class="pui-value-sm pui-muted pui-center" style="margin-top:4px">+' + (surahComp.length - 3) + ' more surahs</div>';
    }
  }
  h += '</div>';

  // Root Progress
  var rfTotal = typeof getTotalRootFamilyCount === 'function' ? getTotalRootFamilyCount() : 0;
  var rfCompleted = typeof getCompletedRootFamilyCount === 'function' ? getCompletedRootFamilyCount() : 0;
  var rootMastery = typeof getRootFamilyMastery === 'function' ? getRootFamilyMastery() : null;
  h += '<div class="profile-subsection">';
  h += '<div class="profile-subsection-title">🌱 Root Families</div>';
  if (rootMastery) {
    h += '<div class="profile-bar-row"><span class="profile-bar-label">Mastered</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + (rootMastery.totalRoots > 0 ? Math.round((rootMastery.fullyMasteredRoots / rootMastery.totalRoots) * 100) : 0) + '%;background:var(--purple)"></div></div><span class="profile-bar-value">' + rootMastery.fullyMasteredRoots + '/' + rootMastery.totalRoots + '</span></div>';
  } else {
    h += '<div class="profile-bar-row"><span class="profile-bar-label">Studied</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + (rfTotal > 0 ? Math.round((rfCompleted / rfTotal) * 100) : 0) + '%;background:var(--purple)"></div></div><span class="profile-bar-value">' + rfCompleted + '/' + rfTotal + '</span></div>';
  }
  h += '</div>';

  // Learning stages breakdown
  var stageItems = [
    { key: 'newCount', label: '🆕 New', val: srsStats.newCount || 0 },
    { key: 'learning', label: '🔍 Learning', val: srsStats.learning || 0 },
    { key: 'young', label: '🌱 Young', val: srsStats.young || 0 },
    { key: 'mature', label: '💡 Mature', val: srsStats.mature || 0 },
  ];
  h += '<div class="profile-subsection">';
  h += '<div class="profile-subsection-title">📊 Learning Stages</div>';
  var totalStaged = stageItems.reduce(function(s, it) { return s + it.val; }, 0) || 1;
  for (var sti = 0; sti < stageItems.length; sti++) {
    var st = stageItems[sti];
    var stPct = Math.round((st.val / totalStaged) * 100);
    h += '<div class="profile-bar-row"><span class="profile-bar-label" style="font-size:10px">' + st.label + '</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + stPct + '%;background:' + (sti === 0 ? 'var(--blue)' : sti === 1 ? 'var(--purple)' : sti === 2 ? 'var(--gold-dim)' : 'var(--green)') + '"></div></div><span class="profile-bar-value" style="font-size:10px">' + st.val + '</span></div>';
  }
  h += '</div>';

  // Reading Progress
  var readingSummary = null;
  if (window.__reader && typeof window.__reader.getJourneySummary === 'function') {
    readingSummary = window.__reader.getJourneySummary();
  }
  if (readingSummary) {
    h += '<div class="profile-subsection">';
    h += '<div class="profile-subsection-title">📖 Reading</div>';
    h += '<div class="profile-reading-grid">';
    h += '<div><span class="profile-bar-value">' + readingSummary.totalSurahsRead + '</span><span class="profile-pstat-label">Surahs Read</span></div>';
    h += '<div><span class="profile-bar-value">' + (readingSummary.totalAyahs || 0) + '</span><span class="profile-pstat-label">Ayahs Read</span></div>';
    h += '<div><span class="profile-bar-value">' + readingSummary.avgComprehension + '%</span><span class="profile-pstat-label">Avg Comp</span></div>';
    h += '</div></div>';
  }

  // SRS Health
  h += '<div class="profile-subsection">';
  h += '<div class="profile-subsection-title">❤️ SRS Health</div>';
  h += '<div class="profile-srs-grid">';
  h += '<div><span class="profile-bar-value ai-c-green">' + (srsStats.avgRetention || 0) + '%</span><span class="profile-pstat-label">Retention</span></div>';
  h += '<div><span class="profile-bar-value ai-c-blue">' + (srsStats.avgEaseFactor ? srsStats.avgEaseFactor.toFixed(2) : '2.50') + '</span><span class="profile-pstat-label">Avg Ease</span></div>';
  h += '<div><span class="profile-bar-value" style="color:' + ((srsStats.overdue || 0) > 0 ? 'var(--red)' : 'var(--green)') + '">' + (srsStats.overdue || 0) + '</span><span class="profile-pstat-label">Overdue</span></div>';
  h += '<div><span class="profile-bar-value" style="color:' + ((srsStats.leechCount || 0) > 0 ? 'var(--red)' : 'var(--text)') + '">' + (srsStats.leechCount || 0) + '</span><span class="profile-pstat-label">Leeches</span></div>';
  h += '</div></div>';

  // Review Forecast (compact)
  h += '<div class="profile-subsection">';
  h += '<div class="profile-subsection-title">📅 Review Forecast</div>';
  var intervals = [0, 3, 7, 14, 30];
  var intervalLabels = ['Today', '3d', '7d', '14d', '30d'];
  for (var ii = 0; ii < intervals.length; ii++) {
    var cutoff = now + intervals[ii] * 86400000;
    var cnt = 0;
    if (typeof ALL_WORDS !== 'undefined') {
      for (var wi = 0; wi < ALL_WORDS.length; wi++) {
        var entry = srsData[ALL_WORDS[wi].id];
        if (entry && entry.dueDate && entry.dueDate <= cutoff) cnt++;
      }
    }
    h += '<div class="profile-bar-row"><span class="profile-bar-label" style="font-size:10px">' + intervalLabels[ii] + '</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + Math.min(100, Math.round((cnt / Math.max(1, ALL_WORDS ? ALL_WORDS.length : 1)) * 100)) + '%;background:' + (ii < 2 ? 'var(--gold)' : ii < 3 ? 'var(--green)' : 'var(--blue)') + '"></div></div><span class="profile-bar-value" style="font-size:10px">' + cnt + '</span></div>';
  }
  h += '</div>';

  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// PROFILE — Insights Section (moved from Analytics)
// ═══════════════════════════════════════════════════════════════

function renderProfileInsights() {
  var container = document.getElementById('profile-insights');
  if (!container) return;

  var analytics = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
  var h = '';

  if (!analytics) {
    h += '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text-muted)">' +
      '📊 Start learning to unlock insights about your progress. Study words and complete reviews to build your learning profile.' +
      '</div>';
    container.innerHTML = h;
    return;
  }

  var profile = analytics.profile;
  var periods = analytics.periods;

  // Weekly Summary
  if (periods && periods.week) {
    h += '<div class="profile-subsection">';
    h += '<div class="profile-subsection-title">📈 This Week</div>';
    h += '<div class="profile-insight-grid">';
    h += '<div><span class="profile-bar-value">+' + (periods.week.gainMastered || 0) + '</span><span class="profile-pstat-label">Words Gained</span></div>';
    h += '<div><span class="profile-bar-value">' + periods.week.totalReviews + '</span><span class="profile-pstat-label">Reviews</span></div>';
    h += '<div><span class="profile-bar-value">' + periods.week.daysActive + '</span><span class="profile-pstat-label">Active Days</span></div>';
    h += '<div><span class="profile-bar-value">' + (periods.week.avgReviewsPerDay || 0) + '</span><span class="profile-pstat-label">Avg/Day</span></div>';
    h += '</div></div>';
  }

  // Monthly Summary
  if (periods && periods.month) {
    h += '<div class="profile-subsection">';
    h += '<div class="profile-subsection-title">📊 This Month</div>';
    h += '<div class="profile-insight-grid">';
    h += '<div><span class="profile-bar-value">+' + (periods.month.gainMastered || 0) + '</span><span class="profile-pstat-label">Words Gained</span></div>';
    h += '<div><span class="profile-bar-value">' + periods.month.totalReviews + '</span><span class="profile-pstat-label">Reviews</span></div>';
    h += '<div><span class="profile-bar-value">' + periods.month.daysActive + '</span><span class="profile-pstat-label">Active Days</span></div>';
    h += '</div></div>';
  }

  // Strong & Weak Roots
  if (profile) {
    if (profile.strongRoots && profile.strongRoots.length > 0) {
      h += '<div class="profile-subsection">';
      h += '<div class="profile-subsection-title">💪 Strongest Roots</div>';
      for (var sri = 0; sri < Math.min(profile.strongRoots.length, 5); sri++) {
        var sr = profile.strongRoots[sri];
        h += '<div class="profile-bar-row"><span class="profile-bar-label" style="font-size:10px">' + sr.root + '</span><span style="font-size:10px;color:var(--text-muted);flex:1">' + (sr.rootMeaning || '') + '</span><span class="profile-bar-value" style="font-size:10px;color:var(--green)">' + sr.masteryScore + '%</span></div>';
      }
      h += '</div>';
    }
    if (profile.weakRoots && profile.weakRoots.length > 0) {
      h += '<div class="profile-subsection">';
      h += '<div class="profile-subsection-title">🌱 Needs Practice</div>';
      for (var wri = 0; wri < Math.min(profile.weakRoots.length, 5); wri++) {
        var wr = profile.weakRoots[wri];
        h += '<div class="profile-bar-row"><span class="profile-bar-label" style="font-size:10px">' + wr.root + '</span><span style="font-size:10px;color:var(--text-muted);flex:1">' + (wr.rootMeaning || '') + '</span><span class="profile-bar-value" style="font-size:10px;color:var(--red)">' + wr.masteryScore + '%</span></div>';
      }
      h += '</div>';
    }

    // Quiz Performance
    var quizHistory = typeof loadQuizHistory === 'function' ? loadQuizHistory() : null;
    if (quizHistory && quizHistory.total > 0) {
      var qAcc = Math.round((quizHistory.correct / quizHistory.total) * 100);
      h += '<div class="profile-subsection">';
      h += '<div class="profile-subsection-title">📝 Quiz Performance</div>';
      h += '<div class="profile-insight-grid">';
      h += '<div><span class="profile-bar-value">' + quizHistory.total + '</span><span class="profile-pstat-label">Questions</span></div>';
      h += '<div><span class="profile-bar-value">' + qAcc + '%</span><span class="profile-pstat-label">Accuracy</span></div>';
      h += '</div></div>';
    }

    // Learning trends (consistency)
    if (periods && periods.consistency !== undefined) {
      h += '<div class="profile-subsection">';
      h += '<div class="profile-subsection-title">🎯 Consistency</div>';
      h += '<div class="profile-bar-row"><span class="profile-bar-label" style="font-size:10px">Active days</span><div class="profile-bar-track"><div class="profile-bar-fill" style="width:' + periods.consistency + '%;background:var(--gold)"></div></div><span class="profile-bar-value" style="font-size:10px">' + periods.consistency + '%</span></div>';
      h += '</div>';
    }

    // Forecasts
    if (analytics.forecasts) {
      h += '<div class="profile-subsection">';
      h += '<div class="profile-subsection-title">🔮 Forecasts</div>';
      h += '<div class="profile-insight-grid">';
      h += '<div><span class="profile-bar-value">' + (analytics.forecasts.predictedMastered['7'] || 0) + '</span><span class="profile-pstat-label">7 Day</span></div>';
      h += '<div><span class="profile-bar-value">' + (analytics.forecasts.predictedMastered['30'] || 0) + '</span><span class="profile-pstat-label">30 Day</span></div>';
      h += '<div><span class="profile-bar-value">' + (analytics.forecasts.predictedMastered['90'] || 0) + '</span><span class="profile-pstat-label">90 Day</span></div>';
      h += '</div></div>';
    }
  }

  // Milestone insight
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var covPct = coverage ? coverage.coveragePercent : 0;
  var ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus(covPct) : null;
  if (ms && ms.nextMilestone) {
    h += '<div class="profile-subsection">';
    h += '<div class="profile-subsection-title">🎯 Next Milestone</div>';
    h += '<div class="ai-card-sm" style="padding:8px 12px">';
    h += '<div class="ai-text-sm ai-c-gold" style="font-weight:500;margin-bottom:2px">' + ms.nextMilestone.icon + ' ' + ms.nextMilestone.label + '</div>';
    h += '<div class="ai-label-xs">~' + ms.wordsToNextMilestone + ' words, ~' + ms.lessonsToNextMilestone + ' lessons away</div>';
    h += '</div></div>';
  }

  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// PROFILE — About Section
// ═══════════════════════════════════════════════════════════════

function renderProfileAbout() {
  var container = document.getElementById('profile-about');
  if (!container) return;

  var h = '';
  h += '<div class="pf-about-card">';
  h += '<div class="pf-about-header">';
  h += '<div class="pf-about-icon">📖</div>';
  h += '<div class="pf-about-info">';
  h += '<div class="pf-about-name">Bayan</div>';
  h += '<div class="pf-about-version">v2.0 · Understand the Quran, one word at a time</div>';
  h += '</div></div>';
  h += '<div class="pf-about-desc">Bayan is a free, open-source Quranic Arabic learning app. It uses spaced repetition, root analysis, and context-based learning to help you understand the Quran in its original language.</div>';
  h += '<div class="pf-about-mission"><span class="pf-about-mission-icon">🎯</span> Our mission is to make Quranic Arabic accessible to everyone, anywhere, for free.</div>';

  // Links
  h += '<div class="pf-about-links">';
  h += '<button class="pf-about-link" id="btn-revisit-onboarding" type="button">🔄 Replay Tour</button>';
  // URLs are split to avoid damage from build.js comment stripper which strips // as line comments
  var $ghUrl = 'https:' + '/' + '/github.com/adnankamal2708-hub/quran-ap';
  h += '<a class="pf-about-link pf-about-link-ext" href="' + $ghUrl + '" target="_blank" rel="noopener noreferrer">🌐 GitHub</a>';
  h += '<a class="pf-about-link pf-about-link-ext" href="' + $ghUrl + '/issues" target="_blank" rel="noopener noreferrer">💬 Feedback</a>';
  h += '<span class="pf-about-link pf-about-link-static">📜 Open Source (MIT)</span>';
  h += '<a class="pf-about-link pf-about-link-ext" href="#" id="profile-privacy-link">🔒 Privacy Policy</a>';
  h += '<a class="pf-about-link pf-about-link-ext" href="#" id="profile-terms-link">📜 Terms of Service</a>';
  h += '</div>';

  h += '<div class="pf-about-footer">Made with ❤️ for the love of the Quran</div>';
  h += '</div>';

  container.innerHTML = h;

  // Wire the replay tour button
  var tourBtn = document.getElementById('btn-revisit-onboarding');
  if (tourBtn) {
    tourBtn.onclick = function() {
      if (window.__ux && typeof window.__ux.restartOnboarding === 'function') {
        window.__ux.restartOnboarding();
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// PROFILE — Achievements Section
// ═══════════════════════════════════════════════════════════════

function renderProfileAchievements() {
  var container = document.getElementById('profile-achievements');
  if (!container) return;

  var achievements = (window.__analytics && window.__analytics.getAllAchievements) ? window.__analytics.getAllAchievements() : [];
  var stats = (window.__analytics && window.__analytics.getAchievementStats) ? window.__analytics.getAchievementStats() : null;

  var earned = achievements.filter(function(a) { return a.earned; });
  var locked = achievements.filter(function(a) { return !a.earned; });
  var totalPct = stats ? stats.progressPercent : (achievements.length > 0 ? Math.round((earned.length / achievements.length) * 100) : 0);

  // Session state for expand/collapse (default: collapsed)
  var collapsibleState = window.__sessionAchievementsOpen;
  var isOpen = collapsibleState === true;

  // ── Collapsible Wrapper ──
  var h = '';
  h += '<div class="profile-ach-collapsible' + (isOpen ? ' open' : '') + '" id="profile-ach-collapsible">';

  // ── Collapsible Header ──
  h += '<div class="profile-ach-collapsible-header" id="profile-ach-toggle" tabindex="0" role="button" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-label="Achievements ' + earned.length + ' of ' + achievements.length + ' unlocked">';
  h += '<div class="profile-ach-collapsible-header-left">';
  h += '<span class="profile-ach-collapsible-icon">🏆</span>';
  h += '<span class="profile-ach-collapsible-title">Achievements</span>';
  h += '<span class="profile-ach-collapsible-count">' + earned.length + ' of ' + achievements.length + ' unlocked</span>';
  h += '</div>';
  h += '<div class="profile-ach-collapsible-header-right">';
  h += '<span class="profile-ach-collapsible-pct">' + totalPct + '%</span>';
  h += '<span class="profile-ach-chevron' + (isOpen ? ' open' : '') + '">▶</span>';
  h += '</div>';
  h += '</div>';

  // ── Collapsible Body ──
  h += '<div class="profile-ach-collapsible-body">';

  if (achievements.length === 0) {
    h += '<div class="profile-ach-empty">' +
      '<div class="profile-ach-empty-icon">🏆</div>' +
      '<div class="profile-ach-empty-text">Complete your first lesson to start earning achievements.</div>' +
      '<div class="profile-ach-empty-sub">Milestones are unlocked as you master words, maintain streaks, and progress through the Foundation Course.</div>' +
      '</div>';
  } else {
    // ── Premium Progress Summary ──
    h += '<div class="profile-ach-summary">';
    h += '<div class="profile-ach-summary-top">';
    h += '<div class="profile-ach-summary-icon">🏆</div>';
    h += '<div class="profile-ach-summary-info">';
    h += '<div class="profile-ach-summary-title">Progress Summary</div>';
    h += '<div class="profile-ach-summary-sub">' + earned.length + ' of ' + achievements.length + ' unlocked</div>';
    h += '</div>';
    h += '<div class="profile-ach-summary-pct">' + totalPct + '%</div>';
    h += '</div>';
    h += '<div class="profile-ach-progress-track"><div class="profile-ach-progress-fill" style="width:' + totalPct + '%"></div></div>';

    // Category breakdown
    if (stats && stats.byCategory) {
      var catKeys = Object.keys(stats.byCategory);
      if (catKeys.length > 0) {
        h += '<div class="profile-ach-cats">';
        for (var cki = 0; cki < catKeys.length; cki++) {
          var cat = catKeys[cki];
          var catData = stats.byCategory[cat];
          var catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
          h += '<div class="profile-ach-cat-item">';
          h += '<span class="profile-ach-cat-label">' + catLabel + '</span>';
          h += '<span class="profile-ach-cat-count">' + catData.earned + '/' + catData.total + '</span>';
          h += '</div>';
        }
        h += '</div>';
      }
    }
    h += '</div>';

    // ── Completed Section ──
    if (earned.length > 0) {
      h += '<div class="profile-ach-section">';
      h += '<div class="profile-ach-section-header">';
      h += '<span class="profile-ach-section-icon">✓</span>';
      h += '<span class="profile-ach-section-title">Completed</span>';
      h += '<span class="profile-ach-section-count">' + earned.length + '</span>';
      h += '</div>';
      h += '<div class="profile-ach-grid">';
      for (var ei = 0; ei < earned.length; ei++) {
        var ea = earned[ei];
        h += '<div class="profile-ach-card earned">';
        h += '<div class="profile-ach-card-top">';
        h += '<div class="profile-ach-icon earned-icon">' + (ea.icon || '🏆') + '</div>';
        h += '<div class="profile-ach-card-info">';
        h += '<div class="profile-ach-title">' + ea.title + '</div>';
        h += '<div class="profile-ach-desc">' + ea.description + '</div>';
        h += '</div>';
        h += '<div class="profile-ach-check">✓</div>';
        h += '</div>';
        if (ea.earnedDate) {
          h += '<div class="profile-ach-date">Earned ' + ea.earnedDate + '</div>';
        }
        h += '</div>';
      }
      h += '</div></div>';
    }

    // ── In Progress Section ──
    var inProgress = [];
    var trulyLocked = [];
    var catEarnedMap = {};
    if (stats && stats.byCategory) {
      var ckeys = Object.keys(stats.byCategory);
      for (var czi = 0; czi < ckeys.length; czi++) {
        catEarnedMap[ckeys[czi]] = stats.byCategory[ckeys[czi]];
      }
    }
    for (var xi = 0; xi < locked.length; xi++) {
      var lc = locked[xi];
      var catInfo = catEarnedMap[lc.category];
      if (catInfo && catInfo.earned > 0 && catInfo.earned < catInfo.total) {
        inProgress.push(lc);
      } else {
        trulyLocked.push(lc);
      }
    }

    if (inProgress.length > 0) {
      h += '<div class="profile-ach-section">';
      h += '<div class="profile-ach-section-header">';
      h += '<span class="profile-ach-section-icon">🎯</span>';
      h += '<span class="profile-ach-section-title">In Progress</span>';
      h += '<span class="profile-ach-section-count">' + inProgress.length + '</span>';
      h += '</div>';
      h += '<div class="profile-ach-grid">';
      for (var pi = 0; pi < inProgress.length; pi++) {
        var pa = inProgress[pi];
        h += '<div class="profile-ach-card in-progress">';
        h += '<div class="profile-ach-card-top">';
        h += '<div class="profile-ach-icon inprogress-icon">' + (pa.icon || '🏆') + '</div>';
        h += '<div class="profile-ach-card-info">';
        h += '<div class="profile-ach-title">' + pa.title + '</div>';
        h += '<div class="profile-ach-desc">' + pa.description + '</div>';
        h += '</div>';
        h += '</div>';
        h += '<div class="profile-ach-progress-row"><div class="profile-ach-progress-dot"></div><span class="profile-ach-progress-text">In progress</span></div>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    // ── Locked Section ──
    if (trulyLocked.length > 0) {
      h += '<div class="profile-ach-section">';
      h += '<div class="profile-ach-section-header">';
      h += '<span class="profile-ach-section-icon">🔒</span>';
      h += '<span class="profile-ach-section-title">Locked</span>';
      h += '<span class="profile-ach-section-count">' + trulyLocked.length + '</span>';
      h += '</div>';
      h += '<div class="profile-ach-grid">';
      for (var li = 0; li < trulyLocked.length; li++) {
        var la = trulyLocked[li];
        h += '<div class="profile-ach-card locked">';
        h += '<div class="profile-ach-card-top">';
        h += '<div class="profile-ach-icon locked-icon">' + (la.icon || '🏆') + '</div>';
        h += '<div class="profile-ach-card-info">';
        h += '<div class="profile-ach-title">' + la.title + '</div>';
        h += '<div class="profile-ach-desc">' + la.description + '</div>';
        h += '</div>';
        h += '<div class="profile-ach-lock-icon">🔒</div>';
        h += '</div>';
        h += '</div>';
      }
      h += '</div></div>';
    }
  }

  // Close collapsible body and wrapper
  h += '</div>'; // .profile-ach-collapsible-body
  h += '</div>'; // .profile-ach-collapsible

  container.innerHTML = h;

  // Wire toggle event
  var toggle = document.getElementById('profile-ach-toggle');
  if (toggle) {
    toggle.onclick = function() {
      toggleAchievements();
    };
    toggle.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleAchievements();
      }
    };
  }
}

function toggleAchievements() {
  var wrapper = document.getElementById('profile-ach-collapsible');
  var toggle = document.getElementById('profile-ach-toggle');
  var chevron = toggle ? toggle.querySelector('.profile-ach-chevron') : null;
  if (!wrapper) return;

  var isOpen = wrapper.classList.contains('open');
  if (isOpen) {
    wrapper.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (chevron) chevron.classList.remove('open');
  } else {
    wrapper.classList.add('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (chevron) chevron.classList.add('open');
  }
  window.__sessionAchievementsOpen = !isOpen;
}


function renderProfileCalendar() {
  var container = document.getElementById('profile-calendar');
  if (!container) return;

  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var readingJourney = null;
  if (window.__reader && typeof window.__reader.getJourney === 'function') {
    readingJourney = window.__reader.getJourney();
  }

  var h = '';

  // Compact activity stats
  h += '<div class="profile-calendar-stats">';
  h += '<div class="profile-cal-stat"><span class="profile-bar-value">' + (srsStats.totalReviews || 0) + '</span><span class="profile-pstat-label">Total Reviews</span></div>';
  h += '<div class="profile-cal-stat"><span class="profile-bar-value">' + (srsStats.reviewsToday || 0) + '</span><span class="profile-pstat-label">Today</span></div>';
  h += '<div class="profile-cal-stat"><span class="profile-bar-value">' + streakData.streak + '</span><span class="profile-pstat-label">Day Streak</span></div>';
  h += '<div class="profile-cal-stat"><span class="profile-bar-value">' + (streakData.lastDate || '—') + '</span><span class="profile-pstat-label">Last Active</span></div>';
  h += '</div>';

  // Reading activity
  if (readingJourney) {
    var surahCount = readingJourney.surahs ? Object.keys(readingJourney.surahs).length : 0;
    h += '<div class="profile-subsection">';
    h += '<div class="profile-subsection-title">📖 Reading Activity</div>';
    h += '<div class="profile-insight-grid">';
    h += '<div><span class="profile-bar-value">' + surahCount + '</span><span class="profile-pstat-label">Surahs Read</span></div>';
    h += '<div><span class="profile-bar-value">' + (readingJourney.totalAyahsRead || 0) + '</span><span class="profile-pstat-label">Ayahs Read</span></div>';
    h += '<div><span class="profile-bar-value">' + (readingJourney.openings || 0) + '</span><span class="profile-pstat-label">Sessions</span></div>';
    h += '<div><span class="profile-bar-value">' + (readingJourney.readingStreak || 0) + '</span><span class="profile-pstat-label">Reading Streak</span></div>';
    h += '</div></div>';
  }

  // Learning milestones summary
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  var sCompleted = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;

  h += '<div class="profile-subsection">';
  h += '<div class="profile-subsection-title">🎯 Learning Milestones</div>';
  h += '<div style="display:flex;flex-direction:column;gap:6px">';
  h += '<div class="pui-milestone"><span>Foundation Lessons</span><span class="ai-c-gold">' + fCompleted + '/' + fTotal + '</span></div>';
  h += '<div class="pui-milestone"><span>Surahs Studied</span><span class="ai-c-gold">' + sCompleted + '/' + surahIds.length + '</span></div>';
  h += '</div></div>';

  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// WIRE — Profile section events
// ═══════════════════════════════════════════════════════════════

function wireProfileSectionEvents() {
  function $pwire(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.onclick = fn;
    el.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  }

  // Profile path clicks (stats sections)
  var pathEls = document.querySelectorAll('.profile-bar-row.clickable');
  for (var pi = 0; pi < pathEls.length; pi++) {
    (function(el) {
      var action = el.getAttribute('data-action');
      el.onclick = function() {
        if (action === 'foundation' && typeof goToFoundationLesson === 'function') {
          goToFoundationLesson(typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0);
        } else if (action === 'review' && typeof startReview === 'function') {
          startReview();
        } else if (action === 'list' && typeof switchView === 'function') {
          switchView('list');
        } else if (typeof switchView === 'function') {
          switchView('learn');
        }
      };
    })(pathEls[pi]);
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE — renderProfileView to include all sections
// ═══════════════════════════════════════════════════════════════

async function renderFullProfile() {
  await renderProfileView();
  renderProfileProgress();
  renderProfileInsights();
  renderProfileAchievements();
  renderProfileCalendar();
  renderProfileAbout();
  wireProfileSectionEvents();
}

// ── Helpers ───────────────────────────────────────────────────

function hideProfileMessage(el) {
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

// ── Export ────────────────────────────────────────────────────

window.__profileUI = {
  init: initProfileUI,
  render: renderProfileView,
  renderFullProfile: renderFullProfile,
  renderProgress: renderProfileProgress,
  renderInsights: renderProfileInsights,
  renderAchievements: renderProfileAchievements,
  renderCalendar: renderProfileCalendar,
  renderAbout: renderProfileAbout,
};
