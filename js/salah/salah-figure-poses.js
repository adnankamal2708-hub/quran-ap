// ═══════════════════════════════════════════════════════════════
// salah-figure-poses.js — The prayer figure's positions and body maths
//
// A side view of a faceless figure facing the qibla. Angles are absolute
// degrees: 0 = up, 90 = forward (towards the qibla), 180 = down, -90 = back.
// Points use y up with the hip at the origin; salahFigurePoints moves them
// so the ground is y = 0. A frame is a pose as a flat list of numbers, so
// two poses can be blended for the animation (js/salah/salah-figure-motion.js).
// ═══════════════════════════════════════════════════════════════

/** Bone lengths */
var SALAH_FIG_LEN = { neck: 9, head: 10.5, torso: 50, ua: 28, fa: 25, hand: 9, thigh: 45, shin: 43, foot: 14 };

/** Half widths of the limbs as drawn */
var SALAH_FIG_HW = { torso: 10.5, thigh: 8.5, shin: 8, ua: 4.2, fa: 3.6 };

/** The positions the figure can show, one per prayer step */
var SALAH_POSE_IDS = ['takbir', 'qiyam', 'ruku', 'itidal', 'sujud', 'jalsa', 'tashahhud', 'taslim'];

/** Madhabs that raise the hands before and after the bow */
var SALAH_RAISE_MADHABS = ['shafii', 'hanbali'];

/** How far above the ground the wrist rests in sujūd: half the hand's width */
var SALAH_PALM_LIFT = 2.3;

/** Where the forehead sits on the head: from the crown towards the face */
var SALAH_FOREHEAD_ANGLE = 60;

/** The details a pose can ring: hand, forehead, knee, toes, finger, the hip on the ground */
var SALAH_FOCUS_KEYS = ['handN', 'forehead', 'kneeN', 'toeN', 'finger', 'seat'];

var _SALAH_STAND = { torso: 0, head: 0, legN: [180, 180, 93], legF: [180, 180, 91] };
var _SALAH_SIT = { torso: -2, head: 6, legN: [100, -74, 200], legF: [102, -90, -90],
  armN: { target: 'knee', t: 0.72, off: [0, 2] }, armF: { target: 'knee', t: 0.7, off: [0, 2] }, palmN: 96, palmF: 96 };

/** Tawarruk: on the left hip, the left foot out under the right leg, the right foot upright */
var SALAH_TAWARRUK = { legN: [92, -76, 200], legF: [90, -88, -100], focus: ['seat'] };

/** Knees bent forward over flat feet: the first step down from standing */
var _SALAH_CROUCH = { torso: 24, head: 30, legN: [128, 202, 92], legF: [126, 200, 90],
  armN: { ua: 172, fa: 164 }, armF: { ua: 174, fa: 166 }, palmN: 164, palmF: 166, focus: [] };

/** Kneeling upright, toes tucked under: the way down to the ground and up */
var _SALAH_KNEEL = { torso: 8, head: 14, legN: [178, -80, 215], legF: [180, -82, 215],
  armN: { ua: 168, fa: 150 }, armF: { ua: 170, fa: 152 }, palmN: 150, palmF: 152, focus: [] };

/** Hands in qiyām: at the sides, below the navel, or above it */
var _SALAH_QIYAM_HANDS = {
  sides: { armN: { ua: 178, fa: 176 }, armF: { ua: 180, fa: 178 } },
  low: { armN: { ua: 180, fa: 110, faS: 0.62 }, armF: { ua: 182, fa: 112, faS: 0.5 }, palmN: 100, palmF: 96 },
  chest: { armN: { ua: 172, fa: 72, faS: 0.62 }, armF: { ua: 176, fa: 76, faS: 0.5 }, palmN: 96, palmF: 92 },
};
var _SALAH_QIYAM_BY_MADHAB = { maliki: 'sides', hanafi: 'low', hanbali: 'low', shafii: 'chest', unsure: 'chest' };

/** Hands in the takbīr: Ḥanafīs raise them to the ears (thumbs by the earlobes), the others to the shoulders */
var _SALAH_TAKBIR_HANDS = {
  ears: { armN: { ua: 120, fa: -4 }, armF: { ua: 116, fa: -8 }, palmN: -2, palmF: -6 },
  shoulders: { armN: { ua: 150, fa: 2 }, armF: { ua: 146, fa: -2 }, palmN: 4, palmF: 0 },
};
var _SALAH_TAKBIR_BY_MADHAB = { hanafi: 'ears' };

