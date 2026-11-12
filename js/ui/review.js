// ═══════════════════════════════════════════════════════════════
// review.js — SRS Review Session Management
// Extracted from monolithic app.js for modular maintainability.
// ═══════════════════════════════════════════════════════════════

// ── Review Session State ───────────────────────────────────────

var _reviewOriginalMastered = 0;
var _reviewSessionRecalled = 0;
var _reviewSessionTotal = 0;

// ── Review Session Lifecycle ──────────────────────────────────

/**
 * Bring the stored Quran-percentage high-water mark up to today's coverage.
 * Called at session start so the figure shown at the end counts only what
 * this session added. Returns the rise since the last mark (0 when none).
 */
function refreshQuranPercentGained() {
  if (typeof refreshWordMeaningsPercent !== 'function') return 0;
  return refreshWordMeaningsPercent().gained;
}

/**
 * Reviews run on the Learn screen. Show it, keeping the tab the review was
 * started from (Practice, Home) lit rather than Learn.
 */
function showReviewScreen() {
  var from = typeof currentView !== 'undefined' ? currentView : null;
  switchView('learn', from && from !== 'learn' ? { navContext: from } : undefined);
}

function startReview() {
  reviewQueue = getDueReviews();
  if (!reviewQueue.length) return;
  refreshQuranPercentGained();
  _reviewOriginalMastered = 0;
  _reviewSessionRecalled = 0;
  _reviewSessionTotal = 0;
  // Count how many are already mastered in the review queue
  var srsData = loadSRS();
  for (var ri = 0; ri < reviewQueue.length; ri++) {
    var entry = srsData[reviewQueue[ri].id];
    if (entry && entry.stage >= 2) _reviewOriginalMastered++;
  }
  reviewMode = true;
  currentWord = 0;
  if (typeof currentView !== 'undefined' && currentView !== 'learn') showReviewScreen();
  DOM.get('review-banner').classList.remove('visible');
  updateWordCard();
}

function endReview() {
  // Compute session summary stats
  var srsData = loadSRS();
  var newMastered = 0;
  var newRootsSet = {};
  for (var ri = 0; ri < reviewQueue.length; ri++) {
    var entry = srsData[reviewQueue[ri].id];
    if (entry && entry.stage >= 2) {
      newMastered++;
    }
    // Track new root families encountered
    if (reviewQueue[ri] && reviewQueue[ri].root && reviewQueue[ri].root !== '\u2014') {
      newRootsSet[reviewQueue[ri].root] = true;
    }
  }
  newMastered = Math.max(0, newMastered - _reviewOriginalMastered);

  var streakData = loadStreakData();
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var compBefore = coverage ? coverage.estimatedComprehension : 0;
  
  // Check for milestone to celebrate
  var milestoneToCelebrate = null;
  var milestoneStatus = typeof getMilestoneStatus === 'function' ? getMilestoneStatus(coverage ? coverage.coveragePercent : 0) : null;
  var prevCoverage = window.__prevCoveragePercent || 0;
  if (milestoneStatus && milestoneStatus.currentMilestone && prevCoverage < milestoneStatus.currentMilestone.pct) {
    milestoneToCelebrate = milestoneStatus.currentMilestone;
  }
  window.__prevCoveragePercent = coverage ? coverage.coveragePercent : 0;
  
  // Calculate time spent (approximate: 30 seconds per word reviewed)
  var timeSpentMinutes = Math.round((reviewQueue.length * 30) / 60);
  
  var stats = {
    wordsReviewed: reviewQueue.length,
    streakDays: streakData.streak || 0,
    newMastered: newMastered,
    newRootsLearned: Object.keys(newRootsSet).length,
    comprehensionBefore: compBefore,
    comprehensionAfter: compBefore + (reviewQueue.length > 0 ? 0.5 : 0),
    reviewCardsCreated: reviewQueue.length,
    timeSpentMinutes: timeSpentMinutes,
    nextRecommendation: getNextActionRecommendation(),
    milestoneToCelebrate: milestoneToCelebrate,
    sessionRecalled: _reviewSessionRecalled || 0,
    sessionTotal: _reviewSessionTotal || 0,
    quranPercentGained: refreshQuranPercentGained(),
  };
  
  // Record momentum for today's learning (Part 6)
  if (window.__learningJourney && window.__learningJourney.recordMomentum) {
    window.__learningJourney.recordMomentum('word_reviewed', reviewQueue.length);
  }
  
  // Track review completed for analytics
  if (window.__feedback && typeof window.__feedback.trackEvent === 'function') {
    window.__feedback.trackEvent('review_completed', { wordsReviewed: reviewQueue.length, newMastered: newMastered });
    if (newMastered > 0) window.__learningJourney.recordMomentum('word_mastered', newMastered);
  }
  
  // Reset recall counters for next session
  _reviewSessionRecalled = 0;
  _reviewSessionTotal = 0;

  reviewMode = false;
  currentWord = 0;
  updateReviewBanner();
  updateWordCard();

  // Show session summary (only if words were actually reviewed)
  if (reviewQueue.length > 0) {
    showSessionSummary(stats);
  }
}

