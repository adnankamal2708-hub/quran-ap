#!/usr/bin/env node
/**
 * salah-figure.test.js — The prayer figure's poses and drawing
 *
 * Fails if a pose draws NaN or floats above / sinks below the mat, a
 * position shows the wrong body (hands off the knees in rukūʿ, any of the
 * seven points off the ground in sujūd), a madhab gets the wrong hands or
 * raisings, reduced motion still animates, or the head carries any face.
 *
 * Run: node test/salah-figure.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/salah/salah-figure-poses.js');
load('js/salah/salah-figure-motion.js');
load('js/salah/salah-walk.js');
load('js/ui/salah-figure-parts.js');
load('js/ui/salah-figure.js');

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

var MADHABS = ['hanafi', 'maliki', 'shafii', 'hanbali', 'unsure'];
function points(id, madhab) {
  var pose = getSalahPoses(madhab).filter(function (p) { return p.id === id; })[0];
  return salahFigurePoints(salahPoseFrame(pose)).pts;
}
function dist(a, b) { return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)); }

console.log('salah-figure');

test('the pose ids are the prayer steps', function () {
  assert.deepStrictEqual(SALAH_POSE_IDS, ['takbir', 'qiyam', 'ruku', 'itidal', 'sujud', 'jalsa', 'tashahhud', 'taslim']);
});

test('every pose of every madhab draws an svg with no NaN', function () {
  MADHABS.forEach(function (m) {
    getSalahPoses(m).forEach(function (p) {
      var svg = salahFigureSvg(p.id, m);
      assert.ok(svg.indexOf('<svg') === 0, m + ' ' + p.id);
      assert.ok(svg.indexOf('NaN') < 0, m + ' ' + p.id + ' has NaN');
      assert.ok(/role="img" aria-label="[^"]+"/.test(svg), m + ' ' + p.id + ' label');
    });
  });
});

test('the lowest point of every pose sits on the ground', function () {
  MADHABS.forEach(function (m) {
    getSalahPoses(m).forEach(function (p) {
      var low = salahFigureLowest(salahFigureBody(p));
      var pts = salahFigurePoints(salahPoseFrame(p)).pts;
      // hip is at the body origin, so its shifted height is -low
      assert.ok(Math.abs(pts.hip[1] + low) < 0.5, m + ' ' + p.id);
      var surfaces = [pts.hip[1] - SALAH_FIG_HW.torso, pts.headC[1] - SALAH_FIG_LEN.head];
      [pts.legN, pts.legF].forEach(function (g) {
        surfaces.push(g.knee[1] - SALAH_FIG_HW.thigh, g.ankle[1] - SALAH_FIG_HW.shin * 0.7, g.toe[1] - 3);
      });
      var lowest = Math.min.apply(null, surfaces);
      assert.ok(Math.abs(lowest) <= 0.5, m + ' ' + p.id + ' lowest surface at ' + lowest);
    });
  });
});

test('in rukūʿ the near palm rests on the near knee', function () {
  var p = points('ruku', 'hanafi');
  assert.ok(dist(p.armN.mid, p.legN.knee) <= SALAH_FIG_HW.thigh + 6, dist(p.armN.mid, p.legN.knee));
});

test('in sujūd forehead, palm, knee and toes are on the ground', function () {
  MADHABS.forEach(function (m) {
    var p = points('sujud', m);
    assert.ok(p.forehead[1] <= 3, m + ' forehead ' + p.forehead[1]);
    assert.ok(p.armN.mid[1] <= 3, m + ' palm ' + p.armN.mid[1]);
    assert.ok(p.legN.knee[1] - SALAH_FIG_HW.thigh <= 3, m + ' knee');
    assert.ok(p.legN.toe[1] - 3 <= 3, m + ' toe');
  });
});

test('qiyām hands: Mālikī at the sides, Ḥanafī below the Shāfiʿī hands', function () {
  var maliki = points('qiyam', 'maliki');
  var hanafi = points('qiyam', 'hanafi');
  var shafii = points('qiyam', 'shafii');
  assert.ok(maliki.armN.wr[1] < maliki.hip[1], 'maliki wrists below the hip');
  assert.ok(shafii.armN.wr[1] > shafii.hip[1], 'shafii wrists above the hip');
  assert.ok(hanafi.armN.wr[1] > hanafi.hip[1] && hanafi.armN.wr[1] < shafii.armN.wr[1], 'hanafi low');
  assert.strictEqual(points('qiyam', 'hanbali').armN.wr[1], hanafi.armN.wr[1]);
  assert.strictEqual(points('qiyam', 'unsure').armN.wr[1], shafii.armN.wr[1]);
});

test('Shāfiʿī and Ḥanbalī raise the hands before and after the bow; the others do not', function () {
  function ids(m) { return getSalahPoses(m).map(function (p) { return p.id; }); }
  ['shafii', 'hanbali'].forEach(function (m) {
    assert.deepStrictEqual(ids(m), ['takbir', 'qiyam', 'raise', 'ruku', 'raise', 'itidal', 'sujud', 'jalsa', 'tashahhud', 'taslim'], m);
  });
  ['hanafi', 'maliki', 'unsure'].forEach(function (m) { assert.deepStrictEqual(ids(m), SALAH_POSE_IDS, m); });
  assert.notStrictEqual(t('salah.step.raise'), 'salah.step.raise');
});

test('the head has no face: one circle and the kufi only', function () {
  MADHABS.forEach(function (m) {
    getSalahPoses(m).forEach(function (p) {
      var head = salahFigureSvg(p.id, m).match(/<g class="salah-fig-head"[^>]*>([\s\S]*?)<\/g>/);
      assert.ok(head, m + ' ' + p.id + ' head group');
      var parts = head[1].match(/<[a-z]+/g);
      assert.deepStrictEqual(parts, ['<circle', '<path', '<path'], m + ' ' + p.id);
      assert.ok(/fill:var\(--salah-kufi\)/.test(head[1]) && /stroke:var\(--gold\)/.test(head[1]));
    });
  });
});

test('colours come from the theme properties, never fixed hex', function () {
  var svg = salahFigureSvg('sujud', 'hanafi');
  assert.ok(!/#[0-9a-f]{3,6}/i.test(svg), 'no hex colours in the drawing');
  var css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  ['--salah-cloth:', '--salah-edge:', '--salah-skin:', '--salah-kufi:', '--salah-mat:', '--salah-ring:'].forEach(function (v) {
    assert.strictEqual(css.split(v).length - 1, 2, v + ' in dark and light');
  });
});

function fakeHost() { return { innerHTML: '' }; }
function stepsOf(m) {
  return getSalahPoses(m).map(function (p) { return { id: p.id, frame: salahPoseFrame(p), label: t('salah.step.' + p.id) }; });
}
function stubTimers(reduce) {
  var calls = { raf: 0, timeouts: [] };
  global.matchMedia = function () { return { matches: reduce }; };
  global.requestAnimationFrame = function () { calls.raf++; return calls.raf; };
  global.cancelAnimationFrame = function () {};
  global.setTimeout = function (fn) { calls.timeouts.push(fn); return calls.timeouts.length; };
  global.clearTimeout = function () {};
  return calls;
}

test('reduced motion: the figure never animates, and show() jumps straight there', function () {
  var calls = stubTimers(true);
  var host = fakeHost();
  var seen = [];
  var fig = mountSalahFigure(host, stepsOf('shafii'), { onStep: function (id) { seen.push(id); } });
  assert.ok(host.innerHTML.indexOf('<svg') === 0);
  assert.strictEqual(calls.timeouts.length, 0, 'no autoplay');
  fig.show('sujud');
  assert.strictEqual(calls.raf, 0, 'requestAnimationFrame never called');
  assert.ok(host.innerHTML.indexOf('aria-label="' + t('salah.step.sujud')) > 0);
  assert.deepStrictEqual(seen, ['takbir', 'sujud']);
  fig.destroy();
});

test('with motion: it holds, then moves with requestAnimationFrame; show() stops the playing', function () {
  var calls = stubTimers(false);
  var host = fakeHost();
  var fig = mountSalahFigure(host, stepsOf('hanafi'));
  assert.strictEqual(calls.timeouts.length, 1, 'holds the first position');
  calls.timeouts[0]();
  assert.strictEqual(calls.raf, 1, 'moves on');
  fig.show('ruku');
  assert.strictEqual(calls.raf, 2);
  fig.destroy();
  var none = mountSalahFigure(fakeHost(), stepsOf('hanafi'), { autoplay: false });
  assert.strictEqual(calls.timeouts.length, 1, 'autoplay false never schedules');
  none.destroy();
});

test('move() steps forward and back and stops; pause() and play() say so', function () {
  stubTimers(true);
  var seen = [];
  var fig = mountSalahFigure(fakeHost(), stepsOf('hanafi'), { onStep: function (id, playing) { seen.push(id + ':' + playing); } });
  fig.move(1);
  fig.move(-1);
  fig.move(-1);
  fig.play();
  fig.pause();
  var last = stepsOf('hanafi').slice(-1)[0].id;
  assert.deepStrictEqual(seen, ['takbir:false', 'qiyam:false', 'takbir:false', last + ':false', 'takbir:true', 'takbir:false']);
  fig.destroy();
});

test('a step holds for its own time, else the default', function () {
  var calls = stubTimers(false);
  var waits = [];
  global.setTimeout = function (fn, ms) { waits.push(ms); calls.timeouts.push(fn); return calls.timeouts.length; };
  var steps = stepsOf('hanafi');
  steps[0].hold = 9000;
  mountSalahFigure(fakeHost(), steps).destroy();
  mountSalahFigure(fakeHost(), stepsOf('hanafi')).destroy();
  assert.deepStrictEqual(waits, [9000, SALAH_FIG_HOLD_MS]);
});

test('salām: the arrow turns to the near side (right, solid) or the far side (left, dashed)', function () {
  var pose = getSalahPoses('hanafi').filter(function (p) { return p.id === 'taslim'; })[0];
  var right = salahPoseFrame(pose);
  var left = right.slice();
  left[15] = -1;
  assert.ok(_salahFrameSvg(right, 'r').indexOf('stroke-dasharray') < 0, 'right is solid');
  assert.ok(_salahFrameSvg(left, 'l').indexOf('stroke-dasharray') > 0, 'left is dashed');
});

test('a lesson\'s still figure follows the madhab: takbīr height, sitting form, salām', function () {
  assert.notStrictEqual(salahFigureSvg('takbir', 'hanafi'), salahFigureSvg('takbir', 'shafii'), 'takbīr');
  assert.notStrictEqual(salahFigureSvg('jalsa', 'maliki'), salahFigureSvg('jalsa', 'hanafi'), 'sitting between');
  assert.notStrictEqual(salahFigureSvg('tashahhud', 'shafii'), salahFigureSvg('tashahhud', 'hanbali'), 'last sitting');
  assert.notStrictEqual(salahFigureSvg('taslim', 'maliki'), salahFigureSvg('taslim', 'hanafi'), 'salām sitting');
  assert.notStrictEqual(salahFigureSvg('qiyam', 'maliki'), salahFigureSvg('qiyam', 'shafii'), 'qiyām hands');
});

test('the toes stay planted: the near toe never moves sideways, in any move', function () {
  ['hanafi', 'maliki', 'shafii', 'hanbali'].forEach(function (m) {
    var steps = getSalahWalkSteps(m);
    var xs = [];
    steps.forEach(function (s, i) {
      var route = salahMotionPath(salahWalkFrame(s, m), salahWalkFrame(steps[(i + 1) % steps.length], m));
      for (var k = 0; k <= 20; k++) {
        var p = salahFigurePoints(salahPathAt(route, k / 20)).pts;
        xs.push(p.legN.toe[0] + salahFigureOffsetX(p));
      }
    });
    var spread = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    assert.ok(spread < 0.01, m + ': the toe slides ' + spread.toFixed(2));
  });
});

test('anchored on the toes, every position still fits on the mat', function () {
  ['hanafi', 'maliki', 'shafii', 'hanbali'].forEach(function (m) {
    getSalahWalkSteps(m).forEach(function (s) {
      var p = salahFigurePoints(salahWalkFrame(s, m)).pts;
      var dx = salahFigureOffsetX(p);
      var xs = [p.hip[0], p.sh[0], p.headC[0] - SALAH_FIG_LEN.head, p.headC[0] + SALAH_FIG_LEN.head, p.legN.toe[0], p.legF.toe[0],
        p.legN.knee[0], p.armN.tip[0], p.armF.tip[0]].map(function (x) { return SALAH_FIG_VIEW.w - (x + dx); });
      assert.ok(Math.min.apply(null, xs) >= SALAH_FIG_VIEW.matX, m + ' ' + s.id + ' off the left of the mat');
      assert.ok(Math.max.apply(null, xs) <= SALAH_FIG_VIEW.matX + SALAH_FIG_VIEW.matW, m + ' ' + s.id + ' off the right of the mat');
    });
  });
});

test('the hands have four fingers and a thumb, and the tashahhud raises the index', function () {
  var stand = _salahFrameSvg(salahWalkFrame(getSalahWalkSteps('hanafi')[0], 'hanafi'), 's');
  var sit = salahFigureSvg('tashahhud', 'hanafi');
  // each hand: palm + 4 fingers + thumb = 6 tapered parts, drawn twice (outline, fill), on two hands
  assert.ok(stand.split('var(--salah-skin)"').length - 1 >= 6, 'near hand parts');
  assert.ok(sit.split('<line').length > stand.split('<line').length, 'the raised index is drawn');
});

test('limbs taper: no part is drawn as a plain thick line', function () {
  var svg = salahFigureSvg('qiyam', 'shafii');
  assert.ok(!/stroke-width="(1[0-9]|2[0-9])/.test(svg), 'no blocky stroke');
});

var SIT_POSES = ['jalsa', 'tashahhud', 'taslim'];

test('the sittings are drawn bigger, round the toes, and still fit the view', function () {
  var V = SALAH_FIG_VIEW;
  ['hanafi', 'maliki', 'shafii', 'hanbali'].forEach(function (m) {
    getSalahWalkSteps(m).forEach(function (s) {
      var p = salahFigurePoints(salahWalkFrame(s, m)).pts;
      var z = salahFigureZoom(p);
      assert.strictEqual(z, SIT_POSES.indexOf(s.pose) >= 0 ? SALAH_FIG_SIT_ZOOM : 1, m + ' ' + s.id + ' zoom ' + z);
      var dx = salahFigureOffsetX(p);
      var ax = V.w - (p.legN.toe[0] + dx);
      function X(x) { return ax + (V.w - (x + dx) - ax) * z; }
      var R = SALAH_FIG_LEN.head;
      var xs = [X(p.headC[0] - R - SALAH_FIG_TURN.rx), X(p.headC[0] + R + SALAH_FIG_TURN.rx), X(p.legN.knee[0] + SALAH_FIG_HW.thigh),
        X(p.legF.toe[0]), X(p.armN.tip[0]), X(p.legN.toe[0] - 4)];
      assert.ok(Math.min.apply(null, xs) >= 0 && Math.max.apply(null, xs) <= V.w, m + ' ' + s.id + ' runs off the side');
      assert.ok(V.ground - (p.headC[1] + R) * z >= 4, m + ' ' + s.id + ' runs off the top');
    });
  });
  assert.ok(salahFigureSvg('jalsa', 'hanafi').indexOf('scale(' + SALAH_FIG_SIT_ZOOM + ')') > 0, 'the sitting is scaled');
  assert.ok(salahFigureSvg('qiyam', 'hanafi').indexOf('scale(') < 0, 'standing is not');
});

test('an upright foot bends its toes forward on the ground; a flat foot does not', function () {
  var sit = points('jalsa', 'hanafi');
  var stand = points('itidal', 'hanafi');
  assert.ok(salahFigureToeBend(sit.legN) > 0.9, 'the right foot stands upright in the sitting');
  assert.strictEqual(salahFigureToeBend(sit.legF), 0, 'the left foot lies flat under the seat');
  assert.strictEqual(salahFigureToeBend(stand.legN), 0, 'standing feet are flat');
  assert.ok(salahFigureSvg('jalsa', 'hanafi').indexOf('salah-fig-toes') > 0, 'the toes are drawn');
  assert.ok(salahFigureSvg('qiyam', 'hanafi').indexOf('salah-fig-toes') < 0, 'not when standing');
});

test('in tawarruk the left foot shows out under the right leg; in iftirash it does not', function () {
  assert.ok(salahFigureSvg('tashahhud', 'maliki').indexOf('salah-fig-sole') > 0, 'Mālikī last sitting');
  assert.ok(salahFigureSvg('tashahhud', 'shafii').indexOf('salah-fig-sole') > 0, 'Shāfiʿī last sitting');
  assert.ok(salahFigureSvg('tashahhud', 'hanafi').indexOf('salah-fig-sole') < 0, 'Ḥanafī sits on the left foot');
  assert.ok(salahFigureSvg('jalsa', 'shafii').indexOf('salah-fig-sole') < 0, 'Shāfiʿī between prostrations');
});

test('an unknown pose draws nothing', function () {
  assert.strictEqual(salahFigureSvg('nothing', 'hanafi'), '');
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
