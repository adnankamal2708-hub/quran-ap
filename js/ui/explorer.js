var _explorerWord = null;

/** @type {number} Current occurrence index in explorer */
var _explorerOccIdx = 0;

/** @type {string|null} Previous view for explorer back navigation */
var _explorerReturnView = null;

/**
 * Open the Vocabulary Explorer for a given word.
 * Saves the current view so the back button can return.
 */
function openExplorer(w) {
  if (!w) return;
  _explorerWord = w;
  _explorerOccIdx = 0;
  
  // Save current view for back navigation
  if (currentView !== 'explorer') {
    _explorerReturnView = currentView;
  }
  
  if (typeof switchView === 'function') {
    switchView('explorer');
  }
}

/**
 * Close the explorer and return to the previous view.
 */
function closeExplorer() {
  var returnView = _explorerReturnView || 'learn';
  _explorerWord = null;
  _explorerReturnView = null;
  if (typeof switchView === 'function') {
    switchView(returnView);
  }
}

/**
 * Render the full Vocabulary Explorer for the current explorer word.
 * This function is called by switchView('explorer') and populates all explorer sections.
 */
function renderExplorer() {
  var w = _explorerWord;
  if (!w) {
    // No word set — try to use the current learn word
    w = typeof getCurrentWord === 'function' ? getCurrentWord() : null;
    if (w) _explorerWord = w;
    else return;
  }
  
  // Ensure relationships cache is built
  if (typeof buildRelationsCache === 'function') buildRelationsCache();
  
  _explorerOccIdx = 0;
  var occCount = w.occurrences ? w.occurrences.length : 0;
  var srsStatus = typeof getSRSStatus === 'function' ? getSRSStatus(w.id) : null;
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var srsEntry = srsData[w.id] || null;
  
  // ── Core Information ──
  DOM.get('explorer-arabic').textContent = w.arabic || '';
  DOM.get('explorer-translit').textContent = w.translit || '';
  DOM.get('explorer-meaning-main').textContent = w.meaning || w.english || '';
  DOM.get('explorer-full-meaning').textContent = w.meaning && w.meaning !== w.english ? w.meaning : '';
  DOM.get('explorer-root').textContent = w.root || '—';
  DOM.get('explorer-pattern').textContent = w.pattern && w.pattern !== '—' ? w.pattern : '—';
  DOM.get('explorer-pos').textContent = w.type || w.typeCategory || '—';
  
  // Difficulty
  var diffEl = DOM.get('explorer-difficulty');
  if (w.difficulty) {
    var stars = '';
    for (var di = 0; di < w.difficulty; di++) stars += '★';
    for (var dje = w.difficulty; dje < 5; dje++) stars += '☆';
    diffEl.textContent = w.difficulty + ' ' + stars;
  } else {
    diffEl.textContent = '—';
  }
  
  // Frequency rank
  var freqRankEl = DOM.get('explorer-freq-rank');
  if (w.frequencyRank) {
    var pct = w.frequencyPercentile !== undefined ? ' (top ' + w.frequencyPercentile + '%)' : '';
    freqRankEl.textContent = '#' + w.frequencyRank + pct;
  } else {
    freqRankEl.textContent = '—';
  }
  
  // Total occurrences
  DOM.get('explorer-occ').textContent = w.occ ? w.occ.toLocaleString() + ' times' : '—';
  
  // Foundation lesson
  var fLessonEl = DOM.get('explorer-foundation-lesson');
  if (w.foundationLessonId !== undefined && w.foundationLessonId >= 0) {
    fLessonEl.textContent = 'Foundation ' + (w.foundationLessonId + 1);
  } else {
    fLessonEl.textContent = 'Not in Foundation Course';
  }
  
  // Learning priority
  var priorityEl = DOM.get('explorer-priority');
  if (typeof getLearningPriorityLabel === 'function' && w.learningPriority) {
    priorityEl.textContent = w.learningPriority + ' — ' + getLearningPriorityLabel(w.learningPriority);
  } else {
    priorityEl.textContent = '—';
  }
  
  // ── Quran Context ──
  DOM.get('explorer-first-occ').textContent = w.firstOccurrence || (w.occurrences && w.occurrences.length > 0 ? w.occurrences[0].verseKey : '—');
  DOM.get('explorer-last-occ').textContent = w.lastOccurrence || (w.occurrences && w.occurrences.length > 0 ? w.occurrences[w.occurrences.length - 1].verseKey : '—');
  DOM.get('explorer-surah-count').textContent = w.surahCount || (w.surahIds ? w.surahIds.length : '—');
  DOM.get('explorer-total-occ').textContent = w.occ ? w.occ.toLocaleString() : '—';
  
  // Occurrence navigation
  var occNavEl = DOM.get('explorer-occ-nav');
  if (occCount > 0) {
    occNavEl.style.display = 'flex';
    showExplorerOccurrence(0);
  } else {
    occNavEl.style.display = 'none';
    DOM.get('explorer-ayah-arabic').textContent = '';
    DOM.get('explorer-ayah-translation').textContent = 'No verse context available for this word.';
    DOM.get('explorer-ayah-ref').textContent = '';
  }
  
  // Related surahs
  renderExplorerSurahLinks(w);
  
  // ── Vocabulary Relationships ──
  renderExplorerRelationships(w);
  
  // ── Personal Learning Progress ──
  renderExplorerLearningProgress(w, srsStatus, srsEntry);
  
  // ── Learning Actions ──
  renderExplorerActions(w, srsStatus);
  
  // ── Personal Notes ──
  var notesEl = DOM.get('explorer-notes-input');
  if (notesEl) {
    notesEl.value = typeof getNote === 'function' ? getNote(w.id) : '';
  }
  
  // Wire explorer events
  wireExplorerEvents(w);
  
  // Scroll to top
  var content = DOM.get('content');
  if (content) content.scrollTop = 0;
}

