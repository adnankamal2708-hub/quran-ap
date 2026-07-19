// ═══════════════════════════════════════════════════════════════
// app.js — Main Application Module
// State management, event wiring, initialization.
// Loaded LAST after all services, data, and UI modules.
// ═══════════════════════════════════════════════════════════════

// Production flag - set to false to suppress debug logging
window.__DEV__ && console.log('[startup] [0] app.js bundle executing — top-level code runs');

// Build lessons from ALL_WORDS (called once after data files populate)
buildLessons();


// ── State ──────────────────────────────────────────────────────

let currentWord = 0;
let reviewMode = false;
let reviewQueue = [];
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
  // If in root family mode
  if (getOrganizationMode() === 'root-family') {
    var rfWords = typeof getActiveRootFamilyWords === 'function' ? getActiveRootFamilyWords() : [];
    return rfWords;
  }
  // If in difficulty mode
  if (getOrganizationMode() === 'difficulty') {
    var diffWords = typeof getActiveDifficultyWords === 'function' ? getActiveDifficultyWords() : [];
    return diffWords;
  }
  return getLessonWords(activeLessonIndex);
}

/** Get the word count for the currently active lesson/surah */
function getActiveLessonWordCount() {
  var words = getActiveLessonWords();
  return words ? words.length : 0;
}

/** Get the current word being displayed (from review queue, lesson, or surah). */
function getCurrentWord() {
  if (reviewMode) return reviewQueue[currentWord];
  var words = getActiveLessonWords();
  if (!words || words.length === 0) return null;
  if (currentWord >= words.length) currentWord = 0;
  return words[currentWord];
}

