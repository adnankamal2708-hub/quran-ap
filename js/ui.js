// ═══════════════════════════════════════════════════════════════
// ui.js — UI Rendering Module
// All DOM manipulation functions — no application state here
// ═══════════════════════════════════════════════════════════════

// ── DOM element cache ─────────────────────────────────────────
// Cache frequently accessed DOM elements to avoid repeated getElementById calls
const DOM = {
  _cache: {},
  get: function(id) {
    if (!this._cache[id]) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  }
};

/**
 * Extract the short meaning from a full meaning string.
 * Many meanings follow the format "Short meaning — Additional context".
 */
function getShortMeaning(meaning) {
  return (meaning || '').split('\u2014')[0].trim();
}

/**
 * Set active view, switching visible tab content and nav tab highlight.
 */
function setView(viewName) {
  // All possible views — both main content and overlay views
  const views = ['learn', 'quiz', 'list', 'stats', 'auth', 'profile', 'settings'];
  for (var i = 0; i < views.length; i++) {
    var name = views[i];
    var viewEl = DOM.get('view-' + name);
    if (viewEl) viewEl.classList.toggle('active', name === viewName);

    // Only toggle tab highlights for main nav tabs
    if (name === 'learn' || name === 'quiz' || name === 'list' || name === 'stats') {
      var tabEl = DOM.get('tab-' + name);
      if (tabEl) tabEl.classList.toggle('active', name === viewName);
    }
  }
  // Animate the newly activated view (skip on first render to avoid flicker)
  if (window.__viewHasBeenSet) {
    var viewEl = DOM.get('view-' + viewName);
    if (viewEl) {
      viewEl.classList.remove('view-animate');
      void viewEl.offsetHeight;
      viewEl.classList.add('view-animate');
    }
  } else {
    window.__viewHasBeenSet = true;
  }

  var content = DOM.get('content');
  if (content) content.scrollTop = 0;
}

/** Track current occurrence index when viewing a canonical word */
let _currentOccurrenceIdx = 0;

/**
 * Render the word card for a given word at the given position.
 * Supports canonical words with multiple occurrences.
 */