/**
 * Show a specific occurrence in the explorer ayah display.
 */
function showExplorerOccurrence(idx) {
  var w = _explorerWord;
  if (!w || !w.occurrences || idx >= w.occurrences.length) return;
  _explorerOccIdx = idx;
  var occ = w.occurrences[idx];
  
  DOM.get('explorer-ayah-arabic').innerHTML = occ.ayahA || '';
  DOM.get('explorer-ayah-translation').textContent = occ.ayahT || '';
  var ref = occ.ayahR || occ.verseKey || '';
  if (occ.surahId && SURAH_INFO && SURAH_INFO[occ.surahId]) {
    ref = SURAH_INFO[occ.surahId].name + ' ' + ref;
  }
  DOM.get('explorer-ayah-ref').textContent = ref;
  
  // Update nav label
  var label = DOM.get('explorer-occ-label');
  if (label) label.textContent = (idx + 1) + ' / ' + w.occurrences.length;
  
  // Update prev/next buttons
  var prevBtn = DOM.get('explorer-occ-prev');
  var nextBtn = DOM.get('explorer-occ-next');
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) nextBtn.disabled = idx >= w.occurrences.length - 1;
  
  // Hide tafsir on occurrence change
  var tafsirBox = DOM.get('explorer-tafsir-box');
  if (tafsirBox) tafsirBox.style.display = 'none';
  
  // Store current occurrence for tafsir loading
  window.__explorerCurrentOcc = occ;
}

/**
 * Render surah links for the explorer.
 */
function renderExplorerSurahLinks(w) {
  var container = DOM.get('explorer-surah-links');
  if (!container) return;
  container.innerHTML = '';
  
  var surahIds = w.surahIds || [];
  if (w.surahId && surahIds.indexOf(w.surahId) < 0) surahIds.push(w.surahId);
  
  if (surahIds.length === 0) {
    container.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">No surah data</span>';
    return;
  }
  
  for (var si = 0; si < surahIds.length; si++) {
    var sid = surahIds[si];
    var info = SURAH_INFO && SURAH_INFO[sid] ? SURAH_INFO[sid] : null;
    var chip = document.createElement('span');
    chip.className = 'explorer-surah-chip';
    chip.textContent = (info ? info.name : 'Surah ' + sid) + ' (' + sid + ')';
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', 'Study Surah ' + (info ? info.name : sid));
    (function(surahId) {
      chip.onclick = function() {
        if (typeof goToSurah === 'function') {
          goToSurah(surahId);
        }
      };
      chip.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof goToSurah === 'function') goToSurah(surahId); }
      };
    })(sid);
    container.appendChild(chip);
  }
}

