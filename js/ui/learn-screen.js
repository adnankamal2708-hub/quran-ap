// ═══════════════════════════════════════════════════════════════
// learn-screen.js — Action-Oriented Learn Screen Header
//
// Renders a clean, action-focused header above the word card.
// Shows only: greeting, comprehension %, today's goal,
// continue reading, continue learning, smart recommendations,
// reviews due, learning paths, one motivation card.
//
// No detailed analytics, charts, history, or long-term stats here.
// Those have been moved to the Profile view.
// ═══════════════════════════════════════════════════════════════

// SVG icon helper — fallback emoji when components.js not loaded
function _lsIcon(name, size) {
  var $icons = window.__components && window.__components.createSVGIcon;
  if ($icons) return $icons(name, { size: size || 18 });
  var fallback = {
    book: '📖', layers: '📚', star: '⭐', fire: '🔥', check: '✓',
    brain: '🧠', clock: '⏰', repeat: '🔄', target: '🎯', bolt: '⚡',
    'book-open': '📖', lightbulb: '💡', award: '🏆', leaf: '🌱',
    'check-circle': '✅', calendar: '📅', trending: '📈', heart: '❤️',
    'arrow-right': '→', 'chevron-right': '▶',
  };
  return fallback[name] || '✦';
}

/**
 * Render the action-oriented header for the Learn view.
 * Called by switchView('learn') on transition to the learn view.
 * Injects HTML into #learn-action-header if present.
 */
