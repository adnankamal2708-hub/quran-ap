// ═══════════════════════════════════════════════════════════════
// review-center.js — Review Center
//
// Central hub for all review activities. Composes existing SRS,
// adaptive engine, and smart learning systems into a single
// consolidated experience. Does NOT duplicate review logic.
//
// Features:
//   • Reviews Due — smart overview with counts and priorities
//   • Review Modes — SRS, Quick, Root, Reading, Mixed, Weakest
//   • Forgotten Words — frequently forgotten words with targeted review
//   • Weak Roots — root families needing reinforcement
//   • Recently Learned — words from recent lessons
//   • Difficult Words — leeched/high-lapse words
//   • Smart Prioritization — what to review first
//   • Session History — recent session summaries
//   • One-tap Start Review from Dashboard
//
// All functions work fully offline using localStorage.
// ═══════════════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────────────
var _rcTimer = null;
var _rcDataCache = null;
var _rcCacheKey = null;

/**
 * Build a cache key for the review center data snapshot.
 * Changes when SRS stats or word set changes.
 */
function _rcCacheKeyFn() {
  try {
    var $st = typeof getSRSStats === 'function' ? getSRSStats() : {};
    return ($st.dueToday || 0) + '|' + ($st.reviewsToday || 0) + '|' + ($st.mature || 0) + '|' + ($st.overdue || 0);
  } catch(e) {
    return '';
  }
}

/**
 * Gather all review center data in a single call.
 * Returns cached data when possible to avoid redundant computation.
 */
function gatherReviewCenterData() {
  var $key = _rcCacheKeyFn();
  if (_rcDataCache && _rcCacheKey === $key) {
    return _rcDataCache;
  }

  var $srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var $srsStats = window.__srs && window.__srs.getStats ? (window.__srs.getStats() || {}) : {};
  var $now = Date.now();
  var $dayMs = 24 * 60 * 60 * 1000;

  // ── Due reviews (sorted by priority) ──
  var $dueReviews = typeof getDueReviews === 'function' ? getDueReviews() : [];
  var $dueCount = $dueReviews.length;
  var $overdueCount = 0;
  var $leechCount = 0;
  for (var $idi = 0; $idi < $dueReviews.length; $idi++) {
    var $entry = $srsData[$dueReviews[$idi].id];
    if ($entry) {
      if ($entry.isLeech) $leechCount++;
      if ($entry.dueDate && $now - $entry.dueDate > 3 * $dayMs) $overdueCount++;
    }
  }

  // ── Forgotten words (from analytics) ──
  var $forgottenWords = [];
  if (window.__analytics && window.__analytics.getFrequentlyForgotten) {
    $forgottenWords = window.__analytics.getFrequentlyForgotten() || [];
  }

  // ── Weak roots (from learner profile) ──
  var $weakRoots = [];
  if (typeof getLearnerProfile === 'function') {
    var $profile = getLearnerProfile();
    $weakRoots = $profile.weakRoots || [];
  }

  // ── Weaknesses (from adaptive engine) ──
  var $weaknesses = [];
  if (window.__adaptive && window.__adaptive.getWeaknessDetection) {
    $weaknesses = window.__adaptive.getWeaknessDetection() || [];
  }

  // ── Recently learned words (last 7 days) ──
  var $recentlyLearned = [];
  var $weekAgo = $now - 7 * $dayMs;
  var $allWords = typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : [];
  for (var $wi = 0; $wi < $allWords.length; $wi++) {
    var $wEntry = $srsData[$allWords[$wi].id];
    if ($wEntry && $wEntry.ratedAt && $wEntry.ratedAt >= $weekAgo && $wEntry.stage === 1) {
      $recentlyLearned.push($allWords[$wi]);
    }
    if ($recentlyLearned.length >= 20) break;
  }

  // ── Bookmarked words ──
  var $bookmarkedWords = [];
  if (typeof loadFavorites === 'function') {
    var $favs = loadFavorites() || {};
    var $favIds = Object.keys($favs);
    for (var $fi = 0; $fi < $favIds.length && $fi < 20; $fi++) {
      var $fw = typeof findWordById === 'function' ? findWordById($favIds[$fi]) : null;
      if ($fw) $bookmarkedWords.push($fw);
    }
  }

  // ── Leeched / difficult words ──
  var $difficultWords = [];
  for (var $di = 0; $di < $allWords.length; $di++) {
    var $dEntry = $srsData[$allWords[$di].id];
    if ($dEntry && ($dEntry.isLeech || ($dEntry.lapses || 0) >= 2)) {
      $difficultWords.push($allWords[$di]);
    }
    if ($difficultWords.length >= 20) break;
  }

  // ── Smart recommendation ──
  var $smartRec = null;
  if (window.__adaptive && window.__adaptive.getSmartRecommendation) {
    $smartRec = window.__adaptive.getSmartRecommendation();
  }

  // ── Forecast (due in 1d, 3d, 7d) ──
  var $forecast = [];
  if (typeof getCachedReviewForecast === 'function') {
    $forecast = getCachedReviewForecast();
  }

  // ── Streak quality ──
  var $streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var $streak = $streakData.streak || 0;

  var $data = {
    srsData: $srsData,
    srsStats: $srsStats,
    now: $now,
    dueReviews: $dueReviews,
    dueCount: $dueCount,
    overdueCount: $overdueCount,
    leechCount: $leechCount,
    forgottenWords: $forgottenWords,
    weakRoots: $weakRoots,
    weaknesses: $weaknesses,
    recentlyLearned: $recentlyLearned,
    bookmarkedWords: $bookmarkedWords,
    difficultWords: $difficultWords,
    smartRec: $smartRec,
    forecast: $forecast,
    streak: $streak,
    masteredCount: $srsStats.mature || 0,
    reviewsToday: $srsStats.reviewsToday || 0,
    retention: $srsStats.avgRetention || 0,
    totalReviews: $srsStats.totalReviews || 0,
  };

  _rcDataCache = $data;
  _rcCacheKey = $key;
  return $data;
}

