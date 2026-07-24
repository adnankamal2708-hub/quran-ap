// ═══════════════════════════════════════════════════════════════
// phase2-surahs.js — Curated Surah Progression Data
//
// Defines the Guided Reading stage: a curated sequence of surahs
// ordered by educational value for learners who have completed
// the Foundation Course.
//
// Selection criteria:
//   - High comprehension after Foundation (vocabulary overlap)
//   - Frequently recited in salah (immediate practical value)
//   - Short enough to finish in one reading session
//   - Rich vocabulary overlap with Foundation words
//   - Gradually increasing reading difficulty
//
// This creates constant "I actually understand this!" moments.
// ═══════════════════════════════════════════════════════════════

/**
 * Guided Reading surah progression.
 *
 * Each entry contains:
 *   surahId    - Surah number (1-114)
 *   difficulty - 1 (easiest) to 5 (hardest) based on vocabulary overlap & length
 *   estMinutes - Estimated reading time at comfortable pace
 */
var PHASE2_GUIDED_SURAHS = [
  // ── Stage 1: High Foundation Overlap — Immediate Comprehension ──
  // These surahs have very high vocabulary overlap with Foundation words.
  // Learners will immediately feel their progress.
  { surahId: 1,  difficulty: 1, estMinutes: 3 },   // Al-Fatihah
  { surahId: 112, difficulty: 1, estMinutes: 2 },  // Al-Ikhlas
  { surahId: 103, difficulty: 1, estMinutes: 2 },  // Al-Asr
  { surahId: 108, difficulty: 1, estMinutes: 2 },  // Al-Kawthar
  { surahId: 113, difficulty: 1, estMinutes: 3 },  // Al-Falaq
  { surahId: 114, difficulty: 1, estMinutes: 3 },  // An-Nas

  // ── Stage 2: Short Surahs — Building Confidence ──
  // Slightly longer, but still very manageable.
  // Reinforces Stage 1 vocabulary while introducing pattern variation.
  { surahId: 107, difficulty: 2, estMinutes: 3 },  // Al-Ma'un
  { surahId: 106, difficulty: 2, estMinutes: 3 },  // Quraysh
  { surahId: 105, difficulty: 2, estMinutes: 3 },  // Al-Fil
  { surahId: 109, difficulty: 2, estMinutes: 3 },  // Al-Kafirun
  { surahId: 111, difficulty: 2, estMinutes: 3 },  // Al-Masad
  { surahId: 110, difficulty: 2, estMinutes: 3 },  // An-Nasr
  { surahId: 100, difficulty: 2, estMinutes: 4 },  // Al-'Adiyat

  // ── Stage 3: Medium-Short Surahs — Expanding Range ──
  // More vocabulary variety, longer reading sessions.
  // Introduces new roots naturally.
  { surahId: 97,  difficulty: 2, estMinutes: 3 },  // Al-Qadr
  { surahId: 99,  difficulty: 2, estMinutes: 4 },  // Az-Zalzalah
  { surahId: 95,  difficulty: 2, estMinutes: 3 },  // At-Tin
  { surahId: 94,  difficulty: 2, estMinutes: 3 },  // Ash-Sharh
  { surahId: 93,  difficulty: 2, estMinutes: 4 },  // Ad-Duha
  { surahId: 102, difficulty: 3, estMinutes: 4 },  // At-Takathur
  { surahId: 104, difficulty: 3, estMinutes: 4 },  // Al-Humazah
  { surahId: 101, difficulty: 3, estMinutes: 5 },  // Al-Qari'ah

  // ── Stage 4: Medium Surahs — Deeper Reading ──
  // These surahs have richer vocabulary and introduce thematic depth.
  // Learners begin reading longer passages comfortably.
  { surahId: 91,  difficulty: 3, estMinutes: 5 },  // Ash-Shams
  { surahId: 92,  difficulty: 3, estMinutes: 5 },  // Al-Layl
  { surahId: 90,  difficulty: 3, estMinutes: 5 },  // Al-Balad
  { surahId: 89,  difficulty: 3, estMinutes: 6 },  // Al-Fajr
  { surahId: 88,  difficulty: 3, estMinutes: 6 },  // Al-Ghashiyah
  { surahId: 87,  difficulty: 3, estMinutes: 5 },  // Al-A'la
  { surahId: 86,  difficulty: 3, estMinutes: 5 },  // At-Tariq
  { surahId: 85,  difficulty: 3, estMinutes: 6 },  // Al-Buruj
  { surahId: 84,  difficulty: 3, estMinutes: 6 },  // Al-Inshiqaq
  { surahId: 83,  difficulty: 4, estMinutes: 8 },  // Al-Mutaffifin

  // ── Stage 5: Longer Surahs — Reading Confidence ──
  // These require sustained reading. Vocabulary is now broad enough
  // to handle longer passages comfortably.
  { surahId: 81,  difficulty: 4, estMinutes: 7 },  // At-Takwir
  { surahId: 82,  difficulty: 4, estMinutes: 7 },  // Al-Infitar
  { surahId: 80,  difficulty: 4, estMinutes: 8 },  // 'Abasa
  { surahId: 79,  difficulty: 4, estMinutes: 10 }, // An-Nazi'at
  { surahId: 78,  difficulty: 4, estMinutes: 12 }, // An-Naba'
  { surahId: 77,  difficulty: 4, estMinutes: 12 }, // Al-Mursalat
  { surahId: 76,  difficulty: 4, estMinutes: 14 }, // Al-Insan
  { surahId: 75,  difficulty: 4, estMinutes: 10 }, // Al-Qiyamah
  { surahId: 74,  difficulty: 4, estMinutes: 15 }, // Al-Muddaththir
  { surahId: 73,  difficulty: 4, estMinutes: 15 }, // Al-Muzzammil

  // ── Stage 6: Completion of Guided Reading ──
  // Finishing these marks the transition to full independent reading.
  { surahId: 72,  difficulty: 5, estMinutes: 18 }, // Al-Jinn
  { surahId: 71,  difficulty: 5, estMinutes: 18 }, // Nuh
  { surahId: 70,  difficulty: 5, estMinutes: 18 }, // Al-Ma'arij
  { surahId: 69,  difficulty: 5, estMinutes: 20 }, // Al-Haqqah
  { surahId: 68,  difficulty: 5, estMinutes: 20 }, // Al-Qalam
  { surahId: 67,  difficulty: 5, estMinutes: 22 }, // Al-Mulk
];

