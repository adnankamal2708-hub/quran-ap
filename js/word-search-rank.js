// ═══════════════════════════════════════════════════════════════
// Word list search: forgiving matches and a ranked result order.
// "kana" finds kāna, "رحم" finds the root ر-ح-م, an Arabic word typed
// without vowel marks still matches, and "allah" puts Allah first.
// ═══════════════════════════════════════════════════════════════

function _rootKey(str) {
  return normalizeArabic(String(str || '')).replace(/[-\s]/g, '');
}

// Matches the plain forms people type: no long-vowel marks, no dashes.
function matchesWordSearchKeys(w, query) {
  var q = String(query || '').trim();
  if (!q) return false;
  var tq = normalizeTranslit(q);
  if (tq && normalizeTranslit(w.translit).indexOf(tq) >= 0) return true;
  var aq = normalizeArabic(q);
  if (!aq) return false;
  if (normalizeArabic(w.arabic || '').indexOf(aq) >= 0) return true;
  var rq = _rootKey(q);
  return rq.length > 0 && _rootKey(w.root).indexOf(rq) >= 0;
}

// 0 = the word itself, 1 = its English starts with the query,
// 2 = the query is a whole word in its English or meaning, 3 = anything else.
function _searchTier(w, q, tq, aq) {
  var eng = String(w.english || '').toLowerCase();
  if (normalizeArabic(w.arabic || '') === aq || eng === q || normalizeTranslit(w.translit) === tq || _rootKey(w.root) === _rootKey(q)) return 0;
  if (eng.indexOf(q) === 0) return 1;
  var re = new RegExp('(^|[^a-z])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)');
  if (re.test(eng) || re.test(String(w.meaning || '').toLowerCase())) return 2;
  return 3;
}

function rankSearchResults(words, query) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return words;
  var tq = normalizeTranslit(q), aq = normalizeArabic(q);
  return words
    .map(function (w, i) { return { w: w, tier: _searchTier(w, q, tq, aq), i: i }; })
    .sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier - b.tier;
      var rank = (a.w.frequencyRank || 9999) - (b.w.frequencyRank || 9999);
      return rank || a.i - b.i;
    })
    .map(function (x) { return x.w; });
}
