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
  // If in foundation mode, return foundation lesson words
  if (getOrganizationMode() === FOUNDATION_MODE) {
    return getFoundationLessonWords(activeLessonIndex);
  }
  // If in surah mode, return surah words
  if (getOrganizationMode() === 'surah' && getActiveSurahId()) {
    return getSurahWords(getActiveSurahId());
  }
  return getLessonWords(activeLessonIndex);
}

/** Get the word count for the currently active lesson/surah */
function getActiveLessonWordCount() {
  var words = getActiveLessonWords();
  return words ? words.length : 0;
}

/** Navigate to a specific Foundation Course lesson. */
function goToFoundationLesson(lessonIndex, wordIndex) {
  if (lessonIndex < 0 || lessonIndex >= getFoundationLessonCount()) return;
  if (getOrganizationMode() !== FOUNDATION_MODE) {
    setOrganizationMode(FOUNDATION_MODE);
    setActiveSurahId(null);
  }
  if (!isFoundationLessonUnlocked(lessonIndex) && lessonIndex !== activeLessonIndex) {
    return;
  }
  activeLessonIndex = lessonIndex;
  setCurrentFoundationLesson(lessonIndex);
  currentWord = (wordIndex !== undefined && wordIndex >= 0) ? wordIndex : 0;
  reviewMode = false;
  switchView('learn');
  updateWordCard();
  updateLessonProgressDisplay();
}

/** Navigate to a specific lesson. Optional wordIndex to jump to a specific word. */
function goToSurah(surahId, wordIndex) {
  if (!surahId || !SURAH_INFO[surahId]) return;
  setOrganizationMode('surah');
  setActiveSurahId(surahId);
  activeLessonIndex = 0;
  currentWord = (wordIndex !== undefined && wordIndex >= 0) ? wordIndex : 0;
  reviewMode = false;
  switchView('learn');
  updateWordCard();
}

/** Switch back to lesson mode */
function goToLessonMode() {
  setOrganizationMode('lesson');
  setActiveSurahId(null);
  activeLessonIndex = getCurrentLessonIndex();
  currentWord = 0;
  reviewMode = false;
  switchView('learn');
  updateWordCard();
}
function goToLesson(lessonIndex, wordIndex) {
  if (lessonIndex < 0 || lessonIndex >= getLessonCount()) return;
  // Switch to lesson mode if we were in surah or foundation mode
  if (getOrganizationMode() !== 'lesson') {
    setOrganizationMode('lesson');
    setActiveSurahId(null);
  }
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
  if (getOrganizationMode() === FOUNDATION_MODE) {
    var foundationNext = getNextIncompleteFoundationLesson();
    goToFoundationLesson(foundationNext);
    return;
  }
  var next = getNextIncompleteLesson();
  goToLesson(next);
}

// ── Core word accessor ────────────────────────────────────────

function getCurrentWord() {
  if (reviewMode) return reviewQueue[currentWord];
  var words = getActiveLessonWords();
  if (!words || words.length === 0) return null;
  if (currentWord >= words.length) currentWord = 0;
  return words[currentWord];
}

// ── View Switching ─────────────────────────────────────────────

