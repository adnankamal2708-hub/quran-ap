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
function answerQuiz(btn, chosen, correct, wordId) {
  // Record quiz result for adaptive analysis
  if (typeof recordQuizResult === 'function') {
    recordQuizResult(wordId, chosen === correct);
  }
  
  if (quizAnswered) return;
  quizAnswered = true;
  quizTotal++;

  var allOpts = document.querySelectorAll('.quiz-opt');
  for (var i = 0; i < allOpts.length; i++) {
    allOpts[i].disabled = true;
    allOpts[i].setAttribute('aria-disabled', 'true');
  }

  var feedback = DOM.get('quiz-feedback');

  // Build relationship context for quiz feedback
  var relContext = '';
  var currentWord = null;
  for (var wi = 0; wi < quizWords.length; wi++) {
    if (quizWords[wi].id === wordId) { currentWord = quizWords[wi]; break; }
  }
  if (currentWord) {
    var relParts = [];
    if (currentWord.root && currentWord.root !== '\u2014') {
      relParts.push('Root: ' + currentWord.root);
    }
    if (currentWord.type) {
      relParts.push('Type: ' + currentWord.type);
    }
    if (currentWord.occ) {
      relParts.push('Appears ' + currentWord.occ + ' times');
    }
    if (currentWord.frequencyRank) {
      relParts.push('Rank: #' + currentWord.frequencyRank);
    }
    if (currentWord.surahCount) {
      relParts.push('In ' + currentWord.surahCount + ' surah' + (currentWord.surahCount !== 1 ? 's' : ''));
    }
    if (relParts.length > 0) {
      relContext = '<div class="quiz-rel-context" style="font-size:10px;color:var(--text-muted);margin-top:6px;padding:6px 8px;background:var(--bg-hover);border-radius:6px;line-height:1.5">' + relParts.join(' \u00B7 ') + '</div>';
    }
  }

  if (chosen === correct) {
    btn.classList.add('correct');
    quizCorrect++;
    rateSRSWord(wordId, 2);
    feedback.innerHTML = '\u2713 Correct!' + relContext;
    feedback.style.color = 'var(--green)';
  } else {
    btn.classList.add('wrong');
    rateSRSWord(wordId, 0);
    for (var bi = 0; bi < allOpts.length; bi++) {
      if (allOpts[bi].textContent === correct) allOpts[bi].classList.add('correct');
    }
    feedback.innerHTML = '\u2717 Answer: ' + correct + relContext;
    feedback.style.color = 'var(--red)';
  }

  updateQuizScoreDisplay(quizCorrect, quizTotal);
  DOM.get('btn-next-quiz').style.display = 'inline-block';
  updateStatsDisplay();
}

/**
 * Show quiz completion feedback with educational milestone messages for Foundation Course.
 */
