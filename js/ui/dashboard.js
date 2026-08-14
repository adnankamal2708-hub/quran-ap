// ═══════════════════════════════════════════════════════════════
// dashboard.js — Premium Learning Hub Dashboard
//
// Enhanced dashboard layout:
//   1. Greeting + Compact Stats Bar
//   2. Quran Comprehension Headline (prominent card)
//   3. Today's Goal (personalized with progress bar)
//   4. Continue Reading (last read or recommendation)
//   5. Continue Learning (resume current path)
//   6. Smart Recommendations (up to 3 personalized)
//   7. Progress Overview (compact stat cards)
//   8. Daily Motivation (dynamic, real-progress-based message)
//
// Every interactive element has a direct onclick handler.
// No stale DOM cache references — uses document.getElementById directly.
// ═══════════════════════════════════════════════════════════════

// ── Review Forecast Cache ────────────────────────────────────
// Prevents re-iterating over ALL_WORDS (78K) × 4 intervals = 312K iterations
// on every dashboard render. Only recomputes when SRS data changes.
var _forecastCache = null;
var _forecastCacheKey = null;

/** Build a cache key that changes when SRS stats or word set changes. */
function _getForecastCacheKey() {
  var $st = typeof getSRSStats === 'function' ? getSRSStats() : {};
  // $st.total already reflects the canonical word count (getSRSStats iterates
  // getCanonicalWords()), which is the same space _computeForecast() now uses.
  return ($st.total || 0) + '|' + ($st.dueToday || 0) + '|' + ($st.reviewsToday || 0) + '|' + ($st.total || 0);
}

/** Compute the 4-interval forecast: count of words due within Today, 3d, 7d, 14d. */
function _computeForecast() {
  var $srsDataRaw = typeof loadSRS === 'function' ? loadSRS() : {};
  var $now = Date.now();
  var $dayMs = 24 * 60 * 60 * 1000;
  var $intervals = [
    { label: 'Today', days: 0, color: 'var(--gold)' },
    { label: '3 Days', days: 3, color: 'var(--blue)' },
    { label: '7 Days', days: 7, color: 'var(--green)' },
    { label: '14 Days', days: 14, color: 'var(--purple)' },
  ];
  // Iterate canonical words — srsData keys are canonical cw_N ids after
  // loadSRS() migration, so raw w_N lookups never match (canonical-vs-raw ID bug).
  var $allWordsArr = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  var $result = [];
  for (var $ii = 0; $ii < $intervals.length; $ii++) {
    var $int = $intervals[$ii];
    var $cut = $now + $int.days * $dayMs;
    var $cnt = 0;
    for (var $wi = 0; $wi < $allWordsArr.length; $wi++) {
      var $e = $srsDataRaw[$allWordsArr[$wi].id];
      if ($e && $e.dueDate && $e.dueDate <= $cut) $cnt++;
    }
    $result.push({ label: $int.label, color: $int.color, count: $cnt });
  }
  return $result;
}

/**
 * Get cached forecast. Recomputes only when SRS stats change.
 * Exposed globally as getCachedReviewForecast() for external use.
 */
function getCachedReviewForecast() {
  var $key = _getForecastCacheKey();
  if (_forecastCache !== null && _forecastCacheKey === $key) {
    return _forecastCache;
  }
  _forecastCache = _computeForecast();
  _forecastCacheKey = $key;
  return _forecastCache;
}

/** Force recompute on next call. Call after SRS data is saved. */
function invalidateReviewForecast() {
  _forecastCache = null;
  _forecastCacheKey = null;
}

// Export globally so srs.js can call invalidate on save
if (typeof window !== 'undefined') {
  window.getCachedReviewForecast = getCachedReviewForecast;
  window.invalidateReviewForecast = invalidateReviewForecast;
}

