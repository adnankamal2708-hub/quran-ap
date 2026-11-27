// ═══════════════════════════════════════════════════════════════
// salah-figure.js — Draws the prayer figure and moves it between positions
//
// A faceless figure in a thobe and kufi, side view, facing the qibla (left).
// Gold rings mark the detail a position is about. Poses and body maths live
// in js/salah/salah-figure-poses.js; colours are the --salah-* properties in
// styles.css, so the figure follows the light and dark themes.
// ═══════════════════════════════════════════════════════════════

/** The drawing's box, the ground line and the mat */
var SALAH_FIG_VIEW = { w: 260, h: 200, ground: 182, matX: 22, matW: 216 };

/** Milliseconds for each stretch of a move (going down or up passes a crouch and a kneel), then to hold */
var SALAH_FIG_MOVE_MS = 1400;
var SALAH_FIG_HOLD_MS = 2600;

/** The salām arrow: an ellipse round the head at eye level */
var SALAH_FIG_TURN = { rx: 18, ry: 8 };

/** Below this a blended value (a ring, the finger) is not drawn */
var SALAH_FIG_MIN_SHOW = 0.02;

/**
 * How far ahead of the near foot's toes (towards the qibla) the middle of
 * the mat is. The toes stay where they are on the mat through the whole
 * prayer, so a move never slides the figure; at this distance everything
 * from standing behind the toes to prostrating ahead of them fits the mat.
 */
var SALAH_FIG_TOE_TO_MID = 37;

/** The sideways shift that puts this figure's near toes at their place on the mat. */
function salahFigureOffsetX(p) { return SALAH_FIG_VIEW.w / 2 - (p.legN.toe[0] + SALAH_FIG_TOE_TO_MID); }

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