function renderWordCard(w, currentIndex, total, isReview) {
  if (!w) return;
  
  // Reset occurrence index on word change
  _currentOccurrenceIdx = 0;

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
      surahBadge.textContent = '📖 ' + (si ? si.name : 'Surah ' + occ.surahId) + (verseRef ? ' · Verse ' + verseRef : '') + occLabel;
      surahBadge.style.display = 'block';
    } else if (w.surahIds && w.surahIds.length > 0 && SURAH_INFO) {
      // Fallback: show first surah this word appears in
      var firstSurah = SURAH_INFO[w.surahIds[0]];
      surahBadge.textContent = '📖 ' + (firstSurah ? firstSurah.name : 'Surah ' + w.surahIds[0]);
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

  // SRS pill (uses canonical word ID)
  renderSRSStatusPill(w.id);

  // Root box
  renderRootBox(w);

  // Word network
  renderWordNetwork(w);

  // Extended relationships
  renderRelatedWords(w);
  renderDerivedForms(w);
  renderSemanticGroups(w);
  renderConfusedWith(w);
  renderContextualEquivalents(w);
  renderMorphRelations(w);

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

  // Animate card with faster, smoother transition
  var card = DOM.get('word-card');
  if (card) {
    card.classList.remove('fade-in');
    void card.offsetHeight;
    card.classList.add('fade-in');
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
        '<div class="semantic-group-info">' + sg.count + ' words · e.g. ' + sg.sampleWords.join(', ') + '</div>';
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
      var icon = cw.similarity === 'high' ? '🔴' : '🟡';
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
  // Use the current occurrence from the word card
  var occ = window.__currentOccurrence || null;
  if (occ && occ.ayahA) {
    document.getElementById('ayah-arabic').innerHTML = occ.ayahA;
    document.getElementById('ayah-translation').innerHTML = occ.ayahT;
    document.getElementById('ayah-ref').textContent = occ.ayahR;
  } else if (w.occurrences && w.occurrences.length > 0) {
    var firstOcc = w.occurrences[0];
    document.getElementById('ayah-arabic').innerHTML = firstOcc.ayahA;
    document.getElementById('ayah-translation').innerHTML = firstOcc.ayahT;
    document.getElementById('ayah-ref').textContent = firstOcc.ayahR;
  } else if (w.ayahA) {
    // Fallback for backward compatibility
    document.getElementById('ayah-arabic').innerHTML = w.ayahA;
    document.getElementById('ayah-translation').innerHTML = w.ayahT;
    document.getElementById('ayah-ref').textContent = w.ayahR;
  }
  document.getElementById('ayah-box').classList.add('visible');
}

/**
 * Load and display Ibn Kathir tafsir for the current word.
 * Uses the current occurrence's tafsir if available.
 */
function loadTafsir(w) {
  if (!w) return;
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
function updateReviewBanner() {
  var due = getDueReviews();
  var banner = DOM.get('review-banner');
  var bannerText = DOM.get('review-banner-text');
  if (!banner || !bannerText) return;
  if (due.length > 0) {
    banner.classList.add('visible');
    bannerText.textContent = due.length + ' word' + (due.length !== 1 ? 's' : '') + ' due for review today';
  } else {
    banner.classList.remove('visible');
  }
}

/**
 * Render the word list with filtering and search applied.
 */
function renderWordList() {
  var searchInput = DOM.get('search-input');
  var searchQuery = searchInput ? searchInput.value : '';
  var activeType = document.querySelector('#filter-type-chips .chip-active');
  var activeStatus = document.querySelector('#filter-status-chips .chip-active');
  var typeFilter = activeType ? activeType.getAttribute('data-value') : 'all';
  var statusFilter = activeStatus ? activeStatus.getAttribute('data-value') : 'all';

  // Apply all filters in sequence
  var words = searchWords(searchQuery);
  words = filterByCategory(words, typeFilter);
  if (statusFilter === 'favorites') {
    words = filterByFavorites(words);
  } else {
    words = filterByStatus(words, statusFilter);
  }

  // Update count
  var countEl = DOM.get('list-count');
  if (countEl) countEl.textContent = words.length + ' word' + (words.length !== 1 ? 's' : '');

  // Use DocumentFragment for batch insertion to reduce reflows
  var container = DOM.get('wordlist-container');
  container.innerHTML = '';

  if (words.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-muted);font-size:13px">No words match your search or filters.</div>';
    return;
  }

  var fragment = document.createDocumentFragment();
  var srsData = loadSRS();
  var favs = loadFavorites();

  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var entry = srsData[w.id];
    var badge = '';
    if (entry && entry.stage >= 3) {
      badge = '\uD83D\uDCA1';
    } else if (entry && entry.stage >= 2) {
      badge = '\uD83C\uDF31';
    } else if (entry && entry.stage >= 1 && Date.now() >= entry.dueDate) {
      badge = entry.isLeech ? '\uD83D\uDCA2' : '\uD83D\uDD01';
    } else {
      badge = '\uD83C\uDD95';
    }
    var favStar = favs[w.id] ? '\u2B50' : '';
    var d = document.createElement('div');
    d.className = 'wordlist-item';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    var shortMeaning = getShortMeaning(w.meaning);
    d.setAttribute('aria-label', 'Study ' + w.arabic + ' - ' + shortMeaning);
    d.innerHTML =
      '<div class="wordlist-arabic">' + w.arabic + '</div>' +
      '<div class="wordlist-info">' +
        '<div class="wordlist-meaning">' + shortMeaning + '</div>' +
        '<div class="wordlist-sub">' + w.translit + ' \u00B7 ' + w.root + ' \u00B7 ' + w.type + '</div>' +
      '</div>' +
      '<div class="wordlist-badge">' + favStar + badge + '</div>';
    // Use closure-free inline handlers to avoid function creation per item
    d._word = w;
    d.onclick = function() { navigateToWord(this._word); };
    d.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToWord(this._word);
      }
    };
    fragment.appendChild(d);
  }

  container.appendChild(fragment);
}

/**
 * Render the statistics dashboard.
 */
