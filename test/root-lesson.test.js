#!/usr/bin/env node
/**
 * root-lesson.test.js — "Study by root": the lesson builder
 * (js/exercises/root-lesson.js) and its screen (js/ui/root-lesson-ui.js).
 *
 * The builder tests run on the real vocabulary and the real placement
 * option picker; the Quran text is a small stub. The screen tests use a
 * minimal DOM, a stub exercise renderer and stub SRS / percentage functions,
 * so they can see what each answer and the finish do.
 *
 * Run: node test/root-lesson.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var mock = require('./shared-mock');
mock.setup();
global.window = globalThis;

var passed = 0;
var failed = 0;
var pending = Promise.resolve();

// Tests run one after another (the screen tests are async).
function test(name, fn) {
  pending = pending.then(async function() {
    try {
      await fn();
      passed++;
      console.log('  ✓ ' + name);
    } catch (e) {
      failed++;
      console.log('  ✗ ' + name);
      console.log('    ' + e.message);
    }
  });
}

function suite(name, fn) {
  pending = pending.then(function() { console.log('\n' + name); });
  fn();
}

// ── Load real modules (same chain as the bundled app) ──
function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // let/const at eval top level do not leak to global scope; convert to var.
  code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  (0, eval)(code);
}

load('js/i18n/strings-en.js');
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
load('js/exercises/word-drills.js');
load('js/exercises/root-lesson.js');

// ── The Quran text: a stub holding the ayahs a test installs ──
var AYAHS = {};          // 'surah:verse' -> text
var LOADED = [];         // surahs whose text is "loaded"
var surahLoads = [];     // ids asked of loadSurah
window.__quranLoader = {
  isSurahLoaded: function(id) { return LOADED.indexOf(id) >= 0; },
  getVerse: function(surah, verse) {
    var text = AYAHS[surah + ':' + verse];
    return text === undefined ? null : { id: verse, text: text, translation: '' };
  },
  loadSurah: async function(id) {
    surahLoads.push(id);
    if (AYAHS['load:' + id]) LOADED.push(id);   // 'load:N' marks a surah that loads
    return LOADED.indexOf(id) >= 0;
  },
};

function resetQuran() { AYAHS = {}; LOADED = []; surahLoads = []; }

function norm(arabic) { return window.OCCURRENCE_INDEX_NORM(arabic); }

var FAMILIES = getRootFamilyLessons();
var FIRST = FAMILIES[0];

function wordIds(words) { return words.map(function(w) { return w.id; }).sort(); }

/** First family (most frequent first) that satisfies the predicate. */
function findFamily(predicate) {
  return FAMILIES.filter(predicate)[0];
}

function distinctMeanings(family) {
  var forms = [];
  family.words.forEach(function(w) {
    var form = normalizeMeaning(w.english);
    if (forms.indexOf(form) < 0) forms.push(form);
  });
  return forms;
}

// ═══════════════════════════════════════════════════════════════
// BUILDER
// ═══════════════════════════════════════════════════════════════

suite('splitRootLetters', function() {
  test('splits on dashes', function() {
    assert.deepStrictEqual(splitRootLetters('ك-ت-ب'), ['ك', 'ت', 'ب']);
  });
  test('splits on spaces, and on a mix of spaces and dashes', function() {
    assert.deepStrictEqual(splitRootLetters('ك ت ب'), ['ك', 'ت', 'ب']);
    assert.deepStrictEqual(splitRootLetters('ك - ت-ب'), ['ك', 'ت', 'ب']);
  });
  test('an empty or missing root has no letters', function() {
    assert.deepStrictEqual(splitRootLetters(''), []);
    assert.deepStrictEqual(splitRootLetters(undefined), []);
  });
});

