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
  var stats = computeLearningSummary();
  document.getElementById('profile-stats-mastered').textContent = stats.wordsMastered;
  document.getElementById('profile-stats-reviews').textContent = stats.totalReviews;
  document.getElementById('profile-stats-streak').textContent = stats.streak + ' days';
  document.getElementById('profile-stats-retention').textContent = (stats.averageRetention || 0) + '%';

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
  a.download = 'quran-vocab-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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
};
