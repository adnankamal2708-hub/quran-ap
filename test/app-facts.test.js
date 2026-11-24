#!/usr/bin/env node
/**
 * app-facts.test.js — the facts Bayan states about itself
 * (js/data-core/app-facts.js): counts worked out from the real word data,
 * prices, limits and the lines each plan lists.
 *
 * Run: node test/app-facts.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  global.eval(code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var '));
}
load('js/data/occurrence-index.js');
load('js/data-core/vocab-data.js');
load('js/data/surahs.js');
fs.readdirSync(path.join(__dirname, '..', 'js/data')).filter(function (f) {
  return f.startsWith('words-') && f.endsWith('.js');
}).sort().forEach(function (f) { load('js/data/' + f); });
load('js/data-core/foundation.js');
load('js/data-core/lesson-system.js');
getCanonicalWords();
buildFoundationCourse();
load('js/data-core/app-facts.js');

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}
function released(ids) { global.isTrackReleased = function (id) { return ids.indexOf(id) >= 0; }; }

console.log('\n📋 App facts');

t('counts come from the word data: 1,314 words, 620 root families, 100 Foundation words', function () {
  released(['words']);
  var f = getAppFacts();
  assert.strictEqual(f.wordCount, '1,314');
  assert.strictEqual(f.rootCount, '620');
  assert.strictEqual(f.foundationWords, '100');
});

t('prices and the yearly saving are worked out from the two prices', function () {
  var f = getAppFacts();
  assert.strictEqual(f.monthlyPrice, '$2.99');
  assert.strictEqual(f.yearlyPrice, '$19.99');
  assert.strictEqual(f.yearlyMonthsFree, 5);
  assert.strictEqual(yearlyMonthsFree({ monthly: 5, yearly: 40 }), 4);
});

t('root families ignore spacing, tatweel and dash placeholders', function () {
  assert.strictEqual(countRootFamilies([{ root: 'ك ت ب' }, { root: 'كتب' }, { root: 'ك-ت-ب' }, { root: '—' }, {}, null]), 1);
});

t('every placeholder in every plan line is filled', function () {
  released(['words', 'qaida', 'tajweed']);
  ['free', 'premium', 'yearly'].forEach(function (plan) {
    getPlanLines(plan).forEach(function (line) { assert.ok(!/[{}]/.test(line), plan + ': ' + line); });
  });
});

t('a track line shows only while that track is released', function () {
  released(['words', 'qaida']);
  var free = getPlanLines('free');
  assert.ok(free.some(function (l) { return /Read Arabic from zero/.test(l); }));
  assert.ok(!free.some(function (l) { return /Tajweed/.test(l); }));
  released(['words', 'qaida', 'tajweed']);
  assert.ok(getPlanLines('free').some(function (l) { return /Tajweed/.test(l); }));
  assert.ok(!getPlanLines('free').some(function (l) { return /Salah/.test(l); }));
  released(['words', 'salah']);
  assert.ok(getPlanLines('free').some(function (l) { return /Salah: understand every word of your prayer/.test(l); }));
});

t('free lines state the enforced limits', function () {
  released(['words']);
  var free = getPlanLines('free').join('\n');
  assert.ok(free.indexOf('The 303 most frequent Quranic words') >= 0, free);
  assert.ok(free.indexOf('Up to 10 reviews a day, 20 bookmarks and 5 tafsir notes a day') >= 0, free);
  var premium = getPlanLines('premium').join('\n');
  assert.ok(premium.indexOf('Up to 100 reviews a day, unlimited bookmarks and tafsir') >= 0, premium);
});

t('the plan picker gets the brief lines only', function () {
  released(['words']);
  assert.ok(getPlanLines('premium', true).length < getPlanLines('premium').length);
  assert.deepStrictEqual(getPlanLines('yearly', true), ['Everything in Monthly', 'Unlimited reviews every day', 'About 5 months free compared with monthly']);
});

t('the code that enforces each limit reads it from APP_FACTS', function () {
  function src(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
  assert.ok(/FREE_VOCABULARY_LIMIT = APP_FACTS\.limits\.freeWords/.test(src('js/vocabulary.js')));
  assert.ok(/currentCount >= APP_FACTS\.limits\.bookmarks/.test(src('js/vocabulary.js')));
  assert.ok(/count >= APP_FACTS\.limits\.tafsirPerDay/.test(src('js/services/user-service.js')));
  assert.ok(/Math\.min\(reviewGoalMax\(currentReviewPlan\(\)\)/.test(src('js/profile-ui.js')));
  assert.ok(/var left = reviewsLeftToday\(\);/.test(src('js/srs.js')));
  assert.ok(/reviewsLeftToday\(\)\);/.test(src('js/data-core/lesson-system.js')));
});

t('no plan offers priority support', function () {
  released(['words', 'qaida', 'tajweed']);
  ['free', 'premium', 'yearly'].forEach(function (plan) {
    assert.ok(!/priority support/i.test(getPlanLines(plan).join(' ')));
  });
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
