// ═══════════════════════════════════════════════════════════════
// ui.js — UI Rendering Module
// All DOM manipulation functions — no application state here
// ═══════════════════════════════════════════════════════════════

/**
 * Force CSS reflow for animation restart.
 */
function reflow(element) {
  void element.offsetWidth;
}

/**
 * Set active view, switching visible tab content and nav tab highlight.
 */
function setView(viewName) {
  // All possible views — both main content and overlay views
  const views = ['learn', 'quiz', 'list', 'stats', 'auth', 'profile', 'settings'];
  views.forEach((name) => {
    const viewEl = document.getElementById('view-' + name);
    if (viewEl) viewEl.classList.toggle('active', name === viewName);

    // Only toggle tab highlights for main nav tabs
    if (['learn', 'quiz', 'list', 'stats'].indexOf(name) >= 0) {
      const tabEl = document.getElementById('tab-' + name);
      if (tabEl) tabEl.classList.toggle('active', name === viewName);
    }
  });
  const content = document.getElementById('content');
  if (content) content.scrollTop = 0;
}

/**
 * Render the word card for a given word at the given position.
 */
function renderWordCard(w, currentIndex, total, isReview) {
  if (!w) return;

  document.getElementById('word-num').textContent = `${isReview ? 'Review' : 'Word'} ${currentIndex + 1} of ${total}`;
  document.getElementById('arabic-word').textContent = w.arabic;
  document.getElementById('transliteration').textContent = w.translit;
  document.getElementById('word-type').textContent = w.type;

  // Pattern display
  var patternEl = document.getElementById('word-pattern');
  if (w.pattern && w.pattern !== '\u2014') {
    patternEl.textContent = 'Pattern: ' + w.pattern;
    patternEl.style.display = 'block';
  } else {
    patternEl.style.display = 'none';
  }

  document.getElementById('meaning').textContent = w.meaning;
  document.getElementById('occurrences').textContent = `\u2726 Appears ${w.occ.toLocaleString()} times`;

  document.getElementById('progress-fill').style.width = `${((currentIndex + 1) / total) * 100}%`;
  document.getElementById('progress-text').textContent = `${currentIndex + 1} / ${total}`;

  document.getElementById('btn-prev').disabled = currentIndex === 0;
  document.getElementById('btn-next').textContent = currentIndex < total - 1 ? 'Next \u2192' : isReview ? 'Done \u2713' : 'Quiz \u270F\uFE0F';

  // SRS pill — now shows stage info
  renderSRSStatusPill(w.arabic);

  // Root box
  renderRootBox(w);

  // Word network: similar & opposite
  renderWordNetwork(w);

  // Hide ayah & tafsir on navigation
  const ayahBox = document.getElementById('ayah-box');
  const tafsirBox = document.getElementById('tafsir-box');
  const tafsirBtn = document.getElementById('tafsir-btn');
  if (ayahBox) ayahBox.classList.remove('visible');
  if (tafsirBox) tafsirBox.classList.remove('visible');
  if (tafsirBtn) tafsirBtn.style.display = 'block';

  // SRS buttons
  const srs = getSRSStatus(w.arabic);
  const showSRS = srs.status !== 'new' || currentIndex > 0;
  document.getElementById('srs-row').style.display = showSRS ? 'grid' : 'none';
  document.getElementById('srs-label').style.display = showSRS ? 'block' : 'none';

  // Bookmark + notes
  updateBookmarkButton(w.arabic);
  document.getElementById('notes-box').style.display = 'block';
  document.getElementById('notes-input').value = getNote(w.arabic);

  // Animate card
  const card = document.getElementById('word-card');
  card.classList.remove('fade-in');
  reflow(card);
  card.classList.add('fade-in');
}

/**
 * Render the SRS status pill with stage, retention, and leech info.
 */
