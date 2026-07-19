// ═══════════════════════════════════════════════════════════════════
// reader.js — Quran Reader (MVP)
//
// A minimal, stable Quran reading experience.
// Keeps: surah list, reading screen, vocabulary highlighting,
//         continue reading, word explorer integration.
// Removed: juz filter, search, comprehension header, insights,
//          reading filters, inline word sheet, journey tracking,
//          async data polling, progress bar, back-to-top FAB,
//          root chips, verse prev/next, surah prev/next.
// ═══════════════════════════════════════════════════════════════════

// ── Reading State ──────────────────────────────────────────────

let _readerSurahId = null;
let _readerSurahWords = [];
let _readerAyahGroups = {};
let _readerVerseKeys = [];
let _readerSRSData = {};
let _readerScrollVerse = null;

const READER_LAST_KEY = 'quran_reader_last';

// ── Arabic Normalization for Vocabulary Matching ───────────────

function _normArabicForMatch(text) {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652\u0670\u06E1]/g, '')
    .replace(/[\u0671\u0672\u0673]/g, '\u0627')
    .trim();
}

// ── Mastery Color Map ──────────────────────────────────────────
// Gold → mastered (stage >= 3), Green → known (stage >= 2),
// Blue → learning (stage >= 1), Gray → seen, Red → unknown

function _readerGetMasteryColor(wordId) {
  var entry = _readerSRSData[wordId];
  if (!entry) return 'unknown';
  if (entry.stage >= 3) return 'mastered';
  if (entry.stage >= 2) return 'known';
  if (entry.stage >= 1) return 'learning';
  return 'seen';
}

// ── Continue Reading (simple localStorage save/restore) ────────

function _loadLastPosition() {
  try {
    var raw = localStorage.getItem(READER_LAST_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function _saveLastPosition(surahId, verseKey) {
  try {
    localStorage.setItem(READER_LAST_KEY, JSON.stringify({
      surahId: surahId,
      verseKey: verseKey || null,
      date: Date.now(),
    }));
  } catch (e) { /* ignore */ }
}

function getLastReadPosition() {
  var pos = _loadLastPosition();
  if (!pos || !pos.surahId) return null;
  return pos;
}

function resumeReading() {
  var pos = getLastReadPosition();
  if (!pos) return;
  var quranIdxInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET)
    ? window.__QURAN_INDEX_GET(pos.surahId) : null;
  if (!quranIdxInfo) return;
  openSurahForReading(pos.surahId);
  if (pos.verseKey) {
    _readerScrollVerse = pos.verseKey;
    renderAyahs();
  }
}

// ── Verse Data Builder (Quran-first, vocabulary overlay) ───────

function _buildVerseData(surahId, quranSurah, vocabWords) {
  var ayahGroups = {};
  var verseKeys = [];
  var vocabByNorm = {};
  for (var i = 0; i < vocabWords.length; i++) {
    var norm = _normArabicForMatch(vocabWords[i].arabic);
    if (norm) vocabByNorm[norm] = vocabWords[i];
  }
  for (var vi = 0; vi < quranSurah.verses.length; vi++) {
    var verse = quranSurah.verses[vi];
    var verseKey = surahId + ':' + verse.id;
    var matchedWords = [];
    var tokens = verse.text.split(/\s+/);
    var seenWordIds = {};
    for (var ti = 0; ti < tokens.length; ti++) {
      var normToken = _normArabicForMatch(tokens[ti]);
      if (normToken && vocabByNorm[normToken]) {
        var matched = vocabByNorm[normToken];
        if (!seenWordIds[matched.id]) {
          matchedWords.push(matched);
          seenWordIds[matched.id] = true;
        }
      }
    }
    ayahGroups[verseKey] = {
      words: matchedWords,
      ayahA: verse.text,
      ayahT: verse.translation || '',
    };
    verseKeys.push(verseKey);
  }
  return { ayahGroups: ayahGroups, verseKeys: verseKeys };
}

// ── Vocab-Only Fallback ────────────────────────────────────────

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
              _readerAyahGroups[vk] = { words: [], ayahA: occ.ayahA || '', ayahT: occ.ayahT || '' };
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
    return (parseInt(a.split(':')[1], 10) || 0) - (parseInt(b.split(':')[1], 10) || 0);
  });
}

// ── Surah Browser ──────────────────────────────────────────────

