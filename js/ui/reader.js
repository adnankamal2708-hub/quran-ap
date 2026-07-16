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
let _readerJuzFilter = 0;        // 0 = All, 1-30 = specific juz

let _readerFilters = {           // Active reader filters
  hideTranslation: false,
  showUnknownOnly: false,
  focusMode: false,
  nightMode: false,
};
let _readerTrackedAyahs = {};    // Set of tracked ayahs for deduplication

// ── Filter Persistence ────────────────────────────────────────
// Save/restore reader filter state across sessions

const _READER_FILTER_KEY = 'quran_reader_filters';

function _saveReaderFilters() {
  try { localStorage.setItem(_READER_FILTER_KEY, JSON.stringify(_readerFilters)); } catch (e) { /* ignore */ }
}

function _loadReaderFilters() {
  try {
    var raw = localStorage.getItem(_READER_FILTER_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    for (var key in saved) {
      if (saved.hasOwnProperty(key) && _readerFilters.hasOwnProperty(key)) {
        _readerFilters[key] = saved[key];
      }
    }
  } catch (e) { /* ignore */ }
}

// ── Vocabulary Data Readiness Check ───────────────────────────
// Prevents empty surah list if the Reader tab is opened before
// vocabulary data finishes loading (deduplicateVocabulary runs
// lazily on ~78K entries and can cause timing issues).

let _readerDataCheckTimer = null;  // Interval handle for data-ready polling
let _readerDataCheckAttempts = 0;  // Max 30 attempts (15 seconds at 500ms)
const _READER_MAX_DATA_WAIT_MS = 15000;

/**
 * Check if vocabulary data is fully loaded and ready for rendering.
 * Uses a cheap check (ALL_WORDS.length) instead of calling
 * getSurahsWithVocabulary() which iterates 78K+ entries.
 * The expensive call is deferred to renderSurahBrowser(), which
 * already handles the empty-list case gracefully.
 */
function _isVocabularyDataReady() {
  // ALL_WORDS is populated synchronously by the data bundle.
  // If it has entries, getSurahsWithVocabulary() (defined in the
  // same bundle) is guaranteed to be available and return data.
  if (typeof ALL_WORDS === 'undefined') return false;
  if (typeof getSurahsWithVocabulary !== 'function') return false;
  return ALL_WORDS.length > 0;
}

/**
 * Cancel any pending data-readiness poll.
 */
function _cancelDataCheck() {
  if (_readerDataCheckTimer) {
    clearInterval(_readerDataCheckTimer);
    _readerDataCheckTimer = null;
  }
  _readerDataCheckAttempts = 0;
}

// ── Reading Journey Storage Key ────────────────────────────────
const READER_JOURNEY_KEY = 'quran_reader_journey';

// ── Load/Save Reading Journey ──────────────────────────────────

function _loadReaderJourney() {
  try {
    var raw = localStorage.getItem(READER_JOURNEY_KEY);
    if (!raw) return { surahs: {}, totalAyahsRead: 0, readingStreak: 0, lastReadDate: null, openings: 0, lastReadSurah: null, lastReadVerseKey: null };
    return JSON.parse(raw);
  } catch (e) {
    return { surahs: {}, totalAyahsRead: 0, readingStreak: 0, lastReadDate: null, openings: 0, lastReadSurah: null, lastReadVerseKey: null };
  }
}

function _saveReaderJourney(data) {
  try {
    localStorage.setItem(READER_JOURNEY_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

// ── Last Read Position ──────────────────────────────────────────

function _saveLastReadPosition(surahId, verseKey, encounteredWordIds, sessionWordIds) {
  if (!surahId) return;
  var journey = _loadReaderJourney();
  journey.lastReadSurah = surahId;
  journey.lastReadVerseKey = verseKey || null;
  journey.lastReadDate = Date.now();
  // Store encountered word IDs for Smart Learning Engine post-reading recommendations
  if (encounteredWordIds && encounteredWordIds.length > 0) {
    journey.encounteredWordIds = encounteredWordIds;
  }
  if (sessionWordIds && sessionWordIds.length > 0) {
    journey.sessionWordIds = sessionWordIds;
  }
  // Ensure surah tracking exists
  if (!journey.surahs) journey.surahs = {};
  if (!journey.surahs[surahId]) {
    journey.surahs[surahId] = { firstRead: Date.now(), readCount: 0, ayahsRead: 0 };
  }
  _saveReaderJourney(journey);
}

function getLastReadPosition() {
  var journey = _loadReaderJourney();
  if (!journey.lastReadSurah) return null;
  return {
    surahId: journey.lastReadSurah,
    verseKey: journey.lastReadVerseKey || null,
    date: journey.lastReadDate,
  };
}

function resumeReading() {
  var pos = getLastReadPosition();
  if (!pos) return;
  // Check both vocabulary surah info AND Quran index
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(pos.surahId) : null;
  var quranIdxInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) ? window.__QURAN_INDEX_GET(pos.surahId) : null;
  if (!surahInfo && !quranIdxInfo) return;
  
  // Open the surah first
  openSurahForReading(pos.surahId);
  
  // If a specific verse key was saved, scroll to it
  if (pos.verseKey) {
    _readerScrollVerse = pos.verseKey;
    // Re-render ayahs with scroll target
    renderAyahs();
  }
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

// ── Arabic Normalization for Vocabulary Matching ───────────────
// Strips diacritics and normalizes alef variants so that
// Quran Uthmani text matches vocabulary entries.

function _normArabicForMatch(text) {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652\u0670\u06E1]/g, '')   // Remove diacritics
    .replace(/[\u0671\u0672\u0673]/g, '\u0627')     // Normalize alef variants → regular alef
    .trim();
}

// ── Quran-First Verse Builder ─────────────────────────────────
// Builds _readerAyahGroups from the Quran dataset for ALL verses,
// then overlays vocabulary word tokens on top.
// For verses without vocabulary, plain Arabic + translation is shown.

function _buildFullVerseData(surahId, quranSurah, vocabWords) {
  var ayahGroups = {};
  var verseKeys = [];

  // Build normalized vocabulary lookup (Arabic text → word)
  var vocabByNorm = {};
  var vocabById = {};
  for (var i = 0; i < vocabWords.length; i++) {
    var w = vocabWords[i];
    var norm = _normArabicForMatch(w.arabic);
    if (norm) vocabByNorm[norm] = w;
    vocabById[w.id] = w;
  }

  // Process every verse from the Quran dataset
  for (var vi = 0; vi < quranSurah.verses.length; vi++) {
    var verse = quranSurah.verses[vi];
    var verseKey = surahId + ':' + verse.id;
    var matchedWords = [];

    // Tokenize the Arabic text and match against vocabulary
    var tokens = verse.text.split(' ');
    var seenWordIds = {};
    for (var ti = 0; ti < tokens.length; ti++) {
      var normToken = _normArabicForMatch(tokens[ti]);
      if (normToken && vocabByNorm[normToken]) {
        var matched = vocabByNorm[normToken];
        // Avoid duplicate word entries in the same verse
        if (!seenWordIds[matched.id]) {
          matchedWords.push(matched);
          seenWordIds[matched.id] = true;
        }
      }
    }

    ayahGroups[verseKey] = {
      words: matchedWords,
      ayahA: verse.text,
      ayahT: verse.translation,
      totalTokens: tokens.length,
      matchedTokens: matchedWords.length,
    };
    verseKeys.push(verseKey);
  }

  return { ayahGroups: ayahGroups, verseKeys: verseKeys };
}

// ── Legacy Vocab-Only Fallback ─────────────────────────────────
// When Quran data is not yet loaded, fall back to the original
// vocabulary-first rendering using occurrence data.

function _buildFromVocabOnly(surahId) {
  _readerAyahGroups = {};
  _readerVerseKeys = [];

  for (var wi = 0; wi < _readerSurahWords.length; wi++) {
    var word = _readerSurahWords[wi];
    var processedKeys = {};
    if (word.occurrences && word.occurrences.length > 0) {
      for (var oi = 0; oi < word.occurrences.length; oi++) {
        var occ = word.occurrences[oi];
        if (!occ.surahId || occ.surahId === surahId) {
          var vk = occ.verseKey || (surahId + ':1');
          if (!processedKeys[vk]) {
            if (!_readerAyahGroups[vk]) {
              _readerAyahGroups[vk] = {
                words: [],
                ayahA: occ.ayahA || '',
                ayahT: occ.ayahT || '',
                totalTokens: 0,
                matchedTokens: 0,
              };
              _readerVerseKeys.push(vk);
            }
            _readerAyahGroups[vk].words.push(word);
            processedKeys[vk] = true;
          }
        }
      }
    }
  }

  _readerVerseKeys.sort(function(a, b) {
    var aParts = a.split(':');
    var bParts = b.split(':');
    return (parseInt(aParts[1], 10) || 0) - (parseInt(bParts[1], 10) || 0);
  });
}

// ── Async Quran Load Trigger ───────────────────────────────────
// After starting a surah with only vocabulary data, load the
// Quran surah data in the background and re-render when ready.

function _triggerQuranSurahLoad(surahId) {
  if (!window.__quranLoader || typeof window.__quranLoader.loadSurah !== 'function') return;
  window.__quranLoader.loadSurah(surahId).then(function (ok) {
    if (ok && _readerSurahId === surahId) {
      // Re-open the surah now that full Quran data is available
      openSurahForReading(surahId);
    }
  });
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

  var html = '';
  
  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};
  
  // Use Quran index for ALL surahs, not just vocabulary ones
  var surahIds = [];
  if (window.__QURAN_INDEX) {
    for (var qi = 0; qi < window.__QURAN_INDEX.length; qi++) {
      surahIds.push(window.__QURAN_INDEX[qi].id);
    }
  } else {
    surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  }
  var allSurahComp = typeof getAllSurahComprehension === 'function' ? getAllSurahComprehension() : [];
  var compMap = {};
  for (var ci = 0; ci < allSurahComp.length; ci++) {
    compMap[allSurahComp[ci].surahId] = allSurahComp[ci];
  }
  
  // Load reading journey
  var journey = _loadReaderJourney();

  // Continue Reading button (shown when a last read position exists)
  var lastReadPos = getLastReadPosition();
  if (lastReadPos) {
    var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(lastReadPos.surahId) : null;
    var surahName = surahInfo ? surahInfo.name : 'Surah ' + lastReadPos.surahId;
    var verseLabel = '';
    if (lastReadPos.verseKey) {
      var vNum = parseInt(lastReadPos.verseKey.split(':')[1], 10) || 0;
      verseLabel = ' · Verse ' + vNum;
    }
    var timeAgo = '';
    if (lastReadPos.date) {
      var hoursAgo = Math.round((Date.now() - lastReadPos.date) / (1000 * 60 * 60));
      if (hoursAgo < 1) timeAgo = ' just now';
      else if (hoursAgo < 24) timeAgo = ' ' + hoursAgo + 'h ago';
      else timeAgo = ' ' + Math.round(hoursAgo / 24) + 'd ago';
    }
    html += '<div class="reader-continue-card" id="reader-continue-btn" tabindex="0" role="button" aria-label="Continue reading ' + surahName + verseLabel + '">';
    html += '<div class="reader-continue-icon">📖</div>';
    html += '<div class="reader-continue-info">';
    html += '<div class="reader-continue-title">Continue Reading</div>';
    html += '<div class="reader-continue-sub">' + surahName + verseLabel + '<span class="reader-continue-time">' + timeAgo + '</span></div>';
    html += '</div>';
    html += '<div class="reader-continue-arrow">→</div>';
    html += '</div>';
  }

  // Juz filter
  if (_readerJuzFilter > 0 && typeof getSurahIdsForJuz === 'function') {
    var juzSurahIds = getSurahIdsForJuz(_readerJuzFilter);
    var juzSet = {};
    for (var jsi = 0; jsi < juzSurahIds.length; jsi++) {
      juzSet[juzSurahIds[jsi]] = true;
    }
    // Filter surahIds to only those in the selected juz
    var filtered = [];
    for (var fsi = 0; fsi < surahIds.length; fsi++) {
      if (juzSet[surahIds[fsi]]) {
        filtered.push(surahIds[fsi]);
      }
    }
    surahIds = filtered;
  }

  // Search filter
  var searchInput = document.getElementById('reader-search-input');
  var searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  // Juz comprehension summary (shown above surah list when juz filter is active)
  if (_readerJuzFilter > 0 && typeof getJuzComprehension === 'function') {
    var juzComp = getJuzComprehension(_readerJuzFilter, _readerSRSData);
    var juzInfo = typeof getJuzInfo === 'function' ? getJuzInfo(_readerJuzFilter) : null;
    if (juzComp && juzInfo) {
      var juzCompPct = juzComp.pct;
      var juzCompClass = 'reader-comp-green';
      if (juzCompPct >= 70) juzCompClass = 'reader-comp-gold';
      else if (juzCompPct >= 40) juzCompClass = 'reader-comp-green';
      else if (juzCompPct >= 20) juzCompClass = 'reader-comp-blue';
      else if (juzCompPct > 0) juzCompClass = 'reader-comp-gray';
      else juzCompClass = 'reader-comp-red';
      
      html += '<div class="reader-juz-summary">';
      html += '<div class="reader-juz-summary-top">';
      html += '<span class="reader-juz-summary-name">📖 Juz\' ' + _readerJuzFilter + ' — ' + juzInfo.english + '</span>';
      html += '<span class="reader-comp-pct ' + juzCompClass + '">' + juzCompPct + '%</span>';
      html += '</div>';
      html += '<div class="reader-surah-meta">' + juzComp.masteredWords + '/' + juzComp.totalWords + ' words · ' + surahIds.length + ' surahs</div>';
      html += '<div class="reader-comp-bar"><div class="reader-comp-fill ' + juzCompClass + '" style="width:' + juzCompPct + '%"></div></div>';
      html += '</div>';
    }
  }

  // Handle empty filtered state (only when search or juz filter returns nothing)
  if (surahIds.length === 0) {
    if (searchTerm) {
      html += '<div class="reader-empty-sidebar">No surahs match your search.</div>';
    } else {
      html += '<div class="reader-empty-sidebar">No surahs available. Try refreshing the page.</div>';
    }
    container.innerHTML = html;
    return;
  }

  for (var si = 0; si < surahIds.length; si++) {
    var sid = surahIds[si];
    // Use Quran index for surah names (covers ALL 114 surahs)
    var quranIdxInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) ? window.__QURAN_INDEX_GET(sid) : null;
    var info = typeof getSurahInfo === 'function' ? getSurahInfo(sid) : null;
    var surahName = quranIdxInfo ? quranIdxInfo.name : (info ? info.name : 'Surah ' + sid);
    var englishName = quranIdxInfo ? quranIdxInfo.englishName : (info ? info.english : '');
    var comp = compMap[sid] || null;
    var compPct = comp ? comp.estimatedComprehension : 0;
    var masteredInSurah = comp ? comp.masteredWords : 0;
    var totalInSurah = comp ? comp.totalWords : 0;
    var words = typeof getSurahWords === 'function' ? getSurahWords(sid) : [];
    
    // Search filter
    if (searchTerm) {
      var searchName = (surahName + ' ' + englishName + ' Surah ' + sid).toLowerCase();
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
    var compClass = 'reader-comp-red';
    if (compPct >= 70) compClass = 'reader-comp-gold';
    else if (compPct >= 40) compClass = 'reader-comp-green';
    else if (compPct >= 20) compClass = 'reader-comp-blue';
    else if (compPct > 0) compClass = 'reader-comp-gray';
    
    var isActive = _readerSurahId === sid;
    var activeClass = isActive ? ' reader-surah-active' : '';

    // Journey badges
    var journeyEntry = journey.surahs && journey.surahs[sid];
    var readBadge = journeyEntry ? ' ✓' : '';
    
    html += '<div class="reader-surah-item' + activeClass + '" data-surah-id="' + sid + '" tabindex="0" role="button" aria-label="' + surahName + ' — ' + compPct + '% comprehension">';
    html += '<div class="reader-surah-top">';
    html += '<span class="reader-surah-num">' + sid + '.</span>';
    html += '<span class="reader-surah-name">' + surahName + readBadge + '</span>';
    if (readingReady && compPct >= 50) html += '<span class="reader-ready-badge">✓</span>';
    html += '<span class="reader-comp-pct ' + compClass + '">' + compPct + '%</span>';
    html += '</div>';
    html += '<div class="reader-surah-meta">' + englishName + ' · ' + masteredInSurah + '/' + totalInSurah + ' words</div>';
    html += '<div class="reader-comp-bar"><div class="reader-comp-fill ' + compClass + '" style="width:' + compPct + '%"></div></div>';
    html += '</div>';
  }
  
  container.innerHTML = html;
  
  // Wire continue reading card
  var continueCard = document.getElementById('reader-continue-btn');
  if (continueCard) {
    continueCard.onclick = function() { resumeReading(); };
    continueCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resumeReading(); }
    };
  }

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

  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};
  _readerSurahId = surahId;
  
  // Get vocabulary words for the surah
  _readerSurahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];
  _readerWordData = {};
  for (var i = 0; i < _readerSurahWords.length; i++) {
    _readerWordData[_readerSurahWords[i].arabic] = _readerSurahWords[i];
  }
  
  // Try to get Quran verse data
  var quranData = window.__QURAN_TEXT ? window.__QURAN_TEXT[surahId] : null;
  
  if (quranData && quranData.verses && quranData.verses.length > 0) {
    // QURAN-FIRST: Build full verse list from Quran data + vocabulary overlay
    var fullData = _buildFullVerseData(surahId, quranData, _readerSurahWords);
    _readerAyahGroups = fullData.ayahGroups;
    _readerVerseKeys = fullData.verseKeys;
  } else if (_readerSurahWords.length > 0) {
    // FALLBACK: Build from vocabulary data only (Quran data not yet loaded)
    _buildFromVocabOnly(surahId);
    // Trigger async Quran load for later re-render
    _triggerQuranSurahLoad(surahId);
  } else {
    // No data at all — show empty state
    _readerAyahGroups = {};
    _readerVerseKeys = [];
  }
  
  // ── Track reading session ──
  var allWordIds = [];
  for (var wsi = 0; wsi < _readerSurahWords.length; wsi++) {
    allWordIds.push(_readerSurahWords[wsi].id);
  }
  _saveLastReadPosition(surahId, null, allWordIds, allWordIds);
  var journey = _loadReaderJourney();
  journey.openings = (journey.openings || 0) + 1;
  if (!journey.surahs) journey.surahs = {};
  if (!journey.surahs[surahId]) {
    journey.surahs[surahId] = { firstRead: Date.now(), readCount: 0, ayahsRead: 0 };
  }
  journey.surahs[surahId].readCount = (journey.surahs[surahId].readCount || 0) + 1;
  _saveReaderJourney(journey);
  
  // Update UI
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(surahId) : null;
  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) ? window.__QURAN_INDEX_GET(surahId) : null;
  var surahName = surahInfo ? surahInfo.name : (quranIndexInfo ? quranIndexInfo.name : 'Surah ' + surahId);
  var englishName = quranIndexInfo ? quranIndexInfo.englishName : (surahInfo ? surahInfo.english : '');
  var surahNameEl = document.getElementById('reader-surah-title');
  if (surahNameEl) {
    surahNameEl.textContent = surahName + (englishName ? ' — ' + englishName : '');
  }
  
  // Update the surah view
  renderSurahBrowser();
  renderAyahs();
  renderSurahComprehensionHeader();
  renderReadingInsightsPanel();
  _renderReadingProgress();
  _updateNavButtons();
  
  var versesContainer = document.getElementById('reader-verses');
  if (versesContainer) versesContainer.scrollTop = 0;
}