function renderDashboard() {
  try {
  var $d = document.getElementById('dashboard-grid');
  if (!$d) return;

  // Invalidate DOM cache to prevent stale references from re-renders
  if (typeof DOM === 'object' && DOM.invalidateCache) DOM.invalidateCache();

  // ── Adaptive engine data ──
  var $adaptive = window.__adaptive ? window.__adaptive.getDashboardData() : null;
  var $weaknesses = $adaptive ? $adaptive.weaknesses : [];
  var $goalProgress = $adaptive ? $adaptive.goalProgress : null;

  // ── Learning journey state (for contextual messages) ──
  var $journeyState = window.__learningJourney && window.__learningJourney.getCurrentState
    ? window.__learningJourney.getCurrentState() : null;
  var $momentum = $journeyState ? $journeyState.momentum : null;
  var $hasMomentum = $momentum && ($momentum.lessonsCompleted > 0 || $momentum.wordsReviewed > 0 || $momentum.wordsLearned > 0);

  // ── Gather ALL data once ──
  var $srsObj = window.__srs;
  var $srsStats = ($srsObj && $srsObj.getStats) ? $srsObj.getStats() : (typeof getSRSStats === 'function' ? getSRSStats() : { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 });
  if (!$srsStats) $srsStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };

  var $dueReviews = typeof getDueReviews === 'function' ? getDueReviews() : [];
  var $streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var $streak = $streakData.streak || 0;

  // Foundation data
  var $fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var $fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var $fPct = $fTotal > 0 ? Math.round(($fCompleted / $fTotal) * 100) : 0;
  var $fNextIdx = typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0;
  var $nextIncompleteF = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
  var $fLesson = (typeof FOUNDATION_LESSONS !== 'undefined' && FOUNDATION_LESSONS && FOUNDATION_LESSONS[$nextIncompleteF]) ? FOUNDATION_LESSONS[$nextIncompleteF] : null;

  // Coverage & comprehension
  var $coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var $comprehensionPct = $coverage ? $coverage.estimatedComprehension : 0;
  var $coveragePct = $coverage ? $coverage.coveragePercent : 0;
  var $masteredCount = $srsStats.mature || 0;
  var $totalWords = $srsStats.total || (typeof getCanonicalWordCount === 'function' && getCanonicalWordCount() > 0 ? getCanonicalWordCount() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 0));

  // Surah data
  var $surahProgress = typeof getSurahLessonProgress === 'function' ? getSurahLessonProgress() : null;
  var $surahCompleted = $surahProgress ? $surahProgress.completedSurahs : 0;
  var $surahTotal = $surahProgress ? $surahProgress.totalSurahs : (typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary().length : 90);

  // Root family data
  var $rfTotal = typeof getTotalRootFamilyCount === 'function' ? getTotalRootFamilyCount() : 0;
  var $rfCompleted = typeof getCompletedRootFamilyCount === 'function' ? getCompletedRootFamilyCount() : 0;
  var $rfPct = $rfTotal > 0 ? Math.round(($rfCompleted / $rfTotal) * 100) : 0;

  // Difficulty data
  var $diffCompleted = typeof getCompletedDifficultyLevelCount === 'function' ? getCompletedDifficultyLevelCount() : 0;
  var $diffTotal = 5;
  var $diffPct = Math.round(($diffCompleted / $diffTotal) * 100);
  var $dp = typeof loadDifficultyProgress === 'function' ? loadDifficultyProgress() : null;
  var $diffCurrent = $dp ? $dp.currentDifficulty || 1 : 1;

  // Mixed review
  var $mixedQueue = typeof getMixedReviewQueue === 'function' ? getMixedReviewQueue() : [];
  var $mixedCount = $mixedQueue.length || 0;

  // Reviews
  var $dueCount = $dueReviews.length;
  var $reviewsToday = $srsStats.reviewsToday || 0;

  // Surah comprehension
  var $allSurahComp = typeof getAllSurahComprehension === 'function' ? getAllSurahComprehension() : [];
  var $surahsWith50Plus = 0;
  for (var $si = 0; $si < $allSurahComp.length; $si++) {
    if ($allSurahComp[$si].estimatedComprehension >= 50) $surahsWith50Plus++;
  }
  var $surahsTotalC = $allSurahComp.length;

  // Milestone (coverage-based — milestones are calibrated to real token coverage,
  // not the comprehension estimate)
  var $ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus($coveragePct) : null;
  var $milestoneText = '';
  if ($ms && $ms.currentMilestone) {
    $milestoneText = $ms.currentMilestone.icon + ' ' + $ms.currentMilestone.label;
  }

  // Foundation hero fields
  var $heroLesson = $fLesson || {};
  var $nextLessonTitle = $heroLesson.thematicTitle || '';
  var $nextLessonNum = ($nextIncompleteF || 0) + 1;
  var $compGain = $heroLesson.comprehensionGain || 0;
  var $projComp = $heroLesson.projectedComprehension || 0;
  var $lessonCoverage = $heroLesson.lessonCoverage || '0%';

  // Determine recommendation state
  var $foundationComplete = $fTotal > 0 && $fCompleted >= $fTotal;
  var $noProgress = $fCompleted === 0 && $masteredCount === 0;
  var $continueLabel = $noProgress ? 'Start Foundation Course' : ($foundationComplete ? 'Learn by Surah' : 'Continue Foundation Course');

  // SVG helper — uses the comprehensive icon system in components.js
  var $icons = window.__components && window.__components.createSVGIcon;
  function $icon(name, size) {
    if ($icons) return $icons(name, {size: size || 22});
    // Fallback: map icon names to SVG or emoji characters
    var $fallback = {
      book: '📖', layers: '📚', list: '📋', chart: '📊', bolt: '⚡', star: '⭐', target: '🎯',
      fire: '🔥', check: '✓', brain: '🧠', clock: '⏰', crown: '👑', repeat: '🔄',
      'arrow-right': '→', 'arrow-left': '←', 'check-circle': '✅', lightbulb: '💡',
      celebration: '🎉', leaf: '🌱', link: '🔗', 'map-pin': '📍', heart: '❤️',
      'alert-triangle': '⚠️', mail: '📧', edit: '✏️', search: '🔍', award: '🏆',
      'refresh-cw': '🔄', 'log-out': '🚪', key: '🔑', trash: '🗑️', lock: '🔒',
      unlock: '🔓', moon: '🌙', 'help-circle': '❓', 'chevron-right': '▶',
      'chevron-left': '◀', trend: '📈', trending: '📈', flag: '📌', sun: '☀️',
      'message-circle': '💬', plus: '+', minus: '-', x: '✗', 'star-fill': '⭐',
      'upload-cloud': '📤', 'download-cloud': '📥', info: 'ℹ️', 'thumbs-up': '👍',
      'book-open': '📖', 'zap-off': '⚡', sliders: '🔍', 'external-link': '🔗',
      'volume-2': '🔊', 'log-in': '📥',
    };
    return $fallback[name] || '✦';
  }

  // ── Build HTML ──
  var $h = '';



  // ── Reading position (used by multiple sections) ──
  var $lastRead = null;
  if (window.__quran && typeof window.__quran.getLastReadPosition === 'function') {
    $lastRead = window.__quran.getLastReadPosition();
  }

  // ── Comprehension insight (for motivation & headline) ──
  var $compInsight = (typeof getComprehensionInsight === 'function') ? getComprehensionInsight() : null;
  var $compDeltas = $compInsight || {};
  var $compMilestone = $compInsight ? ($compInsight.milestoneCurrent ? $compInsight.milestoneCurrent.label : '') : '';

  // ═══ 1. GREETING — Contextual greeting based on learner stage (Part 1) ═══
  // ── Day-2+ return greeting: acknowledge previous session ──
  var $returningGreeting = '';
  if ($fCompleted > 0 && $reviewsToday === 0 && $dueCount === 0 && $masteredCount <= 10) {
    // Returning user who has done lessons but hasn't started today's work yet
    if ($fCompleted === 1) {
      $returningGreeting = 'Welcome back! You completed Lesson 1. Your review schedule is building.';
    } else if ($fCompleted > 1 && $fCompleted <= 3) {
      $returningGreeting = 'Welcome back! You\'ve completed ' + $fCompleted + ' lessons. Keep the momentum going.';
    }
  }

  var $greetingSub = '';
  if ($returningGreeting) {
    $greetingSub = $returningGreeting;
  } else if ($noProgress) {
    $greetingSub = 'Today we begin building your Quran vocabulary.';
  } else if ($foundationComplete) {
    $greetingSub = 'Time to strengthen your vocabulary through real Quran reading.';
  } else if ($fTotal > 0 && $fPct >= 50) {
    $greetingSub = 'You are halfway through the Foundation Course!';
  } else if ($fTotal > 0 && $fPct >= 25) {
    $greetingSub = 'You are building your Quran foundation.';
  } else if ($fTotal > 0 && $fCompleted > 0) {
    $greetingSub = 'Every word you learn unlocks more of the Quran.';
  } else if ($streak > 0) {
    $greetingSub = 'Keep your streak alive — every review strengthens your understanding.';
  } else if ($comprehensionPct > 0) {
    $greetingSub = 'You understand ' + $comprehensionPct + '% of Quranic vocabulary. Keep going!';
  } else {
    $greetingSub = 'Your journey to understand the Quran begins here.';
  }
  $h += '<div class="db-greeting">';
  $h += '<div class="db-greeting-icon" aria-hidden="true">' + $icon('book', 28) + '</div>';
  $h += '<div>';
  var $premiumBadge = (window.__premium && window.__premium.isPremium()) ? ' <span class="db-premium-badge">⭐ Premium</span>' : '';
  $h += '<h2 class="db-greeting-title">Assalamu Alaikum' + $premiumBadge + '</h2>';
  $h += '<p class="db-greeting-sub">' + $greetingSub + '</p>';
  $h += '</div></div>';

  // ═══ 2. QURAN COMPREHENSION HEADLINE ═══
  // Ring + milestone are only meaningful once real comprehension exists — a 0%
  // ring is zero-noise for brand-new users, so render a simple welcome line instead.
  $h += '<div class="db-card db-comp-headline" id="db-comp-headline"' + ($comprehensionPct > 0 ? ' tabindex="0" role="button" aria-label="Quran comprehension: ' + $comprehensionPct + '%"' : '') + '>';
  if ($comprehensionPct > 0) {
  $h += '<div class="db-comp-headline-ring-wrap">';
  $h += '<svg class="db-ring db-comp-headline-ring" viewBox="0 0 36 36" aria-hidden="true">';
  $h += '<defs><linearGradient id="compGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
  $h += '<stop offset="0%" stop-color="#c9a84c"/><stop offset="100%" stop-color="#e8c97a"/>';
  $h += '</linearGradient></defs>';
  var $compRing = Math.min(100, Math.max(0, Math.round(($comprehensionPct / 100) * 100)));
  $h += '<path class="db-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>';
  $h += '<path class="db-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $compRing + ', 100" stroke="url(#compGrad)"/>';
  $h += '<text class="db-ring-text" x="18" y="20.5" font-weight="700" font-size="9">' + $comprehensionPct + '%</text>';
  $h += '</svg></div>';
  }
  $h += '<div class="db-comp-headline-info">';
  if ($comprehensionPct > 0) {
  $h += '<div class="db-comp-headline-value">' + $comprehensionPct + '% Quran Comprehension</div>';
  } else {
  $h += '<div class="db-comp-headline-value">Begin your journey to understand the Quran</div>';
  }
  // Encouraging message based on progress level
  var $encouragementMsg = '';
  if ($comprehensionPct >= 80) {
    $encouragementMsg = 'Exceptional! You understand the vast majority of Quranic vocabulary. ✨';
  } else if ($comprehensionPct >= 60) {
    $encouragementMsg = 'Strong progress! Most verses are now accessible to you. 📖';
  } else if ($comprehensionPct >= 40) {
    $encouragementMsg = 'Building steadily! You can follow the flow of longer passages. 📚';
  } else if ($comprehensionPct >= 20) {
    $encouragementMsg = 'Growing familiarity! Short verses are becoming recognizable. 🌱';
  } else if ($comprehensionPct > 0) {
    $encouragementMsg = 'Every word counts! Keep going — you are building real understanding. 💪';
  } else {
    $encouragementMsg = 'Start learning Quranic vocabulary to unlock comprehension.';
  }
  $h += '<div class="db-comp-headline-msg">' + $encouragementMsg + '</div>';
  if ($compMilestone && $comprehensionPct > 0) {
    $h += '<div class="db-comp-headline-milestone">🎯 ' + $compMilestone + '</div>';
  }
  $h += '</div></div>';
  // ── Comprehension Metrics Row — at zero data only Total Words is real info ──
  $h += '<div class="db-comp-metrics">';
  if ($coveragePct === 0 && $masteredCount === 0) {
    $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $totalWords + '</div><div class="db-comp-metric-label">Total Words</div></div>';
  } else {
  $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $coveragePct + '%</div><div class="db-comp-metric-label">Coverage</div></div>';
  $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $masteredCount + '</div><div class="db-comp-metric-label">Mastered</div></div>';
  $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $totalWords + '</div><div class="db-comp-metric-label">Total Words</div></div>';
  }
  $h += '</div>';
  $h += '</div>';

  // ═══ 3. TODAY'S GOAL ═══
  $h += '<div class="db-card db-goal-card" id="db-goal-card">';
  $h += '<div class="db-section-label db-section-label-compact"><span class="db-section-icon" aria-hidden="true">' + $icon('target', 14) + '</span> Today\'s Goal</div>';
  
  // Compute goal: daily review target (default 25) or from goal progress
  // For brand-new users with no progress, show a simple "Complete Lesson 1" goal
  if ($noProgress) {
    $h += '<div class="db-goal-new-user">';
    $h += '<div style="font-size:13px;color:var(--text);margin-bottom:4px">🎯 Complete your first Foundation lesson</div>';
    $h += '<div style="font-size:11px;color:var(--text-muted)">Each lesson introduces 10 new Quranic words</div>';
    $h += '</div>';
    $h += '</div>';
  } else {
  var $dailyGoalTarget = 25;
  var $dailyGoalProgress = $reviewsToday;
  if ($goalProgress && $goalProgress.targetMinutes) {
    $dailyGoalTarget = $goalProgress.targetMinutes;
    $dailyGoalProgress = $goalProgress.progressMinutes || 0;
  } else if ($dueCount > 0) {
    $dailyGoalTarget = Math.max($dueCount, 10);
    $dailyGoalProgress = $reviewsToday;
  }
  var $goalPct = Math.min(100, $dailyGoalTarget > 0 ? Math.round(($dailyGoalProgress / $dailyGoalTarget) * 100) : 0);
  var $remaining = Math.max(0, $dailyGoalTarget - $dailyGoalProgress);
  
  $h += '<div class="db-goal-progress-wrap">';
  $h += '<div class="db-goal-bar">';
  $h += '<div class="db-goal-bar-track">';
  $h += '<div class="db-goal-bar-fill" style="width:' + $goalPct + '%"></div>';
  $h += '</div>';
  $h += '<span class="db-goal-bar-text">' + $dailyGoalProgress + ' / ' + $dailyGoalTarget + '</span>';
  $h += '</div>';
  $h += '</div>';
  
  // Remaining tasks and estimated completion time
  $h += '<div class="db-goal-details">';
  if ($remaining > 0) {
    $h += '<div class="db-goal-remaining">';
    $h += '<span class="db-goal-remaining-icon" aria-hidden="true">' + $icon('clock', 14) + '</span>';
    $h += '<span>' + $remaining + ' item' + ($remaining !== 1 ? 's' : '') + ' remaining</span>';
    // Estimate: ~30 seconds per review item
    var $estMinutes = Math.ceil($remaining * 0.5);
    if ($estMinutes < 1) $estMinutes = 1;
    $h += '<span class="db-goal-estimate">~' + $estMinutes + ' min</span>';
    $h += '</div>';
  } else if ($dailyGoalProgress > 0) {
    $h += '<div class="db-goal-complete">';
    $h += '<span>' + $icon('check-circle', 14) + ' Goal complete! 🎉</span>';
    $h += '</div>';
  } else {
    $h += '<div class="db-goal-remaining">';
    $h += '<span class="db-goal-remaining-icon" aria-hidden="true">' + $icon('clock', 14) + '</span>';
    $h += '<span>' + $dailyGoalTarget + ' reviews to start</span>';
    $h += '</div>';
  }
  $h += '</div>';
  $h += '</div>';
  } // end else (daily goal for non-new users)

  // ═══ 4. CONTINUE READING ═══
  $h += '<div class="db-section-label"><span class="db-section-icon" aria-hidden="true">' + $icon('book', 14) + '</span> Continue Reading</div>';
  
  if ($lastRead && $lastRead.surahId) {
    // Last read position available — show resume card
    var $lastSurahInfo = typeof getSurahInfo === 'function' ? getSurahInfo($lastRead.surahId) : null;
    var $lastSurahName = $lastSurahInfo ? $lastSurahInfo.name : 'Surah ' + $lastRead.surahId;
    var $lastSurahEnglish = $lastSurahInfo ? $lastSurahInfo.english : '';
    var $lastVerseLabel = '';
    if ($lastRead.verseKey) {
      var $vNum = parseInt($lastRead.verseKey.split(':')[1], 10) || 0;
      $lastVerseLabel = ' — Verse ' + $vNum;
    }
    var $lastTimeAgo = '';
    if ($lastRead.date) {
      var $hoursAgo = Math.round((Date.now() - $lastRead.date) / (1000 * 60 * 60));
      if ($hoursAgo < 1) $lastTimeAgo = 'Just now';
      else if ($hoursAgo < 24) $lastTimeAgo = $hoursAgo + 'h ago';
      else $lastTimeAgo = Math.round($hoursAgo / 24) + 'd ago';
    }

    $h += '<div class="db-card db-action-card db-card-highlight" id="db-continue-reading" tabindex="0" role="button" aria-label="Continue reading ' + $lastSurahName + $lastVerseLabel + '">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon db-icon-gold-dim">📖</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">' + $lastSurahName + '</div>';
    $h += '<div class="db-card-sub">' + $lastSurahEnglish + $lastVerseLabel + ' · ' + $lastTimeAgo + '</div>';
    $h += '</div>';
    $h += '<button class="btn btn-sm" type="button">Continue</button>';
    $h += '</div></div>';
  } else {
    // No reading history — recommend a starting surah
    $h += '<div class="db-card db-action-card" id="db-continue-reading-start" tabindex="0" role="button" aria-label="Start reading the Quran">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon db-icon-gold-faint">📖</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">Start Reading</div>';
    $h += '<div class="db-card-sub">Begin your Quran reading journey with Surah Al-Fatiha</div>';
    $h += '</div>';
    $h += '<button class="btn btn-sm" type="button">Begin</button>';
    $h += '</div></div>';
  }

  // ═══ 5. CONTINUE LEARNING ═══
  $h += '<div class="db-section-label"><span class="db-section-icon" aria-hidden="true">' + $icon('layers', 14) + '</span> Continue Learning</div>';
  
  // Determine next learning step
  if ($fTotal > 0 && !$foundationComplete) {
    $h += '<div class="db-card db-action-card db-card-highlight" id="db-continue-learning" tabindex="0" role="button" aria-label="Continue Foundation Course">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon db-icon-gold-dim">' + $icon('layers', 22) + '</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">Foundation Course</div>';
    $h += '<div class="db-card-sub">';
    if ($nextLessonTitle) $h += $nextLessonTitle + ' · ';
    $h += 'Lesson ' + $nextLessonNum + ' of ' + $fTotal + '</div>';
    $h += '</div>';
    $h += '<button class="btn btn-sm" type="button">Resume</button>';
    $h += '</div>';
    // Foundation progress bar
    $h += '<div class="db-progress db-progress-tight">';
    $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $fPct + '%"></div></div>';
    $h += '<span class="db-progress-text">' + $fCompleted + '/' + $fTotal + '</span>';
    $h += '</div></div>';
  } else if ($foundationComplete && window.__phase2 && window.__phase2.getLearningPhase) {
    // ── Foundation complete — show Graduation + Phase 2 state ──
    // Check if this is the first time seeing Foundation complete (graduation moment)
    var $_gradKey = 'bayan_grad_seen';
    var $_gradSeen = false;
    try { $_gradSeen = localStorage.getItem($_gradKey) === '1'; } catch (e) {}
    
    // Show graduation celebration card (first time only)
    if (!$_gradSeen && window.__phase2.getGraduationData) {
      var $_gradData = window.__phase2.getGraduationData();
      $h += '<div class="db-card" id="db-graduation" style="background:linear-gradient(135deg,var(--surface2),rgba(201,168,76,0.06));border:1px solid var(--gold);">';
      $h += '<div class="db-card-row" style="padding:4px 0">';
      $h += '<span style="font-size:32px">' + $_gradData.icon + '</span>';
      $h += '<div class="db-card-body">';
      $h += '<div class="db-card-title" style="font-size:16px;color:var(--gold)">' + $_gradData.title + '</div>';
      $h += '<div class="db-card-sub" style="font-size:11px;line-height:1.5;margin-top:4px">' + $_gradData.message + '</div>';
      $h += '</div></div></div>';
      // Mark graduation as seen
      try { localStorage.setItem($_gradKey, '1'); } catch (e) {}
    }
    
    var $hasPhase2Access = window.__premium && window.__premium.hasFeature(window.__premium.FEATURES.GUIDED_READING);
    if (!$hasPhase2Access) {
      // Free Foundation graduate — show locked teaser card
      $h += '<div class="db-card db-action-card" id="db-phase2-locked" tabindex="0" role="button" aria-label="Guided Reading — Premium feature">';
      $h += '<div class="db-card-row">';
      $h += '<div class="db-card-icon" style="opacity:0.5">🔒</div>';
      $h += '<div class="db-card-body">';
      $h += '<div class="db-card-title">Guided Reading</div>';
      $h += '<div class="db-card-sub">Foundation complete! Unlock structured surah-by-surah reading with Premium.</div>';
      $h += '</div>';
      $h += '<button class="btn btn-sm" type="button" onclick="if(window.__premium)window.__premium.requestUpgrade(\'guided-reading\');event.stopPropagation()">⭐ Upgrade</button>';
      $h += '</div></div>';
    } else {
    var $p2Phase = window.__phase2.getLearningPhase();
    if ($p2Phase === 'guided-reading') {
      // Show Guided Reading card
      var $nextSurah = window.__phase2.getNextGuidedSurah ? window.__phase2.getNextGuidedSurah() : null;
      var $p2Progress = window.__phase2.getGuidedReadingProgress ? window.__phase2.getGuidedReadingProgress() : null;
      if ($nextSurah) {
        var $preview = window.__phase2.getSurahPreview ? window.__phase2.getSurahPreview($nextSurah.surahId) : null;
        $h += '<div class="db-card db-action-card db-card-highlight" id="db-guided-reading" tabindex="0" role="button" aria-label="Guided Reading: Surah ' + ($preview ? $preview.surahName : $nextSurah.surahId) + '">';
        $h += '<div class="db-card-row">';
        $h += '<div class="db-card-icon db-icon-gold-dim">📖</div>';
        $h += '<div class="db-card-body">';
        $h += '<div class="db-card-title">Guided Reading</div>';
        $h += '<div class="db-card-sub">';
        if ($preview) $h += $preview.surahName + ' · ' + $preview.estimatedComprehension + '% estimated comprehension';
        $h += '</div>';
        $h += '</div>';
        $h += '<button class="btn btn-sm" type="button">Read</button>';
        $h += '</div>';
        if ($p2Progress) {
          $h += '<div class="db-progress db-progress-tight">';
          $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $p2Progress.percent + '%"></div></div>';
          $h += '<span class="db-progress-text">' + $p2Progress.completed + '/' + $p2Progress.total + '</span>';
          $h += '</div>';
        }
        $h += '</div>';
      }
    } else if ($p2Phase === 'phase2') {
      // Independent reading — show expand vocabulary recommendation
      var $expansionWords = window.__phase2.getExpansionVocabulary ? window.__phase2.getExpansionVocabulary(3) : [];
      $h += '<div class="db-card" id="db-independent-reading">';
      $h += '<div class="db-card-row">';
      $h += '<div class="db-card-icon db-icon-green-faint">📚</div>';
      $h += '<div class="db-card-body">';
      $h += '<div class="db-card-title">' + $masteredCount + ' Words Mastered — Independent Reading</div>';
      $h += '<div class="db-card-sub">';
      if ($expansionWords.length > 0) {
        $h += $expansionWords.length + ' new words recommended to expand your vocabulary';
      } else {
        $h += 'Explore any surah — your vocabulary foundation is strong';
      }
      $h += '</div>';
      $h += '</div></div></div>';
    }
    }
  } else if ($dueCount > 0 && $reviewsToday === 0) {
    // No foundation or complete — show reviews as next step
    $h += '<div class="db-card db-action-card db-card-highlight" id="db-continue-learning-review" tabindex="0" role="button" aria-label="' + $dueCount + ' reviews due">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon db-icon-gold-faint">' + $icon('repeat', 22) + '</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">Review Due Words</div>';
    $h += '<div class="db-card-sub">' + $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + ' due for reinforcement</div>';
    $h += '</div>';
    $h += '<span class="db-badge">' + $dueCount + '</span>';
    $h += '</div></div>';
  } else if ($masteredCount > 0) {
    // Already reviewed or nothing due — show mastery milestone
    $h += '<div class="db-card">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon db-icon-green-faint">' + $icon('check-circle', 22) + '</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">' + $masteredCount + ' Words Mastered</div>';
    $h += '<div class="db-card-sub">' + $coveragePct + '% Quran coverage · ' + $totalWords + ' total words</div>';
    $h += '</div></div></div>';
  } else {
    // Fresh start — foundation course
    $h += '<div class="db-card db-action-card" id="db-continue-learning-start" tabindex="0" role="button" aria-label="Start Foundation Course">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon db-icon-gold-dim">' + $icon('star', 22) + '</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">Start Foundation Course</div>';
    $h += '<div class="db-card-sub">Master the 100 most frequent Quranic words</div>';
    $h += '</div>';
    $h += '<button class="btn btn-sm" type="button">Begin</button>';
    $h += '</div></div>';
  }

  // ═══ TOGGLE: Show More Stats ═══
  $h += '<div style="text-align:center;margin:6px 0 2px">';
  $h += '<button class="db-show-more-btn" id="db-show-more-btn" type="button" aria-expanded="false">';
  $h += '<span class="db-show-more-icon">&#9660;</span>';
  $h += '<span class="db-show-more-text">Show more stats</span>';
  $h += '</button>';
  $h += '</div>';

  // ═══ COLLAPSIBLE: Secondary content ═══
  $h += '<div class="db-collapsible" id="db-collapsible">';

  // ═══ REVIEW CENTER PROMPT ═══
  // Only meaningful once reviews exist — hidden for a brand-new user ("All caught
  // up / 0 due" with nothing behind it). Same 5-lifetime-reviews minimum used by
  // Session Complete / Word Detail / Review Center retention.
  var $rcDue = $dueReviews.length;
  var $rcMinReviews = (typeof _RC_RETENTION_MIN_REVIEWS !== 'undefined') ? _RC_RETENTION_MIN_REVIEWS : 5;
  if ($rcDue > 0 || ($srsStats.totalReviews || 0) >= $rcMinReviews) {
  $h += '<div class="db-card db-action-card db-card-highlight" id="db-review-center-prompt" tabindex="0" role="button" aria-label="Review Center: ' + $rcDue + ' reviews due">';
  $h += '<div class="db-card-row">';
  $h += '<div class="db-card-icon db-icon-gold-dim">📋</div>';
  $h += '<div class="db-card-body">';
  $h += '<div class="db-card-title">Review Center</div>';
  $h += '<div class="db-card-sub">';
  if ($rcDue > 0) {
    var $rcEst = Math.max(1, Math.round(($rcDue * 30) / 60));
    $h += $rcDue + ' review' + ($rcDue !== 1 ? 's' : '') + ' due';
    if ($srsStats.overdue > 0) $h += ' · ' + $srsStats.overdue + ' overdue';
    $h += ' · ~' + $rcEst + ' min';
  } else {
    $h += 'All caught up — track your revision progress';
  }
  $h += '</div>';
  $h += '</div>';
  $h += '<span class="db-arrow db-arrow-dim">→</span>';
  $h += '</div></div>';
  } // end review center gate

  // ═══ SURAH PROGRESS — Lowest Comprehension Surahs ═══
  // Same gate as renderProfileProgress(): the ranking is zero-noise until several
  // surahs have real (non-zero) progress (LOWEST_COMP_HIDE_THRESHOLD).
  var $lowestCompHideThreshold = (typeof LOWEST_COMP_HIDE_THRESHOLD !== 'undefined') ? LOWEST_COMP_HIDE_THRESHOLD : 5;
  var $compSurahs = [];
  for (var $csi = 0; $csi < $allSurahComp.length; $csi++) {
    var $cs = $allSurahComp[$csi];
    if ($cs.estimatedComprehension > 0 || $cs.masteredWords > 0) $compSurahs.push($cs);
  }
  if ($compSurahs.length >= $lowestCompHideThreshold) {
    $h += '<div class="db-card db-surah-progress" id="db-surah-progress">';
    $h += '<div class="db-section-label db-section-label-spacious"><span class="db-section-icon" aria-hidden="true">' + $icon('book', 14) + '</span> Surah Comprehension</div>';
    // Sort by comprehension ascending and take bottom 5
    var $sortedSurahs = $compSurahs.slice().sort(function($a, $b) { return $a.estimatedComprehension - $b.estimatedComprehension; });
    var $bottomSurahs = $sortedSurahs.slice(0, Math.min(5, $sortedSurahs.length));
    for (var $sii = 0; $sii < $bottomSurahs.length; $sii++) {
      var $surah = $bottomSurahs[$sii];
      var $surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo($surah.surahId) : null;
      var $surahName = $surahInfo ? $surahInfo.name : 'Surah ' + $surah.surahId;
      var $surahEnglish = $surahInfo ? $surahInfo.english : '';
      var $surahCompPct = $surah.estimatedComprehension || 0;
      var $surahCompClass = $surahCompPct >= 50 ? 'db-sc-gold' : ($surahCompPct >= 25 ? 'db-sc-blue' : 'db-sc-red');
      $h += '<div class="db-surah-row" data-surah-id="' + $surah.surahId + '" tabindex="0" role="button" aria-label="' + $surahName + ': ' + $surahCompPct + '% comprehension">';
      $h += '<div class="db-surah-row-info">';
      $h += '<span class="db-surah-row-name">' + $surahName + '</span>';
      $h += '<span class="db-surah-row-english">' + $surahEnglish + '</span>';
      $h += '</div>';
      $h += '<div class="db-surah-row-bar-wrap">';
      $h += '<div class="db-surah-row-track"><div class="db-surah-row-fill ' + $surahCompClass + '" style="width:' + Math.max(1, $surahCompPct) + '%"></div></div>';
      $h += '</div>';
      $h += '<span class="db-surah-row-pct ' + $surahCompClass + '">' + $surahCompPct + '%</span>';
      $h += '</div>';
    }
    // Click handler for surah rows — navigate to that surah in learn mode
    $h += '<div class="db-surah-footer" id="db-surah-footer">';
    $h += '<span>' + $surahsWith50Plus + '/' + $surahsTotalC + ' surahs above 50% comprehension</span>';
    $h += '</div>';
    $h += '</div>';
  }

  // ═══ 6. PRIMARY RECOMMENDATION (single slot) ═══
  // Use the priority-based recommendation slot to get exactly one recommendation.
  // Suppress the slot entirely for brand-new users ($noProgress): its
  // build-foundation rule returns the same "start lesson 1" action as the
  // Continue Learning card directly above — a duplicate CTA.
  var $recSlot = (!$noProgress && window.__recommendationSlot) ? window.__recommendationSlot.getPrimary({
    // State needed by the slot rules
    dueCount: $dueCount,
    fTotal: $fTotal,
    foundationComplete: $foundationComplete,
    nextIncompleteF: $nextIncompleteF,
    nextLessonTitle: $nextLessonTitle,
    comprehensionGain: $compGain,
    p2Phase: window.__phase2 && window.__phase2.getLearningPhase ? window.__phase2.getLearningPhase() : null,
    nextSurahPreview: (window.__phase2 && window.__phase2.getNextGuidedSurah && window.__phase2.getSurahPreview)
      ? (function() { var ns = window.__phase2.getNextGuidedSurah(); return ns ? window.__phase2.getSurahPreview(ns.surahId) : null; })()
      : null,
    expansionWords: (window.__phase2 && window.__phase2.getExpansionVocabulary) ? window.__phase2.getExpansionVocabulary(3) : [],
    weaknesses: $weaknesses,
    fCompleted: $fCompleted,
    masteredCount: $masteredCount,
    totalReviews: $srsStats.totalReviews || 0,
    noProgress: $noProgress,
    lastRead: $lastRead,
    comprehensionPct: $comprehensionPct,
    coveragePct: $coveragePct,
    sleRec: (window.__smartLearning && window.__smartLearning.getScoredRecommendations)
      ? (function() { var $sr = window.__smartLearning.getScoredRecommendations(); return $sr.length > 0 ? $sr[0] : null; })()
      : null,
  }) : null;

    if ($recSlot) {
    $h += '<div class="db-section-label"><span class="db-section-icon" aria-hidden="true">' + $icon('lightbulb', 14) + '</span> Recommendation</div>';
    $h += '<div class="db-card db-card-smart-rec db-action-card" id="' + $recSlot.id + '" tabindex="0" role="button" aria-label="' + $recSlot.title + '">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-rec-icon">' + $icon($recSlot.icon, 18) + '</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title db-card-title-sm">' + $recSlot.title + '</div>';
    $h += '<div class="db-card-sub db-card-sub-sm">' + $recSlot.message + '</div>';
    $h += '</div>';
    $h += '<span class="db-arrow db-arrow-dim">→</span>';
    $h += '</div></div>';
  }

  // ═══ 7. PROGRESS OVERVIEW ═══
  // Hidden until real progress exists — same "hide meaningless 0/N rows" pattern
  // applied on Profile (a wall of zero-stats is noise, not information).
  var $hasAnyProgress = ($fCompleted || 0) + ($masteredCount || 0) + ($srsStats.totalReviews || 0) > 0;
  if ($hasAnyProgress) {
  $h += '<div class="db-card db-progress-overview" id="db-progress-overview">';
  $h += '<div class="db-section-label db-section-label-spacious"><span class="db-section-icon" aria-hidden="true">' + $icon('chart', 14) + '</span> Progress Overview</div>';
  // Foundation course
  if ($fTotal > 0) {
    var $fPctVal = Math.round(($fCompleted / $fTotal) * 100);
    $h += '<div class="db-progress-row">';
    $h += '<div class="db-progress-row-header"><span>Foundation Course</span><span class="db-progress-row-value">' + $fCompleted + ' / ' + $fTotal + '</span></div>';
    $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $fPctVal + '%;"></div></div>';
    $h += '</div>';
  }
  // Root families
  if ($rfTotal > 0) {
    var $rfPctVal = Math.round(($rfCompleted / $rfTotal) * 100);
    $h += '<div class="db-progress-row">';
    $h += '<div class="db-progress-row-header"><span>Root Families</span><span class="db-progress-row-value">' + $rfCompleted + ' / ' + $rfTotal + '</span></div>';
    $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $rfPctVal + '%;"></div></div>';
    $h += '</div>';
  }
  // Difficulty levels
  $h += '<div class="db-progress-row">';
  $h += '<div class="db-progress-row-header"><span>Difficulty Levels</span><span class="db-progress-row-value">' + $diffCompleted + ' / ' + $diffTotal + '</span></div>';
  $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $diffPct + '%;"></div></div>';
  $h += '</div>';
  // Surahs completed
  if ($surahTotal > 0) {
    var $surahPctVal = Math.round(($surahCompleted / $surahTotal) * 100);
    $h += '<div class="db-progress-row">';
    $h += '<div class="db-progress-row-header"><span>Surahs Completed</span><span class="db-progress-row-value">' + $surahCompleted + ' / ' + $surahTotal + '</span></div>';
    $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $surahPctVal + '%;"></div></div>';
    $h += '</div>';
  }
  $h += '</div>';
  } // end progress overview gate

  // ═══ 8. DAILY MOTIVATION ═══
  // Generate a dynamic, progress-based motivational message
  var $motivationMsg = '';
  var $motivationIcon = '💪';
  
  // Priority 1: Reviews done today
  if ($reviewsToday > 0) {
    $motivationMsg = 'You reinforced <strong>' + $reviewsToday + '</strong> word' + ($reviewsToday !== 1 ? 's' : '') + ' today. Every review builds lasting retention!';
    $motivationIcon = '🔥';
  }
  // Priority 1b: Momentum — today's activity from current session
  else if ($hasMomentum && $reviewsToday === 0) {
    var $momentumParts = [];
    if ($momentum.lessonsCompleted > 0) $momentumParts.push($momentum.lessonsCompleted + ' lesson' + ($momentum.lessonsCompleted > 1 ? 's' : '') + ' completed');
    if ($momentum.wordsLearned > 0) $momentumParts.push($momentum.wordsLearned + ' word' + ($momentum.wordsLearned > 1 ? 's' : '') + ' learned');
    if ($momentum.ayahsRead > 0) $momentumParts.push($momentum.ayahsRead + ' ayahs read');
    $motivationMsg = 'Today: <strong>' + $momentumParts.join(', ') + '</strong>. Great progress!';
    $motivationIcon = '📊';
  }
  // Priority 2: Comprehension growth (from analytics deltas)
  else if ($compDeltas && $compDeltas.weekChange && $compDeltas.weekChange > 0) {
    $motivationMsg = 'Your Quran comprehension increased by <strong>+' + $compDeltas.weekChange.toFixed(1) + '%</strong> this week. Consistent progress!';
    $motivationIcon = '📈';
  }
  // Priority 3: Streak encouragement
  else if ($streak > 0) {
    var $streakMsg = '';
    if ($streak >= 7) {
      $streakMsg = 'Impressive consistency! 🔥';
    } else if ($streak <= 3) {
      $streakMsg = 'You\'re building a habit! ' + ($streak === 1 ? 'Day 1 done — the most important step.' : $streak + ' days strong!') + '';
    } else {
      $streakMsg = 'Keep it going — ' + (7 - ($streak % 7)) + ' more days to your next milestone.';
    }
    $motivationMsg = 'You\'re on a <strong>' + $streak + '-day streak</strong>! ' + $streakMsg;
    $motivationIcon = '🔥';
  }
  // Priority 5b: Reviews due with urgency (returning user with completed lessons)
  else if ($dueCount > 0 && $fCompleted > 0 && $reviewsToday === 0) {
    $motivationMsg = '<strong>' + $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + '</strong> due. Returning now protects yesterday\'s learning and strengthens retention.';
    $motivationIcon = '🛡️';
  }
  // Priority 5c: Low reviews due — almost done (non-returning, just few left)
  else if ($dueCount > 0 && $dueCount <= 5) {
    $motivationMsg = 'Only <strong>' + $dueCount + '</strong> review' + ($dueCount !== 1 ? 's' : '') + ' remaining. Quick session to stay on top!';
    $motivationIcon = '🎯';
  }
  // Priority 5d: Reviews due, general case
  else if ($dueCount > 0) {
    $motivationMsg = '<strong>' + $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + '</strong> due for review. Each review strengthens your Quran comprehension.';
    $motivationIcon = '📚';
  }
  // Priority 6: Foundation milestone
  else if ($fTotal > 0 && $fCompleted > 0 && !$foundationComplete) {
    $motivationMsg = 'You\'ve completed <strong>' + $fCompleted + ' of ' + $fTotal + '</strong> foundation lessons. ' + ($fPct >= 50 ? 'More than halfway there! 🎉' : 'Keep going — each lesson unlocks more of the Quran.') + '';
    $motivationIcon = '🌟';
  }
  // Priority 7: Comprehension milestone
  else if ($comprehensionPct >= 50) {
    $motivationMsg = 'You understand <strong>' + $comprehensionPct + '%</strong> of Quranic vocabulary. Remarkable achievement! ✨';
    $motivationIcon = '🏆';
  }
  // Priority 8: Words mastered
  else if ($masteredCount > 0) {
    $motivationMsg = '<strong>' + $masteredCount + ' words mastered</strong> — ' + $coveragePct + '% of Quran occurrences. Building real understanding!';
    $motivationIcon = '💪';
  }
  // Priority 9: Foundation course milestone
  else if ($fTotal > 0) {
    if ($noProgress) {
      // Brand-new user — gentle welcome copy instead of a CTA that duplicates
      // the action cards above (Continue Learning is the single primary CTA).
      $motivationMsg = 'Your journey to understand the Quran begins here. Take it one word at a time. ✨';
      $motivationIcon = '💫';
    } else {
    var $foundationTotalCoverage = typeof getFoundationTotalCoveragePercent === 'function'
      ? getFoundationTotalCoveragePercent()
      : 0;
    if ($foundationTotalCoverage > 0) {
      $motivationMsg = 'Start the Foundation Course to unlock <strong>~' + $foundationTotalCoverage + '%</strong> of Quranic word occurrences in just ' + $fTotal + ' lessons!';
    } else {
      $motivationMsg = 'Start the Foundation Course to master the 100 most frequent Quranic words and unlock most of the Quran!';
    }
    $motivationIcon = '🌱';
    }
  }
  // Fallback: Generic encouragement
  else {
    $motivationMsg = 'Your journey to understand the Quran begins here. Start with one word today. ✨';
    $motivationIcon = '💫';
  }
  
  $h += '<div class="db-card db-motivation-card" id="db-motivation-card">';
  $h += '<div class="db-motivation-row">';
  $h += '<span class="db-motivation-icon" aria-hidden="true">' + $motivationIcon + '</span>';
  $h += '<p class="db-motivation-text">' + $motivationMsg + '</p>';
  $h += '</div></div>';

  // ═══ COMPACT HERO STATS BAR (after all sections) ═══
  // Brand-new users get a single "Start Today" stat — the all-zero 4-stat wall
  // (0 Mastered · 0% · 0 Reviews) is meaningless noise until real progress exists.
  $h += '<div class="db-hero-bar">';
  if ($noProgress) {
    $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="start-today" tabindex="0" role="button" aria-label="Start learning today">';
    $h += '<div class="db-hero-stat-icon" aria-hidden="true">' + $icon('fire', 18) + '</div>';
    $h += '<div class="db-hero-stat-value">Start Today</div>';
    $h += '<div class="db-hero-stat-label">Begin your Quran journey</div></div>';
  } else {
    $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="streak" tabindex="0" role="button" aria-label="Streak: ' + $streak + ' days">';
    $h += '<div class="db-hero-stat-icon" aria-hidden="true">' + $icon('fire', 18) + '</div>';
    $h += '<div class="db-hero-stat-value">' + $streak + '</div>';
    $h += '<div class="db-hero-stat-label">Streak</div></div>';
    $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="mastered" tabindex="0" role="button" aria-label="Words mastered: ' + $masteredCount + '">';
    $h += '<div class="db-hero-stat-value">' + $masteredCount + '</div>';
    $h += '<div class="db-hero-stat-label">Mastered</div></div>';
    $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="comprehension" tabindex="0" role="button" aria-label="Quran comprehension: ' + $comprehensionPct + '%">';
    $h += '<div class="db-hero-stat-value">' + $comprehensionPct + '%</div>';
    $h += '<div class="db-hero-stat-label">Comprehension</div></div>';
    $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="review" tabindex="0" role="button" aria-label="Reviews today: ' + $reviewsToday + '">';
    $h += '<div class="db-hero-stat-value">' + $reviewsToday + '</div>';
    $h += '<div class="db-hero-stat-label">Reviews</div></div>';
  }
  $h += '</div>';

  $h += '</div>';  // close db-collapsible

  // ── Inject HTML ──
  $d.innerHTML = $h;

  // ═══════════════════════════════════════════════════════════
  // EVENT WIRING — All handlers use direct onclick assignments
  // ═══════════════════════════════════════════════════════════

  // Helper: safe onclick wire
  function $wire(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.onclick = fn;
    el.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  }

  // Hero stats bar (delegated via data attributes)
  var $heroStats = $d.querySelectorAll('.db-hero-stat-click');
  for (var $hsi = 0; $hsi < $heroStats.length; $hsi++) {
    (function($el) {
      var $action = $el.getAttribute('data-db-action');
      $el.onclick = function() {
        if ($action === 'start-today') {
          if (typeof goToFoundationLesson === 'function') goToFoundationLesson($nextIncompleteF);
          else if (typeof switchView === 'function') switchView('learn');
        }
        else if ($action === 'streak' || $action === 'comprehension' || $action === 'mastered') switchView('profile');
        else if ($action === 'list') switchView('list');
        else if ($action === 'review') { if (typeof startReview === 'function') startReview(); else switchView('learn'); }
      };
      $el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $el.onclick(); }
      };
    })($heroStats[$hsi]);
  }

  // Show more stats toggle — expand/collapse secondary content
  $wire('db-show-more-btn', function() {
    var $collapsible = document.getElementById('db-collapsible');
    var $btn = document.getElementById('db-show-more-btn');
    if (!$collapsible || !$btn) return;
    var $isOpen = $collapsible.classList.contains('db-collapsible-open');
    if ($isOpen) {
      // Close: set max-height to current height, then trigger transition to 0
      $collapsible.style.maxHeight = $collapsible.scrollHeight + 'px';
      requestAnimationFrame(function() {
        $collapsible.classList.remove('db-collapsible-open');
        $collapsible.style.maxHeight = '0';
      });
    } else {
      // Open: set max-height to measured content height for smooth slide
      $collapsible.classList.add('db-collapsible-open');
      $collapsible.style.maxHeight = $collapsible.scrollHeight + 'px';
    }
    $btn.setAttribute('aria-expanded', String(!$isOpen));
    var $icon = $btn.querySelector('.db-show-more-icon');
    var $text = $btn.querySelector('.db-show-more-text');
    if ($icon) $icon.innerHTML = $isOpen ? '&#9660;' : '&#9650;';
    if ($text) $text.textContent = $isOpen ? 'Show more stats' : 'Show less';
  });

  // Comprehension headline click → profile (ring variant only — the welcome
  // variant is informational, not a navigation affordance)
  if ($comprehensionPct > 0) {
    $wire('db-comp-headline', function() {
      if (typeof switchView === 'function') switchView('profile');
    });
  }

  // Surah rows click → navigate to that surah in learn mode
  var $surahRows = $d.querySelectorAll('.db-surah-row');
  for (var $suri = 0; $suri < $surahRows.length; $suri++) {
    (function($surahEl) {
      var $sid = parseInt($surahEl.getAttribute('data-surah-id'), 10);
      $surahEl.onclick = function() {
        if (typeof goToSurah === 'function') goToSurah($sid);
        else if (typeof switchView === 'function') switchView('learn');
      };
      $surahEl.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $surahEl.onclick(); }
      };
    })($surahRows[$suri]);
  }

  // Review Center prompt — navigate to review-center view
  $wire('db-review-center-prompt', function() {
    if (typeof switchView === 'function') switchView('review-center');
  });

  // Continue Reading card (with reading history)
  $wire('db-continue-reading', function() {
    if (typeof switchView === 'function') switchView('quran');
    if (window.__quran && typeof window.__quran.resumeReading === 'function') {
      setTimeout(function() { window.__quran.resumeReading(); }, 0);
    }
  });

  // Continue Reading — start new (no history)
  $wire('db-continue-reading-start', function() {
    if (typeof switchView === 'function') switchView('quran');
  });

  // Continue Learning — Foundation Course
  $wire('db-continue-learning', function() {
    if (typeof goToFoundationLesson === 'function') goToFoundationLesson($nextIncompleteF);
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Continue Learning — Reviews due
  $wire('db-continue-learning-review', function() {
    if (typeof startReview === 'function') startReview();
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Continue Learning — Start Foundation
  $wire('db-continue-learning-start', function() {
    if (typeof goToFoundationLesson === 'function') goToFoundationLesson(0);
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Phase 2 locked (free Foundation graduate) — show upgrade dialog
  $wire('db-phase2-locked', function() {
    if (window.__premium) window.__premium.requestUpgrade('guided-reading');
  });

  // Guided Reading — open Quran with the next recommended surah
  $wire('db-guided-reading', function() {
    if (typeof switchView === 'function') switchView('quran');
    if (window.__phase2 && typeof window.__phase2.getNextGuidedSurah === 'function') {
      var $nextS = window.__phase2.getNextGuidedSurah();
      if ($nextS && typeof openSurahForReading === 'function') {
        setTimeout(function() { openSurahForReading($nextS.surahId); }, 100);
      }
    }
  });

  // ── Primary Recommendation Card Click ──
  // Wire the single recommendation card using $recSlot (from recommendationSlot.getPrimary)
  // The $recSlot object was computed during HTML rendering above.
  function $handleRecSlotClick(actionType) {
    if (actionType === 'review' || actionType === 'review-difficult') {
      if (typeof startReview === 'function') startReview();
      else if (typeof switchView === 'function') switchView('learn');
    } else if (actionType === 'foundation' || actionType === 'foundation-reinforcement') {
      if (typeof goToFoundationLesson === 'function') goToFoundationLesson($nextIncompleteF);
      else if (typeof switchView === 'function') switchView('learn');
    } else if (actionType === 'reading' || actionType === 'reading-review') {
      if (typeof switchView === 'function') switchView('quran');
    } else if (actionType === 'surah' || actionType === 'surah-learning') {
      if (typeof switchView === 'function') switchView('learn');
    } else if (actionType === 'root-family') {
      if (typeof goToRootFamily === 'function') goToRootFamily();
      else if (typeof switchView === 'function') switchView('learn');
    } else {
      if (typeof switchView === 'function') switchView('learn');
    }
  }

  // Wire the single recommendation card (if present)
  var $recCard = document.getElementById($recSlot ? $recSlot.id : 'rec-none');
  if ($recCard && $recSlot) {
    (function($el, $rec) {
      $el.onclick = function() {
        $handleRecSlotClick($rec.actionType);
      };
      $el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $el.onclick(); }
      };
    })($recCard, $recSlot);
  }

  // ── Animation: animate comprehension ring on mount ──
  if (typeof animateDashboardComprehension === 'function') {
    var $compHeadline = document.getElementById('db-comp-headline');
    if ($compHeadline) animateDashboardComprehension($compHeadline, $comprehensionPct, false);
  }

  // ── Update external displays ──
  if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
  if (typeof updateReviewBanner === 'function') updateReviewBanner();

  } catch (e) {
    if (window.__diag) {
      window.__diag.catchError('Dashboard', 'renderDashboard', 'js/ui/dashboard.js', e);
    } else {
      console.error('[dashboard] renderDashboard error:', e);
    }
    var $d2 = document.getElementById('dashboard-grid');
    if ($d2) $d2.innerHTML = '<div class="db-error">⚠️ We encountered an issue loading the dashboard. <button class="btn btn-sm mt-10" onclick="window.location.reload()">Reload</button></div>';
  }
}
