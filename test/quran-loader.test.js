#!/usr/bin/env node
/** Regression tests for retrying lazily loaded Quran surahs. */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var passed = 0;
var failed = 0;

function test(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    passed++;
    console.log('  ✅ ' + name);
  }, function (error) {
    failed++;
    console.log('  ❌ ' + name + '\n     ' + error.message);
  });
}

async function run() {
  global.window = { __QURAN_INDEX: [] };
  var scriptCount = 0;
  global.document = {
    createElement: function () { return {}; },
    head: {
      appendChild: function (script) {
        scriptCount++;
        setTimeout(function () {
          if (scriptCount <= 2) {
            script.onerror(); // Surah request and monolithic fallback fail.
          } else {
            window.__QURAN_TEXT = { 5: { verses: [{ id: 1 }] } };
            script.onload();
          }
        }, 0);
      }
    }
  };
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'quran', 'quran-loader.js'), 'utf8'));

  await test('failed surah request can be retried after the connection recovers', async function () {
    assert.strictEqual(await window.__quranLoader.loadSurah(5), false);
    var retryA = window.__quranLoader.loadSurah(5);
    var retryB = window.__quranLoader.loadSurah(5);
    assert.strictEqual(retryA, retryB, 'concurrent retries share the same in-flight request');
    assert.strictEqual(await retryA, true);
    assert.strictEqual(scriptCount, 3, 'only one retry script is requested alongside failed attempt and fallback');
    assert.strictEqual(window.__quranLoader.isSurahLoaded(5), true);
  });

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  process.exit(failed ? 1 : 0);
}

run().catch(function (error) {
  console.error(error);
  process.exit(1);
});