suite('buildRootLesson: the most frequent root', function() {
  var lesson = buildRootLesson(FIRST.root);

  test('it builds a lesson with the root, its letters and its meaning', function() {
    assert.ok(lesson, 'a lesson');
    assert.strictEqual(lesson.root, FIRST.root);
    assert.strictEqual(lesson.letters.length, 3);
    assert.strictEqual(lesson.meaning, FIRST.rootMeaning);
  });

  test('occurrences is the sum of the family words\' occ', function() {
    var sum = FIRST.words.reduce(function(total, w) { return total + (w.occ || 0); }, 0);
    assert.strictEqual(lesson.occurrences, sum);
  });

  test('the note is the first non-empty rootPattern', function() {
    var expected = FIRST.words.map(function(w) { return w.rootPattern; }).filter(Boolean)[0];
    assert.strictEqual(lesson.note, expected);
  });

  test('every family word is shown once, or merged into a shown word with its meaning', function() {
    var shown = [];
    var merged = [];
    lesson.groups.forEach(function(group) {
      shown = shown.concat(group.words);
      group.words.forEach(function(w) { merged = merged.concat(group.sameMeaning[w.id] || []); });
    });
    assert.strictEqual(wordIds(shown).length, new Set(wordIds(shown)).size, 'no word shown twice');
    assert.deepStrictEqual(wordIds(shown.concat(merged)), wordIds(FIRST.words));
  });

  test('every exercise passes validateExercise', function() {
    assert.ok(lesson.exercises.length > 0, 'has exercises');
    lesson.exercises.forEach(function(item) {
      assert.strictEqual(validateExercise(item), null);
    });
  });
});

suite('buildRootLesson: grouping by pattern', function() {
  test('a word with pattern "—" lands in "Other forms", the last group', function() {
    var family = findFamily(function(f) {
      return f.words.some(function(w) { return w.pattern === '—'; }) &&
        f.words.some(function(w) { return w.pattern && w.pattern !== '—'; });
    });
    assert.ok(family, 'data has a family with and without patterns');
    var lesson = buildRootLesson(family.root);
    var last = lesson.groups[lesson.groups.length - 1];
    assert.strictEqual(last.pattern, 'Other forms');
    var dashed = family.words.filter(function(w) { return w.pattern === '—'; });
    assert.deepStrictEqual(wordIds(last.words), wordIds(dashed));
    assert.strictEqual(lesson.groups.filter(function(g) { return g.pattern === 'Other forms'; }).length, 1);
  });

  test('a missing or empty pattern also lands in "Other forms"', function() {
    var family = findFamily(function(f) { return f.words.length >= 2; });
    var word = family.words[0];
    var original = word.pattern;
    try {
      [undefined, '', null].forEach(function(blank) {
        word.pattern = blank;
        var lesson = buildRootLesson(family.root);
        var other = lesson.groups.filter(function(g) { return g.pattern === 'Other forms'; })[0];
        assert.ok(other && other.words.indexOf(word) >= 0, 'pattern ' + blank);
      });
    } finally {
      word.pattern = original;
    }
  });

  test('words sharing a pattern share a group, labelled exactly as stored', function() {
    var family = findFamily(function(f) {
      return f.words.filter(function(w) { return w.pattern === 'فِعَال'; }).length >= 2;
    });
    assert.ok(family, 'data has a family with two words of one pattern');
    var group = buildRootLesson(family.root).groups.filter(function(g) { return g.pattern === 'فِعَال'; })[0];
    assert.ok(group);
    var meanings = family.words.filter(function(w) { return w.pattern === 'فِعَال'; })
      .map(function(w) { return normalizeMeaning(w.english); })
      .filter(function(m, i, all) { return all.indexOf(m) === i; });
    assert.strictEqual(group.words.length, meanings.length);
  });
});

suite('buildRootLesson: words with the same meaning', function() {
  function shownRows(lesson) {
    var rows = [];
    lesson.groups.forEach(function(g) { rows = rows.concat(g.words); });
    return rows;
  }

  test('أ-ل-ه shows God/Deity once; the other case ending is merged into it', function() {
    var lesson = buildRootLesson('أ-ل-ه');
    var rows = shownRows(lesson).filter(function(w) { return w.english === 'God/Deity'; });
    assert.strictEqual(rows.length, 1);
    var group = lesson.groups.filter(function(g) { return g.words.indexOf(rows[0]) >= 0; })[0];
    assert.strictEqual(group.sameMeaning[rows[0].id].length, 1);
    // إِلَٰهٍ and إِلَٰهَ differ only in the final vowel: nothing more to show.
    assert.strictEqual(group.alsoWritten[rows[0].id], undefined);
  });

  test('a same-meaning word with different letters is listed under the shown one', function() {
    var lesson = buildRootLesson('أ-م-ن');
    var rows = shownRows(lesson).filter(function(w) { return normalizeMeaning(w.english) === 'believers'; });
    assert.strictEqual(rows.length, 1);
    var group = lesson.groups.filter(function(g) { return g.words.indexOf(rows[0]) >= 0; })[0];
    assert.ok(group.alsoWritten[rows[0].id].length >= 1);
  });

  test('no family shows two rows with the same meaning', function() {
    FAMILIES.forEach(function(family) {
      var meanings = shownRows(buildRootLesson(family.root)).map(function(w) { return normalizeMeaning(w.english); });
      assert.strictEqual(meanings.length, new Set(meanings).size, family.root);
    });
  });

  test('the shown row is the most frequent word of its meaning', function() {
    var lesson = buildRootLesson('أ-م-ن');
    lesson.groups.forEach(function(g) {
      g.words.forEach(function(w) {
        (g.sameMeaning[w.id] || []).forEach(function(other) { assert.ok((w.occ || 0) >= (other.occ || 0), other.arabic); });
      });
    });
  });

  test('a spelling identical to the shown one is not listed again', function() {
    FAMILIES.forEach(function(family) {
      buildRootLesson(family.root).groups.forEach(function(g) {
        g.words.forEach(function(w) {
          var also = g.alsoWritten[w.id] || [];
          also.forEach(function(a) { assert.notStrictEqual(norm(a), norm(w.arabic), family.root + ' ' + a); });
          assert.strictEqual(also.length, new Set(also.map(norm)).size, family.root + ' repeats a spelling');
        });
      });
    });
  });
});