function renderQuizCompletion(score, total) {
  var pct = total > 0 ? Math.round((score / total) * 100) : 0;
  DOM.get('quiz-word').textContent = '\uD83C\uDF89';
  DOM.get('quiz-options').innerHTML = '';
  var feedback = DOM.get('quiz-feedback');
  var mode = (typeof getOrganizationMode === 'function' ? getOrganizationMode() : 'lesson');
  
  // Build educational milestone message for Foundation Course
  var milestoneHtml = '';
  if (mode === FOUNDATION_MODE && typeof getFoundationMilestoneMessage === 'function') {
    var milestone = getFoundationMilestoneMessage();
    if (milestone && milestone.message) {
      milestoneHtml = '<div class="quiz-milestone" style="margin-top:12px;padding:10px 12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border-light);font-size:12px;line-height:1.5">' +
        '<div style="display:flex;align-items:flex-start;gap:8px">' +
        '<span style="font-size:20px">' + (milestone.icon || '\uD83C\uDF31') + '</span>' +
        '<span style="color:var(--text);flex:1">' + milestone.message + '</span>' +
        '</div></div>';
    }
  }
  
  // Educational feedback based on score
  var msg = '';
  if (pct >= 90) {
    msg = 'Excellent! You have mastered these words well.';
  } else if (pct >= 80) {
    msg = 'Great work! Most words are solid in your memory.';
  } else if (pct >= 60) {
    msg = 'Good effort \u2014 review the words you missed to strengthen your recall.';
  } else {
    msg = "Keep going! Each attempt builds stronger memory. Review the lesson words and try again.";
  }
  
  feedback.innerHTML = '<div style="font-size:14px;font-weight:500;color:var(--gold);margin-bottom:4px">Done! ' + pct + '% \u2014 ' + msg + '</div>' + milestoneHtml;
  feedback.style.color = '';
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

    // Check if quiz should be completed (>60% = pass)
    var pct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
    if (pct >= 60) {
      // Check current mode
      var mode = (typeof getOrganizationMode === 'function' ? getOrganizationMode() : 'lesson');
      
      if (mode === FOUNDATION_MODE) {
        // Mark this foundation lesson as completed
        var hadLesson = !isFoundationLessonCompleted(activeLessonIndex);
        completeFoundationLesson(activeLessonIndex);
        
        // R4+R5: Check for milestone celebrations after completing a foundation lesson
        if (hadLesson) {
          if (typeof checkForLessonCompletionCelebration === 'function') {
            checkForLessonCompletionCelebration(activeLessonIndex);
          }
          
          // R5: Show surah connection info after lesson completion
          var surahImprovements = typeof getSurahsImprovedByFoundationLesson === 'function' 
            ? getSurahsImprovedByFoundationLesson(activeLessonIndex) : [];
          if (surahImprovements && surahImprovements.length > 0 && typeof showSurahConnectionToast === 'function') {
            showSurahConnectionToast(surahImprovements);
          }
        }
      } else if (mode === 'surah') {
        // Mark this surah as completed
        var activeSurahId = getActiveSurahId ? getActiveSurahId() : null;
        if (activeSurahId) {
          completeSurah(activeSurahId);
        }
      } else {
        // Mark this lesson as completed
        var hadLesson = !isLessonCompleted(activeLessonIndex);
        completeLesson(activeLessonIndex);
        
        if (hadLesson && typeof checkForLessonCompletionCelebration === 'function') {
          checkForLessonCompletionCelebration(activeLessonIndex);
        }
        
        // Show surah connection after lesson completion
        if (hadLesson && typeof getSurahsImprovedByLesson === 'function') {
          var surahImprovements = getSurahsImprovedByLesson(activeLessonIndex);
          if (surahImprovements && surahImprovements.length > 0 && typeof showSurahConnectionToast === 'function') {
            showSurahConnectionToast(surahImprovements);
          }
        }
      }
      
      // Update lesson/surah/foundation display
      if (typeof updateLessonProgressDisplay === 'function') {
        updateLessonProgressDisplay();
      }
      
      // Auto-navigate to next item after brief celebration pause
      var autoNavTimer = setTimeout(function() {
        // Only navigate if user is still on the quiz view
        if (typeof currentView !== 'undefined' && currentView === 'quiz') {
          if (mode === FOUNDATION_MODE) {
            var fNext = getNextIncompleteFoundationLesson();
            if (fNext < getFoundationLessonCount() && fNext !== activeLessonIndex) {
              if (typeof goToFoundationLesson === 'function') {
                goToFoundationLesson(fNext);
              }
            }
          } else if (mode === 'surah') {
            var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
            var curIdx = surahIds.indexOf(activeSurahId);
            if (curIdx >= 0 && curIdx < surahIds.length - 1 && typeof goToSurah === 'function') {
              goToSurah(surahIds[curIdx + 1]);
            }
          } else {
            var nextIncomplete = getNextIncompleteLesson();
            if (nextIncomplete < getLessonCount() && nextIncomplete !== activeLessonIndex) {
              if (typeof goToLesson === 'function') {
                goToLesson(nextIncomplete);
              }
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
function handleQuizAnswer(btn, chosen, correct, wordId) {
  answerQuiz(btn, chosen, correct, wordId);
}
