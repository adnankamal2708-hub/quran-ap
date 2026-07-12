// ═══════════════════════════════════════════════════════════════
// navigation.js — View Switching & Route Management
// Extracted from monolithic app.js for modular maintainability.
// ═══════════════════════════════════════════════════════════════

// ── View State ────────────────────────────────────────────────

let currentView = 'learn';

// ── View Switching ─────────────────────────────────────────────

function switchView(viewName) {
  // Validate route in development mode
  if (window.__validation) {
    window.__validation.onRouteChange(viewName);
  }

  // Clear any pending quiz auto-navigation timer when user switches views
  if (window.__autoNavTimer) {
    clearTimeout(window.__autoNavTimer);
    window.__autoNavTimer = null;
  }

  currentView = viewName;
  setView(viewName);
  
  // Render view content — each wrapped with existence check
  if (viewName === 'dashboard') {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'renderDashboard() not found');
  }
  if (viewName === 'learn') {
    if (typeof window.__learnScreen !== 'undefined' && window.__learnScreen.render) {
      window.__learnScreen.render();
    }
    if (typeof updateReviewBanner === 'function') updateReviewBanner();
    if (typeof updateLessonProgressDisplay === 'function') updateLessonProgressDisplay();
  }
  if (viewName === 'quiz') {
    if (typeof initQuiz === 'function') initQuiz();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'initQuiz() not found');
  }
  if (viewName === 'list') {
    if (typeof renderWordList === 'function') renderWordList();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'renderWordList() not found');
  }
  if (viewName === 'stats') {
    if (typeof renderStats === 'function') renderStats();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'renderStats() not found');
  }
  if (viewName === 'profile') {
    if (window.__profileUI && typeof window.__profileUI.renderFullProfile === 'function') {
      window.__profileUI.renderFullProfile();
    } else if (typeof renderProfileView === 'function') {
      renderProfileView();
    } else if (window.__diag) {
      window.__diag.warn('App', 'switchView', 'renderProfileView() not found');
    }
  }
  if (viewName === 'explorer') {
    if (typeof renderExplorer === 'function') renderExplorer();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'renderExplorer() not found');
  }
  if (viewName === 'analytics') {
    if (typeof renderAnalytics === 'function') renderAnalytics();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'renderAnalytics() not found');
  }
  if (viewName === 'reader') {
    if (typeof renderReader === 'function') renderReader();
    else if (window.__diag) window.__diag.warn('App', 'switchView', 'renderReader() not found');
  }
  if (document.activeElement) document.activeElement.blur();
}

// ── Lesson Navigation Helpers ──────────────────────────────────

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

/** Navigate to a specific surah. Optional wordIndex to jump to a specific word. */
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

/** Navigate to a specific standard lesson. */
function goToLesson(lessonIndex, wordIndex) {
  if (lessonIndex < 0 || lessonIndex >= getLessonCount()) return;
  if (getOrganizationMode() !== 'lesson') {
    setOrganizationMode('lesson');
    setActiveSurahId(null);
  }
  if (!isLessonUnlocked(lessonIndex) && lessonIndex !== activeLessonIndex) {
    return;
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

// ── Learning Path Navigation Functions ─────────────────────────

/** Navigate to a root family for study. */
function goToRootFamily(rootKey) {
  if (!rootKey) {
    var families = typeof getRootFamilyLessons === 'function' ? getRootFamilyLessons() : [];
    if (families.length === 0) return;
    rootKey = families[0].root;
  }
  setOrganizationMode('root-family');
  setActiveSurahId(null);
  
  if (typeof setCurrentRootFamily === 'function') {
    setCurrentRootFamily(rootKey);
  }
  
  var rootFamilyWords = typeof getRootFamilyWords === 'function' ? getRootFamilyWords(rootKey) : [];
  activeLessonIndex = 0;
  currentWord = 0;
  reviewMode = false;
  switchView('learn');
  updateWordCard();
  updateLessonProgressDisplay();
}

/** Navigate to a difficulty level for study. */
function goToDifficultyLevel(level) {
  if (!level || level < 1) level = 1;
  if (level > 5) level = 5;
  
  setOrganizationMode('difficulty');
  setActiveSurahId(null);
  
  if (typeof setCurrentDifficulty === 'function') {
    setCurrentDifficulty(level);
  }
  
  activeLessonIndex = level - 1; // Use 0-based index
  currentWord = 0;
  reviewMode = false;
  switchView('learn');
  updateWordCard();
  updateLessonProgressDisplay();
}

/** Navigate to the dashboard view. */
function goToDashboard() {
  switchView('dashboard');
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

// ── Surah Coverage Validation ──────────────────────────────────

/**
 * Validate that the loaded vocabulary covers enough surahs.
 * Warns in the console if coverage seems incomplete.
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
      '. Check that the corresponding words-surah-NN-*.js files exist and have surahId set.');
  }

  window.__DEV__ && console.log('[app] ✓ Vocabulary coverage: ' + ALL_WORDS.length + ' words across ' +
    surahIds.length + ' surahs (1-' + maxSurah + ').');
}

// ── Online Sync Setup ──────────────────────────────────────────

/**
 * Auto-sync pending changes when coming back online.
 */
function setupOnlineSync() {
  window.addEventListener('online', function () {
    var user = getCurrentUser();
    if (user && window.__sync) {
      if (window.__sync.hasPending && window.__sync.hasPending()) {
        window.__DEV__ && console.log('[app] Back online — syncing pending changes...');
        window.__sync.fullSync(user.uid);
      }
    }
  });
}
