// ═══════════════════════════════════════════════════════════════
// tajweed-makharij.js — Where each letter is pronounced, and the
// letter qualities a beginner learns
//
// Content to be checked by the owner before release.
//
// Data only. The 17 points follow al-Jazari's Muqaddimah (Ḥafṣ ʿan ʿĀṣim).
// Area names and descriptions are strings-en.js tajweed.area.<area>.*, the
// one-line description of each point tajweed.point.<point>, and each quality
// tajweed.quality.<quality>.*. Letter ids are QAIDA_LETTERS ids, plus
// hamza (the Qaida hamzah skill), which has its own point in the throat.
//
// Alif is listed at the mouth cavity, where the long vowels come from.
// Wāw and yā are listed at their consonant points; as long vowels (madd)
// they also come from the cavity, which the cavity's description explains.
// ═══════════════════════════════════════════════════════════════

var TAJWEED_AREAS = ['throat', 'tongue', 'lips', 'nose', 'cavity'];

// The 17 points in the classical order, each with the letters it makes.
// The nasal passage makes the ghunnah of nūn and mīm, not a letter of its own.
var TAJWEED_POINTS = [
  { id: 'cavity',                 area: 'cavity', letters: ['alif'] },
  { id: 'throat-deepest',         area: 'throat', letters: ['hamza', 'ha'] },
  { id: 'throat-middle',          area: 'throat', letters: ['ain', 'hha'] },
  { id: 'throat-nearest',         area: 'throat', letters: ['ghayn', 'kha'] },
  { id: 'tongue-back-deepest',    area: 'tongue', letters: ['qaf'] },
  { id: 'tongue-back',            area: 'tongue', letters: ['kaf'] },
  { id: 'tongue-middle',          area: 'tongue', letters: ['jim', 'shin', 'ya'] },
  { id: 'tongue-side',            area: 'tongue', letters: ['dad'] },
  { id: 'tongue-edge',            area: 'tongue', letters: ['lam'] },
  { id: 'tongue-tip-nun',         area: 'tongue', letters: ['nun'] },
  { id: 'tongue-tip-ra',          area: 'tongue', letters: ['ra'] },
  { id: 'tongue-tip-gums',        area: 'tongue', letters: ['ta', 'dal', 'tta'] },
  { id: 'tongue-tip-teeth-edges', area: 'tongue', letters: ['tha', 'dhal', 'zza'] },
  { id: 'tongue-tip-lower-teeth', area: 'tongue', letters: ['sad', 'sin', 'zay'] },
  { id: 'lip-teeth',              area: 'lips',   letters: ['fa'] },
  { id: 'lips-both',              area: 'lips',   letters: ['ba', 'mim', 'waw'] },
  { id: 'nose',                   area: 'nose',   letters: [] },
];

// One entry per letter, { letter, area, point }, in the order of the points.
var TAJWEED_MAKHARIJ = [];
TAJWEED_POINTS.forEach(function (p) {
  p.letters.forEach(function (id) {
    TAJWEED_MAKHARIJ.push({ letter: id, area: p.area, point: p.id });
  });
});

// Letters with each quality (ṣifah). Letters that are not heavy are light,
// and letters that are not whispered are voiced.
var TAJWEED_QUALITIES = {
  heavy: ['kha', 'sad', 'dad', 'ghayn', 'tta', 'qaf', 'zza'],              // isti'la: خص ضغط قظ
  whispered: ['fa', 'hha', 'tha', 'ha', 'shin', 'kha', 'sad', 'sin', 'kaf', 'ta'], // hams: فحثه شخص سكت
  qalqalah: ['qaf', 'tta', 'ba', 'jim', 'dal'],                            // قطب جد
  whistling: ['sad', 'zay', 'sin'],                                        // safir
  nasal: ['nun', 'mim'],                                                   // ghunnah
};

// Pairs of letters learners commonly mix up.
var TAJWEED_CONFUSED_PAIRS = [
  ['hha', 'ha'],
  ['ain', 'hamza'],
  ['sad', 'sin'],
  ['tta', 'ta'],
  ['dad', 'dal'],
  ['zza', 'dhal'],
  ['qaf', 'kaf'],
  ['tha', 'sin'],
];