// ── Helper: get by surahId ─────────────────────────────────────

var _guidedBySurahId = null;

function _buildGuidedIndex() {
  if (_guidedBySurahId) return;
  _guidedBySurahId = {};
  for (var gi = 0; gi < PHASE2_GUIDED_SURAHS.length; gi++) {
    var gs = PHASE2_GUIDED_SURAHS[gi];
    _guidedBySurahId[gs.surahId] = gs;
  }
}

function getGuidedSurahInfo(surahId) {
  _buildGuidedIndex();
  return _guidedBySurahId[surahId] || null;
}

// ── Storage key for guided reading progress ────────────────────

var _GUIDED_KEY = 'bayan_guided_reading';

function _loadGuidedProgress() {
  try {
    var raw = localStorage.getItem(_GUIDED_KEY);
    if (!raw) return { completedSurahs: [] };
    return JSON.parse(raw);
  } catch (e) { return { completedSurahs: [] }; }
}

function _saveGuidedProgress(progress) {
  try {
    localStorage.setItem(_GUIDED_KEY, JSON.stringify(progress));
  } catch (e) { /* ignore */ }
}

/**
 * Mark a guided surah as completed.
 */
function completeGuidedSurah(surahId) {
  var progress = _loadGuidedProgress();
  if (progress.completedSurahs.indexOf(surahId) < 0) {
    progress.completedSurahs.push(surahId);
    _saveGuidedProgress(progress);
  }
}

/**
 * Check if a guided surah has been completed.
 */
function isGuidedSurahCompleted(surahId) {
  var progress = _loadGuidedProgress();
  return progress.completedSurahs.indexOf(surahId) >= 0;
}

/**
 * Get the next uncompleted guided surah.
 * Returns null if all guided surahs are completed.
 */
function getNextGuidedSurah() {
  var progress = _loadGuidedProgress();
  for (var gi = 0; gi < PHASE2_GUIDED_SURAHS.length; gi++) {
    if (progress.completedSurahs.indexOf(PHASE2_GUIDED_SURAHS[gi].surahId) < 0) {
      return PHASE2_GUIDED_SURAHS[gi];
    }
  }
  return null; // All guided surahs completed
}

/**
 * Check if the Guided Reading stage is complete.
 */
function isGuidedReadingComplete() {
  return getNextGuidedSurah() === null;
}

/**
 * Get guided reading progress stats.
 */
function getGuidedReadingProgress() {
  var total = PHASE2_GUIDED_SURAHS.length;
  var progress = _loadGuidedProgress();
  var completed = progress.completedSurahs.length;
  var next = getNextGuidedSurah();
  return {
    total: total,
    completed: completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    nextSurah: next,
    isComplete: next === null,
  };
}
