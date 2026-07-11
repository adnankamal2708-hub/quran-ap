// ═══════════════════════════════════════════════════════════════
// reader.js — Interactive Quran Reading Mode
//
// Bridges vocabulary study with actual Quran reading.
// Every vocabulary word is tappable, color-coded by SRS mastery,
// and links to the existing explorer/word card.
// ═══════════════════════════════════════════════════════════════

// ── Reading State ──────────────────────────────────────────────

let _readerSurahId = null;       // Currently selected surah
let _readerSurahWords = [];      // Words for the current surah
let _readerAyahGroups = {};      // Words grouped by verseKey: { "1:1": [...words], ... }
let _readerVerseKeys = [];       // Sorted verseKey array for the surah
let _readerSRSData = {};         // Cached SRS data for coloring
let _readerScrollVerse = null;   // Verse to scroll to after render
let _readerWordData = {};        // Quick lookup: arabic text → word object for the surah
let _readerFilters = {           // Active reader filters
  hideTranslation: false,
  showUnknownOnly: false,
  focusMode: false,
  nightMode: false,
};
let _readerTrackedAyahs = {};    // Set of tracked ayahs for deduplication

// ── Reading Journey Storage Key ────────────────────────────────
const READER_JOURNEY_KEY = 'quran_reader_journey';

// ── Load/Save Reading Journey ──────────────────────────────────

function _loadReaderJourney() {
  try {
    var raw = localStorage.getItem(READER_JOURNEY_KEY);
    if (!raw) return { surahs: {}, totalAyahsRead: 0, readingStreak: 0, lastReadDate: null, openings: 0 };
    return JSON.parse(raw);
  } catch (e) {
    return { surahs: {}, totalAyahsRead: 0, readingStreak: 0, lastReadDate: null, openings: 0 };
  }
}