/**
 * Render all vocabulary relationship sections in the explorer.
 */
function renderExplorerRelationships(w) {
  // Root Family
  var rootFamList = DOM.get('explorer-root-family-list');
  if (rootFamList) {
    rootFamList.innerHTML = '';
    if (w.rootFamily && w.rootFamily.length > 0) {
      for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
        var rf = w.rootFamily[rfi];
        rootFamList.appendChild(createExplorerChip(rf.a, rf.e, null, w));
      }
    } else {
      rootFamList.innerHTML = '<span class="explorer-empty">No root family data</span>';
    }
  }
  
  // Derived Forms
  var derivedList = DOM.get('explorer-derived-forms-list');
  if (derivedList) {
    derivedList.innerHTML = '';
    var derivedForms = typeof getDerivedForms === 'function' ? getDerivedForms(w) : [];
    if (derivedForms.length > 0) {
      for (var dfi = 0; dfi < derivedForms.length; dfi++) {
        var df = derivedForms[dfi];
        derivedList.appendChild(createExplorerChip(df.arabic, df.english, df.formName, w));
      }
    } else {
      derivedList.innerHTML = '<span class="explorer-empty">No derived forms</span>';
    }
  }
  
  // Morphological Relatives
  var morphList = DOM.get('explorer-morph-list');
  if (morphList) {
    morphList.innerHTML = '';
    var morphRels = typeof getMorphologicalRelationships === 'function' ? getMorphologicalRelationships(w) : [];
    if (morphRels.length > 0) {
      for (var mi = 0; mi < morphRels.length; mi++) {
        var mr = morphRels[mi];
        morphList.appendChild(createExplorerChip(mr.arabic, mr.english, mr.relationshipType, w));
      }
    } else {
      morphList.innerHTML = '<span class="explorer-empty">No morphological relatives</span>';
    }
  }
  
  // Similar Words
  var similarList = DOM.get('explorer-similar-list');
  if (similarList) {
    similarList.innerHTML = '';
    var similarWords = typeof findWordsByArabicList === 'function' ? findWordsByArabicList(w.similarWords) : [];
    if (similarWords.length > 0) {
      for (var si = 0; si < similarWords.length; si++) {
        var sw = similarWords[si];
        similarList.appendChild(createExplorerChip(sw.arabic, sw.english, 'Similar meaning', w));
      }
    } else {
      similarList.innerHTML = '<span class="explorer-empty">No similar words</span>';
    }
  }
  
  // Confused With
  var confusedList = DOM.get('explorer-confused-list');
  if (confusedList) {
    confusedList.innerHTML = '';
    var confusedWords = typeof getConfusedWith === 'function' ? getConfusedWith(w) : [];
    if (confusedWords.length > 0) {
      for (var ci = 0; ci < confusedWords.length; ci++) {
        var cw = confusedWords[ci];
        confusedList.appendChild(createExplorerChip(cw.arabic, cw.english, cw.reason || 'Frequently confused', w));
      }
    } else {
      confusedList.innerHTML = '<span class="explorer-empty">No frequently confused words</span>';
    }
  }
  
  // Semantic Groups
  var semanticList = DOM.get('explorer-semantic-list');
  if (semanticList) {
    semanticList.innerHTML = '';
    var semGroups = typeof getSemanticGroups === 'function' ? getSemanticGroups(w) : [];
    if (semGroups.length > 0) {
      for (var sgi = 0; sgi < semGroups.length; sgi++) {
        var sg = semGroups[sgi];
        var chip = document.createElement('div');
        chip.className = 'explorer-semantic-chip';
        chip.innerHTML = '<span class="explorer-semantic-name">' + sg.group + '</span> <span class="explorer-semantic-count">' + sg.count + ' words</span>';
        semanticList.appendChild(chip);
      }
    } else {
      semanticList.innerHTML = '<span class="explorer-empty">No semantic groups</span>';
    }
  }
  
  // Related Quranic Words
  var relatedList = DOM.get('explorer-related-list');
  if (relatedList) {
    relatedList.innerHTML = '';
    var relatedWords = typeof getRelatedWordObjects === 'function' ? getRelatedWordObjects(w) : [];
    if (relatedWords.length > 0) {
      for (var rwi = 0; rwi < relatedWords.length; rwi++) {
        var rw = relatedWords[rwi];
        var rwObj = typeof findWordByArabic === 'function' ? findWordByArabic(rw.arabic) : null;
        if (rwObj) {
          relatedList.appendChild(createExplorerChip(rwObj.arabic, rwObj.english, 'Related Quranic word', w));
        } else {
          relatedList.appendChild(createExplorerChip(rw.arabic || rw.english, rw.english || rw.arabic, 'Related', w));
        }
      }
    } else {
      relatedList.innerHTML = '<span class="explorer-empty">No related Quranic words</span>';
    }
  }
  
  // Contextual Equivalents
  var equivList = DOM.get('explorer-equiv-list');
  if (equivList) {
    equivList.innerHTML = '';
    var equivs = typeof getContextualEquivalents === 'function' ? getContextualEquivalents(w) : [];
    if (equivs.length > 0) {
      for (var ei = 0; ei < equivs.length; ei++) {
        var eq = equivs[ei];
        equivList.appendChild(createExplorerChip(eq.arabic, eq.english, 'Contextual equivalent', w));
      }
    } else {
      equivList.innerHTML = '<span class="explorer-empty">No contextual equivalents</span>';
    }
  }
}

