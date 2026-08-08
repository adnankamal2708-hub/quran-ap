let _lastRenderedWordId = null;

function renderWordCard(w, currentIndex, total, isReview) {
  if (!w) return;
  
  // Reset occurrence index on word change
  if (_lastRenderedWordId !== w.id) {
    _currentOccurrenceIdx = 0;
    _lastRenderedWordId = w.id;
  }

  DOM.get('word-num').textContent = (isReview ? 'Review' : 'Word') + ' ' + (currentIndex + 1) + ' of ' + total;
  DOM.get('arabic-word').textContent = w.arabic;
  DOM.get('transliteration').textContent = w.translit;
  DOM.get('word-type').textContent = w.type;

  // Determine which occurrence to display (for canonical words, use current occurrence)
  var occ = null;
  var occCount = 0;
  if (w.occurrences && w.occurrences.length > 0) {
    occCount = w.occurrences.length;
    occ = w.occurrences[_currentOccurrenceIdx % w.occurrences.length];
  }

  // Surah/occurrence badge
  var surahBadge = DOM.get('surah-badge');
  if (surahBadge) {
    if (occ && occ.surahId && SURAH_INFO) {
      var si = SURAH_INFO[occ.surahId];
      var verseRef = occ.verseKey ? occ.verseKey.split(':')[1] : '';
      var occLabel = occCount > 1 ? ' (' + (_currentOccurrenceIdx + 1) + '/' + occCount + ')' : '';
      surahBadge.textContent = '\uD83D\uDCD6 ' + (si ? si.name : 'Surah ' + occ.surahId) + (verseRef ? ' \u00B7 Verse ' + verseRef : '') + occLabel;
      surahBadge.style.display = 'block';
    } else if (w.surahIds && w.surahIds.length > 0 && SURAH_INFO) {
      // Fallback: show first surah this word appears in
      var firstSurah = SURAH_INFO[w.surahIds[0]];
      surahBadge.textContent = '\uD83D\uDCD6 ' + (firstSurah ? firstSurah.name : 'Surah ' + w.surahIds[0]);
      surahBadge.style.display = 'block';
    } else {
      surahBadge.style.display = 'none';
    }
  }

  // Pattern display
  var patternEl = DOM.get('word-pattern');
  if (patternEl) {
    if (w.pattern && w.pattern !== '\u2014') {
      patternEl.textContent = 'Pattern: ' + w.pattern;
      patternEl.style.display = 'block';
    } else {
      patternEl.style.display = 'none';
    }
  }

  DOM.get('meaning').textContent = w.meaning;
  var occLabel = occCount > 1 ? ' (' + occCount + ' contexts)' : '';
  DOM.get('occurrences').textContent = '\u2726 Appears ' + w.occ.toLocaleString() + ' times' + occLabel;

  DOM.get('progress-fill').style.width = Math.round(((currentIndex + 1) / total) * 100) + '%';
  DOM.get('progress-text').textContent = (currentIndex + 1) + ' / ' + total;

  var prevBtn = DOM.get('btn-prev');
  if (prevBtn) prevBtn.disabled = currentIndex === 0;

  var nextBtn = DOM.get('btn-next');
  if (nextBtn) {
    nextBtn.textContent = currentIndex < total - 1 ? 'Next \u2192' : isReview ? 'Done \u2713' : 'Quiz \u270F\uFE0F';
  }

  // Word learning context — show why the user is seeing this word (Part 4)
  renderWordLearningContext(w);

  // SRS pill (uses canonical word ID)
  renderSRSStatusPill(w.id);

  // Root box
  renderRootBox(w);

  // Root reinforcement badge — show when this word's root was previously learned (Priority 4)
  renderRootReinforcementBadge(w);

  // Premium gate: word relationships (similar, derived forms, semantic groups, etc.)
  var _hasWordRels = window.__premium && window.__premium.hasFeature(window.__premium.FEATURES.WORD_RELATIONSHIPS);
  
  // Word network
  renderWordNetwork(w);

  // Extended relationships
  renderRelatedWords(w);
  renderDerivedForms(w);
  renderSemanticGroups(w);
  renderConfusedWith(w);
  renderContextualEquivalents(w);
  renderMorphRelations(w);
  
  // For free users: hide all relationship sections and show one locked panel
  if (!_hasWordRels) {
    var _relSections = [
      'word-network-section',
      'similar-words-section',
      'opposite-words-section',
      'related-words-section',
      'derived-forms-section',
      'semantic-groups-section',
      'confused-with-section',
      'contextual-equiv-section',
      'morph-relations-section',
    ];
    for (var _rsi = 0; _rsi < _relSections.length; _rsi++) {
      var _relEl = document.getElementById(_relSections[_rsi]);
      if (_relEl) _relEl.style.display = 'none';
    }
    // Hide any premium empty state, then render the single locked panel
    var _premEmpty = document.getElementById('word-relationships-empty');
    if (_premEmpty) _premEmpty.style.display = 'none';
    _renderRelationshipsLockedPanel();
  } else {
    // Premium: clear any stale locked panel left from an earlier free-tier
    // render. Without this, a premium user (or a user who upgraded live via
    // the onSnapshot listener) would keep seeing a dead
    // "Word Relationships — Upgrade to Premium" card whose button no-ops.
    var _lockedPanel = document.getElementById('word-relationships-locked');
    if (_lockedPanel) _lockedPanel.style.display = 'none';
    // Word-specific empty state when this word has no relationship data at
    // all — show a message instead of a broken-looking gap.
    if (_wordHasAnyRelationshipData(w)) {
      var _emptyState = document.getElementById('word-relationships-empty');
      if (_emptyState) _emptyState.style.display = 'none';
    } else {
      _renderWordRelationshipsEmptyState();
    }
  }

  // Store occurrence data for showAyah/showWordContent
  window.__currentOccurrence = occ;

  // Hide ayah & tafsir on navigation
  var ayahBox = DOM.get('ayah-box');
  var tafsirBox = DOM.get('tafsir-box');
  var tafsirBtn = DOM.get('tafsir-btn');
  if (ayahBox) ayahBox.classList.remove('visible');
  if (tafsirBox) tafsirBox.classList.remove('visible');
  if (tafsirBtn) tafsirBtn.style.display = 'block';

  // SRS buttons only show if word has been seen or not first word
  var srs = getSRSStatus(w.id);
  var showSRS = srs.status !== 'new' || currentIndex > 0;
  var srsRow = DOM.get('srs-row');
  var srsLabel = DOM.get('srs-label');
  if (srsRow) srsRow.style.display = showSRS ? 'grid' : 'none';
  if (srsLabel) srsLabel.style.display = showSRS ? 'block' : 'none';

  updateBookmarkButton(w.id);
  var notesBox = DOM.get('notes-box');
  var notesInput = DOM.get('notes-input');
  if (notesBox) notesBox.style.display = 'block';
  if (notesInput) notesInput.value = getNote(w.id);

  // Show occurrence navigation for words with multiple contexts
  var occNav = DOM.get('occ-nav');
  if (occNav) {
    if (occCount > 1) {
      occNav.style.display = 'flex';
      var occPrevBtn = DOM.get('occ-prev');
      var occNextBtn = DOM.get('occ-next');
      var occLabel = DOM.get('occ-label');
      if (occLabel) occLabel.textContent = (_currentOccurrenceIdx + 1) + '/' + occCount;
      if (occPrevBtn) occPrevBtn.disabled = _currentOccurrenceIdx === 0;
      if (occNextBtn) occNextBtn.disabled = _currentOccurrenceIdx >= occCount - 1;
    } else {
      occNav.style.display = 'none';
    }
  }

  // Animate card with bouncy entrance on content change
  var card = DOM.get('word-card');
  if (card) {
    card.classList.remove('card-entrance', 'fade-in');
    void card.offsetHeight;
    card.classList.add('card-entrance');
  }
}