function _saveReaderJourney(data) {
  try {
    localStorage.setItem(READER_JOURNEY_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

// ── Mastery Color Map ─────────────────────────────────────────
// Gold   → Mastered (stage >= 3)
// Green  → Well known (stage == 2)
// Blue   → Learning (stage == 1)
// Gray   → Seen before (ratedAt exists but stage == 0)
// Red    → Unknown / new

function _readerGetMasteryColor(wordId) {
  var entry = _readerSRSData[wordId];
  if (!entry) return 'unknown';              // Red / unknown
  if (entry.stage >= 3) return 'mastered';   // Gold
  if (entry.stage >= 2) return 'known';      // Green
  if (entry.stage >= 1) return 'learning';   // Blue
  return 'seen';                              // Gray — rated but reset
}

// ── Occcurrence-Weighted Comprehension ─────────────────────────
// Weight each word by its total Quranic occurrence count (occ).
// A word appearing 100x has more comprehension impact than one appearing 2x.

function _calcAyahComprehension(words) {
  var totalWeight = 0;
  var knownWeight = 0;
  var learningWeight = 0;

  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    var weight = w.occ || (w.occurrences ? w.occurrences.length : 1);
    if (weight < 1) weight = 1;
    totalWeight += weight;

    var color = _readerGetMasteryColor(w.id);
    if (color === 'mastered' || color === 'known') {
      knownWeight += weight;
    } else if (color === 'learning') {
      learningWeight += weight;
    }
  }

  var pct = totalWeight > 0 ? Math.round(((knownWeight + learningWeight * 0.5) / totalWeight) * 100) : 0;
  return {
    pct: pct,
    known: knownWeight,
    learning: learningWeight,
    unknown: totalWeight - knownWeight - learningWeight,
    total: totalWeight
  };
}

// ── Surah Browser ──────────────────────────────────────────────

function renderSurahBrowser() {
  var container = document.getElementById('reader-surah-list');
  if (!container) return;
  
  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};
  var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  var allSurahComp = typeof getAllSurahComprehension === 'function' ? getAllSurahComprehension() : [];
  var compMap = {};
  for (var ci = 0; ci < allSurahComp.length; ci++) {
    compMap[allSurahComp[ci].surahId] = allSurahComp[ci];
  }
  
  // Load reading journey
  var journey = _loadReaderJourney();

  // Search filter
  var searchInput = document.getElementById('reader-search-input');
  var searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  var html = '';
  for (var si = 0; si < surahIds.length; si++) {
    var sid = surahIds[si];
    var info = typeof getSurahInfo === 'function' ? getSurahInfo(sid) : null;
    var comp = compMap[sid] || null;
    var compPct = comp ? comp.estimatedComprehension : 0;
    var masteredInSurah = comp ? comp.masteredWords : 0;
    var totalInSurah = comp ? comp.totalWords : 0;
    var words = typeof getSurahWords === 'function' ? getSurahWords(sid) : [];
    
    // Search filter
    if (searchTerm) {
      var searchName = (info ? info.name + ' ' + info.english : 'Surah ' + sid).toLowerCase();
      if (searchName.indexOf(searchTerm) < 0) continue;
    }

    // Calculate reading readiness
    var overdueCount = 0;
    for (var wi = 0; wi < words.length; wi++) {
      var entry = _readerSRSData[words[wi].id];
      if (entry && entry.dueDate && Date.now() >= entry.dueDate) overdueCount++;
    }
    var readingReady = overdueCount === 0 && totalInSurah > 0;
    
    // Color coding for comprehension
    var compClass = 'reader-comp-green';
    if (compPct >= 70) compClass = 'reader-comp-gold';
    else if (compPct >= 40) compClass = 'reader-comp-green';
    else if (compPct >= 20) compClass = 'reader-comp-blue';
    else if (compPct > 0) compClass = 'reader-comp-gray';
    else compClass = 'reader-comp-red';
    
    var isActive = _readerSurahId === sid;
    var activeClass = isActive ? ' reader-surah-active' : '';

    // Journey badges
    var journeyEntry = journey.surahs && journey.surahs[sid];
    var readBadge = journeyEntry ? ' ✓' : '';
    
    html += '<div class="reader-surah-item' + activeClass + '" data-surah-id="' + sid + '" tabindex="0" role="button" aria-label="' + (info ? info.name : 'Surah ' + sid) + ' — ' + compPct + '% comprehension">';
    html += '<div class="reader-surah-top">';
    html += '<span class="reader-surah-num">' + sid + '.</span>';
    html += '<span class="reader-surah-name">' + (info ? info.name : 'Surah ' + sid) + readBadge + '</span>';
    if (readingReady && compPct >= 50) html += '<span class="reader-ready-badge">✓</span>';
    html += '<span class="reader-comp-pct ' + compClass + '">' + compPct + '%</span>';
    html += '</div>';
    html += '<div class="reader-surah-meta">' + (info ? info.english : '') + ' · ' + masteredInSurah + '/' + totalInSurah + ' words</div>';
    html += '<div class="reader-comp-bar"><div class="reader-comp-fill ' + compClass + '" style="width:' + compPct + '%"></div></div>';
    html += '</div>';
  }
  
  container.innerHTML = html;
  
  // Wire surah clicks
  var items = container.querySelectorAll('.reader-surah-item');
  for (var ii = 0; ii < items.length; ii++) {
    (function(el) {
      var sid = parseInt(el.getAttribute('data-surah-id'), 10);
      el.onclick = function() { openSurahForReading(sid); };
      el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSurahForReading(sid); }
      };
    })(items[ii]);
  }
}

// ── Open Surah for Reading ─────────────────────────────────────

