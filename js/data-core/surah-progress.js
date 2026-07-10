// ── Surah Progress Tracking ─────────────────────────────────────

const SURAH_PROGRESS_KEY = 'quran_surah_progress';

function getDefaultSurahProgress() {
  return {
    completedSurahs: [],
    quizPassed: {},
  };
}

function loadSurahProgress() {
  try {
    var raw = localStorage.getItem(SURAH_PROGRESS_KEY);
    if (!raw) return getDefaultSurahProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultSurahProgress();
  }
}

function saveSurahProgress(data) {
  try {
    localStorage.setItem(SURAH_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save surah progress:', e.message);
  }
}

function isSurahCompleted(surahId) {
  var progress = loadSurahProgress();
  return progress.completedSurahs.indexOf(surahId) >= 0;
}

function completeSurah(surahId) {
  var progress = loadSurahProgress();
  if (progress.completedSurahs.indexOf(surahId) < 0) {
    progress.completedSurahs.push(surahId);
  }
  progress.quizPassed[String(surahId)] = true;
  saveSurahProgress(progress);
  // Queue cloud sync
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

function getCompletedSurahCount() {
  var progress = loadSurahProgress();
  return progress.completedSurahs.length;
}
