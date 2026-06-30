// ═══════════════════════════════════════════════════════════════
// app.js — Main Application Module
// State management, event wiring, initialization.
// Loaded LAST after all services, data, and UI modules.
// ═══════════════════════════════════════════════════════════════

// Build lessons from ALL_WORDS (called once after data files populate)
buildLessons();

// ── State ──────────────────────────────────────────────────────

let currentWord = 0;
let reviewMode = false;
let reviewQueue = [];
let currentView = 'learn';
// Currently active lesson index (0-based) — synced with lesson progress
let activeLessonIndex = 0;

// ── Lesson helpers ─────────────────────────────────────────────

/** Get the words for the currently active lesson */
function getActiveLessonWords() {
  var words = getLessonWords(activeLessonIndex);
  if (!words || words.length === 0) return ALL_WORDS.slice(0, WORDS_PER_LESSON);
  return words;
}

/** Get total words in the active lesson */
function getActiveLessonWordCount() {
  return getActiveLessonWords().length;
}

/** Navigate to a specific lesson. Optional wordIndex to jump to a specific word. */
function goToLesson(lessonIndex, wordIndex) {
  if (lessonIndex < 0 || lessonIndex >= getLessonCount()) return;
  // Check if lesson is unlocked (allow navigation to locked lessons from Continue button context)
  // but prevent direct navigation to locked lessons from nav buttons
  if (!isLessonUnlocked(lessonIndex) && lessonIndex !== activeLessonIndex) {
    return; // silently ignore navigation to locked lessons
  }
  activeLessonIndex = lessonIndex;
  setCurrentLesson(lessonIndex);
  currentWord = (wordIndex !== undefined && wordIndex >= 0) ? wordIndex : 0;
  reviewMode = false;
  switchView('learn');
  updateWordCard();
  updateLessonProgressDisplay();
}

/** Navigate to the next incomplete lesson (Continue Learning) */
function continueLearning() {
  var next = getNextIncompleteLesson();
  goToLesson(next);
}

// ── Core word accessor ────────────────────────────────────────

function getCurrentWord() {
  return reviewMode ? reviewQueue[currentWord] : getActiveLessonWords()[currentWord];
}

// ── View Switching ─────────────────────────────────────────────

function switchView(viewName) {
  currentView = viewName;
  setView(viewName);
  if (viewName === 'learn') {
    updateReviewBanner();
    updateLessonProgressDisplay();
  }
  if (viewName === 'quiz') initQuiz();
  if (viewName === 'list') renderWordList();
  if (viewName === 'stats') renderStats();
  if (viewName === 'profile') renderProfileView();
  if (document.activeElement) document.activeElement.blur();
}

// ── Learn / Review Navigation ─────────────────────────────────

function nextWord() {
  const total = reviewMode ? reviewQueue.length : getActiveLessonWordCount();
  if (currentWord < total - 1) {
    currentWord++;
    updateWordCard();
  }
}

function prevWord() {
  if (currentWord > 0) {
    currentWord--;
    updateWordCard();
  }
}

function updateWordCard() {
  const w = getCurrentWord();
  if (!w) return;
  const total = reviewMode ? reviewQueue.length : getActiveLessonWordCount();
  renderWordCard(w, currentWord, total, reviewMode);

  const btnNext = document.getElementById('btn-next');
  btnNext.onclick = function () {
    if (currentWord < total - 1) {
      nextWord();
    } else if (reviewMode) {
      endReview();
    } else {
      switchView('quiz');
    }
  };

  updateStatsDisplay();
}

// ── Review System (priority-scheduled via SRS engine) ──────────

function startReview() {
  reviewQueue = getDueReviews();
  if (!reviewQueue.length) return;
  reviewMode = true;
  currentWord = 0;
  document.getElementById('review-banner').classList.remove('visible');
  updateWordCard();
}

function endReview() {
  reviewMode = false;
  currentWord = 0;
  updateReviewBanner();
  updateWordCard();
}

// ── SRS ────────────────────────────────────────────────────────

