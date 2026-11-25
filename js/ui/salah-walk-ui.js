// ═══════════════════════════════════════════════════════════════
// salah-walk-ui.js — The walkthrough on lesson 1.1's intro
//
// The figure plays a whole two-rakʿah prayer (js/salah/salah-walk.js) with
// the step's name and what to do and say beneath it. Below, every step is a
// chip, grouped by rakʿah; tapping one shows that step and stops the
// playing. js/ui/salah-ui.js puts the markup on the screen and mounts it.
// ═══════════════════════════════════════════════════════════════

/** How long a step holds per word of its caption, so it can be read */
var SALAH_WALK_MS_PER_WORD = 300;

function _swEsc(text) { return escapeHtml(String(text)); }

/** The walkthrough's markup: the note, the figure, the step now shown and the chips. */
function salahWalkMarkup(madhab) {
  var steps = getSalahWalkSteps(madhab);
  var first = steps[0];
  var h = '<p class="qaida-note">' + _swEsc(t('salah.walk.intro')) + '</p>' +
    '<div class="salah-walk-fig" id="salah-fig"></div>' +
    '<p class="salah-walk-now"><span class="salah-walk-label" id="salah-walk-label">' + _swEsc(t(salahWalkLabelKey(first))) +
    '</span> <span class="salah-walk-caption" id="salah-walk-caption">' + _swEsc(t(salahWalkCaptionKey(first, madhab))) + '</span></p>' +
    '<div class="salah-walk-steps" role="group" aria-label="' + _swEsc(t('salah.walk.steps')) + '">';
  var part = null;
  steps.forEach(function (s) {
    if (s.part !== part) {
      h += (part ? '</div>' : '') + '<h3 class="salah-walk-part">' + _swEsc(t('salah.walk.part.' + s.part)) + '</h3><div class="salah-chips">';
      part = s.part;
    }
    h += '<button type="button" class="salah-chip" data-action="pose" data-pose="' + s.id + '" aria-pressed="false">' +
      _swEsc(t(salahWalkLabelKey(s))) + '</button>';
  });
  return h + '</div></div>';
}

/** Start the figure in the walkthrough's markup; returns its handle, or null. */
function mountSalahWalk(madhab) {
  var host = document.getElementById('salah-fig');
  if (!host || typeof mountSalahFigure !== 'function') return null;
  var byId = {};
  var steps = getSalahWalkSteps(madhab).map(function (s) {
    var caption = t(salahWalkCaptionKey(s, madhab));
    byId[s.id] = { label: t(salahWalkLabelKey(s)), caption: caption };
    return { id: s.id, frame: salahWalkFrame(s, madhab), label: byId[s.id].label,
      hold: Math.max(SALAH_FIG_HOLD_MS, caption.split(' ').length * SALAH_WALK_MS_PER_WORD) };
  });
  var label = document.getElementById('salah-walk-label');
  var caption = document.getElementById('salah-walk-caption');
  return mountSalahFigure(host, steps, {
    onStep: function (id) {
      if (label) label.textContent = byId[id].label;
      if (caption) caption.textContent = byId[id].caption;
      var chips = document.querySelectorAll ? document.querySelectorAll('.salah-chip') : [];
      for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', String(chips[i].getAttribute('data-pose') === id));
    },
  });
}
