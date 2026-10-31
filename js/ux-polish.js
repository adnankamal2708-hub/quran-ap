// ═══════════════════════════════════════════════════════════════
// ux-polish.js — Premium Onboarding, Tooltips, Empty States, UX
//
// Features:
//   • Premium 3-screen onboarding flow (intro + goal + what to learn)
//   • Learning goal selection (5/10/15/20+ min/day)
//   • Learning track selection (multi-select; Word meanings preselected)
//   • Contextual tooltips for first-time users
//   • Progressive disclosure for advanced features
//   • Enhanced empty states across all views
//   • Toast notification system
//   • Milestone celebrations
// ═══════════════════════════════════════════════════════════════

// ── Storage Keys ──────────────────────────────────────────────
var _ONBOARDING_DONE_KEY = 'quran_onboarding_done';
var _ONBOARDING_STEP_KEY = 'quran_onboarding_step';
var _ONBOARDING_GOAL_KEY = 'quran_onboarding_goal';
var _ONBOARDING_LEVEL_KEY = 'quran_onboarding_level';
var _TOOLTIP_SEEN_KEY = 'quran_tooltip_seen_';
var _PROGRESSIVE_KEY = 'quran_progressive_unlocked';
var _PLAN_PICKER_SEEN_KEY = 'quran_plan_picker_seen';

// Set when onboarding finishes; contextual tooltips only show in that session
var _onboardedThisSession = false;

// ── Welcome Screens (1 consolidated slide) ────────────────────
// The five former intro slides (app, foundation, comprehension, quran,
// srs) were condensed into a single value-prop screen with four short
// bullets — one per key benefit. The old "Your Journey Begins" transition
// slide was deleted; its "Personalize →" CTA now lives on this screen.
var _welcomeSlides = [
  {
    title: 'Understand the Quran, One Word at a Time',
    bullets: [
      'Learn the most frequent Quranic words first — the fastest path to comprehension',
      'Track your comprehension grow as you master each word',
      'Tap any word while reading for meaning, root, and tafsir',
      'Smart reviews use spaced repetition to make words stick'
    ]
  }
];

// ── Onboarding Screen IDs ────────────────────────────────────
var _SCREEN_WELCOME_END = 0; // Consolidated intro slide (only welcome screen)
var _SCREEN_GOAL = 1;        // Learning goal selection
var _SCREEN_LEVEL = 2;       // What do you want to learn? (learning tracks)
var _TOTAL_SCREENS = 3;

// ── Onboarding State ─────────────────────────────────────────
var _onboardingIdx = 0;
var _selectedGoal = null;     // '5', '10', '15', '20'
var _selectedLevel = null;    // 'beginner' (kept for older callers; no longer asked)

// Screen 3 choices: Word meanings is preselected; the other two options are
// not tracks. They combine freely: "completely new" turns on start-from-zero,
// "take a test" opens the placement test once onboarding closes.
var _selectedTracks = [DEFAULT_TRACK_ID];
var _startFromZero = false;
var _wantsPlacementTest = false;
var _CHOICE_NEW = 'new';
var _CHOICE_TEST = 'test';

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

/**
 * Mark onboarding as completed and save preferences. Only what the learner
 * answered is written: a Skip/Escape ({ answered: false }) leaves tracks and
 * start-from-zero alone, and a stored level is never overwritten.
 */
function completeOnboarding(options) {
  var answered = !(options && options.answered === false);
  _onboardedThisSession = true;
  try {
    localStorage.setItem(_ONBOARDING_DONE_KEY, 'true');
    localStorage.removeItem(_ONBOARDING_STEP_KEY);
    // Save preferences
    if (_selectedGoal) localStorage.setItem(_ONBOARDING_GOAL_KEY, _selectedGoal);
    if (_selectedLevel && localStorage.getItem(_ONBOARDING_LEVEL_KEY) === null) {
      localStorage.setItem(_ONBOARDING_LEVEL_KEY, _selectedLevel);
    }
  } catch (e) {}

  if (answered) _applyTrackChoices();

  // Track milestone
  if (window.__feedback && window.__feedback.trackEvent) {
    window.__feedback.trackEvent('onboarding_completed', {
      goal: _selectedGoal || '10',
      level: _selectedLevel || 'beginner'
    });
  }
}