suite('word data: pattern labels', function() {
  test('every stored pattern is a template built on ف-ع-ل', function() {
    var bad = [];
    FAMILIES.forEach(function(family) {
      family.words.forEach(function(w) {
        if (!w.pattern || w.pattern === '—') return;
        if (!/[فعل]/.test(w.pattern.replace(/[ً-ْٰ]/g, ''))) bad.push(w.arabic + ' → ' + w.pattern);
      });
    });
    assert.deepStrictEqual(bad, []);
  });

  test('a family with no patterns at all has only "Other forms"', function() {
    var family = findFamily(function(f) {
      return f.words.every(function(w) { return !w.pattern || w.pattern === '—'; });
    });
    assert.ok(family);
    var lesson = buildRootLesson(family.root);
    assert.deepStrictEqual(lesson.groups.map(function(g) { return g.pattern; }), ['Other forms']);
  });
});

suite('buildRootLesson: unknown roots', function() {
  test('an unknown root gives null', function() {
    assert.strictEqual(buildRootLesson('xyz'), null);
    assert.strictEqual(buildRootLesson(''), null);
    assert.strictEqual(buildRootLesson(undefined), null);
  });
});

suite('buildRootLesson: read-choose exercises', function() {
  var big = findFamily(function(f) { return f.words.length >= 4 && distinctMeanings(f).length >= 4; });

  test('one read-choose per family word, up to 4', function() {
    assert.ok(big, 'data has a family of 4+ words with distinct meanings');
    var items = buildRootLesson(big.root).exercises.filter(function(i) { return i.type === 'read-choose'; });
    assert.strictEqual(items.length, 4);
  });

  test('a small family gets one per word with a distinct meaning', function() {
    var small = findFamily(function(f) { return f.words.length === 2 && distinctMeanings(f).length === 2; });
    assert.ok(small);
    var items = buildRootLesson(small.root).exercises.filter(function(i) { return i.type === 'read-choose'; });
    assert.strictEqual(items.length, 2);
    items.forEach(function(item) { assert.strictEqual(validateExercise(item), null); });
  });

  test('the Arabic is the prompt and the options hold the correct meaning', function() {
    var lesson = buildRootLesson(big.root);
    lesson.exercises.filter(function(i) { return i.type === 'read-choose'; }).forEach(function(item) {
      var word = big.words.filter(function(w) { return w.id === item.wordId; })[0];
      assert.ok(word, 'item names its word');
      assert.strictEqual(item.prompt.arabic, word.arabic);
      assert.strictEqual(item.options[item.answer], word.english);
    });
  });

  test('with 4+ distinct meanings the distractors come from the same family', function() {
    var familyMeanings = big.words.map(function(w) { return w.english; });
    for (var run = 0; run < 10; run++) {
      buildRootLesson(big.root).exercises.filter(function(i) { return i.type === 'read-choose'; }).forEach(function(item) {
        assert.strictEqual(item.options.length, 4);
        item.options.forEach(function(option) {
          assert.ok(familyMeanings.indexOf(option) >= 0, option + ' is not a meaning in the family');
        });
      });
    }
  });

  test('options never repeat a meaning', function() {
    buildRootLesson(big.root).exercises.filter(function(i) { return i.type === 'read-choose'; }).forEach(function(item) {
      var forms = item.options.map(normalizeMeaning);
      assert.strictEqual(forms.filter(function(f, i) { return forms.indexOf(f) === i; }).length, forms.length);
    });
  });

  test('a one-word family falls back to getDistractors for its options', function() {
    var single = findFamily(function(f) { return f.words.length === 1 && f.words[0].english; });
    var items = buildRootLesson(single.root).exercises.filter(function(i) { return i.type === 'read-choose'; });
    assert.strictEqual(items.length, 1);
    assert.strictEqual(validateExercise(items[0]), null);
    assert.ok(items[0].options.length >= 2, 'distractors were found');
  });

  test('a word whose Arabic matches the asked word is never a distractor', function() {
    var family = {
      root: 'x', words: [
        { id: 'a', arabic: 'أَرْض', english: 'Earth' },
        { id: 'b', arabic: 'الْأَرْض', english: 'Land' },
        { id: 'c', arabic: 'أَرْضٌ', english: 'Ground' },   // same form as 'a' without marks
        { id: 'd', arabic: 'سَمَاء', english: 'Sky' },
      ],
    };
    var pool = rootDistractorPool(family.words[0], family.words);
    assert.deepStrictEqual(pool.map(function(w) { return w.id; }).sort(), ['b', 'd']);
  });
});

