// ═══════════════════════════════════════════════════════════════
// Explorer root family and "Practice related".
// A word's hand-written rootFamily also lists dictionary words that are
// not in the Quran (كَوْن, تَكْوِين for كَانَ), so only entries that are
// words in Bayan, and so in the Quran, are shown or practised.
// ═══════════════════════════════════════════════════════════════

function getQuranRootFamily(word) {
  if (!word || !word.rootFamily) return [];
  var seen = {};
  return word.rootFamily.map(function (rf) {
    var found = findWordsByArabicList([rf.a])[0];
    if (!found || found.arabic === word.arabic || seen[found.id]) return null;
    seen[found.id] = true;
    return { a: found.arabic, e: rf.e, word: found };
  }).filter(Boolean);
}

// The word "Practice related" opens: a word from the same root, else a
// related word, else null.
function getPracticeRelatedTarget(word) {
  if (!word) return null;
  var derived = typeof getDerivedForms === 'function' ? getDerivedForms(word) : [];
  for (var i = 0; i < derived.length; i++) {
    var sib = findWordById(derived[i].wordId);
    if (sib && sib.id !== word.id) return sib;
  }
  var family = getQuranRootFamily(word);
  if (family.length > 0) return family[0].word;
  var rels = typeof getRelatedWordObjects === 'function' ? getRelatedWordObjects(word) : [];
  for (var r = 0; r < rels.length; r++) {
    var rel = rels[r].id ? findWordById(rels[r].id) : findWordsByArabicList([rels[r].arabic])[0];
    if (rel && rel.id !== word.id) return rel;
  }
  return null;
}