/**
 * Join every selected track the app has released and record "completely new".
 * Joining is idempotent and tracks.js always keeps at least Word meanings
 * joined, so the learner is never left with zero tracks.
 */
function _applyTrackChoices() {
  _selectedTracks.forEach(joinTrack);
  setStartFromZero(_startFromZero);
}

/** Reset onboarding (for revisiting from Profile → Settings) */
function resetOnboarding() {
  try {
    localStorage.removeItem(_ONBOARDING_DONE_KEY);
    localStorage.removeItem(_ONBOARDING_STEP_KEY);
    localStorage.removeItem(_ONBOARDING_GOAL_KEY);
    localStorage.removeItem(_ONBOARDING_LEVEL_KEY);
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

// ── Show Onboarding ──────────────────────────────────────────

function showOnboarding() {
  _onboardingIdx = 0;
  _selectedGoal = null;
  _selectedLevel = null;
  _selectedTracks = [DEFAULT_TRACK_ID];
  _startFromZero = false;
  _wantsPlacementTest = false;

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
    // ── Welcome / intro screen (consolidated) ──
    var slide = _welcomeSlides[idx];
    if (!slide) return;

    html += '<h2 class="onboarding-title">' + slide.title + '</h2>';
    html += '<ul class="onboarding-bullets">';
    for (var bi = 0; bi < slide.bullets.length; bi++) {
      html += '<li>' + slide.bullets[bi] + '</li>';
    }
    html += '</ul>';

  } else if (idx === _SCREEN_GOAL) {
    // ── Learning Goal Selection ──
    html += '<div class="onboarding-icon">' + uiIcon('target', true) + '</div>';
    html += '<h2 class="onboarding-title">Set Your Daily Goal</h2>';
    html += '<p class="onboarding-desc">How much time can you dedicate to learning each day? We\'ll use this to personalize your review schedule.</p>';
    html += '<div class="onboarding-choices" role="radiogroup" aria-label="Daily learning goal">';

    var goals = [
      { value: '5', label: '5 min', desc: 'Casual — just a few words daily' },
      { value: '10', label: '10 min', desc: 'Light — steady and sustainable' },
      { value: '15', label: '15 min', desc: 'Balanced — our recommendation' },
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
    // ── What do you want to learn? (multi-select) ──
    html += '<div class="onboarding-icon">' + uiIcon('brain', true) + '</div>';
    html += '<h2 class="onboarding-title">' + escapeHtml(t('onboarding.tracks.title')) + '</h2>';
    html += '<p class="onboarding-desc">' + escapeHtml(t('onboarding.tracks.desc')) + '</p>';
    // Tracks and the two extra options are separate groups: the extras are
    // not tracks, and both need Word meanings (see _toggleChoice).
    html += '<div class="onboarding-choices" role="group" aria-label="' + escapeHtml(t('onboarding.group.tracks')) + '">';
    html += '<p class="onboarding-group-label">' + escapeHtml(t('onboarding.group.tracks')) + '</p>';
    for (var ti = 0; ti < TRACK_IDS.length; ti++) {
      var trackId = TRACK_IDS[ti];
      html += _renderLearnChoice(trackId, t('track.' + trackId + '.name'), t('track.' + trackId + '.desc'), !isTrackReleased(trackId));
    }
    html += '</div>';
    html += '<div class="onboarding-choices" role="group" aria-label="' + escapeHtml(t('onboarding.group.extras')) + '">';
    html += '<p class="onboarding-group-label">' + escapeHtml(t('onboarding.group.extras')) + '</p>';
    html += _renderLearnChoice(_CHOICE_NEW, t('onboarding.new'), t('onboarding.new.desc'), false);
    html += _renderLearnChoice(_CHOICE_TEST, t('onboarding.test'), t('onboarding.test.desc'), false);
    html += '</div>';
  }

  slideEl.innerHTML = html;

  // ── Update dots ──
  if (dotsEl) {
    dotsEl.innerHTML = '';
    // Progress indicator: a textual step counter beside the dots, so users
    // know how much of the flow is left ("Step 1 of 3").
    var stepLabel = document.createElement('span');
    stepLabel.className = 'onboarding-step-label';
    stepLabel.textContent = 'Step ' + (idx + 1) + ' of ' + _TOTAL_SCREENS;
    dotsEl.appendChild(stepLabel);
    var dotTypeClasses = ['onboarding-dot-welcome', 'onboarding-dot-goal', 'onboarding-dot-level'];
    for (var di = 0; di < _TOTAL_SCREENS; di++) {
      var dot = document.createElement('span');
      dot.className = 'onboarding-dot' + (di === idx ? ' onboarding-dot-active' : '');
      if (dotTypeClasses[di]) dot.classList.add(dotTypeClasses[di]);
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

/** One checkbox option of the "What do you want to learn?" screen */
function _renderLearnChoice(value, label, desc, comingSoon) {
  var checked = !comingSoon && _isChoiceSelected(value);
  var html = '<button class="onboarding-choice' + (checked ? ' onboarding-choice-selected' : '') + (comingSoon ? ' onboarding-choice-disabled' : '') + '" data-value="' + value + '" type="button" role="checkbox" aria-checked="' + (checked ? 'true' : 'false') + '"' + (comingSoon ? ' disabled aria-disabled="true"' : '') + '>';
  html += '<span class="onboarding-choice-value">' + escapeHtml(label) + '</span>';
  html += '<span class="onboarding-choice-desc">' + escapeHtml(desc) + '</span>';
  if (comingSoon) html += '<span class="onboarding-choice-badge">' + escapeHtml(t('tracks.comingSoon')) + '</span>';
  html += '</button>';
  return html;
}

function _isChoiceSelected(value) {
  if (value === _CHOICE_NEW) return _startFromZero;
  if (value === _CHOICE_TEST) return _wantsPlacementTest;
  return _selectedTracks.indexOf(value) >= 0;
}

/**
 * Flip a screen-3 option; returns its new state. Unreleased tracks stay off.
 * "Completely new" and the placement test both use Word meanings (it is the
 * track a new learner starts in and the one the test places), so picking
 * either picks Word meanings too, and dropping Word meanings drops them.
 */
function _toggleChoice(value) {
  var on = !_isChoiceSelected(value);
  if (value === _CHOICE_NEW || value === _CHOICE_TEST) {
    if (value === _CHOICE_NEW) _startFromZero = on;
    else _wantsPlacementTest = on;
    if (on && _selectedTracks.indexOf(DEFAULT_TRACK_ID) === -1) _selectedTracks.push(DEFAULT_TRACK_ID);
  } else if (isTrackReleased(value)) {
    _selectedTracks = _selectedTracks.filter(function(id) { return id !== value; });
    if (on) _selectedTracks.push(value);
    if (!on && value === DEFAULT_TRACK_ID) {
      _startFromZero = false;
      _wantsPlacementTest = false;
    }
  } else {
    return false;
  }
  return on;
}

/** Show every screen-3 option's current state (one tap can change several). */
function _syncLearnChoices() {
  var btns = document.querySelectorAll('.onboarding-choice');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].disabled) continue;
    var on = _isChoiceSelected(btns[i].getAttribute('data-value'));
    btns[i].classList.toggle('onboarding-choice-selected', on);
    btns[i].setAttribute('aria-checked', on ? 'true' : 'false');
  }
}

/** Wire choice button clicks for the goal and learn screens */
function wireChoiceButtons() {
  var choiceBtns = document.querySelectorAll('.onboarding-choice');
  for (var ci = 0; ci < choiceBtns.length; ci++) {
    (function(btn) {
      btn.onclick = function() {
        var value = btn.getAttribute('data-value');
        // Multi-select screen: each option toggles on its own
        if (_onboardingIdx === _SCREEN_LEVEL) {
          _toggleChoice(value);
          _syncLearnChoices();
          return;
        }
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
        }
      };
      btn.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Space toggles a checkbox; it must not also trigger Next
          if (_onboardingIdx === _SCREEN_LEVEL) e.stopPropagation();
          btn.click();
        }
      };
    })(choiceBtns[ci]);
  }
}

