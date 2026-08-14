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

  // Track word detail opened for analytics
  if (window.__feedback && typeof window.__feedback.trackEvent === 'function') {
    window.__feedback.trackEvent('word_detail_opened', { wordId: w.id });
  }
  
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

/** Explorer sections hidden entirely for premium-locked words */
var _explorerVocabLockedSections = [
  'explorer-quran-context', 'explorer-relationships', 'explorer-learning-progress',
  'explorer-actions', 'explorer-notes',
];

/**
 * Reset any leftover locked state (hidden sections + locked panel) so a full
 * explorer render — e.g. after a live premium upgrade — shows everything again.
 */
function _resetExplorerLockedState() {
  for (var _rli = 0; _rli < _explorerVocabLockedSections.length; _rli++) {
    var _rlSec = document.getElementById(_explorerVocabLockedSections[_rli]);
    if (_rlSec) _rlSec.style.display = '';
  }
  var _rlPanel = document.getElementById('explorer-vocab-locked');
  if (_rlPanel) _rlPanel.style.display = 'none';
}

/**
 * Render the locked detail view for a premium-tier word (free user).
 * Shows the word's identity (it exists in the Quran) plus an upgrade CTA;
 * hides all full-word-information sections (occurrences, relationships,
 * learning progress, actions, notes) — reusing the established locked-panel
 * pattern from the word-relationships gate.
 */
