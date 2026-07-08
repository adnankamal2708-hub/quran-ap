// ═══════════════════════════════════════════════════════════════
// ux-polish.js — Onboarding, Toast System, Enhanced UX
//
// Adds: onboarding tour, toast notifications, milestone celebrations,
// enhanced empty states, loading states, and utility helpers.
// ═══════════════════════════════════════════════════════════════

// ── Onboarding System ─────────────────────────────────────────

/**
 * Onboarding slides data.
 * Each slide has: title, description, icon, and optional feature highlight.
 */
var _onboardingSlides = [
  {
    icon: '\uD83D\uDCD6',
    title: 'Bayan',
    desc: 'Understand the Quran, one word at a time.\n\nYour personal guide to learning the vocabulary of the Quran through spaced repetition, root analysis, and contextual learning.'
  },
  {
    icon: '\uD83D\uDCD8',
    title: 'The Foundation Course',
    desc: 'Start with the Foundation Course — 16 lessons covering the most frequent Quranic words. Each lesson builds on the previous one, unlocking new vocabulary by frequency so you learn efficiently.'
  },
  {
    icon: '\uD83D\uDCCA',
    title: 'Quran Reading Coverage',
    desc: 'Track how much of the Quran\'s vocabulary you\'ve mastered. Your coverage percentage shows what fraction of unique Quranic words you know, and estimated comprehension shows your understanding of the text.'
  },
  {
    icon: '\uD83D\uDD1D',
    title: 'Multiple Learning Paths',
    desc: 'Choose the path that suits you: sequential lessons, frequency-based Foundation Course, surah-by-surah study, root family exploration, or difficulty-based learning.'
  },
  {
    icon: '\uD83E\uDDE0',
    title: 'Adaptive Learning & SRS',
    desc: 'Our Spaced Repetition System schedules reviews at optimal times. Words you struggle with appear more often; words you know well appear less frequently. This maximizes retention.'
  },
  {
    icon: '\u2601\uFE0F',
    title: 'Sync & Offline Mode',
    desc: 'Create a free account to sync your progress across devices via Firebase. All learning data is stored locally, so you can study offline and sync when connected.'
  }
];

/** Check if onboarding has been completed */
function hasCompletedOnboarding() {
  try {
    return localStorage.getItem('quran_onboarding_done') === 'true';
  } catch (e) { return false; }
}

/** Mark onboarding as completed */
function completeOnboarding() {
  try { localStorage.setItem('quran_onboarding_done', 'true'); } catch (e) {}
}

/** Reset onboarding (for revisiting) */
function resetOnboarding() {
  try { localStorage.removeItem('quran_onboarding_done'); } catch (e) {}
}