/** Check if the plan picker screen has been shown */
function hasSeenPlanPicker() {
  try { return localStorage.getItem(_PLAN_PICKER_SEEN_KEY) === 'true'; }
  catch (e) { return false; }
}

/** Mark the plan picker as seen (one-time) */
function _markPlanPickerSeen() {
  try { localStorage.setItem(_PLAN_PICKER_SEEN_KEY, 'true'); } catch (e) {}
}

/** Show the plan picker overlay (Free / Monthly / Yearly) */
function showPlanPicker() {
  var overlay = document.createElement('div');
  overlay.id = 'plan-picker-overlay';
  overlay.className = 'plan-picker-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Choose your plan');

  overlay.innerHTML =
    '<div class="plan-picker-card">' +
      '<div class="plan-picker-header">' +
        '<h2 class="plan-picker-title">Choose Your Plan</h2>' +
        '<p class="plan-picker-desc">Start free and upgrade anytime. All plans include the full Foundation Course.</p>' +
      '</div>' +
      '<div class="plan-picker-options">' +
        // Each card: name, badge and price on one row, features below and an
        // explicit call to action, so it's clear the whole card is a button.
        // Free plan
        '<button class="plan-card" id="plan-free" type="button" data-plan="free">' +
          '<div class="plan-card-head">' +
            '<div class="plan-card-name">Free</div>' +
            '<div class="plan-card-price">$0</div>' +
          '</div>' +
          '<ul class="plan-card-features">' +
            '<li>Full Foundation Course</li>' +
            '<li>Basic reviews &amp; quizzes</li>' +
            '<li>Top 300 Quranic words</li>' +
          '</ul>' +
          '<span class="plan-card-cta plan-card-cta-quiet">Continue free</span>' +
        '</button>' +
        // Monthly plan
        '<button class="plan-card plan-card-premium" id="plan-monthly" type="button" data-plan="monthly">' +
          '<div class="plan-card-head">' +
            '<div class="plan-card-name">Monthly</div>' +
            '<div class="plan-card-badge">Premium</div>' +
            '<div class="plan-card-price">$2.99<span class="plan-card-period">/mo</span></div>' +
          '</div>' +
          '<ul class="plan-card-features">' +
            '<li>Everything in Free</li>' +
            '<li>All 1,208 Quranic words</li>' +
            '<li>Unlimited reviews &amp; tafsir</li>' +
            '<li>Full word relationships</li>' +
            '<li>Guided Reading &amp; insights</li>' +
            '<li>Cloud sync &amp; data export</li>' +
          '</ul>' +
          '<span class="plan-card-cta">Choose Monthly</span>' +
        '</button>' +
        // Yearly plan — highlighted as the best value
        '<button class="plan-card plan-card-premium plan-card-featured" id="plan-yearly" type="button" data-plan="yearly">' +
          '<div class="plan-card-head">' +
            '<div class="plan-card-name">Yearly</div>' +
            '<div class="plan-card-badge">Best value</div>' +
            '<div class="plan-card-price">$19.99<span class="plan-card-period">/yr</span></div>' +
          '</div>' +
          '<ul class="plan-card-features">' +
            '<li>Everything in Monthly</li>' +
            '<li>~5 months free vs. monthly</li>' +
            '<li>Priority support</li>' +
          '</ul>' +
          '<span class="plan-card-cta">Choose Yearly</span>' +
        '</button>' +
      '</div>' +
      '<div class="plan-picker-footer">' +
        '<button class="plan-picker-skip" id="plan-picker-skip" type="button">Skip — I\'ll decide later</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.classList.add('body-overflow-locked');

  // Wire plan card clicks
  var planCards = overlay.querySelectorAll('.plan-card');
  for (var pci = 0; pci < planCards.length; pci++) {
    (function(card) {
      card.onclick = function() {
        var plan = card.getAttribute('data-plan');
        _handlePlanChoice(plan);
      };
      card.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      };
    })(planCards[pci]);
  }

  // Wire skip link
  var skipBtn = document.getElementById('plan-picker-skip');
  if (skipBtn) {
    skipBtn.onclick = function() {
      _handlePlanChoice('skip');
    };
  }

  // Focus the first card
  if (planCards.length > 0) planCards[0].focus();

  // Animate in
  requestAnimationFrame(function() {
    overlay.classList.add('plan-picker-visible');
  });
}

