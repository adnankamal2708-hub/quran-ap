// ═══════════════════════════════════════════════════════════════
// salah-figure-motion.js — How the prayer figure moves between positions
//
// Frames hold absolute angles, but a person moves joint by joint. So a move
// blends each joint's bend (the knee, the elbow, ...) inside the range that
// joint can really bend; a limb then never spins round the long way, a knee
// never bends backwards and a hand never swings behind the body. Going down
// to the ground or getting up, the figure bends its knees forward, then
// kneels, as people do.
// ═══════════════════════════════════════════════════════════════

/** Hip height (figure units) above which the figure counts as standing */
var SALAH_STAND_HIP = 70;

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

/** Knees bent forward over flat feet: the first step down from standing */
var _SALAH_CROUCH = { torso: 24, head: 30, legN: [128, 202, 92], legF: [126, 200, 90],
  armN: { ua: 172, fa: 164 }, armF: { ua: 174, fa: 166 }, palmN: 164, palmF: 166, focus: [] };

/** Kneeling upright, toes tucked under: the way down to the ground and up */
var _SALAH_KNEEL = { torso: 8, head: 14, legN: [178, -80, 215], legF: [180, -82, 215],
  armN: { ua: 168, fa: 150 }, armF: { ua: 170, fa: 152 }, palmN: 150, palmF: 152, focus: [] };

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

/** The frames a move passes through: crouching and kneeling between standing and the ground. */
function salahMotionPath(a, b) {
  var down = _salahIsStanding(a);
  if (down === _salahIsStanding(b)) return [a, b];
  var via = [salahPoseFrame(_SALAH_CROUCH), salahPoseFrame(_SALAH_KNEEL)];
  return [a].concat(down ? via : via.reverse(), [b]);
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