/**
 * Navigate to the next occurrence of the current canonical word.
 */
function nextOccurrence() {
  var w = typeof getCurrentWord === 'function' ? getCurrentWord() : null;
  if (!w || !w.occurrences) return;
  if (_currentOccurrenceIdx < w.occurrences.length - 1) {
    _currentOccurrenceIdx++;
    updateWordCard();
  }
}

/**
 * Navigate to the previous occurrence of the current canonical word.
 */
function prevOccurrence() {
  var w = typeof getCurrentWord === 'function' ? getCurrentWord() : null;
  if (!w || !w.occurrences) return;
  if (_currentOccurrenceIdx > 0) {
    _currentOccurrenceIdx--;
    updateWordCard();
  }
}

/**
 * Wire occurrence navigation events.
 */
function wireOccurrenceNav() {
  var prevBtn = DOM.get('occ-prev');
  var nextBtn = DOM.get('occ-next');
  if (prevBtn) prevBtn.onclick = prevOccurrence;
  if (nextBtn) nextBtn.onclick = nextOccurrence;
}

/**
 * Render the SRS status pill with stage, retention, and leech info.
 */
function renderSRSStatusPill(wordId) {
  var srs = getSRSStatus(wordId);
  var pill = DOM.get('sr-pill');
  if (!pill) return;
  var stageLabels = ['', '\uD83D\uDD0D', '\uD83C\uDF31', '\uD83D\uDCA1'];
  var stageNames = ['', 'Learning', 'Young', 'Mature'];

  if (srs.status === 'new') {
    pill.className = 'sr-pill sr-new';
    pill.textContent = '\uD83C\uDD95 New word';
    return;
  }

  var label = '';
  if (srs.status === 'review') {
    var overdueText = srs.daysUntilDue < 0 ? ' (overdue!)' : '';
    var leechBadge = srs.isLeech ? ' \uD83D\uDCA2' : '';
    label = '\uD83D\uDD01 Due for review' + overdueText + leechBadge;
    pill.className = 'sr-pill sr-review';
  } else {
    var daysText = srs.daysUntilDue > 0 ? 'Due in ' + srs.daysUntilDue + 'd' : 'Due today';
    var stageIcon = stageLabels[srs.stage] || '';
    var stageName = stageNames[srs.stage] || '';
    var retentionText = srs.retention ? Math.round(srs.retention * 100) + '%' : '';
    label = stageIcon + ' ' + stageName + ' \u00B7 ' + retentionText + ' \u00B7 ' + daysText;
    pill.className = 'sr-pill sr-mastered';
  }

  pill.textContent = label;

  // Special styling for leeched words — set class name instead of inline styles
  if (srs.isLeech) {
    pill.classList.add('sr-leech');
  } else {
    pill.classList.remove('sr-leech');
  }
}