/** Show the onboarding overlay */
function showOnboarding() {
  var overlay = document.getElementById('onboarding-overlay');
  if (!overlay) {
    // Create overlay dynamically if not in DOM
    overlay = createOnboardingOverlay();
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  // Prevent body scroll
  document.body.classList.add('body-overflow-locked');
  // Trap focus
  trapOnboardingFocus(overlay);
  // Wire keyboard navigation
  wireOnboardingEvents();
  // Show first slide
  showOnboardingSlide(0);
}

/** Hide the onboarding overlay */
function hideOnboarding() {
  var overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  document.body.classList.remove('body-overflow-locked');
  releaseOnboardingFocus();
}

/** Create the onboarding overlay DOM */
function createOnboardingOverlay() {
  var overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.className = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome tour');
  
  overlay.innerHTML =
    '<div class="onboarding-card">' +
      '<button class="onboarding-skip-btn" id="onboarding-skip" type="button" aria-label="Skip tour">\u2716 Skip</button>' +
      '<div class="onboarding-slide" id="onboarding-slide"></div>' +
      '<div class="onboarding-dots" id="onboarding-dots"></div>' +
      '<div class="onboarding-nav">' +
        '<button class="btn btn-sm btn-outline" id="onboarding-prev" type="button" aria-label="Previous slide">\u2190 Back</button>' +
        '<button class="btn btn-sm" id="onboarding-next" type="button">Next \u2192</button>' +
      '</div>' +
    '</div>';
  
  return overlay;
}

/** Current onboarding slide index */
var _onboardingIdx = 0;

/** Show a specific onboarding slide */
function showOnboardingSlide(idx) {
  _onboardingIdx = idx;
  var slideEl = document.getElementById('onboarding-slide');
  var dotsEl = document.getElementById('onboarding-dots');
  var prevBtn = document.getElementById('onboarding-prev');
  var nextBtn = document.getElementById('onboarding-next');
  
  if (!slideEl) return;
  
  var slide = _onboardingSlides[idx];
  if (!slide) return;
  
  slideEl.innerHTML =
    '<div class="onboarding-icon">' + slide.icon + '</div>' +
    '<h2 class="onboarding-title">' + slide.title + '</h2>' +
    '<p class="onboarding-desc">' + slide.desc + '</p>';
  
  // Update dots
  if (dotsEl) {
    dotsEl.innerHTML = '';
    for (var di = 0; di < _onboardingSlides.length; di++) {
      var dot = document.createElement('span');
      dot.className = 'onboarding-dot' + (di === idx ? ' onboarding-dot-active' : '');
      dotsEl.appendChild(dot);
    }
  }
  
  // Update buttons
  if (prevBtn) prevBtn.style.display = idx === 0 ? 'none' : 'inline-flex';
  if (nextBtn) {
    if (idx === _onboardingSlides.length - 1) {
      nextBtn.textContent = '\u2713 Get Started';
      nextBtn.className = 'btn btn-sm';
    } else {
      nextBtn.textContent = 'Next \u2192';
      nextBtn.className = 'btn btn-sm';
    }
  }
}

/** Wire onboarding events */
function wireOnboardingEvents() {
  var skipBtn = document.getElementById('onboarding-skip');
  if (skipBtn) {
    skipBtn.onclick = function() {
      completeOnboarding();
      hideOnboarding();
    };
  }
  
  var prevBtn = document.getElementById('onboarding-prev');
  if (prevBtn) {
    prevBtn.onclick = function() {
      if (_onboardingIdx > 0) showOnboardingSlide(_onboardingIdx - 1);
    };
  }
  
  var nextBtn = document.getElementById('onboarding-next');
  if (nextBtn) {
    nextBtn.onclick = function() {
      if (_onboardingIdx < _onboardingSlides.length - 1) {
        showOnboardingSlide(_onboardingIdx + 1);
      } else {
        completeOnboarding();
        hideOnboarding();
      }
    };
  }
  
  // Keyboard nav (remove previous listener first to avoid duplicates)
  document.removeEventListener('keydown', _onboardingKeyHandler);
  document.addEventListener('keydown', _onboardingKeyHandler);
}

/** Handle keyboard navigation during onboarding */
var _onboardingKeyHandler = function(e) {
  var overlay = document.getElementById('onboarding-overlay');
  if (!overlay || overlay.style.display !== 'flex') {
    document.body.classList.remove('body-overflow-locked');
    return;
  }
  
  if (e.key === 'Escape') {
    e.preventDefault();
    completeOnboarding();
    hideOnboarding();
  } else if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    var nextBtn = document.getElementById('onboarding-next');
    if (nextBtn) nextBtn.click();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    var prevBtn = document.getElementById('onboarding-prev');
    if (prevBtn && prevBtn.style.display !== 'none') prevBtn.click();
  }
};

/** Focus trap for onboarding */
var _onboardingFocusHandler = null;

function trapOnboardingFocus(overlay) {
  var focusable = overlay.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  first.focus();
  
  _onboardingFocusHandler = function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', _onboardingFocusHandler);
}

function releaseOnboardingFocus() {
  if (_onboardingFocusHandler) {
    document.removeEventListener('keydown', _onboardingFocusHandler);
    _onboardingFocusHandler = null;
  }
  // Also remove the keyboard nav handler
  document.removeEventListener('keydown', _onboardingKeyHandler);
}

// ── Toast Notification System ──────────────────────────────────

/**
 * Show a toast notification.
 * Types: 'success', 'error', 'info', 'warning'
 * Auto-dismisses after duration ms.
 */
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3500;
  
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'alert');
  
  var icons = {
    success: '\u2713',
    error: '\u2716',
    info: '\u2139\uFE0F',
    warning: '\u26A0\uFE0F'
  };
  var icon = icons[type] || '\u2139\uFE0F';
  
  toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-message">' + escapeHtml(message) + '</span>';
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(function() {
    toast.classList.add('toast-visible');
  });
  
  // Auto dismiss
  var timer = setTimeout(function() {
    dismissToast(toast);
  }, duration);
  
  // Store timer for manual dismiss
  toast._dismissTimer = timer;
  
  // Click to dismiss
  toast.onclick = function() {
    dismissToast(toast);
  };
}

