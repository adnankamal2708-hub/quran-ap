// ═══════════════════════════════════════════════════════════════
// reader-word-sheet.js — Bottom Sheet Word Detail Panel
//
// A lightweight bottom sheet that slides up when a user taps
// a word token in the Quran Reading Mode. Shows all word details
// including Arabic, meaning, root, SRS status, occurrences, and
// quick actions — without leaving the reading view.
// ═══════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────

/** @type {Object|null} The currently displayed word */
var _sheetWord = null;

/** @type {boolean} Whether the sheet is currently visible */
var _sheetVisible = false;

// ── Open / Close ───────────────────────────────────────────────

/**
 * Open the bottom sheet for a given word.
 * @param {Object} word - The word object to display
 */
function openWordSheet(word) {
  if (!word) return;
  _sheetWord = word;
  _sheetVisible = true;
  renderWordSheet();
  _showSheetElement();
}

/**
 * Close the bottom sheet and return focus to the reading view.
 */
function closeWordSheet() {
  _sheetVisible = false;
  _hideSheetElement();
  _sheetWord = null;
}

// ── DOM Helpers ────────────────────────────────────────────────

function _get(id) {
  return document.getElementById(id);
}

function _showSheetElement() {
  var overlay = _get('reader-word-sheet-overlay');
  var panel = _get('reader-word-sheet-panel');
  if (overlay) {
    overlay.style.display = 'block';
    // Force reflow for transition
    overlay.offsetHeight;
    overlay.classList.add('reader-sheet-visible');
  }
  if (panel) {
    panel.style.display = 'flex';
    panel.offsetHeight;
    panel.classList.add('reader-sheet-open');
  }
  // Prevent body scroll while sheet is open
  document.body.classList.add('reader-sheet-locked');
}

function _hideSheetElement() {
  var overlay = _get('reader-word-sheet-overlay');
  var panel = _get('reader-word-sheet-panel');
  if (overlay) overlay.classList.remove('reader-sheet-visible');
  if (panel) panel.classList.remove('reader-sheet-open');
  document.body.classList.remove('reader-sheet-locked');
  // After transition completes, hide display
  setTimeout(function() {
    if (!_sheetVisible) {
      if (panel) panel.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
    }
  }, 300);
}

// ── Render ─────────────────────────────────────────────────────

