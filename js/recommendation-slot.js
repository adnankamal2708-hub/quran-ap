// ═══════════════════════════════════════════════════════════════
// recommendation-slot.js — Dashboard Primary Recommendation Slot
//
// Collects all available recommendations and returns exactly one
// highest-priority recommendation. This keeps the Dashboard clean
// and makes it easy to add future recommendation types (e.g.
// premium upgrade, free trial, new feature announcements) by
// inserting a new priority rule.
//
// Priority order (highest to lowest):
//   1. Reviews due
//   2. Continue Foundation lesson
//   3. Guided Reading (Phase 2)
//   4. Vocabulary expansion (Phase 2 independent)
//   5. Daily learning goal
//   6. Encouragement / momentum message
//   7. Generic learning recommendation (fallback)
//
// USAGE:
//   var rec = window.__recommendationSlot.getPrimary(state);
//   if (rec) { /* render rec.cardHtml */ }
//
// Future premium items can be added by inserting a new priority
// tier in the _PRIORITY_RULES array — no dashboard render logic
// changes needed.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Priority Rules ─────────────────────────────────────────
  // Each rule has:
  //   priority: Number (lower = higher priority)
  //   test(state): Function that returns truthy if this recommendation applies
  //   build(state): Function that returns the recommendation object

  var _PRIORITY_RULES = [
    // 1. Reviews due (highest priority — spaced repetition)
    {
      priority: 100,
      name: 'reviews-due',
      test: function (s) { return s.dueCount > 0; },
      build: function (s) {
        var due = s.dueCount;
        return {
          icon: 'repeat',
          title: (due === 1 ? '1 review' : due + ' reviews') + ' due',
          message: 'Strengthen your memory by reviewing ' + (due === 1 ? 'this word' : 'these ' + due + ' words') + ' now.',
          action: 'Start Review',
          id: 'rec-reviews',
          actionType: 'review',
        };
      },
    },

    // 2. Build foundation (new user — no learning evidence yet)
    // Must be checked before weak-areas and continue-foundation so brand-new
    // users receive the onboarding recommendation rather than a generic one.
    {
      priority: 150,
      name: 'build-foundation',
      test: function (s) { return s.noProgress; },
      build: function (s) {
        return {
          icon: 'star',
          title: 'Build your foundation',
          message: 'Complete your first lesson to establish your learning baseline. Bayan will personalize future recommendations as you progress.',
          action: 'Start lesson',
          id: 'rec-foundation-start',
          actionType: 'foundation',
        };
      },
    },

    // 3. Weak areas — only when sufficient learning evidence exists
    // Checked before continue-foundation so experienced users with detected
    // weaknesses see those instead of a generic "continue" message.
    {
      priority: 200,
      name: 'weak-areas',
      test: function (s) {
        return s.weaknesses && s.weaknesses.length > 0
          && (s.fCompleted >= 1 || s.masteredCount >= 3 || (s.totalReviews || 0) >= 5);
      },
      build: function (s) {
        var count = s.weaknesses.length;
        return {
          icon: 'alert-triangle',
          title: count + ' weak area' + (count > 1 ? 's' : '') + ' detected',
          message: 'Focus on ' + s.weaknesses[0].name + (count > 1 ? ' and ' + (count - 1) + ' more' : '') + ' to strengthen your foundation.',
          action: 'Review',
          id: 'rec-weak',
          actionType: 'review',
        };
      },
    },

    // 4. Continue Foundation lesson (user has started but hasn't completed)
    // Requires !s.noProgress so brand-new users don't skip to this before
    // seeing the onboarding recommendation.
    {
      priority: 250,
      name: 'continue-foundation',
      test: function (s) { return !s.noProgress && s.fTotal > 0 && !s.foundationComplete; },
      build: function (s) {
        var nextNum = (s.nextIncompleteF || 0) + 1;
        var lessonTitle = s.nextLessonTitle || '';
        var title = lessonTitle
          ? 'Foundation ' + nextNum + ': ' + lessonTitle
          : 'Continue Foundation ' + nextNum;
        return {
          icon: 'layers',
          title: title,
          message: 'Lesson ' + nextNum + ' of ' + s.fTotal + ' — ' + (s.comprehensionGain ? '+' + s.comprehensionGain + '% comprehension gain' : 'building your Quran vocabulary'),
          action: 'Resume',
          id: 'rec-foundation',
          actionType: 'foundation',
        };
      },
    },

    // 5. Guided Reading (Phase 2 Foundation Complete)
    {
      priority: 300,
      name: 'guided-reading',
      test: function (s) { return s.foundationComplete && s.p2Phase === 'guided-reading' && s.nextSurahPreview != null; },
      build: function (s) {
        var preview = s.nextSurahPreview;
        return {
          icon: 'book',
          title: 'Read ' + (preview.surahName || 'Surah ' + preview.surahId),
          message: (preview.estimatedComprehension || 0) + '% estimated comprehension · ' + (preview.knownWords || 0) + ' words you know',
          action: 'Read',
          id: 'rec-guided-reading',
          actionType: 'reading',
        };
      },
    },

    // 6. Vocabulary expansion (Phase 2 — independent reading)
    {
      priority: 400,
      name: 'vocabulary-expansion',
      test: function (s) { return s.foundationComplete && s.p2Phase === 'phase2' && s.expansionWords && s.expansionWords.length > 0; },
      build: function (s) {
        return {
          icon: 'layers',
          title: 'Expand Your Vocabulary',
          message: s.expansionWords.length + ' new high-frequency words available to learn',
          action: 'Explore',
          id: 'rec-expansion',
          actionType: 'foundation',
        };
      },
    },

    // 7. Reading recommendation (if not read yet, and no foundation)
    {
      priority: 700,
      name: 'begin-reading',
      test: function (s) { return !s.lastRead || !s.lastRead.surahId; },
      build: function (s) {
        return {
          icon: 'book',
          title: 'Begin reading the Quran',
          message: 'Reading the Quran alongside vocabulary study reinforces your learning in real context.',
          action: 'Open Quran',
          id: 'rec-reading',
          actionType: 'reading',
        };
      },
    },

    // 8. Smart Learning Engine recommendation (if score is high enough)
    {
      priority: 750,
      name: 'sle-recommendation',
      test: function (s) {
        return s.sleRec && s.sleRec.score >= 20;
      },
      build: function (s) {
        return {
          icon: s.sleRec.icon || 'lightbulb',
          title: s.sleRec.title || 'Recommendation',
          message: s.sleRec.message || '',
          action: s.sleRec.action || '→',
          id: 'rec-sle',
          actionType: s.sleRec.actionType || 'foundation',
        };
      },
    },

    // 9. Generic encouragement / momentum (fallback)
    {
      priority: 800,
      name: 'encouragement',
      test: function (s) { return s.masteredCount > 0 || s.comprehensionPct > 0; },
      build: function (s) {
        return {
          icon: 'check-circle',
          title: s.masteredCount + ' Words Mastered',
          message: s.coveragePct + '% Quran coverage — keep building your understanding!',
          action: 'Continue',
          id: 'rec-encouragement',
          actionType: 'foundation',
        };
      },
    },
  ];

  // ── getPrimaryRecommendation ─────────────────────────────────
  /**
   * Given the current learning state, returns the single highest-priority
   * recommendation or null if none apply.
   *
   * @param {Object} state — Dashboard-collected state (see js/ui/dashboard.js)
   * @returns {Object|null} — { icon, title, message, action, id, actionType }
   */
  function getPrimaryRecommendation(state) {
    if (!state) return null;

    for (var i = 0; i < _PRIORITY_RULES.length; i++) {
      var rule = _PRIORITY_RULES[i];
      try {
        if (rule.test(state)) {
          return rule.build(state);
        }
      } catch (e) {
        // Rule evaluation error — skip to next rule
        if (window.__DEV__) console.warn('[rec-slot] Rule "' + rule.name + '" failed:', e.message);
      }
    }

    return null;
  }

  // ── Public API ───────────────────────────────────────────────
  window.__recommendationSlot = {
    getPrimary: getPrimaryRecommendation,
    // Expose rules for extensibility — premium items can push new rules
    addRule: function (rule) {
      if (rule && rule.priority && rule.test && rule.build) {
        _PRIORITY_RULES.push(rule);
        // Sort by priority ascending (lower = higher pri)
        _PRIORITY_RULES.sort(function (a, b) { return a.priority - b.priority; });
      }
    },
    getRules: function () { return _PRIORITY_RULES.slice(); },
  };

})();