// ── View Switching ─────────────────────────────────────────────


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

  var btnNext = document.getElementById('btn-next');
  if (btnNext) {
    btnNext.onclick = function () {
      if (currentWord < total - 1) {
        nextWord();
      } else if (reviewMode) {
        endReview();
      } else {
        switchView('quiz');
      }
    };
  }

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

  if (window.__analytics && window.__analytics.recordDailySnapshot) {
    window.__analytics.recordDailySnapshot();
  }
  if (window.__analytics && window.__analytics.checkAchievements) {
    window.__analytics.checkAchievements();
  }

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
  
  // Compute coverage once and reuse across all mode sections to avoid repeated calculations
  var $_coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var $_currentComp = $_coverage ? $_coverage.estimatedComprehension : 0;
  var $_masteredWords = $_coverage ? $_coverage.masteredWords : 0;
  var $_totalWords = $_coverage ? $_coverage.totalWords : 0;
  
  // ── Foundation Course Mode ──
  if (getOrganizationMode() === FOUNDATION_MODE) {
    var fTotal = getFoundationLessonCount();
    var fCompleted = getCompletedFoundationLessonCount();
    var fCurrent = activeLessonIndex + 1;
    var isReview = FOUNDATION_LESSONS[activeLessonIndex] && FOUNDATION_LESSONS[activeLessonIndex].isReview;

    var fLesson = FOUNDATION_LESSONS[activeLessonIndex];
    var fCtx = typeof getFoundationLessonContextMsg === 'function' ? getFoundationLessonContextMsg(activeLessonIndex) : { title: '', context: '', comprehensionGain: '', cumulativeMsg: '' };
    var $coverage = $_coverage;
    var $currentComp = $_currentComp;

    if (lessonLabel) {
      // Minimal header: learning path + lesson title only
      var thematicTitle = fCtx.title || (isReview ? 'Review ' + fCurrent : 'Foundation ' + fCurrent);
      lessonLabel.innerHTML = '<div class="ai-title-gold">Foundation \u2022 Lesson ' + fCurrent + ' \u2014 ' + thematicTitle + '</div>';
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

    // R2: "What This Unlocks" — educational section explaining what becomes easier after mastery
    var unlocksEl = DOM.get('foundation-unlocks');
    if (unlocksEl) {
      var $words = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(activeLessonIndex) : [];
      var $rootSet = {};
      var $verbCount = 0, $nounCount = 0;
      for (var $ui = 0; $ui < $words.length; $ui++) {
        if ($words[$ui].root && $words[$ui].root !== '\u2014') $rootSet[$words[$ui].root] = true;
        if ($words[$ui].typeCategory === 'verb') $verbCount++;
        else if ($words[$ui].typeCategory === 'noun' || $words[$ui].typeCategory === 'adjective') $nounCount++;
      }
      var $rootCount = Object.keys($rootSet).length;
      var $sentenceTypes = fLesson && fLesson.cumulativeCoverageNum && fLesson.cumulativeCoverageNum > 30 ? ['basic sentence structures', 'frequent verb forms', 'common prepositions'] : ['common Quranic phrases', 'frequent word patterns', 'basic sentence flow'];
      
      unlocksEl.innerHTML = '<div class="foundation-unlock-section">' +
        '<h3 class="foundation-unlock-title">🔓 After this lesson you will:</h3>' +
        '<div class="foundation-unlock-items">' +
        '<span class="db-inline-green ai-unlock-item">✓ Recognize ' + $nounCount + ' noun' + ($nounCount !== 1 ? 's' : '') + ' and ' + $verbCount + ' verb' + ($verbCount !== 1 ? 's' : '') + ' common in the Quran</span>' +
        '<span class="db-inline-green ai-unlock-item">✓ Understand words from ' + $rootCount + ' root famil' + ($rootCount !== 1 ? 'ies' : 'y') + '</span>' +
        '<span class="db-inline-green ai-unlock-item">✓ Improve understanding of ' + $sentenceTypes.join(', ') + '</span>' +
        (fLesson && fLesson.comprehensionGain > 0 ? '<span class="ai-unlock-gold-dim">📈 Estimated comprehension gain: +' + fLesson.comprehensionGain + '%</span>' : '') +
        '</div></div>';
      unlocksEl.style.display = 'block';
    }

    // R3: Remaining Journey — progress bar with key metrics
    var journeyEl = DOM.get('foundation-journey');
    if (journeyEl) {
      var $totalWords = $coverage ? $coverage.totalWords : 0;
      var $masteredWords = $coverage ? $coverage.masteredWords : 0;
      var $allSurahComp = typeof getAllSurahComprehension === 'function' ? getAllSurahComprehension() : [];
      var $surahsWith50Plus = $allSurahComp.filter(function($s) { return $s.estimatedComprehension >= 50; }).length;
      var $surahsTotal = $allSurahComp.length;
      
      var $remainingBar = Math.round((($currentComp || 0) / 100) * 24);
      // Create a simple visual progress representation
      journeyEl.innerHTML = '<div class="foundation-journey-section">' +
        '<h4 class="db-inline-value-sm ai-journey-title">🗺️ Your Journey</h4>' +
        '<div class="db-progress">' +
        '<div class="db-progress-track">' +
        '<div class="db-progress-fill" style="height:6px;width:' + (fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0) + '%;background:var(--gold);border-radius:3px"></div></div>' +
        '<span class="db-progress-text">Foundation: ' + fCompleted + ' / ' + fTotal + ' lessons</span>' +
        '</div>' +
        '<div class="ai-journey-grid">' +
        '<div class="db-inline-center"><div class="ai-value-md">' + ($currentComp || 0).toFixed(1) + '%</div><div class="db-inline-text-xs">Comprehension</div></div>' +
        '<div class="db-inline-center"><div class="ai-value-md ai-c-green">' + $masteredWords + '</div><div class="db-inline-text-xs">Words</div></div>' +
        '<div class="db-inline-center"><div class="ai-value-md ai-c-blue">' + $surahsWith50Plus + '/' + $surahsTotal + '</div><div class="db-inline-text-xs">Surahs (50%+)</div></div>' +
        '</div></div>';
      journeyEl.style.display = 'block';
    }

    // Update foundation-specific lesson coverage display
    var foundationCoverageEl = DOM.get('foundation-coverage');
    if (foundationCoverageEl && fLesson) {
      var compMsg = fCtx.comprehensionGain ? ' · ' + fCtx.comprehensionGain : '';
      var contextMsg = fCtx.context ? '<div class="ai-cov-msg">' + fCtx.context + '</div>' : '';
      foundationCoverageEl.innerHTML = '<div class="ai-cov-title">' + fCtx.title + compMsg + '</div>' +
        '<div class="ai-cov-sub">' + fLesson.lessonCoverage + ' of Quranic vocabulary · Cumulative: ' + fLesson.cumulativeCoverage + '</div>' +
        contextMsg;
      foundationCoverageEl.style.display = 'block';
    }

    // Show foundation lesson relationship context (root families, related words) — collapsible accordion
    if (typeof getFoundationLessonRelationshipContext === 'function') {
      var fCtx = getFoundationLessonRelationshipContext(activeLessonIndex);
      if (fCtx && fCtx.rootFamilies && fCtx.rootFamilies.length > 0) {
        var fRelCtx = DOM.get('foundation-relationship-context');
        if (fRelCtx) {
          var ctxHtml = '<div class="foundation-accordion">';
          
          // Root families section (always expanded)
          ctxHtml += '<div class="foundation-acc-section foundation-acc-expanded">';
          ctxHtml += '<button class="foundation-acc-header" onclick="var s=this.closest(\'.foundation-acc-section\');s.classList.toggle(\'foundation-acc-expanded\');this.setAttribute(\'aria-expanded\',s.classList.contains(\'foundation-acc-expanded\'))" type="button" aria-expanded="true">';
          ctxHtml += '<span>🌱 Root families in this lesson</span><span class="foundation-acc-arrow">▼</span>';
          ctxHtml += '</button>';
          ctxHtml += '<div class="foundation-acc-body">';
          ctxHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
          for (var rfi = 0; rfi < fCtx.rootFamilies.length; rfi++) {
            var rf = fCtx.rootFamilies[rfi];
            ctxHtml += '<span class="ai-chip-root">' + rf.root + ' <span class="ai-chip-sub">(' + rf.rootMeaning + ')</span></span>';
          }
          ctxHtml += '</div>';
          // Already learned related
          if (fCtx.alreadyLearnedRelated && fCtx.alreadyLearnedRelated.length > 0) {
            ctxHtml += '<div class="ai-chip-al-title">✓ Already learned:</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">';
            for (var ali = 0; ali < fCtx.alreadyLearnedRelated.length; ali++) {
              var al = fCtx.alreadyLearnedRelated[ali];
              ctxHtml += '<span class="ai-chip-al">' + al.arabic + ' <span class="ai-chip-sub">(' + al.english + ')</span></span>';
            }
            ctxHtml += '</div>';
          }
          // Upcoming related
          if (fCtx.upcomingRelated && fCtx.upcomingRelated.length > 0) {
            ctxHtml += '<div class="ai-chip-up-title">Related words coming in future lessons:</div><div style="display:flex;flex-wrap:wrap;gap:4px">';
            for (var upi = 0; upi < fCtx.upcomingRelated.length; upi++) {
              var up = fCtx.upcomingRelated[upi];
              ctxHtml += '<span class="ai-chip-up">' + up.arabic + ' <span class="ai-chip-sub">(' + up.english + ') - Lesson ' + (up.lessonId + 1) + '</span></span>';
            }
            ctxHtml += '</div>';
          }
          ctxHtml += '</div></div>'; // end root families section
          
          // Grammar notes section (collapsed by default)
          ctxHtml += '<div class="foundation-acc-section">';
          ctxHtml += '<button class="foundation-acc-header" onclick="var s=this.closest(\'.foundation-acc-section\');s.classList.toggle(\'foundation-acc-expanded\');this.setAttribute(\'aria-expanded\',s.classList.contains(\'foundation-acc-expanded\'))" type="button" aria-expanded="false">';
          ctxHtml += '<span>📝 Grammar notes</span><span class="foundation-acc-arrow"><svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>';
          ctxHtml += '</button>';
          ctxHtml += '<div class="foundation-acc-body">';
          ctxHtml += '<div class="ai-acc-body">Focus on the root letters and their core meaning. Notice how different patterns (wazn) modify the meaning. Pay attention to how this word functions in its ayah context.</div>';
          ctxHtml += '</div></div>';
          
          // Learning tips section (collapsed by default)
          ctxHtml += '<div class="foundation-acc-section">';
          ctxHtml += '<button class="foundation-acc-header" onclick="var s=this.closest(\'.foundation-acc-section\');s.classList.toggle(\'foundation-acc-expanded\');this.setAttribute(\'aria-expanded\',s.classList.contains(\'foundation-acc-expanded\'))" type="button" aria-expanded="false">';
          ctxHtml += '<span>💡 Learning tips</span><span class="foundation-acc-arrow"><svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>';
          ctxHtml += '</button>';
          ctxHtml += '<div class="foundation-acc-body">';
          ctxHtml += '<div class="ai-acc-body">Review the root family words together to see patterns. Try to recognize this word when you see it in Quranic verses. Consistent daily review is more effective than cramming.</div>';
          ctxHtml += '</div></div>';
          
          ctxHtml += '</div>'; // end accordion
          fRelCtx.innerHTML = ctxHtml;
          fRelCtx.style.display = 'block';
          // Show the parent collapsible section wrapper for root families
          var fRelCollapsible = DOM.get('ls-collapsible-root-meta');
          if (fRelCollapsible) fRelCollapsible.style.display = 'block';
        }
      }
    }

    var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
      var nextIncomplete = getNextIncompleteFoundationLesson();
      var nextLessonCtx = (nextIncomplete < fTotal && typeof getFoundationLessonContextMsg === 'function') 
        ? getFoundationLessonContextMsg(nextIncomplete) : { title: '' };
      var nextTitle = nextLessonCtx.title ? ' \u2014 ' + nextLessonCtx.title : '';
      if (nextIncomplete === 0 && isFoundationLessonCompleted(0) && fTotal > 0) {
        continueBtn.textContent = '🎉 Foundation Complete!';
        continueBtn.disabled = true;
      } else if (nextIncomplete === activeLessonIndex) {
        continueBtn.textContent = '📖 Foundation ' + (nextIncomplete + 1) + nextTitle;
        continueBtn.disabled = false;
      } else if (isFoundationLessonCompleted(activeLessonIndex) && nextIncomplete < fTotal) {
        continueBtn.textContent = '🔓 Unlock Foundation ' + (nextIncomplete + 1) + nextTitle;
        continueBtn.disabled = false;
      } else {
        continueBtn.textContent = '📖 Continue Foundation ' + (nextIncomplete + 1);
        continueBtn.disabled = false;
      }
    }
    return;
  }
  
  if (getOrganizationMode() === 'root-family') {
    // Root Family mode display
    var rfFamilies = typeof getRootFamilyLessons === 'function' ? getRootFamilyLessons() : [];
    var rfProgress = typeof loadRootFamilyProgress === 'function' ? loadRootFamilyProgress() : null;
    var currentRoot = rfProgress ? rfProgress.currentRoot : '';
    var rfCompleted = typeof getCompletedRootFamilyCount === 'function' ? getCompletedRootFamilyCount() : 0;
    var rfTotal = typeof getTotalRootFamilyCount === 'function' ? getTotalRootFamilyCount() : 0;
    
    // Find current family info
    var currentFamily = null;
    for (var rfi = 0; rfi < rfFamilies.length; rfi++) {
      if (rfFamilies[rfi].root === currentRoot) {
        currentFamily = rfFamilies[rfi];
        break;
      }
    }
    
    if (lessonLabel && currentFamily) {
      lessonLabel.innerHTML = '<div class="ai-title-gold">Root Family \u2022 ' + currentFamily.root + ' <span class="db-inline-text-sm">(' + (currentFamily.rootMeaning || '') + ')</span></div>';
    } else if (lessonLabel) {
      lessonLabel.innerHTML = '<div class="ai-title-gold">Root Family Learning</div>';
    }
    
    var lessonProgress = DOM.get('lesson-progress');
    if (lessonProgress) {
      var rfPct = rfTotal > 0 ? Math.round((rfCompleted / rfTotal) * 100) : 0;
      lessonProgress.style.width = rfPct + '%';
    }
    
    var lessonProgressText = DOM.get('lesson-progress-text');
    if (lessonProgressText) {
      lessonProgressText.textContent = rfCompleted + ' of ' + rfTotal + ' root families complete';
    }
    
    var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
      var nextRF = typeof getNextIncompleteRootFamily === 'function' ? getNextIncompleteRootFamily() : '';
      if (nextRF) {
        continueBtn.textContent = '\uD83C\uDF31 Next Root Family';
        continueBtn.disabled = false;
      } else {
        continueBtn.textContent = '\uD83C\uDF89 All Root Families Complete!';
        continueBtn.disabled = true;
      }
    }
    
    // Hide foundation-specific elements
    var foundationCoverageEl = DOM.get('foundation-coverage');
    if (foundationCoverageEl) foundationCoverageEl.style.display = 'none';
    var rootMetaCollapsible = DOM.get('ls-collapsible-root-meta');
    if (rootMetaCollapsible) rootMetaCollapsible.style.display = 'none';
    return;
  }
  
  if (getOrganizationMode() === 'difficulty') {
    // Difficulty mode display
    var dLevel = typeof loadDifficultyProgress === 'function' ? loadDifficultyProgress().currentDifficulty : 1;
    var dCompleted = typeof getCompletedDifficultyLevelCount === 'function' ? getCompletedDifficultyLevelCount() : 0;
    
    if (lessonLabel) {
      lessonLabel.innerHTML = '<div class="ai-title-gold">Difficulty \u2022 Level ' + dLevel + '</div>';
    }
    
    var lessonProgress = DOM.get('lesson-progress');
    if (lessonProgress) {
      var dPct = Math.round((dCompleted / 5) * 100);
      lessonProgress.style.width = dPct + '%';
    }
    
    var lessonProgressText = DOM.get('lesson-progress-text');
    if (lessonProgressText) {
      lessonProgressText.textContent = dCompleted + ' of 5 difficulty levels complete';
    }
    
    var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
      var nextD = typeof getNextIncompleteDifficultyLevel === 'function' ? getNextIncompleteDifficultyLevel() : 1;
      if (dCompleted >= 5) {
        continueBtn.textContent = '\uD83C\uDF89 All Levels Complete!';
        continueBtn.disabled = true;
      } else if (nextD !== dLevel) {
        continueBtn.textContent = '\uD83D\uDCE8 Continue Level ' + nextD;
        continueBtn.disabled = false;
      } else {
        continueBtn.textContent = '\uD83D\uDCE8 Study Level ' + dLevel;
        continueBtn.disabled = false;
      }
    }
    
    var foundationCoverageEl = DOM.get('foundation-coverage');
    if (foundationCoverageEl) foundationCoverageEl.style.display = 'none';
    var rootMetaCollapsible = DOM.get('ls-collapsible-root-meta');
    if (rootMetaCollapsible) rootMetaCollapsible.style.display = 'none';
    return;
  }
  
  if (getOrganizationMode() === 'surah') {
    // ── Surah Mode Enhanced Display ──
    var surahId = getActiveSurahId();
    var surahInfo = getSurahInfo(surahId);
    var surahIds = getSurahsWithVocabulary();
    var curIdx = surahIds.indexOf(surahId);
    
    // Get surah comprehension data for the current surah
    var surahComp = typeof getSurahComprehension === 'function' ? getSurahComprehension(surahId) : null;
    var surahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];
    
    // Calculate word type distribution for this surah
    var surahNouns = 0, surahVerbs = 0, surahParticles = 0;
    for (var swi = 0; swi < surahWords.length; swi++) {
      var sw = surahWords[swi];
      if (sw.typeCategory === 'noun' || sw.typeCategory === 'adjective' || sw.typeCategory === 'proper noun') surahNouns++;
      else if (sw.typeCategory === 'verb') surahVerbs++;
      else if (sw.typeCategory === 'particle' || sw.typeCategory === 'pronoun') surahParticles++;
    }
    
    // Calculate occurrence coverage for this surah
    var surahTotalOcc = 0;
    for (var sii = 0; sii < surahWords.length; sii++) surahTotalOcc += surahWords[sii].occ || 0;
    
    // R1: Enhanced lesson header for surah mode
    if (lessonLabel && surahInfo) {
      lessonLabel.innerHTML = '<div class="ai-title-gold">Surah \u2014 ' + surahInfo.name + ' (' + surahInfo.english + ')' + 
        (surahInfo.verses ? ' <span class="db-inline-text-sm">\u00B7 ' + surahInfo.verses + ' verses</span>' : '') + '</div>';
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

    var foundationCoverageEl = DOM.get('foundation-coverage');
    if (foundationCoverageEl) foundationCoverageEl.style.display = 'none';
    var rootMetaCollapsible = DOM.get('ls-collapsible-root-meta');
    if (rootMetaCollapsible) rootMetaCollapsible.style.display = 'none';

    // R2: "What This Unlocks" for surah mode
    var unlocksEl = DOM.get('foundation-unlocks');
    if (unlocksEl) {
      // Count unique roots in this surah
      var surahRootSet = {};
      for (var sri = 0; sri < surahWords.length; sri++) {
        if (surahWords[sri].root && surahWords[sri].root !== '\u2014') surahRootSet[surahWords[sri].root] = true;
      }
      var surahRootCount = Object.keys(surahRootSet).length;
      
      unlocksEl.innerHTML = '<div class="foundation-unlock-section">' +
        '<h3 class="foundation-unlock-title">\uD83D\uDD13 Studying this surah helps you:</h3>' +
        '<div class="foundation-unlock-items">' +
        '<span class="db-inline-green ai-unlock-item">\u2713 Recognize ' + surahNouns + ' noun' + (surahNouns !== 1 ? 's' : '') + 
        ', ' + surahVerbs + ' verb' + (surahVerbs !== 1 ? 's' : '') + 
        ', and ' + surahParticles + ' particle' + (surahParticles !== 1 ? 's' : '') + ' specific to this surah</span>' +
        '<span class="db-inline-green ai-unlock-item">\u2713 Learn words from ' + surahRootCount + ' root famil' + (surahRootCount !== 1 ? 'ies' : 'y') + ' used in this surah\'s context</span>' +
        (surahCompPct > 0 
          ? '<span class="ai-unlock-gold-dim">\uD83D\uDCC8 Current understanding of this surah: ' + surahCompPct + '%</span>'
          : '<span class="db-inline-text-sm">\uD83D\uDCC8 Master words in this surah to understand it at a deeper level</span>') +
        '</div></div>';
      unlocksEl.style.display = 'block';
    }

    // R3: Remaining Journey for surah mode
    var journeyEl = DOM.get('foundation-journey');
    if (journeyEl) {
      var $coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
      var $currentComp = $coverage ? $coverage.estimatedComprehension : 0;
      var $masteredWords = $coverage ? $coverage.masteredWords : 0;
      var $totalWords = $coverage ? $coverage.totalWords : 0;
      
      journeyEl.innerHTML = '<div class="foundation-journey-section">' +
        '<h4 class="db-inline-value-sm ai-journey-title">\uD83D\uDDFA\uFE0F Your Journey</h4>' +
        '<div class="db-progress">' +
        '<div class="db-progress-track">' +
        '<div class="db-progress-fill" style="height:6px;width:' + pct + '%;background:var(--blue);border-radius:3px"></div></div>' +
        '<span class="db-progress-text">Surahs: ' + completed + ' / ' + surahIds.length + '</span>' +
        '</div>' +
        '<div class="ai-journey-grid">' +
        '<div class="db-inline-center"><div class="ai-value-md">' + ($currentComp || 0).toFixed(1) + '%</div><div class="db-inline-text-xs">Comprehension</div></div>' +
        '<div class="db-inline-center"><div class="ai-value-md ai-c-green">' + $masteredWords + '</div><div class="db-inline-text-xs">Words</div></div>' +
        '<div class="db-inline-center"><div class="ai-value-md ai-c-blue">' + (surahCompPct || 0) + '%</div><div class="db-inline-text-xs">This Surah</div></div>' +
        '</div></div>';
      journeyEl.style.display = 'block';
    }

    var continueBtn = DOM.get('continue-learning-btn');
    if (continueBtn) {
      if (completed >= surahIds.length) {
        continueBtn.textContent = '\uD83C\uDF89 All Surahs Complete!';
        continueBtn.disabled = true;
      } else {
        var nextIncomplete = -1;
        for (var si = 0; si < surahIds.length; si++) {
          if (!isSurahCompleted(surahIds[si])) { nextIncomplete = si; break; }
        }
        if (nextIncomplete >= 0) {
          var nextSurahName = typeof getSurahNameSimple === 'function' ? getSurahNameSimple(surahIds[nextIncomplete]) : 'Surah ' + surahIds[nextIncomplete];
          continueBtn.textContent = '\uD83D\uDCD6 Continue ' + nextSurahName;
          continueBtn.disabled = false;
        }
      }
    }
    return;
  }
  
  // ── Lesson Mode Enhanced Display ──
  var total = getLessonCount();
  var completed = getCompletedLessonCount();
  var current = activeLessonIndex + 1;

  // Get lesson words for this lesson
  var lessonWords = getLessonWords(activeLessonIndex);
  
  // Calculate word type distribution
  var lessonNouns = 0, lessonVerbs = 0, lessonParticles = 0;
  for (var lwi = 0; lwi < lessonWords.length; lwi++) {
    var lw = lessonWords[lwi];
    if (lw.typeCategory === 'noun' || lw.typeCategory === 'adjective' || lw.typeCategory === 'proper noun') lessonNouns++;
    else if (lw.typeCategory === 'verb') lessonVerbs++;
    else if (lw.typeCategory === 'particle' || lw.typeCategory === 'pronoun') lessonParticles++;
  }
  
  // Calculate occurrence coverage for this lesson
  var lessonTotalOcc = 0;
  for (var loi = 0; loi < lessonWords.length; loi++) lessonTotalOcc += lessonWords[loi].occ || 0;
  var grandTotalOcc = typeof getTotalQuranOccurrences === 'function' ? getTotalQuranOccurrences() : 0;
  var lessonCoveragePct = grandTotalOcc > 0 ? (lessonTotalOcc / grandTotalOcc * 100) : 0;
  
  // Calculate unique roots
  var lessonRootSet = {};
  for (var lri = 0; lri < lessonWords.length; lri++) {
    if (lessonWords[lri].root && lessonWords[lri].root !== '\u2014') lessonRootSet[lessonWords[lri].root] = true;
  }
  var lessonRootCount = Object.keys(lessonRootSet).length;      // Get overall coverage for comprehension context (reuse cached from top of function)
  var $coverage = $_coverage;
  var $currentComp = $_currentComp;
  var $masteredWords = $_masteredWords;
  var $totalWords = $_totalWords;
  
  var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // R1: Enhanced lesson header for standard lesson mode
  if (lessonLabel) {
    lessonLabel.innerHTML = '<div class="ai-title-gold">Lesson ' + current + ' \u2014 Sequential Vocabulary</div>';
  }

  var lessonProgress = DOM.get('lesson-progress');
  if (lessonProgress) {
    lessonProgress.style.width = pct + '%';
  }

  var lessonProgressText = DOM.get('lesson-progress-text');
  if (lessonProgressText) {
    lessonProgressText.textContent = completed + ' of ' + total + ' lessons complete \u00B7 ~' + ($currentComp || 0).toFixed(1) + '% comprehension';
  }

  // Hide foundation-specific elements when in lesson mode
  var foundationCoverageEl = DOM.get('foundation-coverage');
  if (foundationCoverageEl) foundationCoverageEl.style.display = 'none';
  var foundationPrimaryCovEl = DOM.get('foundation-primary-coverage');
  if (foundationPrimaryCovEl) foundationPrimaryCovEl.style.display = 'none';
  var foundationRelCtxEl = DOM.get('foundation-relationship-context');
  if (foundationRelCtxEl) foundationRelCtxEl.style.display = 'none';
  var rootMetaCollapsible = DOM.get('ls-collapsible-root-meta');
  if (rootMetaCollapsible) rootMetaCollapsible.style.display = 'none';

  // R2: "What This Unlocks" for standard lesson mode
  var unlocksEl = DOM.get('foundation-unlocks');
  if (unlocksEl) {
    unlocksEl.innerHTML = '<div class="foundation-unlock-section">' +
      '<h3 class="foundation-unlock-title">\uD83D\uDD13 What you will learn in this lesson:</h3>' +
      '<div class="foundation-unlock-items">' +
      '<span class="db-inline-green ai-unlock-item">\u2713 Practice ' + lessonNouns + ' noun' + (lessonNouns !== 1 ? 's' : '') + 
      ', ' + lessonVerbs + ' verb' + (lessonVerbs !== 1 ? 's' : '') + 
      ', and ' + lessonParticles + ' particle' + (lessonParticles !== 1 ? 's' : '') + '</span>' +
      '<span class="db-inline-green ai-unlock-item">\u2713 Explore ' + lessonRootCount + ' root famil' + (lessonRootCount !== 1 ? 'ies' : 'y') + ' to see word patterns</span>' +
      (lessonCoveragePct > 0 
        ? '<span class="ai-unlock-gold-dim">\uD83D\uDCC8 These words appear ~' + lessonTotalOcc + ' times in the Quran</span>'
        : '') +
      '</div></div>';
    unlocksEl.style.display = 'block';
  }
  
  // R3: Remaining Journey for standard lesson mode
  var journeyEl = DOM.get('foundation-journey');
  if (journeyEl) {
    var allSurahComp = typeof getAllSurahComprehension === 'function' ? getAllSurahComprehension() : [];
    var surahsWith50Plus = allSurahComp.filter(function($s) { return $s.estimatedComprehension >= 50; }).length;
    var surahsTotal = allSurahComp.length;
    
    journeyEl.innerHTML = '<div class="foundation-journey-section">' +
      '<h4 class="db-inline-value-sm ai-journey-title">\uD83D\uDDFA\uFE0F Your Journey</h4>' +
      '<div class="db-progress">' +
      '<div class="db-progress-track">' +
      '<div class="db-progress-fill" style="height:6px;width:' + pct + '%;background:var(--gold);border-radius:3px"></div></div>' +
      '<span class="db-progress-text">Lessons: ' + completed + ' / ' + total + '</span>' +
      '</div>' +
      '<div class="ai-journey-grid">' +
      '<div class="db-inline-center"><div class="ai-value-md">' + ($currentComp || 0).toFixed(1) + '%</div><div class="db-inline-text-xs">Comprehension</div></div>' +
      '<div class="db-inline-center"><div class="ai-value-md ai-c-green">' + $masteredWords + '</div><div class="db-inline-text-xs">Words</div></div>' +
      '<div class="db-inline-center"><div class="ai-value-md ai-c-blue">' + surahsWith50Plus + '/' + surahsTotal + '</div><div class="db-inline-text-xs">Surahs (50%+)</div></div>' +
      '</div></div>';
    journeyEl.style.display = 'block';
  }

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
      btn.innerHTML = '<span class="qa-btn-icon">\u26A1</span> Quick: ON';
    } else {
      btn.classList.remove('active-qa');
      btn.innerHTML = '<span class="qa-btn-icon">\u26A1</span> Quick';
    }
  }
  // Scroll word card into view in quick mode
  if (quickMode) {
    var card = document.getElementById('word-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}


// ═══════════════════════════════════════════════════════════════
// PROACTIVE CROSS-LESSON REVIEW — Detects overdue reviews and
// encourages review before unlocking new content.
// ═══════════════════════════════════════════════════════════════

/**
 * Safely set onclick for an element. Returns the element or null.
 * Prevents Uncaught TypeError crashes when a DOM element is missing.
 */
function safeOnClick(id, fn) {
  var el = document.getElementById(id);
  if (el) el.onclick = fn;
  return el;
}

function wireEvents() {
  // Bottom nav tabs (5-tab layout: Dashboard, Paths, Words, Profile, Reader)
  safeOnClick('tab-dashboard', function () { switchView('dashboard'); });
  safeOnClick('tab-paths', function () { switchView('learn'); });
  safeOnClick('tab-list', function () { switchView('list'); });
  safeOnClick('tab-reader', function () { switchView('reader'); });
  safeOnClick('tab-profile', function () { switchView('profile'); });

  // Learn navigation
  safeOnClick('btn-prev', prevWord);

  // Quick actions
  safeOnClick('qa-show-ayah', function () {
    var w = getCurrentWord();
    if (w) showAyah(w);
  });
  safeOnClick('qa-show-more', function () {
    var w = getCurrentWord();
    if (w) showWordContent(w);
  });
  safeOnClick('qa-root-family', function() {
    var w = getCurrentWord();
    if (w && w.rootFamily && w.rootFamily.length > 0 && typeof openExplorer === 'function') {
      // Open the Vocabulary Explorer which has full root family navigation
      openExplorer(w);
    } else if (w) {
      // Fallback: scroll to root box if no root family data
      highlightRootBox();
    }
  });
  safeOnClick('qa-bookmark', toggleBookmark);

  // Tafsir button
  safeOnClick('tafsir-btn', function () {
    var w = getCurrentWord();
    if (w) loadTafsir(w);
  });

  // Notes (auto-save on blur)
  var notesInput = document.getElementById('notes-input');
  if (notesInput) notesInput.onblur = saveNote;

  // SRS rating
  safeOnClick('srs-again', function () { rateSRS(0); });
  safeOnClick('srs-hard', function () { rateSRS(1); });
  safeOnClick('srs-good', function () { rateSRS(2); });
  safeOnClick('srs-easy', function () { rateSRS(3); });

  // Quiz next button
  safeOnClick('btn-next-quiz', nextQuiz);

  // Review banner
  safeOnClick('review-start-btn', startReview);

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

  // Continue Learning button (works for all learning paths)
  safeOnClick('continue-learning-btn', function () {
    if (getOrganizationMode() === FOUNDATION_MODE) {
      var fNext = getNextIncompleteFoundationLesson();
      goToFoundationLesson(fNext);
    } else if (getOrganizationMode() === 'surah') {
      var surahIds = getSurahsWithVocabulary();
      for (var si = 0; si < surahIds.length; si++) {
        if (!isSurahCompleted(surahIds[si])) {
          goToSurah(surahIds[si]);
          return;
        }
      }
      goToSurah(surahIds[0] || 1);
    } else if (getOrganizationMode() === 'root-family') {
      var nextRFKey = typeof getNextIncompleteRootFamily === 'function' ? getNextIncompleteRootFamily() : '';
      if (nextRFKey) goToRootFamily(nextRFKey);
    } else if (getOrganizationMode() === 'difficulty') {
      var nextDLevel = typeof getNextIncompleteDifficultyLevel === 'function' ? getNextIncompleteDifficultyLevel() : 1;
      goToDifficultyLevel(nextDLevel);
    } else {
      continueLearning();
    }
  });

  // Quick mode toggle
  safeOnClick('qa-quick-mode', toggleQuickMode);

  // Onboarding revisit button
  safeOnClick('btn-revisit-onboarding', function() {
    if (window.__ux && window.__ux.showOnboarding) window.__ux.showOnboarding();
  });

  // Session summary close
  safeOnClick('session-summary-close', function () {
    closeSessionSummary();
    var wasMixed = window.__lastReviewWasMixed;
    window.__lastReviewWasMixed = false;
    if (wasMixed) {
      switchView('dashboard');
    } else {
      switchView('learn');
    }
    var wordCard = DOM.get('word-card');
    if (wordCard && typeof wordCard.focus === 'function') {
      wordCard.setAttribute('tabindex', '-1');
      wordCard.focus();
    }
  });

  // Lesson navigation
  safeOnClick('prev-lesson-btn', function () {
    if (getOrganizationMode() === FOUNDATION_MODE) {
      if (activeLessonIndex > 0) goToFoundationLesson(activeLessonIndex - 1);
    } else if (getOrganizationMode() === 'surah') {
      var surahIds = getSurahsWithVocabulary();
      var curIdx = surahIds.indexOf(getActiveSurahId());
      if (curIdx > 0) goToSurah(surahIds[curIdx - 1]);
    } else if (getOrganizationMode() === 'root-family') {
      var rfFamilies = typeof getRootFamilyLessons === 'function' ? getRootFamilyLessons() : [];
      var rfProgress = typeof loadRootFamilyProgress === 'function' ? loadRootFamilyProgress() : null;
      var currentRoot = rfProgress ? rfProgress.currentRoot : '';
      for (var rfi = 0; rfi < rfFamilies.length; rfi++) {
        if (rfFamilies[rfi].root === currentRoot && rfi > 0) {
          goToRootFamily(rfFamilies[rfi - 1].root);
          break;
        }
      }
    } else if (getOrganizationMode() === 'difficulty') {
      var dLevel = typeof loadDifficultyProgress === 'function' ? loadDifficultyProgress().currentDifficulty : 1;
      if (dLevel > 1) goToDifficultyLevel(dLevel - 1);
    } else if (activeLessonIndex > 0) {
      goToLesson(activeLessonIndex - 1);
    }
  });
  safeOnClick('next-lesson-btn', function () {
    if (getOrganizationMode() === FOUNDATION_MODE) {
      var fTotal = getFoundationLessonCount();
      var nextIdx = activeLessonIndex + 1;
      if (nextIdx < fTotal && isFoundationLessonUnlocked(nextIdx)) {
        goToFoundationLesson(nextIdx);
      }
    } else if (getOrganizationMode() === 'surah') {
      var surahIds = getSurahsWithVocabulary();
      var curIdx = surahIds.indexOf(getActiveSurahId());
      if (curIdx >= 0 && curIdx < surahIds.length - 1) goToSurah(surahIds[curIdx + 1]);
    } else if (getOrganizationMode() === 'root-family') {
      var rfFamilies = typeof getRootFamilyLessons === 'function' ? getRootFamilyLessons() : [];
      var rfProgress = typeof loadRootFamilyProgress === 'function' ? loadRootFamilyProgress() : null;
      var currentRoot = rfProgress ? rfProgress.currentRoot : '';
      for (var rfi = 0; rfi < rfFamilies.length; rfi++) {
        if (rfFamilies[rfi].root === currentRoot && rfi < rfFamilies.length - 1) {
          goToRootFamily(rfFamilies[rfi + 1].root);
          break;
        }
      }
    } else if (getOrganizationMode() === 'difficulty') {
      var dLevel = typeof loadDifficultyProgress === 'function' ? loadDifficultyProgress().currentDifficulty : 1;
      if (dLevel < 5) goToDifficultyLevel(dLevel + 1);
    } else {
      var nextIdx = activeLessonIndex + 1;
      if (nextIdx < getLessonCount() && isLessonUnlocked(nextIdx)) {
        goToLesson(nextIdx);
      }
    }
  });

  // Advanced Filter Toggle
  var filterToggle = DOM.get('advanced-filter-toggle');
  if (filterToggle) {
    filterToggle.onclick = function() {
      var panel = DOM.get('advanced-filter-panel');
      if (!panel) return;
      var isOpen = panel.style.display === 'block';
      panel.style.display = isOpen ? 'none' : 'block';
      filterToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      if (!isOpen) {
        populateFilterDropdowns();
      }
    };
  }

  // Filter Apply button
  safeOnClick('filter-apply', function() {
    renderWordList();
  });

  // Filter Clear button
  safeOnClick('filter-clear', function() {
    if (typeof clearAdvancedFilters === 'function') {
      clearAdvancedFilters();
    }
  });

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
        var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
        if (surahIds.length > 0) {
          goToSurah(surahIds[0]);
        }
      } else {
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
          window.__DEV__ && console.log('[validate] ℹ Word #' + i + ' (' + (w.id || 'no-id') + ') has verseKey surah ' + vSurah + ' but surahId is ' + w.surahId + ' (cross-surah reference, not an error)');
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
            window.__DEV__ && console.log('[validate] ℹ Word #' + i + ' (' + (w.id || 'no-id') + ') references non-vocabulary ' + refFields[ri] + ' word: \'' + refs[rj] + '\'');
          }
        }
      }
    }

    // 5c. Check rootFamily references exist (informational only)
    if (w.rootFamily && Array.isArray(w.rootFamily)) {
      for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
        var rfArabic = w.rootFamily[rfi].a;
        if (rfArabic && !arabicSet.has(rfArabic)) {
          window.__DEV__ && console.log('[validate] ℹ Word #' + i + ' (' + (w.id || 'no-id') + ') references non-vocabulary rootFamily word: \'' + rfArabic + '\'');
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
    window.__DEV__ && console.log('[validate] Legitimate duplicate Arabic words found (' + duplicateArabic.length + '):');
    duplicateArabic.forEach(function (info) { window.__DEV__ && console.log('  ℹ ' + info); });
  }

  window.__DEV__ && console.log('[validate] All ' + ALL_WORDS.length + ' words validated. ' +
    (errors.length === 0 ? '✓ No issues.' : errors.length + ' issue(s) found.'));

  return { valid: errors.length === 0, errors: errors, arabicDuplicates: duplicateArabic };
}