/**
 * Create a clickable chip for the explorer relationships section.
 * Clicking navigates to the target word in the explorer.
 */
function createExplorerChip(arabic, english, subtitle, currentWord) {
  var chip = document.createElement('div');
  chip.className = 'explorer-rel-chip';
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.setAttribute('aria-label', 'Explore ' + arabic + ' - ' + english);
  
  var html = '<span class="explorer-chip-arabic">' + arabic + '</span>' +
    '<span class="explorer-chip-eng">' + english + '</span>';
  if (subtitle) {
    html += '<span class="explorer-chip-sub">' + subtitle + '</span>';
  }
  chip.innerHTML = html;
  
  // Find target word object
  var targetWord = typeof findWordByArabic === 'function' ? findWordByArabic(arabic) : null;
  
  chip.onclick = function() {
    if (targetWord && typeof openExplorer === 'function') {
      openExplorer(targetWord);
    }
  };
  chip.onkeydown = function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (targetWord && typeof openExplorer === 'function') {
        openExplorer(targetWord);
      }
    }
  };
  
  return chip;
}

/**
 * Render personal learning progress in the explorer.
 */
function renderExplorerLearningProgress(w, srsStatus, srsEntry) {
  // Mastery Status / SRS Stage
  var stageEl = DOM.get('explorer-srs-stage');
  if (stageEl && srsStatus) {
    if (srsStatus.status === 'new') {
      stageEl.textContent = '🆕 New — Not yet studied';
    } else if (srsStatus.status === 'review') {
      var overdueText = srsStatus.daysUntilDue < 0 ? ' (overdue!)' : '';
      stageEl.textContent = '🔁 Due for review' + overdueText;
    } else {
      var stageNames = ['', 'Learning', 'Young', 'Mature'];
      stageEl.textContent = '✓ ' + (stageNames[srsStatus.stage] || 'Mastered');
    }
  } else if (stageEl) {
    stageEl.textContent = '🆕 New — Not yet studied';
  }
  
  // Foundation lesson
  var fStatusEl = DOM.get('explorer-foundation-status');
  if (fStatusEl) {
    if (w.foundationLessonId !== undefined && w.foundationLessonId >= 0) {
      var isCompleted = typeof isFoundationLessonCompleted === 'function' 
        ? isFoundationLessonCompleted(w.foundationLessonId) : false;
      fStatusEl.textContent = isCompleted 
        ? '✓ Foundation ' + (w.foundationLessonId + 1) + ' completed'
        : '📘 Foundation ' + (w.foundationLessonId + 1) + ' — in progress';
    } else {
      fStatusEl.textContent = '—';
    }
  }
  
  // Last studied
  var lastStudiedEl = DOM.get('explorer-last-studied');
  if (lastStudiedEl && srsEntry && srsEntry.ratedAt) {
    var lastDate = new Date(srsEntry.ratedAt);
    var now = new Date();
    var diffDays = Math.round((now - lastDate) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) lastStudiedEl.textContent = 'Today';
    else if (diffDays === 1) lastStudiedEl.textContent = 'Yesterday';
    else lastStudiedEl.textContent = diffDays + ' days ago';
  } else if (lastStudiedEl) {
    lastStudiedEl.textContent = 'Never studied';
  }
  
  // Next review
  var nextReviewEl = DOM.get('explorer-next-review');
  if (nextReviewEl && srsEntry && srsEntry.dueDate) {
    var dueDate = new Date(srsEntry.dueDate);
    var now = new Date();
    var diffDays = Math.round((dueDate - now) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) nextReviewEl.textContent = 'Due now!';
    else if (diffDays === 0) nextReviewEl.textContent = 'Today';
    else if (diffDays === 1) nextReviewEl.textContent = 'Tomorrow';
    else nextReviewEl.textContent = 'In ' + diffDays + ' days';
  } else if (nextReviewEl) {
    nextReviewEl.textContent = 'Review when ready';
  }
  
  // Total reviews
  var reviewCountEl = DOM.get('explorer-review-count');
  if (reviewCountEl) {
    reviewCountEl.textContent = srsEntry ? (srsEntry.totalReviews || 0) : 0;
  }
  
  // Retention
  var retentionEl = DOM.get('explorer-retention');
  if (retentionEl && srsStatus) {
    retentionEl.textContent = Math.round(srsStatus.retention * 100) + '%';
  } else if (retentionEl) {
    retentionEl.textContent = '—';
  }
}