/**
 * Invalidate the review center data cache.
 */
function invalidateReviewCenterCache() {
  _rcDataCache = null;
  _rcCacheKey = null;
}

// ── Estimated Review Time ──────────────────────────────────────

/**
 * Estimate how long a review session will take.
 * Based on ~30 seconds per word review.
 */
function estimateReviewTime(wordCount) {
  if (!wordCount || wordCount <= 0) return { minutes: 0, label: '< 1 min' };
  var $min = Math.max(1, Math.round((wordCount * 30) / 60));
  if ($min < 1) return { minutes: 1, label: '< 1 min' };
  if ($min === 1) return { minutes: 1, label: '~1 min' };
  return { minutes: $min, label: '~' + $min + ' min' };
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Render the Review Center view.
 * This is the main entry point called by switchView('review-center').
 */
function renderReviewCenter() {
  // Invalidate cache to ensure fresh data
  invalidateReviewCenterCache();

  var $data = gatherReviewCenterData();
  var $h = '';
  var $dayMs = 24 * 60 * 60 * 1000;

  // ═══ SECTION 0: HEADER ═══
  $h += '<div class="rc-header">';
  $h += '<div class="rc-header-row">';
  $h += '<div class="rc-header-icon" aria-hidden="true">📋</div>';
  $h += '<div>';
  $h += '<h2 class="rc-header-title">Review Center</h2>';
  $h += '<p class="rc-header-sub">Your central hub for revision</p>';
  $h += '</div>';
  $h += '</div>';
  $h += '</div>';

  // ═══ SECTION 1: STATS BAR ═══
  $h += '<div class="rc-stats-bar">';

  $h += '<div class="rc-stat" id="rc-stat-due" tabindex="0" role="button" aria-label="' + $data.dueCount + ' reviews due">';
  $h += '<div class="rc-stat-value rc-stat-value-warn">' + $data.dueCount + '</div>';
  $h += '<div class="rc-stat-label">Due' + ($data.overdueCount > 0 ? ' <span class="rc-overdue-badge">' + $data.overdueCount + ' overdue</span>' : '') + '</div>';
  $h += '</div>';

  $h += '<div class="rc-stat" id="rc-stat-mastered" tabindex="0" role="button" aria-label="' + $data.masteredCount + ' words mastered">';
  $h += '<div class="rc-stat-value">' + $data.masteredCount + '</div>';
  $h += '<div class="rc-stat-label">Mastered</div>';
  $h += '</div>';

  $h += '<div class="rc-stat">';
  $h += '<div class="rc-stat-value">' + ($data.retention || 0) + '%</div>';
  $h += '<div class="rc-stat-label">Retention</div>';
  $h += '</div>';

  $h += '<div class="rc-stat">';
  $h += '<div class="rc-stat-value">' + $data.streak + '</div>';
  $h += '<div class="rc-stat-label">Streak</div>';
  $h += '</div>';

  $h += '</div>';

  // ═══ SECTION 2: REVIEW MODES ═══
  $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">🎯</span> Review Modes</div>';
  $h += '<div class="rc-modes-grid">';

  // SRS Review — standard SRS review session
  $h += '<div class="rc-mode-card" id="rc-mode-srs" tabindex="0" role="button" aria-label="Start SRS review">';
  $h += '<div class="rc-mode-icon" style="background:rgba(201,168,76,0.15)">🔄</div>';
  $h += '<div class="rc-mode-info">';
  $h += '<div class="rc-mode-title">SRS Review</div>';
  $h += '<div class="rc-mode-sub">Standard spaced repetition</div>';
  $h += '</div>';
  $h += '<div class="rc-mode-arrow">→</div>';
  $h += '</div>';

  // Quick Review — flashcard-style quick review
  $h += '<div class="rc-mode-card" id="rc-mode-quick" tabindex="0" role="button" aria-label="Start quick review">';
  $h += '<div class="rc-mode-icon" style="background:rgba(74,158,107,0.15)">⚡</div>';
  $h += '<div class="rc-mode-info">';
  $h += '<div class="rc-mode-title">Quick Review</div>';
  $h += '<div class="rc-mode-sub">Fast flashcard mode</div>';
  $h += '</div>';
  $h += '<div class="rc-mode-arrow">→</div>';
  $h += '</div>';

  // Root Review — review by root family
  $h += '<div class="rc-mode-card" id="rc-mode-root" tabindex="0" role="button" aria-label="Start root review">';
  $h += '<div class="rc-mode-icon" style="background:rgba(138,107,191,0.15)">🌱</div>';
  $h += '<div class="rc-mode-info">';
  $h += '<div class="rc-mode-title">Root Review</div>';
  $h += '<div class="rc-mode-sub">By root families</div>';
  $h += '</div>';
  $h += '<div class="rc-mode-arrow">→</div>';
  $h += '</div>';

  // Reading Review — words from reading mode
  $h += '<div class="rc-mode-card" id="rc-mode-reading" tabindex="0" role="button" aria-label="Start reading review">';
  $h += '<div class="rc-mode-icon" style="background:rgba(74,126,194,0.15)">📖</div>';
  $h += '<div class="rc-mode-info">';
  $h += '<div class="rc-mode-title">Reading Review</div>';
  $h += '<div class="rc-mode-sub">Words from reading</div>';
  $h += '</div>';
  $h += '<div class="rc-mode-arrow">→</div>';
  $h += '</div>';

  // Mixed Review — mixed easy/hard review
  $h += '<div class="rc-mode-card" id="rc-mode-mixed" tabindex="0" role="button" aria-label="Start mixed review">';
  $h += '<div class="rc-mode-icon" style="background:rgba(201,168,76,0.12)">🎲</div>';
  $h += '<div class="rc-mode-info">';
  $h += '<div class="rc-mode-title">Mixed Review</div>';
  $h += '<div class="rc-mode-sub">Balanced difficulty</div>';
  $h += '</div>';
  $h += '<div class="rc-mode-arrow">→</div>';
  $h += '</div>';

  // Weakest Words Review — focus on leeched/difficult
  $h += '<div class="rc-mode-card" id="rc-mode-weakest" tabindex="0" role="button" aria-label="Start weakest words review">';
  $h += '<div class="rc-mode-icon" style="background:rgba(194,80,80,0.15)">💢</div>';
  $h += '<div class="rc-mode-info">';
  $h += '<div class="rc-mode-title">Weakest Words</div>';
  $h += '<div class="rc-mode-sub">Leeched & difficult</div>';
  $h += '</div>';
  $h += '<div class="rc-mode-arrow">→</div>';
  $h += '</div>';

  $h += '</div>';

  // ═══ SECTION 3: REVIEWS DUE ═══
  if ($data.dueCount > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">🔁</span> Reviews Due <span class="rc-count-badge">' + $data.dueCount + '</span></div>';

    // Smart priority header
    var $priorityMsg = '';
    if ($data.overdueCount > 5) {
      $priorityMsg = '⚠️ <strong>' + $data.overdueCount + ' overdue</strong> — review these first to protect retention';
    } else if ($data.overdueCount > 0) {
      $priorityMsg = '⚠️ <strong>' + $data.overdueCount + ' overdue</strong> — catch up soon';
    } else if ($data.leechCount > 0) {
      $priorityMsg = '💢 <strong>' + $data.leechCount + ' leeched</strong> — focus on these difficult words';
    } else {
      var $estTime = estimateReviewTime($data.dueCount);
      $priorityMsg = '⏱️ ~' + $estTime.minutes + ' min review session — ' + $data.dueCount + ' word' + ($data.dueCount !== 1 ? 's' : '');
    }

    $h += '<div class="rc-priority-banner">' + $priorityMsg + '</div>';

    // Start Review button
    $h += '<button class="rc-start-btn" id="rc-start-srs" type="button">';
    $h += '<span class="rc-start-btn-icon">▶</span>';
    $h += '<span class="rc-start-btn-text">Start SRS Review</span>';
    $h += '<span class="rc-start-btn-sub">' + $data.dueCount + ' words · ' + estimateReviewTime($data.dueCount).label + '</span>';
    $h += '</button>';

    // Quick actions row
    $h += '<div class="rc-quick-actions-row">';
    $h += '<button class="rc-quick-btn" id="rc-start-mixed" type="button">🎲 Mixed Review</button>';
    $h += '<button class="rc-quick-btn" id="rc-start-quick" type="button">⚡ Quick Review</button>';
    $h += '</div>';

    // Show a few due words as preview
    $h += '<div class="rc-section-sub-label">Due words (showing ' + Math.min(5, $data.dueCount) + ' of ' + $data.dueCount + '):</div>';
    $h += '<div class="rc-word-preview-list">';
    for (var $pi = 0; $pi < Math.min(5, $data.dueReviews.length); $pi++) {
      var $pw = $data.dueReviews[$pi];
      var $pEntry = $data.srsData[$pw.id];
      var $pRetention = $pEntry && typeof estimateRetention === 'function' ? Math.round(estimateRetention($pEntry) * 100) : 100;
      var $pDaysOverdue = $pEntry && $pEntry.dueDate ? Math.round(($data.now - $pEntry.dueDate) / $dayMs) : 0;
      var $pStatus = $pDaysOverdue > 0 ? '<span class="rc-word-overdue">' + $pDaysOverdue + 'd overdue</span>' : '<span class="rc-word-due">due</span>';

      $h += '<div class="rc-word-preview-item rc-clickable" data-word-id="' + $pw.id + '" tabindex="0" role="button" aria-label="' + ($pw.arabic || '') + ' — ' + ($pw.english || '') + '">';
      $h += '<span class="rc-word-preview-arabic">' + ($pw.arabic || '') + '</span>';
      $h += '<span class="rc-word-preview-eng">' + ($pw.english || '') + '</span>';
      $h += '<span class="rc-word-preview-meta">' + $pStatus + ' · ' + $pRetention + '% retention</span>';
      $h += '</div>';
    }
    $h += '</div>';
  } else {
    // No reviews due — show empty state
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">🔁</span> Reviews Due</div>';
    $h += '<div class="rc-empty-state">';
    $h += '<div class="rc-empty-icon">✅</div>';
    $h += '<div class="rc-empty-title">All caught up!</div>';
    $h += '<div class="rc-empty-sub">No words due for review right now. Check back later or learn new vocabulary.</div>';
    $h += '</div>';
  }

  // ═══ SECTION 4: FORGOTTEN WORDS ═══
  if ($data.forgottenWords && $data.forgottenWords.length > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">💢</span> Forgotten Words <span class="rc-count-badge">' + $data.forgottenWords.length + '</span></div>';
    $h += '<div class="rc-card rc-warning-card" id="rc-forgotten-card">';
    $h += '<div class="rc-card-row">';
    $h += '<div class="rc-card-icon" style="background:rgba(194,80,80,0.12)">💢</div>';
    $h += '<div class="rc-card-body">';
    $h += '<div class="rc-card-title">' + $data.forgottenWords.length + ' word' + ($data.forgottenWords.length !== 1 ? 's' : '') + ' frequently forgotten</div>';
    $h += '<div class="rc-card-sub">';
    var $sampleForgotten = $data.forgottenWords.slice(0, 3).map(function(w) { return w.arabic + ' (' + w.english + ')'; }).join(', ');
    $h += 'Include' + ($data.forgottenWords.length === 1 ? 's' : '') + ': ' + $sampleForgotten;
    $h += '</div>';
    $h += '</div>';
    $h += '<button class="rc-card-btn" id="rc-review-forgotten" type="button">Review</button>';
    $h += '</div>';
    $h += '</div>';
  }

  // ═══ SECTION 5: WEAK ROOTS ═══
  if ($data.weakRoots && $data.weakRoots.length > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">🌱</span> Weak Roots <span class="rc-count-badge">' + $data.weakRoots.length + '</span></div>';
    $h += '<div class="rc-root-list">';
    for (var $rri = 0; $rri < Math.min(5, $data.weakRoots.length); $rri++) {
      var $rr = $data.weakRoots[$rri];
      var $rrMastery = $rr.masteryScore || 0;
      var $rrColor = $rrMastery < 30 ? 'var(--red)' : ($rrMastery < 50 ? 'var(--gold-dim)' : 'var(--green)');
      $h += '<div class="rc-root-item rc-clickable" data-root="' + ($rr.root || '') + '" tabindex="0" role="button" aria-label="Root ' + ($rr.root || '') + ' — ' + $rrMastery + '% mastery">';
      $h += '<div class="rc-root-arabic">' + ($rr.root || '') + '</div>';
      $h += '<div class="rc-root-info">';
      $h += '<div class="rc-root-meaning">' + ($rr.rootMeaning || '') + '</div>';
      $h += '<div class="rc-root-mastery">' + $rr.mastered + '/' + $rr.total + ' words mastered</div>';
      $h += '</div>';
      $h += '<div class="rc-root-pct" style="color:' + $rrColor + '">' + $rrMastery + '%</div>';
      $h += '</div>';
    }
    $h += '</div>';
    $h += '<button class="rc-text-btn" id="rc-review-roots" type="button">Practice all weak roots →</button>';
  }

  // ═══ SECTION 6: RECENTLY LEARNED ═══
  if ($data.recentlyLearned && $data.recentlyLearned.length > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">📚</span> Recently Learned <span class="rc-count-badge">' + $data.recentlyLearned.length + '</span></div>';
    $h += '<div class="rc-word-preview-list">';
    for (var $rli = 0; $rli < Math.min(5, $data.recentlyLearned.length); $rli++) {
      var $rlw = $data.recentlyLearned[$rli];
      $h += '<div class="rc-word-preview-item rc-clickable" data-word-id="' + $rlw.id + '" tabindex="0" role="button" aria-label="' + ($rlw.arabic || '') + ' — ' + ($rlw.english || '') + '">';
      $h += '<span class="rc-word-preview-arabic">' + ($rlw.arabic || '') + '</span>';
      $h += '<span class="rc-word-preview-eng">' + ($rlw.english || '') + '</span>';
      $h += '<span class="rc-word-preview-meta rc-new-badge">new</span>';
      $h += '</div>';
    }
    $h += '</div>';
  }

  // ═══ SECTION 7: BOOKMARKED WORDS ═══
  if ($data.bookmarkedWords && $data.bookmarkedWords.length > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">📌</span> Bookmarked Words <span class="rc-count-badge">' + $data.bookmarkedWords.length + '</span></div>';
    $h += '<div class="rc-word-preview-list">';
    for (var $bi = 0; $bi < Math.min(5, $data.bookmarkedWords.length); $bi++) {
      var $bw = $data.bookmarkedWords[$bi];
      $h += '<div class="rc-word-preview-item rc-clickable" data-word-id="' + $bw.id + '" tabindex="0" role="button" aria-label="' + ($bw.arabic || '') + ' — ' + ($bw.english || '') + '">';
      $h += '<span class="rc-word-preview-arabic">' + ($bw.arabic || '') + '</span>';
      $h += '<span class="rc-word-preview-eng">' + ($bw.english || '') + '</span>';
      $h += '<span class="rc-word-preview-meta rc-bookmark-badge">📌</span>';
      $h += '</div>';
    }
    $h += '</div>';
  }

  // ═══ SECTION 8: DIFFICULT WORDS ═══
  if ($data.difficultWords && $data.difficultWords.length > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">🤔</span> Difficult Words <span class="rc-count-badge">' + $data.difficultWords.length + '</span></div>';
    $h += '<div class="rc-word-preview-list">';
    for (var $di = 0; $di < Math.min(5, $data.difficultWords.length); $di++) {
      var $dw = $data.difficultWords[$di];
      var $dEntry = $data.srsData[$dw.id];
      var $dLapses = $dEntry ? ($dEntry.lapses || 0) : 0;
      var $dLeech = $dEntry ? $dEntry.isLeech : false;
      $h += '<div class="rc-word-preview-item rc-clickable" data-word-id="' + $dw.id + '" tabindex="0" role="button" aria-label="' + ($dw.arabic || '') + ' — ' + ($dw.english || '') + '">';
      $h += '<span class="rc-word-preview-arabic">' + ($dw.arabic || '') + '</span>';
      $h += '<span class="rc-word-preview-eng">' + ($dw.english || '') + '</span>';
      $h += '<span class="rc-word-preview-meta">' + $dLapses + ' lapse' + ($dLapses !== 1 ? 's' : '') + ($dLeech ? ' · leeched' : '') + '</span>';
      $h += '</div>';
    }
    $h += '</div>';
  }

  // ═══ SECTION 9: SMART PRIORITIZATION ═══
  $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">⚙️</span> Smart Prioritization</div>';
  $h += '<div class="rc-card">';
  $h += '<div class="rc-smart-grid">';

  // Priority 1: Overdue reviews
  if ($data.overdueCount > 0) {
    $h += '<div class="rc-priority-item rc-clickable" id="rc-priority-overdue" tabindex="0" role="button">';
    $h += '<div class="rc-priority-rank rc-rank-high">1</div>';
    $h += '<div class="rc-priority-info">';
    $h += '<div class="rc-priority-title">' + $data.overdueCount + ' Overdue Reviews</div>';
    $h += '<div class="rc-priority-sub">Review overdue words first to prevent memory decay</div>';
    $h += '</div>';
    $h += '</div>';
  }

  // Priority 2: Leeched words
  if ($data.leechCount > 0) {
    $h += '<div class="rc-priority-item rc-clickable" id="rc-priority-leeched" tabindex="0" role="button">';
    $h += '<div class="rc-priority-rank rc-rank-high">' + ($data.overdueCount > 0 ? '2' : '1') + '</div>';
    $h += '<div class="rc-priority-info">';
    $h += '<div class="rc-priority-title">' + $data.leechCount + ' Leeched Word' + ($data.leechCount !== 1 ? 's' : '') + '</div>';
    $h += '<div class="rc-priority-sub">Repeatedly forgotten — extra attention needed</div>';
    $h += '</div>';
    $h += '</div>';
  }

  // Priority 3: Due reviews
  if ($data.dueCount > 0 && $data.overdueCount === 0) {
    var $priorityNum = ($data.overdueCount > 0 ? 3 : ($data.leechCount > 0 ? 2 : 1));
    $h += '<div class="rc-priority-item rc-clickable" id="rc-priority-due" tabindex="0" role="button">';
    $h += '<div class="rc-priority-rank rc-rank-med">' + $priorityNum + '</div>';
    $h += '<div class="rc-priority-info">';
    $h += '<div class="rc-priority-title">' + $data.dueCount + ' Word' + ($data.dueCount !== 1 ? 's' : '') + ' Due for Review</div>';
    $h += '<div class="rc-priority-sub">Regular SRS review builds long-term retention</div>';
    $h += '</div>';
    $h += '</div>';
  }

  // Priority 4: Forgotten words
  if ($data.forgottenWords.length > 0) {
    $h += '<div class="rc-priority-item rc-clickable" id="rc-priority-forgotten" tabindex="0" role="button">';
    $h += '<div class="rc-priority-rank rc-rank-med">' + ($data.dueCount > 0 ? 3 : ($data.leechCount > 0 ? 2 : 1)) + '</div>';
    $h += '<div class="rc-priority-info">';
    $h += '<div class="rc-priority-title">' + $data.forgottenWords.length + ' Forgotten Word' + ($data.forgottenWords.length !== 1 ? 's' : '') + '</div>';
    $h += '<div class="rc-priority-sub">Words you frequently forget — targeted review</div>';
    $h += '</div>';
    $h += '</div>';
  }

  // Fallback: no priorities
  if ($data.overdueCount === 0 && $data.leechCount === 0 && $data.dueCount === 0 && $data.forgottenWords.length === 0) {
    $h += '<div class="rc-empty-state" style="padding:16px 0">';
    $h += '<div class="rc-empty-title" style="font-size:14px">All clear! 🎉</div>';
    $h += '<div class="rc-empty-sub">No items need attention. Review new vocabulary to keep building.</div>';
    $h += '</div>';
  }

  $h += '</div></div>';

  // ═══ SECTION 10: SESSION HISTORY (quick summary) ═══
  $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">📊</span> Today\'s Progress</div>';
  $h += '<div class="rc-card">';
  $h += '<div class="rc-today-grid">';
  $h += '<div class="rc-today-item"><div class="rc-today-value">' + $data.reviewsToday + '</div><div class="rc-today-label">Reviews Today</div></div>';
  $h += '<div class="rc-today-item"><div class="rc-today-value">' + $data.totalReviews + '</div><div class="rc-today-label">Total Reviews</div></div>';
  $h += '<div class="rc-today-item"><div class="rc-today-value">' + $data.masteredCount + '</div><div class="rc-today-label">Words Mastered</div></div>';
  $h += '<div class="rc-today-item"><div class="rc-today-value">' + ($data.retention || 0) + '%</div><div class="rc-today-label">Retention</div></div>';
  $h += '</div>';
  $h += '</div>';

  // Forecast (review workload for next 1w-2w)
  if ($data.forecast && $data.forecast.length > 0) {
    $h += '<div class="rc-section-label"><span class="rc-section-icon" aria-hidden="true">📈</span> Review Forecast</div>';
    $h += '<div class="rc-card">';
    $h += '<div class="rc-forecast-grid">';
    for (var $fci = 0; $fci < $data.forecast.length; $fci++) {
      var $fc = $data.forecast[$fci];
      $h += '<div class="rc-forecast-item">';
      $h += '<div class="rc-forecast-value" style="color:' + ($fc.color || 'var(--gold)') + '">' + $fc.count + '</div>';
      $h += '<div class="rc-forecast-label">' + ($fc.label || '') + '</div>';
      $h += '</div>';
    }
    $h += '</div></div>';
  }

  // ── Inject HTML ──
  var $rcContainer = document.getElementById('review-center-grid');
  if (!$rcContainer) return;
  $rcContainer.innerHTML = $h;

  // ═══ WIRE EVENTS ═══
  wireReviewCenterEvents($data);
}

// ═══════════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════════

function wireReviewCenterEvents($data) {
  if (!$data) $data = gatherReviewCenterData();

  // Safe helper
  function $wire(id, fn) {
    var $el = document.getElementById(id);
    if (!$el) return;
    $el.onclick = fn;
    $el.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  }

  // ── Stats bar clicks ──
  $wire('rc-stat-due', function() {
    if ($data.dueCount > 0 && typeof startReview === 'function') startReview();
    else if (typeof switchView === 'function') switchView('learn');
  });
  $wire('rc-stat-mastered', function() {
    if (typeof switchView === 'function') switchView('profile');
  });

  // ── Review Mode cards ──
  $wire('rc-mode-srs', function() {
    if (typeof startReview === 'function') startReview();
  });
  $wire('rc-mode-quick', function() {
    if (typeof toggleQuickMode === 'function') toggleQuickMode();
    if (typeof startReview === 'function') startReview();
  });
  $wire('rc-mode-root', function() {
    if (typeof goToRootFamily === 'function') goToRootFamily();
    else if (typeof switchView === 'function') switchView('learn');
  });
  $wire('rc-mode-reading', function() {
    if (typeof switchView === 'function') switchView('reader');
  });
  $wire('rc-mode-mixed', function() {
    if (typeof startMixedReview === 'function') startMixedReview();
  });
  $wire('rc-mode-weakest', function() {
    // Start review with leeched/difficult words only
    if (typeof startReview === 'function') startReview();
    // Note: startReview already prioritizes leeched words first
  });

  // ── Start review buttons ──
  $wire('rc-start-srs', function() {
    if (typeof startReview === 'function') startReview();
  });
  $wire('rc-start-mixed', function() {
    if (typeof startMixedReview === 'function') startMixedReview();
  });
  $wire('rc-start-quick', function() {
    if (typeof toggleQuickMode === 'function') toggleQuickMode();
    if (typeof startReview === 'function') startReview();
  });

  // ── Forgotten words review ──
  $wire('rc-review-forgotten', function() {
    if (typeof startReview === 'function') startReview();
  });

  // ── Review roots ──
  $wire('rc-review-roots', function() {
    if (typeof goToRootFamily === 'function') goToRootFamily();
  });

  // ── Priority items ──
  $wire('rc-priority-overdue', function() {
    if (typeof startReview === 'function') startReview();
  });
  $wire('rc-priority-leeched', function() {
    if (typeof startReview === 'function') startReview();
  });
  $wire('rc-priority-due', function() {
    if (typeof startReview === 'function') startReview();
  });
  $wire('rc-priority-forgotten', function() {
    if (typeof startReview === 'function') startReview();
  });

  // ── Word preview items: click to navigate to the word ──
  var $wordItems = document.querySelectorAll('.rc-clickable[data-word-id]');
  for (var $wi = 0; $wi < $wordItems.length; $wi++) {
    (function($el) {
      var $wordId = $el.getAttribute('data-word-id');
      $el.onclick = function() {
        // Try to navigate to the word in learn mode
        if (typeof window.__navigateToWord === 'function' && $wordId) {
          var $word = typeof findWordById === 'function' ? findWordById($wordId) : null;
          if ($word) {
            window.__navigateToWord($word);
          }
        }
      };
      $el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $el.onclick(); }
      };
    })($wordItems[$wi]);
  }

  // ── Root items: click to navigate to root family ──
  var $rootItems = document.querySelectorAll('.rc-clickable[data-root]');
  for (var $ri = 0; $ri < $rootItems.length; $ri++) {
    (function($el) {
      var $rootKey = $el.getAttribute('data-root');
      $el.onclick = function() {
        if (typeof goToRootFamily === 'function' && $rootKey) {
          goToRootFamily($rootKey);
        }
      };
      $el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $el.onclick(); }
      };
    })($rootItems[$ri]);
  }

  // ── Forgotten card click ──
  var $forgottenCard = document.getElementById('rc-forgotten-card');
  if ($forgottenCard) {
    $forgottenCard.onclick = function() {
      if (typeof startReview === 'function') startReview();
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__reviewCenter = {
  render: renderReviewCenter,
  gatherData: gatherReviewCenterData,
  invalidateCache: invalidateReviewCenterCache,
  estimateTime: estimateReviewTime,
};

// Expose the render function for switchView
if (typeof window !== 'undefined') {
  window.renderReviewCenter = renderReviewCenter;
}