function openSurahForReading(surahId) {
  if (!surahId) return;
  
  // Track reading session
  var journey = _loadReaderJourney();
  journey.lastReadDate = Date.now();
  journey.openings = (journey.openings || 0) + 1;
  if (!journey.surahs) journey.surahs = {};
  if (!journey.surahs[surahId]) {
    journey.surahs[surahId] = { firstRead: Date.now(), readCount: 0, ayahsRead: 0 };
  }
  journey.surahs[surahId].readCount = (journey.surahs[surahId].readCount || 0) + 1;
  _saveReaderJourney(journey);

  _readerSurahId = surahId;
  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};
  
  // Get surah words and group by verse
  _readerSurahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];
  _readerAyahGroups = {};
  _readerVerseKeys = [];
  _readerWordData = {};
  
  // Build word lookup by arabic text
  for (var i = 0; i < _readerSurahWords.length; i++) {
    var w = _readerSurahWords[i];
    _readerWordData[w.arabic] = w;
  }
  
  // Group by verseKey
  for (var wi = 0; wi < _readerSurahWords.length; wi++) {
    var word = _readerSurahWords[wi];
    var processedKeys = {};
    if (word.occurrences && word.occurrences.length > 0) {
      for (var oi = 0; oi < word.occurrences.length; oi++) {
        var occ = word.occurrences[oi];
        if (occ.surahId === surahId || !occ.surahId) {
          var vk = occ.verseKey || (surahId + ':1');
          if (!processedKeys[vk]) {
            if (!_readerAyahGroups[vk]) {
              _readerAyahGroups[vk] = { words: [], ayahA: occ.ayahA || '', ayahT: occ.ayahT || '' };
              _readerVerseKeys.push(vk);
            }
            _readerAyahGroups[vk].words.push(word);
            processedKeys[vk] = true;
            if (occ.ayahA && occ.ayahA.length > (_readerAyahGroups[vk].ayahA || '').length) {
              _readerAyahGroups[vk].ayahA = occ.ayahA;
              _readerAyahGroups[vk].ayahT = occ.ayahT || _readerAyahGroups[vk].ayahT;
            }
          }
        }
      }
    }
  }
  
  // Sort verse keys
  _readerVerseKeys.sort(function(a, b) {
    var aParts = a.split(':');
    var bParts = b.split(':');
    return (parseInt(aParts[1], 10) || 0) - (parseInt(bParts[1], 10) || 0);
  });
  
  // Update UI
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(surahId) : null;
  var surahNameEl = document.getElementById('reader-surah-title');
  if (surahNameEl) {
    surahNameEl.textContent = (surahInfo ? surahInfo.name + ' — ' + surahInfo.english : 'Surah ' + surahId);
  }
  
  // Update the surah view
  renderSurahBrowser();
  renderAyahs();
  renderSurahComprehensionHeader();
  renderReadingInsightsPanel();
  
  var versesContainer = document.getElementById('reader-verses');
  if (versesContainer) versesContainer.scrollTop = 0;
}

// ── Render Ayahs ───────────────────────────────────────────────

