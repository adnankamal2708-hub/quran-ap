#!/usr/bin/env node
/**
 * salah-walk.test.js — The walkthrough shows every step of a two-rakʿah prayer
 *
 * Fails if a rakʿah loses a prostration or the sitting between them, a step
 * is missing a label or caption, the hands are raised for the wrong madhab,
 * the way down, the sitting of rest, the sitting forms or the number of
 * salāms do not follow the learner's madhab, or a step's figure is broken.
 *
 * Run: node test/salah-walk.test.js
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

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

var MADHABS = ['hanafi', 'maliki', 'shafii', 'hanbali', 'unsure'];
function kinds(m, part) {
  return getSalahWalkSteps(m).filter(function (s) { return !part || s.part === part; }).map(function (s) { return s.kind; });
}
function step(m, id) { return getSalahWalkSteps(m).filter(function (s) { return s.id === id; })[0]; }
function pts(m, s) { return salahFigurePoints(salahWalkFrame(s, m)).pts; }

console.log('salah-walk');

test('two rakʿahs, then the ending, in that order', function () {
  MADHABS.forEach(function (m) {
    var parts = getSalahWalkSteps(m).map(function (s) { return s.part; });
    var order = parts.filter(function (p, i) { return parts.indexOf(p) === i; });
    assert.deepStrictEqual(order, ['r1', 'r2', 'end'], m);
  });
});

test('the first rakʿah opens with standing, the takbīr and the recitation', function () {
  MADHABS.forEach(function (m) {
    assert.deepStrictEqual(kinds(m, 'r1').slice(0, 3), ['stand', 'takbir', 'qiyam'], m);
    assert.strictEqual(kinds(m, 'r2')[0], 'qiyam2', m);
    assert.strictEqual(kinds(m).filter(function (k) { return k === 'takbir'; }).length, 1, m + ': one opening takbīr');
  });
});

test('each rakʿah: bow, rise, go down, two prostrations with a sitting between', function () {
  MADHABS.forEach(function (m) {
    ['r1', 'r2'].forEach(function (part) {
      var k = kinds(m, part).filter(function (x) { return ['stand', 'takbir', 'raiseBow', 'raiseUp', 'rest'].indexOf(x) < 0; });
      assert.deepStrictEqual(k.slice(1), ['ruku', 'itidal', 'down', 'sujud1', 'jalsa', 'sujud2'], m + ' ' + part);
    });
    var sujud = getSalahWalkSteps(m).filter(function (s) { return s.pose === 'sujud'; });
    assert.strictEqual(sujud.length, 4, m + ': four prostrations');
  });
});

test('Shāfiʿī and Ḥanbalī raise the hands before and after each bow; the others do not', function () {
  MADHABS.forEach(function (m) {
    var raises = ['shafii', 'hanbali'].indexOf(m) >= 0;
    ['r1', 'r2'].forEach(function (part) {
      var k = kinds(m, part);
      var bow = k.indexOf('ruku');
      if (raises) {
        assert.strictEqual(k[bow - 1], 'raiseBow', m + ' ' + part);
        assert.strictEqual(k[bow + 1], 'raiseUp', m + ' ' + part);
      } else {
        assert.strictEqual(k.indexOf('raiseBow') + k.indexOf('raiseUp'), -2, m + ' ' + part);
      }
    });
  });
});

test('going down: Mālikī hands first, the others knees first', function () {
  MADHABS.forEach(function (m) {
    var s = step(m, 'r1-down');
    var p = pts(m, s);
    if (m === 'maliki') {
      assert.strictEqual(s.pose, 'handsDown');
      assert.ok(p.armN.wr[1] < 8, 'hands on the ground');
      assert.ok(p.legN.knee[1] > SALAH_FIG_HW.thigh + 10, 'knees still up');
    } else {
      assert.strictEqual(s.pose, 'kneel', m);
      assert.ok(p.legN.knee[1] < SALAH_FIG_HW.thigh + 1, m + ': knees down');
      assert.ok(p.armN.wr[1] > 20, m + ': hands not yet down');
    }
  });
});

test('the sitting of rest is Shāfiʿī only, after the first rakʿah', function () {
  MADHABS.forEach(function (m) {
    var k = kinds(m);
    if (m === 'shafii') assert.deepStrictEqual(kinds(m, 'r1').slice(-2), ['sujud2', 'rest']);
    else assert.strictEqual(k.indexOf('rest'), -1, m);
  });
});

test('sitting forms: Mālikī tawarruk always; Shāfiʿī tawarruk at the end; the rest iftirāsh', function () {
  var expect = { hanafi: ['iftirash', 'iftirash'], maliki: ['tawarruk', 'tawarruk'], shafii: ['iftirash', 'tawarruk'],
    hanbali: ['iftirash', 'iftirash'], unsure: ['iftirash', 'iftirash'] };
  MADHABS.forEach(function (m) {
    assert.deepStrictEqual([step(m, 'r1-jalsa').sit, step(m, 'end-tashahhud').sit], expect[m], m);
    assert.strictEqual(step(m, 'r2-jalsa').sit, expect[m][0], m);
  });
});

test('tawarruk sits lower, on the hip, than iftirāsh', function () {
  var ift = pts('hanafi', step('hanafi', 'end-tashahhud'));
  var taw = pts('shafii', step('shafii', 'end-tashahhud'));
  assert.ok(taw.hip[1] < ift.hip[1] - 3, 'hip ' + taw.hip[1].toFixed(1) + ' vs ' + ift.hip[1].toFixed(1));
  assert.ok(taw.hip[1] - SALAH_FIG_HW.torso < 1, 'the hip is on the ground');
});

test('salām: two, right then left; Mālikī one, to the right', function () {
  MADHABS.forEach(function (m) {
    var salams = getSalahWalkSteps(m).filter(function (s) { return s.pose === 'taslim'; });
    var turns = salams.map(function (s) { return s.turn; });
    assert.deepStrictEqual(turns, m === 'maliki' ? [1] : [1, -1], m);
    salams.forEach(function (s) { assert.strictEqual(salahWalkFrame(s, m)[15], s.turn, m + ' frame turn'); });
  });
});

test('every step has a unique id, a label and a caption', function () {
  MADHABS.forEach(function (m) {
    var ids = {};
    getSalahWalkSteps(m).forEach(function (s) {
      assert.ok(!ids[s.id], m + ': ' + s.id + ' twice');
      ids[s.id] = true;
      [salahWalkLabelKey(s), salahWalkCaptionKey(s, m)].forEach(function (key) {
        assert.notStrictEqual(t(key), key, m + ': missing ' + key);
      });
    });
    ['r1', 'r2', 'end'].forEach(function (p) { assert.notStrictEqual(t('salah.walk.part.' + p), 'salah.walk.part.' + p); });
  });
});

test('captions follow the madhab where it differs', function () {
  function cap(m, id) { return t(salahWalkCaptionKey(step(m, id), m)); }
  assert.ok(/below the navel/.test(cap('hanafi', 'r1-qiyam')));
  assert.strictEqual(cap('hanbali', 'r1-qiyam'), cap('hanafi', 'r1-qiyam'));
  assert.ok(/above the navel/.test(cap('shafii', 'r1-qiyam')));
  assert.ok(/sides/.test(cap('maliki', 'r1-qiyam')));
  assert.ok(/hands on the ground before your knees/.test(cap('maliki', 'r1-down')));
  assert.ok(/knees first/.test(cap('hanafi', 'r1-down')));
  assert.ok(/hip/.test(cap('maliki', 'r1-jalsa')));
  assert.ok(/hip/.test(cap('shafii', 'end-tashahhud')));
  assert.ok(!/hip/.test(cap('hanbali', 'end-tashahhud')));
  assert.ok(/at least once/.test(cap('hanbali', 'r1-jalsa')));
});

test('every step draws a whole figure, hands never through the mat', function () {
  MADHABS.forEach(function (m) {
    getSalahWalkSteps(m).forEach(function (s) {
      var f = salahWalkFrame(s, m);
      f.forEach(function (v, i) { assert.ok(isFinite(v), m + ' ' + s.id + ' [' + i + ']'); });
      var p = pts(m, s);
      [p.armN.wr, p.armF.wr, p.armN.tip, p.armF.tip].forEach(function (q) {
        assert.ok(q[1] > -1, m + ' ' + s.id + ': a hand goes through the mat');
      });
    });
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
