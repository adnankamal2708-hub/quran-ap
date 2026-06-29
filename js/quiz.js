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

/**
 * Initialize a new quiz session with shuffled words.
 */
function initQuiz() {
  var lessonWords = getActiveLessonWords();
  quizWords = [...lessonWords].sort(() => Math.random() - 0.5);
  quizIndex = 0;
  quizCorrect = 0;
  quizTotal = 0;
  quizAnswered = false;
  document.getElementById('quiz-score-display').textContent = '';
  showQuizQ();
}

/**
 * Show the current quiz question.
 */
function showQuizQ() {
  quizAnswered = false;
  document.getElementById('btn-next-quiz').style.display = 'none';
  document.getElementById('quiz-feedback').textContent = '';

  const wordIndex = quizIndex % quizWords.length;
  const currentWord = quizWords[wordIndex];
  renderQuizQuestion(currentWord, ALL_WORDS);
}

/**
 * Handle a quiz answer selection.
 */
function answerQuiz(btn, chosen, correct, arabic) {
  if (quizAnswered) return;
  quizAnswered = true;
  quizTotal++;

  const allOpts = document.querySelectorAll('.quiz-opt');
  allOpts.forEach((b) => {
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
  });

  const feedback = document.getElementById('quiz-feedback');

  if (chosen === correct) {
    btn.classList.add('correct');
    quizCorrect++;
    rateSRSWord(arabic, 2);
    feedback.textContent = '✓ Correct!';
    feedback.style.color = 'var(--green)';
  } else {
    btn.classList.add('wrong');
    rateSRSWord(arabic, 0);
    allOpts.forEach((b) => {
      if (b.textContent === correct) b.classList.add('correct');
    });
    feedback.textContent = `✗ Answer: ${correct}`;
    feedback.style.color = 'var(--red)';
  }

  updateQuizScoreDisplay(quizCorrect, quizTotal);
  document.getElementById('btn-next-quiz').style.display = 'inline-block';
  updateStatsDisplay();
}

/**
 * Advance to the next quiz question or show completion.
 * When quiz is complete, check if the lesson should be marked as passed.
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
