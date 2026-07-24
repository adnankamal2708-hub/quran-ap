// ═══════════════════════════════════════════════════════════════
// ux-polish.js — Premium Onboarding, Tooltips, Empty States, UX
//
// Features:
//   • Premium 9-screen onboarding flow (welcome + goal + level + notifications)
//   • Learning goal selection (5/10/15/20+ min/day)
//   • Experience level selection (Beginner/Some/Intermediate/Advanced)
//   • Notification preference (skippable)
//   • Contextual tooltips for first-time users
//   • Progressive disclosure for advanced features
//   • Enhanced empty states across all views
//   • Toast notification system
//   • Milestone celebrations
//   • Offline indicator
// ═══════════════════════════════════════════════════════════════

// ── Storage Keys ──────────────────────────────────────────────
var _ONBOARDING_DONE_KEY = 'quran_onboarding_done';
var _ONBOARDING_STEP_KEY = 'quran_onboarding_step';
var _ONBOARDING_GOAL_KEY = 'quran_onboarding_goal';
var _ONBOARDING_LEVEL_KEY = 'quran_onboarding_level';
var _ONBOARDING_NOTIFY_KEY = 'quran_onboarding_notify';
var _TOOLTIP_SEEN_KEY = 'quran_tooltip_seen_';
var _PROGRESSIVE_KEY = 'quran_progressive_unlocked';

// ── Welcome Screens (6 premium slides) ────────────────────────
var _welcomeSlides = [
  {
    icon: '📖',
    title: 'Welcome to Bayan',
    desc: 'Your personal guide to understanding the Quran, one word at a time.<br><br>Bayan uses the science of spaced repetition to help you build lasting Quranic vocabulary — so you can read and understand the Quran in its original language.',
    highlight: 'app'
  },
  {
    icon: '📚',
    title: 'Learn Step by Step',
    desc: 'The Foundation Course teaches you the most frequent Quranic words first — giving you the highest comprehension gains in the shortest time.<br><br>Each lesson introduces new words, shows them in real Quranic verses, and tests your understanding.',
    highlight: 'foundation'
  },
  {
    icon: '📊',
    title: 'Track Your Comprehension',
    desc: 'See exactly how much of the Quran\'s vocabulary you understand. Your comprehension percentage grows as you master more words — showing your real progress toward understanding the Quran.',
    highlight: 'comprehension'
  },
  {
    icon: '📖',
    title: 'Read with Interactive Words',
    desc: 'Every vocabulary word in the Quran view is color-coded by your mastery level. Tap any word to see its meaning, root, and tafsir — turning reading into active learning.',
    highlight: 'quran'
  },
  {
    icon: '🔄',
    title: 'Smart Reviews',
    desc: 'Our Spaced Repetition System schedules reviews at the optimal time — words you find difficult appear more often, while words you know well show up less. This maximizes retention while minimizing study time.',
    highlight: 'srs'
  },
  {
    icon: '✨',
    title: 'Your Journey Begins',
    desc: 'You\'re just a few steps away from starting your Quran comprehension journey. Let\'s personalize your experience to make learning fit your life.',
    highlight: 'ready'
  }
];

// ── Onboarding Screen IDs ────────────────────────────────────
var _SCREEN_WELCOME = 0;     // First of 6 welcome screens
var _SCREEN_WELCOME_END = 5; // Last welcome screen
var _SCREEN_GOAL = 6;        // Learning goal selection
var _SCREEN_LEVEL = 7;       // Experience level
var _SCREEN_NOTIFY = 8;      // Notifications
var _TOTAL_SCREENS = 9;

// ── Onboarding State ─────────────────────────────────────────
var _onboardingIdx = 0;
var _selectedGoal = null;     // '5', '10', '15', '20'
var _selectedLevel = null;    // 'beginner', 'some', 'intermediate', 'advanced'
var _selectedNotify = null;   // true, false

// ── Progress persistence ─────────────────────────────────────

/** Check if onboarding has been completed */
function hasCompletedOnboarding() {
  try { return localStorage.getItem(_ONBOARDING_DONE_KEY) === 'true'; }
  catch (e) { return false; }
}

/** Check if onboarding was interrupted and can be resumed */
function hasInterruptedOnboarding() {
  try {
    var step = localStorage.getItem(_ONBOARDING_STEP_KEY);
    return step !== null && !hasCompletedOnboarding();
  } catch (e) { return false; }
}