// ── Mixed Review ───────────────────────────────────────────────

/**
 * Start a Mixed Review session.
 */
function startMixedReview() {
  reviewQueue = typeof getMixedReviewQueue === 'function' ? getMixedReviewQueue() : [];
  if (!reviewQueue || reviewQueue.length === 0) {
    // If no reviews due, return to dashboard
    switchView('dashboard');
    return;
  }
  
  setOrganizationMode('lesson');
  setActiveSurahId(null);
  refreshQuranPercentGained();
  
  _reviewOriginalMastered = 0;
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  for (var ri = 0; ri < reviewQueue.length; ri++) {
    var entry = srsData[reviewQueue[ri].id];
    if (entry && entry.stage >= 2) _reviewOriginalMastered++;
  }
  
  reviewMode = true;
  currentWord = 0;
  activeLessonIndex = 0;
  window.__lastReviewWasMixed = true;
  showReviewScreen();
  DOM.get('review-banner').classList.remove('visible');
  updateWordCard();
}

// ── Pre-Lesson Review Check ────────────────────────────────────

/**
 * Check for overdue reviews and weak vocabulary before proceeding
 * to a new lesson.
 */
function checkPreLessonReviews() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();
  var overdueCount = 0;
  var weakCount = 0;
  
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (!entry) return;
    if (entry.dueDate && now >= entry.dueDate) {
      overdueCount++;
      if (entry.isLeech) weakCount++;
    }
  });
  
  return {
    overdueCount: overdueCount,
    weakCount: weakCount,
    needsReview: overdueCount > 0,
    message: 'You have ' + overdueCount + ' word' + (overdueCount !== 1 ? 's' : '') + 
      ' that need' + (overdueCount === 1 ? 's' : '') + 
      ' reinforcement before learning new vocabulary.' +
      (weakCount > 0 ? ' (' + weakCount + ' need' + (weakCount === 1 ? 's' : '') + ' extra attention)' : ''),
  };
}

/**
 * Show the pre-lesson review prompt banner.
 */
function showPreLessonReviewPrompt(checkResult) {
  if (!checkResult || !checkResult.needsReview || checkResult.overdueCount < 3) return;
  if (reviewMode) return;
  
  var existing = document.getElementById('pre-lesson-review-prompt');
  if (existing) existing.remove();
  
  var banner = document.createElement('div');
  banner.id = 'pre-lesson-review-prompt';
  banner.className = 'pre-lesson-review visible';
  banner.innerHTML =
    '<span class="pre-lesson-review-icon">' + uiIcon('repeat', true) + '</span>' +
    '<div class="pre-lesson-review-body">' +
    '<div class="pre-lesson-review-msg">' + checkResult.message + '</div>' +
    '<div class="pre-lesson-review-actions">' +
    '<button id="pre-review-now" class="btn btn-sm" type="button">Review now</button>' +
    '<button id="pre-review-continue" class="btn btn-sm btn-outline" type="button">Continue anyway</button>' +
    '</div></div>';
  
  var reviewBanner = document.getElementById('review-banner');
  var learnView = document.getElementById('view-learn');
  if (learnView) {
    // Right after the review banner, inside whatever wraps it
    if (reviewBanner && reviewBanner.parentNode) {
      reviewBanner.parentNode.insertBefore(banner, reviewBanner.nextSibling);
    } else {
      learnView.insertBefore(banner, learnView.firstChild);
    }
  }
  
  document.getElementById('pre-review-now').onclick = function() {
    banner.remove();
    if (typeof startReview === 'function') startReview();
  };
  document.getElementById('pre-review-continue').onclick = function() {
    banner.remove();
  };
  
  return banner;
}

