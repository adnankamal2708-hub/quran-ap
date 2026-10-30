#!/usr/bin/env node
/**
 * placement.test.js — Unit tests for the adaptive placement test and the
 * Word meanings question bank.
 *
 * The algorithm tests run on a small synthetic bank; the bank test loads the
 * real vocabulary (same chain as test/vocabulary-access.test.js).
 *
 * Run: node test/placement.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var mock = require('./shared-mock');
mock.setup();
global.window = globalThis;

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

function suite(name, fn) {
  console.log('\n' + name);
  fn();
}

// ── Load real modules (same chain as the bundled app) ──
function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // let/const at eval top level do not leak to global scope; convert to var.
  code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  (0, eval)(code);
}

load('js/data/occurrence-index.js');
load('js/data-core/vocab-data.js');
load('js/data/surahs.js');
fs.readdirSync(path.join(__dirname, '..', 'js', 'data')).filter(function(f) {
  return f.startsWith('words-') && f.endsWith('.js');
}).sort().forEach(function(f) {
  load('js/data/' + f);
});
load('js/data-core/foundation.js');
load('js/data-core/lesson-system.js');
getCanonicalWords();
buildFoundationCourse();
load('js/vocabulary.js');
load('js/exercises/exercise-engine.js');
load('js/exercises/placement.js');

// ── Synthetic bank ──
function syntheticBank(perLevel, tagFor) {
  var bank = { 0: [], 1: [], 2: [], 3: [] };
  [0, 1, 2, 3].forEach(function(level) {
    for (var i = 0; i < perLevel; i++) {
      bank[level].push({
        type: 'read-choose',
        prompt: { arabic: 'ك' + level + '_' + i },
        options: ['a', 'b'],
        answer: 0,
        tag: tagFor ? tagFor(level, i) : 'noun',
        id: level + ':' + i,
      });
    }
  });
  return bank;
}

// Runs a whole test, answering with answerFn(questionNumber, item). Returns
// { state, asked: [item ids], result }.
function runTest(bank, answerFn) {
  var state = createPlacementTest(bank);
  var asked = [];
  var guard = 0;
  while (!isPlacementFinished(state) && guard++ < 100) {
    var item = nextPlacementItem(state);
    asked.push(item.id);
    state = answerPlacementItem(state, answerFn(asked.length - 1, item));
  }
  return { state: state, asked: asked, result: getPlacementResult(state) };
}

suite('placement constants', function() {
  test('limits and start level', function() {
    assert.strictEqual(PLACEMENT_MIN, 10);
    assert.strictEqual(PLACEMENT_MAX, 20);
    assert.strictEqual(PLACEMENT_START_LEVEL, 1);
  });
});

suite('placement algorithm', function() {
  test('all correct ends at level 3 within 20', function() {
    var run = runTest(syntheticBank(30), function() { return true; });
    assert.strictEqual(run.result.level, 3);
    assert.ok(run.asked.length >= PLACEMENT_MIN && run.asked.length <= PLACEMENT_MAX);
  });

  test('all wrong ends at level 0 within 20', function() {
    var run = runTest(syntheticBank(30), function() { return false; });
    assert.strictEqual(run.result.level, 0);
    assert.ok(run.asked.length <= PLACEMENT_MAX);
  });

  test('all wrong finishes at exactly the minimum question count', function() {
    var run = runTest(syntheticBank(30), function() { return false; });
    assert.strictEqual(run.asked.length, PLACEMENT_MIN);
  });

  test('same answers give the same result twice', function() {
    var answerFn = function(n) { return n % 3 !== 0; };
    var first = runTest(syntheticBank(30), answerFn);
    var second = runTest(syntheticBank(30), answerFn);
    assert.deepStrictEqual(first.result, second.result);
    assert.deepStrictEqual(first.asked, second.asked);
  });

  test('alternating right/wrong around level 1 finishes between 10 and 20 with level 1', function() {
    var run = runTest(syntheticBank(30), function(n) { return n % 2 === 0; });
    assert.strictEqual(run.result.level, 1);
    assert.ok(run.asked.length >= PLACEMENT_MIN && run.asked.length <= PLACEMENT_MAX);
  });

  test('never asks the same item twice', function() {
    [function() { return true; }, function() { return false; }, function(n) { return n % 2 === 0; }].forEach(function(fn) {
      var run = runTest(syntheticBank(30), fn);
      var seen = {};
      run.asked.forEach(function(id) {
        assert.ok(!seen[id], 'repeated ' + id);
        seen[id] = true;
      });
    });
  });

  test('the first question comes from the start level', function() {
    var item = nextPlacementItem(createPlacementTest(syntheticBank(30)));
    assert.strictEqual(item.id.split(':')[0], String(PLACEMENT_START_LEVEL));
  });

  test('nextPlacementItem is stable until the item is answered', function() {
    var state = createPlacementTest(syntheticBank(30));
    assert.strictEqual(nextPlacementItem(state).id, nextPlacementItem(state).id);
  });

  test('finishes when the band to ask from is exhausted', function() {
    var run = runTest(syntheticBank(2), function() { return false; });
    assert.ok(run.asked.length < PLACEMENT_MIN);
    assert.strictEqual(isPlacementFinished(run.state), true);
    assert.strictEqual(nextPlacementItem(run.state), null);
  });

  test('answerPlacementItem returns a new state and does not mutate the input', function() {
    var state = createPlacementTest(syntheticBank(30));
    var snapshot = JSON.stringify(state);
    var next = answerPlacementItem(state, true);
    assert.notStrictEqual(next, state);
    assert.strictEqual(JSON.stringify(state), snapshot);
    assert.notStrictEqual(JSON.stringify(next), snapshot);
  });

  test('the result reports per-level asked and correct counts', function() {
    var state = createPlacementTest(syntheticBank(30));
    state = answerPlacementItem(state, true);   // level 1 correct, moves to 2
    state = answerPlacementItem(state, false);  // level 2 wrong, back to 1
    var result = getPlacementResult(state);
    assert.deepStrictEqual(result.perLevel, [
      { asked: 0, correct: 0 },
      { asked: 1, correct: 1 },
      { asked: 1, correct: 0 },
      { asked: 0, correct: 0 },
    ]);
  });

  test('a level needs 2 asked to pass', function() {
    var state = createPlacementTest(syntheticBank(30));
    state = answerPlacementItem(state, true); // 1/1 at level 1 is not enough
    assert.strictEqual(getPlacementResult(state).level, 0);
  });

  // Every item in the bank carries the same tag, so the tag score is just
  // the overall score of the answers given.
  function resultForTag(oks) {
    var bank = syntheticBank(30, function() { return 'x'; });
    var state = createPlacementTest(bank);
    oks.forEach(function(ok) { state = answerPlacementItem(state, ok); });
    return getPlacementResult(state);
  }

  test('strengths and gaps follow the 75%/50% thresholds', function() {
    var r = resultForTag([true, true, true, false]);   // 75%
    assert.deepStrictEqual(r.strengths, ['x']);
    assert.deepStrictEqual(r.gaps, []);
    r = resultForTag([true, true, false, false]);      // 50%
    assert.deepStrictEqual(r.strengths, []);
    assert.deepStrictEqual(r.gaps, ['x']);
    r = resultForTag([true, true, false]);             // 67%
    assert.deepStrictEqual(r.strengths, []);
    assert.deepStrictEqual(r.gaps, []);
    r = resultForTag([true, true, true, true, false]); // 80%
    assert.deepStrictEqual(r.strengths, ['x']);
  });

  test('a tag with fewer than 2 asked is neither a strength nor a gap', function() {
    var r = resultForTag([true]);
    assert.deepStrictEqual(r.strengths, []);
    assert.deepStrictEqual(r.gaps, []);
    r = resultForTag([false]);
    assert.deepStrictEqual(r.strengths, []);
    assert.deepStrictEqual(r.gaps, []);
  });

  test('strengths and gaps are reported per tag', function() {
    // Tag by level: right at level 1 and wrong at level 2, alternating.
    var bank = syntheticBank(30, function(level) { return 'L' + level; });
    var state = createPlacementTest(bank);
    for (var i = 0; i < 6; i++) state = answerPlacementItem(state, i % 2 === 0);
    var r = getPlacementResult(state);
    assert.deepStrictEqual(r.strengths, ['L1']);
    assert.deepStrictEqual(r.gaps, ['L2']);
  });
});

suite('Word meanings bank', function() {
  var BANDS = [[1, 100], [101, 300], [301, 700], [701, Infinity]];
  var words = getCanonicalWords();
  var bank = buildWordMeaningsBank(0);

  function wordForItem(item) {
    return words.filter(function(w) { return w.arabic === item.prompt.arabic; });
  }

  test('every level has items', function() {
    [0, 1, 2, 3].forEach(function(level) {
      assert.ok(bank[level].length > 0, 'level ' + level + ' is empty');
    });
  });

  test('every item passes validateExercise and contains its correct meaning', function() {
    [0, 1, 2, 3].forEach(function(level) {
      bank[level].forEach(function(item) {
        assert.strictEqual(validateExercise(item), null, 'invalid item: ' + item.prompt.arabic);
        assert.strictEqual(item.type, 'read-choose');
        var matches = wordForItem(item);
        assert.ok(matches.length > 0, 'no word for ' + item.prompt.arabic);
        assert.ok(matches.some(function(w) { return w.english === item.options[item.answer]; }),
          'correct option missing for ' + item.prompt.arabic);
      });
    });
  });

  test('the correct meaning appears exactly once and no distractor shares it', function() {
    [0, 1, 2, 3].forEach(function(level) {
      bank[level].forEach(function(item) {
        var correct = item.options[item.answer];
        var count = item.options.filter(function(o) { return o === correct; }).length;
        assert.strictEqual(count, 1, 'duplicate correct meaning for ' + item.prompt.arabic);
      });
    });
  });

  test('no item has two options that differ only by case or a leading article', function() {
    function normalized(option) {
      return option.trim().toLowerCase().replace(/^(the|a|an|to) /, '');
    }
    // Distractor choice is random, so check several freshly built banks.
    [bank, buildWordMeaningsBank(0), buildWordMeaningsBank(1), buildWordMeaningsBank(2)].forEach(function(candidate) {
      [0, 1, 2, 3].forEach(function(level) {
        candidate[level].forEach(function(item) {
          var forms = item.options.map(normalized);
          var distinct = forms.filter(function(form, i) { return forms.indexOf(form) === i; });
          assert.strictEqual(distinct.length, forms.length,
            'near-duplicate options for ' + item.prompt.arabic + ': ' + item.options.join(' / '));
        });
      });
    });
  });

  test('items offer 4 options and are tagged with typeCategory', function() {
    [0, 1, 2, 3].forEach(function(level) {
      bank[level].forEach(function(item) {
        assert.strictEqual(item.options.length, 4, 'options for ' + item.prompt.arabic);
        assert.ok(typeof item.tag === 'string' && item.tag.length > 0);
      });
    });
  });

  test('items are banded by frequency rank', function() {
    [0, 1, 2, 3].forEach(function(level) {
      var lo = BANDS[level][0];
      var hi = BANDS[level][1];
      var inBand = words.filter(function(w) {
        var rank = getFrequencyRank(w);
        return rank !== null && rank >= lo && rank <= hi;
      });
      assert.strictEqual(bank[level].length, inBand.length, "no word is dropped from band " + level);
      bank[level].forEach(function(item) {
        var ok = inBand.some(function(w) { return w.arabic === item.prompt.arabic; });
        assert.ok(ok, item.prompt.arabic + ' is outside band ' + level);
      });
    });
  });

  test('within a band the order follows rank for attempt 0', function() {
    var first = words.filter(function(w) { return getFrequencyRank(w) === 1; })[0];
    assert.strictEqual(bank[0][0].prompt.arabic, first.arabic);
  });

  test('retakes rotate the order by attempt * 3', function() {
    var retake = buildWordMeaningsBank(1);
    assert.strictEqual(retake[0].length, bank[0].length);
    assert.strictEqual(retake[0][0].prompt.arabic, bank[0][3].prompt.arabic);
    assert.strictEqual(retake[0][retake[0].length - 1].prompt.arabic, bank[0][2].prompt.arabic);
  });

  test('the correct answer is not always the first option', function() {
    var positions = {};
    bank[0].forEach(function(item) { positions[item.answer] = true; });
    assert.ok(Object.keys(positions).length > 1);
  });

  test('a full test on the real bank finishes and gives a level', function() {
    var state = createPlacementTest(bank);
    var guard = 0;
    while (!isPlacementFinished(state) && guard++ < 50) {
      var item = nextPlacementItem(state);
      state = answerPlacementItem(state, checkExercise(item, item.answer));
    }
    assert.strictEqual(getPlacementResult(state).level, 3);
  });
});

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed > 0 ? 1 : 0);