/**
 * Render learning context — shows why the user is seeing this word.
 * Displays foundation lesson, frequency rank, occurrence count, and surah count.
 */
function renderWordLearningContext(w) {
  if (!w) return;
  var ctxEl = document.getElementById('word-learning-context');
  if (!ctxEl) return;
  
  var parts = [];
  
  // Foundation lesson source
  if (typeof getFoundationLessonForWord === 'function') {
    var fLesson = getFoundationLessonForWord(w.id);
    if (fLesson !== null && fLesson >= 0) {
      parts.push('Learned in Foundation Lesson ' + (fLesson + 1));
    }
  }
  
  // Frequency rank
  if (w.frequencyRank && w.frequencyRank > 0) {
    parts.push('#' + w.frequencyRank + ' most frequent');
  }
  
  // Occurrence count
  if (w.occ && w.occ > 0) {
    parts.push('Occurs ' + w.occ.toLocaleString() + ' times');
  }
  
  // Surah count
  if (w.surahCount && w.surahCount > 0) {
    parts.push('In ' + w.surahCount + ' surah' + (w.surahCount !== 1 ? 's' : ''));
  } else if (w.surahIds && w.surahIds.length > 0) {
    parts.push('In ' + w.surahIds.length + ' surah' + (w.surahIds.length !== 1 ? 's' : ''));
  }
  
  if (parts.length > 0) {
    ctxEl.innerHTML = '<span style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:4px;flex-wrap:wrap">' +
      '<span>📍</span><span>' + parts.join(' \u00B7 ') + '</span></span>';
    ctxEl.style.display = 'block';
  } else {
    ctxEl.style.display = 'none';
  }
}

/**
 * Render a subtle badge when a word's root was previously learned in an earlier lesson.
 * Connects new vocabulary to existing root knowledge for Arabic pattern recognition.
 */
