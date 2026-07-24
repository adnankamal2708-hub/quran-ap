// ═══════════════════════════════════════════════════════════════════
// quran.js — Quran view (MVP)
//
// A minimal, stable Quran reading experience.
// Keeps: surah list, reading screen, vocabulary highlighting,
//         continue reading, word explorer integration.
// ═══════════════════════════════════════════════════════════════════

// ── Reading State ──────────────────────────────────────────────

let _quranSurahId = null;
let _quranSurahWords = [];
let _quranAyahGroups = {};
let _quranVerseKeys = [];
let _quranSRSData = {};
let _quranScrollVerse = null;

const QURAN_LAST_KEY = 'quran_quran_last';

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

function _quranGetMasteryColor(wordId) {
  var entry = _quranSRSData[wordId];
  if (!entry) return 'unknown';
  if (entry.stage >= 3) return 'mastered';
  if (entry.stage >= 2) return 'known';
  if (entry.stage >= 1) return 'learning';
  return 'seen';
}

// ── Surah Info Helper (fallback when __QURAN_INDEX hasn't loaded) ──

function _getSurahInfo(sid) {
  if (window.__QURAN_INDEX && window.__QURAN_INDEX_GET) {
    return window.__QURAN_INDEX_GET(sid);
  }
  // Fallback: use SURAH_INFO from data bundle when index hasn't loaded yet
  if (typeof SURAH_INFO !== 'undefined' && SURAH_INFO[sid]) {
    var si = SURAH_INFO[sid];
    return {
      name: si.name,
      englishName: si.english,
      total_verses: si.verses
    };
  }
  // Secondary fallback: use getSurahInfo if available
  if (typeof getSurahInfo === 'function') {
    var si = getSurahInfo(sid);
    if (si) {
      return {
        name: si.name,
        englishName: si.english,
        total_verses: si.verses
      };
    }
  }
  return null;
}

// ── Continue Reading (simple localStorage save/restore) ────────