/** Handle a plan choice from the plan picker */
function _handlePlanChoice(choice) {
  _markPlanPickerSeen();
  hidePlanPicker();

  // Free or skip just closes the picker — the learner stays where they are.
  if ((choice === 'monthly' || choice === 'yearly') &&
      window.__premium && typeof window.__premium.requestUpgrade === 'function') {
    window.__premium.requestUpgrade('plan-picker', { plan: choice });
  }
}

/** Hide the plan picker overlay */
function hidePlanPicker() {
  var overlay = document.getElementById('plan-picker-overlay');
  if (overlay) {
    overlay.classList.remove('plan-picker-visible');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
  document.body.classList.remove('body-overflow-locked');
}

/** Open the next Foundation lesson (the learner's first action after onboarding) */
function _goToNextFoundationLesson() {
  setTimeout(function() {
    if (typeof goToFoundationLesson === 'function') {
      var firstLesson = 0;
      if (typeof getNextIncompleteFoundationLesson === 'function') {
        firstLesson = getNextIncompleteFoundationLesson();
      }
      goToFoundationLesson(firstLesson);
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

/** Apply the daily goal to the review limit and session sizing */
function _applyOnboardingPreferences() {
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
}

/** Navigate to the Foundation Course after onboarding */
function navigateToFirstAction() {
  _applyOnboardingPreferences();
  _goToNextFoundationLesson();
}

/** Where the learner goes once the overlay is closed: the test they asked for, or the first lesson */
function _leaveOnboarding() {
  if (!_wantsPlacementTest || typeof startPlacementTest !== 'function') {
    navigateToFirstAction();
    return;
  }
  _applyOnboardingPreferences();
  startPlacementTest(DEFAULT_TRACK_ID);
}

/**
 * Resolve the LIVE premium state before upselling. isPremium() reads a
 * cached flag that loads asynchronously after login — on a fresh session it
 * can still be false for a genuinely premium user, which used to flash the
 * upgrade picker at them. refresh() re-reads subscriptions/{uid}.
 */
async function _resolvePremium() {
  var premium = window.__premium;
  if (!premium) return false;
  if (typeof premium.refresh === 'function') {
    try { return !!(await premium.refresh()); }
    catch (e) {
      // Refresh failed (e.g. offline) — fall back to the cached state.
      return typeof premium.isPremium === 'function' && !!premium.isPremium();
    }
  }
  return typeof premium.isPremium === 'function' && !!premium.isPremium();
}

/**
 * Wait for Firebase to restore any saved session. Returns false when that
 * can't be confirmed, so a premium user is never upsold just because their
 * session hadn't loaded yet (refresh() treats "no user" as not premium).
 */
async function _authSettled() {
  var core = window.__firebaseCore;
  var auth = core && typeof core.getAuth === 'function' ? core.getAuth() : null;
  if (!auth) return false;
  if (typeof auth.authStateReady === 'function') {
    try { await auth.authStateReady(); } catch (e) { return false; }
  }
  // The app's cached user must agree with Firebase before premium is checked.
  var cached = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  return !auth.currentUser || !!(cached && cached.uid === auth.currentUser.uid);
}

/**
 * Show the plan picker once, on a visit after the learner has finished their
 * first Foundation lesson. It used to appear straight after onboarding, stacked
 * on the tour, the guest banner and the shortcut hints before the learner had
 * seen a single word. Returns true when the picker was shown.
 */
async function maybeShowPlanPicker() {
  if (hasSeenPlanPicker()) return false;
  if (typeof isFoundationLessonCompleted !== 'function' || !isFoundationLessonCompleted(0)) return false;
  if (!(await _authSettled())) return false;
  if (await _resolvePremium()) return false;
  if (document.getElementById('plan-picker-overlay')) return false;
  showPlanPicker();
  return true;
}

// ── Wire Onboarding Events ───────────────────────────────────

/**
 * Skip or Escape: close onboarding without answering the rest. A daily goal
 * stored by an earlier run is kept and not re-applied (applying it would also
 * reset the adaptive goal); a first run still gets the 10-minute default.
 */
function _skipOnboarding() {
  var keepStoredGoal = !_selectedGoal && getOnboardingGoal() !== null;
  if (!keepStoredGoal) _selectedGoal = _selectedGoal || '10';
  _selectedLevel = _selectedLevel || 'beginner';
  completeOnboarding({ answered: false });
  hideOnboarding();
  if (keepStoredGoal) _goToNextFoundationLesson();
  else navigateToFirstAction();
}

function wireOnboardingEvents() {
  var skipBtn = document.getElementById('onboarding-skip');
  if (skipBtn) skipBtn.onclick = _skipOnboarding;

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
      if (_onboardingIdx === _SCREEN_LEVEL && _selectedTracks.length === 0) {
        showToast(t('onboarding.tracks.required'), 'info', 2000);
        return;
      }

      if (_onboardingIdx < _TOTAL_SCREENS - 1) {
        renderOnboardingScreen(_onboardingIdx + 1);
      } else {
        // Last screen — complete and start
        if (!_selectedGoal) _selectedGoal = '10';
        if (!_selectedLevel) _selectedLevel = 'beginner';
        completeOnboarding();
        hideOnboarding();
        _leaveOnboarding();
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
    _skipOnboarding();
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
    icon: 'book-open',
    title: 'Interactive Reading',
    message: 'Tap any highlighted word to see its meaning, root, and tafsir. Mastered words appear in gold; words not studied yet are underlined.',
    position: 'bottom'
  },
  'word-details': {
    selector: '#qa-show-more',
    icon: 'search',
    title: 'Word Details',
    message: 'Tap to see the full word profile — including root family, similar words, and Ibn Kathir tafsir.',
    position: 'top'
  },
  'review-center': {
    selector: '#db-review-center-prompt',
    icon: 'list',
    title: 'Review Center',
    message: 'Your hub for all review modes — flashcards, quizzes, and focused practice sessions.',
    position: 'top'
  },
  'paths': {
    selector: '#tab-learn',
    icon: 'layers',
    title: 'Learning Paths',
    message: 'Switch between Foundation Course, surah-by-surah study, root families, or difficulty-based learning.',
    position: 'top'
  },
  'dashboard': {
    selector: '#tab-home',
    icon: 'chart',
    title: 'Dashboard',
    message: 'Your learning overview — track comprehension, review progress, and discover personalized recommendations.',
    position: 'top'
  }
};

function _clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/**
 * Where a tooltip goes: on its preferred side ('top' = above) of the
 * target's visible part, flipped when that side has no room, and always
 * inside the viewport above view.bottomInset (the phone tab bar). A target
 * taller than half the viewport (a whole view) gets the tooltip inside it,
 * near the top of what is showing.
 * Returns { top, left, side: 'top' | 'bottom' | 'inside', arrowX }.
 */
function _tooltipPlacement(target, tip, view, preferred) {
  var margin = 8;
  var gap = 8;
  var minTop = margin;
  var maxTop = view.height - view.bottomInset - tip.height - margin;
  var visibleTop = Math.max(target.top, 0);
  var visibleBottom = Math.min(target.bottom, view.height - view.bottomInset);
  var left = _clamp(target.left + (target.width - tip.width) / 2, margin, view.width - tip.width - margin);
  var arrowX = _clamp(target.left + target.width / 2 - left, 16, tip.width - 16);

  if (visibleBottom - visibleTop > view.height / 2) {
    return { top: _clamp(visibleTop + gap, minTop, maxTop), left: left, side: 'inside', arrowX: arrowX };
  }
  var above = visibleTop - tip.height - gap;
  var below = visibleBottom + gap;
  var fitsAbove = above >= minTop;
  var fitsBelow = below <= maxTop;
  var side = preferred === 'bottom'
    ? (fitsBelow || !fitsAbove ? 'bottom' : 'top')
    : (fitsAbove || !fitsBelow ? 'top' : 'bottom');
  return { top: _clamp(side === 'top' ? above : below, minTop, maxTop), left: left, side: side, arrowX: arrowX };
}

/**
 * Height of the tab bar when it sits along the bottom (phones); 0 when it
 * is a sidebar, or when `el` is in the tab bar (a tip about a tab).
 */
function _bottomNavInset(el) {
  if (el && el.closest && el.closest('.bottom-nav')) return 0;
  var nav = document.querySelector('.bottom-nav');
  if (!nav || !nav.getBoundingClientRect) return 0;
  var r = nav.getBoundingClientRect();
  return r.height > 0 && r.top > window.innerHeight / 2 ? Math.max(0, window.innerHeight - r.top) : 0;
}

/** True when some of the element shows in the viewport (always true where layout is unknown). */
function _isOnScreen(el) {
  if (!window.innerHeight) return true;
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight - _bottomNavInset(el);
}

/** Tips waiting for their target to scroll into view, by id */
var _tooltipWatchers = {};

/** Show the tip once its target is in view (fully, or half the screen of a tall one). */
function _showTooltipWhenVisible(tipId, targetEl) {
  if (_tooltipWatchers[tipId] || typeof IntersectionObserver !== 'function') return;
  _tooltipWatchers[tipId] = new IntersectionObserver(function(entries) {
    var entry = entries[0];
    if (!entry.isIntersecting) return;
    if (entry.intersectionRatio < 1 && entry.intersectionRect.height < window.innerHeight / 2) return;
    _tooltipWatchers[tipId].disconnect();
    delete _tooltipWatchers[tipId];
    showTooltip(tipId);
  }, { threshold: [0, 0.5, 1] });
  _tooltipWatchers[tipId].observe(targetEl);
}

/**
 * Show a contextual tooltip for a first-time user.
 * Each tooltip is shown only once, when its target is on screen; it
 * follows the target as the page scrolls and closes once it scrolls away.
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
  if (!_isOnScreen(targetEl)) {
    _showTooltipWhenVisible(tipId, targetEl);
    return;
  }

  // Mark as seen
  try { localStorage.setItem(_TOOLTIP_SEEN_KEY + tipId, 'true'); } catch (e) {}

  // Create tooltip element
  var tooltip = document.createElement('div');
  tooltip.className = 'ux-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.innerHTML =
    '<div class="ux-tooltip-header">' + (tip.icon ? uiIcon(tip.icon) : '') + (tip.title || '') + '</div>' +
    '<div class="ux-tooltip-body">' + (tip.message || '') + '</div>' +
    '<button class="ux-tooltip-close" type="button" aria-label="Got it">Got it</button>';

  document.body.appendChild(tooltip);

  function place() {
    var tipRect = tooltip.getBoundingClientRect();
    var spot = _tooltipPlacement(
      targetEl.getBoundingClientRect(),
      { width: tipRect.width, height: tipRect.height },
      { width: window.innerWidth, height: window.innerHeight, bottomInset: _bottomNavInset(targetEl) },
      tip.position
    );
    tooltip.className = 'ux-tooltip ux-tooltip-' + spot.side + (tooltip.classList.contains('ux-tooltip-visible') ? ' ux-tooltip-visible' : '');
    tooltip.style.left = spot.left + 'px';
    tooltip.style.top = spot.top + 'px';
    if (tooltip.style.setProperty) tooltip.style.setProperty('--ux-tooltip-arrow-x', spot.arrowX + 'px');
  }

  function dismiss() {
    document.removeEventListener('scroll', onScroll, true);
    if (window.removeEventListener) window.removeEventListener('resize', onScroll);
    tooltip.classList.remove('ux-tooltip-visible');
    setTimeout(function() {
      if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    }, 250);
  }

  function onScroll() {
    if (!tooltip.parentNode) return;
    if (_isOnScreen(targetEl)) place();
    else dismiss();
  }

  place();
  document.addEventListener('scroll', onScroll, true);
  if (window.addEventListener) window.addEventListener('resize', onScroll);

  // Animate in
  requestAnimationFrame(function() {
    tooltip.classList.add('ux-tooltip-visible');
  });

  // Close handler
  var closeBtn = tooltip.querySelector('.ux-tooltip-close');
  if (closeBtn) closeBtn.onclick = dismiss;

  // Auto-dismiss after 6 seconds
  setTimeout(function() {
    if (tooltip.parentNode) dismiss();
  }, 6000);
}

/**
 * Show relevant tooltips based on the current view — only in the session
 * where the learner finished onboarding. Before that they landed on top of
 * the onboarding dialog; existing learners never get them out of the blue.
 */
function showContextualTooltips(viewName) {
  if (!_onboardedThisSession) return;

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
  html += '<div class="empty-state-icon">' + dataIcon(icon, true) + '</div>';
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
    success: 'check-circle',
    error: 'x',
    info: 'info',
    warning: 'alert-triangle'
  };
  var icon = uiIcon(icons[type] || 'info', true);

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
// POST-LESSON SIGN-IN PROMPT
// ═══════════════════════════════════════════════════════════════

/** localStorage key — set when the prompt has been shown (suppresses repeat) */
var _SIGNIN_PROMPT_KEY = 'bayan_signin_prompt_shown';

/**
 * Show a non-blocking, one-shot sign-in prompt after a guest completes
 * their first lesson. Auto-dismisses after 8 s. Dismissible by tapping ✕.
 * Suppressed when: user is signed in, or prompt was already shown.
 */
function showPostLessonSignInPrompt() {
  // Guard: only for guests
  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (user) return;

  // Guard: already shown this session (or ever)
  try {
    if (localStorage.getItem(_SIGNIN_PROMPT_KEY) === '1') return;
  } catch (e) { return; }

  // Mark as shown immediately (prevents repeat even if dismissed/ignored)
  try { localStorage.setItem(_SIGNIN_PROMPT_KEY, '1'); } catch (e) { /* ignore */ }

  // Remove any existing prompt first
  var existing = document.querySelector('.signin-prompt');
  if (existing) existing.remove();

  var el = document.createElement('div');
  el.className = 'signin-prompt';
  el.setAttribute('role', 'status');
  el.innerHTML =
    '<span class="signin-prompt-text">Nice work — <a href="#" class="signin-prompt-action" id="signin-prompt-link">sign in</a> to save this progress.</span>' +
    '<button type="button" class="signin-prompt-dismiss" id="signin-prompt-dismiss" aria-label="Dismiss">\u2715</button>';

  document.body.appendChild(el);

  // Sign-in link — opens the existing auth flow
  var link = document.getElementById('signin-prompt-link');
  if (link) {
    link.onclick = function (e) {
      e.preventDefault();
      el.remove();
      if (typeof showAuthView === 'function') showAuthView('login');
      if (typeof switchView === 'function') switchView('auth');
    };
  }

  // Dismiss button
  var dismissBtn = document.getElementById('signin-prompt-dismiss');
  if (dismissBtn) {
    dismissBtn.onclick = function () {
      el.classList.add('hiding');
      setTimeout(function () { el.remove(); }, 220);
    };
  }

  // Auto-dismiss after 8 seconds
  setTimeout(function () {
    if (el.parentNode) {
      el.classList.add('hiding');
      setTimeout(function () { el.remove(); }, 220);
    }
  }, 8000);
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
      '<div class="milestone-icon">' + dataIcon(milestone.icon || 'celebration', true) + '</div>' +
      '<div class="milestone-title">Milestone Reached!</div>' +
      '<div class="milestone-name">' + escapeHtml(milestone.label) + '</div>' +
      '<div class="milestone-desc">' + (milestone.insight || '') + '</div>' +
      '<button class="btn btn-sm milestone-btn" id="milestone-close-btn" type="button">' + uiIcon('thumbs-up') + 'Awesome!</button>' +
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
  showTooltip: showTooltip,
  showContextualTooltips: showContextualTooltips,
  resetTooltips: resetTooltips,
  getProgressiveVisibility: getProgressiveVisibility,
  applyProgressiveDisclosure: applyProgressiveDisclosure,
  unlockProgressiveFeature: unlockProgressiveFeature,
  showToast: showToast,
  showPostLessonSignInPrompt: showPostLessonSignInPrompt,
  renderEmptyState: renderEmptyState,
  getContextualEmptyState: getContextualEmptyState,
  renderSkeleton: renderSkeleton,
  showMilestoneCelebration: showMilestoneCelebration,
  // Plan picker
  showPlanPicker: showPlanPicker,
  maybeShowPlanPicker: maybeShowPlanPicker,
  hidePlanPicker: hidePlanPicker,
  hasSeenPlanPicker: hasSeenPlanPicker,
};

// Direct global alias for convenience
window.showToast = showToast;
