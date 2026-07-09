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
  var views = ['dashboard', 'learn', 'quiz', 'list', 'stats', 'analytics', 'explorer', 'auth', 'profile', 'settings'];
  for (var i = 0; i < views.length; i++) {
    var name = views[i];
    var viewEl = DOM.get('view-' + name);
    if (viewEl) viewEl.classList.toggle('active', name === viewName);

    // Only toggle tab highlights for main nav tabs
    if (name === 'dashboard' || name === 'learn' || name === 'quiz' || name === 'list' || name === 'stats' || name === 'analytics') {
      var tabEl = DOM.get('tab-' + name);
      if (tabEl) tabEl.classList.toggle('active', name === viewName);
    }
  }
  // Animate the newly activated view (skip on first render to avoid flicker)
  if (window.__viewHasBeenSet) {
    var viewEl = DOM.get('view-' + viewName);
    if (viewEl) {
      viewEl.classList.remove('view-entrance');
      void viewEl.offsetHeight;
      viewEl.classList.add('view-entrance');
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
  // Contrast words (Quranic thematic contrasts)
  var contrastSection = document.getElementById('contrast-words-section');
  var contrastList = document.getElementById('contrast-words-list');
  if (contrastSection && contrastList) {
    contrastList.innerHTML = '';
    var contrastWords = findWordsByArabicList(w.contrastWords);
    if (contrastWords.length > 0) {
      contrastSection.style.display = 'block';
      contrastWords.forEach(function (cw) {
        contrastList.appendChild(createWordNetworkChip(cw, 'contrast'));
      });
    } else {
      contrastSection.style.display = 'none';
    }
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

// ═══════════════════════════════════════════════════════════════
// ADVANCED SEARCH — Filter Panel & Enhanced Results
// ═══════════════════════════════════════════════════════════════

/** @type {boolean} Whether advanced filters have been populated */
var _filterPanelPopulated = false;

/**
 * Populate the advanced filter panel dropdowns (foundation lessons, surahs).
 */
function populateFilterDropdowns() {
  if (_filterPanelPopulated) return;
  
  // Foundation lesson dropdown
  var foundationSelect = DOM.get('filter-foundation');
  if (foundationSelect && typeof getFoundationLessonOptions === 'function') {
    var options = getFoundationLessonOptions();
    if (options && options.length > 0) {
      for (var fi = 0; fi < options.length; fi++) {
        var opt = document.createElement('option');
        opt.value = options[fi].value;
        opt.textContent = options[fi].label;
        foundationSelect.appendChild(opt);
      }
    }
  }
  
  // Surah dropdown
  var surahSelect = DOM.get('filter-surah');
  if (surahSelect && typeof SURAH_INFO !== 'undefined') {
    var surahIds = Object.keys(SURAH_INFO);
    if (surahIds.length > 0) {
      // Sort numerically
      surahIds.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });
      for (var si = 0; si < surahIds.length; si++) {
        var sid = parseInt(surahIds[si], 10);
        var info = SURAH_INFO[sid];
        if (info) {
          var opt = document.createElement('option');
          opt.value = sid;
          opt.textContent = sid + '. ' + info.name + ' — ' + info.english;
          surahSelect.appendChild(opt);
        }
      }
    }
  }
  
  _filterPanelPopulated = true;
}

/**
 * Collect the current filter state from the advanced filter panel.
 * Returns an object suitable for advancedFilterWords().
 */
function collectAdvancedFilters() {
  var filterState = {};
  
  var difficulty = DOM.get('filter-difficulty');
  if (difficulty && difficulty.value !== '') filterState.difficulty = parseInt(difficulty.value, 10);
  
  var frequency = DOM.get('filter-frequency');
  if (frequency && frequency.value !== '') filterState.frequency = frequency.value;
  
  var foundation = DOM.get('filter-foundation');
  if (foundation && foundation.value !== '') filterState.foundationLesson = foundation.value;
  
  var pos = DOM.get('filter-part-of-speech');
  if (pos && pos.value !== '') filterState.typeCategory = pos.value;
  
  var root = DOM.get('filter-root');
  if (root && root.value.trim() !== '') filterState.rootFamilyFilter = root.value.trim();
  
  var surah = DOM.get('filter-surah');
  if (surah && surah.value !== '') filterState.surahId = parseInt(surah.value, 10);
  
  var occMin = DOM.get('filter-occ-min');
  if (occMin && occMin.value !== '') filterState.occMin = parseInt(occMin.value, 10);
  
  var occMax = DOM.get('filter-occ-max');
  if (occMax && occMax.value !== '') filterState.occMax = parseInt(occMax.value, 10);
  
  var freqRank = DOM.get('filter-freq-rank');
  if (freqRank && freqRank.value !== '') filterState.freqRankMax = parseInt(freqRank.value, 10);
  
  var bookmarked = DOM.get('filter-bookmarked');
  if (bookmarked && bookmarked.checked) filterState.isBookmarked = true;
  
  var reviewDue = DOM.get('filter-review-due');
  if (reviewDue && reviewDue.checked) filterState.reviewDue = 'due';
  
  var learned = DOM.get('filter-learned');
  if (learned && learned.checked) filterState.learnedOnly = true;
  
  var unlearned = DOM.get('filter-unlearned');
  if (unlearned && unlearned.checked) filterState.unlearnedOnly = true;
  
  return filterState;
}

/**
 * Check if any advanced filters are active (non-default).
 */
function hasAdvancedFilters() {
  var state = collectAdvancedFilters();
  var keys = Object.keys(state);
  return keys.length > 0;
}

/**
 * Clear all advanced filter panel inputs to their default state.
 */
function clearAdvancedFilters() {
  var selectors = ['filter-difficulty', 'filter-frequency', 'filter-foundation',
    'filter-part-of-speech', 'filter-surah', 'filter-freq-rank'];
  for (var si = 0; si < selectors.length; si++) {
    var el = DOM.get(selectors[si]);
    if (el) el.value = '';
  }
  DOM.get('filter-root').value = '';
  DOM.get('filter-occ-min').value = '';
  DOM.get('filter-occ-max').value = '';
  DOM.get('filter-bookmarked').checked = false;
  DOM.get('filter-review-due').checked = false;
  DOM.get('filter-learned').checked = false;
  DOM.get('filter-unlearned').checked = false;
  renderWordList();
}

/**
 * Show the active filter count badge on the toggle button.
 */
function updateFilterActiveBadge() {
  var toggle = DOM.get('advanced-filter-toggle');
  if (!toggle) return;
  var state = collectAdvancedFilters();
  var count = Object.keys(state).length;
  // Remove existing badge
  var existingBadge = toggle.querySelector('.filter-active-badge');
  if (existingBadge) existingBadge.remove();
  if (count > 0) {
    var badge = document.createElement('span');
    badge.className = 'filter-active-badge';
    badge.textContent = count + ' active';
    toggle.appendChild(badge);
    toggle.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Render the word list with filtering and search applied.
 * Uses advanced search when the advanced filter panel is visible or has active filters.
 */
function renderWordList() {
  var searchInput = DOM.get('search-input');
  var searchQuery = searchInput ? searchInput.value : '';
  var activeType = document.querySelector('#filter-type-chips .chip-active');
  var activeStatus = document.querySelector('#filter-status-chips .chip-active');
  var typeFilter = activeType ? activeType.getAttribute('data-value') : 'all';
  var statusFilter = activeStatus ? activeStatus.getAttribute('data-value') : 'all';
  
  // Populate filter dropdowns on first render
  populateFilterDropdowns();
  
  // Check if advanced filters are active
  var advancedFilterPanel = DOM.get('advanced-filter-panel');
  var advFiltersVisible = advancedFilterPanel && advancedFilterPanel.style.display === 'block';
  var advFiltersActive = hasAdvancedFilters();
  
  var words;
  if (advFiltersActive) {
    // Use advanced search with collected filter state
    var filterState = collectAdvancedFilters();
    // Build advanced search index if needed
    if (typeof buildAdvancedSearchIndex === 'function') buildAdvancedSearchIndex();
    
    // Apply advanced search
    words = typeof advancedSearch === 'function' 
      ? advancedSearch(searchQuery, filterState)
      : searchWords(searchQuery);
    
    // Apply basic type/status filters on top
    words = filterByCategory(words, typeFilter);
    if (statusFilter === 'favorites') {
      words = filterByFavorites(words);
    } else if (statusFilter !== 'all') {
      words = filterByStatus(words, statusFilter);
    }
  } else {
    // Use simple filtering (existing behavior)
    words = searchWords(searchQuery);
    words = filterByCategory(words, typeFilter);
    if (statusFilter === 'favorites') {
      words = filterByFavorites(words);
    } else {
      words = filterByStatus(words, statusFilter);
    }
  }

  // Update count
  var countEl = DOM.get('list-count');
  if (countEl) countEl.textContent = words.length + ' word' + (words.length !== 1 ? 's' : '');
  
  // Update filter result count badge
  var resultCountEl = DOM.get('filter-result-count');
  if (resultCountEl && advFiltersActive) {
    resultCountEl.textContent = words.length + ' results';
  } else if (resultCountEl) {
    resultCountEl.textContent = '';
  }
  
  // Update filter active badge on toggle
  updateFilterActiveBadge();

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
    d.className = 'wordlist-item' + (advFiltersActive ? ' has-quick-actions' : '') + ' stagger-item';
    d.style.animationDelay = Math.min(i * 30, 350) + 'ms';
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
    
    // Add quick action buttons for advanced search results
    if (advFiltersActive) {
      var qaRow = document.createElement('div');
      qaRow.className = 'wordlist-quick-actions';
      
      // Explorer button
      var explorerBtn = document.createElement('button');
      explorerBtn.className = 'wordlist-qa-btn';
      explorerBtn.textContent = '🔍 Explore';
      explorerBtn.setAttribute('aria-label', 'Open vocabulary explorer for ' + w.arabic);
      (function(wordObj) {
        explorerBtn.onclick = function(e) {
          e.stopPropagation();
          navigateToWord(wordObj);
        };
      })(w);
      qaRow.appendChild(explorerBtn);
      
      // Bookmark button
      var bmBtn = document.createElement('button');
      bmBtn.className = 'wordlist-qa-btn' + (favs[w.id] ? ' active-qa' : '');
      bmBtn.textContent = favs[w.id] ? '⭐' : '☆';
      bmBtn.setAttribute('aria-label', (favs[w.id] ? 'Remove' : 'Add') + ' bookmark for ' + w.arabic);
      (function(wordObj) {
        bmBtn.onclick = function(e) {
          e.stopPropagation();
          if (typeof toggleFavorite === 'function') {
            var isNowFav = toggleFavorite(wordObj.id);
            bmBtn.textContent = isNowFav ? '⭐' : '☆';
            bmBtn.className = 'wordlist-qa-btn' + (isNowFav ? ' active-qa' : '');
          }
        };
      })(w);
      qaRow.appendChild(bmBtn);
      
      // Flashcards button
      var flashBtn = document.createElement('button');
      flashBtn.className = 'wordlist-qa-btn';
      flashBtn.textContent = '⚡ Flash';
      flashBtn.setAttribute('aria-label', 'Study ' + w.arabic + ' in flashcard mode');
      (function(wordObj) {
        flashBtn.onclick = function(e) {
          e.stopPropagation();
          if (typeof toggleQuickMode === 'function') toggleQuickMode();
          navigateToWord(wordObj);
        };
      })(w);
      qaRow.appendChild(flashBtn);
      
      d.appendChild(qaRow);
    }
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

  // Add entrance animation to stats sections
  var statsView = DOM.get('view-stats');
  if (statsView) {
    statsView.classList.remove('stat-section-entrance');
    void statsView.offsetHeight;
    statsView.classList.add('stat-section-entrance');
  }

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
      { key: 'newCount', label: '\uD83C\uDD95 New', color: 'var(--blue)', filterStatus: 'new' },
      { key: 'learning', label: '\uD83D\uDD0D Learning', color: 'var(--purple)', filterStatus: 'learning' },
      { key: 'young', label: '\uD83C\uDF31 Young', color: 'var(--gold-dim)', filterStatus: 'mastered' },
      { key: 'mature', label: '\uD83D\uDCA1 Mature', color: 'var(--green)', filterStatus: 'mastered' },
    ];
    for (var si = 0; si < stageLabels.length; si++) {
      var sl = stageLabels[si];
      var count = srsStats[sl.key] || 0;
      if (count === 0) continue;
      var pct = Math.round((count / totalWords) * 100);
      var row = document.createElement('div');
      row.className = 'stats-bar-row clickable-stats-row';
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', 'View ' + sl.label.toLowerCase() + ' words');
      row.innerHTML =
        '<span class="stats-bar-label" style="color:' + sl.color + '">' + sl.label + '</span>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%;background:' + sl.color + '"></div></div>' +
        '<span class="stats-bar-value">' + count + '</span>';
      row.onclick = function() {
        switchView('list');
      };
      row.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchView('list');
        }
      };
      stageContainer.appendChild(row);
    }
  }

  // Foundation Course Progress section
  var foundationStatsContainer = DOM.get('stats-foundation');
  if (foundationStatsContainer) {
    var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
    var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
    foundationStatsContainer.innerHTML = '';
    if (fTotal > 0) {
      var fPct = Math.round((fCompleted / fTotal) * 100);
      var row = document.createElement('div');
      row.className = 'stats-bar-row clickable-stats-row';
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', 'Continue Foundation Course');
      var color = fCompleted === fTotal ? 'var(--green)' : 'var(--gold)';
      row.innerHTML =
        '<span class="stats-bar-label" style="color:' + color + '">📘 Foundation</span>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + fPct + '%;background:' + color + '"></div></div>' +
        '<span class="stats-bar-value">' + fCompleted + '/' + fTotal + '</span>';
      row.onclick = function() {
        if (typeof goToFoundationLesson === 'function') {
          goToFoundationLesson(typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0);
        }
      };
      row.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.onclick(); }
      };
      foundationStatsContainer.appendChild(row);
      var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
      var foundCov = typeof getFoundationCoverage === 'function' ? getFoundationCoverage() : null;
      if (coverage && foundCov) {
        var covRow1 = document.createElement('div');
        covRow1.className = 'stats-bar-row stats-comprehension-row';
        covRow1.innerHTML = '<span style="font-size:11px;color:var(--green);font-weight:500;padding:2px 0">📖 Quran Reading Coverage: ' + coverage.coveragePercent + '%</span>';
        foundationStatsContainer.appendChild(covRow1);
        var compRow = document.createElement('div');
        compRow.className = 'stats-bar-row';
        compRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:2px 0">🧠 Estimated comprehension: ' + coverage.estimatedComprehension + '%</span>';
        if ($sight) {
          var $sTodayCls = $sight.todayChange >= 0 ? 'var(--green)' : 'var(--red)';
          var $sWeekCls = $sight.weekChange >= 0 ? 'var(--green)' : 'var(--red)';
          var $sMonthCls = $sight.monthChange >= 0 ? 'var(--green)' : 'var(--red)';
          var $sTodayFmt = $sight.todayChange > 0 ? '+' + $sight.todayChange.toFixed(1) + '%' : ($sight.todayChange < 0 ? $sight.todayChange.toFixed(1) + '%' : '± 0%');
          var $sWeekFmt = $sight.weekChange > 0 ? '+' + $sight.weekChange.toFixed(1) + '%' : ($sight.weekChange < 0 ? $sight.weekChange.toFixed(1) + '%' : '± 0%');
          var $sMonthFmt = $sight.monthChange > 0 ? '+' + $sight.monthChange.toFixed(1) + '%' : ($sight.monthChange < 0 ? $sight.monthChange.toFixed(1) + '%' : '± 0%');
          var $sDeltaRow = document.createElement('div');
          $sDeltaRow.className = 'stats-bar-row stats-comprehension-row';
          $sDeltaRow.innerHTML = '<span style="font-size:9px;color:var(--text-muted);padding:1px 0">Today <span style="color:' + $sTodayCls + '">' + $sTodayFmt + '</span> \u00B7 Week <span style="color:' + $sWeekCls + '">' + $sWeekFmt + '</span> \u00B7 Month <span style="color:' + $sMonthCls + '">' + $sMonthFmt + '</span></span>';
          foundationStatsContainer.appendChild($sDeltaRow);
          // Milestone insight
          if ($sight.milestoneCurrent) {
            var $sMSRow = document.createElement('div');
            $sMSRow.className = 'stats-bar-row stats-comprehension-row';
            $sMSRow.innerHTML = '<span style="font-size:10px;color:var(--gold);padding:2px 0">' + $sight.milestoneCurrent.icon + ' Milestone: ' + $sight.milestoneCurrent.label + '</span>';
            foundationStatsContainer.appendChild($sMSRow);
            var $sInsightRow = document.createElement('div');
            $sInsightRow.className = 'stats-bar-row stats-comprehension-row';
            $sInsightRow.innerHTML = '<span style="font-size:9px;color:var(--text-muted);font-style:italic;padding:1px 0">' + $sight.insightMessage + '</span>';
            foundationStatsContainer.appendChild($sInsightRow);
          }
        }
        foundationStatsContainer.appendChild(compRow);
        var statsRow = document.createElement('div');
        statsRow.className = 'stats-bar-row';
        statsRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:2px 0">✓ ' + coverage.masteredWords + ' of ' + coverage.totalWords + ' words · ' + coverage.masteredOccurrences.toLocaleString() + ' of ' + coverage.totalOccurrences.toLocaleString() + ' occurrences</span>';
        foundationStatsContainer.appendChild(statsRow);
        var ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus(coverage.coveragePercent) : null;
        if (ms && ms.currentMilestone) {
          var msRow = document.createElement('div');
          msRow.className = 'stats-bar-row';
          msRow.innerHTML = '<span style="font-size:11px;color:var(--gold);padding:4px 0">' + ms.currentMilestone.icon + ' Milestone: ' + ms.currentMilestone.label + '</span>';
          foundationStatsContainer.appendChild(msRow);
          var insightRow = document.createElement('div');
          insightRow.className = 'stats-bar-row';
          insightRow.innerHTML = '<span style="font-size:9px;color:var(--text-muted);font-style:italic;padding:2px 0">' + ms.currentMilestone.insight + '</span>';
          foundationStatsContainer.appendChild(insightRow);
        }
        if (ms && ms.nextMilestone) {
          var nextMsRow = document.createElement('div');
          nextMsRow.className = 'stats-bar-row';
          nextMsRow.innerHTML = '<span style="font-size:10px;color:var(--gold-dim);padding:2px 0">🎯 Next: ' + ms.nextMilestone.label + ' (' + ms.nextMilestone.pct + '%) — ~' + ms.wordsToNextMilestone + ' words, ~' + ms.lessonsToNextMilestone + ' lessons</span>';
          foundationStatsContainer.appendChild(nextMsRow);
        }
        var roots = typeof getRootFamilyMastery === 'function' ? getRootFamilyMastery() : null;
        if (roots) {
          var rootsRow = document.createElement('div');
          rootsRow.className = 'stats-bar-row';
          rootsRow.innerHTML = '<span style="font-size:10px;color:var(--purple);padding:2px 0">🌱 Roots mastered: ' + roots.fullyMasteredRoots + '/' + roots.totalRoots + ' (' + (roots.totalRoots > 0 ? Math.round(roots.fullyMasteredRoots / roots.totalRoots * 100) : 0) + '%)</span>';
          foundationStatsContainer.appendChild(rootsRow);
        }
        if (fCompleted > 0) {
          var fCovRow = document.createElement('div');
          fCovRow.className = 'stats-bar-row';
          fCovRow.innerHTML = '<span style="font-size:10px;color:var(--green);padding:2px 0">📘 Foundation coverage: ' + foundCov.foundationCoveragePercent + '% of Quran (' + foundCov.masteredFoundationWords + '/' + foundCov.totalFoundationWords + ' words)</span>';
          foundationStatsContainer.appendChild(fCovRow);
        }
      }
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
      allComp.sort(function(a, b) {
        return a.estimatedComprehension - b.estimatedComprehension;
      });
      var displayCount = Math.min(10, allComp.length);
      for (var sci = 0; sci < displayCount; sci++) {
        var sc = allComp[sci];
        var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(sc.surahId) : null;
        var surahName = surahInfo ? surahInfo.name : 'Surah ' + sc.surahId;
        var color = sc.estimatedComprehension >= 80 ? 'var(--green)' : sc.estimatedComprehension >= 50 ? 'var(--gold)' : 'var(--red)';
        var row = document.createElement('div');
        row.className = 'stats-bar-row clickable-stats-row';
        row.setAttribute('tabindex', '0');
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', 'Study ' + surahName);
        row.innerHTML =
          '<span class="stats-bar-label" style="font-size:10px;min-width:80px">' + sc.surahId + '. ' + surahName + '</span>' +
          '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + sc.estimatedComprehension + '%;background:' + color + '"></div></div>' +
          '<span class="stats-bar-value" style="font-size:10px;min-width:40px">' + sc.estimatedComprehension + '%</span>';
        (function(sid) {
          row.onclick = function() {
            if (typeof goToSurah === 'function') {
              goToSurah(sid);
            }
          };
          row.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof goToSurah === 'function') goToSurah(sid); }
          };
        })(sc.surahId);
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
      { label: 'Overdue', value: srsStats.overdue, pct: srsStats.dueToday > 0 ? Math.round((srsStats.overdue / srsStats.dueToday) * 100) : 0, color: srsStats.overdue > 0 ? 'var(--red)' : 'var(--green)', actionable: srsStats.overdue > 0 },
      { label: 'Reviews Today', value: srsStats.reviewsToday, pct: Math.min(100, Math.round((srsStats.reviewsToday / DAILY_REVIEW_LIMIT) * 100)), color: 'var(--gold)', actionable: true },
    ];
    for (var hi = 0; hi < healthItems.length; hi++) {
      var item = healthItems[hi];
      var row = document.createElement('div');
      row.className = 'stats-bar-row' + (item.actionable ? ' clickable-stats-row' : '');
      if (item.actionable) {
        row.setAttribute('tabindex', '0');
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', 'Start review for ' + item.label.toLowerCase());
        row.onclick = function() {
          if (typeof startReview === 'function') startReview();
          else switchView('learn');
        };
        row.onkeydown = function(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof startReview === 'function') startReview(); }
        };
      }
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
      leechContainer.innerHTML = '<div style="font-size:12px;color:var(--red);padding:8px 0">\uD83D\uDCA2 ' + srsStats.leechCount + ' leeched word' + (srsStats.leechCount !== 1 ? 's' : '') + ' \u2014 consider giving extra attention</div>';
    } else {
      leechContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">\u2705 No leeched words</div>';
    }
  }

  // Review forecast
  renderReviewForecast(srsData, now);

  // Wire stat card clicks (inline, not wrapped in a function declaration, to avoid terser scope issues)
  var _statCards = [
    { id: 'stat-total', fn: function() { switchView('list'); } },
    { id: 'stat-mastered', fn: function() {
      if (typeof getDueReviews === 'function' && getDueReviews().length > 0 && typeof startReview === 'function') {
        startReview();
      } else {
        switchView('learn');
      }
    } },
    { id: 'stat-new-count', fn: function() { switchView('list'); } },
    { id: 'stat-learning-count', fn: function() {
      if (typeof getDueReviews === 'function' && getDueReviews().length > 0 && typeof startReview === 'function') {
        startReview();
      } else {
        switchView('learn');
      }
    } },
  ];
  for (var _si = 0; _si < _statCards.length; _si++) {
    var _el = document.getElementById(_statCards[_si].id);
    if (_el) {
      var _card = _el.closest('.stat-card');
      if (_card) _card.onclick = _statCards[_si].fn;
    }
  }
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
 * Navigate to a word in the learn view.
 * Supports both lesson mode and surah mode.
 */