function renderLearnScreen() {
  var container = document.getElementById('learn-action-header');
  if (!container) return;

  // ── Gather data once ──
  var $srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var $srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var $dueReviews = typeof getDueReviews === 'function' ? getDueReviews() : [];
  var $dueCount = $dueReviews.length;
  var $streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var $streak = $streakData.streak || 0;
  var $reviewsToday = $srsStats.reviewsToday || 0;

  // Foundation data
  var $fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var $fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var $fPct = $fTotal > 0 ? Math.round(($fCompleted / $fTotal) * 100) : 0;
  var $fNextIdx = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
  var $foundationComplete = $fTotal > 0 && $fCompleted >= $fTotal;

  // Coverage & comprehension
  var $coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var $comprehensionPct = $coverage ? $coverage.estimatedComprehension : 0;
  var $masteredCount = $srsStats.mature || 0;
  var $totalWords = typeof getCanonicalWordCount === 'function' && getCanonicalWordCount() > 0 ?
    getCanonicalWordCount() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 0);

  // Reading position
  var $lastRead = null;
  if (window.__reader && typeof window.__reader.getLastReadPosition === 'function') {
    $lastRead = window.__reader.getLastReadPosition();
  }

  // Smart Learning Engine recommendations (top 3)
  var $sleRecs = window.__smartLearning ? window.__smartLearning.getScoredRecommendations() : [];
  var $topRec = $sleRecs.length > 0 && $sleRecs[0].score >= 20 ? $sleRecs[0] : null;

  // Adaptive engine daily plan
  var $adaptive = window.__adaptive ? window.__adaptive.getDashboardData() : null;
  var $dailyPlan = $adaptive ? $adaptive.dailyPlan : [];
  var $goalProgress = $adaptive ? $adaptive.goalProgress : null;

  // Weekly goal: daily review target
  var $dailyLimit = (window.__srs && window.__srs.getDailyReviewLimit) ?
    window.__srs.getDailyReviewLimit() : 25;
  var $goalPct = Math.min(100, Math.round(($reviewsToday / Math.max(1, $dailyLimit)) * 100));

  // ── Build HTML ──
  var h = '';

  // ═══ 1. GREETING BAR ═══
  h += '<div class="ls-greeting">';
  h += '<div class="ls-greeting-icon">' + _lsIcon('book-open', 22) + '</div>';
  h += '<div class="ls-greeting-text">';
  h += '<div class="ls-greeting-title">Assalamu Alaikum</div>';
  h += '<div class="ls-greeting-sub">Your journey to understand the Quran</div>';
  h += '</div>';
  // Streak badge
  h += '<div class="ls-streak-badge" id="ls-streak-badge" title="' + $streak + '-day streak">';
  h += _lsIcon('fire', 14) + ' <span class="ls-streak-num">' + $streak + '</span>';
  h += '</div></div>';

  // ═══ 2. COMPREHENSION HEADLINE ═══
  h += '<div class="ls-comp-headline">';
  h += '<div class="ls-comp-value">' + $comprehensionPct + '%</div>';
  h += '<div class="ls-comp-label">Quran Comprehension <span class="ls-comp-detail">(' + $masteredCount + ' of ' + $totalWords + ' words mastered)</span></div>';
  h += '</div>';

  // ═══ 3. TODAY'S GOAL RING ═══
  h += '<div class="ls-goal-row">';
  h += '<div class="ls-goal-ring-wrap" title="Daily review goal: ' + $reviewsToday + ' of ' + $dailyLimit + '">';
  h += '<svg class="ls-goal-ring" viewBox="0 0 36 36">';
  h += '<path class="goal-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>';
  h += '<path class="goal-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $goalPct + ', 100"/>';
  h += '<text class="goal-ring-text" x="18" y="20.5">' + $goalPct + '</text>';
  h += '</svg></div>';
  h += '<div class="ls-goal-info">';
  h += '<div class="ls-goal-label">Today\'s Goal</div>';
  h += '<div class="ls-goal-progress">' + $reviewsToday + ' of ' + $dailyLimit + ' reviews</div>';
  h += '<div class="ls-goal-bar"><div class="ls-goal-fill" style="width:' + $goalPct + '%"></div></div>';
  h += '</div></div>';

  // ═══ 4. CONTINUE READING (conditional) ═══
  if ($lastRead && $lastRead.surahId) {
    var $surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo($lastRead.surahId) : null;
    var $surahName = $surahInfo ? $surahInfo.name : 'Surah ' + $lastRead.surahId;
    var $lastTimeAgo = '';
    if ($lastRead.date) {
      var $hoursAgo = Math.round((Date.now() - $lastRead.date) / (1000 * 60 * 60));
      if ($hoursAgo < 1) $lastTimeAgo = 'Just now';
      else if ($hoursAgo < 24) $lastTimeAgo = $hoursAgo + 'h ago';
      else $lastTimeAgo = Math.round($hoursAgo / 24) + 'd ago';
    }
    h += '<div class="ls-action-card ls-card-continue" id="ls-continue-reading" tabindex="0" role="button" aria-label="Resume reading ' + $surahName + '">';
    h += '<div class="ls-card-icon">' + _lsIcon('book-open', 18) + '</div>';
    h += '<div class="ls-card-body">';
    h += '<div class="ls-card-title">Continue Reading</div>';
    h += '<div class="ls-card-sub">' + $surahName + ' · ' + $lastTimeAgo + '</div>';
    h += '</div>';
    h += '<span class="ls-card-arrow">→</span>';
    h += '</div>';
  }

  // ═══ 5. SMART RECOMMENDATION (from SLE) ═══
  if ($topRec) {
    h += '<div class="ls-action-card ls-smart-rec" id="ls-smart-rec" tabindex="0" role="button" aria-label="' + $topRec.title + '">';
    h += '<div class="ls-smart-rec-badge">' + _lsIcon('lightbulb', 14) + '</div>';
    h += '<div class="ls-card-body">';
    h += '<div class="ls-card-title">' + $topRec.title + '</div>';
    h += '<div class="ls-card-sub">' + $topRec.message.substring(0, 80) + ($topRec.message.length > 80 ? '…' : '') + '</div>';
    h += '</div>';
    h += '<div class="ls-smart-score">' + $topRec.score + '</div>';
    h += '</div>';
  }

  // ═══ 6. REVIEWS DUE (conditional) ═══
  if ($dueCount > 0) {
    h += '<div class="ls-action-card ls-card-review" id="ls-reviews-due" tabindex="0" role="button" aria-label="' + $dueCount + ' words due for review">';
    h += '<div class="ls-card-icon">' + _lsIcon('repeat', 18) + '</div>';
    h += '<div class="ls-card-body">';
    h += '<div class="ls-card-title">' + $dueCount + ' Review' + ($dueCount !== 1 ? 's' : '') + ' Due</div>';
    h += '<div class="ls-card-sub">Keep your memory strong — review now</div>';
    h += '</div>';
    h += '<span class="ls-badge-pulse">' + $dueCount + '</span>';
    h += '</div>';
  }

  // ═══ 7. CONTINUE LEARNING ═══
  if ($fTotal > 0) {
    var $continueLabel = $foundationComplete ? 'Surah Learning' : 'Foundation ' + ($fNextIdx + 1) + ' of ' + $fTotal;
    h += '<div class="ls-action-card ls-card-learn" id="ls-continue-learning" tabindex="0" role="button" aria-label="Continue learning">';
    h += '<div class="ls-card-icon">' + _lsIcon('layers', 18) + '</div>';
    h += '<div class="ls-card-body">';
    h += '<div class="ls-card-title">' + $continueLabel + '</div>';
    h += '<div class="ls-card-sub">' + ($foundationComplete ? 'Foundation complete! Study by surah.' : $fPct + '% complete · ~' + $comprehensionPct + '% comprehension') + '</div>';
    h += '</div>';
    h += '<div class="ls-progress-ring"><svg viewBox="0 0 36 36" width="28" height="28"><path class="goal-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><path class="goal-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $fPct + ', 100" stroke="var(--gold)"/></svg></div>';
    h += '</div>';
  }

  // ═══ 8. LEARNING PATHS (quick compact grid) ═══
  h += '<div class="ls-paths-grid">';
  var $surahTotal = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary().length : 0;
  var $surahProg = typeof getSurahLessonProgress === 'function' ? getSurahLessonProgress() : null;
  var $surahDone = $surahProg ? $surahProg.completedSurahs : 0;
  var $rfTotal = typeof getTotalRootFamilyCount === 'function' ? getTotalRootFamilyCount() : 0;
  var $rfDone = typeof getCompletedRootFamilyCount === 'function' ? getCompletedRootFamilyCount() : 0;
  var $diffDone = typeof getCompletedDifficultyLevelCount === 'function' ? getCompletedDifficultyLevelCount() : 0;

  h += '<div class="ls-path-item" id="ls-path-foundation" tabindex="0" role="button" aria-label="Foundation course">' + _lsIcon('layers', 14) + ' <span>Foundation</span> <span class="ls-path-pct">' + $fPct + '%</span></div>';
  h += '<div class="ls-path-item" id="ls-path-surah" tabindex="0" role="button" aria-label="Learn by surah">' + _lsIcon('book', 14) + ' <span>Surahs</span> <span class="ls-path-pct">' + ($surahTotal > 0 ? Math.round(($surahDone / $surahTotal) * 100) : 0) + '%</span></div>';
  h += '<div class="ls-path-item" id="ls-path-roots" tabindex="0" role="button" aria-label="Learn by roots">' + _lsIcon('leaf', 14) + ' <span>Roots</span> <span class="ls-path-pct">' + ($rfTotal > 0 ? Math.round(($rfDone / $rfTotal) * 100) : 0) + '%</span></div>';
  h += '<div class="ls-path-item" id="ls-path-difficulty" tabindex="0" role="button" aria-label="Learn by difficulty">' + _lsIcon('target', 14) + ' <span>Difficulty</span> <span class="ls-path-pct">' + Math.round(($diffDone / 5) * 100) + '%</span></div>';
  h += '<div class="ls-path-item" id="ls-path-quiz" tabindex="0" role="button" aria-label="Take a quiz">' + _lsIcon('bolt', 14) + ' <span>Quiz</span> <span class="ls-path-pct">⚡</span></div>';
  h += '</div>';

  // ═══ 9. MOTIVATION CARD ═══
  var $milestone = typeof getMilestoneStatus === 'function' ? getMilestoneStatus($comprehensionPct) : null;
  var $motivationMsg = $streak > 0 ?
    '🔥 ' + $streak + '-day learning streak! ' + ($reviewsToday > 0 ? 'Reviewed ' + $reviewsToday + ' words today.' : 'Review some words to keep it going!') :
    '🌟 Start your learning journey today!';
  if ($milestone && $milestone.currentMilestone) {
    $motivationMsg = $milestone.currentMilestone.icon + ' ' + $milestone.currentMilestone.label + ' — ' + ($milestone.currentMilestone.insight || 'Keep going!');
  }

  h += '<div class="ls-motivation">';
  h += '<div class="ls-motivation-icon">' + _lsIcon('award', 14) + '</div>';
  h += '<div class="ls-motivation-text">' + $motivationMsg + '</div>';
  h += '</div>';

  // ═══ 10. DAILY PLAN (from adaptive engine, condensed) ═══
  if ($dailyPlan && $dailyPlan.length > 0) {
    h += '<div class="ls-daily-plan" id="ls-daily-plan">';
    h += '<div class="ls-daily-title">' + _lsIcon('calendar', 12) + ' Today\'s Plan</div>';
    var $shownTasks = 0;
    for (var $dpi = 0; $dpi < $dailyPlan.length && $shownTasks < 3; $dpi++) {
      var $task = $dailyPlan[$dpi];
      if (typeof $task.done === 'function' && $task.done()) continue;
      $shownTasks++;
      h += '<div class="ls-daily-task" data-plan-id="' + $task.id + '">';
      h += '<span class="ls-daily-icon">' + _lsIcon($task.icon || 'star', 12) + '</span>';
      h += '<span class="ls-daily-label">' + $task.label + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }

  // ── Inject ──
  container.innerHTML = h;

  // Wire events for the action cards
  wireLearnScreenEvents();
}