// ── Session Summary ────────────────────────────────────────────

function showSessionSummary(stats) {
  var modal = document.getElementById('session-summary-modal');
  if (!modal) return;

  var $wordsReviewed = stats.wordsReviewed || 0;
  var $newMastered = stats.newMastered || 0;
  var $rootsLearned = stats.newRootsLearned || 0;
  var $comprehensionBefore = stats.comprehensionBefore || 0;
  var $comprehensionAfter = stats.comprehensionAfter || 0;
  var $compGain = $comprehensionAfter - $comprehensionBefore;
  var $reviewCardsCreated = stats.reviewCardsCreated || $wordsReviewed;
  var $streakDays = stats.streakDays || 0;
  var $timeSpent = stats.timeSpentMinutes || 0;
  var $nextRecommendation = stats.nextRecommendation || 'Continue your learning journey';

  // ── Fix 4: gate low-sample-size metrics behind a 5-word minimum ──
  // Below 5 words reviewed, show only the always-meaningful cards
  // (Words Reviewed, New Roots, Time Spent, Streak Days) + the Next banner.
  var $showDetailedStats = $wordsReviewed >= 5;
  var $gatedStatIds = [
    'session-card-hero',              // Quran's words gained + recalled
    'session-card-mastered-new',      // Now mastered
    'session-card-needs-improvement', // To review again
  ];
  for (var $gsi = 0; $gsi < $gatedStatIds.length; $gsi++) {
    var $gatedCard = document.getElementById($gatedStatIds[$gsi]);
    if ($gatedCard) $gatedCard.style.display = $showDetailedStats ? '' : 'none';
  }

  var $sharedStats = typeof getFoundationCourseStats === 'function' ? getFoundationCourseStats() : null;
  
  document.getElementById('session-words-reviewed').textContent = $wordsReviewed;
  document.getElementById('session-streak-earned').textContent = $streakDays;
  document.getElementById('session-mastered-new').textContent = $newMastered;
  
  if ($sharedStats) {
    var $fPctEl = document.getElementById('session-foundation-pct');
    if ($fPctEl) $fPctEl.textContent = $sharedStats.percent + '%';
  }

  var $compGainEl = document.getElementById('session-comp-gain');
  if ($compGainEl) {
    $compGainEl.textContent = ($compGain > 0 ? '+' : '') + $compGain.toFixed(1) + '%';
    $compGainEl.style.color = $compGain > 0 ? 'var(--green)' : 'var(--text-muted)';
  }
  var $rootsEl = document.getElementById('session-roots-learned');
  if ($rootsEl) $rootsEl.textContent = $rootsLearned;
  // Roots of the words just reviewed, so not "new"
  var $rootsLabelEl = document.getElementById('session-roots-label');
  if ($rootsLabelEl) $rootsLabelEl.textContent = $rootsLearned === 1 ? 'Root reviewed' : 'Roots reviewed';
  var $reviewCardsEl = document.getElementById('session-review-cards');
  if ($reviewCardsEl) $reviewCardsEl.textContent = $reviewCardsCreated;
  var $nextRecEl = document.getElementById('session-next-recommendation');
  if ($nextRecEl) $nextRecEl.textContent = $nextRecommendation;
  var $timeSpentEl = document.getElementById('session-time-spent');
  if ($timeSpentEl) $timeSpentEl.textContent = $timeSpent > 0 ? $timeSpent + ' min' : '< 1 min';

  // Populate adaptive session fields with recall data (Priority 2)
  var $sessionRecalled = stats.sessionRecalled || 0;
  var $sessionTotal = stats.sessionTotal || 0;
  var $recallRate = $sessionTotal > 0 ? Math.round(($sessionRecalled / $sessionTotal) * 100) : 0;
  var $forgottenCount = $sessionTotal - $sessionRecalled;
  
  var $coverageGainedEl = document.getElementById('session-coverage-gained');
  if ($coverageGainedEl) {
    var $quranGained = stats.quranPercentGained || 0;
    // The card shows just the "+x.x%" figure; the label under it
    // ("of the Quran's words") is static in index.html.
    $coverageGainedEl.textContent = $quranGained > 0
      ? '+' + $quranGained.toFixed(1) + '%'
      : '—';
  }

  var $accuracyEl = document.getElementById('session-accuracy');
  if ($accuracyEl) {
    $accuracyEl.textContent = $recallRate + '%';
    $accuracyEl.style.color = $recallRate >= 80 ? 'var(--green)' : ($recallRate >= 60 ? 'var(--gold)' : 'var(--red)');
  }
  var $retentionEl = document.getElementById('session-retention');
  if ($retentionEl) $retentionEl.textContent = $recallRate + '%';
  var $needsImprovementEl = document.getElementById('session-needs-improvement');
  if ($needsImprovementEl) $needsImprovementEl.textContent = $forgottenCount;

  var encouragement = document.getElementById('session-encouragement');
  var $msgs = [
    '“And We have certainly made the Quran easy to remember” (54:17)',
    'Every word of the Quran you understand opens more of its meaning to you.',
    '“The best among you are those who learn the Quran and teach it” (Bukhari)',
    'Understanding the Quran is a journey of a lifetime. Each lesson is a step toward deeper connection with Allah\'s message.',
    'The more you learn, the more the Quran comes alive. What was once unfamiliar becomes a conversation with your Creator.',
  ];
  if ($wordsReviewed >= 10) {
    encouragement.textContent = $msgs[0];
  } else if ($wordsReviewed >= 5) {
    encouragement.textContent = $msgs[1];
  } else {
    encouragement.textContent = $msgs[2];
  }

  modal.style.display = 'flex';
  if (stats.milestoneToCelebrate && window.__ux && window.__ux.showMilestoneCelebration) {
    setTimeout(function() {
      window.__ux.showMilestoneCelebration(stats.milestoneToCelebrate);
    }, 500);
  }
  
  modal.onclick = function(e) {
    if (e.target === modal) closeSessionSummary();
  };
  var appEl = document.querySelector('.app');
  if (appEl) appEl.setAttribute('aria-hidden', 'true');
  trapFocus(modal);
}