/** The SVG for one frame (salahPoseFrame), labelled for screen readers. */
function _salahFrameSvg(f, label) {
  var V = SALAH_FIG_VIEW;
  var L = SALAH_FIG_LEN;
  var HW = SALAH_FIG_HW;
  var r = salahFigurePoints(f);
  var p = r.pts;
  var aN = p.armN;
  var aF = p.armF;
  // Keep the toes in their place on the mat, then flip to SVG space (y down, facing left).
  var dx = salahFigureOffsetX(p);
  function P(q) { return [V.w - (q[0] + dx), V.ground - q[1]]; }

  var out = [];
  out.push('<rect x="' + V.matX + '" y="' + V.ground + '" width="' + V.matW + '" height="4" rx="2" style="fill:var(--salah-mat)"/>');
  out.push('<rect x="' + V.matX + '" y="' + V.ground + '" width="' + V.matW + '" height="1" style="fill:var(--gold)" opacity=".6"/>');
  // Limbs: an outline pass, then the fill, so joined parts read as one garment.
  function limbs(list) {
    [1, 0].forEach(function (pass) {
      list.forEach(function (s) {
        var r = SALAH_FIG_TAPER[s[2]];
        out.push(_sfTaper(P(s[0]), P(s[1]), r[0], r[1], _sfStyle(s[3], pass ? 2.2 : 0)));
      });
    });
  }
  function hand(a, skin, curl) { out.push(_sfHand(P(a.wr), P(a.tip), skin, curl || 0)); }

  // The far side, a shade darker
  limbs([[p.sh, aF.el, 'ua', '--salah-cloth-far'], [aF.el, aF.wr, 'fa', '--salah-cloth-far'],
    [p.hip, p.legF.knee, 'thigh', '--salah-cloth-far'], [p.legF.knee, p.legF.ankle, 'shin', '--salah-cloth-far'],
    [p.legF.ankle, p.legF.toe, 'foot', '--salah-skin-far']]);
  hand(aF, '--salah-skin-far');

  // Neck, then the thobe over the torso and near leg
  out.push(_sfLine(P(p.sh), P(p.neck), 7.5, '--salah-skin'));
  limbs([[p.legN.ankle, p.legN.toe, 'foot', '--salah-skin'], [p.hip, p.sh, 'torso', '--salah-cloth'],
    [p.hip, p.legN.knee, 'thigh', '--salah-cloth'], [p.legN.knee, p.legN.ankle, 'shin', '--salah-cloth']]);

  // The head: plain, with no face, and a kufi on top
  var hc = P(p.headC);
  out.push('<g class="salah-fig-head" transform="translate(' + _sfNum(hc[0]) + ' ' + _sfNum(hc[1]) + ') rotate(' + _sfNum(-r.head) + ')">' +
    '<circle r="' + L.head + '" style="fill:var(--salah-skin)"/>' +
    '<path d="M -11 -1 A 11 11 0 0 1 11 -1 L 11 0.8 L -11 0.8 Z" style="fill:var(--salah-kufi);stroke:var(--salah-edge)" stroke-width="0.8"/>' +
    '<path d="M -11 -0.6 L 11 -0.6" style="stroke:var(--gold)" stroke-width="1.1"/></g>');

  // The near (right) arm and hand; in the tashahhud the fingers close and the index rises
  limbs([[p.sh, aN.el, 'ua', '--salah-cloth'], [aN.el, aN.wr, 'fa', '--salah-cloth']]);
  hand(aN, '--salah-skin', r.finger);
  if (r.finger > SALAH_FIG_MIN_SHOW) {
    var op = ' opacity="' + r.finger.toFixed(2) + '"';
    out.push(_sfLine(P(aN.mid), P(p.fingerTip), SALAH_FIG_HAND.finger + 0.9, '--salah-edge', op));
    out.push(_sfLine(P(aN.mid), P(p.fingerTip), SALAH_FIG_HAND.finger, '--salah-skin', op));
  }

  // Gold rings on the detail that matters
  var ringAt = { handN: aN.mid, finger: p.fingerTip, forehead: p.forehead,
    kneeN: [p.legN.knee[0], p.legN.knee[1] - HW.thigh * 0.6], toeN: p.legN.toe, seat: [p.hip[0], p.hip[1] - HW.torso * 0.6] };
  SALAH_FOCUS_KEYS.forEach(function (k) {
    if (r.focus[k] < SALAH_FIG_MIN_SHOW) return;
    var c = P(ringAt[k]);
    out.push('<circle cx="' + _sfNum(c[0]) + '" cy="' + _sfNum(c[1]) + '" r="7.5" fill="none" style="stroke:var(--salah-ring)"' +
      ' stroke-width="1.3" opacity="' + (r.focus[k] * 0.95).toFixed(2) + '"/>');
  });
  // Salām: the face turns from the qibla (left) a quarter round the head:
  // to the right is towards the viewer, drawn solid in front; to the left is
  // away, dashed behind.
  if (Math.abs(r.turn) > SALAH_FIG_MIN_SHOW) {
    var op = (Math.abs(r.turn) * 0.95).toFixed(2);
    var right = r.turn > 0;
    var R = SALAH_FIG_TURN;
    var end = [hc[0], hc[1] + (right ? R.ry : -R.ry)];
    out.push('<path d="M ' + _sfNum(hc[0] - R.rx) + ' ' + _sfNum(hc[1]) + ' A ' + R.rx + ' ' + R.ry + ' 0 0 ' + (right ? 0 : 1) + ' ' +
      _sfNum(end[0]) + ' ' + _sfNum(end[1]) + '" fill="none" style="stroke:var(--salah-ring)" stroke-width="1.4"' +
      ' stroke-linecap="round"' + (right ? '' : ' stroke-dasharray="2.5 2"') + ' opacity="' + op + '"/>');
    out.push(_sfArrowHead(end, 1, 0, op));
  }
  return '<svg class="salah-fig" viewBox="0 0 ' + V.w + ' ' + V.h + '" role="img" aria-label="' + String(label).replace(/"/g, '&quot;') + '">' +
    out.join('') + '</svg>';
}

/**
 * The figure in one position as a learner of this madhab does it: the
 * position's first step in the madhab's prayer (js/salah/salah-walk.js), so
 * the hands, the way of sitting and the salām follow the madhab.
 */
function salahFigureSvg(poseId, madhab) {
  var step = getSalahWalkSteps(madhab).filter(function (s) { return s.pose === poseId; })[0];
  if (!step) return '';
  return _salahFrameSvg(salahWalkFrame(step, madhab), t('salah.step.' + poseId));
}

function _sfReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shows the figure in `host`, playing through `steps` ([{ id, frame, label,
 * hold }], hold in ms, else SALAH_FIG_HOLD_MS) unless opts.autoplay is false
 * or the reader prefers reduced motion, when it stays still. show(id) moves
 * to a step and stops the playing; move(+1 or -1) goes to the next or
 * previous step and stops; play() and pause() start and stop the playing.
 * opts.onStep(id, playing) is told each time the figure heads for a new
 * step or starts or stops playing.
 */
function mountSalahFigure(host, steps, opts) {
  opts = opts || {};
  var still = _sfReducedMotion();
  var playing = opts.autoplay !== false && !still;
  var cur = 0;
  var route = [steps[0].frame, steps[0].frame];
  var shown = steps[0].frame;
  var start = 0;
  var raf = 0;
  var hold = 0;

  function draw(f) { shown = f; host.innerHTML = _salahFrameSvg(f, steps[cur].label); }
  function wait() { hold = setTimeout(function () { goTo((cur + 1) % steps.length); }, steps[cur].hold || SALAH_FIG_HOLD_MS); }
  function step(now) {
    if (!start) start = now;
    var k = Math.min(1, (now - start) / (SALAH_FIG_MOVE_MS * (route.length - 1)));
    draw(salahPathAt(route, k));
    if (k < 1) { raf = requestAnimationFrame(step); return; }
    raf = 0;
    if (playing) wait();
  }
  function tell() { if (opts.onStep) opts.onStep(steps[cur].id, playing); }
  function goTo(i) {
    cancelAnimationFrame(raf);
    clearTimeout(hold);
    route = salahMotionPath(shown, steps[i].frame);
    cur = i;
    tell();
    if (still) { draw(steps[i].frame); return; }
    start = 0;
    raf = requestAnimationFrame(step);
  }

  draw(steps[0].frame);
  tell();
  if (playing) wait();
  return {
    show: function (id) {
      var i = steps.map(function (s) { return s.id; }).indexOf(id);
      if (i < 0) return;
      playing = false;
      goTo(i);
    },
    move: function (by) {
      playing = false;
      goTo((cur + by + steps.length) % steps.length);
    },
    play: function () {
      if (playing) return;
      playing = true;
      goTo((cur + 1) % steps.length);
    },
    pause: function () {
      playing = false;
      clearTimeout(hold);
      tell();
    },
    destroy: function () {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(hold);
    },
  };
}
