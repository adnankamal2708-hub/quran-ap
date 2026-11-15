// ═══════════════════════════════════════════════════════════════
// daily-ayah.js — choosing Today's ayah
//
// One real ayah a day that the learner can mostly read already. The
// index (js/quran/ayah-readability.js) gives each word of an ayah as a
// lesson word (N = cw_N), وَ/فَ plus one ("+N"), or null. A word is known
// when that lesson word is mastered (SRS stage 2+, the same words % of the
// Quran counts); every other word is a hint the learner is taught first.
//
// The pick is kept all day and an ayah is never offered twice. History is
// on this device only, in localStorage (no Firestore schema change).
// ═══════════════════════════════════════════════════════════════

var DAILY_AYAH_KEY = 'quran_daily_ayah';
var DAILY_AYAH_MASTERED_STAGE = 2;
// First choice, then the fallback when no ayah meets it: at least
// known/of of the words known, and at most maxHints hints
var DAILY_AYAH_RULES = [
  { known: 2, of: 3, maxHints: 2 },
  { known: 1, of: 2, maxHints: 3 },
];

/** 'YYYY-MM-DD' for the local calendar day of `date`. */
function dailyAyahDateKey(date) {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

/** What the learner knows of one ayah: { ref, entries, known, total, hints, newest }. */
function describeDailyAyah(ref, entries, srs) {
  var hints = [], newest = 0;
  entries.forEach(function (e, i) {
    var entry = e === null ? null : srs['cw_' + Number(String(e).replace('+', ''))];
    if (entry && entry.stage >= DAILY_AYAH_MASTERED_STAGE) newest = Math.max(newest, Number(entry.ratedAt) || 0);
    else hints.push(i);
  });
  return { ref: ref, entries: entries, known: entries.length - hints.length, total: entries.length, hints: hints, newest: newest };
}

function _dailyAyahHash(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function _dailyAyahFits(a, rule) {
  return a.known * rule.of >= a.total * rule.known && a.hints.length <= rule.maxHints;
}

/**
 * Today's ayah, or null when none fits. Pure.
 *   index    { "s:a": entries } from ayah-readability.js
 *   srs      SRS entries by word id ({ stage, ratedAt })
 *   state    { date, ref, done, readCount } (loadDailyAyahState)
 *   dateKey  dailyAyahDateKey(today)
 * Today's earlier pick is kept even if more words were mastered since.
 * Otherwise: the first rule any ayah meets, preferring the ayah with the
 * most recently mastered word; ties vary by day but are deterministic.
 */
function pickDailyAyah(index, srs, state, dateKey) {
  if (state.date === dateKey && state.ref && index[state.ref]) {
    return describeDailyAyah(state.ref, index[state.ref], srs);
  }
  var done = {};
  (state.done || []).forEach(function (r) { done[r] = true; });
  var all = Object.keys(index).filter(function (r) { return !done[r]; })
    .map(function (r) { return describeDailyAyah(r, index[r], srs); });

  for (var i = 0; i < DAILY_AYAH_RULES.length; i++) {
    var fits = all.filter(function (a) { return _dailyAyahFits(a, DAILY_AYAH_RULES[i]); });
    if (!fits.length) continue;
    fits.sort(function (a, b) {
      return (b.newest - a.newest) || (_dailyAyahHash(dateKey + a.ref) - _dailyAyahHash(dateKey + b.ref));
    });
    return fits[0];
  }
  return null;
}

/** A new state with `ref` done; only "I understood it" adds to readCount, once. */
function completeDailyAyah(state, ref, understood) {
  var done = (state.done || []).slice();
  var already = done.indexOf(ref) >= 0;
  if (!already) done.push(ref);
  return {
    date: state.date, ref: state.ref, done: done,
    readCount: (state.readCount || 0) + (understood && !already ? 1 : 0),
  };
}

function loadDailyAyahState() {
  var empty = { date: '', ref: '', done: [], readCount: 0 };
  try {
    var s = JSON.parse(localStorage.getItem(DAILY_AYAH_KEY));
    if (!s || typeof s !== 'object') return empty;
    return {
      date: String(s.date || ''), ref: String(s.ref || ''),
      done: Array.isArray(s.done) ? s.done : [], readCount: Number(s.readCount) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveDailyAyahState(state) {
  try { localStorage.setItem(DAILY_AYAH_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
}