function renderWordSheet() {
  var w = _sheetWord;
  if (!w) return;

  // ── 1. Arabic & Meaning ──
  var arabicEl = _get('sheet-word-arabic');
  var translitEl = _get('sheet-word-translit');
  var meaningEl = _get('sheet-word-meaning');
  var masteryEl = _get('sheet-word-mastery');

  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var srsEntry = srsData[w.id] || null;
  var colorClass = _getMasteryColorForSheet(w.id, srsData);
  var stageLabel = _getStageLabel(srsEntry);

  if (arabicEl) arabicEl.textContent = w.arabic || '';
  if (translitEl) translitEl.textContent = w.translit || '';
  if (meaningEl) meaningEl.textContent = w.meaning || w.english || '';

  if (masteryEl) {
    masteryEl.textContent = stageLabel;
    masteryEl.className = 'reader-sheet-badge reader-token-' + colorClass;
  }

  // ── 2. Quick Stats ──
  _setText('sheet-root', w.root && w.root !== '—' ? w.root : '—');
  _setText('sheet-root-meaning', w.rootMeaning || '');
  _setText('sheet-pattern', w.pattern && w.pattern !== '—' ? w.pattern : '—');
  _setText('sheet-type', w.type || w.typeCategory || '—');
  _setText('sheet-occ', w.occ ? w.occ.toLocaleString() + '×' : '—');
  _setText('sheet-freq', w.frequencyRank ? '#' + w.frequencyRank : '—');

  // ── 3. Difficulty Stars ──
  var diffEl = _get('sheet-difficulty');
  if (diffEl && w.difficulty) {
    var stars = '';
    for (var di = 0; di < 5; di++) {
      stars += di < w.difficulty ? '★' : '☆';
    }
    diffEl.textContent = stars;
  } else if (diffEl) {
    diffEl.textContent = '—';
  }

  // ── 4. SRS Progress ──
  var status = typeof getSRSStatus === 'function' ? getSRSStatus(w.id) : null;
  _setText('sheet-srs-stage', stageLabel);

  if (status && status.status !== 'new') {
    var daysUntilDue = status.daysUntilDue;
    var dueText = '';
    if (daysUntilDue === null) dueText = '—';
    else if (daysUntilDue < 0) dueText = '🔴 Overdue ' + Math.abs(daysUntilDue) + 'd';
    else if (daysUntilDue === 0) dueText = 'Due today';
    else if (daysUntilDue === 1) dueText = 'Due tomorrow';
    else dueText = 'Due in ' + daysUntilDue + 'd';
    _setText('sheet-next-review', dueText);

    _setText('sheet-retention', status.retention !== undefined ? Math.round(status.retention * 100) + '%' : '—');
    _setText('sheet-total-reviews', srsEntry ? (srsEntry.totalReviews || 0) : 0);
  } else {
    _setText('sheet-next-review', 'New — not yet studied');
    _setText('sheet-retention', '—');
    _setText('sheet-total-reviews', '0');
  }

  // ── 5. Foundation Lesson ──
  var flEl = _get('sheet-foundation-lesson');
  if (flEl) {
    if (w.foundationLessonId !== undefined && w.foundationLessonId >= 0) {
      flEl.textContent = 'Foundation ' + (w.foundationLessonId + 1);
    } else {
      flEl.textContent = '—';
    }
  }

  // ── 6. Learning Priority ──
  var prioEl = _get('sheet-priority');
  if (prioEl) {
    if (w.learningPriority) {
      var label = typeof getLearningPriorityLabel === 'function'
        ? getLearningPriorityLabel(w.learningPriority) : '';
      prioEl.textContent = label ? w.learningPriority + ' — ' + label : w.learningPriority;
    } else {
      prioEl.textContent = '—';
    }
  }

  // ── 7. Root Family ──
  var rootFamEl = _get('sheet-root-family');
  if (rootFamEl) {
    rootFamEl.innerHTML = '';
    if (w.rootFamily && w.rootFamily.length > 0) {
      for (var rfi = 0; rfi < Math.min(w.rootFamily.length, 5); rfi++) {
        var rf = w.rootFamily[rfi];
        var chip = document.createElement('span');
        chip.className = 'reader-sheet-chip';
        chip.textContent = rf.a + ' (' + rf.e + ')';
        chip.setAttribute('tabindex', '0');
        chip.setAttribute('role', 'button');
        chip.setAttribute('aria-label', 'Explore ' + rf.a);
        (function(arabic) {
          chip.onclick = function() {
            var target = typeof findWordByArabic === 'function' ? findWordByArabic(arabic) : null;
            if (target) {
              closeWordSheet();
              if (typeof openExplorer === 'function') {
                openExplorer(target);
              }
            }
          };
          chip.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.onclick(); }
          };
        })(rf.a);
        rootFamEl.appendChild(chip);
      }
    } else {
      rootFamEl.innerHTML = '<span class="reader-sheet-empty">No root family data</span>';
    }
  }

  // ── 8. Bookmark button state ──
  var bookmarkBtn = _get('sheet-btn-bookmark');
  if (bookmarkBtn) {
    var isFav = typeof isFavorite === 'function' ? isFavorite(w.id) : false;
    bookmarkBtn.textContent = isFav ? '⭐ Bookmarked' : '☆ Bookmark';
    bookmarkBtn.className = 'reader-sheet-action-btn' + (isFav ? ' reader-sheet-active' : '');
  }

  // Wire events
  _wireSheetEvents(w);
}

function _setText(id, text) {
  var el = _get(id);
  if (el) el.textContent = text;
}

function _getMasteryColorForSheet(wordId, srsData) {
  var entry = srsData[wordId];
  if (!entry) return 'unknown';
  if (entry.stage >= 3) return 'mastered';
  if (entry.stage >= 2) return 'known';
  if (entry.stage >= 1) return 'learning';
  return 'seen';
}

function _getStageLabel(entry) {
  if (!entry || entry.stage === 0) return '🆕 New';
  if (entry.stage === 1) return '🔁 Learning';
  if (entry.stage === 2) return '📗 Young';
  if (entry.stage >= 3) return '✓ Mastered';
  return '🆕 New';
}

// ── Event Wiring ───────────────────────────────────────────────