function navigateToWord(w) {
  // Open the Vocabulary Explorer for the given word
  openExplorer(w);
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

// ═══════════════════════════════════════════════════════════════
// VOCABULARY EXPLORER — Comprehensive Word Reference Page
//
// The Vocabulary Explorer is a dedicated full-page view that displays
// every piece of information about a single vocabulary entry:
//   - Core Information (Arabic, translit, meaning, root, pattern, POS, difficulty, frequency)
//   - Quran Context (first/last occurrence, all occurrences with ayah display, tafsir, surah links)
//   - Vocabulary Relationships (root family, derived forms, morph relatives, similar/confused words,
//     semantic groups, related words, contextual equivalents)
//   - Personal Learning Progress (SRS status, foundation lesson, last studied, next review, retention)
//   - Learning Actions (bookmark, study, rate, practice related, view occurrences, flashcard mode)
//   - Personal Notes
// ═══════════════════════════════════════════════════════════════

/** @type {Object|null} Currently displayed explorer word */
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
function renderExplorerAllOccurrences(listEl, w) {
  if (!listEl || !w || !w.occurrences || w.occurrences.length === 0) {
    listEl.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px">No occurrence data available.</div>';
    return;
  }
  
  var html = '<div class="explorer-all-occ-inner">';
  for (var oi = 0; oi < w.occurrences.length; oi++) {
    var occ = w.occurrences[oi];
    var surahName = '';
    if (occ.surahId && SURAH_INFO && SURAH_INFO[occ.surahId]) {
      surahName = SURAH_INFO[occ.surahId].name;
    }
    var ref = occ.ayahR || occ.verseKey || '';
    var ayahText = occ.ayahA || '';
    // Highlight the word in the ayah text
    if (ayahText && w.arabic) {
      ayahText = ayahText.replace(
        new RegExp(w.arabic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        '<span class="explorer-ayah-highlight">' + w.arabic + '</span>'
      );
    }
    html += '<div class="explorer-occ-item">' +
      '<div class="explorer-occ-ref">' + (surahName ? surahName + ' ' : '') + ref + '</div>' +
      '<div class="explorer-occ-ayah" lang="ar" dir="rtl">' + ayahText + '</div>' +
      '<div class="explorer-occ-trans">' + (occ.ayahT || '') + '</div>' +
    '</div>';
  }
  html += '</div>';
  listEl.innerHTML = html;
}

// Export explorer for cross-module access

// ═══════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD — Comprehensive Learning Analytics
// ═══════════════════════════════════════════════════════════════

/**
 * Render the full Analytics Dashboard.
 * Called by switchView('analytics').
 * Displays: overview, trends, insights, achievements tabs
 */
function renderAnalytics() {
  try {

  var analytics = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
  if (!analytics) {
    DOM.get('analytics-content').innerHTML = '<div class="analytics-empty">Start learning to see your analytics!</div>';
    return;
  }
  
  var activeTab = document.querySelector('.analytics-tab-active');
  var tabName = activeTab ? activeTab.getAttribute('data-analytics-tab') : 'overview';
  renderAnalyticsTab(tabName, analytics);
  
  // Wire tab switching
  var tabs = document.querySelectorAll('.analytics-tab');
  for (var ti = 0; ti < tabs.length; ti++) {
    (function(tab) {
      tab.onclick = function() {
        document.querySelectorAll('.analytics-tab').forEach(function(t) {
          t.classList.remove('analytics-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('analytics-tab-active');
        tab.setAttribute('aria-selected', 'true');
        renderAnalyticsTab(tab.getAttribute('data-analytics-tab'), analytics);
      };
    })(tabs[ti]);
  }

  } catch (e) {
    console.error('[analytics] renderAnalytics error:', e);
    var container = document.getElementById('analytics-content');
    if (container) container.innerHTML = '<div class="analytics-empty">\u26A0\uFE0F Something went wrong loading analytics. <button class="btn btn-sm mt-10" onclick="window.location.reload()">Reload</button></div>';
  }
}

function renderAnalyticsTab(tabName, analytics) {
  try {

  var container = DOM.get('analytics-content');
  if (!container) return;
  
  var html = '';
  
  switch (tabName) {
    case 'overview':
      html = renderAnalyticsOverview(analytics);
      break;
    case 'trends':
      html = renderAnalyticsTrends(analytics);
      break;
    case 'insights':
      html = renderAnalyticsInsightsPage(analytics);
      break;
    case 'achievements':
      html = renderAnalyticsAchievements();
      break;
  }
  
  container.innerHTML = html;
  
  // Wire trend period tabs (only when trends tab is active)
  var trendTabs = container.querySelectorAll('.analytics-trend-tab');
  for (var tti = 0; tti < trendTabs.length; tti++) {
    (function(tt) {
      tt.onclick = function() {
        var parentTabs = tt.closest('.analytics-trend-tabs');
        if (parentTabs) {
          var siblings = parentTabs.querySelectorAll('.analytics-trend-tab');
          for (var si = 0; si < siblings.length; si++) {
            siblings[si].classList.remove('analytics-trend-active');
          }
        }
        tt.classList.add('analytics-trend-active');
        var insights = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
        if (insights) {
          renderAnalyticsTab('trends', insights);
        }
      };
    })(trendTabs[tti]);
  }
  
  // Wire "View All Achievements" button
  var viewAllAchBtn = container.querySelector('#analytics-view-all-ach');
  if (viewAllAchBtn) {
    viewAllAchBtn.onclick = function() {
      var achTab = document.querySelector('.analytics-tab[data-analytics-tab="achievements"]');
      if (achTab) {
        document.querySelectorAll('.analytics-tab').forEach(function(t) {
          t.classList.remove('analytics-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        achTab.classList.add('analytics-tab-active');
        achTab.setAttribute('aria-selected', 'true');
        var insights = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
        renderAnalyticsTab('achievements', insights);
      }
    };
  }

  } catch (e) {
    console.error('[analytics] renderAnalyticsTab error:', e);
    var container = document.getElementById('analytics-content');
    if (container) container.innerHTML = '<div class="analytics-empty">\u26A0\uFE0F Error loading ' + tabName + ' tab.</div>';
  }
}

// ── OVERVIEW TAB ──

function renderAnalyticsOverview(analytics) {
  try {
  var html = '';
  var profile = analytics.profile;
  var periods = analytics.periods;
  var forecasts = analytics.forecasts;
  
  // Coverage & Comprehension Card
  var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
  var fCompleted = (typeof getCompletedFoundationLessonCount === 'function') ? getCompletedFoundationLessonCount() : 0;
  var fTotal = (typeof getFoundationLessonCount === 'function') ? getFoundationLessonCount() : 0;
  var coveragePct = coverage ? coverage.coveragePercent : 0;
  var compPct = coverage ? coverage.estimatedComprehension : 0;
  
  // Foundation Ring
  var foundationPct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📊 Progress Overview</div>';
  html += '<div class="analytics-stats-grid">';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.masteredWords : 0) + '</div><div class="analytics-stat-label">Mastered</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.studiedWords : 0) + '</div><div class="analytics-stat-label">Studied</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.adaptiveDifficulty : 1) + '</div><div class="analytics-stat-label">Level</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + coveragePct + '%</div><div class="analytics-stat-label">Quran Coverage</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + compPct + '%</div><div class="analytics-stat-label">Comprehension</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.quizAccuracy || '-' : '-') + '</div><div class="analytics-stat-label">Quiz Accuracy</div></div>';
  html += '</div></div>';
  
  // Foundation Progress
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📘 Foundation Course</div>';
  html += '<div class="analytics-progress-block">';
  html += '<div class="analytics-progress-track-big"><div class="analytics-progress-fill-big" style="width:' + foundationPct + '%"></div></div>';
  html += '<div class="analytics-progress-info">';
  html += '<span class="analytics-progress-pct">' + foundationPct + '%</span>';
  html += '<span class="analytics-progress-detail">' + fCompleted + ' of ' + fTotal + ' lessons</span>';
  html += '</div></div></div>';
  
  // Quran Reading Coverage Ring
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📖 Quran Reading Coverage</div>';
  html += '<div class="analytics-coverage-card">';
  html += '<div class="analytics-coverage-ring-wrap">';
  html += '<svg class="analytics-coverage-ring" viewBox="0 0 36 36">';
  html += '<path class="goal-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />';
  var covOffset = Math.round((coveragePct / 100) * 100);
  html += '<path class="goal-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + covOffset + ', 100" style="stroke:var(--gold)" />';
  html += '<text class="goal-ring-text" x="18" y="20.5" style="fill:var(--gold);font-size:9px">' + coveragePct + '%</text>';
  html += '</svg></div>';
  html += '<div class="analytics-coverage-details">';
  if (coverage) {
    html += '<div class="analytics-cov-row"><span>Words Mastered</span><span>' + coverage.masteredWords + ' / ' + coverage.totalWords + '</span></div>';
    html += '<div class="analytics-cov-row"><span>Occurrences Recognized</span><span>' + coverage.masteredOccurrences.toLocaleString() + ' / ' + coverage.totalOccurrences.toLocaleString() + '</span></div>';
    html += '<div class="analytics-cov-row"><span>Estimated Comprehension</span><span>' + compPct + '%</span></div>';
  }
  html += '</div></div></div>';
  
  // Surah Comprehension
  var allSurahComp = (typeof getAllSurahComprehension === 'function') ? getAllSurahComprehension() : [];
  if (allSurahComp && allSurahComp.length > 0) {
    allSurahComp.sort(function(a,b) { return b.estimatedComprehension - a.estimatedComprehension; });
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📖 Surah Comprehension</div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    html += '<div style="flex:1;min-width:130px"><div style="font-size:10px;color:var(--green);margin-bottom:6px;font-weight:500">✅ Best understood</div>';
    var topCount = Math.min(3, allSurahComp.length);
    for (var sci = 0; sci < topCount; sci++) {
      var sc = allSurahComp[sci];
      var sInfo = (typeof getSurahInfo === 'function') ? getSurahInfo(sc.surahId) : null;
      html += '<div style="font-size:11px;color:var(--text);padding:4px 0;border-bottom:1px solid var(--border)">' + (sInfo ? sInfo.name : 'Surah ' + sc.surahId) + ' <span style="color:var(--gold-dim);float:right">' + sc.estimatedComprehension + '%</span></div>';
    }
    html += '</div>';
    allSurahComp.sort(function(a,b) { return a.estimatedComprehension - b.estimatedComprehension; });
    html += '<div style="flex:1;min-width:130px"><div style="font-size:10px;color:var(--red);margin-bottom:6px;font-weight:500">🌱 Needs work</div>';
    var bottomCount = Math.min(3, allSurahComp.length);
    for (var si = 0; si < bottomCount; si++) {
      var sc2 = allSurahComp[si];
      var sInfo2 = (typeof getSurahInfo === 'function') ? getSurahInfo(sc2.surahId) : null;
      html += '<div style="font-size:11px;color:var(--text);padding:4px 0;border-bottom:1px solid var(--border)">' + (sInfo2 ? sInfo2.name : 'Surah ' + sc2.surahId) + ' <span style="color:var(--gold-dim);float:right">' + sc2.estimatedComprehension + '%</span></div>';
    }
    html += '</div></div>';
    var avgComp = 0;
    for (var ai = 0; ai < allSurahComp.length; ai++) avgComp += allSurahComp[ai].estimatedComprehension;
    avgComp = allSurahComp.length > 0 ? Math.round(avgComp / allSurahComp.length) : 0;
    html += '<div style="font-size:10px;color:var(--text-muted);margin-top:8px;text-align:center">Average: ' + avgComp + '% across ' + allSurahComp.length + ' surahs with vocabulary</div>';
    html += '</div>';
  } else {
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📖 Surah Comprehension</div>';
    html += '<div class="analytics-empty">Study words to see surah-level comprehension.</div></div>';
  }
  
  // Learning Paths Progress
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">🛤️ Learning Paths</div>';
  html += '<div class="analytics-progress-block">';
  var pathProgress = (typeof getLearningPathProgress === 'function') ? getLearningPathProgress() : null;
  if (pathProgress) {
    var pathKeys = ['foundation', 'surah', 'rootFamily', 'difficulty'];
    var pathNames = { foundation: 'Foundation Course', surah: 'By Surah', rootFamily: 'Root Families', difficulty: 'Difficulty' };
    var pathColors = { foundation: 'var(--gold)', surah: 'var(--green)', rootFamily: 'var(--purple)', difficulty: 'var(--blue)' };
    for (var pki = 0; pki < pathKeys.length; pki++) {
      var pk = pathKeys[pki];
      var pp = pathProgress[pk];
      if (!pp) continue;
      var pct = pp.percent || 0;
      html += '<div class="analytics-path-row">';
      html += '<div class="analytics-path-label">' + (pathNames[pk] || pk) + '</div>';
      html += '<div class="analytics-path-track"><div class="analytics-path-fill" style="width:' + pct + '%;background:' + (pathColors[pk] || 'var(--gold)') + '"></div></div>';
      html += '<div class="analytics-path-value">' + pct + '%</div>';
      html += '</div>';
    }
  }
  html += '</div></div>';
  
  // Period Summaries
  if (periods) {
    var periodKeys = [
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'allTime', label: 'All Time' },
    ];
    for (var psi = 0; psi < periodKeys.length; psi++) {
      var pInfo = periodKeys[psi];
      var data = periods[pInfo.key];
      if (!data) continue;
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">📅 ' + pInfo.label + '</div>';
      html += '<div class="analytics-period-card">';
      html += '<div class="analytics-period-grid">';
      html += '<div><span class="analytics-period-value">' + (data.gainMastered || 0) + '</span><span class="analytics-period-label">Gained</span></div>';
      html += '<div><span class="analytics-period-value">' + data.totalReviews + '</span><span class="analytics-period-label">Reviews</span></div>';
      html += '<div><span class="analytics-period-value">' + data.daysActive + '</span><span class="analytics-period-label">Active Days</span></div>';
      html += '<div><span class="analytics-period-value">' + (data.gainCoverage || '0') + '%</span><span class="analytics-period-label">Coverage +</span></div>';
      html += '</div></div></div>';
    }
    
    // Consistency
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">🔥 Learning Consistency</div>';
    html += '<div class="analytics-health-card">';
    html += '<div class="analytics-health-row"><span>Active Study Days</span><span>' + periods.consistency + '%</span></div>';
    html += '<div class="analytics-health-row"><span>Current Streak</span><span>' + (profile ? profile.streak || 0 : 0) + ' days</span></div>';
    html += '<div class="analytics-health-row"><span>Avg Reviews/Day</span><span>' + (periods.week ? periods.week.avgReviewsPerDay || 0 : 0) + '</span></div>';
    html += '</div></div>';
  }
  
  // Forecasts
  if (forecasts) {
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">🔮 Forecasts</div>';
    html += '<div class="analytics-forecast-card">';
    
    // Predicted mastery in 7/30/90 days
    html += '<div class="analytics-forecast-grid">';
    html += '<div class="analytics-forecast-item"><span class="analytics-forecast-num">' + forecasts.predictedMastered['7'] + '</span><span class="analytics-forecast-label">7 days</span></div>';
    html += '<div class="analytics-forecast-item"><span class="analytics-forecast-num">' + forecasts.predictedMastered['30'] + '</span><span class="analytics-forecast-label">30 days</span></div>';
    html += '<div class="analytics-forecast-item"><span class="analytics-forecast-num">' + forecasts.predictedMastered['90'] + '</span><span class="analytics-forecast-label">90 days</span></div>';
    html += '</div>';
    
    html += '<div class="analytics-forecast-card" style="margin-top:8px">';
    html += '<div class="analytics-forecast-row"><span>Current pace</span><span>' + forecasts.masteryRatePerDay + ' words/day</span></div>';
    if (forecasts.daysToNextMilestone) {
      html += '<div class="analytics-forecast-row"><span>Next coverage milestone (' + forecasts.nextMilestonePct + '%)</span><span>~' + forecasts.daysToNextMilestone + ' days</span></div>';
    }
    if (forecasts.daysToFoundationCompletion) {
      html += '<div class="analytics-forecast-row"><span>Foundation completion</span><span>~' + forecasts.daysToFoundationCompletion + ' days</span></div>';
    }
          var completionDate = forecasts.completionDate ? new Date(forecasts.completionDate) : null;
    if (completionDate) {
      html += '<div class="analytics-forecast-completion">🎯 Estimated all-vocabulary mastery: ' + completionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '</div>';
    }
    html += '</div></div></div>';
  }
  
  // Achievements Summary
  if (analytics.achievements) {
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">🏆 Achievements</div>';
    html += '<div class="analytics-achievement-summary">';
    html += '<span class="analytics-achievement-big">' + analytics.achievements.earnedCount + ' / ' + analytics.achievements.totalCount + '</span>';
    html += '<span class="analytics-achievement-small">achievements earned</span>';
    if (analytics.achievements.totalCount > 0) {
      html += '<div class="analytics-achievement-track"><div class="analytics-achievement-fill" style="width:' + analytics.achievements.progressPercent + '%"></div></div>';
    }
    html += '<button class="analytics-view-ach-btn" id="analytics-view-all-ach" type="button">View All Achievements →</button>';
    html += '</div></div>';
  }
  
  return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsOverview error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading Overview tab.</div>";
  }
}

// ── TRENDS TAB ──

function renderAnalyticsTrends(analytics) {
  try {
  var html = '';
  
  // Period selector
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📈 Progress Trends</div>';
  html += '<div class="analytics-trend-periods">';
  html += '<div class="analytics-trend-tabs">';
  var trendPeriods = ['7days', '30days', '90days'];
  var trendLabels = ['7 Days', '30 Days', '90 Days'];
  for (var tpi = 0; tpi < trendPeriods.length; tpi++) {
    html += '<button class="analytics-trend-tab' + (tpi === 0 ? ' analytics-trend-active' : '') + '" data-trend-period="' + trendPeriods[tpi] + '" type="button">' + trendLabels[tpi] + '</button>';
  }
  html += '</div></div>';
  
  // Default to 7 days trend data
  var trends = (window.__analytics && window.__analytics.getTrends) ? window.__analytics.getTrends('7days') : null;
  
  if (trends) {
    // Summary stats
    html += '<div class="analytics-trend-summary">';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">+' + (trends.gainMastered || 0) + '</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Words Gained</span></div>';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">+' + (trends.gainCoverage || '0') + '%</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Coverage +</span></div>';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">' + trends.totalReviews + '</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Reviews</span></div>';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">' + trends.avgReviewsPerDay + '</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Reviews/Day</span></div>';
    html += '</div>';
    
    // Mastered trend chart (bar chart)
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">📚 Vocabulary Growth</div>';
    var mastered = trends.mastered;
    if (mastered && mastered.length > 0) {
      var maxMastered = 1;
      for (var mi = 0; mi < mastered.length; mi++) {
        if (mastered[mi] > maxMastered) maxMastered = mastered[mi];
      }
      for (var mi = 0; mi < mastered.length; mi++) {
        var pct = Math.round((mastered[mi] / maxMastered) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels && trends.labels[mi] ? trends.labels[mi] : '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '<span class="analytics-bar-value">' + mastered[mi] + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center">Not enough data yet. Keep studying!</div>';
    }
    html += '</div>';
    
    // Coverage trend chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">📖 Quran Coverage Growth</div>';
    var coverage = trends.coverage;
    if (coverage && coverage.length > 0) {
      var maxCoverage = 100;
      for (var ci = 0; ci < coverage.length; ci++) {
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels && trends.labels[ci] ? trends.labels[ci] : '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + coverage[ci] + '%;background:linear-gradient(90deg,var(--green),var(--gold))"></div></div>';
        html += '<span class="analytics-bar-value">' + coverage[ci] + '%</span>';
        html += '</div>';
      }
    } else {
      html += '<div style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center">Not enough data yet. Keep studying!</div>';
    }
    html += '</div>';
    
    // Reviews per day chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">🔁 Daily Reviews</div>';
    var reviews = trends.reviews;
    if (reviews && reviews.length > 0) {
      var maxReviews = 1;
      for (var ri = 0; ri < reviews.length; ri++) {
        if (reviews[ri] > maxReviews) maxReviews = reviews[ri];
      }
      for (var ri = 0; ri < reviews.length; ri++) {
        var rpct = Math.round((reviews[ri] / maxReviews) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels && trends.labels[ri] ? trends.labels[ri] : '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + rpct + '%;background:linear-gradient(90deg,var(--gold-dim),var(--gold))"></div></div>';
        html += '<span class="analytics-bar-value">' + reviews[ri] + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center">Not enough data yet. Keep studying!</div>';
    }
    html += '</div>';
    
  } else {
    html += '<div class="analytics-empty">Not enough data yet. Study for at least 2 days to see trends.</div>';
  }
  
  // Wire trend period switchers
  // Trend tabs wired in renderAnalyticsTab()
  
  return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsTrends error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading Trends tab.</div>";
  }
}

// ── INSIGHTS TAB ──

function renderAnalyticsInsightsPage(analytics) {
  try {
  var html = '';
  var profile = analytics.profile;
  
  if (profile) {
    // Strongest Roots
    if (profile.strongRoots && profile.strongRoots.length > 0) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">💪 Strongest Root Families</div>';
      html += '<div class="analytics-insight-list">';
      for (var sri = 0; sri < Math.min(profile.strongRoots.length, 8); sri++) {
        var sr = profile.strongRoots[sri];
        html += '<div class="analytics-insight-row">';
        html += '<span class="analytics-insight-label">' + sr.root + '</span>';
        html += '<span class="analytics-insight-sub">' + (sr.rootMeaning || '') + '</span>';
        html += '<span class="analytics-insight-value">' + sr.masteryScore + '%</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    
    // Weakest Roots
    if (profile.weakRoots && profile.weakRoots.length > 0) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">🌱 Weakest Root Families</div>';
      html += '<div class="analytics-insight-list">';
      for (var wri = 0; wri < Math.min(profile.weakRoots.length, 8); wri++) {
        var wr = profile.weakRoots[wri];
        html += '<div class="analytics-insight-row">';
        html += '<span class="analytics-insight-label" style="color:var(--red)">' + wr.root + '</span>';
        html += '<span class="analytics-insight-sub">' + (wr.rootMeaning || '') + '</span>';
        html += '<span class="analytics-insight-value" style="color:var(--red)">' + wr.masteryScore + '%</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    
    // Forgetting Curve Analysis
    if (profile) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">🧠 Memory Health</div>';
      html += '<div class="analytics-health-card">';
      var stages = profile.stageDistribution || { newCount: 0, learning: 0, young: 0, mature: 0 };
      html += '<div class="analytics-health-row"><span>🆕 New words</span><span>' + (stages.newCount || 0) + '</span></div>';
      html += '<div class="analytics-health-row"><span>🔁 Learning</span><span>' + (stages.learning || 0) + '</span></div>';
      html += '<div class="analytics-health-row"><span>🌱 Young</span><span>' + (stages.young || 0) + '</span></div>';
      html += '<div class="analytics-health-row"><span>💡 Mature</span><span>' + (stages.mature || 0) + '</span></div>';
      html += '<div class="analytics-health-row" style="color:var(--red)"><span>⏰ Critically Overdue</span><span>' + (profile.criticallyOverdue || 0) + '</span></div>';
      html += '</div></div>';
    }
    
    // Quiz Performance
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📝 Quiz Performance</div>';
    html += '<div class="analytics-health-card">';
    var quizHistory = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
    var qTotal = quizHistory ? quizHistory.total : 0;
    var qCorrect = quizHistory ? quizHistory.correct : 0;
    var qAccuracy = qTotal > 0 ? Math.round((qCorrect / qTotal) * 100) : 0;
    html += '<div class="analytics-health-row"><span>Quiz Questions Answered</span><span>' + qTotal + '</span></div>';
    html += '<div class="analytics-health-row"><span>Correct Answers</span><span>' + qCorrect + '</span></div>';
    html += '<div class="analytics-health-row"><span>Overall Accuracy</span><span>' + qAccuracy + '%</span></div>';
    html += '</div></div>';
    
    // SRS Health
    var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
    if (srsStats) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">❤️ SRS Health</div>';
      html += '<div class="analytics-health-card">';
      html += '<div class="analytics-health-row"><span>Average Retention</span><span>' + srsStats.avgRetention + '%</span></div>';
      html += '<div class="analytics-health-row"><span>Average Ease Factor</span><span>' + (srsStats.avgEaseFactor ? srsStats.avgEaseFactor.toFixed(2) : '2.50') + '</span></div>';
      html += '<div class="analytics-health-row"><span>Leeched Words</span><span>' + (srsStats.leechCount || 0) + '</span></div>';
      html += '</div></div>';
    }
    
  } else {
    html += '<div class="analytics-empty">Start learning to see your insights!</div>';
  }
  
  return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsInsightsPage error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading InsightsPage tab.</div>";
  }
}

// ── ACHIEVEMENTS TAB ──

function renderAnalyticsAchievements() {
  try {
  var html = '';
  var allAchievements = (window.__analytics && window.__analytics.getAllAchievements) ? window.__analytics.getAllAchievements() : [];
  var achievementStats = (window.__analytics && window.__analytics.getAchievementStats) ? window.__analytics.getAchievementStats() : null;
  
  if (allAchievements.length === 0) {
    html += '<div class="analytics-empty">No achievements to display.</div>';
    return html;
  }
  
  // Summary
  if (achievementStats) {
    html += '<div class="analytics-ach-progress">';
    html += '<span class="analytics-ach-big">' + achievementStats.earnedCount + ' / ' + achievementStats.totalCount + '</span>';
    html += '<div class="analytics-ach-track-big"><div class="analytics-ach-fill-big" style="width:' + achievementStats.progressPercent + '%"></div></div>';
    html += '</div>';
    
    // By category
    if (achievementStats.byCategory) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">📊 Progress by Category</div>';
      html += '<div class="analytics-progress-block">';
      var catNames = { foundation: 'Foundation', coverage: 'Coverage', mastery: 'Mastery', streak: 'Streak', review: 'Review', quiz: 'Quiz', root: 'Root', path: 'Path', consistency: 'Consistency' };
      var catColors = { foundation: 'var(--gold)', coverage: 'var(--green)', mastery: 'var(--blue)', streak: 'var(--red)', review: 'var(--purple)', quiz: 'var(--pink)', root: 'var(--green)', path: 'var(--gold-dim)', consistency: 'var(--blue)' };
      var catKeys = Object.keys(achievementStats.byCategory);
      for (var cki = 0; cki < catKeys.length; cki++) {
        var ck = catKeys[cki];
        var cat = achievementStats.byCategory[ck];
        var catPct = cat.total > 0 ? Math.round((cat.earned / cat.total) * 100) : 0;
        html += '<div class="analytics-path-row">';
        html += '<div class="analytics-path-label">' + (catNames[ck] || ck) + '</div>';
        html += '<div class="analytics-path-track"><div class="analytics-path-fill" style="width:' + catPct + '%;background:' + (catColors[ck] || 'var(--gold)') + '"></div></div>';
        html += '<div class="analytics-path-value">' + cat.earned + '/' + cat.total + '</div>';
        html += '</div>';
      }
      html += '</div></div>';
    }
  }
  
  // Achievement cards
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">🎯 All Achievements</div>';
  html += '<div class="analytics-ach-grid">';
  for (var ai = 0; ai < allAchievements.length; ai++) {
    var ach = allAchievements[ai];
    html += '<div class="analytics-ach-card' + (ach.earned ? ' analytics-ach-earned' : '') + '">';
    html += '<div class="analytics-ach-icon">' + ach.icon + '</div>';
    html += '<div class="analytics-ach-title">' + ach.title + '</div>';
    html += '<div class="analytics-ach-desc">' + ach.description + '</div>';
    if (ach.earned && ach.earnedDate) {
      html += '<div class="analytics-ach-date">Earned ' + ach.earnedDate + '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';
  
  return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsAchievements error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading Achievements tab.</div>";
  }
}

// Export for app.js
window.__renderAnalytics = renderAnalytics;

window.__openExplorer = openExplorer;
window.__explorerWord = function() { return _explorerWord; };

// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COMPREHENSION ANIMATIONS — Smooth number counting, ring fill, milestone celebration
// ═══════════════════════════════════════════════════════════════

/**
 * Animate a number element counting from 0 to target.
 * @param {Element} el - The DOM element to update
 * @param {number} target - The target value (0-100)
 * @param {number} duration - Animation duration in ms (default 800)
 */
function animateComprehensionNumber(el, target, duration) {
  if (!el) return;
  duration = duration || 800;
  var startTime = null;
  var startVal = 0;
  
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min(1, (timestamp - startTime) / duration);
    // Ease out cubic
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(eased * target);
    el.textContent = current + '%';
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target + '%';
      el.classList.add('animate-count');
    }
  }
  
  requestAnimationFrame(step);
}

/**
 * Animate the SVG comprehension ring from 0 to target percent.
 * @param {Element} ringEl - The SVG path element for the ring fill
 * @param {number} targetPercent - The final percentage (0-100)
 * @param {number} duration - Animation duration in ms (default 800)
 */
function animateComprehensionRing(ringEl, targetPercent, duration) {
  if (!ringEl) return;
  duration = duration || 800;
  var startTime = null;
  targetPercent = Math.min(100, Math.max(0, targetPercent));
  
  // Save original transition and disable it during animation to avoid conflict
  var origTransition = ringEl.style.transition;
  ringEl.style.transition = 'none';
  
  // Start at 0
  ringEl.setAttribute('stroke-dasharray', '0, 100');
  
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min(1, (timestamp - startTime) / duration);
    // Ease out cubic with slight overshoot
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(eased * targetPercent);
    ringEl.setAttribute('stroke-dasharray', current + ', 100');
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      // Restore original transition
      ringEl.style.transition = origTransition || '';
    }
  }
  
  // Force layout to ensure 'none' transition is applied before first frame
  void ringEl.getBoundingClientRect();
  requestAnimationFrame(step);
}

/**
 * Trigger a milestone celebration effect on the comprehension card.
 * @param {Element} cardEl - The dashboard comprehension card element
 */
function triggerMilestoneCelebration(cardEl) {
  if (!cardEl) return;
  
  // Add celebration class
  cardEl.classList.add('milestone-celebration', 'milestone-confetti');
  
  // Pulse the ring
  var ringWrap = cardEl.querySelector('.db-ring-wrap');
  if (ringWrap) ringWrap.classList.add('animate-ring-pulse');
  
  // Remove animation classes after they complete
  setTimeout(function() {
    cardEl.classList.remove('milestone-celebration', 'milestone-confetti');
    if (ringWrap) ringWrap.classList.remove('animate-ring-pulse');
  }, 2000);
}

/**
 * Animate delta rows with staggered entrance
 * @param {Element} container - The parent element containing delta rows
 */
function animateDeltaRows(container) {
  if (!container) return;
  var rows = container.querySelectorAll('.db-delta-row, .db-milestone-row, .db-insight-message, .db-next-milestone');
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.add('animate-delta');
    // Use JS-applied delays instead of CSS nth-child (which counts all siblings)
    rows[i].style.animationDelay = (0.4 + i * 0.1) + 's';
  }
}

/**
 * Full comprehension animation sequence for the dashboard card.
 * @param {Element} cardEl - The dashboard comprehension card
 * @param {number} comprehensionPct - The comprehension percentage to animate to
 * @param {boolean} isNewMilestone - Whether a new milestone was just reached
 */
function animateDashboardComprehension(cardEl, comprehensionPct, isNewMilestone) {
  if (!cardEl) return;
  
  var ringEl = cardEl.querySelector('.db-ring-fill');
  var ringText = cardEl.querySelector('.db-ring-text');
  var ringWrap = cardEl.querySelector('.db-ring-wrap');
  
  // Animate ring fill from 0 to target
  if (ringEl) {
    animateComprehensionRing(ringEl, comprehensionPct);
  }
  
  // Animate ring text number counting up
  if (ringText) {
    animateComprehensionNumber(ringText, comprehensionPct);
  }
  
  // Ring glow effect
  if (ringWrap) {
    ringWrap.classList.add('animate-ring-glow');
    setTimeout(function() {
      ringWrap.classList.remove('animate-ring-glow');
    }, 1500);
  }
  
  // Staggered delta row entrance
  animateDeltaRows(cardEl);
  
  // Milestone celebration
  if (isNewMilestone) {
    triggerMilestoneCelebration(cardEl);
  }
}

// LEARNING PATH DASHBOARD — Multi-Path Progress & Selection
// ═══════════════════════════════════════════════════════════════

/**
 * Render the Learning Path Dashboard.
 * Called by switchView('dashboard').
 */
function renderDashboard() {
  try {
  var $d = DOM.get('dashboard-grid');
  if (!$d) return;

  // ── Gather data ──
  var $srsObj = window.__srs;
  var $srsStats = ($srsObj && $srsObj.getStats) ? $srsObj.getStats() : (typeof getSRSStats === 'function' ? getSRSStats() : { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0 });
  if (!$srsStats) $srsStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0 };
  var $dueReviews = typeof getDueReviews === 'function' ? getDueReviews() : [];
  var $streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var $streak = $streakData.streak || 0;

  // Foundation course data
  var $fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var $fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var $foundationsPct = $fTotal > 0 ? Math.round(($fCompleted / $fTotal) * 100) : 0;

  // Quran coverage data
  var $coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;

  // Mastery stats
  var $masteredCount = $srsStats.mature || 0;
  var $totalWords = $srsStats.total || (typeof getCanonicalWordCount === 'function' && getCanonicalWordCount() > 0 ? getCanonicalWordCount() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 0));
  var $comprehensionPct = $coverage ? $coverage.estimatedComprehension : 0;

  // Learn by Surah data
  var $surahProgress = typeof getSurahLessonProgress === 'function' ? getSurahLessonProgress() : null;
  var $surahCompleted = $surahProgress ? $surahProgress.completedSurahs : 0;
  var $surahTotal = $surahProgress ? $surahProgress.totalSurahs : 90;
  var $surahPct = $surahTotal > 0 ? Math.round(($surahCompleted / $surahTotal) * 100) : 0;

  // Due reviews
  var $dueCount = $dueReviews.length;

  // Reviews today
  var $reviewsToday = $srsStats.reviewsToday || 0;

  // ── Build HTML ──
  var $html = '';

  // 1. Greeting
  $html += '<div class="db-greeting">';
  $html += '<span class="db-greeting-icon" aria-hidden="true">&#x1F4D6;</span>';
  $html += '<div>';
  $html += '<h2 class="db-greeting-title">Assalamu Alaikum</h2>';
  $html += '<p class="db-greeting-sub">Your journey to understand the Quran</p>';
  $html += '</div></div>';

  // 2. Hero Stats Bar
  $html += '<div class="db-hero-bar">';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Streak: ' + $streak + ' days" id="db-hero-streak">';
  $html += '<div class="db-hero-stat-value">\uD83D\uDD25 ' + $streak + '</div>';
  $html += '<div class="db-hero-stat-label">Day Streak</div></div>';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Words mastered: ' + $masteredCount + '" id="db-hero-mastered">';
  $html += '<div class="db-hero-stat-value">' + $masteredCount + '</div>';
  $html += '<div class="db-hero-stat-label">Mastered</div></div>';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Quran coverage: ' + $comprehensionPct + '%" id="db-hero-coverage">';
  $html += '<div class="db-hero-stat-value">' + $comprehensionPct + '%</div>';
  $html += '<div class="db-hero-stat-label">Coverage</div></div>';
  $html += '<div class="db-hero-stat" role="button" tabindex="0" aria-label="Reviews today: ' + $reviewsToday + '" id="db-hero-reviews">';
  $html += '<div class="db-hero-stat-value">' + $reviewsToday + '</div>';
  $html += '<div class="db-hero-stat-label">Reviews</div></div>';
  $html += '</div>';

  // Comprehension ring offset
  var $covOffset = Math.min(100, Math.max(0, Math.round(($comprehensionPct / 100) * 100)));

  // 3. Quran Comprehension Card (hero feature)
  $html += '<div class="db-card db-card-highlight">';
  $html += '<div class="db-comp-row">';
  $html += '<div class="db-ring-wrap">';
  $html += '<svg class="db-ring" viewBox="0 0 36 36" aria-hidden="true">';
  $html += '<defs>';
  $html += '<linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">';
  $html += '<stop offset="0%" stop-color="#c9a84c" />';
  $html += '<stop offset="100%" stop-color="#e8c97a" />';
  $html += '</linearGradient>';
  $html += '</defs>';
  $html += '<path class="db-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />';
  $html += '<path class="db-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + $covOffset + ', 100" />';
  $html += '<text class="db-ring-text" x="18" y="20.5">' + $comprehensionPct + '%</text>';
  $html += '</svg></div>';
  $html += '<div class="db-comp-info">';
  $html += '<div class="db-comp-label">Quran Comprehension</div>';
  $html += '<div class="db-comp-value">' + $comprehensionPct + '%</div>';
  $html += '<div class="db-comp-detail">';
  if ($coverage) {
    $html += $masteredCount + ' of ' + $coverage.totalWords + ' words mastered';
  } else {
    $html += 'You understand <strong>' + $comprehensionPct + '%</strong> of Quran word occurrences';
  }
  $html += '</div>';
  // Milestone insight
  var $ms = typeof getMilestoneStatus === 'function' ? getMilestoneStatus($comprehensionPct) : null;
  if ($ms && $ms.currentMilestone) {
    $html += '<div class="db-comp-milestone">';
    $html += $ms.currentMilestone.icon + ' ' + $ms.currentMilestone.label;
    $html += '</div>';
  }
  $html += '</div></div></div>';

  // 4. CTA — Continue Learning (large primary button)
  var $continueLabel = $fCompleted === 0 ? 'Start Foundation Course' : ($fCompleted < $fTotal ? 'Continue Foundation Course' : "Review What You've Learned");
  $html += '<button class="db-cta" id="db-continue" role="button" aria-label="' + $continueLabel + '">';
  $html += '<div class="db-cta-title">' + $continueLabel + '</div>';
  $html += '<div class="db-cta-sub">Foundation ' + Math.min($fCompleted + 1, $fTotal) + ' of ' + $fTotal + ' lessons</div>';
  $html += '<span class="db-cta-arrow" aria-hidden="true">\u2192</span>';
  $html += '</button>';

  // 5. Foundation Course Card
  $html += '<div class="db-card db-action-card" id="db-foundation" role="button" tabindex="0" aria-label="Foundation Course progress: ' + $fCompleted + ' of ' + $fTotal + ' lessons">';
  $html += '<div class="db-card-row">';
  $html += '<div class="db-card-icon" style="background:rgba(201,168,76,0.1)">&#x1F4D8;</div>';
  $html += '<div class="db-card-body">';
  $html += '<div class="db-card-title">Foundation Course</div>';
  $html += '<div class="db-card-sub">' + $fCompleted + ' of ' + $fTotal + ' lessons completed</div>';
  $html += '</div>';
  $html += '<span class="db-arrow" aria-hidden="true">\u2192</span>';
  $html += '</div>';
  $html += '<div class="db-progress">';
  $html += '<div class="db-progress-track"><div class="db-progress-fill" style="width:' + $foundationsPct + '%"></div></div>';
  $html += '<span class="db-progress-text">' + $foundationsPct + '%</span>';
  $html += '</div></div>';

  // 6. Learn by Surah Card
  $html += '<div class="db-card db-action-card" id="db-surah" role="button" tabindex="0" aria-label="Learn by Surah: ' + $surahCompleted + ' of ' + $surahTotal + ' surahs">';
  $html += '<div class="db-card-row">';
  $html += '<div class="db-card-icon" style="background:rgba(74,158,107,0.1)">&#x1F4DC;</div>';
  $html += '<div class="db-card-body">';
  $html += '<div class="db-card-title">Learn by Surah</div>';
  $html += '<div class="db-card-sub">' + $surahCompleted + ' of ' + $surahTotal + ' surahs studied</div>';
  $html += '</div>';
  $html += '<span class="db-arrow" aria-hidden="true">\u2192</span>';
  $html += '</div>';
  $html += '<div class="db-progress">';
  $html += '<div class="db-progress-track"><div class="db-progress-fill db-fill-green" style="width:' + $surahPct + '%"></div></div>';
  $html += '<span class="db-progress-text">' + $surahPct + '%</span>';
  $html += '</div></div>';

  // 7. Due Reviews Card (conditional)
  if ($dueCount > 0) {
    $html += '<div class="db-card db-action-card db-card-due" id="db-review" role="button" tabindex="0" aria-label="' + $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + ' due for review">';
    $html += '<div class="db-card-row">';
    $html += '<div class="db-card-icon" style="background:rgba(201,168,76,0.15)">\uD83D\uDD14</div>';
    $html += '<div class="db-card-body">';
    $html += '<div class="db-card-title">Due Reviews</div>';
    $html += '<div class="db-card-sub">' + ($dueCount === 1 ? '1 word ready for review' : $dueCount + ' words ready for review') + '</div>';
    $html += '</div>';
    $html += '<span class="db-badge">' + $dueCount + '</span>';
    $html += '</div></div>';
  }

  // 8. Weekly Progress Section
  $html += '<div class="db-card">';
  $html += '<div class="db-weekly">';
  $html += '<div class="db-weekly-title">\uD83D\uDCC5 Weekly Review Forecast</div>';
  var $srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var $now = Date.now();
  var $dayMs = 24 * 60 * 60 * 1000;
  var $intervals = [
    { label: 'Today', days: 0 },
    { label: '3 Days', days: 3 },
    { label: '7 Days', days: 7 },
  ];
  var $totalW = (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length : 1) || 1;
  for (var $ii = 0; $ii < $intervals.length; $ii++) {
    var $int = $intervals[$ii];
    var $cut = $now + $int.days * $dayMs;
    var $cnt = 0;
    if (typeof ALL_WORDS !== 'undefined') {
      for (var $wi = 0; $wi < ALL_WORDS.length; $wi++) {
        var $e = $srsData[ALL_WORDS[$wi].id];
        if ($e && $e.dueDate <= $cut) $cnt++;
      }
    }
    var $pct = Math.round($totalW > 0 ? ($cnt / $totalW) * 100 : 0);
    var $color = $int.days === 0 ? 'var(--gold)' : ($int.days <= 3 ? 'var(--blue)' : 'var(--green)');
    $html += '<div class="db-weekly-item">';
    $html += '<span class="db-weekly-label">' + $int.label + '</span>';
    $html += '<div class="db-weekly-track"><div class="db-weekly-fill" style="width:' + Math.min($pct, 100) + '%;background:' + $color + '"></div></div>';
    $html += '<span class="db-weekly-value">' + $cnt + '</span>';
    $html += '</div>';
  }
  $html += '</div></div>';

  // 9. Achievements Section
  $html += '<div class="db-card">';
  $html += '<div class="db-achievement">';
  $html += '<div class="db-ach-title">\uD83C\uDFC6 Recent Achievements</div>';
  $html += '<div class="db-ach-row">';
  if ($streak > 0) {
    $html += '<span class="db-ach-item">\uD83D\uDD25 ' + $streak + '-day streak</span>';
  }
  if ($masteredCount > 0) {
    $html += '<span class="db-ach-item">\uD83D\uDCA1 ' + $masteredCount + ' words mastered</span>';
  }
  $html += '<span class="db-ach-item">\uD83D\uDCD6 ' + $totalWords + ' total words</span>';
  if ($reviewsToday > 0) {
    $html += '<span class="db-ach-item">\uD83D\uDD01 ' + $reviewsToday + ' reviewed today</span>';
  }
  if ($fCompleted > 0) {
    $html += '<span class="db-ach-item">\uD83D\uDCD8 ' + $fCompleted + ' lessons done</span>';
  }
  $html += '</div></div></div>';

  // ── Inject HTML ──
  $d.innerHTML = $html;

  // ── Wire hero stats clicks ──
  var $heroStreak = DOM.get('db-hero-streak');
  if ($heroStreak) {
    $heroStreak.onclick = function() { switchView('stats'); };
    $heroStreak.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('stats'); } };
  }
  var $heroMastered = DOM.get('db-hero-mastered');
  if ($heroMastered) {
    $heroMastered.onclick = function() { switchView('list'); };
    $heroMastered.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('list'); } };
  }
  var $heroCoverage = DOM.get('db-hero-coverage');
  if ($heroCoverage) {
    $heroCoverage.onclick = function() { switchView('analytics'); };
    $heroCoverage.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('analytics'); } };
  }
  var $heroReviews = DOM.get('db-hero-reviews');
  if ($heroReviews) {
    $heroReviews.onclick = function() { if (typeof startReview === 'function') startReview(); else switchView('learn'); };
    $heroReviews.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof startReview === 'function') startReview(); } };
  }

  // ── Wire card clicks ──
  var $contBtn = DOM.get('db-continue');
  if ($contBtn) {
    $contBtn.onclick = function() {
      if (typeof goToFoundationLesson === 'function') {
        goToFoundationLesson(typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0);
      } else {
        switchView('learn');
      }
    };
  }
  var $foundCard = DOM.get('db-foundation');
  if ($foundCard) {
    $foundCard.onclick = function() {
      if (typeof goToFoundationLesson === 'function') {
        goToFoundationLesson(typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0);
      }
    };
    $foundCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $foundCard.onclick(); }
    };
  }
  var $surahCard = DOM.get('db-surah');
  if ($surahCard) {
    $surahCard.onclick = function() {
      switchView('learn');
    };
    $surahCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchView('learn'); }
    };
  }
  var $reviewCard = DOM.get('db-review');
  if ($reviewCard) {
    $reviewCard.onclick = function() {
      if (typeof startReview === 'function') startReview();
      else switchView('learn');
    };
    $reviewCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof startReview === 'function') startReview(); }
    };
  }

  // ── Animate comprehension ring ──
  var $compCardParent = $d.querySelector('.db-card-highlight');
  var $isNewMs = false;
  if (window.__prevComprehensionPct !== undefined) {
    var $milestones = window.__comprehensionMilestones || [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95, 100];
    for (var $mi = 0; $mi < $milestones.length; $mi++) {
      if (window.__prevComprehensionPct < $milestones[$mi] && $comprehensionPct >= $milestones[$mi]) {
        $isNewMs = true;
        break;
      }
    }
  }
  window.__prevComprehensionPct = $comprehensionPct;
  if (typeof animateDashboardComprehension === 'function') {
    animateDashboardComprehension($compCardParent, $comprehensionPct, $isNewMs);
  }

  } catch (e) {
    console.error('[dashboard] renderDashboard error:', e);
    var $d = DOM.get('dashboard-grid');
    if ($d) $d.innerHTML = '<div class="db-error">\u26A0\uFE0F Something went wrong loading your dashboard. <button class="btn btn-sm mt-10" onclick="window.location.reload()">Reload</button></div>';
  }
}