suite('buildRootLesson: the spot exercise', function() {
  // A family whose first word has one clear token to find: a word, its stored
  // form and an ayah that holds it among unrelated tokens.
  var family = findFamily(function(f) {
    return f.words.length >= 2 && f.words.some(function(w) {
      return w.arabic.split(/\s+/).length === 1 && w.occurrences && w.occurrences.length > 0;
    });
  });
  var anchor = family.words.filter(function(w) {
    return w.arabic.split(/\s+/).length === 1 && w.occurrences && w.occurrences.length > 0;
  })[0];
  var key = anchor.occurrences[0].verseKey;
  var surahId = Number(key.split(':')[0]);
  var FILLER = 'وَقَالَ لَهُمُ';       // none of these tokens is a form of this family

  test('no loaded text: the lesson still builds, with no spot item', function() {
    resetQuran();
    var lesson = buildRootLesson(family.root);
    assert.ok(lesson.exercises.length > 0);
    assert.strictEqual(lesson.exercises.filter(function(i) { return i.type === 'spot'; }).length, 0);
    assert.strictEqual(buildRootSpotItem(family.root), null);
  });

  test('with the ayah loaded, every token of the root is the answer and only those', function() {
    resetQuran();
    LOADED = [surahId];
    AYAHS[key] = FILLER + ' ' + anchor.arabic + ' ' + FILLER;
    var item = buildRootSpotItem(family.root);
    assert.ok(item, 'a spot item');
    assert.strictEqual(item.type, 'spot');
    assert.strictEqual(validateExercise(item), null);
    var forms = {};
    family.words.forEach(function(w) { forms[norm(w.arabic)] = true; });
    var expected = [];
    item.tokens.forEach(function(token, i) { if (forms[norm(token)]) expected.push(i); });
    assert.deepStrictEqual(item.answer, expected);
    assert.ok(item.answer.length >= 1 && item.answer.length < item.tokens.length);
    assert.ok(item.answer.indexOf(drillWords(FILLER).length) >= 0, 'the anchor token is in the answer');
    assert.strictEqual(item.prompt.text, 'Tap every word from this family');
  });

  test('the lesson includes the spot item last when the ayah is loaded', function() {
    resetQuran();
    LOADED = [surahId];
    AYAHS[key] = FILLER + ' ' + anchor.arabic + ' ' + FILLER;
    var lesson = buildRootLesson(family.root);
    var last = lesson.exercises[lesson.exercises.length - 1];
    assert.strictEqual(last.type, 'spot');
    assert.ok(lesson.exercises.length <= 6);
  });

  test('an ayah where every token matches is skipped', function() {
    resetQuran();
    LOADED = [surahId];
    AYAHS[key] = anchor.arabic + ' ' + anchor.arabic + ' ' + anchor.arabic;
    assert.strictEqual(buildRootSpotItem(family.root), null);
  });

  test('an ayah with none of the family\'s tokens is skipped', function() {
    resetQuran();
    LOADED = [surahId];
    AYAHS[key] = FILLER + ' ' + FILLER;
    assert.strictEqual(buildRootSpotItem(family.root), null);
  });

  test('an ayah that is too short or too long for a spot is skipped', function() {
    resetQuran();
    LOADED = [surahId];
    AYAHS[key] = anchor.arabic + ' ' + FILLER.split(' ')[0];
    assert.strictEqual(buildRootSpotItem(family.root), null, 'two tokens');
    AYAHS[key] = anchor.arabic + new Array(DRILL_SPOT_MAX_TOKENS + 1).join(' ' + FILLER.split(' ')[0]);
    assert.strictEqual(buildRootSpotItem(family.root), null, 'too many tokens');
  });

  test('an ayah with a token spelled like a family word of another root is skipped', function() {
    // مِنْ is stored under the root of the most frequent family, and is also
    // the form of a particle with another root. Tapping it would be fair but
    // marked wrong, so no ayah holding it is used.
    var shared = FIRST.words.filter(function(w) { return norm(w.arabic) === norm('مِنْ'); })[0];
    assert.ok(shared, 'data holds the shared form in the first family');
    var own = FIRST.words.filter(function(w) {
      return w.arabic.split(/\s+/).length === 1 && norm(w.arabic) !== norm('مِنْ') && w.occurrences && w.occurrences.length;
    })[0];
    var ownKey = own.occurrences[0].verseKey;
    resetQuran();
    LOADED = [Number(ownKey.split(':')[0])];
    AYAHS[ownKey] = 'مِنْ ' + own.arabic + ' ' + FILLER;
    assert.strictEqual(buildRootSpotItem(FIRST.root), null, 'skipped');
    AYAHS[ownKey] = FILLER + ' ' + own.arabic + ' ' + FILLER;
    var item = buildRootSpotItem(FIRST.root);
    assert.ok(item, 'the same ayah without the shared form is used');
    assert.strictEqual(validateExercise(item), null);
  });

  test('an ayah with a prefixed word of the family is skipped, not marked wrong', function() {
    var prefixed = ['وَ', 'فَ', 'بِ', 'لِ', 'كَ', 'ٱلۡ', 'وَٱلۡ', 'بِٱلۡ'];
    prefixed.forEach(function(prefix) {
      resetQuran();
      LOADED = [surahId];
      AYAHS[key] = FILLER + ' ' + anchor.arabic + ' ' + prefix + anchor.arabic;
      assert.strictEqual(buildRootSpotItem(family.root), null, 'prefix ' + prefix);
    });
    resetQuran();
    LOADED = [surahId];
    AYAHS[key] = FILLER + ' ' + anchor.arabic + ' ' + FILLER;
    assert.ok(buildRootSpotItem(family.root), 'a clean ayah still gives a spot item');
  });

  test('li + al- (written with one lam) before a family word also counts as prefixed', function() {
    var form = norm(anchor.arabic);
    assert.ok(drillPrefixStrippedForms('ل' + 'ل' + form).indexOf(form) >= 0);
    assert.ok(drillPrefixStrippedForms('و' + 'ب' + 'ال' + form).indexOf(form) >= 0);
    assert.strictEqual(drillPrefixStrippedForms(form).indexOf('') , -1);
  });

  test('rootSpotSurahIds lists the surahs of the family\'s ayahs, each once, at most 3', function() {
    var ids = rootSpotSurahIds(family.root);
    assert.ok(ids.length >= 1 && ids.length <= 3);
    var familySurahs = [];
    family.words.forEach(function(w) {
      (w.occurrences || []).forEach(function(o) { familySurahs.push(Number(o.verseKey.split(':')[0])); });
    });
    ids.forEach(function(id) { assert.ok(familySurahs.indexOf(id) >= 0, 'surah ' + id + ' holds a family ayah'); });
    assert.strictEqual(ids.filter(function(id, i) { return ids.indexOf(id) === i; }).length, ids.length);
  });
});