function closeSessionSummary() {
  var modal = document.getElementById('session-summary-modal');
  modal.style.display = 'none';
  modal.onclick = null;
  releaseFocusTrap(modal);
  var appEl = document.querySelector('.app');
  if (appEl) appEl.removeAttribute('aria-hidden');
}

// ── Next Action Recommendation ─────────────────────────────────

/**
 * Get a prioritized text recommendation for the user's next action.
 * Priority order:
 *   1. Due reviews (protect retention)
 *   2. Resume unfinished lesson
 *   3. Continue Foundation
 *   4. Quran reading
 *   5. Word exploration
 *   6. Root exploration
 */
function getNextActionRecommendation() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();
  var dueCount = 0, overdueCount = 0;
  var threeDays = 3 * 24 * 60 * 60 * 1000;
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (entry && entry.dueDate && now >= entry.dueDate) {
      dueCount++;
      if (now - entry.dueDate > threeDays) overdueCount++;
    }
  });
  
  if (dueCount > 0) {
    if (overdueCount > 0) {
      return dueCount + ' words due (' + overdueCount + ' overdue) — review now to protect retention';
    }
    return dueCount + ' words due for review — reinforce them soon';
  }
  
  // Priority 2-3: Continue Foundation
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fPct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  if (fCompleted < fTotal) {
    if (fPct >= 50) return 'Continue Foundation ' + (fCompleted + 1) + ' of ' + fTotal + ' — more than halfway';
    return 'Continue Foundation ' + (fCompleted + 1) + ' of ' + fTotal;
  }
  
  // Priority 4: Quran reading (foundation complete)
  if (fTotal > 0) {
    return 'Read the Quran to apply your vocabulary knowledge';
  }
  
  // Default
  return 'Review your progress in Analytics';
}

// ── Milestone Celebrations ─────────────────────────────────────

/**
 * Check for milestone celebrations after completing a lesson.
 */