function switchView(viewName) {
  // Clear any pending quiz auto-navigation timer when user switches views
  if (window.__autoNavTimer) {
    clearTimeout(window.__autoNavTimer);
    window.__autoNavTimer = null;
  }

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
  if (viewName === 'explorer') renderExplorer();
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

// ── SRS ────────────────────────────────────────────────────────

function rateSRS(rating) {
  const w = getCurrentWord();
  if (!w) return;
  rateSRSWord(w.id, rating);

  // Invalidate stats cache after rating
  if (window.__srs && window.__srs.invalidateStatsCache) {
    window.__srs.invalidateStatsCache();
  }

  // Track streak on review
  updateStreak();

  updateStatsDisplay(); // also updates goal ring

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
  toggleFavorite(w.id);
  updateBookmarkButton(w.id);
}

function saveNote() {
  var w = getCurrentWord();
  if (!w) return;
  var text = document.getElementById('notes-input').value;
  setNote(w.id, text);
}

// ── Lesson Progress Display ────────────────────────────────────

function updateLessonProgressDisplay() {
  var lessonLabel = DOM.get('lesson-label');
  
  // ── Foundation Course Mode ──
  if (getOrganizationMode() === FOUNDATION_MODE) {
    var fTotal = getFoundationLessonCount();
    var fCompleted = getCompletedFoundationLessonCount();
    var fCurrent = activeLessonIndex + 1;
    var isReview = FOUNDATION_LESSONS[activeLessonIndex] && FOUNDATION_LESSONS[activeLessonIndex].isReview;

    if (lessonLabel) {
      var fLesson = FOUNDATION_LESSONS[activeLessonIndex];
      var coverage = fLesson ? fLesson.cumulativeCoverage : '';
      lessonLabel.textContent = 'Foundation ' + fCurrent + ' of ' + fTotal + ' (' + coverage + ')';
    }

    var lessonProgress = DOM.get('lesson-progress');
    if (lessonProgress) {
      var pct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
      lessonProgress.style.width = pct + '%';
    }

    var lessonProgressText = DOM.get('lesson-progress-text');
    if (lessonProgressText) {
      lessonProgressText.textContent = fCompleted + ' of ' + fTotal + ' foundation lessons complete';
    }

    // Update foundation-specific lesson coverage display
    var foundationCoverageEl = DOM.get('foundation-coverage');
    if (foundationCoverageEl && fLesson) {
      foundationCoverageEl.textContent = 'This lesson covers ' + fLesson.lessonCoverage + ' of Quranic vocabulary · Cumulative: ' + fLesson.cumulativeCoverage;
      foundationCoverageEl.style.display = 'block';
    }

    // Show foundation lesson relationship context (root families, related words)
    if (typeof getFoundationLessonRelationshipContext === 'function') {
      var fCtx = getFoundationLessonRelationshipContext(activeLessonIndex);
      if (fCtx && fCtx.rootFamilies && fCtx.rootFamilies.length > 0) {
        var fRelCtx = DOM.get('foundation-relationship-context');
        if (fRelCtx) {
          var ctxHtml = '<div class="foundation-rel-header" style="font-size:11px;color:var(--gold);margin-top:8px;padding:8px 10px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border-light)">';
          // Root families
          ctxHtml += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">🌱 Root families in this lesson:</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">';
          for (var rfi = 0; rfi < fCtx.rootFamilies.length; rfi++) {
            var rf = fCtx.rootFamilies[rfi];
            ctxHtml += '<span style="font-size:10px;background:var(--bg-hover);padding:3px 8px;border-radius:4px;color:var(--gold)">' + rf.root + ' <span style="color:var(--text-muted)">(' + rf.rootMeaning + ')</span></span>';
          }
          ctxHtml += '</div>';
          // Already learned related
          if (fCtx.alreadyLearnedRelated && fCtx.alreadyLearnedRelated.length > 0) {
            ctxHtml += '<div style="font-size:10px;color:var(--green);margin-bottom:4px">✓ Related words already learned from this root family:</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">';
            for (var ali = 0; ali < fCtx.alreadyLearnedRelated.length; ali++) {
              var al = fCtx.alreadyLearnedRelated[ali];
              ctxHtml += '<span style="font-size:10px;background:rgba(76,175,80,0.1);padding:3px 8px;border-radius:4px;color:var(--green)">' + al.arabic + ' <span style="color:var(--text-muted)">(' + al.english + ')</span></span>';
            }
            ctxHtml += '</div>';
          }
          // Upcoming related
          if (fCtx.upcomingRelated && fCtx.upcomingRelated.length > 0) {
            ctxHtml += '<div style="font-size:10px;color:var(--purple);margin-bottom:4px">📅 Related words coming in future lessons:</div><div style="display:flex;flex-wrap:wrap;gap:4px">';
            for (var upi = 0; upi < fCtx.upcomingRelated.length; upi++) {
              var up = fCtx.upcomingRelated[upi];
              ctxHtml += '<span style="font-size:10px;background:rgba(156,39,176,0.1);padding:3px 8px;border-radius:4px;color:var(--purple)">' + up.arabic + ' <span style="color:var(--text-muted)">(' + up.english + ') - Lesson ' + (up.lessonId + 1) + '</span></span>';
            }
            ctxHtml += '</div>';
          }
          ctxHtml += '</div>';
          fRelCtx.innerHTML = ctxHtml;
          fRelCtx.style.display = 'block';
        }
      }
    }

    var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
      var nextIncomplete = getNextIncompleteFoundationLesson();
      if (nextIncomplete === 0 && isFoundationLessonCompleted(0) && fTotal > 0) {
        continueBtn.textContent = '🎉 Foundation Complete!';
        continueBtn.disabled = true;
      } else if (nextIncomplete === activeLessonIndex) {
        continueBtn.textContent = '📖 Continue Foundation ' + (nextIncomplete + 1);
        continueBtn.disabled = false;
      } else if (isFoundationLessonCompleted(activeLessonIndex) && nextIncomplete < fTotal) {
        continueBtn.textContent = '🔓 Unlock Foundation ' + (nextIncomplete + 1) + '!';
        continueBtn.disabled = false;
      } else {
        continueBtn.textContent = '📖 Continue Foundation ' + (nextIncomplete + 1);
        continueBtn.disabled = false;
      }
    }
    return;
  }
  
  if (getOrganizationMode() === 'surah') {
    // Surah mode display
    var surahId = getActiveSurahId();
    var surahInfo = getSurahInfo(surahId);
    var surahIds = getSurahsWithVocabulary();
    var curIdx = surahIds.indexOf(surahId);
    
    if (lessonLabel && surahInfo) {
      lessonLabel.textContent = surahInfo.name + ' - ' + surahInfo.english;
    }
    
    var completed = getCompletedSurahCount();
    
    var lessonProgress = DOM.get('lesson-progress');
    if (lessonProgress) {
      var pct = surahIds.length > 0 ? Math.round((completed / surahIds.length) * 100) : 0;
      lessonProgress.style.width = pct + '%';
    }

    var lessonProgressText = DOM.get('lesson-progress-text');
    if (lessonProgressText) {
      lessonProgressText.textContent = completed + ' of ' + surahIds.length + ' surahs complete';
    }

    // Hide foundation-specific elements when in surah mode
    var foundationCoverageEl = DOM.get('foundation-coverage');
    if (foundationCoverageEl) foundationCoverageEl.style.display = 'none';

    var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
      if (completed >= surahIds.length) {
        continueBtn.textContent = '🎉 All Surahs Complete!';
        continueBtn.disabled = true;
      } else {
        var nextIncomplete = -1;
        for (var si = 0; si < surahIds.length; si++) {
          if (!isSurahCompleted(surahIds[si])) { nextIncomplete = si; break; }
        }
        if (nextIncomplete >= 0) {
          continueBtn.textContent = '📖 Continue ' + getSurahNameSimple(surahIds[nextIncomplete]);
          continueBtn.disabled = false;
        }
      }
    }
    return;
  }
  
  // Lesson mode (original behavior)
  var total = getLessonCount();
  var completed = getCompletedLessonCount();
  var current = activeLessonIndex + 1;

  if (lessonLabel) {
    lessonLabel.textContent = 'Lesson ' + current + ' of ' + total;
  }

  var lessonProgress = DOM.get('lesson-progress');
  if (lessonProgress) {
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    lessonProgress.style.width = pct + '%';
  }

  var lessonProgressText = DOM.get('lesson-progress-text');
  if (lessonProgressText) {
    lessonProgressText.textContent = completed + ' of ' + total + ' lessons complete';
  }

  // Hide foundation-specific elements when in lesson mode
  var foundationCoverageEl = DOM.get('foundation-coverage');
  if (foundationCoverageEl) foundationCoverageEl.style.display = 'none';
  var foundationPrimaryCovEl = DOM.get('foundation-primary-coverage');
  if (foundationPrimaryCovEl) foundationPrimaryCovEl.style.display = 'none';
  var foundationRelCtxEl = DOM.get('foundation-relationship-context');
  if (foundationRelCtxEl) foundationRelCtxEl.style.display = 'none';

  var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
    var nextIncomplete = getNextIncompleteLesson();
    if (nextIncomplete === 0 && isLessonCompleted(0) && getLessonCount() > 1) {
      continueBtn.textContent = '\uD83C\uDF89 All Lessons Complete!';
      continueBtn.disabled = true;
    } else if (nextIncomplete === activeLessonIndex) {
      continueBtn.textContent = '\uD83D\uDCD6 Continue Lesson ' + (nextIncomplete + 1);
      continueBtn.disabled = false;
    } else if (isLessonCompleted(activeLessonIndex) && nextIncomplete < getLessonCount()) {
      continueBtn.textContent = '\uD83D\uDD13 Unlock Lesson ' + (nextIncomplete + 1) + '!';
      continueBtn.disabled = false;
    } else {
      continueBtn.textContent = '\uD83D\uDCD6 Continue Lesson ' + (nextIncomplete + 1);
      continueBtn.disabled = false;
    }
  }
}