function _loadLastPosition() {
  try {
    var raw = localStorage.getItem(QURAN_LAST_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function _saveLastPosition(surahId, verseKey) {
  try {
    localStorage.setItem(QURAN_LAST_KEY, JSON.stringify({
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
    _quranScrollVerse = pos.verseKey;
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
  _quranAyahGroups = {};
  _quranVerseKeys = [];
  for (var wi = 0; wi < _quranSurahWords.length; wi++) {
    var word = _quranSurahWords[wi];
    var processedKeys = {};
    if (word.occurrences && word.occurrences.length > 0) {
      for (var oi = 0; oi < word.occurrences.length; oi++) {
        var occ = word.occurrences[oi];
        if (!occ.surahId || occ.surahId === surahId) {
          var vk = occ.verseKey || (surahId + ':1');
          if (!processedKeys[vk]) {
            if (!_quranAyahGroups[vk]) {
              // Strip HTML from ayahA — renderAyahs() splits by whitespace
              // and expects plain Arabic text, not HTML from word data files
              var plainAyah = occ.ayahA ? occ.ayahA.replace(/<[^>]+>/g, '') : '';
              _quranAyahGroups[vk] = { words: [], ayahA: plainAyah, ayahT: occ.ayahT || '' };
              _quranVerseKeys.push(vk);
            }
            _quranAyahGroups[vk].words.push(word);
            processedKeys[vk] = true;
          }
        }
      }
    }
  }
  _quranVerseKeys.sort(function(a, b) {
    return (parseInt(a.split(':')[1], 10) || 0) - (parseInt(b.split(':')[1], 10) || 0);
  });
}

// ── Surah Browser ──────────────────────────────────────────────

function renderSurahBrowser() {
  var container = document.getElementById('quran-surah-list');
  if (!container) return;
  _quranSRSData = typeof loadSRS === 'function' ? loadSRS() : {};

  var surahIds = [];
  if (window.__QURAN_INDEX) {
    for (var qi = 0; qi < window.__QURAN_INDEX.length; qi++) {
      surahIds.push(window.__QURAN_INDEX[qi].id);
    }
  } else {
    surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  }

  if (surahIds.length === 0) {
    container.innerHTML = '<div class="quran-empty-sidebar">No surahs available.</div>';
    return;
  }

  var lastPos = getLastReadPosition();
  var html = '';

  // Continue Reading card
  if (lastPos) {
    var quranIdxInfo = _getSurahInfo(lastPos.surahId);
    var surahName = quranIdxInfo ? quranIdxInfo.name : 'Surah ' + lastPos.surahId;
    html += '<div class="quran-continue-card" id="quran-continue-btn" tabindex="0" role="button" aria-label="Continue reading ' + surahName + '">';
    html += '<div class="quran-continue-icon">📖</div>';
    html += '<div class="quran-continue-info">';
    html += '<div class="quran-continue-title">Continue Reading</div>';
    html += '<div class="quran-continue-sub">' + surahName + '</div>';
    html += '</div>';
    html += '<div class="quran-continue-arrow">→</div>';
    html += '</div>';
  }

  for (var si = 0; si < surahIds.length; si++) {
    var sid = surahIds[si];
    quranIdxInfo = _getSurahInfo(sid);
    if (!quranIdxInfo) continue;

    var isActive = _quranSurahId === sid;
    var activeClass = isActive ? ' quran-surah-active' : '';

    html += '<div class="quran-surah-item' + activeClass + '" data-surah-id="' + sid + '" tabindex="0" role="button">';
    html += '<span class="quran-surah-num">' + sid + '.</span>';
    html += '<span class="quran-surah-name">' + quranIdxInfo.name + '</span>';
    html += '<span class="quran-surah-english">' + quranIdxInfo.englishName + '</span>';
    html += '<span class="quran-surah-verses">' + quranIdxInfo.total_verses + ' verses</span>';
    html += '</div>';
  }

  container.innerHTML = html;

  // Wire Continue Reading
  var continueCard = document.getElementById('quran-continue-btn');
  if (continueCard) {
    continueCard.onclick = resumeReading;
    continueCard.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resumeReading(); }
    };
  }

  // Wire surah clicks
  var items = container.querySelectorAll('.quran-surah-item');
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

  _quranSRSData = typeof loadSRS === 'function' ? loadSRS() : {};
  _quranSurahId = surahId;
  _quranSurahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];

  // Update surah title immediately
  var quranIndexInfo = _getSurahInfo(surahId);
  var surahNameEl = document.getElementById('quran-surah-title');
  if (surahNameEl) {
    surahNameEl.textContent = quranIndexInfo
      ? quranIndexInfo.name + ' — ' + quranIndexInfo.englishName
      : 'Surah ' + surahId;
  }

  // Show reading view, hide surah list
  var listEl = document.getElementById('quran-surah-list');
  var mainEl = document.getElementById('quran-main');
  if (listEl) listEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'block';

  // Check if per-surah verse data is already available
  var quranData = window.__QURAN_TEXT ? window.__QURAN_TEXT[surahId] : null;
  var dataReady = quranData && quranData.verses && quranData.verses.length > 0;

  if (dataReady) {
    // Full Quran data available — build verses from it
    var fullData = _buildVerseData(surahId, quranData, _quranSurahWords);
    _quranAyahGroups = fullData.ayahGroups;
    _quranVerseKeys = fullData.verseKeys;
  } else if (_quranSurahWords.length > 0) {
    // No Quran data yet — show vocab-only fallback while loading
    _buildFromVocabOnly(surahId);

    // Trigger async load of per-surah verse data
    if (window.__quranLoader && typeof window.__quranLoader.loadSurah === 'function') {
      window.__quranLoader.loadSurah(surahId).then(function (loaded) {
        // Only re-render if user is still on the same surah
        if (!loaded || _quranSurahId !== surahId) return;
        var newData = window.__QURAN_TEXT ? window.__QURAN_TEXT[surahId] : null;
        if (newData && newData.verses && newData.verses.length > 0) {
          var fullData2 = _buildVerseData(surahId, newData, _quranSurahWords);
          _quranAyahGroups = fullData2.ayahGroups;
          _quranVerseKeys = fullData2.verseKeys;
          renderAyahs();
          renderSurahBrowser();
        }
      });
    }
  } else {
    _quranAyahGroups = {};
    _quranVerseKeys = [];
  }

  // Save reading position
  _saveLastPosition(surahId, null);

  renderAyahs();
  renderSurahBrowser(); // Update active state in list

  var versesContainer = document.getElementById('quran-verses');
  if (versesContainer) {
    versesContainer.scrollTop = 0;
    versesContainer.focus({ preventScroll: true });
  }
}

// ── Render Ayahs ───────────────────────────────────────────────

function renderAyahs() {
  var container = document.getElementById('quran-verses');
  if (!container) return;

  if (_quranVerseKeys.length === 0) {
    container.innerHTML = '<div class="quran-empty">' +
      '<div style="font-size: 32px; margin-bottom: 12px">📖</div>' +
      '<div>No verses available for this surah.</div>' +
      '</div>';
    return;
  }

  var quranIndexInfo = (window.__QURAN_INDEX && window.__QURAN_INDEX_GET)
    ? window.__QURAN_INDEX_GET(_quranSurahId) : null;
  var totalVerses = quranIndexInfo ? quranIndexInfo.total_verses : 0;
  var html = '';

  for (var vi = 0; vi < _quranVerseKeys.length; vi++) {
    var verseKey = _quranVerseKeys[vi];
    var group = _quranAyahGroups[verseKey];
    if (!group) continue;

    var verseNum = parseInt(verseKey.split(':')[1], 10) || 0;

    html += '<div class="quran-ayah" id="quran-ayah-' + verseKey.replace(':', '-') + '">';
    html += '<div class="quran-ayah-header">';
    html += '<div class="quran-ayah-num">Verse ' + verseNum + (totalVerses > 0 ? ' of ' + totalVerses : '') + '</div>';
    html += '</div>';

    // Arabic verse (immutable Quran text with vocabulary highlighting)
    html += '<div class="quran-ayah-arabic" lang="ar" dir="rtl">';
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
        var colorClass = _quranGetMasteryColor(matchedWord.id);
        var escapedArabic = matchedWord.arabic.replace(/"/g, '&quot;');
        html += '<span class="quran-word-token quran-token-' + colorClass + '" ' +
          'data-word-id="' + matchedWord.id + '" ' +
          'tabindex="0" role="button" ' +
          'aria-label="' + escapedArabic + ' — ' + (matchedWord.meaning || matchedWord.english || '') + '" ' +
          'title="' + escapedArabic + ' — ' + (matchedWord.english || '') + '">' +
          matchedWord.arabic + '</span>';
      } else {
        html += '<span class="quran-plain-arabic">' +
          token.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
      }
      if (vti < verseTokens.length - 1) html += ' ';
    }
    html += '</div>'; // end ayah arabic

    // Translation
    if (group.ayahT) {
      html += '<div class="quran-ayah-translation">' +
        group.ayahT.replace(/<[^>]+>/g, '') + '</div>';
    }

    html += '</div>'; // end ayah
  }

  container.innerHTML = html;

  // Wire word token clicks → open Explorer
  var tokens = container.querySelectorAll('.quran-word-token');
  for (var ti = 0; ti < tokens.length; ti++) {
    (function(el) {
      el.onclick = function() {
        var wordId = el.getAttribute('data-word-id');
        if (wordId && typeof openExplorer === 'function') {
          for (var wi = 0; wi < _quranSurahWords.length; wi++) {
            if (_quranSurahWords[wi].id === wordId) {
              openExplorer(_quranSurahWords[wi]);
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
  if (_quranScrollVerse) {
    var targetId = 'quran-ayah-' + _quranScrollVerse.replace(':', '-');
    var target = document.getElementById(targetId);
    if (target) {
      setTimeout(function() { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    }
    _quranScrollVerse = null;
  }
}

// ── Reader Main Entry Point ────────────────────────────────────

function renderQuran() {
  _quranSRSData = typeof loadSRS === 'function' ? loadSRS() : {};

  // Show surah list, hide reading view
  var listEl = document.getElementById('quran-surah-list');
  var mainEl = document.getElementById('quran-main');
  if (listEl) listEl.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';

  // Render surah list immediately (uses SURAH_INFO fallback if index not loaded)
  renderSurahBrowser();

  // Start loading Quran index (async) — re-render when loaded
  if (window.__quranLoader && typeof window.__quranLoader.load === 'function') {
    window.__quranLoader.load().then(function(ok) {
      if (ok && window.__QURAN_INDEX) {
        // Re-render with proper surah names from index
        renderSurahBrowser();
      }
    });
  }

  // Pre-populate verses container with vocabulary stats encouragement (Part 3)
  var versesContainer = document.getElementById('quran-verses');
  if (versesContainer && !_quranSurahId) {
    var $vocabStats = typeof getSRSStats === 'function' ? getSRSStats() : {};
    var $masteredCount2 = $vocabStats.mature || 0;
    var $coverageQuran = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
    var $compPctQuran = $coverageQuran ? $coverageQuran.estimatedComprehension : 0;
    var $encouragementCard = '';
    if ($masteredCount2 > 0) {
      $encouragementCard = '<div class="quran-encourage-card" id="quran-encourage-card" style="margin-bottom:14px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;font-size:12px;color:var(--text-muted);line-height:1.5;display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:18px">📚</span>' +
        '<span style="flex:1">You have mastered <strong style="color:var(--gold)">' + $masteredCount2 + ' words</strong> — look for highlighted vocabulary while reading.' +
        ($compPctQuran > 0 ? ' Your estimated comprehension is <strong style="color:var(--gold)">' + $compPctQuran + '%</strong>.' : '') +
        '</span>' +
        '<button class="quran-encourage-dismiss" onclick="var p=this.parentNode;p.style.display=\'none\'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:4px" aria-label="Dismiss">✕</button>' +
        '</div>';
    }
    versesContainer.innerHTML = $encouragementCard +
      '<div class="quran-empty">' +
      '<div style="font-size: 42px; margin-bottom: 16px">📖</div>' +
      '<div style="font-size: 16px; font-weight: 500; color: var(--text); margin-bottom: 8px">Select a Surah</div>' +
      '<div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; max-width: 300px; margin: 0 auto">' +
      'Choose a surah from the list to begin reading. Words you have studied are highlighted.</div>' +
      '<div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px; flex-wrap: wrap">' +
      '<span class="quran-legend-item"><span class="quran-legend-swatch quran-token-mastered"></span>Mastered</span>' +
      '<span class="quran-legend-item"><span class="quran-legend-swatch quran-token-known"></span>Known</span>' +
      '<span class="quran-legend-item"><span class="quran-legend-swatch quran-token-learning"></span>Learning</span>' +
      '<span class="quran-legend-item"><span class="quran-legend-swatch quran-token-seen"></span>Seen</span>' +
      '<span class="quran-legend-item"><span class="quran-legend-swatch quran-token-unknown"></span>New</span>' +
      '</div></div>';
  } else if (_quranSurahId) {
    openSurahForReading(_quranSurahId);
  }

  // Wire Back button and other Quran view events
  wireQuranEvents();
}

// ── Back to Surah List ─────────────────────────────────────────

function goBackToSurahList() {
  _quranSurahId = null;
  var listEl = document.getElementById('quran-surah-list');
  var mainEl = document.getElementById('quran-main');
  if (listEl) listEl.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';
  renderSurahBrowser();
}

// ── Event Wiring ───────────────────────────────────────────────

function wireQuranEvents() {
  var backBtn = document.getElementById('quran-back-to-list');
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

// ── Export window.__quran for Smart Learning Engine ────────────
window.__quran = {
  getLastReadPosition: getLastReadPosition,
  resumeReading: resumeReading,
  getReadingJourneySummary: getReadingJourneySummary,
};
