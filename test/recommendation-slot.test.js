#!/usr/bin/env node
/**
 * recommendation-slot.test.js — Unit tests for the Dashboard Recommendation Slot
 *
 * Tests all 9 priority rules, priority ordering, edge cases,
 * public API (getPrimary, addRule, getRules), determinism,
 * and null return when no rules apply.
 *
 * Run: node test/recommendation-slot.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// LOAD THE MODULE
// ═══════════════════════════════════════════════════════════════

global.window = {};
var slotCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'recommendation-slot.js'), 'utf8');
eval(slotCode);
var slot = global.window.__recommendationSlot;

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\ud83d\udccb ' + name); fn(); }

function assertRecShape(rec, ruleName) {
  assert.ok(rec !== null && rec !== undefined, ruleName + ': recommendation should not be null');
  assert.ok(typeof rec.icon === 'string' && rec.icon.length > 0, ruleName + ': icon is a non-empty string');
  assert.ok(typeof rec.title === 'string' && rec.title.length > 0, ruleName + ': title is a non-empty string');
  assert.ok(typeof rec.message === 'string' && rec.message.length > 0, ruleName + ': message is a non-empty string');
  assert.ok(typeof rec.action === 'string' && rec.action.length > 0, ruleName + ': action is a non-empty string');
  assert.ok(typeof rec.id === 'string' && rec.id.length > 0, ruleName + ': id is a non-empty string');
  assert.ok(typeof rec.actionType === 'string' && rec.actionType.length > 0, ruleName + ': actionType is a non-empty string');
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Public API', function() {
  test('getPrimary is a function', function() {
    assert.strictEqual(typeof slot.getPrimary, 'function');
  });

  test('addRule is a function', function() {
    assert.strictEqual(typeof slot.addRule, 'function');
  });

  test('getRules is a function', function() {
    assert.strictEqual(typeof slot.getRules, 'function');
  });

  test('getRules returns a copy (not a reference)', function() {
    var rules = slot.getRules();
    var rules2 = slot.getRules();
    rules.push('pollution');
    assert.strictEqual(rules2.length, 9, 'getRules returns a copy — original unaffected');
    assert.strictEqual(rules2.length, 9, 'original rules unchanged after push to copy');
  });

  test('getPrimary returns null for null/undefined state', function() {
    assert.strictEqual(slot.getPrimary(null), null);
    assert.strictEqual(slot.getPrimary(undefined), null);
  });

  test('getPrimary returns null when no rules match', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      noProgress: false,
      fTotal: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      weaknesses: [],
      lastRead: { surahId: 1, verseKey: '1:1' },
    });
    assert.strictEqual(rec, null);
  });
});

suite('Rule 1 — Reviews Due (priority 100)', function() {
  test('returns rec when dueCount > 0', function() {
    var rec = slot.getPrimary({ dueCount: 3 });
    assertRecShape(rec, 'reviews-due');
    assert.ok(rec.title.indexOf('3 reviews') >= 0, 'title mentions count: ' + rec.title);
    assert.strictEqual(rec.id, 'rec-reviews');
    assert.strictEqual(rec.actionType, 'review');
    assert.strictEqual(rec.action, 'Start Review');
  });

  test('singular "1 review" when dueCount is 1', function() {
    var rec = slot.getPrimary({ dueCount: 1 });
    assert.strictEqual(rec.title, '1 review due');
    assert.ok(rec.message.indexOf('this word') >= 0, 'message uses singular: ' + rec.message);
  });

  test('plural "N reviews" when dueCount > 1', function() {
    var rec = slot.getPrimary({ dueCount: 5 });
    assert.strictEqual(rec.title, '5 reviews due');
    assert.ok(rec.message.indexOf('these 5 words') >= 0, 'message uses plural: ' + rec.message);
  });

  test('does NOT fire when dueCount is 0', function() {
    // Only matched rules should fire — start with state that has 0 dueCount
    var rec = slot.getPrimary({ dueCount: 0, noProgress: true });
    assert.strictEqual(rec.id, 'rec-foundation-start', 'fall through to build-foundation');
  });
});

suite('Rule 2 — Build Foundation (priority 150)', function() {
  test('returns onboarding rec when noProgress is true', function() {
    var rec = slot.getPrimary({ noProgress: true, dueCount: 0 });
    assertRecShape(rec, 'build-foundation');
    assert.strictEqual(rec.title, 'Build your foundation');
    assert.strictEqual(rec.id, 'rec-foundation-start');
    assert.strictEqual(rec.actionType, 'foundation');
    assert.ok(rec.message.indexOf('first lesson') >= 0, 'message mentions first lesson');
  });

  test('does NOT fire when noProgress is false', function() {
    var rec = slot.getPrimary({ noProgress: false, dueCount: 0, masteredCount: 0, comprehensionPct: 0, coveragePct: 0, lastRead: { surahId: 1 } });
    assert.strictEqual(rec, null, 'no rule should match');
  });
});

suite('Rule 3 — Weak Areas (priority 200)', function() {
  var weakState = {
    weaknesses: [{ name: '3 words forgotten' }, { name: '5 overdue' }],
    fCompleted: 2,
    masteredCount: 5,
    totalReviews: 20,
    dueCount: 0,
    noProgress: false,
  };

  test('returns weak-area rec when weaknesses exist with sufficient evidence', function() {
    var rec = slot.getPrimary(weakState);
    assertRecShape(rec, 'weak-areas');
    assert.strictEqual(rec.id, 'rec-weak');
    assert.strictEqual(rec.actionType, 'review');
    assert.ok(rec.title.indexOf('2 weak areas') >= 0, 'title mentions count: ' + rec.title);
    assert.ok(rec.message.indexOf('3 words forgotten') >= 0, 'message mentions first weakness: ' + rec.message);
  });

  test('singular "1 weak area" when single weakness', function() {
    var rec = slot.getPrimary({
      weaknesses: [{ name: 'forgotten words' }],
      fCompleted: 1,
      masteredCount: 3,
      totalReviews: 5,
      dueCount: 0,
      noProgress: false,
    });
    assert.ok(rec.title.indexOf('1 weak area') >= 0, 'singular title: ' + rec.title);
  });

  test('does NOT fire when weaknesses exist but no evidence (0 lessons, 0 mastered, 0 reviews)', function() {
    var rec = slot.getPrimary({
      weaknesses: [{ name: 'test' }],
      fCompleted: 0,
      masteredCount: 0,
      totalReviews: 0,
      dueCount: 0,
      noProgress: false,
      fTotal: 10,
      foundationComplete: false,
    });
    assert.notStrictEqual(rec, null, 'should match a rule');
    assert.notStrictEqual(rec.id, 'rec-weak', 'should NOT be weak-areas (fCompleted < 1, masteredCount < 3, totalReviews < 5)');
  });

  test('does NOT fire when evidence threshold met but no weaknesses', function() {
    var rec = slot.getPrimary({
      weaknesses: [],
      fCompleted: 5,
      masteredCount: 10,
      totalReviews: 50,
      dueCount: 0,
      noProgress: false,
      fTotal: 10,
      foundationComplete: false,
    });
    assert.notStrictEqual(rec.id, 'rec-weak', 'should skip weak-areas when weaknesses is empty');
  });

  test('evidence threshold: fCompleted >= 1 is sufficient', function() {
    var rec = slot.getPrimary({
      weaknesses: [{ name: 'test' }],
      fCompleted: 1,
      masteredCount: 0,
      totalReviews: 0,
      dueCount: 0,
      noProgress: false,
    });
    assert.strictEqual(rec.id, 'rec-weak', 'weak areas fires when fCompleted >= 1');
  });

  test('evidence threshold: masteredCount >= 3 is sufficient', function() {
    var rec = slot.getPrimary({
      weaknesses: [{ name: 'test' }],
      fCompleted: 0,
      masteredCount: 3,
      totalReviews: 0,
      dueCount: 0,
      noProgress: false,
    });
    assert.strictEqual(rec.id, 'rec-weak', 'weak areas fires when masteredCount >= 3');
  });

  test('evidence threshold: totalReviews >= 5 is sufficient', function() {
    var rec = slot.getPrimary({
      weaknesses: [{ name: 'test' }],
      fCompleted: 0,
      masteredCount: 0,
      totalReviews: 5,
      dueCount: 0,
      noProgress: false,
    });
    assert.strictEqual(rec.id, 'rec-weak', 'weak areas fires when totalReviews >= 5');
  });
});

suite('Rule 4 — Continue Foundation (priority 250)', function() {
  var contState = {
    noProgress: false,
    fTotal: 10,
    foundationComplete: false,
    nextIncompleteF: 3,
    nextLessonTitle: 'The Most Merciful',
    comprehensionGain: 5,
    dueCount: 0,
    masteredCount: 0,
    comprehensionPct: 0,
    coveragePct: 0,
  };

  test('returns foundation rec when user has started but not completed', function() {
    var rec = slot.getPrimary(contState);
    assertRecShape(rec, 'continue-foundation');
    assert.strictEqual(rec.id, 'rec-foundation');
    assert.strictEqual(rec.actionType, 'foundation');
    assert.ok(rec.title.indexOf('Foundation 4') >= 0, 'title shows lesson number: ' + rec.title);
    assert.ok(rec.title.indexOf('The Most Merciful') >= 0, 'title shows lesson name: ' + rec.title);
    assert.ok(rec.message.indexOf('+5% comprehension gain') >= 0, 'message shows comprehension gain: ' + rec.message);
    assert.strictEqual(rec.action, 'Resume');
  });

  test('uses fallback title when no lessonTitle provided', function() {
    var rec = slot.getPrimary({
      noProgress: false,
      fTotal: 10,
      foundationComplete: false,
      nextIncompleteF: 5,
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.ok(rec.title.indexOf('Continue Foundation 6') >= 0, 'fallback title: ' + rec.title);
  });

  test('uses generic message when no comprehensionGain', function() {
    var rec = slot.getPrimary({
      noProgress: false,
      fTotal: 10,
      foundationComplete: false,
      nextIncompleteF: 0,
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.ok(rec.message.indexOf('building your Quran vocabulary') >= 0, 'generic message: ' + rec.message);
  });
});

suite('Rule 5 — Guided Reading (priority 300)', function() {
  test('returns guided-reading rec when foundation complete + p2Phase guided', function() {
    var rec = slot.getPrimary({
      foundationComplete: true,
      p2Phase: 'guided-reading',
      nextSurahPreview: { surahName: 'Al-Fatihah', surahId: 1, estimatedComprehension: 72, knownWords: 18 },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assertRecShape(rec, 'guided-reading');
    assert.strictEqual(rec.id, 'rec-guided-reading');
    assert.strictEqual(rec.actionType, 'reading');
    assert.ok(rec.title.indexOf('Read Al-Fatihah') >= 0, 'title mentions surah: ' + rec.title);
    assert.ok(rec.message.indexOf('72%') >= 0, 'message shows comprehension: ' + rec.message);
    assert.ok(rec.message.indexOf('18 words') >= 0, 'message shows known words: ' + rec.message);
  });

  test('does NOT fire when foundation not complete', function() {
    var rec = slot.getPrimary({
      foundationComplete: false,
      p2Phase: 'guided-reading',
      nextSurahPreview: { surahName: 'Al-Fatihah', surahId: 1 },
      dueCount: 0,
      noProgress: false,
      fTotal: 10,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.notStrictEqual(rec.id, 'rec-guided-reading', 'should not be guided-reading');
  });

  test('does NOT fire when nextSurahPreview is null', function() {
    var rec = slot.getPrimary({
      foundationComplete: true,
      p2Phase: 'guided-reading',
      nextSurahPreview: null,
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      expansionWords: [],
      lastRead: { surahId: 1 },
    });
    assert.strictEqual(rec, null, 'no rule should match');
  });
});

suite('Rule 6 — Vocabulary Expansion (priority 400)', function() {
  test('returns expansion rec when foundation complete + p2Phase + expansion words exist', function() {
    var rec = slot.getPrimary({
      foundationComplete: true,
      p2Phase: 'phase2',
      expansionWords: ['word1', 'word2', 'word3'],
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assertRecShape(rec, 'vocabulary-expansion');
    assert.strictEqual(rec.id, 'rec-expansion');
    assert.strictEqual(rec.actionType, 'foundation');
    assert.strictEqual(rec.title, 'Expand Your Vocabulary');
    assert.ok(rec.message.indexOf('3 new') >= 0, 'message shows count: ' + rec.message);
  });

  test('does NOT fire when expansionWords is empty', function() {
    var rec = slot.getPrimary({
      foundationComplete: true,
      p2Phase: 'phase2',
      expansionWords: [],
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      lastRead: { surahId: 1 },
    });
    assert.strictEqual(rec, null, 'no rule should match');
  });

  test('does NOT fire in guided-reading phase', function() {
    var rec = slot.getPrimary({
      foundationComplete: true,
      p2Phase: 'guided-reading',
      expansionWords: ['word1'],
      nextSurahPreview: { surahName: 'Test', surahId: 1, estimatedComprehension: 50, knownWords: 5 },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.strictEqual(rec.id, 'rec-guided-reading', 'guided-reading has higher priority and fires instead');
  });
});

suite('Rule 7 — Begin Reading (priority 700)', function() {
  test('returns reading rec when no lastRead', function() {
    var rec = slot.getPrimary({
      lastRead: null,
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assertRecShape(rec, 'begin-reading');
    assert.strictEqual(rec.id, 'rec-reading');
    assert.strictEqual(rec.actionType, 'reading');
    assert.strictEqual(rec.action, 'Open Quran');
    assert.ok(rec.title.indexOf('Begin reading') >= 0, 'title: ' + rec.title);
  });

  test('returns reading rec when lastRead has no surahId', function() {
    var rec = slot.getPrimary({
      lastRead: { date: Date.now() },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.strictEqual(rec.id, 'rec-reading', 'begin-reading fires when lastRead lacks surahId');
  });

  test('does NOT fire when lastRead has surahId', function() {
    var rec = slot.getPrimary({
      lastRead: { surahId: 1, verseKey: '1:1', date: Date.now() },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.strictEqual(rec, null, 'no rule matches when lastRead exists');
  });
});

suite('Rule 8 — SLE Recommendation (priority 750)', function() {
  test('returns SLE rec when sleRec has score >= 20', function() {
    var rec = slot.getPrimary({
      sleRec: { score: 65, icon: 'brain', title: 'Review weak roots', message: 'Practice root families', action: 'Start', actionType: 'root-family' },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      lastRead: { surahId: 1 },
    });
    assertRecShape(rec, 'sle-recommendation');
    assert.strictEqual(rec.id, 'rec-sle');
    assert.strictEqual(rec.title, 'Review weak roots');
    assert.strictEqual(rec.actionType, 'root-family');
  });

  test('uses defaults when sleRec fields are missing', function() {
    var rec = slot.getPrimary({
      sleRec: { score: 30 },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      lastRead: { surahId: 1 },
    });
    assert.strictEqual(rec.icon, 'lightbulb', 'default icon');
    assert.strictEqual(rec.title, 'Recommendation', 'default title');
    assert.strictEqual(rec.message, '', 'default message');
    assert.strictEqual(rec.action, '→', 'default action');
    assert.strictEqual(rec.actionType, 'foundation', 'default actionType');
  });

  test('does NOT fire when sleRec score < 20', function() {
    var rec = slot.getPrimary({
      sleRec: { score: 15 },
      dueCount: 0,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      lastRead: { surahId: 1 },
    });
    assert.strictEqual(rec, null, 'no rule matches when score < 20');
  });
});

suite('Rule 9 — Encouragement (priority 800)', function() {
  test('returns encouragement rec when masteredCount > 0', function() {
    var rec = slot.getPrimary({
      masteredCount: 15,
      comprehensionPct: 42,
      coveragePct: 30,
      dueCount: 0,
      lastRead: { surahId: 1 },
    });
    assertRecShape(rec, 'encouragement');
    assert.strictEqual(rec.id, 'rec-encouragement');
    assert.strictEqual(rec.actionType, 'foundation');
    assert.ok(rec.title.indexOf('15 Words Mastered') >= 0, 'title shows count: ' + rec.title);
    assert.ok(rec.message.indexOf('30%') >= 0, 'message shows coverage: ' + rec.message);
  });

  test('returns encouragement rec when comprehensionPct > 0 but masteredCount is 0', function() {
    var rec = slot.getPrimary({
      masteredCount: 0,
      comprehensionPct: 10,
      coveragePct: 5,
      dueCount: 0,
      lastRead: { surahId: 1 },
    });
    assert.strictEqual(rec.id, 'rec-encouragement');
  });
});

suite('Priority Ordering', function() {
  test('reviews-due (100) beats build-foundation (150)', function() {
    var rec = slot.getPrimary({
      dueCount: 1,
      noProgress: true,
    });
    assert.strictEqual(rec.id, 'rec-reviews', 'reviews-due wins over build-foundation');
  });

  test('reviews-due (100) beats weak-areas (200)', function() {
    var rec = slot.getPrimary({
      dueCount: 1,
      weaknesses: [{ name: 'test' }],
      fCompleted: 1,
      masteredCount: 3,
      totalReviews: 5,
      noProgress: false,
    });
    assert.strictEqual(rec.id, 'rec-reviews', 'reviews-due wins over weak-areas');
  });

  test('build-foundation (150) beats weak-areas (200) for new user', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      noProgress: true,
      weaknesses: [{ name: 'test' }],
      fCompleted: 0,
      masteredCount: 0,
      totalReviews: 0,
    });
    assert.strictEqual(rec.id, 'rec-foundation-start', 'build-foundation wins over weak-areas for new user');
  });

  test('weak-areas (200) beats continue-foundation (250)', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      noProgress: false,
      weaknesses: [{ name: 'test' }],
      fCompleted: 5,
      masteredCount: 10,
      totalReviews: 50,
      fTotal: 10,
      foundationComplete: false,
    });
    assert.strictEqual(rec.id, 'rec-weak', 'weak-areas wins over continue-foundation');
  });

  test('continue-foundation (250) beats guided-reading (300)', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      noProgress: false,
      fTotal: 10,
      foundationComplete: false,
      nextIncompleteF: 2,
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      // These would trigger guided-reading, but foundation is not complete
      p2Phase: 'guided-reading',
      nextSurahPreview: { surahName: 'Test', surahId: 1 },
    });
    assert.strictEqual(rec.id, 'rec-foundation', 'continue-foundation wins over guided-reading');
  });

  test('guided-reading (300) beats vocabulary-expansion (400)', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      foundationComplete: true,
      p2Phase: 'guided-reading',
      nextSurahPreview: { surahName: 'Al-Fatihah', surahId: 1, estimatedComprehension: 70, knownWords: 10 },
      expansionWords: ['word1', 'word2'],
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.strictEqual(rec.id, 'rec-guided-reading', 'guided-reading wins over vocabulary-expansion');
  });

  test('vocabulary-expansion (400) beats begin-reading (700)', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      foundationComplete: true,
      p2Phase: 'phase2',
      expansionWords: ['word1'],
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
    });
    assert.strictEqual(rec.id, 'rec-expansion', 'vocab-expansion beats begin-reading');
  });

  test('begin-reading (700) beats encouragement (800)', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      masteredCount: 10,
      comprehensionPct: 30,
      coveragePct: 15,
    });
    assert.strictEqual(rec.id, 'rec-reading', 'begin-reading beats encouragement when lastRead is absent');
  });

  test('SLE (750) beats encouragement (800)', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      sleRec: { score: 25, title: 'SLE test' },
      masteredCount: 10,
      comprehensionPct: 30,
      coveragePct: 15,
      lastRead: { surahId: 1 },
    });
    assert.strictEqual(rec.id, 'rec-sle', 'SLE beats encouragement');
  });
});

suite('Edge Cases', function() {
  test('returns no recommendation when all tests return null', function() {
    // State that satisfies NO rule: fTotal=0, noProgress=false, no weaknesses,
    // lastRead with surahId, no masteredCount, no comprehensionPct
    var rec = slot.getPrimary({
      dueCount: 0,
      noProgress: false,
      fTotal: 0,
      foundationComplete: false,
      weaknesses: [],
      masteredCount: 0,
      comprehensionPct: 0,
      coveragePct: 0,
      lastRead: { surahId: 1, verseKey: '1:1' },
    });
    assert.strictEqual(rec, null, 'returns null when no rule matches');
  });

  test('handles missing optional fields gracefully', function() {
    // State with only dueCount — should still work for reviews-due
    var rec = slot.getPrimary({ dueCount: 2 });
    assertRecShape(rec, 'partial-state');
    assert.strictEqual(rec.id, 'rec-reviews');
  });

  test('handles state with extra unknown fields', function() {
    var rec = slot.getPrimary({
      dueCount: 0,
      noProgress: true,
      unknownField: 'should be ignored',
      extra: { nested: true },
    });
    assert.strictEqual(rec.id, 'rec-foundation-start', 'ignores extra fields');
  });

  test('handles undefined dueCount gracefully', function() {
    var rec = slot.getPrimary({ dueCount: undefined, noProgress: true });
    // dueCount > 0 is false (undefined > 0 = false), falls to build-foundation
    assert.strictEqual(rec.id, 'rec-foundation-start');
  });

  test('handles string numbers in state fields', function() {
    var rec = slot.getPrimary({ dueCount: '3' });
    // '3' > 0 is true in JS
    assert.strictEqual(rec.id, 'rec-reviews');
  });
});

suite('addRule Extensibility', function() {
  test('addRule inserts a new rule and sorts by priority', function() {
    var premiumRule = {
      priority: 50,
      name: 'premium-upgrade',
      test: function(s) { return s.isFreeUser; },
      build: function(s) { return { icon: 'crown', title: 'Go Premium', message: 'Unlock advanced features', action: 'Upgrade', id: 'rec-premium', actionType: 'premium' }; },
    };
    slot.addRule(premiumRule);

    // Premium rule (50) should win over reviews-due (100)
    var rec = slot.getPrimary({ isFreeUser: true, dueCount: 5 });
    assert.strictEqual(rec.id, 'rec-premium', 'premium (50) beats reviews-due (100)');

    var rules = slot.getRules();
    assert.strictEqual(rules[0].priority, 50, 'premium rule is first (highest priority)');
  });

  test('addRule rejects invalid rules', function() {
    var ruleCount = slot.getRules().length;
    slot.addRule(null);
    slot.addRule({ priority: 99 });  // no test or build
    slot.addRule({ test: function() {}, build: function() {} });  // no priority
    assert.strictEqual(slot.getRules().length, ruleCount, 'invalid rules are not added');
  });
});

suite('Determinism', function() {
  test('same state produces same recommendation every call', function() {
    var state = {
      dueCount: 0,
      noProgress: false,
      weaknesses: [{ name: 'test weakness' }],
      fCompleted: 5,
      masteredCount: 10,
      totalReviews: 50,
    };
    var rec1 = slot.getPrimary(state);
    var rec2 = slot.getPrimary(state);
    assert.strictEqual(rec1.id, rec2.id);
    assert.strictEqual(rec1.title, rec2.title);
    assert.strictEqual(rec1.message, rec2.message);
  });

  test('multiple calls with same state do not mutate internal rules', function() {
    var before = slot.getRules().length;
    var state = { dueCount: 1 };
    for (var i = 0; i < 10; i++) {
      slot.getPrimary(state);
    }
    var after = slot.getRules().length;
    assert.strictEqual(before, after, 'rule count unchanged after 10 calls');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