// ── Render Ayahs (Quran-First) ─────────────────────────────────

function renderAyahs() {
  var container = document.getElementById('reader-verses');
  if (!container) return;

  if (_readerVerseKeys.length === 0) {
    container.innerHTML = '<div class="reader-empty">' +
      '<div style="font-size: 32px; margin-bottom: 12px">📖</div>' +
      '<div>No verses available for this surah.</div>' +
      '<div style="font-size: 11px; color: var(--text-muted); margin-top: 8px">Quran data may still be loading. Try selecting the surah again.</div>' +
      '</div>';
    return;
  }

  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) ? window.__QURAN_INDEX_GET(_readerSurahId) : null;
  var totalVerses = quranIndexInfo ? quranIndexInfo.total_verses : 0;

  var html = '';

  for (var vi = 0; vi < _readerVerseKeys.length; vi++) {
    var verseKey = _readerVerseKeys[vi];
    var group = _readerAyahGroups[verseKey];
    if (!group) continue;

    var verseNum = parseInt(verseKey.split(':')[1], 10) || 0;

    // OCCURRENCE-WEIGHTED ayah comprehension (only for verses WITH vocabulary)
    var ayahComp = group.words.length > 0 ? _calcAyahComprehension(group.words) : null;
    var ayahCompPct = ayahComp ? ayahComp.pct : 0;
    var ayahCompColor = ayahCompPct >= 70 ? 'var(--gold)' : (ayahCompPct >= 40 ? 'var(--green)' : (ayahCompPct >= 20 ? 'var(--blue)' : 'var(--text-muted)'));

    // Skip if filter is "show unknown only" and ayah has vocabulary but no unknown words
    if (_readerFilters.showUnknownOnly && ayahComp && ayahComp.unknown === 0) continue;
    // If "show unknown only" and this verse has NO vocabulary at all, skip it
    if (_readerFilters.showUnknownOnly && (!ayahComp || group.words.length === 0)) continue;

    // Focus mode: dim the ayah
    var focusClass = _readerFilters.focusMode ? ' reader-ayah-focus' : '';

    html += '<div class="reader-ayah' + focusClass + '" id="reader-ayah-' + verseKey.replace(':', '-') + '">';

    // Verse header
    html += '<div class="reader-ayah-header">';
    html += '<div class="reader-ayah-num">Verse ' + verseNum + (totalVerses > 0 ? ' of ' + totalVerses : '') + '</div>';
    if (group.words.length > 0) {
      html += '<div class="reader-ayah-comp" style="color:' + ayahCompColor + '" title="Estimated comprehension: ' + ayahCompPct + '% (occurrence-weighted)">' + ayahCompPct + '% understood</div>';
    }
    if (group.words.length === 0) {
      html += '<div class="reader-ayah-comp" style="color:var(--text-muted)">no vocabulary</div>';
    }
    html += '</div>';

    // Arabic verse with tappable word tokens
    html += '<div class="reader-ayah-arabic" lang="ar" dir="rtl">';

    if (group.words.length > 0) {
      // Render vocabulary word tokens with color coding
      for (var wi = 0; wi < group.words.length; wi++) {
        var w = group.words[wi];
        var colorClass = _readerGetMasteryColor(w.id);
        var isLeech = _readerSRSData[w.id] && _readerSRSData[w.id].isLeech;

        // Skip mastered words in "show unknown only" mode
        if (_readerFilters.showUnknownOnly && (colorClass === 'mastered' || colorClass === 'known')) continue;

        var extraClass = isLeech ? ' reader-token-leech' : '';
        html += '<span class="reader-word-token reader-token-' + colorClass + extraClass + '" ' +
          'data-word-id="' + w.id + '" ' +
          'data-arabic="' + w.arabic.replace(/"/g, '&quot;') + '" ' +
          'tabindex="0" role="button" ' +
          'aria-label="' + w.arabic + ' — ' + (w.meaning || w.english || '') + ' — ' + colorClass + '" ' +
          'title="' + w.arabic + ' — ' + (w.english || '') + ' (' + colorClass + ')"' +
          '>' +
          w.arabic + '</span>';

        if (wi < group.words.length - 1) {
          html += ' ';
        }
      }
    } else {
      // No vocabulary for this verse — render plain Arabic text
      var escapedAyah = group.ayahA.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += '<span class="reader-plain-arabic">' + escapedAyah + '</span>';
    }
    html += '</div>'; // end ayah arabic

    // Translation (hidden by filter)
    if (group.ayahT && !_readerFilters.hideTranslation) {
      var cleanTranslation = group.ayahT.replace(/<[^>]+>/g, '');
      html += '<div class="reader-ayah-translation">' + cleanTranslation + '</div>';
    }

    // Root chip for first vocab word (only if vocab exists)
    if (group.words.length > 0) {
      for (var ti = 0; ti < group.words.length; ti++) {
        var tw = group.words[ti];
        if (tw.root && tw.root !== '—') {
          html += '<div class="reader-ayah-roots">';
          html += '<span class="reader-ayah-root-chip">🌱 Root: ' + tw.root + ' (' + (tw.rootMeaning || '') + ')</span>';
          html += '</div>';
          break;
        }
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
          if (word && typeof openWordSheet === 'function') {
            openWordSheet(word);
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
  if (_readerScrollVerse) {
    var targetId = 'reader-ayah-' + _readerScrollVerse.replace(':', '-');
    if (document.getElementById(targetId)) {
      var target = document.getElementById(targetId);
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
    headerEl.innerHTML = '<div class="reader-comp-header-empty">Select a surah to start reading</div>';
    return;
  }
  
  var comp = typeof getSurahComprehension === 'function' ? getSurahComprehension(_readerSurahId) : null;
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(_readerSurahId) : null;
  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) ? window.__QURAN_INDEX_GET(_readerSurahId) : null;
  
  if (!comp) {
    headerEl.innerHTML = '<div class="reader-comp-header-empty">Select a surah to start reading</div>';
    return;
  }
  
  headerEl.style.display = 'block';
  
  var surahName = quranIndexInfo ? quranIndexInfo.name : (surahInfo ? surahInfo.name : 'Surah ' + _readerSurahId);
  var englishName = quranIndexInfo ? quranIndexInfo.englishName : (surahInfo ? surahInfo.english : '');
  var totalVerses = quranIndexInfo ? quranIndexInfo.total_verses : (surahInfo ? surahInfo.verses : 0);
  var compPct = comp.estimatedComprehension || 0;
  
  var html = '';
  html += '<div class="reader-comp-header">';
  html += '<div class="reader-comp-surah-name">' + surahName + '</div>';
  if (englishName) {
    html += '<div class="reader-comp-surah-english">' + englishName + '</div>';
  }
  html += '<div class="reader-comp-verse-count">' + totalVerses + ' verses</div>';
  html += '<div class="reader-comp-ring-wrap">';
  html += '<div class="reader-comp-ring" style="background: conic-gradient(var(--gold) 0% ' + compPct + '%, var(--border) ' + compPct + '% 100%)">';
  html += '<div class="reader-comp-ring-inner">';
  html += '<span class="reader-comp-ring-text">' + compPct + '%</span>';
  html += '</div></div></div>';
  html += '<div class="reader-comp-sub">' + comp.masteredWords + ' of ' + comp.totalWords + ' words learned</div>';
  html += '</div>';
  headerEl.innerHTML = html;
  
  // Trigger subtle fade-in animation on each surah switch
  headerEl.classList.remove('reader-comp-animate');
  void headerEl.offsetWidth; // Force reflow to replay animation
  headerEl.classList.add('reader-comp-animate');
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
  
  // Restore saved filter state from previous session
  _loadReaderFilters();
  
  // Cancel any previous polling to prevent duplicate checks
  _cancelDataCheck();
  
  // Check if vocabulary data is ready before rendering
  if (!_isVocabularyDataReady()) {
    // Show a loading placeholder while data initializes
    var container = document.getElementById('reader-surah-list');
    if (container) {
      container.innerHTML = '<div class="reader-loading">' +
        '<div style="text-align:center;padding:32px 16px;color:var(--text-muted)">' +
        '<div style="font-size:32px;margin-bottom:12px">📖</div>' +
        '<div style="font-size:13px;margin-bottom:8px">Loading surahs...</div>' +
        '<div style="font-size:10px;color:var(--text-muted)">Vocabulary data is being prepared</div>' +
        '</div></div>';
    }
    
    var versesContainer = document.getElementById('reader-verses');
    if (versesContainer) {
      versesContainer.innerHTML = '';
    }
    
    var insightsEl = document.getElementById('reader-insights');
    if (insightsEl) insightsEl.style.display = 'none';
    
    var headerEl = document.getElementById('reader-surah-comp');
    if (headerEl) headerEl.style.display = 'none';
    
    var surahNameEl = document.getElementById('reader-surah-title');
    if (surahNameEl) surahNameEl.textContent = 'Select a Surah';
    
    // Poll for data readiness (every 500ms, up to 15 seconds max)
    _readerDataCheckAttempts = 0;
    _readerDataCheckTimer = setInterval(function() {
      _readerDataCheckAttempts++;
      if (_isVocabularyDataReady()) {
        _cancelDataCheck();
        // Data is now ready — re-render the full reader
        renderReader();
      } else if (_readerDataCheckAttempts * 500 >= _READER_MAX_DATA_WAIT_MS) {
        // Timed out — show a fallback message
        _cancelDataCheck();
        var container = document.getElementById('reader-surah-list');
        if (container) {
          container.innerHTML = '<div class="reader-empty-sidebar">Unable to load vocabulary data. Try refreshing the page.</div>';
        }
      }
    }, 500);
    
    return;
  }
  
  // Start loading Quran text data (cached, non-blocking)
  if (window.__quranLoader && typeof window.__quranLoader.load === 'function') {
    window.__quranLoader.load();
  }

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
    
    // Auto-restore: if there is a saved reading position, open the last surah
    var lastPos = getLastReadPosition();
    if (lastPos && lastPos.surahId) {
      openSurahForReading(lastPos.surahId);
    }
  } else {
    openSurahForReading(_readerSurahId);
  }
  
  // Apply restored filter state to the UI after rendering
  updateReaderFilterUI();
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
    // Persist filter state
    _saveReaderFilters();
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
  
  // Save last read position with specific verse
  _saveLastReadPosition(_readerSurahId, verseKey);
  
  var journey = _loadReaderJourney();
  if (!journey.surahs) journey.surahs = {};
  if (!journey.surahs[_readerSurahId]) {
    journey.surahs[_readerSurahId] = { firstRead: Date.now(), readCount: 0, ayahsRead: 0 };
  }
  
  var ayahNum = parseInt(verseKey.split(':')[1], 10) || 0;
  journey.totalAyahsRead = (journey.totalAyahsRead || 0) + 1;
  journey.surahs[_readerSurahId].ayahsRead = (journey.surahs[_readerSurahId].ayahsRead || 0) + 1;
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

// ── Reader Navigation ─────────────────────────────────────────

function _getSurahIds() {
  if (window.__QURAN_INDEX) {
    return window.__QURAN_INDEX.map(function(s) { return s.id; });
  }
  return typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
}

function _getSurahIndex(surahId) {
  var ids = _getSurahIds();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i] === surahId) return i;
  }
  return -1;
}

function goToNextSurah() {
  if (!_readerSurahId) return;
  var idx = _getSurahIndex(_readerSurahId);
  var ids = _getSurahIds();
  if (idx >= 0 && idx < ids.length - 1) {
    openSurahForReading(ids[idx + 1]);
  }
}

function goToPrevSurah() {
  if (!_readerSurahId) return;
  var idx = _getSurahIndex(_readerSurahId);
  var ids = _getSurahIds();
  if (idx > 0) {
    openSurahForReading(ids[idx - 1]);
  }
}

function goToNextVerse() {
  if (!_readerSurahId || _readerVerseKeys.length === 0) return;
  var currentVerseKey = _readerScrollVerse || _readerVerseKeys[0];
  var currentIdx = _readerVerseKeys.indexOf(currentVerseKey);
  if (currentIdx < _readerVerseKeys.length - 1) {
    _readerScrollVerse = _readerVerseKeys[currentIdx + 1];
    renderAyahs();
    _renderReadingProgress();
  }
}

function goToPrevVerse() {
  if (!_readerSurahId || _readerVerseKeys.length === 0) return;
  var currentVerseKey = _readerScrollVerse || _readerVerseKeys[0];
  var currentIdx = _readerVerseKeys.indexOf(currentVerseKey);
  if (currentIdx > 0) {
    _readerScrollVerse = _readerVerseKeys[currentIdx - 1];
    renderAyahs();
    _renderReadingProgress();
  }
}

function readerScrollToTop() {
  var container = document.getElementById('reader-verses');
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Update Navigation Buttons ─────────────────────────────────

function _updateNavButtons() {
  if (!_readerSurahId) return;
  var ids = _getSurahIds();
  var idx = _getSurahIndex(_readerSurahId);
  
  var prevBtn = document.getElementById('reader-prev-surah');
  var nextBtn = document.getElementById('reader-next-surah');
  if (prevBtn) prevBtn.style.opacity = idx > 0 ? '1' : '0.3';
  if (nextBtn) nextBtn.style.opacity = idx < ids.length - 1 ? '1' : '0.3';
  
  var prevVerseBtn = document.getElementById('reader-prev-verse');
  var nextVerseBtn = document.getElementById('reader-next-verse');
  if (prevVerseBtn) prevVerseBtn.style.opacity = _readerVerseKeys.length > 0 ? '1' : '0.3';
  if (nextVerseBtn) nextVerseBtn.style.opacity = _readerVerseKeys.length > 0 ? '1' : '0.3';
}

// ── Reading Progress ───────────────────────────────────────────

function _renderReadingProgress() {
  var progressFill = document.getElementById('reader-progress-fill');
  var progressText = document.getElementById('reader-verse-progress');
  if (!progressFill) return;
  
  if (!_readerSurahId || _readerVerseKeys.length === 0) {
    progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '';
    return;
  }
  
  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) ? window.__QURAN_INDEX_GET(_readerSurahId) : null;
  var totalVerses = quranIndexInfo ? quranIndexInfo.total_verses : _readerVerseKeys.length;
  var currentVerseKey = _readerScrollVerse || _readerVerseKeys[0];
  var currentIdx = _readerVerseKeys.indexOf(currentVerseKey);
  if (currentIdx < 0) currentIdx = 0;
  
  var progressPct = totalVerses > 0 ? Math.round(((currentIdx + 1) / totalVerses) * 100) : 0;
  progressFill.style.width = Math.min(100, progressPct) + '%';
  
  if (progressText) {
    progressText.textContent = 'Verse ' + (currentIdx + 1) + ' of ' + totalVerses;
  }
  
  var remainingEl = document.getElementById('reader-remaining-verses');
  if (remainingEl) {
    var remaining = totalVerses - (currentIdx + 1);
    remainingEl.textContent = remaining > 0 ? remaining + ' remaining' : '';
  }
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
  
  // Juz filter select
  var juzSelect = document.getElementById('reader-juz-select');
  if (juzSelect) {
    juzSelect.onchange = function() {
      _readerJuzFilter = parseInt(juzSelect.value, 10) || 0;
      renderSurahBrowser();
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
  
  // Surah navigation
  var prevSurahBtn = document.getElementById('reader-prev-surah');
  var nextSurahBtn = document.getElementById('reader-next-surah');
  if (prevSurahBtn) prevSurahBtn.onclick = goToPrevSurah;
  if (nextSurahBtn) nextSurahBtn.onclick = goToNextSurah;
  
  // Verse navigation
  var prevVerseBtn = document.getElementById('reader-prev-verse');
  var nextVerseBtn = document.getElementById('reader-next-verse');
  if (prevVerseBtn) prevVerseBtn.onclick = goToPrevVerse;
  if (nextVerseBtn) nextVerseBtn.onclick = goToNextVerse;
  
  // Back to top
  var backToTopBtn = document.getElementById('reader-back-to-top');
  if (backToTopBtn) {
    backToTopBtn.onclick = readerScrollToTop;
    // Show/hide based on scroll position
    var versesContainer = document.getElementById('reader-verses');
    if (versesContainer) {
      versesContainer.addEventListener('scroll', function() {
        var show = versesContainer.scrollTop > 300;
        backToTopBtn.classList.toggle('reader-float-visible', show);
      });
    }
  }
  
  // Update navigation button states
  _updateNavButtons();
  
  // Track ayah reads — unobtrusively observe verses as they scroll into view
  _readerTrackedAyahs = {};
  // Disconnect previous observer to prevent memory leaks on repeated reader visits
  if (window.__readerObserver) {
    window.__readerObserver.disconnect();
    window.__readerObserver = null;
  }
  var readerVersesContainer = document.getElementById('reader-verses');
  if (readerVersesContainer) {
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
    window.__readerObserver = renderObserver;
  }
}

// ── Export ──────────────────────────────────────────────────────

window.__reader = {
  openSurah: openSurahForReading,
  getInsights: getSurahReadingInsights,
  getJourneySummary: getReadingJourneySummary,
  setFilter: toggleReaderFilter,
  resumeReading: resumeReading,
  getLastReadPosition: getLastReadPosition,
  getJourney: _loadReaderJourney,
  getEncounteredWordIds: function() {
    var journey = _loadReaderJourney();
    return journey.encounteredWordIds || [];
  },
};
