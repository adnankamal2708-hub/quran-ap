// ═══════════════════════════════════════════════════════════════
// quiz.js — Quiz Module
// Quiz state management and question flow
// ═══════════════════════════════════════════════════════════════

/** @type {Array} Shuffled word list for the current quiz session */
let quizWords = [];

/** @type {number} Current question index */
let quizIndex = 0;

/** @type {number} Number of correct answers */
let quizCorrect = 0;

/** @type {number} Total questions answered */
let quizTotal = 0;

/** @type {boolean} Whether the current question has been answered */
let quizAnswered = false;

/** @type {boolean} Whether the quiz has finished (prevent re-init) */
let quizFinished = false;

/**
 * Initialize a new quiz session with shuffled words.
 * If the quiz is already in progress and hasn't finished, preserve state.
 */
function initQuiz() {
  // Preserve quiz state if already in progress and not finished
  if (quizWords.length > 0 && !quizFinished && quizIndex < quizWords.length) {
    // If we already have a question displayed, just make sure it's visible
    var currentWord = quizWords[quizIndex % quizWords.length];
    if (currentWord) {
      // Quiz is mid-progress — show current question
      showQuizQ();
      return;
    }
  }

  var lessonWords = getActiveLessonWords();
  if (!lessonWords || lessonWords.length === 0) {
    quizWords = [];
    quizIndex = 0;
    quizCorrect = 0;
    quizTotal = 0;
    quizAnswered = false;
    quizFinished = true;
    var wordEl = DOM.get('quiz-word');
    if (wordEl) wordEl.textContent = '📚';
    var optionsEl = DOM.get('quiz-options');
    if (optionsEl) optionsEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No words available for quiz.</div>';
    DOM.get('quiz-score-display').textContent = '';
    return;
  }

  quizWords = shuffleArray(lessonWords);
  quizIndex = 0;
  quizCorrect = 0;
  quizTotal = 0;
  quizAnswered = false;
  quizFinished = false;
  DOM.get('quiz-score-display').textContent = '';
  showQuizQ();
}

/**
 * Show the current quiz question.
 */
function showQuizQ() {
  quizAnswered = false;
  DOM.get('btn-next-quiz').style.display = 'none';
  DOM.get('quiz-feedback').textContent = '';

  var wordIndex = quizIndex % quizWords.length;
  var currentWord = quizWords[wordIndex];
  renderQuizQuestion(currentWord, ALL_WORDS);
}

/**
 * Handle a quiz answer selection.
 */
function answerQuiz(btn, chosen, correct, arabic) {
  if (quizAnswered) return;
  quizAnswered = true;
  quizTotal++;

  var allOpts = document.querySelectorAll('.quiz-opt');
  for (var i = 0; i < allOpts.length; i++) {
    allOpts[i].disabled = true;
    allOpts[i].setAttribute('aria-disabled', 'true');
  }

  var feedback = DOM.get('quiz-feedback');

  if (chosen === correct) {
    btn.classList.add('correct');
    quizCorrect++;
    rateSRSWord(arabic, 2);
    feedback.textContent = '\u2713 Correct!';
    feedback.style.color = 'var(--green)';
  } else {
    btn.classList.add('wrong');
    rateSRSWord(arabic, 0);
    for (var bi = 0; bi < allOpts.length; bi++) {
      if (allOpts[bi].textContent === correct) allOpts[bi].classList.add('correct');
    }
    feedback.textContent = '\u2717 Answer: ' + correct;
    feedback.style.color = 'var(--red)';
  }

  updateQuizScoreDisplay(quizCorrect, quizTotal);
  DOM.get('btn-next-quiz').style.display = 'inline-block';
  updateStatsDisplay();
}

/**
 * Show quiz completion feedback.
 */
function renderQuizCompletion(score, total) {
  var pct = total > 0 ? Math.round((score / total) * 100) : 0;
  DOM.get('quiz-word').textContent = '\uD83C\uDF89';
  DOM.get('quiz-options').innerHTML = '';
  var feedback = DOM.get('quiz-feedback');
  var msg = pct >= 80 ? 'Excellent, mashAllah!' : pct >= 60 ? 'Good effort \u2014 review the harder ones.' : "Keep going, you'll get there!";
  feedback.textContent = 'Done! ' + pct + '% \u2014 ' + msg;
  feedback.style.color = 'var(--gold)';
  DOM.get('btn-next-quiz').style.display = 'none';
}

/**
 * Update the quiz score display.
 */
function updateQuizScoreDisplay(correct, total) {
  DOM.get('stat-score').textContent = total > 0 ? Math.round((correct / total) * 100) + '%' : '\u2014';
  DOM.get('quiz-score-display').textContent = correct + '/' + total + ' correct';
}

/**
 * Advance to the next quiz question or show completion.
 * When quiz is complete, check if the lesson should be marked as passed.
 * On pass, auto-navigate to next lesson after celebration pause.
 */
function nextQuiz() {
  quizIndex++;
  if (quizIndex >= quizWords.length) {
    renderQuizCompletion(quizCorrect, quizTotal);
    updateStatsDisplay();

    // Check if lesson should be completed (>60% = pass)
    var pct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
    if (pct >= 60) {
      // Mark this lesson as completed
      completeLesson(activeLessonIndex);
      // Update lesson display
      if (typeof updateLessonProgressDisplay === 'function') {
        updateLessonProgressDisplay();
      }
      // Auto-navigate to next lesson after brief celebration pause
      // Guard against stale callback if user has navigated elsewhere
      var autoNavTimer = setTimeout(function() {
        // Only navigate if user is still on the quiz view
        if (typeof currentView !== 'undefined' && currentView === 'quiz') {
          var nextIncomplete = getNextIncompleteLesson();
          if (nextIncomplete < getLessonCount() && nextIncomplete !== activeLessonIndex) {
            if (typeof goToLesson === 'function') {
              goToLesson(nextIncomplete);
            }
          }
        }
      }, 3000);
      // Store timer so it can be cancelled if user navigates away
      window.__autoNavTimer = autoNavTimer;
    }
  } else {
    showQuizQ();
  }
}

/**
 * Wired handle for quiz answer clicks (called from UI events).
 */
function handleQuizAnswer(btn, chosen, correct, arabic) {
  answerQuiz(btn, chosen, correct, arabic);
}