function renderRootReinforcementBadge(w) {
  if (!w || !w.root || w.root === '\u2014') return;
  
  // Only show during normal word study (not review mode)
  if (reviewMode) return;
  
  // Only show in foundation/lesson mode
  var mode = typeof getOrganizationMode === 'function' ? getOrganizationMode() : '';
  if (mode !== 'foundation') return;
  
  var badgeEl = document.getElementById('root-reinforcement-badge');
  if (!badgeEl) return;
  
  // Check if any same-root words from previous lessons have been studied (SRS stage > 0)
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var sameRootPreviouslyLearned = false;
  var previousWord = null;
  
  var allFWords = typeof getAllFoundationWords === 'function' ? getAllFoundationWords() : [];
  for (var bi = 0; bi < allFWords.length; bi++) {
    var fw = allFWords[bi];
    if (fw.id === w.id) continue;
    if (fw.root === w.root && srsData[fw.id] && srsData[fw.id].stage > 0) {
      sameRootPreviouslyLearned = true;
      previousWord = fw;
      break;
    }
  }
  
  if (sameRootPreviouslyLearned && previousWord) {
    badgeEl.innerHTML = '<span class="root-reinforcement-badge">\uD83D\uDCCE Previously learned root \u00B7 Same word family as: <span class="root-reinforcement-word">' + previousWord.arabic + '</span> (' + previousWord.english + ')</span>';
    badgeEl.style.display = 'block';
  } else {
    badgeEl.style.display = 'none';
  }
}

/**
 * Render the word network section (similar & opposite words).
 */
function renderWordNetwork(w) {
  if (!w) return;

  // Similar words
  var similarSection = document.getElementById('similar-words-section');
  var similarList = document.getElementById('similar-words-list');
  similarList.innerHTML = '';

  var similarWords = findWordsByArabicList(w.similarWords);
  if (similarWords.length > 0) {
    similarSection.style.display = 'block';
    similarWords.forEach(function (sw) {
      similarList.appendChild(createWordNetworkChip(sw, 'similar'));
    });
  } else {
    similarSection.style.display = 'none';
  }

  // Opposite words
  var oppositeSection = document.getElementById('opposite-words-section');
  var oppositeList = document.getElementById('opposite-words-list');
  oppositeList.innerHTML = '';

  var oppositeWords = findWordsByArabicList(w.oppositeWords);
  if (oppositeWords.length > 0) {
    oppositeSection.style.display = 'block';
    oppositeWords.forEach(function (ow) {
      oppositeList.appendChild(createWordNetworkChip(ow, 'opposite'));
    });
  } else {
    oppositeSection.style.display = 'none';
  }
}

/**
 * Render the related words section.
 */
function renderRelatedWords(w) {
  if (!w) return;
  var section = document.getElementById('related-words-section');
  var list = document.getElementById('related-words-list');
  if (!section || !list) return;
  list.innerHTML = '';

  var related = typeof getRelatedWordObjects === 'function' ? getRelatedWordObjects(w) : [];
  if (related.length > 0) {
    section.style.display = 'block';
    related.forEach(function(rw) {
      var wo = findWordByArabic(rw.arabic);
      if (wo) {
        list.appendChild(createWordNetworkChip(wo, 'related'));
      }
    });
  } else {
    section.style.display = 'none';
  }
}

/**
 * Render the derived forms section.
 */
function renderDerivedForms(w) {
  if (!w) return;
  var section = document.getElementById('derived-forms-section');
  var list = document.getElementById('derived-forms-list');
  if (!section || !list) return;
  list.innerHTML = '';

  var forms = typeof getDerivedForms === 'function' ? getDerivedForms(w) : [];
  if (forms.length > 0) {
    section.style.display = 'block';
    forms.forEach(function(df) {
      var d = document.createElement('div');
      d.className = 'word-network-chip';
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', df.formName + ': ' + df.arabic + ' - ' + df.english);
      d.innerHTML =
        '<span class="word-network-chip-arabic">' + df.arabic + '</span>' +
        '<span class="word-network-chip-eng">' + df.english + '</span>' +
        '<span class="word-network-chip-sub">' + df.formName + '</span>';
      var wo = findWordByArabic(df.arabic);
      if (wo) {
        d.onclick = function() { navigateToWord(wo); };
        d.onkeydown = function(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToWord(wo); }
        };
      }
      list.appendChild(d);
    });
  } else {
    section.style.display = 'none';
  }
}

/**
 * Render the semantic groups section.
 */
