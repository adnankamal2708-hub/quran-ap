// ═══════════════════════════════════════════════════════════════
// The "Grammar notes" text for a Foundation lesson. Particles have no
// root or pattern, so a lesson made mostly of them gets advice that fits.
// ═══════════════════════════════════════════════════════════════

var FOUNDATION_NOTE_ROOTS = 'Focus on the root letters and their core meaning. Notice how different patterns (wazn) modify the meaning. Pay attention to how this word functions in its ayah context.';
var FOUNDATION_NOTE_PARTICLES = 'Most of these are particles and pronouns: short words with no root or pattern. Learn each one as a whole, and notice what it links or points to in its verse.';

function _hasNoRoot(word) {
  return !word || !word.root || word.root === '—';
}

function getFoundationGrammarNote(words) {
  var list = (words || []).filter(Boolean);
  var rootless = list.filter(_hasNoRoot).length;
  return list.length > 0 && rootless * 2 > list.length ? FOUNDATION_NOTE_PARTICLES : FOUNDATION_NOTE_ROOTS;
}
