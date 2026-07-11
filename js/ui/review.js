// ═══════════════════════════════════════════════════════════════
// review.js — SRS Review Session Management
// Extracted from monolithic app.js for modular maintainability.
// ═══════════════════════════════════════════════════════════════

// ── Review Session State ───────────────────────────────────────

var _reviewOriginalMastered = 0;

// ── Review Session Lifecycle ──────────────────────────────────

function startReview() {
  reviewQueue = getDueReviews();
  if (!reviewQueue.length) return;
  _reviewOriginalMastered = 0;
  // Count how many are already mastered in the review queue
  var srsData = loadSRS();
  for (var ri = 0; ri < reviewQueue.length; ri++) {
    var entry = srsData[reviewQueue[ri].id];
    if (entry && entry.stage >= 2) _reviewOriginalMastered++;
  }
  reviewMode = true;
  currentWord = 0;
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
  };

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
  DOM.get('review-banner').classList.remove('visible');
  switchView('learn');
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
  banner.style.cssText = 'margin:8px 12px;padding:10px 12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--gold);font-size:12px;line-height:1.5';
  banner.innerHTML = 
    '<div style="display:flex;align-items:flex-start;gap:8px">' +
    '<span style="font-size:16px">🔁</span>' +
    '<div style="flex:1">' +
    '<div style="font-weight:500;color:var(--gold);margin-bottom:4px">' + checkResult.message + '</div>' +
    '<div style="display:flex;gap:8px">' +
    '<button id="pre-review-now" class="btn btn-sm" style="background:var(--gold);color:var(--bg);border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:11px">Review Now</button>' +
    '<button id="pre-review-continue" class="btn btn-sm" style="background:var(--bg-hover);color:var(--text);border:1px solid var(--border-light);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:11px">Continue Anyway</button>' +
    '</div></div></div>';
  
  var reviewBanner = document.getElementById('review-banner');
  var learnView = document.getElementById('view-learn');
  if (learnView) {
    if (reviewBanner && reviewBanner.nextSibling) {
      learnView.insertBefore(banner, reviewBanner.nextSibling);
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
  var $reviewCardsEl = document.getElementById('session-review-cards');
  if ($reviewCardsEl) $reviewCardsEl.textContent = $reviewCardsCreated;
  var $nextRecEl = document.getElementById('session-next-recommendation');
  if ($nextRecEl) $nextRecEl.textContent = $nextRecommendation;
  var $timeSpentEl = document.getElementById('session-time-spent');
  if ($timeSpentEl) $timeSpentEl.textContent = $timeSpent > 0 ? $timeSpent + ' min' : '< 1 min';

  var encouragement = document.getElementById('session-encouragement');
  var $msgs = [
    '\"And We have certainly made the Quran easy to remember, but is there any who will remember?\" (54:17) — every word you learn brings you closer.',
    'Every word of the Quran you understand is a light added to your heart. Keep going — Allah is guiding you through His words.',
    'The Prophet (peace be upon him) said: \"The best among you are those who learn the Quran and teach it.\" — you are walking this blessed path.',
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
 * Get a brief text recommendation for the user's next action.
 */
function getNextActionRecommendation() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();
  var dueCount = 0;
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (entry && entry.dueDate && now >= entry.dueDate) dueCount++;
  });
  if (dueCount > 0) return dueCount + ' words due for review — reinforce them soon';
  
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  if (fCompleted < fTotal) return 'Continue Foundation ' + (fCompleted + 1) + ' of ' + fTotal;
  
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
    celebrations.push({ pct: 10, label: 'First Lesson Completed!', icon: '🎉', insight: 'You have taken the first step on an incredible journey. The Quran is opening to you, word by word.' });
  }
  if (fCompleted === Math.ceil(fTotal * 0.25)) {
    celebrations.push({ pct: 25, label: 'Quarter Way Through Foundation!', icon: '🌟', insight: 'One quarter of the Foundation Course complete! You can now recognize approximately ' + compPct.toFixed(1) + '% of all Quranic word occurrences.' });
  }
  if (fCompleted === Math.ceil(fTotal * 0.5)) {
    celebrations.push({ pct: 50, label: 'Halfway Through Foundation!', icon: '⭐', insight: 'You have mastered 50 of the most frequent Quranic words! These words cover a significant portion of every surah you read.' });
  }
  if (fCompleted === Math.ceil(fTotal * 0.75)) {
    celebrations.push({ pct: 75, label: 'Three Quarters Done!', icon: '🔥', insight: 'Most short surahs are now accessible to you. The words of Allah are becoming clearer with every lesson.' });
  }
  if (fCompleted >= fTotal && fTotal > 0) {
    celebrations.push({ pct: 90, label: 'Foundation Complete!', icon: '👑', insight: 'You have completed all Foundation Course lessons! You now understand approximately ' + compPct.toFixed(1) + '% of all Quranic word occurrences. SubhanAllah!' });
  }
  
  var compMilestones = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  for (var mi = 0; mi < compMilestones.length; mi++) {
    if (compPct >= compMilestones[mi] && (!window.__lastCompMilestone || window.__lastCompMilestone < compMilestones[mi])) {
      var msLabels = {
        10: { icon: '🌱', label: '10% Comprehension', insight: 'You now understand approximately one out of every ten Quran words. You can begin to spot repeated vocabulary across different surahs.' },
        20: { icon: '📖', label: '20% Comprehension', insight: 'One in five words is known! Short verses like Al-Ikhlas and Al-Asr are becoming meaningful to you.' },
        30: { icon: '🏗️', label: '30% Comprehension', insight: 'Nearly one in three words familiar! You can grasp the topic of many verses.' },
        40: { icon: '🔥', label: '40% Comprehension', insight: 'Two in five words! You can follow the structure of most verses.' },
        50: { icon: '👑', label: '50% Comprehension — Major Milestone!', insight: 'Half the words recognized! You understand key Quranic concepts directly. This is a tremendous achievement.' },
        60: { icon: '📚', label: '60% Comprehension', insight: 'Three in five words! With tafsir, you can study most verses meaningfully.' },
        70: { icon: '🎯', label: '70% Comprehension', insight: 'Seven in ten words! Only specialized vocabulary remains unfamiliar.' },
        80: { icon: '💎', label: '80% Comprehension', insight: 'Four in five words! Working knowledge of almost the entire Quranic vocabulary.' },
        90: { icon: '🏆', label: '90% Comprehension', insight: 'Nine in ten words! Deep understanding of Quranic Arabic.' },
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
  var msg = '📖 Understanding improved in ' + improvements.slice(0, 3).join(', ') +
    (improvements.length > 3 ? ', and ' + (improvements.length - 3) + ' more surahs' : '');
  if (window.__ux && window.__ux.showToast) {
    window.__ux.showToast(msg, 'success');
  }
}