function rateSRS(rating) {
  const w = getCurrentWord();
  if (!w) return;
  rateSRSWord(w.arabic, rating);

  // Invalidate stats cache after rating
  if (window.__srs && window.__srs.invalidateStatsCache) {
    window.__srs.invalidateStatsCache();
  }

  // Track streak on review
  updateStreak();

  updateStatsDisplay();

  // Queue cloud sync (if authenticated)
  var user = getCurrentUser ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }

  const total = reviewMode ? reviewQueue.length : getActiveLessonWordCount();
  if (currentWord < total - 1) {
    currentWord++;
    updateWordCard();
  } else if (reviewMode) {
    endReview();
  } else {
    switchView('quiz');
  }
}

// ── Search & Filter ────────────────────────────────────────────

function handleSearchInput() {
  renderWordList();
}

function handleFilterClick(filterType, value) {
  // Update active chip in this group
  var selector = '#filter-' + filterType + '-chips .chip';
  document.querySelectorAll(selector).forEach(function (chip) {
    if (chip.getAttribute('data-value') === value) {
      chip.classList.add('chip-active');
    } else {
      chip.classList.remove('chip-active');
    }
  });
  renderWordList();
}

// ── Bookmarks & Notes ─────────────────────────────────────────

function toggleBookmark() {
  var w = getCurrentWord();
  if (!w) return;
  toggleFavorite(w.arabic);
  updateBookmarkButton(w.arabic);
}

function saveNote() {
  var w = getCurrentWord();
  if (!w) return;
  var text = document.getElementById('notes-input').value;
  setNote(w.arabic, text);
}

// ── Lesson Progress Display ────────────────────────────────────

function updateLessonProgressDisplay() {
  var total = getLessonCount();
  var completed = getCompletedLessonCount();
  var current = activeLessonIndex + 1;

  var lessonLabel = document.getElementById('lesson-label');
  if (lessonLabel) {
    lessonLabel.textContent = 'Lesson ' + current + ' of ' + total;
  }

  var lessonProgress = document.getElementById('lesson-progress');
  if (lessonProgress) {
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    lessonProgress.style.width = pct + '%';
  }

  var lessonProgressText = document.getElementById('lesson-progress-text');
  if (lessonProgressText) {
    lessonProgressText.textContent = completed + ' of ' + total + ' lessons complete';
  }

  var continueBtn = document.getElementById('continue-learning-btn');
  if (continueBtn) {
    var nextIncomplete = getNextIncompleteLesson();
    if (nextIncomplete === 0 && isLessonCompleted(0) && getLessonCount() > 1) {
      // All lessons completed
      continueBtn.textContent = '🎉 All Lessons Complete!';
      continueBtn.disabled = true;
    } else if (nextIncomplete === activeLessonIndex) {
      continueBtn.textContent = '📖 Continue Lesson ' + (nextIncomplete + 1);
      continueBtn.disabled = false;
    } else if (isLessonCompleted(activeLessonIndex) && nextIncomplete < getLessonCount()) {
      continueBtn.textContent = '🔓 Unlock Lesson ' + (nextIncomplete + 1) + '!';
      continueBtn.disabled = false;
    } else {
      continueBtn.textContent = '📖 Continue Lesson ' + (nextIncomplete + 1);
      continueBtn.disabled = false;
    }
  }
}

// ── Event Wiring ───────────────────────────────────────────────

function wireEvents() {
  // Bottom nav tabs
  document.getElementById('tab-learn').onclick = function () { switchView('learn'); };
  document.getElementById('tab-quiz').onclick = function () { switchView('quiz'); };
  document.getElementById('tab-list').onclick = function () { switchView('list'); };
  document.getElementById('tab-stats').onclick = function () { switchView('stats'); };

  // Learn navigation
  document.getElementById('btn-prev').onclick = prevWord;

  // Quick actions
  document.getElementById('qa-show-ayah').onclick = function () {
    var w = getCurrentWord();
    if (w) showAyah(w);
  };
  document.getElementById('qa-show-more').onclick = function () {
    var w = getCurrentWord();
    if (w) showWordContent(w);
  };
  document.getElementById('qa-root-family').onclick = highlightRootBox;
  document.getElementById('qa-bookmark').onclick = toggleBookmark;

  // Tafsir button
  document.getElementById('tafsir-btn').onclick = function () {
    var w = getCurrentWord();
    if (w) loadTafsir(w);
  };

  // Notes (auto-save on blur)
  document.getElementById('notes-input').onblur = saveNote;

  // SRS rating
  document.getElementById('srs-again').onclick = function () { rateSRS(0); };
  document.getElementById('srs-hard').onclick = function () { rateSRS(1); };
  document.getElementById('srs-good').onclick = function () { rateSRS(2); };
  document.getElementById('srs-easy').onclick = function () { rateSRS(3); };

  // Quiz next button
  document.getElementById('btn-next-quiz').onclick = nextQuiz;

  // Review banner
  document.getElementById('review-start-btn').onclick = startReview;

  // Search input (debounced)
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    var searchTimer = null;
    searchInput.oninput = function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(handleSearchInput, 150);
    };
  }

  // Filter chips
  wireFilterChips('type');
  wireFilterChips('status');

  // Continue Learning button
  var continueBtn = document.getElementById('continue-learning-btn');
  if (continueBtn) {
    continueBtn.onclick = continueLearning;
  }

  // Lesson navigation (prev/next lesson)
  var prevLessonBtn = document.getElementById('prev-lesson-btn');
  if (prevLessonBtn) {
    prevLessonBtn.onclick = function () {
      if (activeLessonIndex > 0) goToLesson(activeLessonIndex - 1);
    };
  }
  var nextLessonBtn = document.getElementById('next-lesson-btn');
  if (nextLessonBtn) {
    nextLessonBtn.onclick = function () {
      var nextIdx = activeLessonIndex + 1;
      if (nextIdx < getLessonCount() && isLessonUnlocked(nextIdx)) {
        goToLesson(nextIdx);
      }
    };
  }
}