// ═══════════════════════════════════════════════════════════════
// EVENT WIRING — Learn action card click handlers
// ═══════════════════════════════════════════════════════════════

function wireLearnScreenEvents() {
  // Helper: safe onclick
  function $lwire(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.onclick = fn;
    el.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  }

  // Continue Reading
  $lwire('ls-continue-reading', function() {
    if (typeof switchView === 'function') switchView('reader');
    if (window.__reader && typeof window.__reader.resumeReading === 'function') {
      setTimeout(function() { window.__reader.resumeReading(); }, 0);
    }
  });

  // Smart Recommendation
  $lwire('ls-smart-rec', function() {
    if (window.__smartLearning) {
      var recs = window.__smartLearning.getScoredRecommendations();
      if (recs.length > 0 && recs[0].actionType) {
        var action = recs[0].actionType;
        if (action === 'review' || action === 'review-difficult') {
          if (typeof startReview === 'function') startReview();
          else if (typeof switchView === 'function') switchView('learn');
        } else if (action === 'foundation' || action === 'foundation-reinforcement') {
          if (typeof goToFoundationLesson === 'function') goToFoundationLesson(typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0);
          else if (typeof switchView === 'function') switchView('learn');
        } else if (action === 'reading-review' || action === 'reading') {
          if (typeof switchView === 'function') switchView('reader');
        } else if (action === 'surah' || action === 'surah-learning') {
          if (typeof switchView === 'function') switchView('learn');
        } else if (action === 'root-family') {
          if (typeof goToRootFamily === 'function') goToRootFamily();
          else if (typeof switchView === 'function') switchView('learn');
        } else {
          if (typeof switchView === 'function') switchView('learn');
        }
      }
    }
  });

  // Reviews Due → start review
  $lwire('ls-reviews-due', function() {
    if (typeof startReview === 'function') startReview();
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Continue Learning
  $lwire('ls-continue-learning', function() {
    if ($fTotal > 0 && $fCompleted < $fTotal) {
      if (typeof goToFoundationLesson === 'function') goToFoundationLesson($fNextIdx);
      else if (typeof switchView === 'function') switchView('learn');
    } else {
      if (typeof switchView === 'function') switchView('learn');
    }
  });

  // Learning Paths
  $lwire('ls-path-foundation', function() {
    if (typeof goToFoundationLesson === 'function') goToFoundationLesson($fNextIdx || 0);
    else if (typeof switchView === 'function') switchView('learn');
  });
  $lwire('ls-path-surah', function() {
    if (typeof switchView === 'function') switchView('learn');
  });
  $lwire('ls-path-roots', function() {
    if (typeof goToRootFamily === 'function') goToRootFamily();
    else if (typeof switchView === 'function') switchView('learn');
  });
  $lwire('ls-path-difficulty', function() {
    if (typeof goToDifficultyLevel === 'function') goToDifficultyLevel(typeof getNextIncompleteDifficultyLevel === 'function' ? getNextIncompleteDifficultyLevel() : 1);
    else if (typeof switchView === 'function') switchView('learn');
  });
  // Quiz — launch from Paths
  $lwire('ls-path-quiz', function() {
    if (typeof switchView === 'function') switchView('quiz');
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__learnScreen = {
  render: renderLearnScreen,
  wireEvents: wireLearnScreenEvents,
};
