#!/usr/bin/env node
/**
 * landing-facts.test.js — the build fills the landing page's prices,
 * counts, plan lists and track status from app-facts.js
 * (scripts/landing-facts.js, used by build.js step 6c).
 *
 * Run: node test/landing-facts.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var lf = require('../scripts/landing-facts.js');

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

var SOURCE = fs.readFileSync(path.join(__dirname, '..', 'landing.html'), 'utf8');
var FACTS = lf.loadAppFacts();
var OUT = lf.fillLandingFacts(SOURCE, FACTS);
function listText(html, plan) {
  var m = new RegExp('<ul[^>]*data-plan="' + plan + '"[^>]*>([\\s\\S]*?)</ul>').exec(html);
  return m[1].split('</li>').map(function (li) { return li.replace(/<[^>]+>/g, '').trim(); }).filter(Boolean);
}
function withTracks(tracks) { return Object.assign({}, FACTS, { tracks: tracks }); }

console.log('\n📋 Landing page facts');

t('the facts come from the app data (1,314 words, 620 roots, 100 Foundation words)', function () {
  assert.strictEqual(FACTS.wordCount, '1,314');
  assert.strictEqual(FACTS.rootCount, '620');
  assert.strictEqual(FACTS.foundationWords, '100');
});

t('every marked fact is filled with its value', function () {
  var re = /<(\w+)[^>]*\sdata-fact="(\w+)"[^>]*>([^<]*)<\/\1>/g, m, n = 0;
  while ((m = re.exec(OUT))) { assert.strictEqual(m[3], String(FACTS[m[2]]), m[2]); n++; }
  assert.ok(n >= 6, 'expected the counts and both prices to be marked, found ' + n);
});

t('each pricing list shows exactly its plan lines', function () {
  ['free', 'premium', 'yearly'].forEach(function (plan) {
    assert.deepStrictEqual(listText(OUT, plan), FACTS.planLines[plan], plan);
  });
});

t('nothing stale is left: no 1,208 words, 643 roots or priority support', function () {
  assert.ok(OUT.indexOf('1,208') < 0);
  assert.ok(OUT.indexOf('>643<') < 0);
  assert.ok(!/priority support/i.test(OUT));
});

t('a released track shows as available; one not yet released stays coming soon', function () {
  var html = lf.fillLandingFacts(SOURCE, withTracks({ qaida: true, tajweed: false }));
  assert.ok(/<article class="lp-track lp-track-live lp-glow" data-track="qaida"/.test(html));
  assert.ok(/data-track-pill="qaida">Available now</.test(html));
  assert.ok(/<article class="lp-track lp-track-soon lp-glow" data-track="tajweed"/.test(html));
  assert.ok(/data-track-pill="tajweed">Coming soon</.test(html));
  html = lf.fillLandingFacts(SOURCE, withTracks({ qaida: true, tajweed: true }));
  assert.ok(/<article class="lp-track lp-track-live lp-glow" data-track="tajweed"/.test(html));
  assert.ok(/class="lp-pill lp-pill-live" data-track-pill="tajweed">Available now</.test(html));
});

t('filling twice changes nothing', function () {
  assert.strictEqual(lf.fillLandingFacts(OUT, FACTS), OUT);
});

t('an unknown fact name stops the build', function () {
  assert.throws(function () { lf.fillLandingFacts('<b data-fact="nope">x</b>', FACTS); }, /unknown fact/);
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
