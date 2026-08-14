// ═══════════════════════════════════════════════════════════════
// learn-screen.js — Learning-Focused Learn Screen Header
//
// Renders a minimal, learning-focused header above the word card.
// Shows only: streak badge, continue learning card,
// reviews due, and compact learning paths grid.
//
// No dashboard-style widgets, greetings, or analytics here.
// Those belong on the Dashboard view.
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
  var container = document.getElementById('ls-collapsible-paths');
  if (!container) return;

  // ── Gather data once ──
  var $dueReviews = typeof getDueReviews === 'function' ? getDueReviews() : [];
  var $dueCount = $dueReviews.length;

  // Foundation data
  var $fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var $fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var $fPct = $fTotal > 0 ? Math.round(($fCompleted / $fTotal) * 100) : 0;
  var $fNextIdx = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
  var $foundationComplete = $fTotal > 0 && $fCompleted >= $fTotal;

  // ── Build HTML ──
  var h = '';

  // ═══ JOURNEY MESSAGE (Part 2) ═══
  var $journeyMsg = '';
  if ($foundationComplete) {
    $journeyMsg = 'Foundation complete! Explore the Quran through surah study.';
  } else if ($fCompleted >= 9) {
    $journeyMsg = 'You are completing the foundation of Quran vocabulary.';
  } else if ($fCompleted >= 7) {
    $journeyMsg = 'Your vocabulary is becoming interconnected through roots.';
  } else if ($fCompleted >= 4) {
    $journeyMsg = 'You are beginning to recognize recurring Quranic patterns.';
  } else if ($fCompleted >= 1) {
    $journeyMsg = 'Every word you learn unlocks more of the Quran.';
  } else {
    $journeyMsg = 'Welcome! Your first lesson starts here.';
  }
  h += '<div class="ls-journey-msg" style="font-size:12px;color:var(--gold-dim);margin-bottom:10px;text-align:center;line-height:1.5">' + $journeyMsg + '</div>';

  // ═══ PHASE 2 (Foundation complete — guided reading / independent reading) ═══
  // The Continue action lives in the persistent lesson header (continue-learning-btn);
  // it is intentionally NOT duplicated here (the old ls-continue-learning card
  // was a redundant copy of the same "continue lesson" action).
  if ($foundationComplete && window.__phase2 && window.__phase2.getLearningPhase) {
    // ── Foundation complete — show Phase 2 actions ──
    var $p2Phase = window.__phase2.getLearningPhase();
    if ($p2Phase === 'guided-reading') {
      var $nextSurah = window.__phase2.getNextGuidedSurah ? window.__phase2.getNextGuidedSurah() : null;
      if ($nextSurah) {
        var $preview = window.__phase2.getSurahPreview ? window.__phase2.getSurahPreview($nextSurah.surahId) : null;
        var $gProgress = window.__phase2.getGuidedReadingProgress ? window.__phase2.getGuidedReadingProgress() : null;
        h += '<div class="ls-action-card ls-card-learn" id="ls-guided-reading" tabindex="0" role="button" aria-label="Guided Reading: ' + ($preview ? $preview.surahName : '') + '">';
        h += '<div class="ls-card-icon">📖</div>';
        h += '<div class="ls-card-body">';
        h += '<div class="ls-card-title">Guided Reading: ' + ($preview ? $preview.surahName : '') + '</div>';
        h += '<div class="ls-card-sub">';
        if ($preview) h += $preview.estimatedComprehension + '% estimated comprehension · ' + $preview.newWords + ' new words';
        h += '</div>';
        h += '</div>';
        if ($gProgress) {
          h += '<div class="ls-progress-ring"><svg viewBox="0 0 36 36" width="28" height="28"><path class="goal-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><path class="goal-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $gProgress.percent + ', 100" stroke="var(--gold)"/></svg></div>';
        }
        h += '</div>';
      }
    } else if ($p2Phase === 'phase2') {
      h += '<div class="ls-action-card" id="ls-independent-reading" style="opacity:0.85">';
      h += '<div class="ls-card-icon">📚</div>';
      h += '<div class="ls-card-body">';
      h += '<div class="ls-card-title">Independent Reading</div>';
      h += '<div class="ls-card-sub">All guided surahs complete! Open the Quran to explore any surah.</div>';
      h += '</div>';
      h += '</div>';
    }
  }

  // ═══ REVIEWS DUE (conditional — urgent action) ═══
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

  // ═══ LEARNING PATHS (quick compact grid) ═══
  var $hasVocabExpansion = window.__premium && window.__premium.hasFeature(window.__premium.FEATURES.VOCABULARY_EXPANSION);
  h += '<div class="ls-paths-grid">';
  var $surahTotal = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary().length : 0;
  var $surahProg = typeof getSurahLessonProgress === 'function' ? getSurahLessonProgress() : null;
  var $surahDone = $surahProg ? $surahProg.completedSurahs : 0;
  var $rfTotal = typeof getTotalRootFamilyCount === 'function' ? getTotalRootFamilyCount() : 0;
  var $rfDone = typeof getCompletedRootFamilyCount === 'function' ? getCompletedRootFamilyCount() : 0;
  var $diffDone = typeof getCompletedDifficultyLevelCount === 'function' ? getCompletedDifficultyLevelCount() : 0;

  h += '<div class="ls-path-item" id="ls-path-foundation" tabindex="0" role="button" aria-label="Foundation course">' + _lsIcon('layers', 14) + ' <span>Foundation</span> <span class="ls-path-pct">' + $fPct + '%</span></div>';
  if ($hasVocabExpansion) {
    h += '<div class="ls-path-item" id="ls-path-surah" tabindex="0" role="button" aria-label="Learn by surah">' + _lsIcon('book', 14) + ' <span>Surahs</span> <span class="ls-path-pct">' + ($surahTotal > 0 ? Math.round(($surahDone / $surahTotal) * 100) : 0) + '%</span></div>';
    h += '<div class="ls-path-item" id="ls-path-roots" tabindex="0" role="button" aria-label="Learn by roots">' + _lsIcon('leaf', 14) + ' <span>Roots</span> <span class="ls-path-pct">' + ($rfTotal > 0 ? Math.round(($rfDone / $rfTotal) * 100) : 0) + '%</span></div>';
  } else {
    h += '<div class="ls-path-item ls-path-locked" id="ls-path-surah" tabindex="0" role="button" aria-label="Learn by surah — Premium feature">🔒 <span>Surahs</span> <span class="ls-path-pct" style="color:var(--gold)">Premium</span></div>';
    h += '<div class="ls-path-item ls-path-locked" id="ls-path-roots" tabindex="0" role="button" aria-label="Learn by roots — Premium feature">🔒 <span>Roots</span> <span class="ls-path-pct" style="color:var(--gold)">Premium</span></div>';
  }
  h += '<div class="ls-path-item" id="ls-path-difficulty" tabindex="0" role="button" aria-label="Learn by difficulty">' + _lsIcon('target', 14) + ' <span>Difficulty</span> <span class="ls-path-pct">' + Math.round(($diffDone / 5) * 100) + '%</span></div>';
  h += '<div class="ls-path-item" id="ls-path-quiz" tabindex="0" role="button" aria-label="Take a quiz">' + _lsIcon('bolt', 14) + ' <span>Quiz</span> <span class="ls-path-pct">⚡</span></div>';
  h += '</div>'

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

  // Reviews Due → start review
  $lwire('ls-reviews-due', function() {
    if (typeof startReview === 'function') startReview();
    else if (typeof switchView === 'function') switchView('learn');
  });

  // Guided Reading — open Quran with next recommended surah
  $lwire('ls-guided-reading', function() {
    if (typeof switchView === 'function') switchView('quran');
    if (window.__phase2 && typeof window.__phase2.getNextGuidedSurah === 'function') {
      var $gNextS = window.__phase2.getNextGuidedSurah();
      if ($gNextS && typeof openSurahForReading === 'function') {
        setTimeout(function() { openSurahForReading($gNextS.surahId); }, 100);
      }
    }
  });

  // Independent Reading — open Quran
  $lwire('ls-independent-reading', function() {
    if (typeof switchView === 'function') switchView('quran');
  });

  // Learning Paths
  $lwire('ls-path-foundation', function() {
    if (typeof goToFoundationLesson === 'function') goToFoundationLesson($fNextIdx || 0);
    else if (typeof switchView === 'function') switchView('learn');
  });
  $lwire('ls-path-surah', function() {
    var $hasExp = window.__premium && window.__premium.hasFeature(window.__premium.FEATURES.VOCABULARY_EXPANSION);
    if ($hasExp) {
      if (typeof switchView === 'function') switchView('learn');
    } else if (window.__premium) {
      window.__premium.requestUpgrade('vocabulary-expansion');
    }
  });
  $lwire('ls-path-roots', function() {
    var $hasExp = window.__premium && window.__premium.hasFeature(window.__premium.FEATURES.VOCABULARY_EXPANSION);
    if ($hasExp) {
      if (typeof goToRootFamily === 'function') goToRootFamily();
      else if (typeof switchView === 'function') switchView('learn');
    } else if (window.__premium) {
      window.__premium.requestUpgrade('vocabulary-expansion');
    }
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
