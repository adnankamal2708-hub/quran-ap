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

/** Milliseconds to move between two positions, then to hold one */
var SALAH_FIG_MOVE_MS = 1000;
var SALAH_FIG_HOLD_MS = 2600;

/** Below this a blended value (a ring, the finger) is not drawn */
var SALAH_FIG_MIN_SHOW = 0.02;

function _sfNum(n) { return n.toFixed(1); }

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
  // Centre the figure on its own extent, so every position sits mid-mat;
  // then flip to SVG space (y down, facing left).
  var xs = [p.hip[0], p.sh[0], p.headC[0] - L.head, p.headC[0] + L.head, p.legN.knee[0], p.legN.toe[0],
    p.legF.toe[0], p.legN.ankle[0], aN.tip[0], aF.tip[0]];
  var dx = V.w / 2 - (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
  function P(q) { return [V.w - (q[0] + dx), V.ground - q[1]]; }

  var out = [];
  out.push('<rect x="' + V.matX + '" y="' + V.ground + '" width="' + V.matW + '" height="4" rx="2" style="fill:var(--salah-mat)"/>');
  out.push('<rect x="' + V.matX + '" y="' + V.ground + '" width="' + V.matW + '" height="1" style="fill:var(--gold)" opacity=".6"/>');
  // Limbs: an outline pass, then the fill, so joined parts read as one garment.
  function limbs(list) {
    list.forEach(function (s) { out.push(_sfLine(P(s[0]), P(s[1]), s[2] * 2 + 2.2, '--salah-edge')); });
    list.forEach(function (s) { out.push(_sfLine(P(s[0]), P(s[1]), s[2] * 2, s[3])); });
  }
  function hand(a, skin) { out.push(_sfLine(P(a.wr), P(a.tip), 4.6, skin)); }

  // The far side, a shade darker
  limbs([[p.sh, aF.el, HW.ua, '--salah-cloth-far'], [aF.el, aF.wr, HW.fa, '--salah-cloth-far'],
    [p.hip, p.legF.knee, HW.thigh, '--salah-cloth-far'], [p.legF.knee, p.legF.ankle, HW.shin, '--salah-cloth-far']]);
  out.push(_sfLine(P(p.legF.ankle), P(p.legF.toe), 5, '--salah-skin-far'));
  hand(aF, '--salah-skin-far');

  // Neck, then the thobe over the torso and near leg
  out.push(_sfLine(P(p.sh), P(p.neck), 7.5, '--salah-skin'));
  out.push(_sfLine(P(p.legN.ankle), P(p.legN.toe), 5, '--salah-skin'));
  limbs([[p.hip, p.sh, HW.torso, '--salah-cloth'], [p.hip, p.legN.knee, HW.thigh, '--salah-cloth'],
    [p.legN.knee, p.legN.ankle, HW.shin, '--salah-cloth']]);

  // The head: plain, with no face, and a kufi on top
  var hc = P(p.headC);
  out.push('<g class="salah-fig-head" transform="translate(' + _sfNum(hc[0]) + ' ' + _sfNum(hc[1]) + ') rotate(' + _sfNum(-r.head) + ')">' +
    '<circle r="' + L.head + '" style="fill:var(--salah-skin)"/>' +
    '<path d="M -11 -1 A 11 11 0 0 1 11 -1 L 11 0.8 L -11 0.8 Z" style="fill:var(--salah-kufi);stroke:var(--salah-edge)" stroke-width="0.8"/>' +
    '<path d="M -11 -0.6 L 11 -0.6" style="stroke:var(--gold)" stroke-width="1.1"/></g>');

  // The near (right) arm and hand, and the raised finger
  limbs([[p.sh, aN.el, HW.ua, '--salah-cloth'], [aN.el, aN.wr, HW.fa, '--salah-cloth']]);
  hand(aN, '--salah-skin');
  if (r.finger > SALAH_FIG_MIN_SHOW) {
    out.push(_sfLine(P(aN.mid), P(p.fingerTip), 2.2, '--salah-skin', ' opacity="' + r.finger.toFixed(2) + '"'));
  }

  // Gold rings on the detail that matters
  var ringAt = { handN: aN.mid, finger: p.fingerTip, forehead: p.forehead,
    kneeN: [p.legN.knee[0], p.legN.knee[1] - HW.thigh * 0.6], toeN: p.legN.toe };
  SALAH_FOCUS_KEYS.forEach(function (k) {
    if (r.focus[k] < SALAH_FIG_MIN_SHOW) return;
    var c = P(ringAt[k]);
    out.push('<circle cx="' + _sfNum(c[0]) + '" cy="' + _sfNum(c[1]) + '" r="7.5" fill="none" style="stroke:var(--salah-ring)"' +
      ' stroke-width="1.3" opacity="' + (r.focus[k] * 0.95).toFixed(2) + '"/>');
  });
  // Taslīm: an arc over the head, turning right then left
  if (r.turn > SALAH_FIG_MIN_SHOW) {
    var op = (r.turn * 0.95).toFixed(2);
    var a = [hc[0] - 15, hc[1] - 18];
    var b = [hc[0] + 15, hc[1] - 18];
    out.push('<path d="M ' + _sfNum(a[0]) + ' ' + _sfNum(a[1]) + ' q 15 -9 30 0" fill="none" style="stroke:var(--salah-ring)"' +
      ' stroke-width="1.3" stroke-linecap="round" opacity="' + op + '"/>');
    out.push(_sfArrowHead(a, -15, 9, op), _sfArrowHead(b, 15, 9, op));
  }
  return '<svg class="salah-fig" viewBox="0 0 ' + V.w + ' ' + V.h + '" role="img" aria-label="' + String(label).replace(/"/g, '&quot;') + '">' +
    out.join('') + '</svg>';
}

/** The figure in one position, for a learner of this madhab. */
function salahFigureSvg(poseId, madhab) {
  var pose = getSalahPoses(madhab).filter(function (p) { return p.id === poseId; })[0];
  if (!pose) return '';
  return _salahFrameSvg(salahPoseFrame(pose), t('salah.step.' + poseId));
}

function _sfReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Slow in, slow out */
function _sfEase(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

/**
 * Shows the figure in `host`. It plays through the positions of one rakʿah
 * unless opts.autoplay is false or the reader prefers reduced motion, when
 * it stays still. show(poseId) moves to a position and stops the playing.
 * opts.onPose(poseId) is told each time the figure heads for a new position.
 */
function mountSalahFigure(host, madhab, opts) {
  opts = opts || {};
  var poses = getSalahPoses(madhab);
  var frames = poses.map(salahPoseFrame);
  var still = _sfReducedMotion();
  var playing = opts.autoplay !== false && !still;
  var cur = 0;
  var from = frames[0];
  var shown = frames[0];
  var start = 0;
  var raf = 0;
  var hold = 0;

  function draw(f) { shown = f; host.innerHTML = _salahFrameSvg(f, t('salah.step.' + poses[cur].id)); }
  function step(now) {
    if (!start) start = now;
    var k = Math.min(1, (now - start) / SALAH_FIG_MOVE_MS);
    draw(salahBlendFrames(from, frames[cur], _sfEase(k)));
    if (k < 1) { raf = requestAnimationFrame(step); return; }
    raf = 0;
    if (playing) hold = setTimeout(function () { goTo((cur + 1) % poses.length); }, SALAH_FIG_HOLD_MS);
  }
  function goTo(i) {
    cancelAnimationFrame(raf);
    clearTimeout(hold);
    from = shown;
    cur = i;
    if (opts.onPose) opts.onPose(poses[i].id);
    if (still) { draw(frames[i]); return; }
    start = 0;
    raf = requestAnimationFrame(step);
  }

  draw(frames[0]);
  if (opts.onPose) opts.onPose(poses[0].id);
  if (playing) hold = setTimeout(function () { goTo(1); }, SALAH_FIG_HOLD_MS);
  return {
    show: function (poseId) {
      var i = poses.map(function (p) { return p.id; }).indexOf(poseId);
      if (i < 0) return;
      playing = false;
      goTo(i);
    },
    destroy: function () {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(hold);
    },
  };
}
