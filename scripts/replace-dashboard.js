const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'ui.js');
let content = fs.readFileSync(filePath, 'utf8');

// The new renderDashboard function - fixed
const newFunction = `
function renderDashboard() {
  try {
  var $d = DOM.get('dashboard-grid');
  if (!$d) return;

  // ── Gather data ──
  var $srsObj = window.__srs;
  var $srsStats = ($srsObj && $srsObj.getStats) ? $srsObj.getStats() : (typeof getSRSStats === 'function' ? getSRSStats() : { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0 });
  if (!$srsStats) $srsStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0 };
  var $dueReviews = typeof getDueReviews === 'function' ? getDueReviews() : [];
  var $streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var $streak = $streakData.streak || 0;

  // Foundation course data
  var $fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var $fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var $foundationsPct = $fTotal > 0 ? Math.round(($fCompleted / $fTotal) * 100) : 0;

  // Quran coverage data
  var $coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;

  // Mastery stats
  var $masteredCount = $srsStats.mature || 0;
  var $totalWords = $srsStats.total || (typeof getCanonicalWordCount === 'function' && getCanonicalWordCount() > 0 ? getCanonicalWordCount() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 0));
  var $comprehensionPct = $coverage ? $coverage.estimatedComprehension : 0;

  // Learn by Surah data
  var $surahProgress = typeof getSurahLessonProgress === 'function' ? getSurahLessonProgress() : null;
  var $surahCompleted = $surahProgress ? $surahProgress.completedSurahs : 0;
  var $surahTotal = $surahProgress ? $surahProgress.totalSurahs : 90;
  var $surahPct = $surahTotal > 0 ? Math.round(($surahCompleted / $surahTotal) * 100) : 0;

  // Due reviews
  var $dueCount = $dueReviews.length;

  // Reviews today
  var $reviewsToday = $srsStats.reviewsToday || 0;

  // ── Build HTML ──
  var $html = '';

  // 1. Greeting
  $html += '<div class="db-greeting">';
  $html += '<span class="db-greeting-icon" aria-hidden="true">&#x1F4D6;</span>';
  $html += '<div>';
  $html += '<h2 class="db-greeting-title">Assalamu Alaikum</h2>';
  $html += '<p class="db-greeting-sub">Your journey to understand the Quran</p>';
  $html += '</div></div>';

  // 2. Hero Stats Bar
  $html += '<div class="db-hero-bar">';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Streak: ' + $streak + ' days" id="db-hero-streak">';
  $html += '<div class="db-hero-stat-value">\\uD83D\\uDD25 ' + $streak + '</div>';
  $html += '<div class="db-hero-stat-label">Day Streak</div></div>';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Words mastered: ' + $masteredCount + '" id="db-hero-mastered">';
  $html += '<div class="db-hero-stat-value">' + $masteredCount + '</div>';
  $html += '<div class="db-hero-stat-label">Mastered</div></div>';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Quran coverage: ' + $comprehensionPct + '%" id="db-hero-coverage">';
  $html += '<div class="db-hero-stat-value">' + $comprehensionPct + '%</div>';
  $html += '<div class="db-hero-stat-label">Coverage</div></div>';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Reviews today: ' + $reviewsToday + '" id="db-hero-reviews">';
  $html += '<div class="db-hero-stat-value">' + $reviewsToday + '</div>';
  $html += '<div class="db-hero-stat-label">Reviews</div></div>';
  $html += '</div>';

  // Comprehension ring offset
  var $covOffset = Math.min(100, Math.max(0, Math.round(($comprehensionPct / 100) * 100)));

  // 3. Quran Comprehension Card (hero feature)
  $html += '<div class="db-card db-card-highlight">';
  $html += '<div class="db-comp-row">';
  $html += '<div class="db-ring-wrap">';
  $html += '<svg class="db-ring" viewBox="0 0 36 36" aria-hidden="true">';
  $html += '<defs>';
  $html += '<linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">';
  $html += '<stop offset="0%" stop-color="#c9a84c" />';
  $html += '<stop offset="100%" stop-color="#e8c97a" />';
  $html += '</linearGradient>';
  $html += '</defs>';
  $html += '<path class="db-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />';
  $html += '<path class="db-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $covOffset + ', 100" />';
  $html += '<text class="db-ring-text" x="18" y="20.5">' + $comprehensionPct + '%</text>';
  $html += '</svg></div>';
  $html += '<div class="db-comp-info">';
  $html += '<div class="db-comp-label">Quran Comprehension</div>';
  $html += '<div class="db-comp-value">' + $comprehensionPct + '%</div>';
  $html += '<div class="db-comp-detail">';
  if ($coverage) {
    $html += $masteredCount + ' of ' + $coverage.totalWords + ' words mastered';
  } else {
    $html += 'You understand <strong>' + $comprehensionPct + '%</strong> of Quran word occurrences';
  }
  $html += '</div>';
  // Milestone insight
  var $ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus($comprehensionPct) : null;
  if ($ms && $ms.currentMilestone) {
    $html += '<div class="db-comp-milestone">';
    $html += $ms.currentMilestone.icon + ' ' + $ms.currentMilestone.label;
    $html += '</div>';
  }
  $html += '</div></div></div>';

  // 4. CTA — Continue Learning (large primary button)
  var $continueLabel = $fCompleted === 0 ? 'Start Foundation Course' : ($fCompleted < $fTotal ? 'Continue Foundation Course' : "Review What You've Learned");
  $html += '<button class="db-cta" id="db-continue" role="button" aria-label="' + $continueLabel + '">';
  $html += '<div class="db-cta-title">' + $continueLabel + '</div>';
  $html += '<div class="db-cta-sub">Foundation ' + Math.min($fCompleted + 1, $fTotal) + ' of ' + $fTotal + ' lessons</div>';
  $html += '<span class="db-cta-arrow" aria-hidden="true">\\u2192</span>';
  $html += '</button>';

  // 5. Foundation Course Card
  $html += '<div class="db-card db-action-card" id="db-foundation" role="button" tabindex="0" aria-label="Foundation Course progress: ' + $fCompleted + ' of ' + $fTotal + ' lessons">';
  $html += '<div class="db-card-row">';
  $html += '<div class="db-card-icon" style="background:rgba(201,168,76,0.1)">&#x1F4D8;</div>';
  $html += '<div class="db-card-body">';
  $html += '<div class="db-card-title">Foundation Course</div>';
  $html += '<div class="db-card-sub">' + $fCompleted + ' of ' + $fTotal + ' lessons completed</div>';
  $html += '</div>';
  $html += '<span class="db-arrow" aria-hidden="true">\\u2192</span>';
  $html += '</div>';
  $html += '<div class="db-progress">';
  $html += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $foundationsPct + '%"></div></div>';
  $html += '<span class="db-progress-text">' + $foundationsPct + '%</span>';
  $html += '</div></div>';

  // 6. Learn by Surah Card
  $html += '<div class="db-card db-action-card" id="db-surah" role="button" tabindex="0" aria-label="Learn by Surah: ' + $surahCompleted + ' of ' + $surahTotal + ' surahs">';
  $html += '<div class="db-card-row">';
  $html += '<div class="db-card-icon" style="background:rgba(74,158,107,0.1)">&#x1F4DC;</div>';
  $html += '<div class="db-card-body">';
  $html += '<div class="db-card-title">Learn by Surah</div>';
  $html += '<div class="db-card-sub">' + $surahCompleted + ' of ' + $surahTotal + ' surahs studied</div>';
  $html += '</div>';
  $html += '<span class="db-arrow" aria-hidden="true">\\u2192</span>';
  $html += '</div>';
  $html += '<div class="db-progress">';
  $html += '<div class="db-progress-track"><div class="db-progress-fill db-fill-green" style="width:' + $surahPct + '%"></div></div>';
  $html += '<span class="db-progress-text">' + $surahPct + '%</span>';
  $html += '</div></div>';

  // 7. Due Reviews Card (conditional)
  if ($dueCount > 0) {
    $html += '<div class="db-card db-action-card db-card-due" id="db-review" role="button" tabindex="0" aria-label="' + $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + ' due for review">';
    $html += '<div class="db-card-row">';
    $html += '<div class="db-card-icon" style="background:rgba(201,168,76,0.15)">\\uD83D\\uDD14</div>';
    $html += '<div class="db-card-body">';
    $html += '<div class="db-card-title">Due Reviews</div>';
    $html += '<div class="db-card-sub">' + ($dueCount === 1 ? '1 word ready for review' : $dueCount + ' words ready for review') + '</div>';
    $html += '</div>';
    $html += '<span class="db-badge">' + $dueCount + '</span>';
    $html += '</div></div>';
  }

  // 8. Weekly Progress Section
  $html += '<div class="db-card">';
  $html += '<div class="db-weekly">';
  $html += '<div class="db-weekly-title">\\uD83D\\uDCC5 Weekly Review Forecast</div>';
  var $srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var $now = Date.now();
  var $dayMs = 24 * 60 * 60 * 1000;
  var $intervals = [
    { label: 'Today', days: 0 },
    { label: '3 Days', days: 3 },
    { label: '7 Days', days: 7 },
  ];
  var $totalW = (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 1) || 1;
  for (var $ii = 0; $ii < $intervals.length; $ii++) {
    var $int = $intervals[$ii];
    var $cut = $now + $int.days * $dayMs;
    var $cnt = 0;
    if (typeof ALL_WORDS !== 'undefined') {
      for (var $wi = 0; $wi < ALL_WORDS.length; $wi++) {
        var $e = $srsData[ALL_WORDS[$wi].id];
        if ($e && $e.dueDate <= $cut) $cnt++;
      }
    }
    var $pct = Math.round($totalW > 0 ? ($cnt / $totalW) * 100 : 0);
    var $color = $int.days === 0 ? 'var(--gold)' : ($int.days <= 3 ? 'var(--blue)' : 'var(--green)');
    $html += '<div class="db-weekly-item">';
    $html += '<span class="db-weekly-label">' + $int.label + '</span>';
    $html += '<div class="db-weekly-track"><div class="db-weekly-fill" style="width:' + Math.min($pct, 100) + '%;background:' + $color + '"></div></div>';
    $html += '<span class="db-weekly-value">' + $cnt + '</span>';
    $html += '</div>';
  }
  $html += '</div></div>';

  // 9. Achievements Section
  $html += '<div class="db-card">';
  $html += '<div class="db-achievement">';
  $html += '<div class="db-ach-title">\\uD83C\\uDFC6 Recent Achievements</div>';
  $html += '<div class="db-ach-row">';
  if ($streak > 0) {
    $html += '<span class="db-ach-item">\\uD83D\\uDD25 ' + $streak + '-day streak</span>';
  }
  if ($masteredCount > 0) {
    $html += '<span class="db-ach-item">\\uD83D\\uDCA1 ' + $masteredCount + ' words mastered</span>';
  }
  $html += '<span class="db-ach-item">\\uD83D\\uDCD6 ' + $totalWords + ' total words</span>';
  if ($reviewsToday > 0) {
    $html += '<span class="db-ach-item">\\uD83D\\uDD01 ' + $reviewsToday + ' reviewed today</span>';
  }
  if ($fCompleted > 0) {
    $html += '<span class="db-ach-item">\\uD83D\\uDCD8 ' + $fCompleted + ' lessons done</span>';
  }
  $html += '</div></div></div>';

  // ── Inject HTML ──
  $d.innerHTML = $html;

  // ── Wire hero stats clicks ──
  var $heroStreak = DOM.get('db-hero-streak');
  if ($heroStreak) {
    $heroStreak.onclick = function() { switchView('stats'); };
    $heroStreak.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('stats'); } };
  }
  var $heroMastered = DOM.get('db-hero-mastered');
  if ($heroMastered) {
    $heroMastered.onclick = function() { switchView('list'); };
    $heroMastered.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('list'); } };
  }
  var $heroCoverage = DOM.get('db-hero-coverage');
  if ($heroCoverage) {
    $heroCoverage.onclick = function() { switchView('analytics'); };
    $heroCoverage.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('analytics'); } };
  }
  var $heroReviews = DOM.get('db-hero-reviews');
  if ($heroReviews) {
    $heroReviews.onclick = function() { if (typeof startReview === 'function') startReview(); else switchView('learn'); };
    $heroReviews.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof startReview === 'function') startReview(); } };
  }

  // ── Wire card clicks ──
  var $contBtn = DOM.get('db-continue');
  if ($contBtn) {
    $contBtn.onclick = function() {
      if (typeof goToFoundationLesson === 'function') {
        goToFoundationLesson(typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0);
      } else {
        switchView('learn');
      }
    };
  }
  var $foundCard = DOM.get('db-foundation');
  if ($foundCard) {
    $foundCard.onclick = function() {
      if (typeof goToFoundationLesson === 'function') {
        goToFoundationLesson(typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0);
      }
    };
    $foundCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $foundCard.onclick(); }
    };
  }
  var $surahCard = DOM.get('db-surah');
  if ($surahCard) {
    $surahCard.onclick = function() {
      switchView('learn');
    };
    $surahCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('learn'); }
    };
  }
  var $reviewCard = DOM.get('db-review');
  if ($reviewCard) {
    $reviewCard.onclick = function() {
      if (typeof startReview === 'function') startReview();
      else switchView('learn');
    };
    $reviewCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof startReview === 'function') startReview(); }
    };
  }

  // ── Animate comprehension ring ──
  var $compCardParent = $d.querySelector('.db-card-highlight');
  var $isNewMs = false;
  if (window.__prevComprehensionPct !== undefined) {
    var $milestones = window.__comprehensionMilestones || [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95, 100];
    for (var $mi = 0; $mi < $milestones.length; $mi++) {
      if (window.__prevComprehensionPct < $milestones[$mi] && $comprehensionPct >= $milestones[$mi]) {
        $isNewMs = true;
        break;
      }
    }
  }
  window.__prevComprehensionPct = $comprehensionPct;
  if (typeof animateDashboardComprehension === 'function') {
    animateDashboardComprehension($compCardParent, $comprehensionPct, $isNewMs);
  }

  } catch (e) {
    console.error('[dashboard] renderDashboard error:', e);
    var $d = DOM.get('dashboard-grid');
    if ($d) $d.innerHTML = '<div class="db-error">\\u26A0\\uFE0F Something went wrong loading your dashboard. <button class="btn btn-sm mt-10" onclick="window.location.reload()">Reload</button></div>';
  }
}
`;

// Find renderDashboard function start
const marker = 'function renderDashboard()';
const startIdx = content.lastIndexOf(marker);

if (startIdx === -1) {
  console.error('ERROR: Could not find renderDashboard function');
  process.exit(1);
}

// Find the end of the function (end of file)
const newContent = content.substring(0, startIdx) + newFunction.trim();

fs.writeFileSync(filePath, newContent);
console.log('SUCCESS: renderDashboard function replaced (fixed)');
console.log('File size:', newContent.length, 'chars');