/** Mark onboarding as completed and save preferences */
function completeOnboarding() {
  try {
    localStorage.setItem(_ONBOARDING_DONE_KEY, 'true');
    localStorage.removeItem(_ONBOARDING_STEP_KEY);
    // Save preferences
    if (_selectedGoal) localStorage.setItem(_ONBOARDING_GOAL_KEY, _selectedGoal);
    if (_selectedLevel) localStorage.setItem(_ONBOARDING_LEVEL_KEY, _selectedLevel);
    if (_selectedNotify !== null) localStorage.setItem(_ONBOARDING_NOTIFY_KEY, _selectedNotify ? 'true' : 'false');
  } catch (e) {}
}

/** Reset onboarding (for revisiting from Profile → Settings) */
function resetOnboarding() {
  try {
    localStorage.removeItem(_ONBOARDING_DONE_KEY);
    localStorage.removeItem(_ONBOARDING_STEP_KEY);
    localStorage.removeItem(_ONBOARDING_GOAL_KEY);
    localStorage.removeItem(_ONBOARDING_LEVEL_KEY);
    localStorage.removeItem(_ONBOARDING_NOTIFY_KEY);
  } catch (e) {}
}

/** Save current step for interruption recovery */
function _saveOnboardingStep(idx) {
  try { localStorage.setItem(_ONBOARDING_STEP_KEY, idx); } catch (e) {}
}

/** Get saved learning preference */
function getOnboardingGoal() {
  try { return localStorage.getItem(_ONBOARDING_GOAL_KEY); } catch (e) { return null; }
}

function getOnboardingLevel() {
  try { return localStorage.getItem(_ONBOARDING_LEVEL_KEY); } catch (e) { return null; }
}

function getOnboardingNotify() {
  try { return localStorage.getItem(_ONBOARDING_NOTIFY_KEY) === 'true'; } catch (e) { return false; }
}

// ── Show Onboarding ──────────────────────────────────────────