function renderSemanticGroups(w) {
  if (!w) return;
  var section = document.getElementById('semantic-groups-section');
  var list = document.getElementById('semantic-groups-list');
  if (!section || !list) return;
  list.innerHTML = '';

  var groups = typeof getSemanticGroups === 'function' ? getSemanticGroups(w) : [];
  if (groups.length > 0) {
    section.style.display = 'block';
    groups.forEach(function(sg) {
      var d = document.createElement('div');
      d.className = 'semantic-group-chip';
      d.innerHTML =
        '<div class="semantic-group-name">' + sg.group + '</div>' +
        '<div class="semantic-group-info">' + sg.count + ' words \u00B7 e.g. ' + sg.sampleWords.join(', ') + '</div>';
      list.appendChild(d);
    });
  } else {
    section.style.display = 'none';
  }
}

/**
 * Render the confused-with (frequently confused) words section.
 */
function renderConfusedWith(w) {
  if (!w) return;
  var section = document.getElementById('confused-with-section');
  var list = document.getElementById('confused-with-list');
  if (!section || !list) return;
  list.innerHTML = '';

  var confused = typeof getConfusedWith === 'function' ? getConfusedWith(w) : [];
  if (confused.length > 0) {
    section.style.display = 'block';
    confused.forEach(function(cw) {
      var d = document.createElement('div');
      d.className = 'word-network-chip';
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', 'Confused with: ' + cw.arabic + ' - ' + cw.english + ' (' + cw.similarity + ' ' + cw.reason + ')');
      var icon = cw.similarity === 'high' ? '\uD83D\uDD34' : '\uD83D\uDFE1';
      d.innerHTML =
        '<span class="word-network-chip-arabic">' + cw.arabic + '</span>' +
        '<span class="word-network-chip-eng">' + cw.english + '</span>' +
        '<span class="word-network-chip-sub">' + icon + ' ' + cw.reason + '</span>';
      var wo = findWordByArabic(cw.arabic);
      if (wo) {
        d.onclick = function() { navigateToWord(wo); };
        d.onkeydown = function(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToWord(wo); }
        };
      }
      list.appendChild(d);
    });
  } else {
    section.style.display = 'none';
  }
}

/**
 * Render the contextual equivalents section.
 */
function renderContextualEquivalents(w) {
  if (!w) return;
  var section = document.getElementById('contextual-equiv-section');
  var list = document.getElementById('contextual-equiv-list');
  if (!section || !list) return;
  list.innerHTML = '';

  var equivs = typeof getContextualEquivalents === 'function' ? getContextualEquivalents(w) : [];
  if (equivs.length > 0) {
    section.style.display = 'block';
    equivs.forEach(function(eq) {
      var d = document.createElement('div');
      d.className = 'word-network-chip';
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', 'Equiv: ' + eq.arabic + ' - ' + eq.english);
      d.innerHTML =
        '<span class="word-network-chip-arabic">' + eq.arabic + '</span>' +
        '<span class="word-network-chip-eng">' + eq.english + '</span>';
      var wo = findWordByArabic(eq.arabic);
      if (wo) {
        d.onclick = function() { navigateToWord(wo); };
        d.onkeydown = function(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToWord(wo); }
        };
      }
      list.appendChild(d);
    });
  } else {
    section.style.display = 'none';
  }
}

/**
 * Render the morphological relationships section.
 */
function renderMorphRelations(w) {
  if (!w) return;
  var section = document.getElementById('morph-relations-section');
  var list = document.getElementById('morph-relations-list');
  if (!section || !list) return;
  list.innerHTML = '';

  var morphs = typeof getMorphologicalRelationships === 'function' ? getMorphologicalRelationships(w) : [];
  if (morphs.length > 0) {
    section.style.display = 'block';
    morphs.forEach(function(mr) {
      var d = document.createElement('div');
      d.className = 'word-network-chip morph-chip';
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', 'Morph: ' + mr.arabic + ' - ' + mr.english + ' (' + mr.relationshipType + ')');
      d.innerHTML =
        '<span class="word-network-chip-arabic">' + mr.arabic + '</span>' +
        '<span class="word-network-chip-eng">' + mr.english + '</span>' +
        '<span class="word-network-chip-sub">' + mr.relationshipType + '</span>';
      var wo = findWordByArabic(mr.arabic);
      if (wo) {
        d.onclick = function() { navigateToWord(wo); };
        d.onkeydown = function(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToWord(wo); }
        };
      }
      list.appendChild(d);
    });
  } else {
    section.style.display = 'none';
  }
}

