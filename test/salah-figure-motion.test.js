#!/usr/bin/env node
/**
 * salah-figure-motion.test.js — The prayer figure moves like a person
 *
 * Plays every move the figure can make (each position to every other, for
 * every madhab) and fails if a knee bends backwards, a limb spins round the
 * long way, a hand swings further back than where it starts or ends, or the
 * figure drops between standing and the ground without bending its knees
 * forward and kneeling first. The walkthrough's moves, step to step through
 * a whole prayer, are played too: knees go down before hands (Mālikī: hands
 * before knees) and no move stops on the same frame twice.
 *
 * Run: node test/salah-figure-motion.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/salah/salah-figure-poses.js');
load('js/salah/salah-figure-motion.js');
load('js/salah/salah-walk.js');

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

var MADHABS = ['hanafi', 'maliki', 'shafii', 'hanbali', 'unsure'];
var STEPS_PER_MOVE = 40;

/** Every move between two positions, for every madhab */
function everyMove() {
  var out = [];
  MADHABS.forEach(function (m) {
    var poses = getSalahPoses(m);
    poses.forEach(function (a) {
      poses.forEach(function (b) {
        if (a === b) return;
        out.push(play(m + ' ' + a.id + ' → ' + b.id, salahMotionPath(salahPoseFrame(a), salahPoseFrame(b))));
      });
    });
  });
  return out;
}
/** A move through its route, STEPS_PER_MOVE frames per stretch */
function play(name, route) {
  var frames = [];
  var n = STEPS_PER_MOVE * (route.length - 1);
  for (var i = 0; i <= n; i++) frames.push(salahPathAt(route, i / n));
  return { name: name, route: route, frames: frames };
}

/** Every move of the walkthrough: each step to the next, and the last back to the first */
function walkMoves() {
  var out = [];
  MADHABS.forEach(function (m) {
    var steps = getSalahWalkSteps(m);
    steps.forEach(function (s, i) {
      var next = steps[(i + 1) % steps.length];
      out.push(play('walk ' + m + ' ' + s.id + ' → ' + next.id, salahMotionPath(salahWalkFrame(s, m), salahWalkFrame(next, m))));
    });
  });
  return out;
}
var POSE_MOVES = everyMove();
var WALK_MOVES = walkMoves();
var MOVES = POSE_MOVES.concat(WALK_MOVES);

function wrap(a) { return ((a % 360) + 540) % 360 - 180; }
/** Each joint's bend in a frame: [index, the index it bends from (-1 = none)] */
var JOINTS = { torso: [0, -1], neck: [1, 0], hipN: [2, -1], kneeN: [3, 2], ankleN: [4, 3], hipF: [5, -1], kneeF: [6, 5],
  ankleF: [7, 6], shoulderN: [8, 0], elbowN: [9, 8], wristN: [16, 9], shoulderF: [11, 0], elbowF: [12, 11], wristF: [17, 12] };
function bend(f, j) { return j[1] < 0 ? f[j[0]] : f[j[0]] - f[j[1]]; }

console.log('salah-figure-motion');

test('the knees only bend forwards, never backwards', function () {
  MOVES.forEach(function (mv) {
    mv.frames.forEach(function (f) {
      [[2, 3], [5, 6]].forEach(function (k) {
        var bend = ((f[k[1]] - f[k[0]]) % 360 + 360) % 360;
        if (bend > 300) bend -= 360;
        assert.ok(bend >= -5 && bend <= 195, mv.name + ': knee bent ' + Math.round(bend));
      });
    });
  });
});

test('no joint spins round: each bends smoothly, less than half a circle per stretch', function () {
  MOVES.forEach(function (mv) {
    var per = STEPS_PER_MOVE;
    Object.keys(JOINTS).forEach(function (name) {
      for (var leg = 0; leg < mv.route.length - 1; leg++) {
        var turned = 0;
        for (var i = leg * per + 1; i <= (leg + 1) * per; i++) {
          var d = Math.abs(wrap(bend(mv.frames[i], JOINTS[name]) - bend(mv.frames[i - 1], JOINTS[name])));
          assert.ok(d < 30, mv.name + ': ' + name + ' jumped ' + Math.round(d));
          turned += d;
        }
        assert.ok(turned < 180, mv.name + ': ' + name + ' turned ' + Math.round(turned));
      }
    });
  });
});