function renderExplorerLocked(w) {
  // Word identity — mirrors the locked row in the Words tab.
  DOM.get('explorer-arabic').textContent = w.arabic || '';
  DOM.get('explorer-translit').textContent = w.translit || '';
  DOM.get('explorer-meaning-main').textContent = w.meaning || w.english || '';
  DOM.get('explorer-full-meaning').textContent = '';
  DOM.get('explorer-root').textContent = w.root || '—';
  DOM.get('explorer-pos').textContent = w.type || w.typeCategory || '—';
  DOM.get('explorer-freq-rank').textContent = '—';
  DOM.get('explorer-occ').textContent = '—';
  DOM.get('explorer-foundation-lesson').textContent = '—';

  // Hide every section beyond core info.
  for (var _li = 0; _li < _explorerVocabLockedSections.length; _li++) {
    var _lSec = document.getElementById(_explorerVocabLockedSections[_li]);
    if (_lSec) _lSec.style.display = 'none';
  }

  // Locked panel — sibling of the core section.
  var panel = document.getElementById('explorer-vocab-locked');
  if (!panel) {
    var viewEl = document.getElementById('view-explorer');
    var coreSec = document.getElementById('explorer-core');
    var attachTo = (coreSec && coreSec.parentNode) ? coreSec.parentNode : viewEl;
    if (!attachTo || typeof attachTo.appendChild !== 'function') return;
    panel = document.createElement('div');
    panel.id = 'explorer-vocab-locked';
    attachTo.appendChild(panel);
  }
  panel.style.display = 'block';
  panel.innerHTML =
    '<div class="profile-subsection" style="border:1px solid var(--gold-dim);border-radius:var(--radius-card);padding:16px;text-align:center;margin-top:12px">' +
      '<div style="font-size:24px;margin-bottom:6px">🔒</div>' +
      '<div style="font-family:var(--serif);font-size:15px;color:var(--gold-light);margin-bottom:6px">Vocabulary Expansion</div>' +
      '<div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">' +
        'This word is part of the extended Quranic vocabulary. Upgrade to Premium to unlock its full word detail — meanings, occurrences, tafsir, relationships, and study tools.' +
      '</div>' +
      '<button class="btn btn-sm" type="button" onclick="if(window.__premium)window.__premium.requestUpgrade(\'vocabulary-expansion\')">⭐ Upgrade to Premium</button>' +
    '</div>';

  // Wire the back button so a locked view is never a dead end.
  var backBtn = document.getElementById('explorer-back');
  if (backBtn) backBtn.onclick = function() { closeExplorer(); };
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

  // Free-tier vocabulary gate: premium-tier words open a locked detail view
  // (identity + upgrade CTA only) instead of full word information.
  if (typeof isFreeAccessible === 'function' && !isFreeAccessible(w)) {
    renderExplorerLocked(w);
    return;
  }
  // Clear any stale locked state from an earlier free-tier render (e.g. after
  // a live upgrade) so the gated sections reappear.
  _resetExplorerLockedState();

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
  DOM.get('explorer-pos').textContent = w.type || w.typeCategory || '—';
  
  // Frequency rank + learning priority — merged single card. Both are
  // optional (rootless/rare words may lack one or both), so each is
  // appended only when present and the card degrades to '—' when neither
  // exists.
  var freqRankEl = DOM.get('explorer-freq-rank');
  var freqParts = [];
  if (w.frequencyRank) {
    freqParts.push('<span class="explorer-freq-pill">#' + w.frequencyRank + '</span>');
    // Hide the percentile when it is exactly 0 — only the single least-frequent
    // word gets a raw 0, and "top 0%" reads like a data glitch. Show it above 0.
    if (w.frequencyPercentile !== undefined && w.frequencyPercentile > 0) {
      freqParts.push('<span class="explorer-freq-pct">top ' + w.frequencyPercentile + '%</span>');
    }
  }
  if (typeof getLearningPriorityLabel === 'function' && w.learningPriority) {
    var pLevel = w.learningPriority;
    var pClass = 'priority-' + (pLevel <= 2 ? 'high' : pLevel <= 3 ? 'medium' : 'low');
    freqParts.push('<span class="explorer-priority-chip ' + pClass + '">' + getLearningPriorityLabel(w.learningPriority) + '</span>');
  }
  freqRankEl.innerHTML = freqParts.length > 0 ? freqParts.join(' · ') : '<span class="explorer-empty">—</span>';
  
  // Total occurrences — structured counter
  var occEl = DOM.get('explorer-occ');
  if (w.occ) {
    occEl.innerHTML = '<span class="explorer-occ-count">' + w.occ.toLocaleString() + '</span> <span class="explorer-occ-unit">occurrences</span>';
  } else {
    occEl.innerHTML = '<span class="explorer-empty">—</span>';
  }
  
  // Foundation lesson — structured badge
  var fLessonEl = DOM.get('explorer-foundation-lesson');
  if (w.foundationLessonId !== undefined && w.foundationLessonId >= 0) {
    fLessonEl.innerHTML = '<span class="explorer-foundation-badge">📘 Foundation ' + (w.foundationLessonId + 1) + '</span>';
  } else {
    fLessonEl.innerHTML = '<span class="explorer-foundation-badge not-in-course">Not in Foundation Course</span>';
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
  
  // ── Vocabulary Relationships (gated for free users) ──
  var _hasExplorerRels = window.__premium && window.__premium.hasFeature(window.__premium.FEATURES.WORD_RELATIONSHIPS);
  if (_hasExplorerRels) {
    renderExplorerRelationships(w);
  } else {
    renderExplorerRelationshipsLocked();
  }
  
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
  
  // R3: route through the shared highlight helper so the target word is
  // always gold-highlighted (also for entries whose hand-authored ayahA
  // lacks embedded <span class="ayah-highlight"> markup). Falls back to the
  // raw text when the helper isn't loaded (test env).
  DOM.get('explorer-ayah-arabic').innerHTML = (typeof _highlightOccurrenceText === 'function')
    ? _highlightOccurrenceText(occ.ayahA || '', w)
    : (occ.ayahA || '');
  DOM.get('explorer-ayah-translation').innerHTML = occ.ayahT || '';
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
 * Render a locked relationship panel for free users in the explorer.
 *
 * Root family is free content and stays visible with its data; every other
 * relationship section is hidden and replaced by a single locked panel.
 *
 * The locked panel is placed as a SIBLING of the gated sections (a child of
 * explorer-rel-content), never nested inside a section that gets hidden below.
 * (The old code inserted it inside explorer-derived-forms-section and then
 * hid that very section, which made the panel invisible for free users.)
 */
function renderExplorerRelationshipsLocked() {
  // Root family is free — populate it so the section shows real data instead
  // of an empty header (mirrors the premium path).
  var rootFamList = DOM.get('explorer-root-family-list');
  if (rootFamList) {
    rootFamList.innerHTML = '';
    if (_explorerWord && _explorerWord.rootFamily && _explorerWord.rootFamily.length > 0) {
      for (var rfi = 0; rfi < _explorerWord.rootFamily.length; rfi++) {
        var rf = _explorerWord.rootFamily[rfi];
        rootFamList.appendChild(createExplorerChip(rf.a, rf.e, null, _explorerWord));
      }
    } else {
      rootFamList.innerHTML = '<span class="explorer-empty">No root family data</span>';
    }
  }

  // Locked panel — sibling of the gated sections inside explorer-rel-content.
  var lockedContainer = document.getElementById('explorer-relationships-locked');
  if (!lockedContainer) {
    lockedContainer = document.createElement('div');
    lockedContainer.id = 'explorer-relationships-locked';
    var relContent = document.getElementById('explorer-rel-content');
    var insertTarget = relContent;
    if (!insertTarget) {
      var rootFamSection = document.getElementById('explorer-root-family-section');
      insertTarget = rootFamSection ? rootFamSection.parentNode : null;
    }
    if (insertTarget && typeof insertTarget.appendChild === 'function') {
      insertTarget.appendChild(lockedContainer);
    } else {
      // No attachable container — bail rather than operate on a detached panel.
      return;
    }
  }
  if (!lockedContainer) return;
  lockedContainer.style.display = 'block';
  lockedContainer.innerHTML =
    '<div class="profile-subsection" style="border:1px solid var(--gold-dim);border-radius:var(--radius-card);padding:16px;text-align:center;margin-top:12px">' +
      '<div style="font-size:24px;margin-bottom:6px">🔗</div>' +
      '<div style="font-family:var(--serif);font-size:15px;color:var(--gold-light);margin-bottom:6px">Word Relationships</div>' +
      '<div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">' +
        'Explore how words connect — similar words, derived forms, semantic groups, ' +
        'morphological relatives, and more with Premium.' +
      '</div>' +
      '<button class="btn btn-sm" type="button" onclick="if(window.__premium)window.__premium.requestUpgrade(\'word-relationships\')">⭐ Upgrade to Premium</button>' +
    '</div>';
  // Hide the gated relationship sections (by section id — root family stays).
  var _explorerRelSections = [
    'explorer-derived-forms-section', 'explorer-morph-section',
    'explorer-similar-section', 'explorer-confused-section',
    'explorer-semantic-section', 'explorer-related-section', 'explorer-equiv-section',
  ];
  for (var _ersi = 0; _ersi < _explorerRelSections.length; _ersi++) {
    var _erSection = document.getElementById(_explorerRelSections[_ersi]);
    if (_erSection) _erSection.style.display = 'none';
  }
}

/**
 * Render all vocabulary relationship sections in the explorer.
 */
function renderExplorerRelationships(w) {
  // Clear stale locked state from an earlier free-tier render. Without this, a
  // premium user who upgraded live would keep seeing the locked
  // "Word Relationships — Upgrade to Premium" panel and dead upgrade button,
  // with the relationship sections still display:none.
  var _prevLocked = document.getElementById('explorer-relationships-locked');
  if (_prevLocked) _prevLocked.style.display = 'none';
  var _gatedLists = [
    'explorer-derived-forms-list', 'explorer-morph-list',
    'explorer-similar-list', 'explorer-confused-list',
    'explorer-semantic-list', 'explorer-related-list', 'explorer-equiv-list',
  ];
  for (var _gi = 0; _gi < _gatedLists.length; _gi++) {
    var _gEl = document.getElementById(_gatedLists[_gi]);
    if (_gEl && _gEl.parentNode) _gEl.parentNode.style.display = '';
  }

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
  // Mastery Status / SRS Stage — structured badge
  var stageEl = DOM.get('explorer-srs-stage');
  if (stageEl) {
    var srsHtml = '';
    if (srsStatus && srsStatus.status === 'new') {
      srsHtml = '<span class="explorer-srs-badge status-new">🆕 New — Not yet studied</span>';
    } else if (srsStatus && srsStatus.status === 'review') {
      var overdueText = srsStatus.daysUntilDue < 0 ? ' (overdue!)' : '';
      var overdueClass = srsStatus.daysUntilDue < 0 ? 'due-now' : '';
      srsHtml = '<span class="explorer-srs-badge status-review">🔁 Due for review' + overdueText + '</span>';
    } else if (srsStatus) {
      var stageNames = ['', 'Learning', 'Young', 'Mature'];
      var stageName = stageNames[srsStatus.stage] || 'Mastered';
      srsHtml = '<span class="explorer-srs-badge status-mastered">✓ ' + stageName + '</span>';
    } else {
      srsHtml = '<span class="explorer-srs-badge status-new">🆕 New — Not yet studied</span>';
    }
    stageEl.innerHTML = srsHtml;
  }
  
  // Foundation lesson — structured status
  var fStatusEl = DOM.get('explorer-foundation-status');
  if (fStatusEl) {
    var fHtml = '';
    if (w.foundationLessonId !== undefined && w.foundationLessonId >= 0) {
      var isCompleted = typeof isFoundationLessonCompleted === 'function' 
        ? isFoundationLessonCompleted(w.foundationLessonId) : false;
      fHtml = '<span class="explorer-foundation-badge' + (isCompleted ? '' : '') + '">' 
        + (isCompleted ? '✓' : '📘') + ' Foundation ' + (w.foundationLessonId + 1) 
        + (isCompleted ? ' completed' : ' — in progress') + '</span>';
    } else {
      fHtml = '<span class="explorer-foundation-badge not-in-course">—</span>';
    }
    fStatusEl.innerHTML = fHtml;
  }
  
  // Last studied — structured text
  var lastStudiedEl = DOM.get('explorer-last-studied');
  if (lastStudiedEl) {
    var lastText = 'Never studied';
    var lastClass = '';
    if (srsEntry && srsEntry.ratedAt) {
      var lastDate = new Date(srsEntry.ratedAt);
      var now = new Date();
      var diffDays = Math.round((now - lastDate) / (24 * 60 * 60 * 1000));
      if (diffDays === 0) { lastText = 'Today'; lastClass = 'today'; }
      else if (diffDays === 1) { lastText = 'Yesterday'; }
      else { lastText = diffDays + ' days ago'; }
    }
    lastStudiedEl.innerHTML = '<span class="explorer-time-text ' + lastClass + '">' + lastText + '</span>';
  }
  
  // Next review — show only when a real review is scheduled. Words with no
  // review history get the row hidden entirely instead of the old vague
  // 'Review when ready' placeholder.
  var nextReviewItem = DOM.get('explorer-next-review-item');
  var hasScheduledReview = !!(srsEntry && srsEntry.dueDate);
  if (nextReviewItem) nextReviewItem.style.display = hasScheduledReview ? '' : 'none';
  var nextReviewEl = DOM.get('explorer-next-review');
  if (nextReviewEl && !hasScheduledReview) {
    // Clear stale content from a previous word's render while hidden
    nextReviewEl.innerHTML = '';
  }
  if (nextReviewEl && hasScheduledReview) {
    var dueDate = new Date(srsEntry.dueDate);
    var now = new Date();
    var diffDays = Math.round((dueDate - now) / (24 * 60 * 60 * 1000));
    var nextText;
    var nextClass = '';
    if (diffDays < 0) { nextText = 'Due now!'; nextClass = 'due-now'; }
    else if (diffDays === 0) { nextText = 'Today'; nextClass = 'today'; }
    else if (diffDays === 1) { nextText = 'Tomorrow'; }
    else { nextText = 'In ' + diffDays + ' days'; }
    nextReviewEl.innerHTML = '<span class="explorer-time-text ' + nextClass + '">' + nextText + '</span>';
  }
  
  // Total reviews + Retention — same 5-review minimum gating used on the
  // Session Complete screen (js/ui/review.js): hide the rows below 5 reviews,
  // show real numbers at 5+.
  var totalReviews = srsEntry ? (srsEntry.totalReviews || 0) : 0;
  var showDetailedStats = totalReviews >= 5;
  var reviewCountItem = DOM.get('explorer-review-count-item');
  if (reviewCountItem) reviewCountItem.style.display = showDetailedStats ? '' : 'none';
  var reviewCountEl = DOM.get('explorer-review-count');
  if (reviewCountEl) {
    reviewCountEl.textContent = totalReviews;
  }
  var retentionItem = DOM.get('explorer-retention-item');
  if (retentionItem) retentionItem.style.display = showDetailedStats ? '' : 'none';
  var retentionEl = DOM.get('explorer-retention');
  if (retentionEl) {
    retentionEl.textContent = (showDetailedStats && srsStatus && typeof srsStatus.retention === 'number')
      ? Math.round(srsStatus.retention * 100) + '%'
      : '—';
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
    tafsirBtn.onclick = async function() {
      // Premium gate: daily tafsir limit for non-premium users
      if (!(await _explorerTafsirCheckDailyLimit())) {
        return;
      }
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
 * Check daily tafsir limit for non-premium users (explorer variant).
 * Returns true if the tafsir load should proceed, false if blocked.
 */
async function _explorerTafsirCheckDailyLimit() {
  // Premium users are uncapped
  if (window.__premium && window.__premium.hasFeature && window.__premium.hasFeature(window.__premium.FEATURES.UNLIMITED_TAFSIR)) {
    return true;
  }

  // Firestore-backed counter (survives clearing browser storage / incognito).
  // Awaits the authoritative Firestore count on a cold cache before deciding,
  // so the cap is enforced immediately even in a private window / cleared storage.
  var allowed = (window.__user && typeof window.__user.checkTafsirLimit === 'function')
    ? await window.__user.checkTafsirLimit()
    : _explorerTafsirLegacyLocalCheck();

  if (!allowed) {
    // Cap reached — disable button + show toast + upgrade prompt
    var tafsirBtn = document.getElementById('explorer-tafsir-btn');
    if (tafsirBtn) {
      tafsirBtn.disabled = true;
      tafsirBtn.title = 'Daily tafsir limit reached. Resets tomorrow.';
      tafsirBtn.textContent = '⚠️ Daily limit reached';
    }
    var msg = 'Daily tafsir limit reached. Resets tomorrow, or upgrade for unlimited access.';
    if (window.__ux && typeof window.__ux.showToast === 'function') {
      window.__ux.showToast(msg, 'warning', 4000);
    }
    if (window.__premium && typeof window.__premium.requestUpgrade === 'function') {
      window.__premium.requestUpgrade('unlimited-tafsir');
    }
  }
  return allowed;
}

/**
 * Fallback localStorage-only check used when the shared user service isn't
 * available yet (e.g. legacy UI path). Keeps the free cap functional either way.
 */
function _explorerTafsirLegacyLocalCheck() {
  try {
    var usage = JSON.parse(localStorage.getItem('quran_tafsir_usage') || '{}');
    var today = new Date().toISOString().slice(0, 10);
    if (usage.date !== today) {
      usage = { date: today, count: 0 };
    }
    if (usage.count >= 5) {
      return false;
    }
    usage.count++;
    localStorage.setItem('quran_tafsir_usage', JSON.stringify(usage));
  } catch (e) { /* ignore */ }
  return true;
}

/**
 * Render all occurrences in a collapsible list.
 */