// ═══════════════════════════════════════════════════════════════
// salah-figure-parts.js — The drawn parts of the prayer figure
//
// Tapered limbs, the hand with its fingers, lines and arrow heads, as SVG
// strings. js/ui/salah-figure.js puts them together into a pose.
// ═══════════════════════════════════════════════════════════════

/** Limb radii at each end, [start, end]: limbs taper from the body out, so the figure reads as a person, not blocks */
var SALAH_FIG_TAPER = { torso: [9.6, 10.6], thigh: [9.4, 7.4], shin: [7.4, 5.4], ua: [4.6, 3.9], fa: [3.9, 3], foot: [3.4, 2.2] };

/** The hand: the palm's share of its length, finger and thumb thickness, and how much longer than the hand bone it is drawn */
var SALAH_FIG_HAND = { palm: 0.48, finger: 1.6, thumb: 1.8, reach: 1.6 };

function _sfNum(n) { return n.toFixed(1); }

/** A limb from a to b (SVG points) with end radii ra and rb: a tapered capsule. */
function _sfTaper(a, b, ra, rb, style) {
  var dx = b[0] - a[0];
  var dy = b[1] - a[1];
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len;
  var ny = dx / len;
  function pt(c, r, k) { return _sfNum(c[0] + nx * r * k) + ' ' + _sfNum(c[1] + ny * r * k); }
  return '<path d="M' + pt(a, ra, 1) + ' L' + pt(b, rb, 1) + ' L' + pt(b, rb, -1) + ' L' + pt(a, ra, -1) + ' Z" ' + style + '/>' +
    '<circle cx="' + _sfNum(a[0]) + '" cy="' + _sfNum(a[1]) + '" r="' + _sfNum(ra) + '" ' + style + '/>' +
    '<circle cx="' + _sfNum(b[0]) + '" cy="' + _sfNum(b[1]) + '" r="' + _sfNum(rb) + '" ' + style + '/>';
}

/** Fill style, with an outline drawn `edge` wider when given */
function _sfStyle(colour, edge) {
  return edge ? 'style="fill:var(--salah-edge);stroke:var(--salah-edge)" stroke-width="' + edge + '" stroke-linejoin="round"'
    : 'style="fill:var(' + colour + ')"';
}

/**
 * A hand from the wrist `w` towards the fingertips `tip` (SVG points): a
 * palm, four fingers and a thumb on the side towards the body's front when
 * the hand hangs. `curl` (0..1) folds the fingers in, leaving the index to
 * the raised finger of the tashahhud.
 */
function _sfHand(w, tip, skin, curl) {
  var H = SALAH_FIG_HAND;
  var dx = (tip[0] - w[0]) * H.reach;
  var dy = (tip[1] - w[1]) * H.reach;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var ux = dx / len;
  var uy = dy / len;
  var nx = -uy;
  var ny = ux;
  function at(along, side) { return [w[0] + ux * len * along + nx * side, w[1] + uy * len * along + ny * side]; }
  var knuckle = at(H.palm, 0);
  var parts = [];
  // Fingers, little finger (behind) to index (in front), slightly fanned
  [[-1.5, 0.78], [-0.5, 0.94], [0.5, 1], [1.5, 0.92]].forEach(function (f, i) {
    var keep = i === 3 ? 1 - curl : 1 - curl * 0.72;
    var reach = H.palm + (1 - H.palm) * f[1] * keep;
    parts.push([at(H.palm - 0.05, f[0] * 0.95), at(reach, f[0] * 1.15), H.finger, H.finger * 0.85]);
  });
  parts.push([at(0.12, 2.2), at(0.5 - curl * 0.12, 4.9), H.thumb, H.thumb * 0.8]);
  var h = '';
  [1, 0].forEach(function (pass) {
    var style = _sfStyle(skin, pass ? 0.9 : 0);
    h += _sfTaper(w, knuckle, 2.8, 3.2, style);
    parts.forEach(function (q) { h += _sfTaper(q[0], q[1], q[2] / 2, q[3] / 2, style); });
  });
  return h;
}

function _sfLine(a, b, width, colour, extra) {
  return '<line x1="' + _sfNum(a[0]) + '" y1="' + _sfNum(a[1]) + '" x2="' + _sfNum(b[0]) + '" y2="' + _sfNum(b[1]) +
    '" style="stroke:var(' + colour + ')" stroke-width="' + _sfNum(width) + '" stroke-linecap="round"' + (extra || '') + '/>';
}

/** A small arrow head at `tip`, pointing along (dx, dy). */
function _sfArrowHead(tip, dx, dy, opacity) {
  var len = Math.sqrt(dx * dx + dy * dy);
  var ux = dx / len;
  var uy = dy / len;
  var size = 4;
  var a = [tip[0] - ux * size - uy * size * 0.7, tip[1] - uy * size + ux * size * 0.7];
  var b = [tip[0] - ux * size + uy * size * 0.7, tip[1] - uy * size - ux * size * 0.7];
  return '<path d="M' + _sfNum(a[0]) + ' ' + _sfNum(a[1]) + ' L' + _sfNum(tip[0]) + ' ' + _sfNum(tip[1]) + ' L' +
    _sfNum(b[0]) + ' ' + _sfNum(b[1]) + '" fill="none" style="stroke:var(--salah-ring)" stroke-width="1.3"' +
    ' stroke-linecap="round" opacity="' + opacity + '"/>';
}