function renderSurahBrowser() {
  var container = document.getElementById('reader-surah-list');
  if (!container) return;
  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};

  var surahIds = [];
  if (window.__QURAN_INDEX) {
    for (var qi = 0; qi < window.__QURAN_INDEX.length; qi++) {
      surahIds.push(window.__QURAN_INDEX[qi].id);
    }
  } else {
    surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  }

  if (surahIds.length === 0) {
    container.innerHTML = '<div class="reader-empty-sidebar">No surahs available.</div>';
    return;
  }

  var lastPos = getLastReadPosition();
  var html = '';

  // Continue Reading card
  if (lastPos) {
    var quranIdxInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET)
      ? window.__QURAN_INDEX_GET(lastPos.surahId) : null;
    var surahName = quranIdxInfo ? quranIdxInfo.name : 'Surah ' + lastPos.surahId;
    html += '<div class="reader-continue-card" id="reader-continue-btn" tabindex="0" role="button" aria-label="Continue reading ' + surahName + '">';
    html += '<div class="reader-continue-icon">📖</div>';
    html += '<div class="reader-continue-info">';
    html += '<div class="reader-continue-title">Continue Reading</div>';
    html += '<div class="reader-continue-sub">' + surahName + '</div>';
    html += '</div>';
    html += '<div class="reader-continue-arrow">→</div>';
    html += '</div>';
  }

  for (var si = 0; si < surahIds.length; si++) {
    var sid = surahIds[si];
    quranIdxInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET)
      ? window.__QURAN_INDEX_GET(sid) : null;
    if (!quranIdxInfo) continue;

    var isActive = _readerSurahId === sid;
    var activeClass = isActive ? ' reader-surah-active' : '';

    html += '<div class="reader-surah-item' + activeClass + '" data-surah-id="' + sid + '" tabindex="0" role="button">';
    html += '<span class="reader-surah-num">' + sid + '.</span>';
    html += '<span class="reader-surah-name">' + quranIdxInfo.name + '</span>';
    html += '<span class="reader-surah-english">' + quranIdxInfo.englishName + '</span>';
    html += '<span class="reader-surah-verses">' + quranIdxInfo.total_verses + ' verses</span>';
    html += '</div>';
  }

  container.innerHTML = html;

  // Wire Continue Reading
  var continueCard = document.getElementById('reader-continue-btn');
  if (continueCard) {
    continueCard.onclick = resumeReading;
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
  _readerSurahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];

  var quranData = window.__QURAN_TEXT ? window.__QURAN_TEXT[surahId] : null;

  if (quranData && quranData.verses && quranData.verses.length > 0) {
    var fullData = _buildVerseData(surahId, quranData, _readerSurahWords);
    _readerAyahGroups = fullData.ayahGroups;
    _readerVerseKeys = fullData.verseKeys;
  } else if (_readerSurahWords.length > 0) {
    _buildFromVocabOnly(surahId);
  } else {
    _readerAyahGroups = {};
    _readerVerseKeys = [];
  }

  // Save reading position
  _saveLastPosition(surahId, null);

  // Update surah title
  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET)
    ? window.__QURAN_INDEX_GET(surahId) : null;
  var surahNameEl = document.getElementById('reader-surah-title');
  if (surahNameEl) {
    surahNameEl.textContent = quranIndexInfo
      ? quranIndexInfo.name + ' — ' + quranIndexInfo.englishName
      : 'Surah ' + surahId;
  }

  // Show reading view, hide surah list
  var listEl = document.getElementById('reader-surah-list');
  var mainEl = document.getElementById('reader-main');
  if (listEl) listEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'block';

  renderAyahs();
  renderSurahBrowser(); // Update active state in list

  var versesContainer = document.getElementById('reader-verses');
  if (versesContainer) {
    versesContainer.scrollTop = 0;
    versesContainer.focus({ preventScroll: true });
  }
}

// ── Render Ayahs ───────────────────────────────────────────────