var _SALAH_POSES = {
  takbir: { base: _SALAH_STAND, focus: ['handN'] },
  qiyam: { base: _SALAH_STAND, head: 10, focus: ['handN'] },
  ruku: { torso: 92, head: 96, legN: [174, 174, 96], legF: [174, 174, 94],
    armN: { target: 'knee', t: 1, off: [4, 6] }, armF: { target: 'knee', t: 1, off: [2, 6] }, palmN: 178, palmF: 178, focus: ['handN'] },
  itidal: { base: _SALAH_STAND, armN: { ua: 178, fa: 176 }, armF: { ua: 180, fa: 178 }, focus: [] },
  sujud: { torso: 122, head: 142, legN: [166, -80, 190], legF: [164, -82, 190],
    armN: { target: 'ground', dx: -20 }, armF: { target: 'ground', dx: -24 }, palmN: 90, palmF: 90,
    focus: ['forehead', 'handN', 'kneeN', 'toeN'] },
  jalsa: { base: _SALAH_SIT, focus: ['handN', 'toeN'] },
  tashahhud: { base: _SALAH_SIT, head: 12, finger: 1, focus: ['finger'] },
  taslim: { base: _SALAH_SIT, turn: 1, focus: [] },
  // Going down knees first, or (Mālikī) hands first
  kneel: { base: _SALAH_KNEEL, focus: ['kneeN'] },
  handsDown: { torso: 118, head: 130, legN: [146, 206, 92], legF: [144, 204, 90],
    armN: { target: 'ground', dx: -18 }, armF: { target: 'ground', dx: -22 }, palmN: 90, palmF: 90, focus: ['handN'] },
};

function _salahDir(a) { var r = a * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; }
function salahFigAdd(p, a, len) { var d = _salahDir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; }
function _salahAngOf(dx, dy) { return Math.atan2(dx, dy) * 180 / Math.PI; }
function _salahLerp(a, b, t) { return a + (b - a) * t; }

/** The hands this madhab uses in qiyām or the takbīr (raising for the bow is to the shoulders). */
function _salahMadhabHands(id, madhab) {
  if (id === 'qiyam') return _SALAH_QIYAM_HANDS[_SALAH_QIYAM_BY_MADHAB[madhab] || 'chest'];
  if (id === 'takbir') return _SALAH_TAKBIR_HANDS[_SALAH_TAKBIR_BY_MADHAB[madhab] || 'shoulders'];
  if (id === 'raise') return _SALAH_TAKBIR_HANDS.shoulders;
  return {};
}

/** A pose's own fields over its base's, then the hands for this madhab. */
function salahPoseSpec(id, madhab) {
  var src = _SALAH_POSES[id === 'raise' ? 'takbir' : id];
  var spec = {};
  [src.base || {}, src, _salahMadhabHands(id, madhab)]
    .forEach(function (o) { Object.keys(o).forEach(function (k) { if (k !== 'base') spec[k] = o[k]; }); });
  spec.id = id;
  return spec;
}

/** The figure's positions through one rakʿah for a learner of this madhab. */
function getSalahPoses(madhab) {
  var raises = SALAH_RAISE_MADHABS.indexOf(madhab) >= 0;
  var out = [];
  SALAH_POSE_IDS.forEach(function (id) {
    out.push(salahPoseSpec(id, madhab));
    if (raises && (id === 'qiyam' || id === 'ruku')) out.push(salahPoseSpec('raise', madhab));
  });
  return out;
}

/** The body without arms, hip at the origin, y up. */
function salahFigureBody(p) {
  var L = SALAH_FIG_LEN;
  var hip = [0, 0];
  var sh = salahFigAdd(hip, p.torso, L.torso);
  var neck = salahFigAdd(sh, p.head, L.neck);
  function leg(a) {
    var k = salahFigAdd(hip, a[0], L.thigh);
    var an = salahFigAdd(k, a[1], L.shin);
    return { knee: k, ankle: an, toe: salahFigAdd(an, a[2], L.foot) };
  }
  return { hip: hip, sh: sh, neck: neck, headC: salahFigAdd(neck, p.head, L.head), legN: leg(p.legN), legF: leg(p.legF) };
}

/** The lowest surface point of the body (y up), arms left out. */
function salahFigureLowest(b) {
  var HW = SALAH_FIG_HW;
  var pts = [[b.hip[1], HW.torso], [b.sh[1], HW.torso], [b.headC[1], SALAH_FIG_LEN.head]];
  [b.legN, b.legF].forEach(function (g) {
    pts.push([g.knee[1], HW.thigh], [g.ankle[1], HW.shin * 0.7], [g.toe[1], 3]);
  });
  return Math.min.apply(null, pts.map(function (q) { return q[0] - q[1]; }));
}