suite('placement stays unchanged', function() {
  test('pickMeaningOptions without a preferred list still gives 4 unique meanings', function() {
    var word = getCanonicalWords()[5];
    var options = pickMeaningOptions(word);
    assert.strictEqual(options[0], word.english);
    assert.ok(options.length >= 2 && options.length <= 4);
  });
  test('buildWordMeaningsBank does not pass the index as a preferred list', function() {
    var bank = buildWordMeaningsBank(0);
    [0, 1, 2, 3].forEach(function(level) {
      bank[level].slice(0, 5).forEach(function(item) { assert.strictEqual(validateExercise(item), null); });
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════

// A view with the two slots inside it; re-rendering replaces the slots.
var _elements = {};
function viewEl() {
  if (!_elements['view-root-lesson']) {
    var markup = '';
    var el = { id: 'view-root-lesson', onclick: null, onkeydown: null, focus: function() {} };
    Object.defineProperty(el, 'innerHTML', {
      get: function() { return markup; },
      set: function(value) {
        markup = value;
        delete _elements['root-exercise'];
        delete _elements['root-next'];
      },
    });
    _elements['view-root-lesson'] = el;
  }
  return _elements['view-root-lesson'];
}
global.document = {
  getElementById: function(id) {
    if (id === 'view-root-lesson') return viewEl();
    if (id !== 'root-exercise' && id !== 'root-next') return null;
    if (!_elements[id]) _elements[id] = { id: id, innerHTML: '', focus: function() {} };
    return _elements[id];
  },
};

global.escapeHtml = function(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};
require('./load-components')();

var calls = [];
global.switchView = function(view) { calls.push('switchView:' + view); };
var rated = [];
global.rateSRSWord = function(id, rating) { rated.push([id, rating]); };
var percentResult = { percent: 1, gained: 0 };
var rendered = [];
global.renderExercise = function(container, item, onAnswer) {
  rendered.push({ container: container, item: item, onAnswer: onAnswer });
};
var completed = [];
var realComplete = completeRootFamily;
global.completeRootFamily = function(key) { completed.push(key); realComplete(key); };

load('js/data-core/tracks.js');
load('js/data-core/word-meanings-track.js');
load('js/ui/root-lesson-ui.js');

// The real percentage function is replaced after its file loads.
global.refreshWordMeaningsPercent = function() { calls.push('refreshPercent'); return percentResult; };


function resetScreen() {
  localStorage.clear();
  _elements = {};
  calls = [];
  rated = [];
  rendered = [];
  completed = [];
  percentResult = { percent: 1, gained: 0 };
  resetQuran();
  global._rootRun = null;
}

function html(id) { return document.getElementById(id || 'view-root-lesson').innerHTML; }

function clickAction(action, attrs) {
  var target = {
    getAttribute: function(name) {
      if (name === 'data-action') return action;
      return attrs && attrs[name] !== undefined ? attrs[name] : null;
    },
  };
  var view = document.getElementById('view-root-lesson');
  assert.strictEqual(typeof view.onclick, 'function', 'the view has a click handler');
  view.onclick({ target: { closest: function() { return target; } }, preventDefault: function() {} });
}

/** Opens a root's lesson and moves to the first exercise. */
async function openToPractice(rootKey) {
  await startRootLesson(rootKey);
  renderRootLesson();
  clickAction('continue');     // the root -> the family
  clickAction('continue');     // the family -> the exercises
}

function answerAll(isCorrect) {
  var guard = 0;
  while (html().indexOf('root-finish') < 0) {
    assert.ok(guard++ < 12, 'the lesson should end');
    var current = rendered[rendered.length - 1];
    current.onAnswer(isCorrect(current.item), 0);
    clickAction('next');
  }
}

suite('Screen: the root list', function() {
  test('showRootList opens the root-lesson view', function() {
    resetScreen();
    showRootList();
    assert.deepStrictEqual(calls, ['switchView:root-lesson']);
  });

  test('the list shows every root, most frequent first, as buttons', function() {
    resetScreen();
    showRootList();
    renderRootLesson();
    var markup = html();
    assert.strictEqual(markup.split('data-action="open-root"').length - 1, FAMILIES.length);
    assert.ok(markup.indexOf('data-root="' + FIRST.root + '"') < markup.indexOf('data-root="' + FAMILIES[1].root + '"'));
    assert.ok(markup.indexOf(FIRST.rootMeaning) >= 0);
  });

  test('rendering the list rebuilds the families a bounded number of times', function() {
    resetScreen();
    var real = global.getRootFamilyLessons;
    var builds = 0;
    global.getRootFamilyLessons = function() { builds++; return real(); };
    try {
      renderRootLesson();
    } finally {
      global.getRootFamilyLessons = real;
    }
    assert.ok(builds <= 2, 'built ' + builds + ' times');
  });

  test('finished roots are marked on their row', function() {
    resetScreen();
    realComplete(FAMILIES[1].root);
    renderRootLesson();
    var rows = html().split('<li>').slice(1);
    assert.ok(rows[1].indexOf('is-done') >= 0, 'the finished root');
    assert.ok(rows[0].indexOf('is-done') < 0, 'an unfinished root');
  });

  test('the back button returns to the Word meanings path', function() {
    resetScreen();
    renderRootLesson();
    clickAction('back-to-path');
    assert.deepStrictEqual(calls, ['switchView:track']);
  });

  test('a row opens that root\'s lesson', async function() {
    resetScreen();
    renderRootLesson();
    clickAction('open-root', { 'data-root': FIRST.root });
    assert.deepStrictEqual(calls.filter(function(c) { return c.indexOf('switchView') === 0; }), ['switchView:root-lesson']);
    renderRootLesson();
    assert.ok(html().indexOf('The root') >= 0);
  });
});

suite('Screen: the lesson', function() {
  test('startRootLesson on an unknown root does nothing', async function() {
    resetScreen();
    await startRootLesson('xyz');
    assert.deepStrictEqual(calls, []);
  });

  test('the root screen shows the letters, meaning, note and how often it appears', async function() {
    resetScreen();
    await startRootLesson(FIRST.root);
    renderRootLesson();
    var markup = html();
    var lesson = buildRootLesson(FIRST.root);
    assert.ok(markup.indexOf('The root') >= 0);
    lesson.letters.forEach(function(letter) { assert.ok(markup.indexOf('>' + letter + '<') >= 0, letter); });
    assert.ok(markup.indexOf(escapeHtml(lesson.meaning)) >= 0);
    assert.ok(markup.indexOf(escapeHtml(lesson.note)) >= 0);
    assert.ok(markup.indexOf('Appears ' + lesson.occurrences + ' times in the Quran') >= 0);
  });

  test('a merged spelling is shown under its row as "Also written"', async function() {
    resetScreen();
    await startRootLesson('أ-م-ن');
    renderRootLesson();
    clickAction('continue');
    var markup = html();
    assert.ok(markup.indexOf('class="root-lesson-word-also"') >= 0);
    assert.ok(markup.indexOf('Also written') >= 0);
  });

  test('the family screen groups words by the pattern exactly as stored', async function() {
    resetScreen();
    var family = findFamily(function(f) {
      return f.words.some(function(w) { return w.pattern && w.pattern !== '—'; });
    });
    await startRootLesson(family.root);
    renderRootLesson();
    clickAction('continue');
    var markup = html();
    assert.ok(markup.indexOf('The family') >= 0);
    // Same-meaning words share a row: each spelling is on screen, each
    // meaning appears (case aside), and every shown row's pattern heads a group.
    family.words.forEach(function(w) {
      assert.ok(markup.indexOf(escapeHtml(w.arabic)) >= 0, w.arabic);
      assert.ok(markup.toLowerCase().indexOf(escapeHtml(w.english).toLowerCase()) >= 0, w.english);
    });
    buildRootLesson(family.root).groups.forEach(function(g) {
      if (g.pattern !== 'Other forms') assert.ok(markup.indexOf(g.pattern) >= 0, g.pattern);
    });
    assert.ok(markup.indexOf('Other forms') >= 0 || family.words.every(function(w) { return w.pattern && w.pattern !== '—'; }));
  });

  test('the exercises render one at a time in the exercise slot', async function() {
    resetScreen();
    await openToPractice(FIRST.root);
    assert.ok(html().indexOf('Practice') >= 0);
    assert.strictEqual(rendered.length, 1);
    assert.strictEqual(rendered[0].container, document.getElementById('root-exercise'));
    assert.strictEqual(html('root-next'), '', 'no Next before an answer');
    rendered[0].onAnswer(true, 0);
    assert.ok(html('root-next').indexOf('data-action="next"') >= 0);
    clickAction('next');
    assert.strictEqual(rendered.length, 2);
  });

  test('a correct read-choose answer rates the word 2, a wrong one 0', async function() {
    resetScreen();
    await openToPractice(FIRST.root);
    var first = rendered[0].item;
    rendered[0].onAnswer(true, first.answer);
    clickAction('next');
    var second = rendered[1].item;
    rendered[1].onAnswer(false, 0);
    assert.deepStrictEqual(rated, [[first.wordId, 2], [second.wordId, 0]]);
  });

  test('finishing completes the root once and shows the percentage gained', async function() {
    resetScreen();
    percentResult = { percent: 4, gained: 1.5 };
    await openToPractice(FIRST.root);
    answerAll(function() { return true; });
    assert.deepStrictEqual(completed, [FIRST.root]);
    assert.ok(isRootFamilyCompleted(FIRST.root));
    assert.ok(html().indexOf('Root complete') >= 0);
    assert.ok(html().indexOf(escapeHtml('+1.5% of the Quran\'s words')) >= 0, html());
    renderRootLesson();       // a re-render of the finish does not complete again
    assert.deepStrictEqual(completed, [FIRST.root]);
  });

  test('with nothing gained the finish says so instead of "+0%"', async function() {
    resetScreen();
    await openToPractice(FIRST.root);
    answerAll(function() { return false; });
    assert.ok(html().indexOf('+0') < 0);
    assert.ok(html().indexOf('Nothing new counted yet. Words count once they stick in review.') >= 0);
    assert.deepStrictEqual(completed, [FIRST.root], 'finishing counts even when answers were wrong');
  });

  test('the percentage baseline is taken when the lesson starts', async function() {
    resetScreen();
    await startRootLesson(FIRST.root);
    assert.ok(calls.indexOf('refreshPercent') >= 0);
  });

  test('"All roots" on the finish returns to the list', async function() {
    resetScreen();
    await openToPractice(FIRST.root);
    answerAll(function() { return true; });
    clickAction('list');
    renderRootLesson();
    assert.ok(html().indexOf('data-action="open-root"') >= 0);
  });

  test('back from a lesson returns to the list without finishing it', async function() {
    resetScreen();
    await openToPractice(FIRST.root);
    clickAction('list');
    renderRootLesson();
    assert.ok(html().indexOf('data-action="open-root"') >= 0);
    assert.deepStrictEqual(completed, []);
  });

  test('the spot exercise joins the lesson once its text loads, and is not rated', async function() {
    resetScreen();
    var family = findFamily(function(f) {
      return f.words.length >= 2 && f.words.some(function(w) {
        return w.arabic.split(/\s+/).length === 1 && w.occurrences && w.occurrences.length > 0;
      });
    });
    var anchor = family.words.filter(function(w) {
      return w.arabic.split(/\s+/).length === 1 && w.occurrences && w.occurrences.length > 0;
    })[0];
    var key = anchor.occurrences[0].verseKey;
    var surahId = Number(key.split(':')[0]);
    AYAHS[key] = 'وَقَالَ ' + anchor.arabic + ' لَهُمُ';
    AYAHS['load:' + surahId] = true;     // the surah loads when asked for

    await openToPractice(family.root);
    assert.ok(surahLoads.indexOf(surahId) >= 0, 'the surah was requested');
    var types = [];
    while (html().indexOf('root-finish') < 0) {
      var current = rendered[rendered.length - 1];
      types.push(current.item.type);
      current.onAnswer(true, current.item.answer);
      clickAction('next');
    }
    assert.strictEqual(types[types.length - 1], 'spot');
    var readCount = types.filter(function(type) { return type === 'read-choose'; }).length;
    assert.strictEqual(rated.length, readCount, 'only the read-choose answers are rated');
  });

  test('a surah already in memory gives exactly one spot exercise', async function() {
    resetScreen();
    var family = findFamily(function(f) {
      return f.words.length >= 2 && f.words.some(function(w) {
        return w.arabic.split(/\s+/).length === 1 && w.occurrences && w.occurrences.length > 0;
      });
    });
    var anchor = family.words.filter(function(w) {
      return w.arabic.split(/\s+/).length === 1 && w.occurrences && w.occurrences.length > 0;
    })[0];
    var key = anchor.occurrences[0].verseKey;
    var surahId = Number(key.split(':')[0]);
    AYAHS[key] = 'وَقَالَ ' + anchor.arabic + ' لَهُمُ';
    LOADED = [surahId];
    AYAHS['load:' + surahId] = true;

    await startRootLesson(family.root);
    var spots = _rootRun.lesson.exercises.filter(function(item) { return item.type === 'spot'; });
    assert.strictEqual(spots.length, 1);
  });

  test('when the text cannot load the lesson still finishes', async function() {
    resetScreen();
    await openToPractice(FIRST.root);
    answerAll(function() { return true; });
    assert.deepStrictEqual(completed, [FIRST.root]);
  });

  test('item text is escaped in the markup', async function() {
    resetScreen();
    var family = FAMILIES[2];
    var word = family.words[0];
    var originalEnglish = word.english;
    word.english = '<img src=x>';
    try {
      await startRootLesson(family.root);
      renderRootLesson();
      clickAction('continue');
      assert.ok(html().indexOf('<img src=x>') < 0);
      assert.ok(html().indexOf('&lt;img src=x&gt;') >= 0);
    } finally {
      word.english = originalEnglish;
    }
  });
});

pending.then(function() {
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  process.exit(failed > 0 ? 1 : 0);
});