function renderAyahs() {
  var container = document.getElementById('reader-verses');
  if (!container) return;

  if (_readerVerseKeys.length === 0) {
    container.innerHTML = '<div class="reader-empty">' +
      '<div style="font-size: 32px; margin-bottom: 12px">📖</div>' +
      '<div>No verses available for this surah.</div>' +
      '</div>';
    return;
  }

  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET)
    ? window.__QURAN_INDEX_GET(_readerSurahId) : null;
  var totalVerses = quranIndexInfo ? quranIndexInfo.total_verses : 0;
  var html = '';

  for (var vi = 0; vi < _readerVerseKeys.length; vi++) {
    var verseKey = _readerVerseKeys[vi];
    var group = _readerAyahGroups[verseKey];
    if (!group) continue;

    var verseNum = parseInt(verseKey.split(':')[1], 10) || 0;

    html += '<div class="reader-ayah" id="reader-ayah-' + verseKey.replace(':', '-') + '">';
    html += '<div class="reader-ayah-header">';
    html += '<div class="reader-ayah-num">Verse ' + verseNum + (totalVerses > 0 ? ' of ' + totalVerses : '') + '</div>';
    html += '</div>';

    // Arabic verse (immutable Quran text with vocabulary highlighting)
    html += '<div class="reader-ayah-arabic" lang="ar" dir="rtl">';
    var verseTokens = group.ayahA.split(/\s+/);
    var vocabNormForVerse = {};
    for (var vtwi = 0; vtwi < group.words.length; vtwi++) {
      var vtn = _normArabicForMatch(group.words[vtwi].arabic);
      if (vtn) vocabNormForVerse[vtn] = group.words[vtwi];
    }
    var renderedWordIds = {};

    for (var vti = 0; vti < verseTokens.length; vti++) {
      var token = verseTokens[vti];
      if (!token) continue;
      var normToken = _normArabicForMatch(token);
      var matchedWord = normToken ? vocabNormForVerse[normToken] : null;
      var isDuplicate = matchedWord && renderedWordIds[matchedWord.id];

      if (matchedWord && !isDuplicate) {
        renderedWordIds[matchedWord.id] = true;
        var colorClass = _readerGetMasteryColor(matchedWord.id);
        var escapedArabic = matchedWord.arabic.replace(/"/g, '&quot;');
        html += '<span class="reader-word-token reader-token-' + colorClass + '" ' +
          'data-word-id="' + matchedWord.id + '" ' +
          'tabindex="0" role="button" ' +
          'aria-label="' + escapedArabic + ' — ' + (matchedWord.meaning || matchedWord.english || '') + '" ' +
          'title="' + escapedArabic + ' — ' + (matchedWord.english || '') + '">' +
          matchedWord.arabic + '</span>';
      } else {
        html += '<span class="reader-plain-arabic">' +
          token.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
      }
      if (vti < verseTokens.length - 1) html += ' ';
    }
    html += '</div>'; // end ayah arabic

    // Translation
    if (group.ayahT) {
      html += '<div class="reader-ayah-translation">' +
        group.ayahT.replace(/<[^>]+>/g, '') + '</div>';
    }

    html += '</div>'; // end ayah
  }

  container.innerHTML = html;

  // Wire word token clicks → open Explorer
  var tokens = container.querySelectorAll('.reader-word-token');
  for (var ti = 0; ti < tokens.length; ti++) {
    (function(el) {
      el.onclick = function() {
        var wordId = el.getAttribute('data-word-id');
        if (wordId && typeof openExplorer === 'function') {
          for (var wi = 0; wi < _readerSurahWords.length; wi++) {
            if (_readerSurahWords[wi].id === wordId) {
              openExplorer(_readerSurahWords[wi]);
              break;
            }
          }
        }
      };
      el.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.onclick(); }
      };
    })(tokens[ti]);
  }

  // Scroll to target verse
  if (_readerScrollVerse) {
    var targetId = 'reader-ayah-' + _readerScrollVerse.replace(':', '-');
    var target = document.getElementById(targetId);
    if (target) {
      setTimeout(function() { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    }
    _readerScrollVerse = null;
  }
}

// ── Reader Main Entry Point ────────────────────────────────────

function renderReader() {
  _readerSRSData = typeof loadSRS === 'function' ? loadSRS() : {};

  // Start loading Quran data (non-blocking)
  if (window.__quranLoader && typeof window.__quranLoader.load === 'function') {
    window.__quranLoader.load();
  }

  // Show surah list, hide reading view
  var listEl = document.getElementById('reader-surah-list');
  var mainEl = document.getElementById('reader-main');
  if (listEl) listEl.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';

  renderSurahBrowser();

  // Pre-populate verses container
  var versesContainer = document.getElementById('reader-verses');
  if (versesContainer && !_readerSurahId) {
    versesContainer.innerHTML = '<div class="reader-empty">' +
      '<div style="font-size: 42px; margin-bottom: 16px">📖</div>' +
      '<div style="font-size: 16px; font-weight: 500; color: var(--text); margin-bottom: 8px">Select a Surah</div>' +
      '<div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; max-width: 300px; margin: 0 auto">' +
      'Choose a surah from the list to begin reading. Words you have studied are highlighted.</div>' +
      '<div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px; flex-wrap: wrap">' +
      '<span class="reader-legend-item"><span class="reader-legend-swatch reader-token-mastered"></span>Mastered</span>' +
      '<span class="reader-legend-item"><span class="reader-legend-swatch reader-token-known"></span>Known</span>' +
      '<span class="reader-legend-item"><span class="reader-legend-swatch reader-token-learning"></span>Learning</span>' +
      '<span class="reader-legend-item"><span class="reader-legend-swatch reader-token-seen"></span>Seen</span>' +
      '<span class="reader-legend-item"><span class="reader-legend-swatch reader-token-unknown"></span>New</span>' +
      '</div></div>';
  } else if (_readerSurahId) {
    openSurahForReading(_readerSurahId);
  }
}

// ── Back to Surah List ─────────────────────────────────────────

function goBackToSurahList() {
  _readerSurahId = null;
  var listEl = document.getElementById('reader-surah-list');
  var mainEl = document.getElementById('reader-main');
  if (listEl) listEl.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';
  renderSurahBrowser();
}

// ── Event Wiring ───────────────────────────────────────────────

function wireReaderEvents() {
  var backBtn = document.getElementById('reader-back-to-list');
  if (backBtn) {
    backBtn.onclick = goBackToSurahList;
  }
}

// ── Reading Journey Summary (used by Profile page) ─────────────

function getReadingJourneySummary() {
  var pos = getLastReadPosition();
  if (!pos) return { totalSurahsRead: 0, totalAyahs: 0, totalOpenings: 0, avgComprehension: 0 };
  var journey = _loadLastPosition();
  return {
    totalSurahsRead: journey && journey.surahId ? 1 : 0,
    totalAyahs: 0,
    totalOpenings: 0,
    avgComprehension: 0,
  };
}