// ── Startup Fallback ──────────────────────────────────────────
// If init() fails or something goes wrong, this ensures the user
// never sees a completely blank screen. Renders a meaningful error
// with a reload button.

/** @type {number|null} Startup watchdog timer ID — module-scoped to avoid global pollution */
let _startupFallbackTimer = null;

/** Render a fallback UI if the dashboard can't load */
function renderFallbackUI() {
  var dashboardGrid = document.getElementById('dashboard-grid');
  if (!dashboardGrid) return;
  dashboardGrid.innerHTML = '' +
    '<div class="ai-fb-wrap">' +
      '<div class="ai-fb-icon">📖</div>' +
      '<h2 class="ai-fb-title">Welcome to Bayan</h2>' +
      '<p class="ai-fb-text">' +
        'Your Quran vocabulary learning app is loading. Please wait or try refreshing.' +
      '</p>' +
      '<button class="btn" onclick="window.location.reload()" style="margin-bottom:8px">' +
        '↻ Reload' +
      '</button>' +
      '<div class="ai-fb-version">' +
        'Bayan v2.0' +
      '</div>' +
    '</div>';
}

/** Startup watchdog: detects if init() hung or failed to render */
function startStartupWatchdog() {
  _startupFallbackTimer = setTimeout(function() {
    // Don't trigger fallback if vocabulary data hasn't loaded yet (slow connection)
    if (typeof ALL_WORDS === 'undefined' || !ALL_WORDS || ALL_WORDS.length === 0) {
      return;
    }
    // Check if the dashboard has any rendered content
    var grid = document.getElementById('dashboard-grid');
    if (grid && grid.children.length === 0) {
      console.warn('[startup] Watchdog triggered — dashboard not rendered, showing fallback');
      renderFallbackUI();
    }
    // Check if NO view is active (all views hidden)
    var anyActive = document.querySelector('.mode-view.active');
    if (!anyActive) {
      console.warn('[startup] Watchdog triggered — no active view found');
      var dashboardView = document.getElementById('view-dashboard');
      if (dashboardView) dashboardView.classList.add('active');
      renderFallbackUI();
    }
  }, 15000); // 15 seconds — accommodates slow 3G connections for ~1.6MB bundles
}