function renderAyahs() {
  var container = document.getElementById('reader-verses');
  if (!container) return;
  
  if (_readerVerseKeys.length === 0) {
    container.innerHTML = '<div class="reader-empty">' +
      '<div style="font-size: 32px; margin-bottom: 12px">📖</div>' +
      '<div>No vocabulary words available for this surah.</div>' +
      '<div style="font-size: 11px; color: var(--text-muted); margin-top: 8px">Select a different surah from the list above.</div>' +
      '</div>';
    return;
  }
  
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(_readerSurahId) : null;
  var totalVerses = surahInfo ? surahInfo.verses : 0;
  
  var html = '';
  
  for (var vi = 0; vi < _readerVerseKeys.length; vi++) {
    var verseKey = _readerVerseKeys[vi];
    var group = _readerAyahGroups[verseKey];
    if (!group) continue;
    
    var verseNum = parseInt(verseKey.split(':')[1], 10) || 0;
    var totalWords = group.words.length;
    
    // OCCURRENCE-WEIGHTED ayah comprehension
    var ayahComp = _calcAyahComprehension(group.words);
    var ayahCompPct = ayahComp.pct;
    var ayahCompColor = ayahCompPct >= 70 ? 'var(--gold)' : (ayahCompPct >= 40 ? 'var(--green)' : (ayahCompPct >= 20 ? 'var(--blue)' : 'var(--text-muted)'));
    
    // Skip if filter is "show unknown only" and ayah has no unknown words
    if (_readerFilters.showUnknownOnly && ayahComp.unknown === 0) continue;
    
    // Focus mode: dim the ayah
    var focusClass = _readerFilters.focusMode ? ' reader-ayah-focus' : '';
    
    html += '<div class="reader-ayah' + focusClass + '" id="reader-ayah-' + verseKey.replace(':', '-') + '">';
    
    // Verse header with occurrence-weighted comprehension
    html += '<div class="reader-ayah-header">';
    html += '<div class="reader-ayah-num">Verse ' + verseNum + (totalVerses > 0 ? ' of ' + totalVerses : '') + '</div>';
    html += '<div class="reader-ayah-comp" style="color:' + ayahCompColor + '" title="Estimated comprehension: ' + ayahCompPct + '% (occurrence-weighted)">' + ayahCompPct + '% understood</div>';
    html += '</div>';
    
    // Arabic verse with tappable word tokens
    html += '<div class="reader-ayah-arabic" lang="ar" dir="rtl">';
    
    // Render word tokens with color coding
    for (var wi = 0; wi < group.words.length; wi++) {
      var w = group.words[wi];
      var colorClass = _readerGetMasteryColor(w.id);
      var isLeech = _readerSRSData[w.id] && _readerSRSData[w.id].isLeech;
      
      // Skip mastered words in "show unknown only" mode
      if (_readerFilters.showUnknownOnly && (colorClass === 'mastered' || colorClass === 'known')) continue;
      
      var extraClass = isLeech ? ' reader-token-leech' : '';
      html += '<span class="reader-word-token reader-token-' + colorClass + extraClass + '" ' +
        'data-word-id="' + w.id + '" ' +
        'data-arabic="' + w.arabic.replace(/\"/g, '&quot;') + '" ' +
        'tabindex="0" role="button" ' +
        'aria-label="' + w.arabic + ' — ' + (w.meaning || w.english || '') + ' — ' + colorClass + '" ' +
        'title="' + w.arabic + ' — ' + (w.english || '') + ' (' + colorClass + ')"' +
        '>' +
        w.arabic + '</span>';
      
      if (wi < group.words.length - 1) {
        html += ' ';
      }
    }
    html += '</div>'; // end ayah arabic
    
    // Translation (hidden by filter)
    if (group.ayahT && !_readerFilters.hideTranslation) {
      html += '<div class="reader-ayah-translation">' + group.ayahT + '</div>';
    }
    
    // Ayah root chips
    for (var ti = 0; ti < group.words.length; ti++) {
      var tw = group.words[ti];
      if (tw.root && tw.root !== '—') {
        html += '<div class="reader-ayah-roots">';
        html += '<span class="reader-ayah-root-chip">🌱 Root: ' + tw.root + ' (' + (tw.rootMeaning || '') + ')</span>';
        html += '</div>';
        break;
      }
    }
    
    html += '</div>'; // end ayah
  }
  
  container.innerHTML = html;
  
  // Wire word token clicks
  var tokens = container.querySelectorAll('.reader-word-token');
  for (var ti = 0; ti < tokens.length; ti++) {
    (function(el) {
      el.onclick = function() {
        var wordId = el.getAttribute('data-word-id');
        if (wordId) {
          var word = null;
          for (var wi = 0; wi < _readerSurahWords.length; wi++) {
            if (_readerSurahWords[wi].id === wordId) {
              word = _readerSurahWords[wi];
              break;
            }
          }
          if (word && typeof openExplorer === 'function') {
            openExplorer(word);
          }
        }
      };
      el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.onclick();
        }
      };
    })(tokens[ti]);
  }
  
  // Scroll to target verse if set
  if (_readerScrollVerse && document.getElementById('reader-ayah-' + _readerScrollVerse.replace(':', '-'))) {
    var target = document.getElementById('reader-ayah-' + _readerScrollVerse.replace(':', '-'));
    if (target) {
      setTimeout(function() {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    _readerScrollVerse = null;
  }
}

// ── Surah Comprehension Header ────────────────────────────────

function renderSurahComprehensionHeader() {
  var headerEl = document.getElementById('reader-surah-comp');
  if (!headerEl) return;
  
  if (!_readerSurahId || _readerVerseKeys.length === 0) {
    headerEl.innerHTML = '<div class=\"reader-comp-header-empty\">Select a surah to start reading</div>';
    return;
  }
  
  var comp = typeof getSurahComprehension === 'function' ? getSurahComprehension(_readerSurahId) : null;
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(_readerSurahId) : null;
  
  if (!comp) {
    headerEl.style.display = 'none';
    return;
  }
  
  headerEl.style.display = 'block';
  
  var knownPct = comp.totalWords > 0 ? Math.round((comp.masteredWords / comp.totalWords) * 100) : 0;
  var totalVerses = surahInfo ? surahInfo.verses : 0;
  var versesWithVocab = _readerVerseKeys.length;
  
  // Calculate review burden
  var overdueCount = 0;
  for (var i = 0; i < _readerSurahWords.length; i++) {
    var entry = _readerSRSData[_readerSurahWords[i].id];
    if (entry && entry.dueDate && Date.now() >= entry.dueDate) overdueCount++;
  }
  var readingReady = overdueCount === 0;
  
  // Word type mastery breakdown
  var catMastery = {};
  for (var wi = 0; wi < _readerSurahWords.length; wi++) {
    var w = _readerSurahWords[wi];
    var cat = w.typeCategory || 'other';
    if (!catMastery[cat]) catMastery[cat] = { total: 0, mastered: 0 };
    catMastery[cat].total++;
    if (_readerSRSData[w.id] && _readerSRSData[w.id].stage >= 2) catMastery[cat].mastered++;
  }
  
  // Reading journey
  var journey = _loadReaderJourney();
  var journeyEntry = journey.surahs && journey.surahs[_readerSurahId];
  
  var html = '';
  html += '<div class="reader-comp-header">';
  html += '<div class="reader-comp-header-top">';
  html += '<div class="reader-comp-large">' + comp.estimatedComprehension + '%</div>';
  html += '<div class="reader-comp-info">';
  html += '<div class="reader-comp-label">Occurrence-Weighted Comprehension</div>';
  html += '<div class="reader-comp-detail">' + comp.masteredWords + ' of ' + comp.totalWords + ' vocabulary words known</div>';
  if (journeyEntry) {
    html += '<div class="reader-comp-detail" style="margin-top:2px;color:var(--gold-dim)">📖 Read ' + (journeyEntry.readCount || 0) + ' time(s)</div>';
  }
  html += '</div>';
  html += '<div class="reader-readiness-badge ' + (readingReady ? 'reader-ready' : 'reader-not-ready') + '">';
  html += readingReady ? '✓ Ready to Read' : (overdueCount + ' overdue');
  html += '</div>';
  html += '</div>';
  
  // Progress bars for comprehension
  html += '<div class="reader-comp-breakdown">';
  var masteredColor = comp.estimatedComprehension >= 50 ? 'var(--gold)' : 'var(--green)';
  html += '<div class="reader-comp-row"><span class="reader-comp-row-label">Known</span><div class="reader-comp-row-track"><div class="reader-comp-row-fill" style="width:' + knownPct + '%;background:' + masteredColor + '"></div></div><span class="reader-comp-row-value">' + knownPct + '%</span></div>';
  
  var learningPct = comp.totalWords > 0 ? Math.round(((comp.totalWords - comp.masteredWords) / comp.totalWords) * 100) : 0;
  html += '<div class="reader-comp-row"><span class="reader-comp-row-label">Learning</span><div class="reader-comp-row-track"><div class="reader-comp-row-fill" style="width:' + learningPct + '%;background:var(--blue)"></div></div><span class="reader-comp-row-value">' + learningPct + '%</span></div>';
  
  var unknownPct = 0;
  html += '<div class="reader-comp-row"><span class="reader-comp-row-label">Unknown</span><div class="reader-comp-row-track"><div class="reader-comp-row-fill reader-comp-row-unknown" style="width:' + Math.max(1, 100 - knownPct - learningPct) + '%"></div></div><span class="reader-comp-row-value">' + Math.max(0, 100 - knownPct - learningPct) + '%</span></div>';
  html += '</div>';
  
  html += '<div class="reader-comp-meta">' + versesWithVocab + ' verses with vocabulary · ' + _readerSurahWords.length + ' vocabulary words';
  if (totalVerses > 0) html += ' · ' + Math.round((versesWithVocab / totalVerses) * 100) + '% of surah covered';
  html += '</div>';
  
  // Recommendation
  var recMsg = '';
  if (overdueCount > 5) recMsg = '🔁 ' + overdueCount + ' words need review before reading';
  else if (comp.estimatedComprehension < 30) recMsg = '📘 Study more vocabulary in this surah to improve comprehension';
  else if (comp.estimatedComprehension >= 70) recMsg = '🌟 You understand most of this surah! Consider testing with a quiz';
  else recMsg = '📖 Reading now will reinforce ' + (comp.totalWords - comp.masteredWords) + ' words you are learning';
  html += '<div class="reader-rec-message">' + recMsg + '</div>';
  
  // Word type mastery breakdown
  var catKeys = Object.keys(catMastery);
  if (catKeys.length > 0) {
    html += '<div class="reader-type-breakdown">';
    for (var ci = 0; ci < catKeys.length; ci++) {
      var cat = catKeys[ci];
      var data = catMastery[cat];
      var catPct = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0;
      html += '<div class="reader-type-row"><span class="reader-type-label">' + cat + '</span><div class="reader-type-track"><div class="reader-type-fill" style="width:' + catPct + '%"></div></div><span class="reader-type-value">' + data.mastered + '/' + data.total + '</span></div>';
    }
    html += '</div>';
  }
  
  html += '</div>';
  headerEl.innerHTML = html;
}

// ── Reading Insights Panel ────────────────────────────────────

function renderReadingInsightsPanel() {
  var container = document.getElementById('reader-insights');
  if (!container) return;
  if (!_readerSurahId || _readerVerseKeys.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  var insights = getSurahReadingInsights(_readerSurahId);
  if (!insights) {
    container.style.display = 'none';
    return;
  }
  
  var html = '<div class="reader-insights-panel">';
  html += '<div class="reader-insights-title">📊 Reading Insights</div>';
  
  html += '<div class="reader-insights-grid">';
  html += '<div class="reader-insight-stat"><span class="reader-insight-value">' + insights.newWordsEncountered + '</span><span class="reader-insight-label">New words</span></div>';
  html += '<div class="reader-insight-stat"><span class="reader-insight-value">' + insights.knownWordsReinforced + '</span><span class="reader-insight-label">Reinforced</span></div>';
  html += '<div class="reader-insight-stat"><span class="reader-insight-value">~' + insights.coverageGained + '%</span><span class="reader-insight-label">Coverage gain</span></div>';
  html += '</div>';
  
  // Top roots
  if (insights.mostRepeatedRoots && insights.mostRepeatedRoots.length > 0) {
    html += '<div class="reader-insights-roots">';
    html += '<div class="reader-insights-subtitle">Most frequent roots:</div><div class="reader-insights-root-list">';
    for (var ri = 0; ri < insights.mostRepeatedRoots.length; ri++) {
      var r = insights.mostRepeatedRoots[ri];
      html += '<span class="reader-insight-root-chip">' + r.root + ' (' + r.count + '×)</span>';
    }
    html += '</div></div>';
  }
  
  // Recommendation
  if (insights.recommendation) {
    html += '<div class="reader-insights-recommendation">' + insights.recommendation + '</div>';
  }
  
  html += '</div>';
  container.innerHTML = html;
}

// ── Render Reading Mode (called by switchView) ─────────────────

function renderReader() {
  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};
  
  renderSurahBrowser();
  
  if (!_readerSurahId) {
    var versesContainer = document.getElementById('reader-verses');
    if (versesContainer) {
      versesContainer.innerHTML = '<div class="reader-empty">' +
        '<div style="font-size: 42px; margin-bottom: 16px">📖</div>' +
        '<div style="font-size: 16px; font-weight: 500; color: var(--text); margin-bottom: 8px">Interactive Quran Reading</div>' +
        '<div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; max-width: 300px; margin: 0 auto">' +
        'Select a surah from the list to begin reading. Every word you have studied is color-coded.</div>' +
        '<div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px; flex-wrap: wrap">' +
        '<div class="reader-legend-item"><div class="reader-legend-swatch reader-token-mastered"></div>Mastered</div>' +
        '<div class="reader-legend-item"><div class="reader-legend-swatch reader-token-known"></div>Known</div>' +
        '<div class="reader-legend-item"><div class="reader-legend-swatch reader-token-learning"></div>Learning</div>' +
        '<div class="reader-legend-item"><div class="reader-legend-swatch reader-token-seen"></div>Seen</div>' +
        '<div class="reader-legend-item"><div class="reader-legend-swatch reader-token-unknown"></div>New</div>' +
        '</div></div>';
    }
    var headerEl = document.getElementById('reader-surah-comp');
    if (headerEl) headerEl.style.display = 'none';
    var surahNameEl = document.getElementById('reader-surah-title');
    if (surahNameEl) surahNameEl.textContent = 'Select a Surah';
    var insightsEl = document.getElementById('reader-insights');
    if (insightsEl) insightsEl.style.display = 'none';
  } else {
    openSurahForReading(_readerSurahId);
  }
}

// ── Reader Search / Jump to Verse ──────────────────────────────

function readerScrollToVerse(verseNum) {
  if (!_readerSurahId) return;
  var verseKey = _readerSurahId + ':' + verseNum;
  var closest = null;
  for (var vi = 0; vi < _readerVerseKeys.length; vi++) {
    var vk = _readerVerseKeys[vi];
    if (vk === verseKey) { closest = vk; break; }
    if (!closest) { closest = vk; continue; }
    var curParts = vk.split(':');
    var clsParts = closest.split(':');
    var targetParts = verseKey.split(':');
    var curNum = parseInt(curParts[1], 10) || 0;
    var clsNum = parseInt(clsParts[1], 10) || 0;
    var tgtNum = parseInt(targetParts[1], 10) || 0;
    if (Math.abs(curNum - tgtNum) < Math.abs(clsNum - tgtNum)) {
      closest = vk;
    }
  }
  if (closest) {
    _readerScrollVerse = closest;
    renderAyahs();
  }
}

// ── Reading Insights ──────────────────────────────────────────

function getSurahReadingInsights(surahId) {
  if (!surahId) return null;
  var words = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var insights = {
    newWordsEncountered: 0,
    knownWordsReinforced: 0,
    mostRepeatedRoots: [],
    grammarPatterns: [],
    recommendation: '',
    coverageGained: 0,
  };
  
  var rootCounts = {};
  var patternCounts = {};
  
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    var entry = srsData[w.id];
    
    if (!entry || entry.stage === 0) {
      insights.newWordsEncountered++;
    } else if (entry.ratedAt && (Date.now() - entry.ratedAt) < 7 * 24 * 60 * 60 * 1000) {
      insights.knownWordsReinforced++;
    }
    
    if (w.root && w.root !== '—') {
      rootCounts[w.root] = (rootCounts[w.root] || 0) + 1;
    }
    if (w.pattern && w.pattern !== '—') {
      patternCounts[w.pattern] = (patternCounts[w.pattern] || 0) + 1;
    }
  }
  
  // Top roots
  var sortedRoots = Object.keys(rootCounts).sort(function(a, b) { return rootCounts[b] - rootCounts[a]; });
  insights.mostRepeatedRoots = sortedRoots.slice(0, 5).map(function(r) {
    return { root: r, count: rootCounts[r], meaning: '' };
  });
  
  // Most common patterns
  var sortedPatterns = Object.keys(patternCounts).sort(function(a, b) { return patternCounts[b] - patternCounts[a]; });
  insights.grammarPatterns = sortedPatterns.slice(0, 5);
  
  // Coverage gain estimate
  var comp = typeof getSurahComprehension === 'function' ? getSurahComprehension(surahId) : null;
  if (comp && insights.newWordsEncountered > 0) {
    var potentialGain = Math.min(20, Math.round((insights.newWordsEncountered / comp.totalWords) * 15));
    insights.coverageGained = potentialGain;
  }
  
  // Recommendation
  if (sortedRoots.length > 0) {
    var topRoot = sortedRoots[0];
    var topRootMeaning = '';
    for (var fi = 0; fi < words.length; fi++) {
      if (words[fi].root === topRoot) { topRootMeaning = words[fi].rootMeaning || ''; break; }
    }
    var rootWords = rootCounts[topRoot];
    var pctGain = Math.min(10, Math.round((rootWords / words.length) * 10));
    insights.recommendation = '🌱 Mastering root ' + topRoot + ' (' + topRootMeaning + ') would increase your understanding of this surah by ~' + pctGain + '%.';
  } else {
    insights.recommendation = 'Continue regular reviews to strengthen your vocabulary retention.';
  }
  
  return insights;
}

// ── Reader Filters ─────────────────────────────────────────────

function toggleReaderFilter(filterName) {
  if (_readerFilters.hasOwnProperty(filterName)) {
    _readerFilters[filterName] = !_readerFilters[filterName];
    // Re-render current surah state
    if (_readerSurahId) {
      renderAyahs();
    }
    // Update filter button states
    updateReaderFilterUI();
  }
}

function updateReaderFilterUI() {
  var filterBtns = document.querySelectorAll('.reader-filter-btn');
  for (var fi = 0; fi < filterBtns.length; fi++) {
    var btn = filterBtns[fi];
    var filterName = btn.getAttribute('data-filter');
    if (filterName && _readerFilters[filterName]) {
      btn.classList.add('reader-filter-active');
    } else {
      btn.classList.remove('reader-filter-active');
    }
  }
  
  // Apply night mode to the reader main area
  var readerMain = document.querySelector('.reader-main');
  if (readerMain) {
    readerMain.classList.toggle('reader-night-mode', _readerFilters.nightMode);
  }
  
  // Apply focus mode to the reader main area
  if (readerMain) {
    readerMain.classList.toggle('reader-focus-mode', _readerFilters.focusMode);
  }
}

// ── Surah Search ───────────────────────────────────────────────

function wireSurahSearch() {
  var searchInput = document.getElementById('reader-search-input');
  if (searchInput) {
    searchInput.oninput = function() {
      renderSurahBrowser();
    };
  }
}

// ── Personal Reading Journey ──────────────────────────────────

function getReadingJourneySummary() {
  var journey = _loadReaderJourney();
  var surahKeys = journey.surahs ? Object.keys(journey.surahs) : [];
  var totalSurahsRead = surahKeys.length;
  var totalAyahs = journey.totalAyahsRead || 0;
  var totalOpenings = journey.openings || 0;
  
  // Calculate average comprehension of read surahs
  var compSum = 0;
  var compCount = 0;
  for (var si = 0; si < surahKeys.length; si++) {
    var sid = parseInt(surahKeys[si], 10);
    var comp = typeof getSurahComprehension === 'function' ? getSurahComprehension(sid) : null;
    if (comp) {
      compSum += comp.estimatedComprehension;
      compCount++;
    }
  }
  var avgComp = compCount > 0 ? Math.round(compSum / compCount) : 0;
  
  return {
    totalSurahsRead: totalSurahsRead,
    totalAyahs: totalAyahs,
    totalOpenings: totalOpenings,
    avgComprehension: avgComp,
  };
}

// ── Track Ayah Read ────────────────────────────────────────────

function trackAyahRead(verseKey) {
  if (!_readerSurahId || !verseKey) return;
  var journey = _loadReaderJourney();
  if (!journey.surahs) journey.surahs = {};
  if (!journey.surahs[_readerSurahId]) {
    journey.surahs[_readerSurahId] = { firstRead: Date.now(), readCount: 0, ayahsRead: 0 };
  }
  
  var ayahNum = parseInt(verseKey.split(':')[1], 10) || 0;
  journey.totalAyahsRead = (journey.totalAyahsRead || 0) + 1;
  journey.surahs[_readerSurahId].ayahsRead = (journey.surahs[_readerSurahId].ayahsRead || 0) + 1;
  journey.lastReadDate = Date.now();
  _saveReaderJourney(journey);
  
  // Update reading streak
  _updateReadingStreak();
}

function _updateReadingStreak() {
  var journey = _loadReaderJourney();
  if (!journey.lastReadDate) return;
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var lastDate = new Date(journey.lastReadDate);
  lastDate.setHours(0, 0, 0, 0);
  
  var diffDays = Math.round((today - lastDate) / (24 * 60 * 60 * 1000));
  
  if (diffDays === 0) {
    // Same day, keep streak
  } else if (diffDays === 1) {
    // Consecutive day
    journey.readingStreak = (journey.readingStreak || 0) + 1;
  } else {
    // Streak broken
    journey.readingStreak = 0;
  }
  
  journey.lastReadDate = Date.now();
  _saveReaderJourney(journey);
}

// ── Event Wiring ───────────────────────────────────────────────

function wireReaderEvents() {
  // Jump to verse input
  var jumpBtn = document.getElementById('reader-jump-btn');
  var jumpInput = document.getElementById('reader-jump-input');
  if (jumpBtn && jumpInput) {
    jumpBtn.onclick = function() {
      var val = parseInt(jumpInput.value, 10);
      if (val > 0) readerScrollToVerse(val);
    };
    jumpInput.onkeydown = function(e) {
      if (e.key === 'Enter') {
        var val = parseInt(jumpInput.value, 10);
        if (val > 0) readerScrollToVerse(val);
      }
    };
  }
  
  // Back to surah list button
  var backBtn = document.getElementById('reader-back-to-list');
  if (backBtn) {
    backBtn.onclick = function() {
      _readerSurahId = null;
      renderReader();
    };
  }
  
  // Surah search input
  wireSurahSearch();
  
  // Filter buttons
  var filterBtns = document.querySelectorAll('.reader-filter-btn');
  for (var fi = 0; fi < filterBtns.length; fi++) {
    (function(btn) {
      btn.onclick = function() {
        var filterName = btn.getAttribute('data-filter');
        if (filterName) toggleReaderFilter(filterName);
      };
    })(filterBtns[fi]);
  }
  
  // Track ayah reads — unobtrusively observe verses as they scroll into view
  _readerTrackedAyahs = {};
  var readerVersesContainer = document.getElementById('reader-verses');
  if (readerVersesContainer) {
    // Use a mutation observer to detect new ayah elements
    var renderObserver = new MutationObserver(function() {
      var ayahs = readerVersesContainer.querySelectorAll('[id^="reader-ayah-"]');
      for (var ai = 0; ai < ayahs.length; ai++) {
        var id = ayahs[ai].id;
        if (!_readerTrackedAyahs[id]) {
          _readerTrackedAyahs[id] = true;
          var verseKey = id.replace('reader-ayah-', '').replace('-', ':');
          trackAyahRead(verseKey);
        }
      }
    });
    renderObserver.observe(readerVersesContainer, { childList: true, subtree: true });
  }
}

// ── Export ──────────────────────────────────────────────────────

window.__reader = {
  openSurah: openSurahForReading,
  getInsights: getSurahReadingInsights,
  getJourneySummary: getReadingJourneySummary,
  setFilter: toggleReaderFilter,
};
