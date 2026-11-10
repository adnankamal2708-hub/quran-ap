#!/usr/bin/env node
/**
 * word-meanings.test.js — every word of the Quran shows its meaning
 *
 *  W1 — scripts/word-meanings.js lines the source up with the app's text:
 *       all 77,429 words, no errors, no empty meaning.
 *  W2 — the alignment refuses words it can't match with certainty.
 *  W3 — the reader draws a meaning under every word, keeps the verse text
 *       unchanged, and a repeated lesson word keeps its link every time.
 *
 * Run: node test/word-meanings.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var mock = require('./shared-mock');
mock.setup();

var ROOT = path.join(__dirname, '..');
var passed = 0, failed = 0;

function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name); console.log('     ' + (e.message || e).split('\n')[0]); }
}
function ts(name, fn) { console.log('\n📋 ' + name); fn(); }

global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/quran/quran-data.js'), 'utf8') + '\nglobal.__QT = QURAN_TEXT;');
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/data/occurrence-index.js'), 'utf8'));
var QT = global.__QT;
var norm = global.OCCURRENCE_INDEX_NORM;
var wm = require('../scripts/word-meanings.js');
var result = wm.alignWordMeanings(QT, wm.loadSource(), norm);

function verseMeanings(key) {
  var p = key.split(':');
  return result.bySurah[p[0]][p[1] - 1];
}

ts('W1 — the whole Quran lines up', function () {
  t('no alignment errors', function () {
    assert.deepStrictEqual(result.errors, []);
  });
  t('77,429 words, the figure the app uses', function () {
    assert.strictEqual(result.words, 77429);
    assert.strictEqual(result.words, global.OCCURRENCE_INDEX_TOTAL_TOKENS);
  });
  t('every word has a meaning or joins the word before it', function () {
    var bad = [];
    for (var s = 1; s <= 114; s++) {
      QT[s].verses.forEach(function (v, i) {
        var words = v.text.split(/\s+/).filter(Boolean);
        var m = result.bySurah[s][i];
        if (!m || m.length !== words.length) { bad.push(s + ':' + v.id + ' length'); return; }
        m.forEach(function (x, wi) {
          if (x === 0 && wi > 0) return;
          if (typeof x !== 'string' || !x.trim() || /[<>؀-ۿ]/.test(x)) bad.push(s + ':' + v.id + ':' + (wi + 1));
        });
      });
    }
    assert.deepStrictEqual(bad, []);
  });
  t('Al-Fatihah 1:1 and Al-Baqarah 2:3 read as published', function () {
    assert.deepStrictEqual(verseMeanings('1:1'), ['In (the) name', '(of) Allah', 'the Most Gracious', 'the Most Merciful']);
    assert.deepStrictEqual(verseMeanings('2:3'), ['Those who', 'believe', 'in the unseen', 'and establish', 'the prayer', 'and out of what', 'We have provided them', 'they spend']);
  });
  t('words split differently in the two texts keep one meaning', function () {
    assert.deepStrictEqual(verseMeanings('2:181').slice(2, 4), ['after what', 0]);   // بَعۡدَ مَا
    assert.deepStrictEqual(verseMeanings('37:130').slice(2, 4), ['Elijah', 0]);      // إِلۡ يَاسِينَ
    assert.deepStrictEqual(verseMeanings('2:72').slice(3, 5), ['then you disputed', 0]);
    assert.strictEqual(verseMeanings('36:22')[0], 'And what (is) for me');          // وَمَا + لِيَ
    assert.strictEqual(verseMeanings('15:7')[0], 'Why not');                         // لَّوۡ + مَا
  });
  t('the source file is checked against its checksum', function () {
    var src = fs.readFileSync(path.join(ROOT, 'scripts/word-meanings.js'), 'utf8');
    var readme = fs.readFileSync(path.join(ROOT, 'data-sources/README.md'), 'utf8');
    var sum = /SOURCE_SHA256 = '([0-9a-f]{64})'/.exec(src)[1];
    assert.ok(readme.indexOf(sum) >= 0, 'README lists the same checksum');
  });
});

ts('W2 — refuses what it cannot match', function () {
  var src = [['ٱلَّذِينَ', 'Those who'], ['يُؤۡمِنُونَ', 'believe']];
  t('a shifted word is an error', function () {
    assert.ok(wm.alignVerse('9:9', ['يُؤۡمِنُونَ', 'ٱلَّذِينَ'], src, norm, {}).error);
  });
  t('an extra word is an error', function () {
    assert.ok(wm.alignVerse('9:9', ['ٱلَّذِينَ', 'يُؤۡمِنُونَ', 'بِٱلۡغَيۡبِ'], src, norm, {}).error);
  });
  t('an empty meaning is an error', function () {
    assert.ok(wm.alignVerse('9:9', ['ٱلَّذِينَ'], [['ٱلَّذِينَ', ' ']], norm, {}).error);
  });
  t('matching words pass unchanged', function () {
    assert.deepStrictEqual(wm.alignVerse('9:9', ['ٱلَّذِينَ', 'يُؤۡمِنُونَ'], src, norm, {}).meanings, ['Those who', 'believe']);
  });
});

ts('W3 — the reader shows every meaning', function () {
  // Attach meanings as build.js does, then render Al-Baqarah
  for (var s = 1; s <= 114; s++) QT[s].verses.forEach(function (v, i) { v.w = result.bySurah[s][i]; });
  var harness = [
    'var __c = { _html: "" };',
    'Object.defineProperty(__c, "innerHTML", { get: function () { return this._html; }, set: function (v) { this._html = v || ""; } });',
    '__c.querySelectorAll = function () { return []; };',
    'var __saved = document; document = { getElementById: function (id) { return id === "quran-verses" ? __c : null; } };',
    'var __b = _buildVerseData(2, global.__QT[2], [{ id: "w_fi", arabic: "فِي", english: "in" }]);',
    '_quranAyahGroups = __b.ayahGroups; _quranVerseKeys = __b.verseKeys; _quranSurahId = 2;',
    'renderAyahs(); document = __saved; __c._html;',
  ].join('\n');
  var html = '';
  try {
    html = vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/ui/quran.js'), 'utf8') + '\n' + harness);
  } catch (e) { console.log('  ⚠ sandbox: ' + e.message); }

  function ayah(key) {
    var id = 'quran-ayah-' + key.replace(':', '-');
    var start = html.indexOf('id="' + id + '"');
    return html.slice(start, html.indexOf('quran-ayah-translation', start));
  }

  t('every word of 2:3 has its meaning, and the text is the verse text', function () {
    var a = ayah('2:3');
    var glosses = (a.match(/data-gloss="[^"]*"/g) || []).map(function (g) { return g.slice(12, -1); });
    assert.deepStrictEqual(glosses, verseMeanings('2:3'));
    var text = a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    assert.ok(text.indexOf(QT[2].verses[2].text) >= 0, 'verse text unchanged');
  });
  t('بَعۡدَ مَا in 2:181 is one word with one meaning', function () {
    assert.ok(/data-gloss="after what"[^>]*>بَعۡدَ مَا<\/span>/.test(ayah('2:181')));
  });
  t('every word in Al-Baqarah has a meaning', function () {
    assert.ok(html.length > 0);
    assert.ok(!/class="quran-plain-arabic"(?! has-gloss)>/.test(html), 'no word without a meaning');
  });
  t('a lesson word repeated in a verse is linked every time (2:255 فِي)', function () {
    var count = (ayah('2:255').match(/data-word-id="w_fi"/g) || []).length;
    var expected = QT[2].verses[254].text.split(/\s+/).filter(function (w) { return norm(w) === norm('فِي'); }).length;
    assert.ok(expected >= 2, 'test verse has the word twice');
    assert.strictEqual(count, expected);
  });
});

ts('W4 — Report a mistake', function () {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/i18n/strings-en.js'), 'utf8'));
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/ui/quran-word-panel.js'), 'utf8'));
  t('the report names the verse, the word and the meaning shown', function () {
    var text = global.quranWordReportText({ verseKey: '2:3', wordNum: 2, arabic: 'يُؤۡمِنُونَ', meaning: 'believe' });
    assert.strictEqual(text, 'Mistake in a word meaning. Verse 2:3, word 2: يُؤۡمِنُونَ, shown as "believe". What is wrong:\n');
  });
  t('the report stays under the feedback limit for a long meaning', function () {
    var text = global.quranWordReportText({ verseKey: '286:286', wordNum: 99, arabic: 'وَٱلَّـٰٓئِي', meaning: new Array(60).join('x') });
    assert.ok(text.length < 1700);
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