var _typeCountCache = null;

function getTypeCounts() {
  if (_typeCountCache) return _typeCountCache;
  var counts = {};
  var typeLabels = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations' };
  Object.keys(typeLabels).forEach(function (key) { counts[key] = 0; });
  for (var i = 0; i < ALL_WORDS.length; i++) {
    var cat = ALL_WORDS[i].typeCategory;
    if (counts[cat] !== undefined) counts[cat]++;
  }
  _typeCountCache = counts;
  return counts;
}

var _difficultyCountCache = null;

function getDifficultyCounts() {
  if (_difficultyCountCache) return _difficultyCountCache;
  var counts = {};
  for (var i = 0; i < ALL_WORDS.length; i++) {
    var d = ALL_WORDS[i].difficulty;
    counts[d] = (counts[d] || 0) + 1;
  }
  _difficultyCountCache = counts;
  return counts;
}

function invalidateStatsCaches() {
  _typeCountCache = null;
  _difficultyCountCache = null;
}

function renderStats() {
  // Use cached stats if available
  var srsObj = window.__srs;
  var srsStats = (srsObj && srsObj.getStats) ? srsObj.getStats() : getSRSStats();
  var srsData = loadSRS();
  var now = Date.now();

  // Core stats grid
  DOM.get('stat-total').textContent = srsStats.total;
  DOM.get('stat-mastered').textContent = srsStats.mature;
  DOM.get('stat-new-count').textContent = srsStats.newCount;
  DOM.get('stat-learning-count').textContent = srsStats.dueToday;

  // Streak
  updateStreakDisplay();

  // By type chart — use cached type counts
  var typeContainer = DOM.get('stats-by-type');
  typeContainer.innerHTML = '';
  var typeLabels = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations' };
  var typeCounts = getTypeCounts();
  var totalWords = srsStats.total || 1;
  Object.keys(typeLabels).forEach(function (key) {
    var count = typeCounts[key] || 0;
    if (count === 0) return;
    var pct = Math.round((count / totalWords) * 100);
    typeContainer.appendChild(createBarRow(typeLabels[key], count, pct));
  });

  // By difficulty chart — use cached difficulty counts
  var diffContainer = DOM.get('stats-by-difficulty');
  diffContainer.innerHTML = '';
  var diffCounts = getDifficultyCounts();
  var diffLabels = { 1: 'Easy (\u2605)', 2: 'Medium (\u2605\u2605)', 3: 'Hard (\u2605\u2605\u2605)', 4: 'Complex (\u2605\u2605\u2605\u2605)', 5: 'Advanced (\u2605\u2605\u2605\u2605\u2605)' };
  for (var d = 1; d <= 5; d++) {
    var count = diffCounts[d] || 0;
    if (count === 0) continue;
    var pct = Math.round((count / totalWords) * 100);
    diffContainer.appendChild(createBarRow(diffLabels[d] || 'Level ' + d, count, pct));
  }

  // Learning stage breakdown
  var stageContainer = DOM.get('stats-stages');
  if (stageContainer) {
    stageContainer.innerHTML = '';
    var stageLabels = [
      { key: 'newCount', label: '\uD83C\uDD95 New', color: 'var(--blue)' },
      { key: 'learning', label: '\uD83D\uDD0D Learning', color: 'var(--purple)' },
      { key: 'young', label: '\uD83C\uDF31 Young', color: 'var(--gold-dim)' },
      { key: 'mature', label: '\uD83D\uDCA1 Mature', color: 'var(--green)' },
    ];
    for (var si = 0; si < stageLabels.length; si++) {
      var sl = stageLabels[si];
      var count = srsStats[sl.key] || 0;
      if (count === 0) continue;
      var pct = Math.round((count / totalWords) * 100);
      var row = document.createElement('div');
      row.className = 'stats-bar-row';
      row.innerHTML =
        '<span class="stats-bar-label" style="color:' + sl.color + '">' + sl.label + '</span>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%;background:' + sl.color + '"></div></div>' +
        '<span class="stats-bar-value">' + count + '</span>';
      stageContainer.appendChild(row);
    }
  }        // Foundation Course Progress section
        var foundationStatsContainer = DOM.get('stats-foundation');
        if (foundationStatsContainer) {
          var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
          var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
          
          foundationStatsContainer.innerHTML = '';
          
          if (fTotal > 0) {
            // Progress bar
            var fPct = Math.round((fCompleted / fTotal) * 100);
            var row = document.createElement('div');
            row.className = 'stats-bar-row';
            var color = fCompleted === fTotal ? 'var(--green)' : 'var(--gold)';
            row.innerHTML =
              '<span class="stats-bar-label" style="color:' + color + '">📘 Foundation</span>' +
              '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + fPct + '%;background:' + color + '"></div></div>' +
              '<span class="stats-bar-value">' + fCompleted + '/' + fTotal + '</span>';
            foundationStatsContainer.appendChild(row);
            
            // Coverage metrics using the new analytics engine
            var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
            var foundCov = typeof getFoundationCoverage === 'function' ? getFoundationCoverage() : null;
            
            if (coverage && foundCov) {
              // Quran Reading Coverage (PRIMARY METRIC)
              var covRow1 = document.createElement('div');
              covRow1.className = 'stats-bar-row';
              covRow1.innerHTML = '<span style="font-size:11px;color:var(--green);font-weight:500;padding:2px 0">📖 Quran Reading Coverage: ' + coverage.coveragePercent + '%</span>';
              foundationStatsContainer.appendChild(covRow1);
              
              // Estimated reading comprehension
              var compRow = document.createElement('div');
              compRow.className = 'stats-bar-row';
              compRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:2px 0">🧠 Estimated comprehension: ' + coverage.estimatedComprehension + '%</span>';
              foundationStatsContainer.appendChild(compRow);
              
              // Words mastered / total & occurrences covered
              var statsRow = document.createElement('div');
              statsRow.className = 'stats-bar-row';
              statsRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:2px 0">✓ ' + coverage.masteredWords + ' of ' + coverage.totalWords + ' words · ' + coverage.masteredOccurrences.toLocaleString() + ' of ' + coverage.totalOccurrences.toLocaleString() + ' occurrences</span>';
              foundationStatsContainer.appendChild(statsRow);
              
              // Milestone status
              var ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus(coverage.coveragePercent) : null;
              if (ms && ms.currentMilestone) {
                var msRow = document.createElement('div');
                msRow.className = 'stats-bar-row';
                msRow.innerHTML = '<span style="font-size:11px;color:var(--gold);padding:4px 0">' + ms.currentMilestone.icon + ' Milestone: ' + ms.currentMilestone.label + '</span>';
                foundationStatsContainer.appendChild(msRow);
                
                // Milestone progress detail
                var insightRow = document.createElement('div');
                insightRow.className = 'stats-bar-row';
                insightRow.innerHTML = '<span style="font-size:9px;color:var(--text-muted);font-style:italic;padding:2px 0">' + ms.currentMilestone.insight + '</span>';
                foundationStatsContainer.appendChild(insightRow);
              }
              
              // Next milestone info
              if (ms && ms.nextMilestone) {
                var nextMsRow = document.createElement('div');
                nextMsRow.className = 'stats-bar-row';
                nextMsRow.innerHTML = '<span style="font-size:10px;color:var(--gold-dim);padding:2px 0">🎯 Next: ' + ms.nextMilestone.label + ' (' + ms.nextMilestone.pct + '%) — ~' + ms.wordsToNextMilestone + ' words, ~' + ms.lessonsToNextMilestone + ' lessons</span>';
                foundationStatsContainer.appendChild(nextMsRow);
              }
              
              // Root family mastery
              var roots = typeof getRootFamilyMastery === 'function' ? getRootFamilyMastery() : null;
              if (roots) {
                var rootsRow = document.createElement('div');
                rootsRow.className = 'stats-bar-row';
                rootsRow.innerHTML = '<span style="font-size:10px;color:var(--purple);padding:2px 0">🌱 Roots mastered: ' + roots.fullyMasteredRoots + '/' + roots.totalRoots + ' (' + (roots.totalRoots > 0 ? Math.round(roots.fullyMasteredRoots / roots.totalRoots * 100) : 0) + '%)</span>';
                foundationStatsContainer.appendChild(rootsRow);
              }
              
              // Foundation-specific coverage
              if (fCompleted > 0) {
                var fCovRow = document.createElement('div');
                fCovRow.className = 'stats-bar-row';
                fCovRow.innerHTML = '<span style="font-size:10px;color:var(--green);padding:2px 0">📘 Foundation coverage: ' + foundCov.foundationCoveragePercent + '% of Quran (' + foundCov.masteredFoundationWords + '/' + foundCov.totalFoundationWords + ' words)</span>';
                foundationStatsContainer.appendChild(fCovRow);
              }
            }
            
            // Next lesson info
            if (fCompleted < fTotal) {
              var nextLesson = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
              var covRow = document.createElement('div');
              covRow.className = 'stats-bar-row';
              var fLesson = FOUNDATION_LESSONS && FOUNDATION_LESSONS[nextLesson] ? FOUNDATION_LESSONS[nextLesson] : null;
              var coverageText = fLesson ? 'Next: Foundation ' + (nextLesson + 1) + ' (+' + fLesson.lessonCoverage + ')' : '';
              covRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:4px 0">📖 ' + coverageText + '</span>';
              foundationStatsContainer.appendChild(covRow);
            } else {
              var covRow = document.createElement('div');
              covRow.className = 'stats-bar-row';
              covRow.innerHTML = '<span style="font-size:11px;color:var(--green);padding:4px 0">🎉 Foundation Course Complete! ~' + (typeof getFoundationCoverage === 'function' ? getFoundationCoverage().foundationCoveragePercent : '84') + '% Quran coverage</span>';
              foundationStatsContainer.appendChild(covRow);
            }
          } else {
            foundationStatsContainer.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Foundation Course not available</div>';
          }
        }

        // Surah Comprehension section
        var surahCompContainer = DOM.get('stats-surah-comprehension');
        if (surahCompContainer && typeof getAllSurahComprehension === 'function') {
          var allComp = getAllSurahComprehension();
          surahCompContainer.innerHTML = '';
          
          if (allComp.length > 0) {
            // Sort by comprehension ascending (lowest first — most impactful to study)
            allComp.sort(function(a, b) {
              return a.estimatedComprehension - b.estimatedComprehension;
            });
            
            // Show top 10 most-impactful surahs (lowest comprehension)
            var displayCount = Math.min(10, allComp.length);
            for (var sci = 0; sci < displayCount; sci++) {
              var sc = allComp[sci];
              var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(sc.surahId) : null;
              var surahName = surahInfo ? surahInfo.name : 'Surah ' + sc.surahId;
              var color = sc.estimatedComprehension >= 80 ? 'var(--green)' : 
                         sc.estimatedComprehension >= 50 ? 'var(--gold)' : 'var(--red)';
              
              var row = document.createElement('div');
              row.className = 'stats-bar-row';
              row.innerHTML =
                '<span class="stats-bar-label" style="font-size:10px;min-width:80px">' + sc.surahId + '. ' + surahName + '</span>' +
                '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + sc.estimatedComprehension + '%;background:' + color + '"></div></div>' +
                '<span class="stats-bar-value" style="font-size:10px;min-width:40px">' + sc.estimatedComprehension + '%</span>';
              surahCompContainer.appendChild(row);
            }
            
            if (allComp.length > displayCount) {
              var moreRow = document.createElement('div');
              moreRow.className = 'stats-bar-row';
              moreRow.innerHTML = '<span style="font-size:9px;color:var(--text-muted);padding:4px 0">+' + (allComp.length - displayCount) + ' more surahs</span>';
              surahCompContainer.appendChild(moreRow);
            }
          } else {
            surahCompContainer.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Study words to see surah comprehension</div>';
          }
        }

        // Relationship Coverage section
        var relStatsContainer = DOM.get('stats-relationships');
        if (relStatsContainer && typeof getRelationshipStats === 'function') {
          var relStats = getRelationshipStats();
          relStatsContainer.innerHTML = '';
          var relItems = [
            { label: 'Derived Forms', value: relStats.wordsWithDerivedForms + '/' + relStats.totalWords, pct: relStats.totalWords > 0 ? Math.round((relStats.wordsWithDerivedForms / relStats.totalWords) * 100) : 0, color: 'var(--blue)' },
            { label: 'Semantic Groups', value: relStats.wordsWithSemanticGroups + '/' + relStats.totalWords, pct: relStats.totalWords > 0 ? Math.round((relStats.wordsWithSemanticGroups / relStats.totalWords) * 100) : 0, color: 'var(--purple)' },
            { label: 'Confused With', value: relStats.wordsWithConfusedWith + '/' + relStats.totalWords, pct: relStats.totalWords > 0 ? Math.round((relStats.wordsWithConfusedWith / relStats.totalWords) * 100) : 0, color: 'var(--gold-dim)' },
            { label: 'Contextual Equivs', value: relStats.wordsWithContextualEquivalents + '/' + relStats.totalWords, pct: relStats.totalWords > 0 ? Math.round((relStats.wordsWithContextualEquivalents / relStats.totalWords) * 100) : 0, color: 'var(--green)' },
            { label: 'Morph. Relations', value: relStats.wordsWithMorphRelations + '/' + relStats.totalWords, pct: relStats.totalWords > 0 ? Math.round((relStats.wordsWithMorphRelations / relStats.totalWords) * 100) : 0, color: 'var(--pink)' },
            { label: 'Related Words', value: relStats.wordsWithRelatedWords + '/' + relStats.totalWords, pct: relStats.totalWords > 0 ? Math.round((relStats.wordsWithRelatedWords / relStats.totalWords) * 100) : 0, color: 'var(--gold)' },
          ];
          for (var ri = 0; ri < relItems.length; ri++) {
            var item = relItems[ri];
            if (item.value === '0/0') continue;
            var row = document.createElement('div');
            row.className = 'stats-bar-row';
            row.innerHTML =
              '<span class="stats-bar-label">' + item.label + '</span>' +
              '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + item.pct + '%;background:' + item.color + '"></div></div>' +
              '<span class="stats-bar-value">' + item.value + '</span>';
            relStatsContainer.appendChild(row);
          }
        }

        // SRS Health section
        var healthContainer = DOM.get('stats-health');
        if (healthContainer) {
          healthContainer.innerHTML = '';
          var healthItems = [
      { label: 'Avg Retention', value: srsStats.avgRetention + '%', pct: srsStats.avgRetention, color: 'var(--green)' },
      { label: 'Avg Ease', value: String(srsStats.avgEaseFactor.toFixed(2)), pct: Math.round((srsStats.avgEaseFactor / 3) * 100), color: 'var(--blue)' },
      { label: 'Overdue', value: srsStats.overdue, pct: srsStats.dueToday > 0 ? Math.round((srsStats.overdue / srsStats.dueToday) * 100) : 0, color: srsStats.overdue > 0 ? 'var(--red)' : 'var(--green)' },
      { label: 'Reviews Today', value: srsStats.reviewsToday, pct: Math.min(100, Math.round((srsStats.reviewsToday / DAILY_REVIEW_LIMIT) * 100)), color: 'var(--gold)' },
    ];
    for (var hi = 0; hi < healthItems.length; hi++) {
      var item = healthItems[hi];
      var row = document.createElement('div');
      row.className = 'stats-bar-row';
      row.innerHTML =
        '<span class="stats-bar-label">' + item.label + '</span>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + item.pct + '%;background:' + item.color + '"></div></div>' +
        '<span class="stats-bar-value">' + item.value + '</span>';
      healthContainer.appendChild(row);
    }
  }

  // Leeches
  var leechContainer = DOM.get('stats-leeches');
  if (leechContainer) {
    leechContainer.innerHTML = '';
    if (srsStats.leechCount > 0) {
      leechContainer.innerHTML = '<div style="font-size:12px;color:var(--red);padding:8px 0">\uD83D\uDCA2 ' + srsStats.leechCount + ' leeched word' + (srsStats.leechCount !== 1 ? 's' : '') + ' — consider giving extra attention</div>';
    } else {
      leechContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">\u2705 No leeched words</div>';
    }
  }

  // Review forecast
  renderReviewForecast(srsData, now);
}