function renderSRSStatusPill(arabic) {
  const srs = getSRSStatus(arabic);
  const pill = document.getElementById('sr-pill');
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

  // Special styling for leeched words
  if (srs.isLeech) {
    pill.style.borderColor = 'rgba(194, 80, 80, 0.5)';
    pill.style.background = 'rgba(194, 80, 80, 0.08)';
  } else {
    pill.style.borderColor = '';
    pill.style.background = '';
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
 */
function showAyah(w) {
  if (!w) return;
  document.getElementById('ayah-arabic').innerHTML = w.ayahA;
  document.getElementById('ayah-translation').innerHTML = w.ayahT;
  document.getElementById('ayah-ref').textContent = w.ayahR;
  document.getElementById('ayah-box').classList.add('visible');
}

/**
 * Load and display Ibn Kathir tafsir for the current word.
 */
function loadTafsir(w) {
  if (!w) return;
  document.getElementById('tafsir-box').classList.add('visible');
  document.getElementById('tafsir-text').innerHTML = '<span class="tafsir-loading">Loading Ibn Kathir commentary\u2026</span>';
  document.getElementById('tafsir-btn').style.display = 'none';
  setTimeout(() => {
    document.getElementById('tafsir-text').textContent = w.tafsir;
  }, 400);
}

/**
 * Show ayah + tafsir together.
 */
function showWordContent(w) {
  if (!w) return;
  showAyah(w);
  loadTafsir(w);
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
function updateBookmarkButton(arabic) {
  const btn = document.getElementById('qa-bookmark');
  if (!btn) return;
  if (isFavorite(arabic)) {
    btn.textContent = '\u2B50 Bookmarked';
    btn.style.borderColor = 'var(--gold-dim)';
    btn.style.color = 'var(--gold)';
  } else {
    btn.textContent = '\u2606 Bookmark';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

/**
 * Update the daily goal progress ring based on reviews done today.
 */
function updateGoalRing() {
  var ringFill = document.getElementById('goal-ring-fill');
  var ringText = document.getElementById('goal-ring-text');
  var ringWrap = document.getElementById('goal-ring-wrap');
  if (!ringFill || !ringText || !ringWrap) return;

  // Get stats and compute progress
  var stats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
  if (!stats) {
    ringFill.setAttribute('stroke-dasharray', '0, 100');
    ringText.textContent = '0';
    ringWrap.setAttribute('aria-valuenow', '0');
    return;
  }

  var dailyLimit = (window.__srs && window.__srs.getDailyReviewLimit)
    ? window.__srs.getDailyReviewLimit()
    : 25;
  var reviewsToday = stats.reviewsToday || 0;
  // Guard against division by zero (shouldn't happen but be safe)
  if (dailyLimit <= 0) dailyLimit = 25;
  var pct = Math.min(100, Math.round((reviewsToday / dailyLimit) * 100));
  var circumference = 100;
  var offset = Math.round((pct / 100) * circumference);

  ringFill.setAttribute('stroke-dasharray', offset + ', ' + circumference);
  ringText.textContent = pct;
  ringWrap.setAttribute('aria-valuenow', pct.toString());
  ringWrap.title = 'Daily review goal: ' + reviewsToday + ' of ' + dailyLimit + ' (' + pct + '%)';
}

/**
 * Update the top stats bar and total word count.
 */
function updateStatsDisplay() {
  var data = loadSRS();
  var totalWords = document.getElementById('stat-total');
  if (totalWords) {
    totalWords.textContent = ALL_WORDS.length;
  }
  var learned = 0;
  var lessonWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : ALL_WORDS.slice(0, 20);
  lessonWords.forEach(function (w) {
    var entry = data[w.arabic];
    if (entry && entry.stage && entry.stage > 0) learned++;
  });
  var due = getDueReviews().length;
  document.getElementById('stat-learned').textContent = learned;
  document.getElementById('stat-review').textContent = due;

  // Also update quiz score in stats if available
  var quizScore = document.getElementById('stat-score');
  if (quizScore && window.__quiz) {
    // Score is updated via quiz module directly
  }

  // Update the goal ring
  updateGoalRing();
}

/**
 * Show or update the review banner.
 */
function updateReviewBanner() {
  var due = getDueReviews();
  var banner = document.getElementById('review-banner');
  var bannerText = document.getElementById('review-banner-text');
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
  var searchQuery = document.getElementById('search-input') ? document.getElementById('search-input').value : '';
  var activeType = document.querySelector('#filter-type-chips .chip-active');
  var activeStatus = document.querySelector('#filter-status-chips .chip-active');
  var typeFilter = activeType ? activeType.getAttribute('data-value') : 'all';
  var statusFilter = activeStatus ? activeStatus.getAttribute('data-value') : 'all';

  var words = ALL_WORDS;

  // Apply search
  words = searchWords(searchQuery);

  // Apply type filter
  words = filterByCategory(words, typeFilter);

  // Apply status filter
  if (statusFilter === 'favorites') {
    words = filterByFavorites(words);
  } else {
    words = filterByStatus(words, statusFilter);
  }

  // Update count
  var countEl = document.getElementById('list-count');
  if (countEl) countEl.textContent = words.length + ' word' + (words.length !== 1 ? 's' : '');

  // Render list
  const container = document.getElementById('wordlist-container');
  container.innerHTML = '';

  if (words.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-muted);font-size:13px">No words match your search or filters.</div>';
    return;
  }

  words.forEach((w) => {
    var srs = getSRSStatus(w.arabic);
    var badge = '';
    if (srs.status === 'mastered') {
      badge = srs.stage >= 3 ? '\uD83D\uDCA1' : srs.stage >= 2 ? '\uD83C\uDF31' : '\u2713';
    } else if (srs.status === 'review') {
      badge = srs.isLeech ? '\uD83D\uDCA2' : '\uD83D\uDD01';
    } else {
      badge = '\uD83C\uDD95';
    }
    var favStar = isFavorite(w.arabic) ? '\u2B50' : '';
    var d = document.createElement('div');
    d.className = 'wordlist-item';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('aria-label', `Study ${w.arabic} - ${w.meaning.split('\u2014')[0].trim()}`);
    d.innerHTML =
      '<div class="wordlist-arabic">' + w.arabic + '</div>' +
      '<div class="wordlist-info">' +
        '<div class="wordlist-meaning">' + w.meaning.split('\u2014')[0].trim() + '</div>' +
        '<div class="wordlist-sub">' + w.translit + ' \u00B7 ' + w.root + ' \u00B7 ' + w.type + '</div>' +
      '</div>' +
      '<div class="wordlist-badge">' + favStar + badge + '</div>';
    d.onclick = () => navigateToWord(w);
    d.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToWord(w);
      }
    };
    container.appendChild(d);
  });
}

/**
 * Render the statistics dashboard.
 */
function renderStats() {
  // Use cached stats if available
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : getSRSStats();
  var srsData = loadSRS();
  var now = Date.now();

  // Core stats grid
  document.getElementById('stat-total').textContent = srsStats.total;
  document.getElementById('stat-mastered').textContent = srsStats.mature;
  document.getElementById('stat-new-count').textContent = srsStats.newCount;
  document.getElementById('stat-learning-count').textContent = srsStats.dueToday;

  // Streak
  updateStreakDisplay();

  // By type chart
  var typeContainer = document.getElementById('stats-by-type');
  typeContainer.innerHTML = '';
  var typeLabels = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations' };
  Object.keys(typeLabels).forEach(function (key) {
    var count = 0;
    ALL_WORDS.forEach(function (w) {
      if (w.typeCategory === key) count++;
    });
    if (count === 0) return;
    var pct = Math.round((count / srsStats.total) * 100);
    typeContainer.appendChild(createBarRow(typeLabels[key], count, pct));
  });

  // By difficulty chart
  var diffContainer = document.getElementById('stats-by-difficulty');
  diffContainer.innerHTML = '';
  for (var d = 1; d <= 5; d++) {
    var count = 0;
    ALL_WORDS.forEach(function (w) {
      if (w.difficulty === d) count++;
    });
    if (count === 0) continue;
    var pct = Math.round((count / srsStats.total) * 100);
    var diffLabels = { 1: 'Easy (\u2605)', 2: 'Medium (\u2605\u2605)', 3: 'Hard (\u2605\u2605\u2605)', 4: 'Complex (\u2605\u2605\u2605\u2605)', 5: 'Advanced (\u2605\u2605\u2605\u2605\u2605)' };
    diffContainer.appendChild(createBarRow(diffLabels[d] || 'Level ' + d, count, pct));
  }

  // Learning stage breakdown
  var stageContainer = document.getElementById('stats-stages');
  if (stageContainer) {
    stageContainer.innerHTML = '';
    var stageLabels = [
      { key: 'newCount', label: '\uD83C\uDD95 New', color: 'var(--blue)' },
      { key: 'learning', label: '\uD83D\uDD0D Learning', color: 'var(--purple)' },
      { key: 'young', label: '\uD83C\uDF31 Young', color: 'var(--gold-dim)' },
      { key: 'mature', label: '\uD83D\uDCA1 Mature', color: 'var(--green)' },
    ];
    stageLabels.forEach(function (sl) {
      var count = srsStats[sl.key] || 0;
      if (count === 0) return;
      var pct = Math.round((count / srsStats.total) * 100);
      var row = document.createElement('div');
      row.className = 'stats-bar-row';
      row.innerHTML =
        '<span class="stats-bar-label" style="color:' + sl.color + '">' + sl.label + '</span>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%;background:' + sl.color + '"></div></div>' +
        '<span class="stats-bar-value">' + count + '</span>';
      stageContainer.appendChild(row);
    });
  }

  // SRS Health section
  var healthContainer = document.getElementById('stats-health');
  if (healthContainer) {
    healthContainer.innerHTML = '';
    var healthItems = [
      {
        label: 'Avg Retention',
        value: srsStats.avgRetention + '%',
        pct: srsStats.avgRetention,
        color: 'var(--green)',
      },
      {
        label: 'Avg Ease',
        value: srsStats.avgEaseFactor.toFixed(2),
        pct: Math.round((srsStats.avgEaseFactor / 3) * 100),
        color: 'var(--blue)',
      },
      {
        label: 'Overdue',
        value: srsStats.overdue,
        pct: srsStats.dueToday > 0 ? Math.round((srsStats.overdue / srsStats.dueToday) * 100) : 0,
        color: srsStats.overdue > 0 ? 'var(--red)' : 'var(--green)',
      },
      {
        label: 'Reviews Today',
        value: srsStats.reviewsToday,
        pct: Math.min(100, Math.round((srsStats.reviewsToday / DAILY_REVIEW_LIMIT) * 100)),
        color: 'var(--gold)',
      },
    ];
    healthItems.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'stats-bar-row';
      row.innerHTML =
        '<span class="stats-bar-label">' + item.label + '</span>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + item.pct + '%;background:' + item.color + '"></div></div>' +
        '<span class="stats-bar-value">' + item.value + '</span>';
      healthContainer.appendChild(row);
    });
  }

  // Leeches
  var leechContainer = document.getElementById('stats-leeches');
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
  var container = document.getElementById('stats-forecast');
  container.innerHTML = '';
  var intervals = [
    { label: 'Today', days: 0 },
    { label: '3 days', days: 3 },
    { label: '7 days', days: 7 },
    { label: '14 days', days: 14 },
    { label: '30 days', days: 30 },
  ];
  var totalWords = ALL_WORDS.length;

  intervals.forEach(function (interval) {
    var cutoff = now + interval.days * DAY_MS;
    var count = 0;
    ALL_WORDS.forEach(function (w) {
      var entry = srsData[w.arabic];
      if (entry && entry.dueDate <= cutoff) count++;
    });
    var pct = Math.round((count / totalWords) * 100);
    container.appendChild(createBarRow(interval.label, count, pct));
  });
}

