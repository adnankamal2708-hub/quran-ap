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
    } else {
      badge = $badge('star');
    }
    var favStar = favs[w.id] ? $badge('star-fill') : '';
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
      { key: 'newCount', label: 'New', color: 'var(--blue)', filterStatus: 'new' },
      { key: 'learning', label: 'Learning', color: 'var(--purple)', filterStatus: 'learning' },
      { key: 'young', label: 'Young', color: 'var(--gold-dim)', filterStatus: 'mastered' },
      { key: 'mature', label: 'Mature', color: 'var(--green)', filterStatus: 'mastered' },
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
        '<span class="stats-bar-label" style="color:' + color + '">Foundation</span>' +
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
      var $sight = typeof getComprehensionInsight === 'function' ? getComprehensionInsight() : null;
      if (coverage && foundCov) {
        var covRow1 = document.createElement('div');
        covRow1.className = 'stats-bar-row stats-comprehension-row';
        covRow1.innerHTML = '<span style="font-size:11px;color:var(--green);font-weight:500;padding:2px 0">Quran Reading Coverage: ' + coverage.coveragePercent + '%</span>';
        foundationStatsContainer.appendChild(covRow1);
        var compRow = document.createElement('div');
        compRow.className = 'stats-bar-row';
        compRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:2px 0">Estimated comprehension: ' + coverage.estimatedComprehension + '%</span>';
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
          rootsRow.innerHTML = '<span style="font-size:10px;color:var(--purple);padding:2px 0">Roots mastered: ' + roots.fullyMasteredRoots + '/' + roots.totalRoots + ' (' + (roots.totalRoots > 0 ? Math.round(roots.fullyMasteredRoots / roots.totalRoots * 100) : 0) + '%)</span>';
          foundationStatsContainer.appendChild(rootsRow);
        }
        if (fCompleted > 0) {
          var fCovRow = document.createElement('div');
          fCovRow.className = 'stats-bar-row';
          fCovRow.innerHTML = '<span style="font-size:10px;color:var(--green);padding:2px 0">Foundation coverage: ' + foundCov.foundationCoveragePercent + '% of Quran (' + foundCov.masteredFoundationWords + '/' + foundCov.totalFoundationWords + ' words)</span>';
          foundationStatsContainer.appendChild(fCovRow);
        }
      }
      if (fCompleted < fTotal) {
        var nextLesson = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
        var covRow = document.createElement('div');
        covRow.className = 'stats-bar-row';
        var fLesson = FOUNDATION_LESSONS && FOUNDATION_LESSONS[nextLesson] ? FOUNDATION_LESSONS[nextLesson] : null;
        var coverageText = fLesson ? 'Next: Foundation ' + (nextLesson + 1) + ' (+' + fLesson.lessonCoverage + ')' : '';
        covRow.innerHTML = '<span style="font-size:10px;color:var(--text-muted);padding:4px 0">' + coverageText + '</span>';
        foundationStatsContainer.appendChild(covRow);
      } else {
        var covRow = document.createElement('div');
        covRow.className = 'stats-bar-row';
        covRow.innerHTML = '<span style="font-size:11px;color:var(--green);padding:4px 0">Foundation Course Complete! ~' + (typeof getFoundationCoverage === 'function' ? getFoundationCoverage().foundationCoveragePercent : '84') + '% Quran coverage</span>';
        foundationStatsContainer.appendChild(covRow);
      }
    } else {
      foundationStatsContainer.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Start the Foundation Course to track your Quran comprehension growth lesson by lesson</div>';
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
      surahCompContainer.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Study vocabulary to unlock comprehension scores for each of the 114 surahs</div>';
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
      leechContainer.innerHTML = '<div style="font-size:12px;color:var(--red);padding:8px 0">' + srsStats.leechCount + ' leeched word' + (srsStats.leechCount !== 1 ? 's' : '') + ' \u2014 consider giving extra attention</div>';
    } else {
      leechContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No leeched words</div>';
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
    streakToday.textContent = 'Reviewed today! Come back tomorrow.';
    streakToday.style.color = 'var(--green)';
  } else if (data.lastDate === getYesterdayKey()) {
    streakToday.textContent = streak + ' day streak! Review today to continue.';
    streakToday.style.color = 'var(--gold)';
  } else if (streak > 0) {
    streakToday.textContent = streak + ' day streak! Review today to continue.';
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