/**
 * Create a chip element for a word in the word-network section.
 */
function createWordNetworkChip(wordObj, type) {
  var d = document.createElement('div');
  d.className = 'word-network-chip';
  d.setAttribute('role', 'button');
  d.setAttribute('tabindex', '0');
  d.setAttribute('aria-label', type + ' word: ' + wordObj.arabic + ' - ' + wordObj.english);
  d.innerHTML =
    '<span class="word-network-chip-arabic">' + wordObj.arabic + '</span>' +
    '<span class="word-network-chip-eng">' + wordObj.english + '</span>';
  d.onclick = function () {
    navigateToWord(wordObj);
  };
  d.onkeydown = function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateToWord(wordObj);
    }
  };
  return d;
}

/**
 * Render a single locked panel for free users replacing 6 relationship sections.
 */
function _renderRelationshipsLockedPanel() {
  var container = document.getElementById('word-relationships-locked');
  if (!container) {
    // Create the locked panel container after the root box
    var rootBox = document.getElementById('root-box');
    if (rootBox && rootBox.parentNode) {
      container = document.createElement('div');
      container.id = 'word-relationships-locked';
      rootBox.parentNode.insertBefore(container, rootBox.nextSibling);
    }
  }
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML =
    '<div class="profile-subsection" style="border:1px solid var(--gold-dim);border-radius:var(--radius-card);padding:16px;text-align:center;margin-top:12px">' +
      '<div style="font-size:24px;margin-bottom:6px">🔗</div>' +
      '<div style="font-family:var(--serif);font-size:15px;color:var(--gold-light);margin-bottom:6px">Word Relationships</div>' +
      '<div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">' +
        'Explore how words connect — similar words, derived forms, semantic groups, ' +
        'morphological relatives, and more with Premium.' +
      '</div>' +
      '<button class="btn btn-sm" type="button" onclick="if(window.__premium)window.__premium.requestUpgrade(\'word-relationships\')">⭐ Upgrade to Premium</button>' +
    '</div>';
}

/**
 * Whether a word has ANY relationship data (similar/opposite/related/derived/
 * semantic/confused). Used to show an explicit empty state instead of a gap.
 */
function _wordHasAnyRelationshipData(w) {
  if (!w) return false;
  var count = 0;
  try {
    if (w.similarWords && w.similarWords.length) count++;
    if (w.oppositeWords && w.oppositeWords.length) count++;
    var _rw = typeof getRelatedWordObjects === 'function' ? getRelatedWordObjects(w) : [];
    if (_rw && _rw.length) count++;
    var _df = typeof getDerivedForms === 'function' ? getDerivedForms(w) : [];
    if (_df && _df.length) count++;
    var _sg = typeof getSemanticGroups === 'function' ? getSemanticGroups(w) : [];
    if (_sg && _sg.length) count++;
    var _cw = typeof getConfusedWith === 'function' ? getConfusedWith(w) : [];
    if (_cw && _cw.length) count++;
    var _mr = typeof getMorphologicalRelationships === 'function' ? getMorphologicalRelationships(w) : [];
    if (_mr && _mr.length) count++;
    var _ce = typeof getContextualEquivalents === 'function' ? getContextualEquivalents(w) : [];
    if (_ce && _ce.length) count++;
  } catch (e) { /* never break rendering on a data quirk */ }
  return count > 0;
}

/**
 * Render a word-specific empty state for premium words that genuinely have no
 * relationship data (mirrors the existing "No derived forms" empty-state
 * pattern used elsewhere in the app).
 */
function _renderWordRelationshipsEmptyState() {
  var container = document.getElementById('word-relationships-empty');
  if (!container) {
    // Place it right after the root box, like the locked panel
    var rootBox = document.getElementById('root-box');
    if (rootBox && rootBox.parentNode) {
      container = document.createElement('div');
      container.id = 'word-relationships-empty';
      rootBox.parentNode.insertBefore(container, rootBox.nextSibling);
    }
  }
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML =
    '<div class="word-network-section" style="text-align:center;padding:14px 16px">' +
      '<div class="word-network-title" style="color:var(--gold-dim);margin-bottom:4px">🔗 Word Relationships</div>' +
      '<div style="font-size:12px;color:var(--text-muted);line-height:1.6">No word relationships found for this word.</div>' +
    '</div>';
}

