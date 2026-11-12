#!/usr/bin/env node
/**
 * lesson-examples.test.js — every lesson example is the real verse
 *
 * Each lesson word shows one verse (ayahA, ayahT) under a reference
 * (verseKey). This checks them against the app's own Quran text, so a
 * made-up, reworded or misattributed example cannot come back:
 *   - the Arabic, without the highlight markup, is exactly the cited verse
 *   - the English is exactly that verse's translation
 *   - the highlight wraps whole words, and they are the word taught
 *   - every word has a Quran count; the hadith Names say they are not Quran words
 *
 * Run: node test/lesson-examples.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name); console.log('     ' + String(e.message || e).split('\n').slice(0, 12).join('\n     ')); }
}

global.window = global;
global.ALL_WORDS = [];
require('../build-files.js').getBuildFiles().DATA_FILES
  .filter(function (f) { return /^js\/data\//.test(f); })
  .forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }); });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/quran/quran-data.js'), 'utf8') + '\nglobal.__QT = QURAN_TEXT;');
var QT = global.__QT;
var N = global.OCCURRENCE_INDEX_NORM;
var WORDS = global.ALL_WORDS;
var HL = /<span class="ayah-highlight">([^<]*)<\/span>/g;

function verseOf(w) {
  var parts = String(w.verseKey).split(':').map(Number);
  var surah = QT[parts[0]];
  return surah && surah.verses[parts[1] - 1];
}
// Letters only, without the long vowels ا and و, so the Quran's spelling
// ٱلصَّلَوٰةَ matches the lesson's الصَّلَاةَ. Leading particles and al- are dropped.
function skeleton(arabic) {
  return N(arabic).replace(/^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل|ك)/, '').replace(/[اوى]/g, '');
}
function problems(check) {
  var out = [];
  WORDS.forEach(function (w, i) { var p = check(w, i); if (p) out.push(i + ' ' + w.arabic + ' (' + w.verseKey + '): ' + p); });
  return out;
}
function none(list) { assert.strictEqual(list.length, 0, list.length + ' found:\n' + list.slice(0, 10).join('\n')); }

console.log('\n📋 Lesson examples are real verses');
t('there are lesson words to check', function () { assert.ok(WORDS.length >= 1251); });

t('every reference is a real verse', function () {
  none(problems(function (w) { return verseOf(w) ? null : 'no such verse'; }));
});

t('every Arabic example is exactly its verse', function () {
  none(problems(function (w) {
    var v = verseOf(w);
    return v && w.ayahA.replace(/<\/?span[^>]*>/g, '') !== v.text ? 'differs from the verse' : null;
  }));
});

t('every English example is exactly that verse\'s translation', function () {
  none(problems(function (w) { var v = verseOf(w); return v && w.ayahT !== v.translation ? 'differs' : null; }));
});

t('the highlight wraps whole words of the verse', function () {
  none(problems(function (w) {
    var tokens = w.ayahA.replace(/<span class="ayah-highlight">|<\/span>/g, '\u0001').split(/\s+/);
    var marked = (w.ayahA.match(HL) || []).length;
    if (!marked) return 'nothing highlighted';
    var bad = tokens.some(function (tok) { return /\u0001/.test(tok) && !/^\u0001[^\u0001]+\u0001$/.test(tok); });
    return bad ? 'highlight splits a word' : null;
  }));
});

t('the highlighted words are the word taught', function () {
  none(problems(function (w) {
    if (w.hadithName) return null;
    var hl = []; w.ayahA.replace(HL, function (m, x) { hl.push(x); });
    var a = skeleton(w.arabic), h = skeleton(hl.join(' '));
    return a === h || h.indexOf(a) >= 0 || a.indexOf(h) >= 0 ? null : 'highlight is ' + hl.join(' ');
  }));
});

t('every word has a Quran count', function () {
  none(problems(function (w) { return typeof w.lemmaCount === 'number' && w.lemmaCount >= 0 ? null : 'lemmaCount missing'; }));
});

t('only the hadith Names have no Quran count, and they say so', function () {
  none(problems(function (w) {
    if (w.hadithName) return w.lemmaCount === 0 && /from the hadith/.test(w.meaning) ? null : 'Name not labelled';
    return w.lemmaCount > 0 ? null : 'count is 0';
  }));
});

t('the 23 hadith Names are the only words not in the Quran', function () {
  assert.strictEqual(WORDS.filter(function (w) { return w.hadithName; }).length, 23);
});

console.log('\n📋 Tafsir is Ibn Kathir\'s own words');
var IBN_KATHIR = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-sources/ibn-kathir-ar.json'), 'utf8')).verses;

t('every tafsir quote is copied word for word from Ibn Kathir on that verse', function () {
  none(problems(function (w) {
    if (!w.tafsir) return null;
    var source = IBN_KATHIR[w.verseKey];
    if (!source) return 'no source text for the verse';
    return source.indexOf(w.tafsir.replace(/^… /, '').replace(/ …$/, '')) >= 0 ? null : 'not in the source';
  }));
});

t('tafsir quotes are Arabic and short enough to read in the card', function () {
  none(problems(function (w) {
    if (!w.tafsir) return null;
    if (/[A-Za-z]/.test(w.tafsir)) return 'has English in it';
    return w.tafsir.length <= 404 ? null : 'too long';
  }));
});

t('most words have a tafsir quote', function () {
  assert.ok(WORDS.filter(function (w) { return w.tafsir; }).length >= 600);
});

t('every tafsir quote has an English translation, and only those do', function () {
  none(problems(function (w) {
    if (!w.tafsir) return w.tafsirEn ? 'English without an Arabic quote' : null;
    if (!w.tafsirEn || !w.tafsirEn.trim()) return 'no English';
    return /[؀-ۿ]/.test(w.tafsirEn) ? 'English has Arabic in it' : null;
  }));
});

t('the English keeps the Arabic quote\'s cut marks', function () {
  none(problems(function (w) {
    if (!w.tafsir) return null;
    if (/^… /.test(w.tafsir) !== /^… /.test(w.tafsirEn)) return 'leading … differs';
    return / …$/.test(w.tafsir) !== / …$/.test(w.tafsirEn) ? 'trailing … differs' : null;
  }));
});

t('words sharing an Arabic quote share its English', function () {
  var seen = {};
  none(problems(function (w) {
    if (!w.tafsir) return null;
    if (seen[w.tafsir] === undefined) { seen[w.tafsir] = w.tafsirEn; return null; }
    return seen[w.tafsir] === w.tafsirEn ? null : 'different English for the same quote';
  }));
});

console.log('\n📋 Tafsir card');
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/ui/components.js'), 'utf8'));

t('a passage shows in English with its source and both quran.com links', function () {
  var html = global.tafsirHtml('That is, this will certainly happen.', '31:9');
  assert.ok(/<p class="tafsir-quote">That is, this will certainly happen\.<\/p>/.test(html));
  assert.ok(/Ibn Kathir, Tafsir al-Quran al-Azim, on 31:9\. Translated by Bayan from the Arabic\./.test(html));
  assert.ok(html.indexOf('https://quran.com/31:9/tafsirs/ar-tafsir-ibn-kathir') >= 0);
  assert.ok(html.indexOf('https://quran.com/31:9/tafsirs/en-tafisr-ibn-kathir') >= 0);
});

t('no quote shows the links only', function () {
  var html = global.tafsirHtml('', '1:1');
  assert.ok(html.indexOf('tafsir-quote') < 0);
  assert.ok(html.indexOf('https://quran.com/1:1/tafsirs/ar-tafsir-ibn-kathir') >= 0);
});

t('the quote is escaped', function () {
  assert.ok(global.tafsirHtml('<b>x</b>', '1:1').indexOf('&lt;b&gt;') >= 0);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