/**
 * Update streak display with localStorage tracking.
 */
function updateStreakDisplay() {
  var data = loadStreakData();
  var streak = data.streak || 0;
  var today = getDateKey();

  document.getElementById('streak-count').textContent = streak;

  if (data.lastDate === today) {
    document.getElementById('streak-today').textContent = '\u2713 Reviewed today! Come back tomorrow.';
    document.getElementById('streak-today').style.color = 'var(--green)';
  } else if (data.lastDate === getYesterdayKey()) {
    document.getElementById('streak-today').textContent = '\uD83D\uDD25 ' + streak + ' day streak! Review today to continue.';
    document.getElementById('streak-today').style.color = 'var(--gold)';
  } else {
    document.getElementById('streak-today').textContent = 'Start your streak by reviewing a word today!';
    document.getElementById('streak-today').style.color = '';
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

  const correct = currentWordObj.meaning.split('\u2014')[0].trim();

  // Use educational distractors from vocabulary service
  var distractors = getDistractors(currentWordObj, 3);
  var opts = [correct];
  distractors.forEach(function (d) {
    var label = d.meaning.split('\u2014')[0].trim();
    if (label !== correct && opts.indexOf(label) === -1) {
      opts.push(label);
    }
  });
  // Fallback if not enough options
  if (opts.length < 4) {
    allWords.forEach(function (w) {
      if (w !== currentWordObj && opts.length < 4) {
        var label = w.meaning.split('\u2014')[0].trim();
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
    b.onclick = function () { handleQuizAnswer(b, opt, correct, currentWordObj.arabic); };
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
 */
function navigateToWord(w) {
  // Find word in the current lesson first, then fall back to ALL_WORDS
  var lessonWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : ALL_WORDS;
  var idx = lessonWords.indexOf(w);
  if (idx >= 0) {
    window.__navigateToWordIndex(idx);
  } else {
    // Word not in current lesson — switch to its lesson with word index
    var globalIdx = ALL_WORDS.indexOf(w);
    if (globalIdx >= 0) {
      var wordLesson = Math.floor(globalIdx / WORDS_PER_LESSON);
      var wordInLesson = globalIdx % WORDS_PER_LESSON;
      if (wordLesson >= 0 && typeof goToLesson === 'function') {
        goToLesson(wordLesson, wordInLesson);
      }
    }
  }
}