function createBarRow(label, count, pct) {
  var row = document.createElement('div');
  row.className = 'stats-bar-row';
  row.innerHTML =
    '<span class="stats-bar-label">' + label + '</span>' +
    '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="stats-bar-value">' + count + '</span>';
  return row;
}

function renderReviewForecast(srsData, now) {
  var container = DOM.get('stats-forecast');
  container.innerHTML = '';
  var intervals = [
    { label: 'Today', days: 0 },
    { label: '3 days', days: 3 },
    { label: '7 days', days: 7 },
    { label: '14 days', days: 14 },
    { label: '30 days', days: 30 },
  ];
  var totalWords = ALL_WORDS.length || 1;

  for (var ii = 0; ii < intervals.length; ii++) {
    var interval = intervals[ii];
    var cutoff = now + interval.days * DAY_MS;
    var count = 0;
    for (var wi = 0; wi < ALL_WORDS.length; wi++) {
      var entry = srsData[ALL_WORDS[wi].id];
      if (entry && entry.dueDate <= cutoff) count++;
    }
    var pct = Math.round((count / totalWords) * 100);
    container.appendChild(createBarRow(interval.label, count, pct));
  }
}

/**
 * Update streak display with localStorage tracking.
 */
function updateStreakDisplay() {
  var data = loadStreakData();
  var streak = data.streak || 0;
  var today = getDateKey();

  DOM.get('streak-count').textContent = streak;
  var streakToday = DOM.get('streak-today');
  if (!streakToday) return;

  if (data.lastDate === today) {
    streakToday.textContent = '\u2713 Reviewed today! Come back tomorrow.';
    streakToday.style.color = 'var(--green)';
  } else if (data.lastDate === getYesterdayKey()) {
    streakToday.textContent = '\uD83D\uDD25 ' + streak + ' day streak! Review today to continue.';
    streakToday.style.color = 'var(--gold)';
  } else if (streak > 0) {
    streakToday.textContent = '\uD83D\uDD25 ' + streak + ' day streak! Review today to continue.';
    streakToday.style.color = 'var(--gold)';
  } else {
    streakToday.textContent = 'Start your streak by reviewing a word today!';
    streakToday.style.color = '';
  }
}

function getDateKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function getYesterdayKey() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function loadStreakData() {
  try {
    var raw = localStorage.getItem('quran_streak');
    if (!raw) return { streak: 0, lastDate: null };
    return JSON.parse(raw);
  } catch (e) {
    return { streak: 0, lastDate: null };
  }
}

function saveStreakData(data) {
  try {
    localStorage.setItem('quran_streak', JSON.stringify(data));
  } catch (e) {}
}

function updateStreak() {
  var data = loadStreakData();
  var today = getDateKey();

  if (data.lastDate === today) {
    return;
  }

  if (data.lastDate === getYesterdayKey()) {
    data.streak = (data.streak || 0) + 1;
  } else {
    data.streak = 1;
  }
  data.lastDate = today;
  saveStreakData(data);
}

/**
 * Render quiz question with educational distractors.
 */
function renderQuizQuestion(currentWordObj, allWords) {
  const wordEl = document.getElementById('quiz-word');
  const optionsEl = document.getElementById('quiz-options');
  const feedbackEl = document.getElementById('quiz-feedback');
  const nextBtn = document.getElementById('btn-next-quiz');

  nextBtn.style.display = 'none';
  feedbackEl.textContent = '';

  wordEl.textContent = currentWordObj.arabic;

  const correct = getShortMeaning(currentWordObj.meaning);

  // Use educational distractors from vocabulary service
  var distractors = getDistractors(currentWordObj, 3);
  var opts = [correct];
  distractors.forEach(function (d) {
    var label = getShortMeaning(d.meaning);
    if (label !== correct && opts.indexOf(label) === -1) {
      opts.push(label);
    }
  });
  // Fallback if not enough options
  if (opts.length < 4) {
    allWords.forEach(function (w) {
      if (w !== currentWordObj && opts.length < 4) {
        var label = getShortMeaning(w.meaning);
        if (label !== correct && opts.indexOf(label) === -1) {
          opts.push(label);
        }
      }
    });
  }
  // Fisher-Yates shuffle for unbiased ordering
  for (var si = opts.length - 1; si > 0; si--) {
    var sj = Math.floor(Math.random() * (si + 1));
    var tmp = opts[si];
    opts[si] = opts[sj];
    opts[sj] = tmp;
  }

  optionsEl.innerHTML = '';
  opts.forEach(function (opt) {
    var b = document.createElement('button');
    b.className = 'quiz-opt';
    b.textContent = opt;
    b.setAttribute('role', 'button');
    b.onclick = function () { handleQuizAnswer(b, opt, correct, currentWordObj.id); };
    optionsEl.appendChild(b);
  });
}

