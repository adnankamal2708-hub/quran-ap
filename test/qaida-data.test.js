#!/usr/bin/env node
/**
 * qaida-data.test.js — Unit tests for the Qaida letter and mark data
 *
 * Tests: the 28 letters, letter forms, skill ids, every name in the
 * strings file, and qaidaWordSkills() on real Quran words.
 *
 * Run: node test/qaida-data.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-marks.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e));
  }
}

console.log('\n📋 Qaida letters');

test('there are 28 letters with unique ids and characters', function () {
  assert.strictEqual(QAIDA_LETTERS.length, 28);
  var ids = {}, chars = {};
  QAIDA_LETTERS.forEach(function (l) {
    assert.ok(!ids[l.id], 'duplicate id ' + l.id);
    assert.ok(!chars[l.char], 'duplicate char ' + l.id);
    ids[l.id] = chars[l.char] = true;
  });
});

test('exactly the six letters ا د ذ ر ز و never join forward', function () {
  var nonJoining = QAIDA_LETTERS.filter(function (l) { return !l.joins; }).map(function (l) { return l.char; }).join('');
  assert.strictEqual(nonJoining, 'ادذرزو');
});

test('every letter shares its shape group with the letters drawn the same way', function () {
  var group = {};
  QAIDA_LETTERS.forEach(function (l) { (group[l.group] = group[l.group] || []).push(l.id); });
  assert.deepStrictEqual(group.ba, ['ba', 'ta', 'tha']);
  assert.deepStrictEqual(group.jim, ['jim', 'hha', 'kha']);
  assert.deepStrictEqual(group.sad, ['sad', 'dad']);
});

test('letter forms use joiners, never presentation-form code points', function () {
  QAIDA_LETTERS.forEach(function (l) {
    ['isolated', 'initial', 'medial', 'final'].forEach(function (pos) {
      var f = qaidaLetterForm(l, pos);
      assert.ok(f.indexOf(l.char) >= 0, l.id + ' ' + pos);
      Array.from(f).forEach(function (c) {
        var cp = c.codePointAt(0);
        assert.ok(!(cp >= 0xFB50 && cp <= 0xFDFF) && !(cp >= 0xFE70 && cp <= 0xFEFF), l.id + ' ' + pos);
      });
    });
  });
});

test('a non-joining letter looks alone at the start of a word', function () {
  assert.strictEqual(qaidaLetterForm(getQaidaLetter('dal'), 'initial'), 'د');
  assert.strictEqual(qaidaLetterForm(getQaidaLetter('ba'), 'initial'), 'ب‍');
});

console.log('\n📋 Qaida skills and names');

test('skill ids are unique: 28 letters then the marks', function () {
  assert.strictEqual(QAIDA_SKILL_IDS.length, 28 + QAIDA_MARKS.length);
  assert.strictEqual(new Set(QAIDA_SKILL_IDS).size, QAIDA_SKILL_IDS.length);
  assert.ok(QAIDA_SKILL_IDS.length <= 62, 'masks are stored in two 31-bit halves');
});

test('every letter and mark has a name, and every mark a description', function () {
  QAIDA_LETTERS.forEach(function (l) {
    assert.notStrictEqual(t('qaida.letter.' + l.id + '.name'), 'qaida.letter.' + l.id + '.name', l.id);
  });
  QAIDA_MARKS.forEach(function (m) {
    assert.notStrictEqual(t('qaida.mark.' + m.id + '.name'), 'qaida.mark.' + m.id + '.name', m.id);
    assert.notStrictEqual(t('qaida.mark.' + m.id + '.desc'), 'qaida.mark.' + m.id + '.desc', m.id);
  });
});

console.log('\n📋 qaidaWordSkills');

function skills(w) { return qaidaWordSkills(w).slice().sort(); }

test('بِسۡمِ needs ba, sin, mim, kasra and sukun', function () {
  assert.deepStrictEqual(skills('بِسۡمِ'), ['ba', 'kasra', 'mim', 'sin', 'sukun']);
});

test('ٱللَّهِ needs waṣl, lam, ha, shadda, fatha, kasra', function () {
  assert.deepStrictEqual(skills('ٱللَّهِ'), ['fatha', 'ha', 'kasra', 'lam', 'shadda', 'wasl']);
});

test('a letter of madd after a vowel needs long-vowels (قَالَ)', function () {
  assert.ok(qaidaWordSkills('قَالَ').indexOf('long-vowels') >= 0);
});

test('a word-initial alif is not a long vowel (أَ…)', function () {
  assert.strictEqual(qaidaWordSkills('أَنتَ').indexOf('long-vowels'), -1);
});

test('a superscript alif is a long vowel (ٱلرَّحۡمَٰنِ)', function () {
  assert.ok(qaidaWordSkills('ٱلرَّحۡمَٰنِ').indexOf('long-vowels') >= 0);
});

test('pause signs need no skill', function () {
  assert.deepStrictEqual(qaidaWordSkills('ۖ'), []);
});

test('every Arabic code point in the Quran text is either a skill or a known sign', function () {
  global.window = {};
  new Function(fs.readFileSync(path.join(__dirname, '..', 'js', 'quran', 'quran-data.js'), 'utf8'))();
  var text = global.window.__QURAN_TEXT;
  var unknown = {};
  Object.keys(text).forEach(function (sid) {
    text[sid].verses.forEach(function (v) {
      Array.from(v.text).forEach(function (c) {
        var cp = c.codePointAt(0);
        if (cp < 0x0600 || cp > 0x06FF) return;
        var isSign = c === 'ـ' || c === 'ٜ' || (cp >= 0x06D6 && cp <= 0x06ED);
        if (!isSign && !_QAIDA_CHAR_SKILLS[c]) unknown['U+' + cp.toString(16).toUpperCase()] = true;
      });
    });
  });
  assert.deepStrictEqual(Object.keys(unknown), []);
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-data.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