/**
 * Render learning action buttons in the explorer.
 */
function renderExplorerActions(w, srsStatus) {
  // Bookmark button
  var bookmarkBtn = DOM.get('explorer-btn-bookmark');
  if (bookmarkBtn) {
    var isFav = typeof isFavorite === 'function' ? isFavorite(w.id) : false;
    bookmarkBtn.textContent = isFav ? '⭐ Bookmarked' : '☆ Bookmark';
    bookmarkBtn.className = 'explorer-action-btn' + (isFav ? ' active-qa' : '');
  }
}

/**
 * Wire all explorer event handlers.
 */
function wireExplorerEvents(w) {
  // Back button
  var backBtn = DOM.get('explorer-back');
  if (backBtn) backBtn.onclick = function() { closeExplorer(); };
  
  // Occurrence navigation
  var occPrevBtn = DOM.get('explorer-occ-prev');
  if (occPrevBtn) {
    occPrevBtn.onclick = function() {
      if (_explorerOccIdx > 0) showExplorerOccurrence(_explorerOccIdx - 1);
    };
  }
  var occNextBtn = DOM.get('explorer-occ-next');
  if (occNextBtn) {
    occNextBtn.onclick = function() {
      if (_explorerWord && _explorerOccIdx < _explorerWord.occurrences.length - 1) {
        showExplorerOccurrence(_explorerOccIdx + 1);
      }
    };
  }
  
  // Tafsir button — toggle show/hide
  var tafsirBtn = DOM.get('explorer-tafsir-btn');
  if (tafsirBtn) {
    tafsirBtn.onclick = function() {
      var tafsirBox = DOM.get('explorer-tafsir-box');
      var tafsirText = DOM.get('explorer-tafsir-text');
      if (!tafsirBox || !tafsirText) return;
      var isVisible = tafsirBox.style.display === 'block';
      if (isVisible) {
        tafsirBox.style.display = 'none';
        tafsirBtn.textContent = '📚 Load Ibn Kathir Tafsir';
      } else {
        var occ = window.__explorerCurrentOcc || (_explorerWord && _explorerWord.occurrences && _explorerWord.occurrences[0]);
        var text = '';
        if (occ && occ.tafsir) text = occ.tafsir;
        else if (_explorerWord && _explorerWord.tafsir) text = _explorerWord.tafsir;
        else text = 'Ibn Kathir commentary not available for this word.';
        tafsirText.textContent = text;
        tafsirBox.style.display = 'block';
        tafsirBtn.textContent = '📚 Hide Tafsir';
      }
    };
  }
  
  // All occurrences toggle
  var allOccBtn = DOM.get('explorer-all-occ-btn');
  if (allOccBtn) {
    allOccBtn.onclick = function() {
      var listEl = DOM.get('explorer-all-occ-list');
      if (!listEl) return;
      if (listEl.style.display === 'block') {
        listEl.style.display = 'none';
        allOccBtn.textContent = '📋 View all occurrences';
        allOccBtn.setAttribute('aria-expanded', 'false');
      } else {
        allOccBtn.textContent = '📋 Hide occurrences';
        allOccBtn.setAttribute('aria-expanded', 'true');
        renderExplorerAllOccurrences(listEl, _explorerWord);
        listEl.style.display = 'block';
      }
    };
  }
  
  // Bookmark button
  var bookmarkBtn = DOM.get('explorer-btn-bookmark');
  if (bookmarkBtn) {
    bookmarkBtn.onclick = function() {
      if (typeof toggleFavorite === 'function') {
        var isNowFav = toggleFavorite(w.id);
        bookmarkBtn.textContent = isNowFav ? '⭐ Bookmarked' : '☆ Bookmark';
        bookmarkBtn.className = 'explorer-action-btn' + (isNowFav ? ' active-qa' : '');
      }
    };
  }
  
  // Study this word button
  var studyBtn = DOM.get('explorer-btn-study');
  if (studyBtn) {
    studyBtn.onclick = function() {
      closeExplorer();
      // Find word in lesson/surah and navigate
      if (typeof window.__navigateToWord === 'function') {
        window.__navigateToWord(w);
      }
    };
  }
  
  // Rate word button
  var rateBtn = DOM.get('explorer-btn-review');
  if (rateBtn) {
    rateBtn.onclick = function() {
      closeExplorer();
      // Navigate to learn view with this word for rating
      if (typeof window.__navigateToWord === 'function') {
        window.__navigateToWord(w);
      }
    };
  }
  
  // Practice related button
  var practiceBtn = DOM.get('explorer-btn-practice-related');
  if (practiceBtn) {
    practiceBtn.onclick = function() {
      // Find root family words and navigate to the first one that's different
      if (w.rootFamily && w.rootFamily.length > 0) {
        for (var pfi = 0; pfi < w.rootFamily.length; pfi++) {
          var target = typeof findWordByArabic === 'function' ? findWordByArabic(w.rootFamily[pfi].a) : null;
          if (target && target.id !== w.id && typeof openExplorer === 'function') {
            openExplorer(target);
            return;
          }
        }
      }
      // Fallback: navigate to related words
      var rels = typeof getRelatedWordObjects === 'function' ? getRelatedWordObjects(w) : [];
      if (rels.length > 0) {
        var relTarget = typeof findWordByArabic === 'function' ? findWordByArabic(rels[0].arabic) : null;
        if (relTarget && typeof openExplorer === 'function') openExplorer(relTarget);
      }
    };
  }
  
  // View all occurrences button
  var viewOccBtn = DOM.get('explorer-btn-view-occurrences');
  if (viewOccBtn) {
    viewOccBtn.onclick = function() {
      var listEl = DOM.get('explorer-all-occ-list');
      if (listEl) {
        if (listEl.style.display === 'block') {
          listEl.style.display = 'none';
        } else {
          renderExplorerAllOccurrences(listEl, _explorerWord);
          listEl.style.display = 'block';
        }
      }
    };
  }
  
  // Flashcard mode button
  var flashBtn = DOM.get('explorer-btn-open-flashcards');
  if (flashBtn) {
    flashBtn.onclick = function() {
      closeExplorer();
      if (typeof toggleQuickMode === 'function') toggleQuickMode();
      if (typeof window.__navigateToWord === 'function') {
        window.__navigateToWord(w);
      }
    };
  }
  
  // Notes auto-save
  var notesInput = DOM.get('explorer-notes-input');
  if (notesInput) {
    notesInput.onblur = function() {
      if (typeof setNote === 'function') {
        setNote(w.id, notesInput.value);
      }
    };
  }
}

/**
 * Render all occurrences in a collapsible list.
 */