/**
 * Show quiz completion feedback.
 */
function renderQuizCompletion(score, total) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  document.getElementById('quiz-word').textContent = '\uD83C\uDF89';
  document.getElementById('quiz-options').innerHTML = '';
  const feedback = document.getElementById('quiz-feedback');
  const msg = pct >= 80 ? 'Excellent, mashAllah!' : pct >= 60 ? 'Good effort \u2014 review the harder ones.' : "Keep going, you'll get there!";
  feedback.textContent = 'Done! ' + pct + '% \u2014 ' + msg;
  feedback.style.color = 'var(--gold)';
  document.getElementById('btn-next-quiz').style.display = 'none';
}

/**
 * Update the quiz score display.
 */
function updateQuizScoreDisplay(correct, total) {
  document.getElementById('stat-score').textContent = total > 0 ? Math.round((correct / total) * 100) + '%' : '\u2014';
  document.getElementById('quiz-score-display').textContent = correct + '/' + total + ' correct';
}

/**
 * Navigate to a word in the learn view.
 * Supports both lesson mode and surah mode.
 */
function navigateToWord(w) {
  // Find word in the current active set (lesson or surah words)
  var activeWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : ALL_WORDS;
  var idx = activeWords.indexOf(w);
  if (idx >= 0) {
    window.__navigateToWordIndex(idx);
    return;
  }
  
  // Word not in current lesson/surah — check if it's a canonical word
  // and find it in CANONICAL_WORDS for lesson-based navigation
  var globalIdx = ALL_WORDS.indexOf(w);
  if (globalIdx < 0) {
    // Try canonical words (for navigateToWord called on a canonical word object)
    var canonicalWords = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
    var canonicalIdx = canonicalWords.indexOf(w);
    if (canonicalIdx >= 0) {
      // Navigate via lesson
      if (typeof goToLesson === 'function') {
        var wordLesson = Math.floor(canonicalIdx / WORDS_PER_LESSON);
        var wordInLesson = canonicalIdx % WORDS_PER_LESSON;
        if (wordLesson >= 0) {
          goToLesson(wordLesson, wordInLesson);
        }
      }
      return;
    }
    return; // Word not found anywhere
  }
  
  // If word belongs to a surah and we have goToSurah, navigate by surah
  if (w.surahId && typeof goToSurah === 'function') {
    var surahWords = getSurahWords(w.surahId);
    var surahIdx = surahWords.indexOf(w);
    if (surahIdx >= 0) {
      goToSurah(w.surahId, surahIdx);
      return;
    }
  }
  
  // Fall back to lesson-based navigation
  if (typeof goToLesson === 'function') {
    var wordLesson = Math.floor(globalIdx / WORDS_PER_LESSON);
    var wordInLesson = globalIdx % WORDS_PER_LESSON;
    if (wordLesson >= 0) {
      goToLesson(wordLesson, wordInLesson);
    }
  }
}

/**
 * Show word content (ayah + tafsir) for the current word.
 * This is a safe wrapper that also handles canonical words with multiple occurrences.
 */
function showWordContent(w) {
  if (!w) return;
  showAyah(w);
  loadTafsir(w);
}
