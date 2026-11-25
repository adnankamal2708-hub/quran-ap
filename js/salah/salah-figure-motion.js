// ═══════════════════════════════════════════════════════════════
// salah-figure-motion.js — How the prayer figure moves between positions
//
// Frames hold absolute angles, but a person moves joint by joint. So a move
// blends each joint's bend (the knee, the elbow, ...) inside the range that
// joint can really bend; a limb then never spins round the long way, a knee
// never bends backwards and a hand never swings behind the body. Going down
// to the ground or getting up, the figure bends its knees forward, then
// kneels, as people do (or, the Mālikī way, puts the hands down first).
// ═══════════════════════════════════════════════════════════════

/** Hip height (figure units) above which the figure counts as standing */
var SALAH_STAND_HIP = 70;

/** Wrist height (figure units) below which a hand is on the ground */
var SALAH_ON_HANDS = 8;

/** A frame's body angles come first; the focus rings follow */
var SALAH_BODY_LEN = 18;

/** Degrees within which two frames show the same body */
var SALAH_SAME_DEG = 0.5;

/**
 * Each angle in a frame: [its index, the index it bends from (-1 = none),
 * the lowest bend it can make]. The highest is a full turn above that.
 */
var _SALAH_JOINTS = [
  [0, -1, -180], [1, 0, -180], // torso; neck
  [2, -1, 0], [3, 2, -20], [4, 3, -200], // near hip, knee, ankle
  [5, -1, 0], [6, 5, -20], [7, 6, -200], // far hip, knee, ankle
  [8, 0, -90], [9, 8, -200], [16, 9, -180], // near shoulder, elbow, wrist
  [11, 0, -90], [12, 11, -200], [17, 12, -180], // far shoulder, elbow, wrist
];

function _salahInRange(a, lo) { return ((a - lo) % 360 + 360) % 360 + lo; }

/** A frame as joint bends */
function _salahToJoints(f) {
  var j = f.slice();
  _SALAH_JOINTS.forEach(function (d) { j[d[0]] = _salahInRange(d[1] < 0 ? f[d[0]] : f[d[0]] - f[d[1]], d[2]); });
  return j;
}

/** Joint bends back to a frame; parents come first in _SALAH_JOINTS */
function _salahFromJoints(j) {
  var f = j.slice();
  _SALAH_JOINTS.forEach(function (d) { if (d[1] >= 0) f[d[0]] = j[d[0]] + f[d[1]]; });
  return f;
}

/** Two frames blended joint by joint: t = 0 gives a, t = 1 gives b. */
function salahBlendFrames(a, b, t) {
  if (t <= 0) return a.slice();
  var ja = _salahToJoints(a);
  var jb = _salahToJoints(b);
  return _salahFromJoints(ja.map(function (v, k) { return v + (jb[k] - v) * t; }));
}

function _salahIsStanding(f) { return salahFigurePoints(f).pts.hip[1] > SALAH_STAND_HIP; }

/** Hands on the ground with the knees still up: the Mālikī way down, hands first */
function _salahOnHands(f) {
  var p = salahFigurePoints(f).pts;
  return p.armN.wr[1] < SALAH_ON_HANDS && p.legN.knee[1] > SALAH_STAND_HIP / 2;
}

/** Two frames with the same body (focus rings aside) */
function _salahSameBody(a, b) {
  for (var k = 0; k < SALAH_BODY_LEN; k++) if (Math.abs(_salahInRange(a[k] - b[k], -180)) > SALAH_SAME_DEG) return false;
  return true;
}

/**
 * The frames a move passes through: crouching and kneeling between standing
 * and the ground, unless a step already shows one of them or the hands go
 * down first.
 */
function salahMotionPath(a, b) {
  var down = _salahIsStanding(a);
  if (down === _salahIsStanding(b) || _salahOnHands(a) || _salahOnHands(b)) return [a, b];
  var via = [salahPoseFrame(_SALAH_CROUCH), salahPoseFrame(_SALAH_KNEEL)];
  if (!down) via.reverse();
  return [a].concat(via.filter(function (f) { return !_salahSameBody(f, a) && !_salahSameBody(f, b); }), [b]);
}

/** Slow in, slow out */
function _salahEase(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

/** The frame at k (0 to 1) along a path: one easing in and out over the whole path. */
function salahPathAt(route, k) {
  var legs = route.length - 1;
  var at = _salahEase(Math.max(0, Math.min(1, k))) * legs;
  var i = Math.min(legs - 1, Math.floor(at));
  return salahBlendFrames(route[i], route[i + 1], at - i);
}