/**
 * Render the root system box for a word.
 * Root family words are clickable — clicking navigates directly to that word.
 */
function renderRootBox(w) {
  if (!w) return;
  document.getElementById('root-arabic-big').textContent = w.root;
  document.getElementById('root-core-meaning').textContent = w.rootMeaning;
  document.getElementById('root-pattern').textContent = w.rootPattern;

  const fam = document.getElementById('root-family');
  fam.innerHTML = '';
  (w.rootFamily || []).forEach((rf) => {
    const d = document.createElement('div');
    d.className = 'root-word';
    d.innerHTML = `<span class="root-word-arabic">${rf.a}</span><span class="root-word-eng">${rf.e}</span>`;
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('aria-label', `Show details for ${rf.a} (${rf.e})`);
    d.onclick = function () {
      // Navigate to the root family word if it exists in the vocabulary
      var target = findWordByArabic(rf.a);
      if (target) {
        navigateToWord(target);
      }
    };
    d.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var target = findWordByArabic(rf.a);
        if (target) {
          navigateToWord(target);
        }
      }
    };
    fam.appendChild(d);
  });
}

/**
 * Show the ayah (verse) context for the current word.
 * Uses the current occurrence if the word has multiple contexts.
 */
function showAyah(w) {
  if (!w) return;
  // R3: route the ayah text through the shared highlight helper so the
  // target word is always gold-highlighted at runtime, regardless of whether
  // the hand-authored data embeds <span class="ayah-highlight"> markup.
  // Falls back to the raw text when the helper isn't loaded (test env).
  var ayahArabicEl = document.getElementById('ayah-arabic');
  var _applyHighlight = typeof _highlightOccurrenceText === 'function'
    ? function(txt) { return _highlightOccurrenceText(txt || '', w); }
    : function(txt) { return txt || ''; };

  // Use the current occurrence from the word card
  var occ = window.__currentOccurrence || null;
  if (occ && occ.ayahA) {
    ayahArabicEl.innerHTML = _applyHighlight(occ.ayahA);
    document.getElementById('ayah-translation').innerHTML = occ.ayahT;
    document.getElementById('ayah-ref').textContent = occ.ayahR;
  } else if (w.occurrences && w.occurrences.length > 0) {
    var firstOcc = w.occurrences[0];
    ayahArabicEl.innerHTML = _applyHighlight(firstOcc.ayahA);
    document.getElementById('ayah-translation').innerHTML = firstOcc.ayahT;
    document.getElementById('ayah-ref').textContent = firstOcc.ayahR;
  } else if (w.ayahA) {
    // Fallback for backward compatibility
    ayahArabicEl.innerHTML = _applyHighlight(w.ayahA);
    document.getElementById('ayah-translation').innerHTML = w.ayahT;
    document.getElementById('ayah-ref').textContent = w.ayahR;
  }
  document.getElementById('ayah-box').classList.add('visible');
}

/**
 * Load and display Ibn Kathir tafsir for the current word.
 * Uses the current occurrence's tafsir if available.
 */
async function loadTafsir(w) {
  if (!w) return;
  
  // Premium gate: daily tafsir limit (5/day for free/guest users)
  if (!(await _tafsirCheckDailyLimit())) {
    return;
  }
  
  var occ = window.__currentOccurrence || null;
  document.getElementById('tafsir-box').classList.add('visible');
  document.getElementById('tafsir-text').innerHTML = '<span class="tafsir-loading">Loading Ibn Kathir commentary\u2026</span>';
  document.getElementById('tafsir-btn').style.display = 'none';
  setTimeout(() => {
    var tafsirText = '';
    if (occ && occ.tafsir) {
      tafsirText = occ.tafsir;
    } else if (w.occurrences && w.occurrences.length > 0) {
      tafsirText = w.occurrences[0].tafsir;
    } else if (w.tafsir) {
      tafsirText = w.tafsir;
    }
    document.getElementById('tafsir-text').textContent = tafsirText;
  }, 400);
}

