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
  return ($st.total || 0) + '|' + ($st.dueToday || 0) + '|' + ($st.reviewsToday || 0) + '|' + (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 0);
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
  var $allWordsArr = typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : [];
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
  var $smartRec = $adaptive ? $adaptive.recommendation : null;
  var $weaknesses = $adaptive ? $adaptive.weaknesses : [];
  var $streakQuality = $adaptive ? $adaptive.streakQuality : null;
  var $goalProgress = $adaptive ? $adaptive.goalProgress : null;

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

  // Milestone
  var $ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus($comprehensionPct) : null;
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

  // ═══ REVIEW CENTER PROMPT (top of dashboard) ═══
  var $rcDue = $dueReviews.length;
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

  // ── Reading position (used by multiple sections) ──
  var $lastRead = null;
  if (window.__reader && typeof window.__reader.getLastReadPosition === 'function') {
    $lastRead = window.__reader.getLastReadPosition();
  }

  // ── Comprehension insight (for motivation & headline) ──
  var $compInsight = (typeof getComprehensionInsight === 'function') ? getComprehensionInsight() : null;
  var $compDeltas = $compInsight || {};
  var $compMilestone = $compInsight ? ($compInsight.milestoneCurrent ? $compInsight.milestoneCurrent.label : '') : '';

  // ═══ 1. GREETING ═══
  $h += '<div class="db-greeting">';
  $h += '<div class="db-greeting-icon" aria-hidden="true">' + $icon('book', 28) + '</div>';
  $h += '<div>';
  $h += '<h2 class="db-greeting-title">Assalamu Alaikum</h2>';
  $h += '<p class="db-greeting-sub">Your journey to understand the Quran</p>';
  $h += '</div></div>';

  // ═══ 2. QURAN COMPREHENSION HEADLINE ═══
  $h += '<div class="db-card db-comp-headline" id="db-comp-headline" tabindex="0" role="button" aria-label="Quran comprehension: ' + $comprehensionPct + '%">';
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
  $h += '<div class="db-comp-headline-info">';
  $h += '<div class="db-comp-headline-value">' + $comprehensionPct + '% Quran Comprehension</div>';
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
  if ($compMilestone) {
    $h += '<div class="db-comp-headline-milestone">🎯 ' + $compMilestone + '</div>';
  }
  $h += '</div></div>';
  // ── Comprehension Metrics Row ──
  $h += '<div class="db-comp-metrics">';
  $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $coveragePct + '%</div><div class="db-comp-metric-label">Coverage</div></div>';
  $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $masteredCount + '</div><div class="db-comp-metric-label">Mastered</div></div>';
  $h += '<div class="db-comp-metric"><div class="db-comp-metric-value">' + $totalWords + '</div><div class="db-comp-metric-label">Total Words</div></div>';
  $h += '</div>';
  $h += '</div>';

  // ═══ 3. TODAY'S GOAL ═══
  $h += '<div class="db-card db-goal-card" id="db-goal-card">';
  $h += '<div class="db-section-label db-section-label-compact"><span class="db-section-icon" aria-hidden="true">' + $icon('target', 14) + '</span> Today\'s Goal</div>';
  
  // Compute goal: daily review target (default 25) or from goal progress
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

  // ═══ SURAH PROGRESS — Lowest Comprehension Surahs ═══
  if ($allSurahComp.length > 0) {
    $h += '<div class="db-card db-surah-progress" id="db-surah-progress">';
    $h += '<div class="db-section-label db-section-label-spacious"><span class="db-section-icon" aria-hidden="true">' + $icon('book', 14) + '</span> Surah Comprehension</div>';
    // Sort by comprehension ascending and take bottom 5
    var $sortedSurahs = $allSurahComp.slice().sort(function($a, $b) { return $a.estimatedComprehension - $b.estimatedComprehension; });
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

  // ═══ 6. SMART RECOMMENDATIONS ═══
  // Collect up to 3 personalized recommendations from available data
  var $recommendations = [];
  
  // 1. From adaptive engine's single recommendation
  if ($smartRec && $smartRec.actionType) {
    $recommendations.push({
      icon: $smartRec.icon || 'lightbulb',
      title: $smartRec.title || 'Recommendation',
      message: $smartRec.message || '',
      action: $smartRec.action || '→',
      id: 'smart-rec-adaptive',
      actionType: $smartRec.actionType,
    });
  }
  
  // 2. Reviews due recommendation
  if ($dueCount > 0) {
    $recommendations.push({
      icon: 'repeat',
      title: ($dueCount === 1 ? '1 review' : $dueCount + ' reviews') + ' due',
      message: 'Strengthen your memory by reviewing ' + ($dueCount === 1 ? 'this word' : 'these ' + $dueCount + ' words') + ' now.',
      action: 'Start Review',
      id: 'smart-rec-review',
      actionType: 'review',
    });
  }
  
  // 3. Weak vocabulary/roots recommendation (from adaptive engine)
  if ($weaknesses && $weaknesses.length > 0) {
    var $weakCount = $weaknesses.length;
    $recommendations.push({
      icon: 'alert-triangle',
      title: $weakCount + ' weak area' + ($weakCount > 1 ? 's' : '') + ' detected',
      message: 'Focus on ' + $weaknesses[0].name + ($weakCount > 1 ? ' and ' + ($weakCount - 1) + ' more' : '') + ' to strengthen your foundation.',
      action: 'Review',
      id: 'smart-rec-weak',
      actionType: 'review',
    });
  }
  
  // 4. SLE recommendation (up to 1, highest priority)
  if (window.__smartLearning && window.__smartLearning.getScoredRecommendations) {
    var $sleRecs = window.__smartLearning.getScoredRecommendations();
    if ($sleRecs.length > 0 && $sleRecs[0].score >= 20) {
      var $topSle = $sleRecs[0];
      // Only add if we don't have a similar recommendation
      var $alreadyHasReview = false;
      for (var $ri = 0; $ri < $recommendations.length; $ri++) {
        if ($recommendations[$ri].actionType === 'review') $alreadyHasReview = true;
      }
      if (!$alreadyHasReview) {
        $recommendations.push({
          icon: $topSle.icon || 'lightbulb',
          title: $topSle.title,
          message: $topSle.message,
          action: $topSle.action || '→',
          id: 'sle-' + $topSle.id,
          actionType: $topSle.actionType,
        });
      }
    }
  }
  
  // 5. Reading recommendation (if not read yet)
  if (!$lastRead || !$lastRead.surahId) {
    $recommendations.push({
      icon: 'book',
      title: 'Begin reading the Quran',
      message: 'Reading the Quran alongside vocabulary study reinforces your learning in real context.',
      action: 'Open Reader',
      id: 'smart-rec-reading',
      actionType: 'reading',
    });
  }
  
  // Take up to 3 recommendations, prioritizing unique action types
  // Simple dedup: take first 3 unique action types
  var $seenTypes = {};
  var $finalRecs = [];
  for (var $ri = 0; $ri < $recommendations.length && $finalRecs.length < 3; $ri++) {
    var $recItem = $recommendations[$ri];
    if (!$seenTypes[$recItem.actionType]) {
      $seenTypes[$recItem.actionType] = true;
      $finalRecs.push($recItem);
    }
  }

  
  if ($finalRecs.length > 0) {
    $h += '<div class="db-section-label"><span class="db-section-icon" aria-hidden="true">' + $icon('lightbulb', 14) + '</span> Smart Recommendations</div>';
    for (var $fri = 0; $fri < $finalRecs.length; $fri++) {
      var $fr = $finalRecs[$fri];
      $h += '<div class="db-card db-card-smart-rec db-action-card" id="' + $fr.id + '" tabindex="0" role="button" aria-label="' + $fr.title + '">';
      $h += '<div class="db-card-row">';
      $h += '<div class="db-rec-icon">' + $icon($fr.icon, 18) + '</div>';
      $h += '<div class="db-card-body">';
      $h += '<div class="db-card-title db-card-title-sm">' + $fr.title + '</div>';
      $h += '<div class="db-card-sub db-card-sub-sm">' + $fr.message + '</div>';
      $h += '</div>';
      $h += '<span class="db-arrow db-arrow-dim">→</span>';
      $h += '</div></div>';
    }
  }

  // ═══ 7. PROGRESS OVERVIEW ═══
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

  // ═══ 8. DAILY MOTIVATION ═══
  // Generate a dynamic, progress-based motivational message
  var $motivationMsg = '';
  var $motivationIcon = '💪';
  
  // Priority 1: Reviews done today
  if ($reviewsToday > 0) {
    $motivationMsg = 'You reinforced <strong>' + $reviewsToday + '</strong> word' + ($reviewsToday !== 1 ? 's' : '') + ' today. Every review builds lasting retention!';
    $motivationIcon = '🔥';
  }
  // Priority 2: Comprehension growth (from analytics deltas)
  else if ($compDeltas && $compDeltas.weekChange && $compDeltas.weekChange > 0) {
    $motivationMsg = 'Your Quran comprehension increased by <strong>+' + $compDeltas.weekChange.toFixed(1) + '%</strong> this week. Consistent progress!';
    $motivationIcon = '📈';
  }
  // Priority 3: Streak encouragement
  else if ($streak > 0) {
    $motivationMsg = 'You\'re on a <strong>' + $streak + '-day streak</strong>! ' + ($streak >= 7 ? 'Impressive consistency! 🔥' : 'Keep it going — ' + (7 - ($streak % 7)) + ' more days to your next milestone.') + '';
    $motivationIcon = '🔥';
  }
  // Priority 4: Low reviews due — almost done
  else if ($dueCount > 0 && $dueCount <= 5) {
    $motivationMsg = 'Only <strong>' + $dueCount + '</strong> review' + ($dueCount !== 1 ? 's' : '') + ' remaining. Quick session to stay on top!';
    $motivationIcon = '🎯';
  }
  // Priority 5: Reviews due, but more than 5
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

  // ═══ COMPACT HERO STATS BAR (always visible, after all sections) ═══
  $h += '<div class="db-hero-bar">';
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
  $h += '</div>';

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
        if ($action === 'streak' || $action === 'comprehension' || $action === 'mastered') switchView('profile');
        else if ($action === 'list') switchView('list');
        else if ($action === 'review') { if (typeof startReview === 'function') startReview(); else switchView('learn'); }
      };
      $el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $el.onclick(); }
      };
    })($heroStats[$hsi]);
  }

  // Comprehension headline click → profile
  $wire('db-comp-headline', function() {
    if (typeof switchView === 'function') switchView('profile');
  });

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
    if (typeof switchView === 'function') switchView('reader');
    if (window.__reader && typeof window.__reader.resumeReading === 'function') {
      setTimeout(function() { window.__reader.resumeReading(); }, 0);
    }
  });

  // Continue Reading — start new (no history)
  $wire('db-continue-reading-start', function() {
    if (typeof switchView === 'function') switchView('reader');
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

  // ── Smart Recommendation Cards ──
  // Helper to handle recommendation clicks based on actionType
  function $handleRecClick(actionType) {
    if (actionType === 'review' || actionType === 'review-difficult') {
      if (typeof startReview === 'function') startReview();
      else if (typeof switchView === 'function') switchView('learn');
    } else if (actionType === 'foundation' || actionType === 'foundation-reinforcement') {
      if (typeof goToFoundationLesson === 'function') goToFoundationLesson($nextIncompleteF);
      else if (typeof switchView === 'function') switchView('learn');
    } else if (actionType === 'reading' || actionType === 'reading-review') {
      if (typeof switchView === 'function') switchView('reader');
    } else if (actionType === 'surah' || actionType === 'surah-learning') {
      if (typeof switchView === 'function') switchView('learn');
    } else if (actionType === 'root-family') {
      if (typeof goToRootFamily === 'function') goToRootFamily();
      else if (typeof switchView === 'function') switchView('learn');
    } else {
      if (typeof switchView === 'function') switchView('learn');
    }
  }

  // Find all smart recommendation cards and wire them
  var $smartRecCards = $d.querySelectorAll('.db-card-smart-rec');
  for (var $sri = 0; $sri < $smartRecCards.length; $sri++) {
    (function($recEl) {
      var $recId2 = $recEl.id;
      $recEl.onclick = function() {
        // Find matching recommendation from our list
        var $matchedRec2 = null;
        for (var $ri3 = 0; $ri3 < $finalRecs.length; $ri3++) {
          if ($finalRecs[$ri3].id === $recId2) {
            $matchedRec2 = $finalRecs[$ri3];
            break;
          }
        }
        if ($matchedRec2) $handleRecClick($matchedRec2.actionType);
        else if (typeof switchView === 'function') switchView('learn');
      };
      $recEl.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $recEl.onclick(); }
      };
    })($smartRecCards[$sri]);
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