// ── Quick Flashcard Mode ──────────────────────────────────────

let quickMode = false;

function toggleQuickMode() {
  quickMode = !quickMode;
  var view = document.getElementById('view-learn');
  if (view) {
    view.classList.toggle('quick-mode', quickMode);
  }
  var btn = document.getElementById('qa-quick-mode');
  if (btn) {
    if (quickMode) {
      btn.classList.add('active-qa');
      btn.textContent = '⚡ Quick: ON';
    } else {
      btn.classList.remove('active-qa');
      btn.textContent = '⚡ Quick';
    }
  }
  // Scroll word card into view in quick mode
  if (quickMode) {
    var card = document.getElementById('word-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ── Session Review Summary ─────────────────────────────────────

function showSessionSummary(stats) {
  var modal = document.getElementById('session-summary-modal');
  if (!modal) return;

  document.getElementById('session-words-reviewed').textContent = stats.wordsReviewed || 0;
  document.getElementById('session-streak-earned').textContent = stats.streakDays || 0;
  document.getElementById('session-mastered-new').textContent = stats.newMastered || 0;

  var encouragement = document.getElementById('session-encouragement');
  var msgs = [
    '🌟 MashAllah! Excellent progress!',
    '📖 Keep going — every word brings you closer!',
    '💪 Strong effort! Consistency is key.',
    '🎯 Focused review makes perfect. Well done!',
    '🌙 Beautiful work! The Quran rewards persistence.',
  ];
  if (stats.wordsReviewed >= 10) {
    encouragement.textContent = msgs[0];
  } else if (stats.wordsReviewed >= 5) {
    encouragement.textContent = msgs[1];
  } else {
    encouragement.textContent = msgs[2];
  }

  modal.style.display = 'flex';
  // Backdrop click to close
  modal.onclick = function(e) {
    if (e.target === modal) closeSessionSummary();
  };
  // Manage aria-hidden on app container and trap focus
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

// ── Keyboard Shortcuts ────────────────────────────────────────

let _kbdHintsTimer = null;

function showKeyboardHints() {
  var hint = document.getElementById('kbd-hints');
  if (!hint) return;
  hint.classList.add('visible');
  // Announce to screen readers
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  if (_kbdHintsTimer) clearTimeout(_kbdHintsTimer);
  _kbdHintsTimer = setTimeout(function () {
    hint.classList.remove('visible');
    hint.removeAttribute('role');
    hint.removeAttribute('aria-live');
  }, 4000);
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    // Ignore if user is typing in an input/textarea
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Check if any modal is open
    var passwordModal = document.getElementById('password-change-modal');
    var sessionModal = document.getElementById('session-summary-modal');
    var anyModalOpen = (passwordModal && passwordModal.style.display === 'flex') ||
                       (sessionModal && sessionModal.style.display === 'flex');

    if (anyModalOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSessionSummary();
        closePasswordModal();
      }
      return;
    }

    // Show hints on ? key (works with or without Shift)
    if (e.key === '?') {
      e.preventDefault();
      showKeyboardHints();
      return;
    }

    switch (currentView) {
      case 'learn':
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          // Navigate next
          var btnNext = document.getElementById('btn-next');
          if (btnNext && !btnNext.disabled) btnNext.click();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          var btnPrev = document.getElementById('btn-prev');
          if (btnPrev && !btnPrev.disabled) btnPrev.click();
        } else if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          var srsBtns = ['srs-again', 'srs-hard', 'srs-good', 'srs-easy'];
          var btn = document.getElementById(srsBtns[parseInt(e.key) - 1]);
          if (btn && btn.style.display !== 'none') btn.click();
        } else if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          toggleQuickMode();
        }
        break;

      case 'quiz':
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          var opts = document.querySelectorAll('.quiz-opt:not(:disabled)');
          var idx = parseInt(e.key) - 1;
          if (opts[idx]) opts[idx].click();
        } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          var nextBtn = document.getElementById('btn-next-quiz');
          if (nextBtn && nextBtn.style.display !== 'none') nextBtn.click();
        }
        break;

      case 'list':
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          var searchInput = document.getElementById('search-input');
          if (searchInput) searchInput.focus();
        }
        break;
    }

    // Global navigation shortcuts (no modifier keys)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); switchView('learn'); }
      else if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); switchView('quiz'); }
      else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); switchView('list'); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); switchView('stats'); }
    }

    // Dismiss auto-shown hints on first interaction
    if (window._kbdHintsAutoShown) {
      window._kbdHintsAutoShown = false;
      var hint = document.getElementById('kbd-hints');
      if (hint) {
        clearTimeout(_kbdHintsTimer);
        hint.classList.remove('visible');
      }
    }
  });
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

  // Search input (debounced with requestAnimationFrame for performance)
  var searchInput = DOM.get('search-input');
  if (searchInput) {
    var searchTimer = null;
    searchInput.oninput = function () {
      if (searchTimer) {
        cancelAnimationFrame(searchTimer);
      }
      searchTimer = requestAnimationFrame(function() {
        searchTimer = null;
        handleSearchInput();
      });
    };
  }

  // Filter chips (use delegated event for better performance)
  wireFilterChips('type');
  wireFilterChips('status');

  // Continue Learning button (works for foundation, surah, and lesson mode)
  DOM.get('continue-learning-btn').onclick = function () {
    if (getOrganizationMode() === FOUNDATION_MODE) {
      var fNext = getNextIncompleteFoundationLesson();
      goToFoundationLesson(fNext);
    } else if (getOrganizationMode() === 'surah') {
      // In surah mode, go to next incomplete surah
      var surahIds = getSurahsWithVocabulary();
      for (var si = 0; si < surahIds.length; si++) {
        if (!isSurahCompleted(surahIds[si])) {
          goToSurah(surahIds[si]);
          return;
        }
      }
      // All complete
      goToSurah(surahIds[0] || 1);
    } else {
      continueLearning();
    }
  };

  // Quick mode toggle
  DOM.get('qa-quick-mode').onclick = toggleQuickMode;

  // Session summary close
  DOM.get('session-summary-close').onclick = function () {
    closeSessionSummary();
    switchView('learn');
    // Focus word card for keyboard users
    var wordCard = DOM.get('word-card');
    if (wordCard && typeof wordCard.focus === 'function') {
      wordCard.setAttribute('tabindex', '-1');
      wordCard.focus();
    }
  };

  // Lesson navigation (prev/next lesson or surah)
  DOM.get('prev-lesson-btn').onclick = function () {
    if (getOrganizationMode() === FOUNDATION_MODE) {
      if (activeLessonIndex > 0) goToFoundationLesson(activeLessonIndex - 1);
    } else if (getOrganizationMode() === 'surah') {
      // In surah mode, find previous surah with vocabulary
      var surahIds = getSurahsWithVocabulary();
      var curIdx = surahIds.indexOf(getActiveSurahId());
      if (curIdx > 0) goToSurah(surahIds[curIdx - 1]);
    } else if (activeLessonIndex > 0) {
      goToLesson(activeLessonIndex - 1);
    }
  };
  DOM.get('next-lesson-btn').onclick = function () {
    if (getOrganizationMode() === FOUNDATION_MODE) {
      var fTotal = getFoundationLessonCount();
      var nextIdx = activeLessonIndex + 1;
      if (nextIdx < fTotal && isFoundationLessonUnlocked(nextIdx)) {
        goToFoundationLesson(nextIdx);
      }
    } else if (getOrganizationMode() === 'surah') {
      // In surah mode, find next surah with vocabulary
      var surahIds = getSurahsWithVocabulary();
      var curIdx = surahIds.indexOf(getActiveSurahId());
      if (curIdx >= 0 && curIdx < surahIds.length - 1) goToSurah(surahIds[curIdx + 1]);
    } else {
      var nextIdx = activeLessonIndex + 1;
      if (nextIdx < getLessonCount() && isLessonUnlocked(nextIdx)) {
        goToLesson(nextIdx);
      }
    }
  };
  
  // Mode/Surah selector from lesson header
  var surahSelector = DOM.get('surah-select');
  if (surahSelector) {
    surahSelector.onchange = function () {
      var val = this.value;
      if (val === 'lesson') {
        goToLessonMode();
      } else if (val === 'foundation') {
        goToFoundationLesson(getCurrentFoundationLessonIndex());
      } else if (val === 'surah') {
        // Find first surah with vocabulary
        var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
        if (surahIds.length > 0) {
          goToSurah(surahIds[0]);
        }
      } else {
        // Numeric surah ID
        var numVal = parseInt(val, 10);
        if (numVal) {
          goToSurah(numVal);
        }
      }
    };
  }

  // Wire occurrence navigation for canonical words
  wireOccurrenceNav();
}