function checkForLessonCompletionCelebration(lessonIndex) {
  if (!window.__ux || !window.__ux.showMilestoneCelebration) return;
  
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fPct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var compPct = coverage ? coverage.estimatedComprehension : 0;
  
  var celebrations = [];
  
  if (fCompleted === 1) {
    celebrations.push({ pct: 10, label: 'First lesson complete', icon: '🎉', insight: 'You have taken the first step. The Quran is opening to you, word by word.' });
  }
  if (fCompleted === Math.ceil(fTotal * 0.25)) {
    celebrations.push({ pct: 25, label: 'A quarter of the Foundation done', icon: '🌟', insight: 'One quarter of the Foundation Course complete. You can now recognize approximately ' + compPct.toFixed(1) + '% of all Quranic word occurrences.' });
  }
  if (fCompleted === Math.ceil(fTotal * 0.5)) {
    celebrations.push({ pct: 50, label: 'Halfway through the Foundation', icon: '⭐', insight: 'You have mastered 50 of the most frequent Quranic words. These words cover a significant portion of every surah you read.' });
  }
  if (fCompleted === Math.ceil(fTotal * 0.75)) {
    celebrations.push({ pct: 75, label: 'Three quarters of the Foundation done', icon: '🔥', insight: 'Most short surahs are now accessible to you. The words of Allah are becoming clearer with every lesson.' });
  }
  if (fCompleted >= fTotal && fTotal > 0) {
    celebrations.push({ pct: 90, label: 'Foundation complete', icon: '👑', insight: 'You have completed all Foundation Course lessons. You now understand approximately ' + compPct.toFixed(1) + '% of all Quranic word occurrences. SubhanAllah.' });
  }
  
  var compMilestones = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  for (var mi = 0; mi < compMilestones.length; mi++) {
    if (compPct >= compMilestones[mi] && (!window.__lastCompMilestone || window.__lastCompMilestone < compMilestones[mi])) {
      var msLabels = {
        10: { icon: '🌱', label: '10% comprehension', insight: 'You now understand approximately one out of every ten Quran words. You can begin to spot repeated vocabulary across different surahs.' },
        20: { icon: '📖', label: '20% comprehension', insight: 'One in five words is known. Short verses like Al-Ikhlas and Al-Asr are becoming meaningful to you.' },
        30: { icon: '🏗️', label: '30% comprehension', insight: 'Nearly one in three words is familiar. You can grasp the topic of many verses.' },
        40: { icon: '🔥', label: '40% comprehension', insight: 'Two in five words. You can follow the structure of most verses.' },
        50: { icon: '👑', label: '50% comprehension', insight: 'Half the words recognized. You understand key Quranic concepts directly.' },
        60: { icon: '📚', label: '60% comprehension', insight: 'Three in five words. With tafsir, you can study most verses meaningfully.' },
        70: { icon: '🎯', label: '70% comprehension', insight: 'Seven in ten words. Only specialized vocabulary remains unfamiliar.' },
        80: { icon: '💎', label: '80% comprehension', insight: 'Four in five words. Working knowledge of almost the entire Quranic vocabulary.' },
        90: { icon: '🏆', label: '90% comprehension', insight: 'Nine in ten words. Deep understanding of Quranic Arabic.' },
      };
      var ms = msLabels[compMilestones[mi]];
      if (ms) celebrations.push({ pct: compMilestones[mi], label: ms.label, icon: ms.icon, insight: ms.insight });
      window.__lastCompMilestone = compMilestones[mi];
      break;
    }
  }
  
  if (celebrations.length > 0) {
    window.__DEV__ && console.log('[app] Celebrating milestone: ' + celebrations[0].label);
    setTimeout(function() {
      window.__ux.showMilestoneCelebration(celebrations[0]);
    }, 800);
  }
}

// ── Toast Notification ─────────────────────────────────────────

/**
 * Show a toast notification when surah comprehension improves.
 */
function showSurahConnectionToast(surahImprovements) {
  var improvements = surahImprovements || [];
  if (improvements.length === 0) return;
  // Callers pass {name, ...} objects from getSurahsImproved*; names also work
  var names = improvements.map(function (s) { return typeof s === 'string' ? s : s.name; });
  var msg = 'Understanding improved in ' + names.slice(0, 3).join(', ') +
    (improvements.length > 3 ? ', and ' + (improvements.length - 3) + ' more surahs' : '');
  if (window.__ux && window.__ux.showToast) {
    window.__ux.showToast(msg, 'success');
  }
}
