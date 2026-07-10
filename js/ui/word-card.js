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