function dismissToast(toast) {
  if (!toast) return;
  if (toast._dismissTimer) {
    clearTimeout(toast._dismissTimer);
  }
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-hiding');
  setTimeout(function() {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

// ── Enhanced Empty States ──────────────────────────────────────

/**
 * Generate an enhanced empty state HTML with icon, title, description, and action.
 */
function renderEmptyState(icon, title, desc, actionHtml) {
  var html = '<div class="empty-state">';
  html += '<div class="empty-state-icon">' + icon + '</div>';
  html += '<div class="empty-state-title">' + escapeHtml(title) + '</div>';
  html += '<div class="empty-state-desc">' + desc + '</div>';
  if (actionHtml) {
    html += '<div class="empty-state-action">' + actionHtml + '</div>';
  }
  html += '</div>';
  return html;
}

// ── Skeleton Loader ────────────────────────────────────────────

/**
 * Generate a skeleton loading placeholder HTML.
 */
function renderSkeleton(lines, type) {
  type = type || 'card';
  var html = '<div class="skeleton-loading">';
  if (type === 'card') {
    for (var si = 0; si < (lines || 3); si++) {
      var width = 40 + Math.random() * 50;
      html += '<div class="skeleton-line" style="width:' + Math.round(width) + '%"></div>';
    }
  } else if (type === 'chart') {
    html += '<div class="skeleton-chart">';
    for (var ci = 0; ci < (lines || 5); ci++) {
      var h = 20 + Math.random() * 60;
      html += '<div class="skeleton-bar" style="height:' + Math.round(h) + 'px"></div>';
    }
    html += '</div>';
  } else if (type === 'list') {
    for (var li = 0; li < (lines || 4); li++) {
      html += '<div class="skeleton-row"><div class="skeleton-line" style="width:60%"></div><div class="skeleton-line skeleton-line-sm" style="width:25%"></div></div>';
    }
  }
  html += '</div>';
  return html;
}

// ── Offline Status ─────────────────────────────────────────────

/**
 * Update the offline badge with current online/offline status.
 */
function updateOfflineIndicator() {
  var badge = document.getElementById('offline-badge');
  if (!badge) return;
  
  if (navigator.onLine) {
    badge.textContent = '\u2713 Offline ready';
    badge.className = 'offline-badge';
  } else {
    badge.textContent = '\u26A0\uFE0F Offline mode';
    badge.className = 'offline-badge offline-badge-warning';
  }
}

// ── Milestone Celebration ──────────────────────────────────────

/**
 * Show a brief milestone celebration overlay.
 */
function showMilestoneCelebration(milestone) {
  if (!milestone) return;
  
  var overlay = document.createElement('div');
  overlay.className = 'milestone-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', milestone.label + ' achieved!');
  
  overlay.innerHTML =
    '<div class="milestone-card">' +
      '<div class="milestone-icon">' + (milestone.icon || '\uD83C\uDF89') + '</div>' +
      '<div class="milestone-title">Milestone Reached!</div>' +
      '<div class="milestone-name">' + escapeHtml(milestone.label) + '</div>' +
      '<div class="milestone-desc">' + (milestone.insight || '') + '</div>' +
      '<button class="btn btn-sm milestone-btn" id="milestone-close-btn" type="button">\uD83D\uDC4D Awesome!</button>' +
    '</div>';
  
  document.body.appendChild(overlay);
  
  // Animate in
  requestAnimationFrame(function() {
    overlay.classList.add('milestone-visible');
  });
  
  // Close handler
  document.getElementById('milestone-close-btn').onclick = function() {
    overlay.classList.remove('milestone-visible');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 400);
  };
  
  // Auto-close after 4 seconds
  setTimeout(function() {
    var btn = document.getElementById('milestone-close-btn');
    if (btn) btn.click();
  }, 4000);
}

// ── Export ─────────────────────────────────────────────────────

window.__ux = {
  showOnboarding: showOnboarding,
  hideOnboarding: hideOnboarding,
  hasCompletedOnboarding: hasCompletedOnboarding,
  completeOnboarding: completeOnboarding,
  resetOnboarding: resetOnboarding,
  showToast: showToast,
  renderEmptyState: renderEmptyState,
  renderSkeleton: renderSkeleton,
  updateOfflineIndicator: updateOfflineIndicator,
  showMilestoneCelebration: showMilestoneCelebration,
};