/** How far a wrist is in front of the body: along the torso's forward side */
function wristAhead(f, armKey) {
  var p = salahFigurePoints(f).pts;
  var fwd = [Math.sin((f[0] + 90) * Math.PI / 180), Math.cos((f[0] + 90) * Math.PI / 180)];
  var w = p[armKey].wr;
  return (w[0] - p.sh[0]) * fwd[0] + (w[1] - p.sh[1]) * fwd[1];
}

test('the hands never swing further back than where they start or end', function () {
  MOVES.forEach(function (mv) {
    ['armN', 'armF'].forEach(function (arm) {
      var ends = mv.route.map(function (f) { return wristAhead(f, arm); });
      var least = Math.min.apply(null, ends);
      mv.frames.forEach(function (f, i) {
        var ahead = wristAhead(f, arm);
        assert.ok(ahead >= least - 3, mv.name + ': ' + arm + ' went back to ' + Math.round(ahead) + ' (ends ' + Math.round(least) + ') at ' + i);
      });
    });
  });
});

function hipHeight(f) { return salahFigurePoints(f).pts.hip[1]; }

test('between standing and the ground the figure kneels on the way', function () {
  POSE_MOVES.forEach(function (mv) {
    var a = hipHeight(mv.route[0]);
    var b = hipHeight(mv.route[mv.route.length - 1]);
    var crosses = (a > SALAH_STAND_HIP) !== (b > SALAH_STAND_HIP);
    assert.strictEqual(mv.route.length, crosses ? 4 : 2, mv.name + ': ' + mv.route.length + ' frames');
    if (!crosses) return;
    var kneel = salahFigurePoints(mv.route[a > b ? 2 : 1]).pts;
    assert.ok(kneel.legN.knee[1] < SALAH_FIG_HW.thigh + 1, mv.name + ': the knee is down when kneeling');
    assert.ok(kneel.headC[1] > kneel.sh[1], mv.name + ': the head is up when kneeling');
    var crouch = salahFigurePoints(mv.route[a > b ? 1 : 2]).pts;
    assert.ok(crouch.legN.knee[0] > crouch.hip[0] + 20, mv.name + ': the knees come forward before kneeling');
    assert.ok(Math.abs(crouch.legN.toe[1] - crouch.legN.ankle[1]) < 3, mv.name + ': the feet stay flat while crouching');
  });
});

function body(f) { return f.slice(0, 18); }
test('no walkthrough move stops on the same frame twice', function () {
  WALK_MOVES.forEach(function (mv) {
    for (var i = 1; i < mv.route.length; i++) {
      var same = body(mv.route[i]).every(function (v, k) { return Math.abs(wrap(v - mv.route[i - 1][k])) < 0.5; });
      assert.ok(!same, mv.name + ': frames ' + (i - 1) + ' and ' + i + ' are the same');
    }
  });
});

test('going down: knees touch before hands (Mālikī: hands before knees)', function () {
  MADHABS.forEach(function (m) {
    var steps = getSalahWalkSteps(m);
    var from = steps.map(function (s) { return s.id; }).indexOf('r1-itidal');
    var frames = [];
    for (var i = from; i < from + 3; i++) {
      frames = frames.concat(play('', salahMotionPath(salahWalkFrame(steps[i], m), salahWalkFrame(steps[i + 1], m))).frames);
    }
    function first(test) { for (var k = 0; k < frames.length; k++) if (test(salahFigurePoints(frames[k]).pts)) return k; return -1; }
    var hands = first(function (p) { return p.armN.wr[1] < 8; });
    var knees = first(function (p) { return p.legN.knee[1] < SALAH_FIG_HW.thigh + 1; });
    assert.ok(hands >= 0 && knees >= 0, m + ': both reach the ground');
    if (m === 'maliki') assert.ok(hands < knees, m + ': hands ' + hands + ', knees ' + knees);
    else assert.ok(knees < hands, m + ': knees ' + knees + ', hands ' + hands);
  });
});

test('a move starts and ends exactly on its positions', function () {
  MOVES.forEach(function (mv) {
    assert.deepStrictEqual(salahPathAt(mv.route, 0), mv.route[0], mv.name + ' start');
    mv.frames[mv.frames.length - 1].forEach(function (v, k) {
      assert.ok(Math.abs(wrap(v - mv.route[mv.route.length - 1][k])) < 1e-6, mv.name + ' end ' + k);
    });
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