function showOnboarding() {
  _onboardingIdx = 0;
  _selectedGoal = null;
  _selectedLevel = null;
  _selectedNotify = null;

  // Check if there's an interrupted step to resume
  if (hasInterruptedOnboarding()) {
    try {
      var savedStep = parseInt(localStorage.getItem(_ONBOARDING_STEP_KEY), 10);
      if (!isNaN(savedStep) && savedStep >= 0 && savedStep < _TOTAL_SCREENS) {
        _onboardingIdx = savedStep;
        // Restore any already-saved preferences
        if (savedStep > _SCREEN_GOAL) {
          var savedGoal = localStorage.getItem(_ONBOARDING_GOAL_KEY);
          if (savedGoal) _selectedGoal = savedGoal;
        }
        if (savedStep > _SCREEN_LEVEL) {
          var savedLevel = localStorage.getItem(_ONBOARDING_LEVEL_KEY);
          if (savedLevel) _selectedLevel = savedLevel;
        }
      }
    } catch (e) {}
  }

  var overlay = document.getElementById('onboarding-overlay');
  if (!overlay) {
    overlay = createOnboardingOverlay();
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  document.body.classList.add('body-overflow-locked');
  trapOnboardingFocus(overlay);
  wireOnboardingEvents();
  renderOnboardingScreen(_onboardingIdx);
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

/** Create the onboarding overlay DOM (extensible for all screens) */
function createOnboardingOverlay() {
  var overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.className = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome to Bayan');

  overlay.innerHTML =
    '<div class="onboarding-card onboarding-premium" id="onboarding-card">' +
      '<button class="onboarding-skip-btn" id="onboarding-skip" type="button" aria-label="Skip tour">✖ Skip</button>' +
      '<div class="onboarding-slide" id="onboarding-slide"></div>' +
      '<div class="onboarding-dots" id="onboarding-dots"></div>' +
      '<div class="onboarding-nav">' +
        '<button class="btn btn-sm btn-outline" id="onboarding-prev" type="button" aria-label="Previous">← Back</button>' +
        '<button class="btn btn-sm" id="onboarding-next" type="button" aria-label="Next">Next →</button>' +
      '</div>' +
    '</div>';

  return overlay;
}

// ── Render an individual onboarding screen ───────────────────

function renderOnboardingScreen(idx) {
  _onboardingIdx = idx;
  var slideEl = document.getElementById('onboarding-slide');
  var dotsEl = document.getElementById('onboarding-dots');
  var prevBtn = document.getElementById('onboarding-prev');
  var nextBtn = document.getElementById('onboarding-next');
  var cardEl = document.getElementById('onboarding-card');

  if (!slideEl) return;

  // Save progress for interruption recovery
  _saveOnboardingStep(idx);

  var html = '';
  var isLastScreen = (idx === _TOTAL_SCREENS - 1);
  var isWelcome = (idx <= _SCREEN_WELCOME_END);

  if (isWelcome) {
    // ── Welcome / intro screen ──
    var slide = _welcomeSlides[idx];
    if (!slide) return;

    html += '<div class="onboarding-icon">' + slide.icon + '</div>';
    html += '<h2 class="onboarding-title">' + slide.title + '</h2>';
    html += '<p class="onboarding-desc">' + slide.desc + '</p>';

  } else if (idx === _SCREEN_GOAL) {
    // ── Learning Goal Selection ──
    html += '<div class="onboarding-icon">🎯</div>';
    html += '<h2 class="onboarding-title">Set Your Daily Goal</h2>';
    html += '<p class="onboarding-desc">How much time can you dedicate to learning each day? We\'ll use this to personalize your review schedule.</p>';
    html += '<div class="onboarding-choices" role="radiogroup" aria-label="Daily learning goal">';

    var goals = [
      { value: '5', label: '5 min', desc: 'Casual — just a few words daily' },
      { value: '10', label: '10 min', desc: 'Light — steady and sustainable' },
      { value: '15', label: '15 min', desc: 'Balanced — our recommendation ✨' },
      { value: '20', label: '20+ min', desc: 'Intensive — fastest progress' }
    ];
    for (var gi = 0; gi < goals.length; gi++) {
      var g = goals[gi];
      var gSelected = (_selectedGoal === g.value);
      html += '<button class="onboarding-choice' + (gSelected ? ' onboarding-choice-selected' : '') + '" data-value="' + g.value + '" type="button" role="radio" aria-checked="' + (gSelected ? 'true' : 'false') + '">';
      html += '<span class="onboarding-choice-value">' + g.label + '</span>';
      html += '<span class="onboarding-choice-desc">' + g.desc + '</span>';
      html += '</button>';
    }
    html += '</div>';

  } else if (idx === _SCREEN_LEVEL) {
    // ── Experience Level Selection ──
    html += '<div class="onboarding-icon">🧠</div>';
    html += '<h2 class="onboarding-title">Your Experience Level</h2>';
    html += '<p class="onboarding-desc">How familiar are you with Quranic vocabulary? This helps us personalize recommendations — you\'ll still start with the Foundation Course.</p>';
    html += '<div class="onboarding-choices" role="radiogroup" aria-label="Experience level">';

    var levels = [
      { value: 'beginner', label: 'Beginner', desc: 'New to Quranic Arabic vocabulary' },
      { value: 'some', label: 'Some Knowledge', desc: 'Know a handful of common words' },
      { value: 'intermediate', label: 'Intermediate', desc: 'Recognize many words, but gaps remain' },
      { value: 'advanced', label: 'Advanced', desc: 'Strong vocabulary but want structured review' }
    ];
    for (var li = 0; li < levels.length; li++) {
      var lv = levels[li];
      var lSelected = (_selectedLevel === lv.value);
      html += '<button class="onboarding-choice' + (lSelected ? ' onboarding-choice-selected' : '') + '" data-value="' + lv.value + '" type="button" role="radio" aria-checked="' + (lSelected ? 'true' : 'false') + '">';
      html += '<span class="onboarding-choice-value">' + lv.label + '</span>';
      html += '<span class="onboarding-choice-desc">' + lv.desc + '</span>';
      html += '</button>';
    }
    html += '</div>';

  } else if (idx === _SCREEN_NOTIFY) {
    // ── Notifications Preference ──
    html += '<div class="onboarding-icon">🔔</div>';
    html += '<h2 class="onboarding-title">Daily Reminders</h2>';
    html += '<p class="onboarding-desc">Would you like daily reminders to keep your learning streak alive? You can change this anytime in Settings.</p>';
    html += '<div class="onboarding-choices" role="radiogroup" aria-label="Notification preference">';

    var notifyYes = (_selectedNotify !== false); // Default to yes
    html += '<button class="onboarding-choice' + (notifyYes ? ' onboarding-choice-selected' : '') + '" data-value="true" type="button" role="radio" aria-checked="' + (notifyYes ? 'true' : 'false') + '">';
    html += '<span class="onboarding-choice-value">🔔 Yes, remind me daily</span>';
    html += '<span class="onboarding-choice-desc">Stay consistent with gentle reminders</span>';
    html += '</button>';

    html += '<button class="onboarding-choice' + (!notifyYes ? ' onboarding-choice-selected' : '') + '" data-value="false" type="button" role="radio" aria-checked="' + (!notifyYes ? 'true' : 'false') + '">';
    html += '<span class="onboarding-choice-value">🔕 No, thanks</span>';
    html += '<span class="onboarding-choice-desc">I\'ll visit when I\'m ready</span>';
    html += '</button>';

    html += '</div>';
  }

  slideEl.innerHTML = html;

  // ── Update dots ──
  if (dotsEl) {
    var dotCount = isWelcome ? _welcomeSlides.length : (_TOTAL_SCREENS - _SCREEN_WELCOME_END - 1);
    var dotGroup = isWelcome ? 0 : (idx - _SCREEN_GOAL + 1);
    var dotActive = isWelcome ? idx : dotGroup - 1;
    var totalDots = _TOTAL_SCREENS;
    dotsEl.innerHTML = '';
    for (var di = 0; di < totalDots; di++) {
      var dot = document.createElement('span');
      dot.className = 'onboarding-dot' + (di === idx ? ' onboarding-dot-active' : '');
      if (di < _SCREEN_WELCOME_END) {
        dot.classList.add('onboarding-dot-welcome');
      } else if (di === _SCREEN_GOAL) {
        dot.classList.add('onboarding-dot-goal');
      } else if (di === _SCREEN_LEVEL) {
        dot.classList.add('onboarding-dot-level');
      } else if (di === _SCREEN_NOTIFY) {
        dot.classList.add('onboarding-dot-notify');
      }
      dotsEl.appendChild(dot);
    }
  }

  // ── Update buttons ──
  if (prevBtn) {
    prevBtn.style.display = (idx === 0) ? 'none' : 'inline-flex';
  }

  if (nextBtn) {
    if (isLastScreen) {
      nextBtn.textContent = '✓ Start Learning';
      nextBtn.className = 'btn btn-sm onboarding-start-btn';
    } else if (idx === _SCREEN_WELCOME_END) {
      nextBtn.textContent = 'Personalize →';
      nextBtn.className = 'btn btn-sm';
    } else {
      nextBtn.textContent = 'Next →';
      nextBtn.className = 'btn btn-sm';
    }
  }

  // ── Wire choice buttons for selection screens ──
  wireChoiceButtons();
}

/** Wire choice button clicks for goal/level/notification screens */
function wireChoiceButtons() {
  var choiceBtns = document.querySelectorAll('.onboarding-choice');
  for (var ci = 0; ci < choiceBtns.length; ci++) {
    (function(btn) {
      btn.onclick = function() {
        var value = btn.getAttribute('data-value');
        // Deselect all siblings
        var parent = btn.parentNode;
        var siblings = parent.querySelectorAll('.onboarding-choice');
        for (var si = 0; si < siblings.length; si++) {
          siblings[si].classList.remove('onboarding-choice-selected');
          siblings[si].setAttribute('aria-checked', 'false');
        }
        // Select this one
        btn.classList.add('onboarding-choice-selected');
        btn.setAttribute('aria-checked', 'true');

        // Store value based on which screen we're on
        if (_onboardingIdx === _SCREEN_GOAL) {
          _selectedGoal = value;
        } else if (_onboardingIdx === _SCREEN_LEVEL) {
          _selectedLevel = value;
        } else if (_onboardingIdx === _SCREEN_NOTIFY) {
          _selectedNotify = (value === 'true');
        }
      };
      btn.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      };
    })(choiceBtns[ci]);
  }
}

/** Navigate to the Foundation Course after onboarding */
function navigateToFirstAction() {
  // Apply onboarding preferences to the adaptive engine.
  // This is the single integration point — the bridge handles goal,
  // daily review limits, and session sizing based on onboarding selections.
  if (window.__learnerProfile && window.__learnerProfile.applyOnboarding) {
    window.__learnerProfile.applyOnboarding();
  } else if (_selectedGoal && window.__srs && window.__srs.updateDailyReviewLimit) {
    // Fallback: if bridge not loaded, apply basic review limit from goal
    var goalMinutes = parseInt(_selectedGoal, 10) || 10;
    var reviewLimit = Math.max(10, Math.min(100, goalMinutes * 5));
    window.__srs.updateDailyReviewLimit(reviewLimit);
  }

  // Navigate to Foundation Course (go directly, skip intermediate dashboard)
  setTimeout(function() {
    if (typeof goToFoundationLesson === 'function') {
      var firstLesson = 0;
      if (typeof getNextIncompleteFoundationLesson === 'function') {
        firstLesson = getNextIncompleteFoundationLesson();
      }
      // Small delay to let hideOnboarding()/overlay cleanup finish
      setTimeout(function() {
        goToFoundationLesson(firstLesson);
      }, 200);
    } else if (typeof switchView === 'function') {
      switchView('dashboard');
      setTimeout(function() {
        if (typeof goToFoundationLesson === 'function') {
          goToFoundationLesson(0);
        } else {
          switchView('learn');
        }
      }, 500);
    }
  }, 200);
}

// ── Wire Onboarding Events ───────────────────────────────────

function wireOnboardingEvents() {
  var skipBtn = document.getElementById('onboarding-skip');
  if (skipBtn) {
    skipBtn.onclick = function() {
      _selectedGoal = _selectedGoal || '10'; // Default to 10 min
      _selectedLevel = _selectedLevel || 'beginner';
      if (_selectedNotify === null) _selectedNotify = true;
      completeOnboarding();
      hideOnboarding();
      navigateToFirstAction();
    };
  }

  var prevBtn = document.getElementById('onboarding-prev');
  if (prevBtn) {
    prevBtn.onclick = function() {
      if (_onboardingIdx > 0) {
        renderOnboardingScreen(_onboardingIdx - 1);
      }
    };
  }

  var nextBtn = document.getElementById('onboarding-next');
  if (nextBtn) {
    nextBtn.onclick = function() {
      // Validate selection screens require a choice
      if (_onboardingIdx === _SCREEN_GOAL && !_selectedGoal) {
        showToast('Please select a daily learning goal.', 'info', 2000);
        return;
      }
      if (_onboardingIdx === _SCREEN_LEVEL && !_selectedLevel) {
        showToast('Please select your experience level.', 'info', 2000);
        return;
      }
      if (_onboardingIdx === _SCREEN_NOTIFY && _selectedNotify === null) {
        _selectedNotify = true; // Default to yes
      }

      if (_onboardingIdx < _TOTAL_SCREENS - 1) {
        renderOnboardingScreen(_onboardingIdx + 1);
      } else {
        // Last screen — complete and start
        if (!_selectedGoal) _selectedGoal = '10';
        if (!_selectedLevel) _selectedLevel = 'beginner';
        if (_selectedNotify === null) _selectedNotify = true;
        completeOnboarding();
        hideOnboarding();
        navigateToFirstAction();
      }
    };
  }

  // Remove and re-add keyboard handler
  document.removeEventListener('keydown', _onboardingKeyHandler);
  document.addEventListener('keydown', _onboardingKeyHandler);
}

/** Handle keyboard navigation during onboarding */
var _onboardingKeyHandler = function(e) {
  var overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  var overlayStyle = window.getComputedStyle ? window.getComputedStyle(overlay) : overlay.style;
  if (overlayStyle.display === 'none') {
    document.body.classList.remove('body-overflow-locked');
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    if (!_selectedGoal) _selectedGoal = '10';
    if (!_selectedLevel) _selectedLevel = 'beginner';
    if (_selectedNotify === null) _selectedNotify = true;
    completeOnboarding();
    hideOnboarding();
    navigateToFirstAction();
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
  document.removeEventListener('keydown', _onboardingKeyHandler);
}

// ═══════════════════════════════════════════════════════════════
// TOOLTIP SYSTEM — Contextual first-time tips
// ═══════════════════════════════════════════════════════════════

var _tooltips = {
  'quran-mode': {
    selector: '#view-quran',
    title: '📖 Interactive Reading',
    message: 'Tap any colored word to see its meaning, root, and tafsir. Mastered words appear in gold, new words in red.',
    position: 'bottom'
  },
  'word-details': {
    selector: '#qa-show-more',
    title: '🔍 Word Details',
    message: 'Tap to see the full word profile — including root family, similar words, and Ibn Kathir tafsir.',
    position: 'top'
  },
  'review-center': {
    selector: '#db-review-center-prompt',
    title: '📋 Review Center',
    message: 'Your hub for all review modes — flashcards, quizzes, and focused practice sessions.',
    position: 'top'
  },
  'paths': {
    selector: '#tab-paths',
    title: '📚 Learning Paths',
    message: 'Switch between Foundation Course, surah-by-surah study, root families, or difficulty-based learning.',
    position: 'top'
  },
  'dashboard': {
    selector: '#tab-dashboard',
    title: '🏠 Dashboard',
    message: 'Your learning overview — track comprehension, review progress, and discover personalized recommendations.',
    position: 'top'
  }
};

/**
 * Show a contextual tooltip for a first-time user.
 * Each tooltip is shown only once.
 */
function showTooltip(tipId) {
  if (!tipId || !_tooltips[tipId]) return;
  // Check if already seen
  try {
    if (localStorage.getItem(_TOOLTIP_SEEN_KEY + tipId) === 'true') return;
  } catch (e) {}

  var tip = _tooltips[tipId];
  var targetEl = document.querySelector(tip.selector);
  if (!targetEl) return;

  // Mark as seen
  try { localStorage.setItem(_TOOLTIP_SEEN_KEY + tipId, 'true'); } catch (e) {}

  // Create tooltip element
  var tooltip = document.createElement('div');
  tooltip.className = 'ux-tooltip ux-tooltip-' + (tip.position || 'top');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.innerHTML =
    '<div class="ux-tooltip-header">' + (tip.title || '') + '</div>' +
    '<div class="ux-tooltip-body">' + (tip.message || '') + '</div>' +
    '<button class="ux-tooltip-close" type="button" aria-label="Got it">Got it</button>';

  document.body.appendChild(tooltip);

  // Position relative to target
  var targetRect = targetEl.getBoundingClientRect();
  var tipRect = tooltip.getBoundingClientRect();
  var padding = 8;

  if (tip.position === 'top') {
    tooltip.style.left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, targetRect.left + (targetRect.width - tipRect.width) / 2)) + 'px';
    tooltip.style.top = (targetRect.top - tipRect.height - padding) + 'px';
  } else if (tip.position === 'bottom') {
    tooltip.style.left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, targetRect.left + (targetRect.width - tipRect.width) / 2)) + 'px';
    tooltip.style.top = (targetRect.bottom + padding) + 'px';
  }

  // Animate in
  requestAnimationFrame(function() {
    tooltip.classList.add('ux-tooltip-visible');
  });

  // Close handler
  var closeBtn = tooltip.querySelector('.ux-tooltip-close');
  if (closeBtn) {
    closeBtn.onclick = function() {
      tooltip.classList.remove('ux-tooltip-visible');
      setTimeout(function() {
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 250);
    };
  }

  // Auto-dismiss after 6 seconds
  setTimeout(function() {
    if (tooltip.parentNode) {
      tooltip.classList.remove('ux-tooltip-visible');
      setTimeout(function() {
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 250);
    }
  }, 6000);
}

/** Show relevant tooltips based on the current view */
function showContextualTooltips(viewName) {
  if (hasCompletedOnboarding()) return;

  if (viewName === 'quran') {
    showTooltip('quran-mode');
  } else if (viewName === 'learn') {
    showTooltip('word-details');
    setTimeout(function() { showTooltip('paths'); }, 1000);
  } else if (viewName === 'dashboard') {
    setTimeout(function() { showTooltip('dashboard'); }, 500);
    setTimeout(function() { showTooltip('review-center'); }, 1500);
  }
}

/** Reset all seen tooltip flags */
function resetTooltips() {
  try {
    var keys = Object.keys(localStorage);
    for (var ki = 0; ki < keys.length; ki++) {
      if (keys[ki].indexOf(_TOOLTIP_SEEN_KEY) === 0) {
        localStorage.removeItem(keys[ki]);
      }
    }
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// PROGRESSIVE DISCLOSURE — Hide advanced features until relevant
// ═══════════════════════════════════════════════════════════════

/**
 * Check which advanced features should be visible based on user progress.
 * Uses localStorage to persist unlocked features.
 */
function getProgressiveFeatures() {
  var unlocked = {};
  try {
    var raw = localStorage.getItem(_PROGRESSIVE_KEY);
    if (raw) unlocked = JSON.parse(raw);
  } catch (e) {}

  return unlocked;
}

function saveProgressiveFeature(feature) {
  try {
    var unlocked = getProgressiveFeatures();
    unlocked[feature] = true;
    localStorage.setItem(_PROGRESSIVE_KEY, JSON.stringify(unlocked));
  } catch (e) {}
}

/**
 * Determine which features should be shown/hidden based on user progress.
 * Returns an object with visibility flags.
 */
function getProgressiveVisibility() {
  var unlocked = getProgressiveFeatures();
  var srsObj = window.__srs;
  var srsStats = (srsObj && srsObj.getStats) ? srsObj.getStats() : {};
  var totalReviews = srsStats.totalReviews || 0;
  var matureWords = srsStats.mature || 0;
  var completedLessons = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;

  return {
    // Show root analysis after completing at least 3 lessons
    showRootAnalysis: unlocked.rootAnalysis || completedLessons >= 3,
    // Show word network after at least 5 reviews
    showWordNetwork: unlocked.wordNetwork || totalReviews >= 5,
    // Show kanji-style explorer after 10+ reviews
    showExplorer: unlocked.explorer || totalReviews >= 10,
    // Show SRS health stats after 20+ reviews
    showSRSHealth: unlocked.srsHealth || totalReviews >= 20,
    // Show analytics after 30+ reviews
    showAnalytics: unlocked.analytics || totalReviews >= 30,
    // Show quran after completing 1 lesson
    showQuran: unlocked.quran || completedLessons >= 1 || totalReviews > 0,
    // Show advanced filters after 50+ reviews
    showAdvancedFilters: unlocked.advancedFilters || totalReviews >= 50,
    // Show review center dashboard prompt
    showReviewCenter: true,
  };
}

/**
 * Update progressive disclosure elements in the DOM.
 */
function applyProgressiveDisclosure() {
  var vis = getProgressiveVisibility();

  // Root box (root analysis)
  var rootBox = document.getElementById('root-box');
  if (rootBox) {
    rootBox.style.display = vis.showRootAnalysis ? 'block' : 'none';
  }

  // Word network (similar/opposite/related)
  var wordNetwork = document.getElementById('word-network');
  if (wordNetwork) {
    wordNetwork.style.display = vis.showWordNetwork ? 'block' : 'none';
  }

  // Extended relationships
  var extRelations = document.getElementById('extended-relationships');
  if (extRelations) {
    extRelations.style.display = vis.showWordNetwork ? 'block' : 'none';
  }

  // Explorer tab (if view exists)
  var tabExplorer = document.getElementById('tab-explorer');
  if (tabExplorer) {
    tabExplorer.style.display = vis.showExplorer ? '' : 'none';
  }

  // Analytics tab
  var tabAnalytics = document.getElementById('tab-analytics');
  if (tabAnalytics) {
    tabAnalytics.style.display = vis.showAnalytics ? '' : 'none';
  }

  // SRS rating buttons visibility (show after first word card)
  var srsRow = document.getElementById('srs-row');
  if (srsRow) {
    // Get totalReviews directly since it's not in scope from getProgressiveVisibility()
    var _srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
    var _totalReviews = _srsStats.totalReviews || 0;
    srsRow.style.display = (vis.showSRSHealth || _totalReviews > 0) ? '' : 'none';
  }
}

/** Unlock a progressive feature early (e.g., from settings) */
function unlockProgressiveFeature(feature) {
  saveProgressiveFeature(feature);
  applyProgressiveDisclosure();
}

// ═══════════════════════════════════════════════════════════════
// ENHANCED EMPTY STATES
// ═══════════════════════════════════════════════════════════════

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

/**
 * Get contextual empty state for a specific view/section
 */
function getContextualEmptyState(section) {
  var states = {
    bookmarks: {
      icon: '⭐',
      title: 'No Bookmarks Yet',
      desc: 'Bookmark words you want to review later. Tap the star icon on any word card to save it here.',
      action: '<button class="btn btn-sm" onclick="switchView(\'list\')">Browse Vocabulary</button>'
    },
    notes: {
      icon: '📝',
      title: 'No Notes Yet',
      desc: 'Add personal notes to any word to help you remember. Notes sync across devices when you create an account.',
      action: null
    },
    'reading-history': {
      icon: '📖',
      title: 'No Reading History',
      desc: 'Start reading a surah to build your reading history. The Quran view shows every word color-coded by your mastery level.',
      action: '<button class="btn btn-sm" onclick="switchView(\'quran\')">Open Quran</button>'
    },
    achievements: {
      icon: '🏆',
      title: 'No Achievements Yet',
      desc: 'Complete the Foundation Course, maintain streaks, and master words to earn achievements. Your first one is just around the corner!',
      action: '<button class="btn btn-sm" onclick="if(typeof goToFoundationLesson===\'function\')goToFoundationLesson(0)">Start Foundation Course</button>'
    },
    reviews: {
      icon: '✅',
      title: 'All Caught Up!',
      desc: 'No reviews due right now. Check back later or learn new words to build your review queue.',
      action: '<button class="btn btn-sm" onclick="if(typeof goToFoundationLesson===\'function\')goToFoundationLesson(0)">Learn New Words</button>'
    },
    'reading-progress': {
      icon: '📖',
      title: 'Start Your Reading Journey',
      desc: 'Select a surah from the list to begin reading interactively. Every word you\'ve studied is color-coded for instant recognition.',
      action: '<button class="btn btn-sm" onclick="switchView(\'quran\')">Browse Surahs</button>'
    },
    'foundation': {
      icon: '📚',
      title: 'Start the Foundation Course',
      desc: 'The fastest path to Quran comprehension. Master the most frequent words first and build a strong vocabulary foundation.',
      action: '<button class="btn btn-sm" onclick="if(typeof goToFoundationLesson===\'function\')goToFoundationLesson(0)">Begin Course</button>'
    },
    'surah-progress': {
      icon: '📊',
      title: 'Learn Your First Surah',
      desc: 'Study the vocabulary of individual surahs to understand them in depth. Your comprehension percentage grows as you learn more words.',
      action: '<button class="btn btn-sm" onclick="switchView(\'learn\')">Start Learning</button>'
    }
  };

  return states[section] || null;
}

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════

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
    success: '✓',
    error: '✖',
    info: 'ℹ️',
    warning: '⚠️'
  };
  var icon = icons[type] || 'ℹ️';

  toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-message">' + escapeHtml(message) + '</span>';

  container.appendChild(toast);

  requestAnimationFrame(function() {
    toast.classList.add('toast-visible');
  });

  var timer = setTimeout(function() {
    dismissToast(toast);
  }, duration);

  toast._dismissTimer = timer;

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

// ═══════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// OFFLINE STATUS
// ═══════════════════════════════════════════════════════════════

function updateOfflineIndicator() {
  var badge = document.getElementById('offline-badge');
  if (!badge) return;

  if (navigator.onLine) {
    badge.textContent = '✓ Offline ready';
    badge.className = 'offline-badge';
  } else {
    badge.textContent = '⚠️ Offline mode';
    badge.className = 'offline-badge offline-badge-warning';
  }
}

// ═══════════════════════════════════════════════════════════════
// MILESTONE CELEBRATION
// ═══════════════════════════════════════════════════════════════

function showMilestoneCelebration(milestone) {
  if (!milestone) return;

  var overlay = document.createElement('div');
  overlay.className = 'milestone-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', milestone.label + ' achieved!');

  overlay.innerHTML =
    '<div class="milestone-card">' +
      '<div class="milestone-icon">' + (milestone.icon || '🎉') + '</div>' +
      '<div class="milestone-title">Milestone Reached!</div>' +
      '<div class="milestone-name">' + escapeHtml(milestone.label) + '</div>' +
      '<div class="milestone-desc">' + (milestone.insight || '') + '</div>' +
      '<button class="btn btn-sm milestone-btn" id="milestone-close-btn" type="button">👍 Awesome!</button>' +
    '</div>';

  document.body.appendChild(overlay);

  requestAnimationFrame(function() {
    overlay.classList.add('milestone-visible');
  });

  document.getElementById('milestone-close-btn').onclick = function() {
    overlay.classList.remove('milestone-visible');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 400);
  };

  setTimeout(function() {
    var btn = document.getElementById('milestone-close-btn');
    if (btn) btn.click();
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__ux = {
  showOnboarding: showOnboarding,
  hideOnboarding: hideOnboarding,
  hasCompletedOnboarding: hasCompletedOnboarding,
  hasInterruptedOnboarding: hasInterruptedOnboarding,
  completeOnboarding: completeOnboarding,
  resetOnboarding: resetOnboarding,
  getOnboardingGoal: getOnboardingGoal,
  getOnboardingLevel: getOnboardingLevel,
  getOnboardingNotify: getOnboardingNotify,
  showTooltip: showTooltip,
  showContextualTooltips: showContextualTooltips,
  resetTooltips: resetTooltips,
  getProgressiveVisibility: getProgressiveVisibility,
  applyProgressiveDisclosure: applyProgressiveDisclosure,
  unlockProgressiveFeature: unlockProgressiveFeature,
  showToast: showToast,
  renderEmptyState: renderEmptyState,
  getContextualEmptyState: getContextualEmptyState,
  renderSkeleton: renderSkeleton,
  updateOfflineIndicator: updateOfflineIndicator,
  showMilestoneCelebration: showMilestoneCelebration,
};

// Direct global alias for convenience
window.showToast = showToast;
