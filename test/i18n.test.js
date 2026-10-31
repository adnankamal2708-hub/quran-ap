#!/usr/bin/env node
/**
 * i18n.test.js — Unit tests for the English strings file and t() lookup
 *
 * Tests: key lookup, {name} placeholder filling, missing-key fallback and
 * diagnostics, and the exact English values for the keys later tasks use.
 *
 * Run: node test/i18n.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// LOAD THE MODULE
// ═══════════════════════════════════════════════════════════════

global.window = {};

// Indirect eval so the file's top-level declarations (STRINGS, t) become globals.
var stringsPath = path.join(__dirname, '..', 'js', 'i18n', 'strings-en.js');
(0, eval)(fs.readFileSync(stringsPath, 'utf8'));

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  window.__diag = undefined;
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) { console.log('\n📋 ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('t() lookup', function() {
  test('returns the English string for a known key', function() {
    assert.strictEqual(t('level.0'), 'Beginner');
  });

  test('fills {name} placeholders from vars', function() {
    assert.strictEqual(t('percent.words', { p: 43.2 }), "43.2% of the Quran's words understood");
  });

  test('fills a placeholder with curly quotes around it', function() {
    assert.strictEqual(t('drill.spot.prompt', { meaning: 'book' }),
      'Tap every word that means “book”');
  });

  test('returns the key itself for a missing key', function() {
    assert.strictEqual(t('no.such.key'), 'no.such.key');
  });

  test('missing key does not throw when window.__diag is absent', function() {
    assert.strictEqual(t('no.such.key', { p: 1 }), 'no.such.key');
  });

  test('missing key calls window.__diag.warn when available', function() {
    var calls = [];
    window.__diag = { warn: function() { calls.push([].slice.call(arguments)); } };
    assert.strictEqual(t('no.such.key'), 'no.such.key');
    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].join(' ').indexOf('no.such.key') >= 0, 'warn message should name the key');
  });

  test('a known key does not call window.__diag.warn', function() {
    var calls = 0;
    window.__diag = { warn: function() { calls++; } };
    t('level.0');
    assert.strictEqual(calls, 0);
  });
});

suite('STRINGS table', function() {
  test('exposes STRINGS.en as a flat key-to-string map', function() {
    assert.strictEqual(typeof STRINGS.en, 'object');
    assert.strictEqual(STRINGS.en['level.1'], 'Elementary');
  });

  // Every key the Phase 1 tasks render, with the exact English value from the brief.
  var EXPECTED = {
    'track.qaida.name': 'Read Arabic from zero',
    'track.tajweed.name': 'Tajweed',
    'track.words.name': 'Word meanings',
    'track.understanding.name': 'Understanding',
    'track.qaida.desc': 'Learn to read the Arabic letters and marks',
    'track.tajweed.desc': 'Recite with correct pronunciation and rules',
    'track.words.desc': "Learn the meanings of the Quran's words",
    'track.understanding.desc': 'Translation and the grammar behind it',
    'level.0': 'Beginner',
    'level.1': 'Elementary',
    'level.2': 'Intermediate',
    'level.3': 'Advanced',
    'percent.words': "{p}% of the Quran's words understood",
    'percent.words.gained': "+{p}% of the Quran's words",
    'tracks.comingSoon': 'Coming soon',
    'tracks.add': 'Add a track',
    'tracks.makeMain': 'Make main track',
    'tracks.leave': 'Leave track',
    'tracks.main': 'Main track',
    'tracks.allWords': 'All words',
    'tracks.roots': 'Roots',
    'tracks.difficulty': 'Difficulty',
    'tracks.quiz': 'Quiz',
    'practice.due': 'Due today',
    'practice.drills': 'Drills',
    'practice.tests': 'Tests',
    'test.words.title': 'Word meanings placement test',
    'test.words.desc': 'About 5 minutes · finds your level',
    'test.result.level': 'Your level: {level}',
    'test.result.kept': "You're already at {level}; your level stays.",
    'test.result.strengths': 'Strengths',
    'test.result.gaps': 'To work on',
    'test.result.start': 'Start at {lesson}',
    'onboarding.tracks.title': 'What do you want to learn?',
    'onboarding.tracks.desc': 'Pick one or more. You can change this any time.',
    'onboarding.new': "I'm completely new",
    'onboarding.new.desc': 'Start from the very beginning',
    'onboarding.test': 'Take a short test',
    'onboarding.test.desc': 'Find your level in about 5 minutes',
    'drill.spot.title': 'Spot the word',
    'drill.spot.prompt': 'Tap every word that means “{meaning}”',
    'drill.build.title': 'Build the verse',
    'drill.build.prompt': 'Put the words in order',
  };

  Object.keys(EXPECTED).forEach(function(key) {
    test('has the exact English value for ' + key, function() {
      assert.strictEqual(STRINGS.en[key], EXPECTED[key]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