function wireFilterChips(filterType) {
  var selector = '#filter-' + filterType + '-chips .chip';
  document.querySelectorAll(selector).forEach(function (chip) {
    chip.onclick = function () {
      handleFilterClick(filterType, chip.getAttribute('data-value'));
    };
  });
}

// ── Window Bridge ──────────────────────────────────────────────

window.__getCurrentWord = getCurrentWord;

window.__navigateToWordIndex = function (idx) {
  currentWord = Math.min(idx, getActiveLessonWordCount() - 1);
  reviewMode = false;
  switchView('learn');
  updateWordCard();
};

// ── Initialization ─────────────────────────────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('sw.js')
      .then(function () {
        var badge = document.getElementById('offline-badge');
        if (badge) badge.textContent = '\u2713 Offline ready';
      })
      .catch(function () {
        var badge = document.getElementById('offline-badge');
        if (badge) badge.style.display = 'none';
      });
  } else {
    var badge = document.getElementById('offline-badge');
    if (badge) badge.style.display = 'none';
  }
}

function init() {
  // 0. Ensure lessons are built
  if (LESSONS.length === 0) buildLessons();

  // Set active lesson from saved progress
  activeLessonIndex = getCurrentLessonIndex();
  if (activeLessonIndex >= getLessonCount()) activeLessonIndex = 0;

  // 1. Initialize Firebase services (auth, sync, user)
  var firebaseReady = initAuth();
  if (firebaseReady) {
    initSync();
    initUserService();
  }

  // 2. Initialize auth and profile UI
  initAuthUI();
  initProfileUI();

  // 3. Wire application events
  wireEvents();

  // 4. Show the first word card
  updateWordCard();
  updateReviewBanner();
  updateStatsDisplay();
  updateLessonProgressDisplay();

  // 5. Register service worker
  registerServiceWorker();

  // 6. Set up online/offline sync listener
  setupOnlineSync();

  // 7. Check if user is already signed in (session restored from persistence)
  var user = getCurrentUser();
  if (user) {
    if (!user.emailVerified) {
      console.log('[app] Email not verified — user can continue.');
    }
  }

  // 8. Apply user settings for daily review limit (if available)
  if (user && window.__user) {
    window.__user.loadProfile(user.uid).then(function (profile) {
      if (profile && profile.settings && profile.settings.dailyReviewLimit) {
        if (window.__srs && window.__srs.updateDailyReviewLimit) {
          window.__srs.updateDailyReviewLimit(profile.settings.dailyReviewLimit);
        }
      }
    }).catch(function () {
      // Silently ignore — use default limit
    });
  }
}

/**
 * Auto-sync pending changes when coming back online.
 */
function setupOnlineSync() {
  window.addEventListener('online', function () {
    var user = getCurrentUser();
    if (user && window.__sync) {
      if (window.__sync.hasPending && window.__sync.hasPending()) {
        console.log('[app] Back online — syncing pending changes...');
        window.__sync.fullSync(user.uid);
      }
    }
  });
}

// Start the app
init();
