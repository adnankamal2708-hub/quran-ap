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
  // Always scroll to top when rendering the word list
  var contentEl = DOM.get('content');
  if (contentEl) contentEl.scrollTop = 0;
  
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
    // Determine badge icon using SVG system
    var $icon = window.__components && window.__components.createSVGIcon;
    function $badge(name) {
      return $icon ? $icon(name, {size: 14}) : '';
    }
    var badge = '';
    if (entry && entry.stage >= 3) {
      badge = $badge('brain');
    } else if (entry && entry.stage >= 2) {
      badge = $badge('leaf');
    } else if (entry && entry.stage >= 1 && Date.now() >= entry.dueDate) {
      badge = entry.isLeech ? $badge('alert-triangle') : $badge('repeat');
    } else if (entry) {
      // Studied but not yet due — neutral star. Words with no SRS entry at
      // all get NO badge: a default star on every unstudied row is noise.
      badge = $badge('star');
    }
    var favStar = favs[w.id] ? $badge('star-fill') : '';
    // Free-tier vocabulary gate: premium-tier words show a locked row (word
    // still visible so free users can discover it) but open the locked
    // explorer state instead of full detail on tap.
    var isLocked = typeof isFreeAccessible === 'function' && !isFreeAccessible(w);
    var d = document.createElement('div');
    d.className = 'wordlist-item' + (advFiltersActive && !isLocked ? ' has-quick-actions' : '') +
      ' stagger-item' + (isLocked ? ' locked-word' : '');
    d.style.animationDelay = Math.min(i * 30, 350) + 'ms';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    var shortMeaning = getShortMeaning(w.meaning);
    d.setAttribute('aria-label', (isLocked ? 'Premium word (locked) — ' : 'Study ') + w.arabic + ' - ' + shortMeaning);
    var lockBadge = isLocked
      ? '<span class="locked-badge" title="Premium word — beyond the free 300">\uD83D\uDD12</span>'
      : favStar + badge;
    d.innerHTML =
      '<div class="wordlist-arabic">' + w.arabic + '</div>' +
      '<div class="wordlist-info">' +
        '<div class="wordlist-meaning">' + shortMeaning + '</div>' +
        '<div class="wordlist-sub">' + w.translit + ' \u00B7 ' + w.root + ' \u00B7 ' + w.type + '</div>' +
      '</div>' +
      '<div class="wordlist-badge">' + lockBadge + '</div>';
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
    
    // Add quick action buttons for advanced search results (locked words
    // only surface the locked detail — no bookmark/flash backdoors)
    if (advFiltersActive && !isLocked) {
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

function invalidateStatsCaches() {
  // No-op: type/difficulty count caches were removed with the dead stats view.
  // Kept because srs.js calls this after SRS ratings.
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
