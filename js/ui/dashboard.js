// ═══════════════════════════════════════════════════════════════
// dashboard.js — Premium Learning Hub Dashboard
//
// Redesigned dashboard hierarchy:
//   1. Greeting + Compact Stats Bar
//   2. ⭐ Recommended: Foundation Course Hero
//   3. Continue Learning Button
//   4. Learning Paths (5 tiles)
//   5. Today's Reviews (conditional)
//   6. Progress Snapshot
//   7. Weekly Review Forecast
//   8. Recent Achievements
//
// Every interactive element has a direct onclick handler.
// No stale DOM cache references — uses document.getElementById directly.
// ═══════════════════════════════════════════════════════════════

function renderDashboard() {
  try {
  var $d = document.getElementById('dashboard-grid');
  if (!$d) return;

  // Invalidate DOM cache to prevent stale references from re-renders
  if (typeof DOM === 'object' && DOM._cache) DOM._cache = {};

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

  // SVG helper
  var $icons = window.__components && window.__components.createSVGIcon;
  function $icon(name, size) {
    if ($icons) return $icons(name, {size: size || 22});
    var $map = {book: '📖', layers: '📚', list: '📋', chart: '📊', bolt: '⚡', star: '⭐', target: '🎯', fire: '🔥', check: '✓', brain: '🧠', clock: '⏰', crown: '👑'};
    return $map[name] || '📖';
  }

  // ── Build HTML ──
  var $h = '';

  // ═══ 1. GREETING ═══
  $h += '<div class="db-greeting">';
  $h += '<div class="db-greeting-icon" aria-hidden="true">' + $icon('book', 28) + '</div>';
  $h += '<div>';
  $h += '<h2 class="db-greeting-title">Assalamu Alaikum</h2>';
  $h += '<p class="db-greeting-sub">Your journey to understand the Quran</p>';
  $h += '</div></div>';

  // ═══ 2. COMPACT HERO STATS BAR ═══
  $h += '<div class="db-hero-bar">';
  $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="stats" tabindex="0" role="button" aria-label="Streak: ' + $streak + ' days">';
  $h += '<div class="db-hero-stat-value">🔥 ' + $streak + '</div>';
  $h += '<div class="db-hero-stat-label">Streak</div></div>';
  $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="list" tabindex="0" role="button" aria-label="Words mastered: ' + $masteredCount + '">';
  $h += '<div class="db-hero-stat-value">' + $masteredCount + '</div>';
  $h += '<div class="db-hero-stat-label">Mastered</div></div>';
  $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="analytics" tabindex="0" role="button" aria-label="Quran comprehension: ' + $comprehensionPct + '%">';
  $h += '<div class="db-hero-stat-value">' + $comprehensionPct + '%</div>';
  $h += '<div class="db-hero-stat-label">Comprehension</div></div>';
  $h += '<div class="db-hero-stat db-hero-stat-click" data-db-action="review" tabindex="0" role="button" aria-label="Reviews today: ' + $reviewsToday + '">';
  $h += '<div class="db-hero-stat-value">' + $reviewsToday + '</div>';
  $h += '<div class="db-hero-stat-label">Reviews</div></div>';
  $h += '</div>';

  // ═══ 3. RECOMMENDED PATH — FOUNDATION COURSE HERO ═══
  if ($fTotal > 0) {
    var $ringOffset = Math.min(100, Math.max(0, Math.round(($comprehensionPct / 100) * 100)));

    $h += '<div class="db-section-label">⭐ Recommended Path</div>';

    $h += '<div class="db-hero-card" id="db-hero-card">';
    $h += '<div class="db-hero-card-bg" aria-hidden="true"></div>';

    // Top row: ring + info
    $h += '<div class="db-hero-row">';
    $h += '<div class="db-hero-ring-wrap">';
    $h += '<svg class="db-ring" viewBox="0 0 36 36" aria-hidden="true">';
    $h += '<defs><linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
    $h += '<stop offset="0%" stop-color="#c9a84c"/><stop offset="100%" stop-color="#e8c97a"/>';
    $h += '</linearGradient></defs>';
    $h += '<path class="db-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>';
    $h += '<path class="db-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $ringOffset + ', 100" stroke="url(#heroGrad)"/>';
    $h += '<text class="db-ring-text" x="18" y="20.5" font-weight="700" font-size="9">' + $comprehensionPct + '%</text>';
    $h += '</svg></div>';

    $h += '<div class="db-hero-info">';
    if (!$foundationComplete) {
      $h += '<div class="db-hero-title">Foundation Course</div>';
      $h += '<div class="db-hero-subtitle">' + $nextLessonTitle + '</div>';
      $h += '<div class="db-hero-detail">Lesson ' + $nextLessonNum + ' of ' + $fTotal + '</div>';
    } else {
      $h += '<div class="db-hero-title">' + $comprehensionPct + '% Comprehension</div>';
      $h += '<div class="db-hero-subtitle">Foundation Course Complete! 🎉</div>';
      $h += '<div class="db-hero-detail">' + $masteredCount + ' words mastered · ' + $coveragePct + '% Quran coverage</div>';
    }
    $h += '</div></div>'; // end ring + info row

    // Bottom row: meta + action
    $h += '<div class="db-hero-meta">';
    if ($milestoneText) {
      $h += '<span class="db-hero-milestone">' + $milestoneText + '</span>';
    }
    if (!$foundationComplete && $nextLessonTitle) {
      $h += '<span class="db-hero-meta-text">';
      if ($compGain > 0) $h += '📈 +' + $compGain + '% comprehension';
      $h += ' · Covers ' + $lessonCoverage + ' of occurrences';
      $h += '</span>';
    }
    if ($foundationComplete) {
      var $sortedComp = $allSurahComp.slice().sort(function(a,b){return b.estimatedComprehension - a.estimatedComprehension;});
      var $bestSurah = $sortedComp.length > 0 ? $sortedComp[0] : null;
      if ($bestSurah) {
        var $bestName = typeof getSurahInfo === 'function' && getSurahInfo($bestSurah.surahId) ? getSurahInfo($bestSurah.surahId).name : 'Surah ' + $bestSurah.surahId;
        $h += '<span class="db-hero-meta-text">📖 Best: ' + $bestName + ' (' + $bestSurah.estimatedComprehension + '%)</span>';
      }
    }
    $h += '</div>';

    $h += '<div class="db-hero-action">';
    $h += '<button class="btn db-hero-btn" id="db-hero-continue" type="button">' + $continueLabel + '</button>';
    $h += '</div></div>'; // end hero card
  }

  // ═══ 4. LEARNING PATHS ═══
  $h += '<div class="db-section-label">Learning Paths</div>';
  $h += '<div class="db-paths-grid">';

  // Path 1: Foundation Course (⭐ Recommended)
  $h += '<div class="db-path-tile db-path-recommended" id="db-path-foundation" tabindex="0" role="button" aria-label="Foundation Course: ' + $fCompleted + ' of ' + $fTotal + ' lessons">';
  $h += '<div class="db-path-tile-header">';
  $h += '<div class="db-path-icon" style="background:rgba(201,168,76,0.12)">' + $icon('layers', 20) + '</div>';
  $h += '<div class="db-path-body">';
  $h += '<div class="db-path-title">Foundation Course <span class="db-path-badge">⭐ Recommended</span></div>';
  $h += '<div class="db-path-sub">' + $fCompleted + ' of ' + $fTotal + ' lessons · ~' + $coveragePct + '% Quran coverage</div>';
  $h += '</div></div>';
  $h += '<div class="db-progress">';
  $h += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $fPct + '%"></div></div>';
  $h += '<span class="db-progress-text">' + $fPct + '%</span>';
  $h += '</div></div>';

  // Path 2: Learn by Surah
  var $surahPct = $surahTotal > 0 ? Math.round(($surahCompleted / $surahTotal) * 100) : 0;
  $h += '<div class="db-path-tile" id="db-path-surah" tabindex="0" role="button" aria-label="Learn by Surah: ' + $surahCompleted + ' of ' + $surahTotal + ' surahs">';
  $h += '<div class="db-path-tile-header">';
  $h += '<div class="db-path-icon" style="background:rgba(74,126,194,0.12)">' + $icon('book', 20) + '</div>';
  $h += '<div class="db-path-body">';
  $h += '<div class="db-path-title">Learn by Surah</div>';
  $h += '<div class="db-path-sub">' + $surahCompleted + ' of ' + $surahTotal + ' surahs studied</div>';
  $h += '</div></div>';
  $h += '<div class="db-progress">';
  $h += '<div class="db-progress-track"><div class="db-progress-fill db-fill-blue" style="width:' + $surahPct + '%"></div></div>';
  $h += '<span class="db-progress-text db-text-blue">' + $surahPct + '%</span>';
  $h += '</div></div>';

  // Path 3: Learn by Root Words
  $h += '<div class="db-path-tile" id="db-path-root" tabindex="0" role="button" aria-label="Learn by Root Words: ' + $rfCompleted + ' of ' + $rfTotal + ' roots">';
  $h += '<div class="db-path-tile-header">';
  $h += '<div class="db-path-icon" style="background:rgba(138,107,191,0.12)">' + $icon('star', 20) + '</div>';
  $h += '<div class="db-path-body">';
  $h += '<div class="db-path-title">Learn by Root Words</div>';
  $h += '<div class="db-path-sub">' + $rfCompleted + ' of ' + $rfTotal + ' root families</div>';
  $h += '</div></div>';
  $h += '<div class="db-progress">';
  $h += '<div class="db-progress-track"><div class="db-progress-fill db-fill-purple" style="width:' + $rfPct + '%"></div></div>';
  $h += '<span class="db-progress-text db-text-purple">' + $rfPct + '%</span>';
  $h += '</div></div>';

  // Path 4: Learn by Difficulty
  $h += '<div class="db-path-tile" id="db-path-difficulty" tabindex="0" role="button" aria-label="Learn by Difficulty: ' + $diffCompleted + ' of ' + $diffTotal + ' levels">';
  $h += '<div class="db-path-tile-header">';
  $h += '<div class="db-path-icon" style="background:rgba(74,158,107,0.12)">' + $icon('target', 20) + '</div>';
  $h += '<div class="db-path-body">';
  $h += '<div class="db-path-title">Learn by Difficulty</div>';
  $h += '<div class="db-path-sub">' + $diffCompleted + ' of ' + $diffTotal + ' levels complete</div>';
  $h += '</div></div>';
  $h += '<div class="db-progress">';
  $h += '<div class="db-progress-track"><div class="db-progress-fill db-fill-green" style="width:' + $diffPct + '%"></div></div>';
  $h += '<span class="db-progress-text db-text-green">' + $diffPct + '%</span>';
  $h += '</div></div>';

  // Path 5: Mixed Review
  var $mixedLabel = $mixedCount > 0 ? $mixedCount + ' words ready' : 'Review all due words';
  $h += '<div class="db-path-tile" id="db-path-mixed" tabindex="0" role="button" aria-label="Mixed Review: ' + $mixedLabel + '">';
  $h += '<div class="db-path-tile-header">';
  $h += '<div class="db-path-icon" style="background:rgba(201,168,76,0.1)">' + $icon('bolt', 20) + '</div>';
  $h += '<div class="db-path-body">';
  $h += '<div class="db-path-title">Mixed Review</div>';
  $h += '<div class="db-path-sub">' + $mixedLabel + '</div>';
  $h += '</div></div>';
  $h += '<div class="db-path-action-hint">Review →</div>';
  $h += '</div>';

  $h += '</div>'; // end paths grid

  // ═══ 5. TODAY'S REVIEWS (conditional) ═══
  if ($dueCount > 0) {
    $h += '<div class="db-card db-card-due db-action-card" id="db-review" tabindex="0" role="button" aria-label="' + $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + ' due for review">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon" style="background:rgba(201,168,76,0.15)">🔁</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">Due for Review</div>';
    $h += '<div class="db-card-sub">' + ($dueCount === 1 ? '1 word needs reinforcement' : $dueCount + ' words need reinforcement') + '</div>';
    $h += '</div>';
    $h += '<span class="db-badge db-badge-pulse">' + $dueCount + '</span>';
    $h += '</div></div>';
  } else if ($reviewsToday > 0) {
    // Show positive reinforcement when all caught up
    $h += '<div class="db-card db-card-caught-up">';
    $h += '<div class="db-card-row">';
    $h += '<div class="db-card-icon" style="background:rgba(74,158,107,0.1)">✅</div>';
    $h += '<div class="db-card-body">';
    $h += '<div class="db-card-title">All Caught Up!</div>';
    $h += '<div class="db-card-sub">' + $reviewsToday + ' reviews done today — great consistency</div>';
    $h += '</div></div></div>';
  }

  // ═══ 6. PROGRESS SNAPSHOT ═══
  $h += '<div class="db-section-label">Progress Snapshot</div>';
  $h += '<div class="db-card">';
  $h += '<div class="db-snapshot-grid">';

  // Comprehension
  $h += '<div class="db-snapshot-item">';
  $h += '<div class="db-snapshot-value">' + $comprehensionPct + '%</div>';
  $h += '<div class="db-snapshot-label">Comprehension</div>';
  $h += '</div>';

  // Words
  $h += '<div class="db-snapshot-item">';
  $h += '<div class="db-snapshot-value">' + $masteredCount + '</div>';
  $h += '<div class="db-snapshot-label">Words Mastered</div>';
  $h += '</div>';

  // Surahs at 50%+
  $h += '<div class="db-snapshot-item">';
  $h += '<div class="db-snapshot-value">' + $surahsWith50Plus + '/' + $surahsTotalC + '</div>';
  $h += '<div class="db-snapshot-label">Surahs (50%+)</div>';
  $h += '</div>';

  // Foundation
  if ($fTotal > 0) {
    $h += '<div class="db-snapshot-item">';
    $h += '<div class="db-snapshot-value">' + $fCompleted + '/' + $fTotal + '</div>';
    $h += '<div class="db-snapshot-label">Foundation</div>';
    $h += '</div>';
  }

  // Streak
  $h += '<div class="db-snapshot-item">';
  $h += '<div class="db-snapshot-value">🔥 ' + $streak + '</div>';
  $h += '<div class="db-snapshot-label">Day Streak</div>';
  $h += '</div>';

  // Due reviews
  $h += '<div class="db-snapshot-item">';
  $h += '<div class="db-snapshot-value">' + $dueCount + '</div>';
  $h += '<div class="db-snapshot-label">Due Reviews</div>';
  $h += '</div>';

  $h += '</div></div>';

  // Milestone insight (compact, if available)
  if ($ms && $ms.nextMilestone) {
    $h += '<div class="db-card db-card-milestone">';
    $h += '<div class="db-card-row">';
    $h += '<span style="font-size:16px;line-height:1;flex-shrink:0">' + ($ms.currentMilestone ? $ms.currentMilestone.icon : '🎯') + '</span>';
    $h += '<div style="flex:1;font-size:11px;color:var(--text-muted);line-height:1.5">';
    if ($ms.nextMilestone) {
      $h += 'Next milestone: ' + $ms.nextMilestone.icon + ' ' + $ms.nextMilestone.label + ' — ~' + $ms.lessonsToNextMilestone + ' lessons away';
    }
    if ($ms.currentMilestone && $ms.currentMilestone.insight) {
      $h += '<div style="font-size:10px;color:var(--gold-dim);margin-top:4px;font-style:italic">' + $ms.currentMilestone.insight + '</div>';
    }
    $h += '</div></div></div>';
  }

  // ═══ 7. WEEKLY REVIEW FORECAST (compact, collapsible) ═══
  if ($totalWords > 0) {
    $h += '<div class="db-card db-card-collapsible" id="db-weekly-section">';
    $h += '<div class="db-card-row db-card-collapsible-header" id="db-weekly-toggle" tabindex="0" role="button" aria-expanded="false" aria-label="Toggle weekly forecast">';
    $h += '<span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:500">📅 Review Forecast</span>';
    $h += '<span class="db-collapse-arrow" id="db-weekly-arrow">▶</span>';
    $h += '</div>';
    $h += '<div id="db-weekly-body" style="display:none">';
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
    for (var $ii = 0; $ii < $intervals.length; $ii++) {
      var $int = $intervals[$ii];
      var $cut = $now + $int.days * $dayMs;
      var $cnt = 0;
      for (var $wi = 0; $wi < $allWordsArr.length; $wi++) {
        var $e = $srsDataRaw[$allWordsArr[$wi].id];
        if ($e && $e.dueDate && $e.dueDate <= $cut) $cnt++;
      }
      var $pct = Math.min(100, Math.round($totalWords > 0 ? ($cnt / $totalWords) * 100 : 0));
      $h += '<div class="db-weekly-item">';
      $h += '<span class="db-weekly-label">' + $int.label + '</span>';
      $h += '<div class="db-weekly-track"><div class="db-weekly-fill" style="width:' + $pct + '%;background:' + $int.color + '"></div></div>';
      $h += '<span class="db-weekly-value">' + $cnt + '</span>';
      $h += '</div>';
    }
    $h += '</div></div>';
  }

  // ═══ 8. RECENT ACHIEVEMENTS ═══
  $h += '<div class="db-card">';
  $h += '<div class="db-achievement">';
  $h += '<div class="db-ach-title">🏆 Recent Achievements</div>';
  $h += '<div class="db-ach-row">';
  if ($streak > 0) $h += '<span class="db-ach-item">🔥 ' + $streak + '-day streak</span>';
  if ($masteredCount > 0) $h += '<span class="db-ach-item">💡 ' + $masteredCount + ' words mastered</span>';
  $h += '<span class="db-ach-item">📖 ' + $totalWords + ' total words</span>';
  if ($reviewsToday > 0) $h += '<span class="db-ach-item">🔁 ' + $reviewsToday + ' reviewed today</span>';
  if ($fCompleted > 0) $h += '<span class="db-ach-item">📘 ' + $fCompleted + ' foundation lessons</span>';
  if ($surahsWith50Plus > 0) $h += '<span class="db-ach-item">📖 ' + $surahsWith50Plus + ' surahs (50%+)</span>';
  $h += '</div></div></div>';

  // ── Inject HTML ──
  $d.innerHTML = $h;

  // ═══════════════════════════════════════════════════════════
  // EVENT WIRING — All handlers use direct onclick assignments
  // No DOM.get() cache — always document.getElementById for freshness
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
        if ($action === 'stats') switchView('stats');
        else if ($action === 'list') switchView('list');
        else if ($action === 'analytics') switchView('analytics');
        else if ($action === 'review') { if (typeof startReview === 'function') startReview(); else switchView('learn'); }
      };
      $el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $el.onclick(); }
      };
    })($heroStats[$hsi]);
  }

  // Hero continue button
  $wire('db-hero-continue', function() {
    if ($foundationComplete) {
      // Navigate to surah learning (best next step)
      var $surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
      if ($surahIds.length > 0 && typeof goToSurah === 'function') goToSurah($surahIds[0]);
      else if (typeof switchView === 'function') switchView('learn');
    } else if (typeof goToFoundationLesson === 'function') {
      goToFoundationLesson($nextIncompleteF);
    } else {
      if (typeof switchView === 'function') switchView('learn');
    }
  });

  // Learning Paths
  $wire('db-path-foundation', function() {
    if (typeof goToFoundationLesson === 'function') goToFoundationLesson($nextIncompleteF);
    else if (typeof switchView === 'function') switchView('learn');
  });
  $wire('db-path-surah', function() {
    if (typeof switchView === 'function') switchView('learn');
  });
  $wire('db-path-root', function() {
    if (typeof goToRootFamily === 'function') {
      var $nextRF = typeof getNextIncompleteRootFamily === 'function' ? getNextIncompleteRootFamily() : '';
      goToRootFamily($nextRF || undefined);
    } else if (typeof switchView === 'function') switchView('learn');
  });
  $wire('db-path-difficulty', function() {
    if (typeof goToDifficultyLevel === 'function') {
      var $nextD = typeof getNextIncompleteDifficultyLevel === 'function' ? getNextIncompleteDifficultyLevel() : 1;
      goToDifficultyLevel($nextD);
    } else if (typeof switchView === 'function') switchView('learn');
  });
  $wire('db-path-mixed', function() {
    if (typeof startMixedReview === 'function') startMixedReview();
    else if (typeof startReview === 'function') startReview();
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Review card
  $wire('db-review', function() {
    if (typeof startReview === 'function') startReview();
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Weekly forecast collapsible
  var $weeklyToggle = document.getElementById('db-weekly-toggle');
  if ($weeklyToggle) {
    $weeklyToggle.onclick = function() {
      var $body = document.getElementById('db-weekly-body');
      var $arrow = document.getElementById('db-weekly-arrow');
      if (!$body || !$arrow) return;
      var $isOpen = $body.style.display === 'block';
      $body.style.display = $isOpen ? 'none' : 'block';
      $arrow.style.transform = $isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
      $weeklyToggle.setAttribute('aria-expanded', $isOpen ? 'false' : 'true');
    };
    $weeklyToggle.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $weeklyToggle.onclick(); }
    };
  }

  // ── Animation: animate comprehension ring on mount ──
  if (typeof animateDashboardComprehension === 'function') {
    var $heroCard = document.getElementById('db-hero-card');
    if ($heroCard) animateDashboardComprehension($heroCard, $comprehensionPct, false);
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
    var $d = document.getElementById('dashboard-grid');
    if ($d) $d.innerHTML = '<div class="db-error">⚠️ We encountered an issue loading the dashboard. <button class="btn btn-sm mt-10" onclick="window.location.reload()">Reload</button></div>';
  }
}