function _wireSheetEvents(w) {
  // Close button
  var closeBtn = _get('reader-sheet-close');
  if (closeBtn) {
    closeBtn.onclick = closeWordSheet;
  }

  // Overlay backdrop click
  var overlay = _get('reader-word-sheet-overlay');
  if (overlay) {
    overlay.onclick = function(e) {
      if (e.target === overlay) closeWordSheet();
    };
  }

  // Remove previous listener to avoid accumulation
  if (_sheetKeyHandler) {
    document.removeEventListener("keydown", _sheetKeyHandler);
  }
  // Keyboard: Escape to close
  _sheetKeyHandler = function(e) {
    if (e.key === 'Escape' && _sheetVisible) {
      closeWordSheet();
    }
  };
  document.addEventListener('keydown', _sheetKeyHandler);

  // Bookmark button
  var bookmarkBtn = _get('reader-sheet-btn-bookmark');
  if (bookmarkBtn) {
    bookmarkBtn.onclick = function() {
      if (typeof toggleFavorite === 'function') {
        var isNowFav = toggleFavorite(w.id);
        bookmarkBtn.textContent = isNowFav ? '⭐ Bookmarked' : '☆ Bookmark';
        bookmarkBtn.className = 'reader-sheet-action-btn' + (isNowFav ? ' reader-sheet-active' : '');
      }
    };
  }

  // Open in Explorer button
  var exploreBtn = _get('reader-sheet-btn-explore');
  if (exploreBtn) {
    exploreBtn.onclick = function() {
      closeWordSheet();
      if (typeof openExplorer === 'function') {
        openExplorer(w);
      }
    };
  }

  // Quick Review (rate) button
  var reviewBtn = _get('reader-sheet-btn-review');
  if (reviewBtn) {
    // Show review buttons only for words that have been studied
    var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
    var entry = srsData[w.id];
    reviewBtn.style.display = entry ? 'flex' : 'none';
    
    var againBtn = _get('reader-sheet-rate-again');
    var hardBtn = _get('reader-sheet-rate-hard');
    var goodBtn = _get('reader-sheet-rate-good');
    var easyBtn = _get('reader-sheet-rate-easy');

    if (againBtn) {
      againBtn.onclick = function() {
        if (typeof rateSRSWord === 'function') rateSRSWord(w.id, 0);
        closeWordSheet();
        _showRatingToast('Again — review sooner');
        // Re-render reader to update word colors
        if (typeof renderAyahs === 'function') renderAyahs();
      };
    }
    if (hardBtn) {
      hardBtn.onclick = function() {
        if (typeof rateSRSWord === 'function') rateSRSWord(w.id, 1);
        closeWordSheet();
        _showRatingToast('Hard — review a bit sooner');
        if (typeof renderAyahs === 'function') renderAyahs();
      };
    }
    if (goodBtn) {
      goodBtn.onclick = function() {
        if (typeof rateSRSWord === 'function') rateSRSWord(w.id, 2);
        closeWordSheet();
        _showRatingToast('Good — on track!');
        if (typeof renderAyahs === 'function') renderAyahs();
      };
    }
    if (easyBtn) {
      easyBtn.onclick = function() {
        if (typeof rateSRSWord === 'function') rateSRSWord(w.id, 3);
        closeWordSheet();
        _showRatingToast('Easy — well learned!');
        if (typeof renderAyahs === 'function') renderAyahs();
      };
    }
  }
}

/** Track the keyboard handler so we can remove it later */
var _sheetKeyHandler = null;

/**
 * Show a brief toast notification after rating a word.
 */
function _showRatingToast(message) {
  var existing = document.querySelector('.reader-sheet-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'reader-sheet-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Force reflow then animate in
  toast.offsetHeight;
  toast.classList.add('reader-sheet-toast-visible');

  setTimeout(function() {
    toast.classList.remove('reader-sheet-toast-visible');
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 2000);
}

// ── Cleanup ────────────────────────────────────────────────────

/**
 * Clean up event listeners on navigation.
 */
function destroyWordSheet() {
  if (_sheetKeyHandler) {
    document.removeEventListener('keydown', _sheetKeyHandler);
    _sheetKeyHandler = null;
  }
  _sheetVisible = false;
  _sheetWord = null;
  document.body.classList.remove('reader-sheet-locked');
}

// ── Export ──────────────────────────────────────────────────────

window.__readerWordSheet = {
  open: openWordSheet,
  close: closeWordSheet,
  destroy: destroyWordSheet,
};