function cancelStartupWatchdog() {
  if (_startupFallbackTimer) {
    clearTimeout(_startupFallbackTimer);
    _startupFallbackTimer = null;
  }
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
  window.__DEV__ && console.log('[startup] [1] init() called');

  // ── Start watchdog BEFORE try block ────────────────────────────
  // This ensures the fallback UI triggers even if init() crashes
  // before any render code runs (e.g., buildLessons crashes).
  startStartupWatchdog();

  try {
    // 0. Capture splash start time for minimum display duration
    window.__splashStart = Date.now();

    // 0. Log safeguard results
    if (window.__safeguards) {
      var issues = window.__safeguards.issues();
      if (issues.length > 0) {
        console.warn('[startup] [pre] Safeguards detected ' + issues.length + ' issue(s):');
        issues.forEach(function(iss) { console.warn('  [' + iss.type + '] ' + iss.detail); });
      }
    }

    // 0. Ensure lessons and word index are built
    window.__DEV__ && console.log('[startup] [1a] Building lessons and word index...');
    if (LESSONS.length === 0) buildLessons();
    if (typeof buildWordIndex === 'function') buildWordIndex();

    // 0a. Run data validation
    window.__DEV__ && console.log('[startup] [1b] Running data validation...');
    validateData();

    window.__DEV__ && console.log('[startup] [1c] Setting active lesson...');
    // Set active lesson from saved progress (check foundation mode first)
    activeLessonIndex = getCurrentLessonIndex();
    if (activeLessonIndex >= getLessonCount()) activeLessonIndex = 0;
    
    // Set mode selector to match initial state
    var modeSelect = DOM.get('surah-select');
    if (modeSelect) {
      modeSelect.value = 'lesson';
    }
    
    // Set initial view to dashboard (switchView handles view activation, tab highlighting, and rendering)
    window.__DEV__ && console.log('[startup] [2] Switching to dashboard view...');
    currentView = 'dashboard';
    switchView('dashboard');
    window.__DEV__ && console.log('[startup] [2a] switchView(dashboard) completed');

    // Wire adaptive engine: invalidate learner profile on SRS changes
    if (window.__adaptive && window.__adaptive.invalidateProfile) {
      if (window.__srs && window.__srs.invalidateStatsCache) {
        let _origInvalidate = window.__srs.invalidateStatsCache;
        window.__srs.invalidateStatsCache = function() {
          _origInvalidate();
          window.__adaptive.invalidateProfile();
        };
      }
    }

    // 1. Initialize Firebase services (auth, sync, user)
    window.__DEV__ && console.log('[startup] [3] Initializing Firebase...');
    try {
      var firebaseReady = initAuth();
      window.__DEV__ && console.log('[startup] [3a] initAuth returned:', firebaseReady);
      if (firebaseReady) {
        initSync();
        window.__DEV__ && console.log('[startup] [3b] initSync completed');
        initUserService();
        window.__DEV__ && console.log('[startup] [3c] initUserService completed');
      }
    } catch (e) {
      console.warn('[app] Firebase init failed (non-blocking):', e.message);
    }

    // 2. Initialize auth and profile UI
    window.__DEV__ && console.log('[startup] [4] Initializing auth UI...');
    try { initAuthUI(); window.__DEV__ && console.log('[startup] [4a] initAuthUI completed'); } catch (e) { console.warn('[app] Auth UI init failed:', e.message); }
    try { initProfileUI(); window.__DEV__ && console.log('[startup] [4b] initProfileUI completed'); } catch (e) { console.warn('[app] Profile UI init failed:', e.message); }

    // 3. Wire application events
    window.__DEV__ && console.log('[startup] [5] Wiring events...');
    try { wireEvents(); window.__DEV__ && console.log('[startup] [5a] wireEvents completed'); } catch (e) { console.error('[app] CRITICAL: wireEvents failed:', e.message); }

    // 4. Set up keyboard shortcuts
    window.__DEV__ && console.log('[startup] [6] Setting up keyboard shortcuts...');
    try { setupKeyboardShortcuts(); window.__DEV__ && console.log('[startup] [6a] setupKeyboardShortcuts completed'); } catch (e) { console.warn('[app] Keyboard shortcuts failed:', e.message); }

    // 5. Validate surah coverage and populate surah selector
    window.__DEV__ && console.log('[startup] [7] Validating surah coverage...');
    try { validateSurahCoverage(); } catch (e) { console.warn('[app] Surah coverage check failed:', e.message); }
    try { populateSurahSelector(); window.__DEV__ && console.log('[startup] [7a] populateSurahSelector completed'); } catch (e) { console.warn('[app] Surah selector failed:', e.message); }

    // 6. Setup other views (dashboard already rendered by switchView('dashboard'))
    window.__DEV__ && console.log('[startup] [8] Setting up initial displays...');

    // Wrap rendering functions with safe boundaries if available
    var _safeUpdateWordCard = (window.__safeguards && window.__safeguards.createSafeRenderer)
      ? window.__safeguards.createSafeRenderer(updateWordCard, 'updateWordCard')
      : updateWordCard;
    var _safeUpdateReviewBanner = (window.__safeguards && window.__safeguards.createSafeRenderer)
      ? window.__safeguards.createSafeRenderer(updateReviewBanner, 'updateReviewBanner')
      : updateReviewBanner;
    var _safeUpdateStatsDisplay = (window.__safeguards && window.__safeguards.createSafeRenderer)
      ? window.__safeguards.createSafeRenderer(updateStatsDisplay, 'updateStatsDisplay')
      : updateStatsDisplay;
    var _safeUpdateLessonProgress = (window.__safeguards && window.__safeguards.createSafeRenderer)
      ? window.__safeguards.createSafeRenderer(updateLessonProgressDisplay, 'updateLessonProgressDisplay')
      : updateLessonProgressDisplay;

    try { _safeUpdateWordCard(); } catch (e) { console.warn('[app] Word card init failed:', e.message); }
    try { _safeUpdateReviewBanner(); } catch (e) { console.warn('[app] Review banner update failed:', e.message); }
    try { _safeUpdateStatsDisplay(); } catch (e) { console.warn('[app] Stats display update failed:', e.message); }
    try { _safeUpdateLessonProgress(); } catch (e) { console.warn('[app] Lesson progress update failed:', e.message); }

    // 7. Register service worker
    window.__DEV__ && console.log('[startup] [9] Registering service worker...');
    try { registerServiceWorker(); } catch (e) { console.warn('[app] Service worker registration failed:', e.message); }

    // 8. Set up online/offline sync listener
    window.__DEV__ && console.log('[startup] [10] Setting up analytics and sync...');
    if (window.__analytics && window.__analytics.init) {
      try { window.__analytics.init(); window.__DEV__ && console.log('[startup] [10a] analytics.init completed'); } catch (e) { console.warn('[app] Analytics init failed:', e.message); }
    }
    try { setupOnlineSync(); } catch (e) { console.warn('[app] Online sync setup failed:', e.message); }

    // 9. Show keyboard shortcut hints on first load (briefly)
    setTimeout(function() {
      if (!window._kbdHintsShown) {
        window._kbdHintsShown = true;
        window._kbdHintsAutoShown = true;
        showKeyboardHints();
        window.__DEV__ && console.log('[startup] [11] Keyboard hints shown');
      }
    }, 1000);

    // 10. Check if user is already signed in (session restored from persistence)
    window.__DEV__ && console.log('[startup] [12] Checking auth session...');
    try {
      var user = getCurrentUser();
      window.__DEV__ && console.log('[startup] [12a] Current user:', user ? user.email : 'none');
      if (user && !user.emailVerified) {
        window.__DEV__ && console.log('[app] Email not verified — user can continue.');
      }

      // 11. Apply user settings for daily review limit (if available)
      if (user && window.__user) {
        window.__user.loadProfile(user.uid).then(function (profile) {
          window.__DEV__ && console.log('[startup] [12b] User profile loaded');
          if (profile && profile.settings && profile.settings.dailyReviewLimit) {
            if (window.__srs && window.__srs.updateDailyReviewLimit) {
              window.__srs.updateDailyReviewLimit(profile.settings.dailyReviewLimit);
            }
          }
        }).catch(function () {
          // Silently ignore — use default limit
        });
      }
    } catch (e) { /* non-critical */ }

    // 12. Initialize UX polish module
    window.__DEV__ && console.log('[startup] [13] Initializing UX polish...');
    if (window.__ux) {
      try {
        var onbDone = window.__ux.hasCompletedOnboarding();
        window.__DEV__ && console.log('[startup] [13a] Onboarding completed earlier:', onbDone);
        if (!onbDone) {
          // Show onboarding after splash screen is fully removed (~1500ms min + 800ms hide + 800ms remove + buffer)
          setTimeout(function() { window.__DEV__ && console.log('[startup] [13b] Showing onboarding overlay'); window.__ux.showOnboarding(); }, 3000);
        }
        window.__ux.updateOfflineIndicator();
        window.__DEV__ && console.log('[startup] [13c] Offline indicator updated');
      } catch (e) { console.warn('[app] UX init failed:', e.message); }
      window.addEventListener('online', function() { if (window.__ux) window.__ux.updateOfflineIndicator(); });
      window.addEventListener('offline', function() { if (window.__ux) window.__ux.updateOfflineIndicator(); });
    } else {
      window.__DEV__ && console.log('[startup] [13x] window.__ux is NOT available — UX polish module not loaded');
    }
  } catch (e) {
    console.error('[app] CRITICAL: init() failed:', e.message, e.stack);
  }

  window.__DEV__ && console.log('[startup] [14] init() successful — splash screen scheduled');

  // ── Cancel startup watchdog on success ────────────────────
  cancelStartupWatchdog();

  // ── Hide Splash Screen ─────────────────────────────────────
  // Always hide the splash regardless of init success or failure.
  var splash = document.getElementById('splash-screen');
  // If init crashed before __splashStart was set, set it now so the
  // splash hiding logic below still works correctly.
  if (!window.__splashStart) window.__splashStart = Date.now();
  if (splash) {
    var MIN_SPLASH_MS = 1500;
    var elapsed = Date.now() - window.__splashStart;
    var delay = Math.max(0, MIN_SPLASH_MS - elapsed);
    setTimeout(function() {
      window.__DEV__ && console.log('[startup] [15] Hiding splash screen (after ' + delay + 'ms delay)');
      try {
        splash.classList.add('splash-hidden');
        var appEl = document.querySelector('.app');
        if (appEl) appEl.classList.add('app-morph-entering');
        setTimeout(function() {
          window.__DEV__ && console.log('[startup] [16] Removing splash DOM element');
          try {
            if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
            if (appEl) appEl.classList.remove('app-morph-entering');
            window.__DEV__ && console.log('[startup] [17] Splash removed — app should be interactive now');
          } catch (e) { /* ignore */ }
        }, 800);
        
        // Safety timeout: ensure app-morph-entering is ALWAYS removed
        // even if the splash removal above fails silently.
        setTimeout(function() {
          try {
            if (appEl && appEl.classList.contains('app-morph-entering')) {
              appEl.classList.remove('app-morph-entering');
              window.__DEV__ && console.log('[startup] [safety] Cleaned up stray app-morph-entering class');
            }
          } catch (e) { /* ignore */ }
        }, 5000);
      } catch (e) { /* ignore */ }
    }, delay);
  }
}

// ── Learning Path Navigation Functions ─────────────────────────
// (Functions are defined in js/ui/navigation.js)

/**
 * Start a Mixed Review session.
 */
// (Stub — see js/ui/review.js for the implementation)

// ── Toast Notification System ─────────────────────────────────────



// ── Bootstrap the Application ────────────────────────────────────
// Init is called here at the end of the bundle, after all function
// definitions have been parsed. Because app.bundle.min.js is loaded
// with the 'defer' attribute, the DOM is fully available at this point.
init();