/** Two-bone reach to the wrist; 'up' keeps the higher elbow, 'back' the one further back. */
function _salahIk(s, t, pick) {
  var a = SALAH_FIG_LEN.ua;
  var b = SALAH_FIG_LEN.fa;
  var dx = t[0] - s[0];
  var dy = t[1] - s[1];
  var d = Math.min(Math.sqrt(dx * dx + dy * dy), a + b - 0.5);
  var base = _salahAngOf(dx, dy);
  var off = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))) * 180 / Math.PI;
  var u1 = base + off;
  var u2 = base - off;
  var e1 = salahFigAdd(s, u1, a);
  var e2 = salahFigAdd(s, u2, a);
  var first = pick === 'up' ? e1[1] >= e2[1] : e1[0] <= e2[0];
  var el = first ? e1 : e2;
  return { ua: first ? u1 : u2, fa: _salahAngOf(t[0] - el[0], t[1] - el[1]) };
}

/** An arm as angles: given directly, or reaching for the knee or the ground. */
function _salahResolveArm(spec, b, ground, legKey) {
  if (spec.ua !== undefined) return { ua: spec.ua, fa: spec.fa, faS: spec.faS || 1 };
  var t;
  if (spec.target === 'knee') {
    var g = b[legKey];
    t = [_salahLerp(b.hip[0], g.knee[0], spec.t) + spec.off[0],
      _salahLerp(b.hip[1], g.knee[1], spec.t) + SALAH_FIG_HW.thigh + spec.off[1]];
  } else {
    t = [b.headC[0] + spec.dx, ground + SALAH_PALM_LIFT];
  }
  var r = _salahIk(b.sh, t, spec.target === 'ground' ? 'up' : 'back');
  return { ua: r.ua, fa: r.fa, faS: 1 };
}

/** A pose as a flat list of numbers. */
function salahPoseFrame(p) {
  var b = salahFigureBody(p);
  var g = salahFigureLowest(b);
  var aN = _salahResolveArm(p.armN, b, g, 'legN');
  var aF = _salahResolveArm(p.armF, b, g, 'legF');
  var f = [p.torso, p.head, p.legN[0], p.legN[1], p.legN[2], p.legF[0], p.legF[1], p.legF[2],
    aN.ua, aN.fa, aN.faS, aF.ua, aF.fa, aF.faS, p.finger || 0, p.turn || 0,
    p.palmN !== undefined ? p.palmN : aN.fa, p.palmF !== undefined ? p.palmF : aF.fa];
  SALAH_FOCUS_KEYS.forEach(function (k) { f.push(p.focus.indexOf(k) >= 0 ? 1 : 0); });
  return f;
}

/**
 * Every point of a frame, ground at y = 0 (y up): the body's joints, each
 * arm's elbow, wrist, palm middle and fingertips, the raised finger's tip
 * and the forehead. Also the frame's finger, turn, head angle and focus.
 */
function salahFigurePoints(f) {
  var L = SALAH_FIG_LEN;
  var b = salahFigureBody({ torso: f[0], head: f[1], legN: [f[2], f[3], f[4]], legF: [f[5], f[6], f[7]] });
  var dy = -salahFigureLowest(b);
  function arm(ua, fa, faS, palm) {
    var el = salahFigAdd(b.sh, ua, L.ua);
    var wr = salahFigAdd(el, fa, L.fa * faS);
    return { el: el, wr: wr, tip: salahFigAdd(wr, palm, L.hand), mid: salahFigAdd(wr, palm, L.hand * 0.55) };
  }
  var pts = { hip: b.hip, sh: b.sh, neck: b.neck, headC: b.headC, legN: b.legN, legF: b.legF,
    armN: arm(f[8], f[9], f[10], f[16]), armF: arm(f[11], f[12], f[13], f[17]) };
  pts.fingerTip = salahFigAdd(pts.armN.mid, 58, 9);
  pts.forehead = salahFigAdd(b.headC, f[1] + SALAH_FOREHEAD_ANGLE, L.head);
  (function shift(o) {
    Object.keys(o).forEach(function (k) {
      if (typeof o[k][0] === 'number') o[k] = [o[k][0], o[k][1] + dy];
      else shift(o[k]);
    });
  })(pts);
  var focus = {};
  SALAH_FOCUS_KEYS.forEach(function (k, i) { focus[k] = f[18 + i]; });
  return { pts: pts, head: f[1], finger: f[14], turn: f[15], focus: focus };
}