function wireFilterChips(filterType) {
  var selector = '#filter-' + filterType + '-chips';
  var container = document.querySelector(selector);
  if (container) {
    // Use event delegation on the container instead of per-chip handlers
    container.onclick = function (e) {
      var chip = e.target.closest('.chip');
      if (chip) {
        handleFilterClick(filterType, chip.getAttribute('data-value'));
      }
    };
  }
}

var _reviewOriginalMastered = 0;

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
  for (var ri = 0; ri < reviewQueue.length; ri++) {
    var entry = srsData[reviewQueue[ri].id];
    if (entry && entry.stage >= 2) {
      newMastered++;
    }
  }
  newMastered = Math.max(0, newMastered - _reviewOriginalMastered);

  var streakData = loadStreakData();
  var stats = {
    wordsReviewed: reviewQueue.length,
    streakDays: streakData.streak || 0,
    newMastered: newMastered,
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

// ── Modal Focus Trap Utilities ─────────────────────────────────

/**
 * Trap focus within a modal element for accessibility.
 * Cycles Tab and Shift+Tab through all focusable children.
 */
function trapFocus(modalEl) {
  if (!modalEl) return;
  // Find all focusable elements inside the modal
  var focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var focusable = modalEl.querySelectorAll(focusableSelector);
  if (focusable.length === 0) return;

  var firstFocusable = focusable[0];
  var lastFocusable = focusable[focusable.length - 1];

  // Store the previously focused element so we can restore it
  window.__lastFocusedEl = document.activeElement;

  // Focus the first focusable element in the modal
  if (firstFocusable) firstFocusable.focus();

  // Listen for Tab key to keep focus within the modal
  modalEl._focusTrapHandler = function (e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', modalEl._focusTrapHandler);
}

/**
 * Release a focus trap and restore focus to the previously focused element.
 */
function releaseFocusTrap(modalEl) {
  if (!modalEl) return;
  if (modalEl._focusTrapHandler) {
    document.removeEventListener('keydown', modalEl._focusTrapHandler);
    delete modalEl._focusTrapHandler;
  }
  // Restore focus
  if (window.__lastFocusedEl && window.__lastFocusedEl.focus) {
    window.__lastFocusedEl.focus();
  }
}

/**
 * Close the password change modal and manage aria-hidden.
 */
function closePasswordModal() {
  var modal = document.getElementById('password-change-modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.onclick = null;
  releaseFocusTrap(modal);
  var appEl = document.querySelector('.app');
  if (appEl) appEl.removeAttribute('aria-hidden');
}

// ── Surah Selector Populator ───────────────────────────────────

function populateSurahSelector() {
  var select = DOM.get('surah-select');
  if (!select) return;
  
  // Clear existing options
  while (select.options.length > 0) {
    select.remove(0);
  }
  
  // Base options
  var lessonOpt = document.createElement('option');
  lessonOpt.value = 'lesson';
  lessonOpt.textContent = '📚 Lessons (sequential)';
  select.appendChild(lessonOpt);
  
  var foundationOpt = document.createElement('option');
  foundationOpt.value = 'foundation';
  foundationOpt.textContent = '📘 Foundation Course (frequency)';
  select.appendChild(foundationOpt);
  
  // Get surah IDs that have vocabulary
  var surahIds = getSurahsWithVocabulary();
  if (surahIds.length === 0) return;
  
  // Add a separator option
  var separator = document.createElement('option');
  separator.disabled = true;
  separator.textContent = '─── Surahs ───';
  select.appendChild(separator);
  
  // Add surah option for "Surah mode"
  var surahModeOpt = document.createElement('option');
  surahModeOpt.value = 'surah';
  surahModeOpt.textContent = '📖 Surah Mode (by surah)';
  select.appendChild(surahModeOpt);
  
  // Add a second separator
  var separator2 = document.createElement('option');
  separator2.disabled = true;
  separator2.textContent = '─── Individual Surahs ───';
  select.appendChild(separator2);
  
  // Add each surah with vocabulary
  for (var i = 0; i < surahIds.length; i++) {
    var sid = surahIds[i];
    var info = getSurahInfo(sid);
    if (!info) continue;
    var opt = document.createElement('option');
    opt.value = sid;
    opt.textContent = sid + '. ' + info.name + ' — ' + info.english;
    select.appendChild(opt);
  }
}

// ── Window Bridge ──────────────────────────────────────────────

window.__getCurrentWord = getCurrentWord;

window.__navigateToWordIndex = function (idx) {
  var count = getActiveLessonWordCount();
  if (count === 0) return;
  currentWord = Math.min(idx, count - 1);
  reviewMode = false;
  switchView('learn');
  updateWordCard();
};

// Bridge for explorer to navigate to a word in learn mode
window.__navigateToWord = function (w) {
  if (!w) return;
  // Try to find the word in active words
  var activeWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : [];
  var idx = activeWords.indexOf(w);
  if (idx >= 0) {
    window.__navigateToWordIndex(idx);
    return;
  }
  // Fallback: try canonical words
  var canonicalWords = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  var cidx = canonicalWords.indexOf(w);
  if (cidx >= 0) {
    var wordLesson = Math.floor(cidx / WORDS_PER_LESSON);
    var wordInLesson = cidx % WORDS_PER_LESSON;
    if (wordLesson >= 0 && typeof goToLesson === 'function') {
      goToLesson(wordLesson, wordInLesson);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// Data Validation — Runs at startup to detect data issues
// ═══════════════════════════════════════════════════════════════

/**
 * Validate the integrity of ALL_WORDS data at startup.
 * Checks for: duplicate IDs, missing IDs, missing required fields,
 * invalid surah references, and malformed entries.
 * Produces console warnings for any issues found.
 */
function validateData() {
  if (!ALL_WORDS || ALL_WORDS.length === 0) {
    console.warn('[validate] No vocabulary data loaded.');
    return { valid: false, errors: ['No vocabulary data loaded'] };
  }

  var errors = [];
  var idMap = {};
  var arabicCounts = {};

  // Build a Set of all arabic texts for O(1) cross-reference lookups
  var arabicSet = new Set();
  for (var si = 0; si < ALL_WORDS.length; si++) {
    if (ALL_WORDS[si].arabic) arabicSet.add(ALL_WORDS[si].arabic);
  }

  for (var i = 0; i < ALL_WORDS.length; i++) {
    var w = ALL_WORDS[i];

    // 1. Check ID exists and is unique
    if (!w.id) {
      errors.push('Word #' + i + ' is missing an id field');
    } else if (idMap[w.id]) {
      errors.push('Duplicate ID: ' + w.id + ' (words #' + idMap[w.id] + ' and #' + i + ')');
    } else {
      idMap[w.id] = i;
    }

    // 2. Check ID format (should start with "w_")
    if (w.id && w.id.indexOf('w_') !== 0) {
      errors.push('Word #' + i + ' has malformed ID: ' + w.id);
    }

    // 3. Check required fields
    if (!w.arabic) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing arabic field');
    if (!w.english) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing english field');
    if (!w.translit) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing translit field');
    if (!w.meaning) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing meaning field');
    if (!w.type) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing type field');
    if (!w.typeCategory) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing typeCategory field');
    if (!w.root) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing root field');
    if (w.occ === undefined || w.occ === null) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing occ field');
    if (!w.difficulty) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing difficulty field');

    // 4. Check surahId is valid if present
    if (w.surahId !== undefined && w.surahId !== null) {
      if (!SURAH_INFO || !SURAH_INFO[w.surahId]) {
        errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has invalid surahId: ' + w.surahId);
      }
    }

    // 5. Check verseKey format and validate verse number against Surah info
    if (w.verseKey && typeof w.verseKey === 'string') {
      var parts = w.verseKey.split(':');
      if (parts.length !== 2) {
        errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has malformed verseKey: ' + w.verseKey);
      } else {
        var vSurah = parseInt(parts[0], 10);
        var vVerse = parseInt(parts[1], 10);
        // Check verse number is within surah's verse count
        if (w.surahId && SURAH_INFO && SURAH_INFO[w.surahId]) {
          var maxVerses = SURAH_INFO[w.surahId].verses;
          if (vVerse < 1 || vVerse > maxVerses) {
            errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has verseKey ' + w.verseKey + ' but surah ' + w.surahId + ' only has ' + maxVerses + ' verses');
          }
        }
        // Check verseKey surah matches word surahId
        // Note: cross-surah verse references are intentional for thematic words
        // (e.g., a word from Al-Baqarah may use an example ayah from another surah)
        if (w.surahId && vSurah !== w.surahId) {
          console.log('[validate] ℹ Word #' + i + ' (' + (w.id || 'no-id') + ') has verseKey surah ' + vSurah + ' but surahId is ' + w.surahId + ' (cross-surah reference, not an error)');
        }
      }
    }

    // 5b. Check similar/opposite word references exist (informational only)
    // Many references point to Quranic words not yet in the vocabulary data.
    var refFields = ['similarWords', 'oppositeWords'];
    for (var ri = 0; ri < refFields.length; ri++) {
      var refs = w[refFields[ri]];
      if (refs && Array.isArray(refs)) {
        for (var rj = 0; rj < refs.length; rj++) {
          if (!arabicSet.has(refs[rj])) {
            console.log('[validate] ℹ Word #' + i + ' (' + (w.id || 'no-id') + ') references non-vocabulary ' + refFields[ri] + ' word: \'' + refs[rj] + '\'');
          }
        }
      }
    }

    // 5c. Check rootFamily references exist (informational only)
    if (w.rootFamily && Array.isArray(w.rootFamily)) {
      for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
        var rfArabic = w.rootFamily[rfi].a;
        if (rfArabic && !arabicSet.has(rfArabic)) {
          console.log('[validate] ℹ Word #' + i + ' (' + (w.id || 'no-id') + ') references non-vocabulary rootFamily word: \'' + rfArabic + '\'');
        }
      }
    }

    // 6. Track arabic duplicates (informational)
    if (w.arabic) {
      if (!arabicCounts[w.arabic]) arabicCounts[w.arabic] = 0;
      arabicCounts[w.arabic]++;
    }

    // 7. Check difficulty range
    if (w.difficulty !== undefined && (w.difficulty < 1 || w.difficulty > 5)) {
      errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has out-of-range difficulty: ' + w.difficulty);
    }

    // 8. Check typeCategory is valid
    var validCategories = ['noun', 'verb', 'particle', 'adjective', 'pronoun', 'exclamation', 'adverb', 'proper noun', 'name'];
    if (w.typeCategory && validCategories.indexOf(w.typeCategory) < 0) {
      errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has invalid typeCategory: ' + w.typeCategory);
    }
  }

  // Report arabic duplicates (not errors, just info)
  var duplicateArabic = [];
  Object.keys(arabicCounts).forEach(function (arabic) {
    if (arabicCounts[arabic] > 1) {
      duplicateArabic.push(arabic + ' (' + arabicCounts[arabic] + ' instances)');
    }
  });

  if (errors.length > 0) {
    console.warn('[validate] Data validation found ' + errors.length + ' issue(s):');
    errors.forEach(function (err) { console.warn('  ✗ ' + err); });
  }

  if (duplicateArabic.length > 0) {
    console.log('[validate] Legitimate duplicate Arabic words found (' + duplicateArabic.length + '):');
    duplicateArabic.forEach(function (info) { console.log('  ℹ ' + info); });
  }

  console.log('[validate] All ' + ALL_WORDS.length + ' words validated. ' +
    (errors.length === 0 ? '✓ No issues.' : errors.length + ' issue(s) found.'));

  return { valid: errors.length === 0, errors: errors, arabicDuplicates: duplicateArabic };
}

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
  // 0. Ensure lessons and word index are built
  if (LESSONS.length === 0) buildLessons();
  if (typeof buildWordIndex === 'function') buildWordIndex();

  // 0a. Run data validation
  validateData();

  // Set active lesson from saved progress (check foundation mode first)
  activeLessonIndex = getCurrentLessonIndex();
  if (activeLessonIndex >= getLessonCount()) activeLessonIndex = 0;
  
  // Set mode selector to match initial state
  var modeSelect = DOM.get('surah-select');
  if (modeSelect) {
    modeSelect.value = 'lesson';
  }

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

  // 4. Set up keyboard shortcuts
  setupKeyboardShortcuts();

  // 5. Validate surah coverage and populate surah selector
  validateSurahCoverage();
  populateSurahSelector();

  // 6. Show the first word card
  updateWordCard();
  updateReviewBanner();
  updateStatsDisplay();
  updateLessonProgressDisplay();

  // 7. Register service worker
  registerServiceWorker();

  // 8. Set up online/offline sync listener
  setupOnlineSync();

  // 9. Show keyboard shortcut hints on first load (briefly)
  setTimeout(function() {
    if (!window._kbdHintsShown) {
      window._kbdHintsShown = true;
      window._kbdHintsAutoShown = true;
      showKeyboardHints();
    }
  }, 1000);

  // 10. Check if user is already signed in (session restored from persistence)
  var user = getCurrentUser();
  if (user) {
    if (!user.emailVerified) {
      console.log('[app] Email not verified — user can continue.');
    }
  }

  // 11. Apply user settings for daily review limit (if available)
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
 * Validate that the loaded vocabulary covers enough surahs.
 * Warns in the console if coverage seems incomplete.
 * This is a safety net to catch deployment issues where data
 * files were added but not properly bundled.
 */
function validateSurahCoverage() {
  if (!ALL_WORDS || ALL_WORDS.length === 0) {
    console.warn('[app] ⚠ No vocabulary data loaded! Check that data bundle was built correctly.');
    return;
  }

  var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  
  if (surahIds.length < 30) {
    console.warn('[app] ⚠ Only ' + surahIds.length + ' surahs detected with vocabulary (expected 70+). ' +
      'Surahs may be missing. Run \'node build.js\' and verify all data files exist in js/data/.');
  }

  // Check for specific surah ranges that should be present
  var minSurah = Math.min.apply(null, surahIds);
  var maxSurah = Math.max.apply(null, surahIds);
  var missingMidSurahs = [];
  for (var si = 41; si <= 80; si++) {
    if (surahIds.indexOf(si) < 0) {
      missingMidSurahs.push(si);
    }
  }
  if (missingMidSurahs.length > 0) {
    console.warn('[app] ⚠ Missing surahs ' + missingMidSurahs.slice(0, 10).join(', ') +
      (missingMidSurahs.length > 10 ? ' (+' + (missingMidSurahs.length - 10) + ' more)' : '') +
      '. These surahs were expected but have no vocabulary data. ' +
      'Check that the corresponding words-surah-NN-*.js files exist and have surahId set.');
  }

  console.log('[app] ✓ Vocabulary coverage: ' + ALL_WORDS.length + ' words across ' +
    surahIds.length + ' surahs (1-' + maxSurah + ').');
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