/**
 * Check daily tafsir limit for non-premium users.
 * Returns true if the tafsir load should proceed, false if blocked.
 */
async function _tafsirCheckDailyLimit() {
  // Premium users are uncapped
  if (window.__premium && window.__premium.hasFeature && window.__premium.hasFeature(window.__premium.FEATURES.UNLIMITED_TAFSIR)) {
    return true;
  }

  // Firestore-backed counter (survives clearing browser storage / incognito).
  // Awaits the authoritative Firestore count on a cold cache before deciding,
  // so the cap is enforced immediately even in a private window / cleared storage.
  var allowed = (window.__user && typeof window.__user.checkTafsirLimit === 'function')
    ? await window.__user.checkTafsirLimit()
    : _tafsirLegacyLocalCheck();

  if (!allowed) {
    // Cap reached — disable button + show toast + upgrade prompt
    var tafsirBtn = document.getElementById('tafsir-btn');
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
function _tafsirLegacyLocalCheck() {
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
  } catch (e) {
    // localStorage unavailable — allow load
  }
  return true;
}

/**
 * Highlight the root box by scrolling it into view.
 */
function highlightRootBox() {
  const rootBox = document.getElementById('root-box');
  if (!rootBox) return;
  rootBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  rootBox.style.transition = 'border-color 0.4s ease';
  rootBox.style.borderColor = 'var(--gold)';
  setTimeout(() => { rootBox.style.borderColor = ''; }, 1200);
}

/**
 * Update the bookmark button state.
 */
function updateBookmarkButton(wordId) {
  var btn = DOM.get('qa-bookmark');
  if (!btn) return;
  if (isFavorite(wordId)) {
    btn.textContent = '\u2B50 Bookmarked';
    btn.classList.add('active-qa');
  } else {
    btn.textContent = '\u2606 Bookmark';
    btn.classList.remove('active-qa');
  }
}

/**
 * Update the daily goal progress ring based on reviews done today.
 */
function updateGoalRing() {
  var ringFill = DOM.get('goal-ring-fill');
  var ringText = DOM.get('goal-ring-text');
  var ringWrap = DOM.get('goal-ring-wrap');
  if (!ringFill || !ringText || !ringWrap) return;

  // Get stats and compute progress
  var srsObj = window.__srs;
  var stats = (srsObj && srsObj.getStats) ? srsObj.getStats() : null;
  if (!stats) {
    ringFill.setAttribute('stroke-dasharray', '0, 100');
    ringText.textContent = '0';
    ringWrap.setAttribute('aria-valuenow', '0');
    return;
  }

  var dailyLimit = (srsObj && srsObj.getDailyReviewLimit)
    ? srsObj.getDailyReviewLimit()
    : 25;
  var reviewsToday = stats.reviewsToday || 0;
  if (dailyLimit <= 0) dailyLimit = 25;
  var pct = Math.min(100, Math.round((reviewsToday / dailyLimit) * 100));
  var circumference = 100;
  var offset = Math.round((pct / 100) * circumference);

  ringFill.setAttribute('stroke-dasharray', offset + ', ' + circumference);
  ringText.textContent = pct;
  ringWrap.setAttribute('aria-valuenow', String(pct));
  ringWrap.title = 'Daily review goal: ' + reviewsToday + ' of ' + dailyLimit + ' (' + pct + '%)';
}

/**
 * Update the top stats bar and total word count.
 */
function updateStatsDisplay() {
  var data = loadSRS();
  var totalWords = DOM.get('stat-total');
  if (totalWords) {
    // Use canonical word count if available, otherwise fall back to ALL_WORDS length
    var count = (typeof getCanonicalWordCount === 'function' && getCanonicalWordCount() > 0)
      ? getCanonicalWordCount() : ALL_WORDS.length;
    totalWords.textContent = count;
  }
  var learned = 0;
  var lessonWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : ALL_WORDS.slice(0, 20);
  for (var i = 0; i < lessonWords.length; i++) {
    var entry = data[lessonWords[i].id];
    if (entry && entry.stage && entry.stage > 0) learned++;
  }
  var due = getDueReviews().length;
  DOM.get('stat-learned').textContent = learned;
  DOM.get('stat-review').textContent = due;

  // Update the goal ring
  updateGoalRing();
}

/**
 * Show or update the review banner.
 */