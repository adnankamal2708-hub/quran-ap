# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sle-diagnostic.spec.js >> Smart Learning Engine E2E >> SLE module loads and renders on dashboard
- Location: test\e2e\sle-diagnostic.spec.js:9:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#tab-learn')
    - locator resolved to <button type="button" id="tab-learn" class="nav-tab">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="dialog" aria-modal="true" id="onboarding-overlay" aria-label="Welcome tour" class="onboarding-overlay">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="dialog" aria-modal="true" id="onboarding-overlay" aria-label="Welcome tour" class="onboarding-overlay">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    45 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div role="dialog" aria-modal="true" id="onboarding-overlay" aria-label="Welcome tour" class="onboarding-overlay">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#content"
  - application "Bayan — Quran Learning App" [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e7]: بِسْمِ اللَّهِ
          - generic [ref=e8]: ✓ Offline ready
          - generic [ref=e9]:
            - img [ref=e10]
            - text: Guest
        - button "Account" [ref=e14] [cursor=pointer]:
          - generic [ref=e15]: 👤
      - status "Learning statistics" [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: 📖 Lesson 1 — Sequential Vocabulary
          - generic [ref=e20]: 10 words · ~3.2% of Quranic occurrences · 0 of 90 lessons complete
        - generic [ref=e21]: ·
        - generic [ref=e22]: "0"
        - generic [ref=e23]: Learned
        - generic [ref=e24]: ·
        - generic [ref=e25]: "0"
        - generic [ref=e26]: Due
        - generic [ref=e27]: ·
        - generic [ref=e28]: —
        - generic [ref=e29]: Quiz
        - 'progressbar "Daily review goal: 0 of 25 (0%)" [ref=e30] [cursor=pointer]':
          - img [ref=e31]:
            - generic [ref=e34]: "0"
      - progressbar "Session progress" [ref=e35]:
        - generic [ref=e38]: 1 / 10
    - main [ref=e39]:
      - region "Learning Dashboard" [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - img [ref=e44]
            - generic [ref=e47]:
              - heading "Assalamu Alaikum" [level=2] [ref=e48]
              - paragraph [ref=e49]: Your journey to understand the Quran
          - generic [ref=e50]:
            - 'button "Streak: 0 days" [ref=e51]':
              - img [ref=e53]
              - generic [ref=e55]: "0"
              - generic [ref=e56]: Streak
            - 'button "Words mastered: 0" [ref=e57]':
              - generic [ref=e58]: "0"
              - generic [ref=e59]: Mastered
            - 'button "Quran comprehension: 0%" [ref=e60]':
              - generic [ref=e61]: 0%
              - generic [ref=e62]: Comprehension
            - 'button "Reviews today: 0" [ref=e63]':
              - generic [ref=e64]: "0"
              - generic [ref=e65]: Reviews
          - generic [ref=e66]:
            - img [ref=e68]
            - text: Recommended Path
          - generic [ref=e70]:
            - generic [ref=e71]:
              - img [ref=e73]:
                - generic [ref=e76]: 0%
              - generic [ref=e77]:
                - generic [ref=e78]: Foundation Course
                - generic [ref=e79]: The Essential Framework
                - generic [ref=e80]: Lesson 1 of 10
            - generic [ref=e82]: 📈 +19.2% comprehension · Covers 46.8% of occurrences
            - button "Start Foundation Course" [ref=e84] [cursor=pointer]
          - generic [ref=e85]:
            - img [ref=e87]
            - text: Learning Paths
          - generic [ref=e91]:
            - 'button "Foundation Course: 0 of 10 lessons" [ref=e92] [cursor=pointer]':
              - generic [ref=e93]:
                - img [ref=e95]
                - generic [ref=e99]:
                  - generic [ref=e100]:
                    - text: Foundation Course
                    - generic [ref=e101]:
                      - img [ref=e102]
                      - text: Recommended
                  - generic [ref=e104]: 0 of 10 lessons · ~0% Quran coverage
              - generic [ref=e107]: 0%
            - 'button "Learn by Surah: 0 of 114 surahs" [ref=e108] [cursor=pointer]':
              - generic [ref=e109]:
                - img [ref=e111]
                - generic [ref=e114]:
                  - generic [ref=e115]: Learn by Surah
                  - generic [ref=e116]: 0 of 114 surahs studied
              - generic [ref=e119]: 0%
            - 'button "Learn by Root Words: 0 of 552 roots" [ref=e120] [cursor=pointer]':
              - generic [ref=e121]:
                - img [ref=e123]
                - generic [ref=e125]:
                  - generic [ref=e126]: Learn by Root Words
                  - generic [ref=e127]: 0 of 552 root families
              - generic [ref=e130]: 0%
            - 'button "Learn by Difficulty: 0 of 5 levels" [ref=e131] [cursor=pointer]':
              - generic [ref=e132]:
                - img [ref=e134]
                - generic [ref=e138]:
                  - generic [ref=e139]: Learn by Difficulty
                  - generic [ref=e140]: 0 of 5 levels complete
              - generic [ref=e143]: 0%
            - 'button "Mixed Review: 25 words ready" [ref=e144] [cursor=pointer]':
              - generic [ref=e145]:
                - img [ref=e147]
                - generic [ref=e149]:
                  - generic [ref=e150]: Mixed Review
                  - generic [ref=e151]: 25 words ready
              - generic [ref=e152]: Review →
          - generic [ref=e153]:
            - img [ref=e155]
            - text: Progress Snapshot
          - generic [ref=e157]:
            - generic [ref=e158]:
              - generic [ref=e159]: 0%
              - generic [ref=e160]: Comprehension
            - generic [ref=e161]:
              - generic [ref=e162]: "0"
              - generic [ref=e163]: Words Mastered
            - generic [ref=e164]:
              - generic [ref=e165]: 0/114
              - generic [ref=e166]: Surahs (50%+)
            - generic [ref=e167]:
              - generic [ref=e168]: 0/10
              - generic [ref=e169]: Foundation
            - generic [ref=e170]:
              - img [ref=e172]
              - generic [ref=e174]: "0"
              - generic [ref=e175]: Day Streak
            - generic [ref=e176]:
              - generic [ref=e177]: "0"
              - generic [ref=e178]: Due Reviews
          - generic [ref=e180]:
            - img [ref=e182]
            - generic [ref=e186]: "Next milestone: 🌱 First Steps — ~1 lessons away"
          - button "Toggle weekly forecast" [ref=e188] [cursor=pointer]:
            - generic [ref=e189]:
              - img [ref=e190]
              - text: Review Forecast
            - generic [ref=e192]: ▶
          - generic [ref=e194]:
            - generic [ref=e195]:
              - img [ref=e196]
              - text: Recent Achievements
            - generic [ref=e200]:
              - img [ref=e201]
              - text: 939 total words
          - generic [ref=e204]:
            - img [ref=e205]
            - text: Today's Plan
          - generic [ref=e209]:
            - img [ref=e211]
            - text: Complete Foundation Lesson 1 of 10
          - 'button "Continue Lesson 1: The Essential Framework" [ref=e214]':
            - generic [ref=e215]:
              - img [ref=e217]
              - generic [ref=e220]:
                - generic [ref=e221]: "Continue Lesson 1: The Essential Framework"
                - generic [ref=e222]: Completing this lesson will increase your Quran comprehension by +19.2%.
              - generic [ref=e223]: Continue Foundation Course
          - generic [ref=e224]:
            - img [ref=e225]
            - text: Smart Recommendations
          - generic [ref=e227]:
            - button "Strengthen Root أ-ل-و (To be blessed, to be favored)" [ref=e228]:
              - generic [ref=e229]:
                - generic [ref=e230]: "100"
                - generic [ref=e231]:
                  - generic [ref=e232]:
                    - img [ref=e233]
                    - text: Strengthen Root أ-ل-و (To be blessed, to be favored)
                  - generic [ref=e236]: Root family mastery is only 0% (0/2 words). Strengthening this root helps you recognize related Quranic vocabulary.
                - generic [ref=e237]: Practice Root
            - button "Improve الفاتحة Comprehension" [ref=e238]:
              - generic [ref=e239]:
                - generic [ref=e240]: "100"
                - generic [ref=e241]:
                  - generic [ref=e242]:
                    - img [ref=e243]
                    - text: Improve الفاتحة Comprehension
                  - generic [ref=e246]: Your comprehension of الفاتحة is only 0% (0/12 words mastered). Studying its vocabulary will boost your understanding.
                - generic [ref=e247]: Study Surah
            - button "Start Your Foundation Course" [ref=e248]:
              - generic [ref=e249]:
                - generic [ref=e250]: "65"
                - generic [ref=e251]:
                  - generic [ref=e252]:
                    - img [ref=e253]
                    - text: Start Your Foundation Course
                  - generic [ref=e255]: Begin your journey to understand the Quran. The Foundation Course teaches the 100 most frequent words — covering ~84% of all Quranic word occurrences in just 10 lessons.
                - generic [ref=e256]: Continue
          - generic [ref=e257]:
            - img [ref=e258]
            - text: Weak Areas
          - generic [ref=e260]:
            - generic [ref=e261]:
              - text: 🔴Nouns
              - generic [ref=e262]: "!"
            - generic [ref=e263]:
              - text: 🔴Verbs
              - generic [ref=e264]: "!"
            - generic [ref=e265]:
              - text: 🔴Adjectives
              - generic [ref=e266]: "!"
            - generic [ref=e267]:
              - text: 🔴Pronouns
              - generic [ref=e268]: "!"
          - generic [ref=e269]:
            - img [ref=e270]
            - text: Your Progress
          - generic [ref=e273]:
            - generic [ref=e274]:
              - generic [ref=e275]:
                - img [ref=e276]
                - text: "Daily Goal: 15 min"
              - generic [ref=e282]: 0 / 15 min
            - generic [ref=e283]:
              - generic [ref=e284]:
                - img [ref=e285]
                - text: Consistency
              - generic [ref=e287]:
                - generic [ref=e288]: "0"
                - generic [ref=e289]: day streak
                - generic [ref=e290]: 100% retention
    - navigation "Main navigation" [ref=e291]:
      - button "Paths" [ref=e292] [cursor=pointer]:
        - img [ref=e294]
        - generic [ref=e298]: Paths
      - button "Learn" [ref=e299] [cursor=pointer]:
        - img [ref=e301]
        - generic [ref=e304]: Learn
      - button "Quiz" [ref=e305] [cursor=pointer]:
        - img [ref=e307]
        - generic [ref=e309]: Quiz
      - button "Words" [ref=e310] [cursor=pointer]:
        - img [ref=e312]
        - generic [ref=e313]: Words
      - button "Stats" [ref=e314] [cursor=pointer]:
        - img [ref=e316]
        - generic [ref=e317]: Stats
      - button "Analytics" [ref=e318] [cursor=pointer]:
        - img [ref=e320]
        - generic [ref=e323]: Analytics
      - button "Read" [ref=e324] [cursor=pointer]:
        - img [ref=e326]
        - generic [ref=e329]: Read
  - dialog "Welcome tour" [ref=e330]:
    - generic [ref=e331]:
      - button "Skip tour" [active] [ref=e332] [cursor=pointer]: Skip
      - generic [ref=e333]:
        - generic [ref=e334]: 📖
        - heading "Bayan" [level=2] [ref=e335]
        - paragraph [ref=e336]: Understand the Quran, one word at a time. Your personal guide to learning the vocabulary of the Quran through spaced repetition, root analysis, and contextual learning.
      - button "Next →" [ref=e338] [cursor=pointer]
```

# Test source

```ts
  1   | // ═══════════════════════════════════════════════════════════════
  2   | // sle-diagnostic.spec.js — Smart Learning Engine E2E Diagnostic
  3   | // ═══════════════════════════════════════════════════════════════
  4   | 
  5   | const { test, expect } = require('@playwright/test');
  6   | 
  7   | test.describe('Smart Learning Engine E2E', () => {
  8   | 
  9   |   test('SLE module loads and renders on dashboard', async ({ page }) => {
  10  |     // Track console errors
  11  |     const consoleErrors = [];
  12  |     page.on('console', msg => {
  13  |       if (msg.type() === 'error') {
  14  |         consoleErrors.push(msg.text());
  15  |       }
  16  |     });
  17  | 
  18  |     // Navigate to app
  19  |     await page.goto('/');
  20  | 
  21  |     // Wait for splash screen to disappear (max 10s)
  22  |     // The splash has class 'splash-screen' and gets 'splash-hidden' class
  23  |     await page.waitForFunction(() => {
  24  |       const splash = document.querySelector('.splash-screen');
  25  |       if (!splash) return true; // Already removed from DOM
  26  |       return splash.classList.contains('splash-hidden');
  27  |     }, { timeout: 10000 }).catch(() => {});
  28  | 
  29  |     // Wait a bit more for the app to fully initialize
  30  |     await page.waitForTimeout(3000);
  31  | 
  32  |     // Check for JS errors
  33  |     console.log('Console errors:', consoleErrors.length > 0 ? consoleErrors : 'none');
  34  | 
  35  |     // 1. Check if window.__smartLearning exists
  36  |     const sleExists = await page.evaluate(() => {
  37  |       return typeof window.__smartLearning !== 'undefined';
  38  |     });
  39  |     console.log('window.__smartLearning exists:', sleExists);
  40  | 
  41  |     if (sleExists) {
  42  |       // 2. Get recommendations
  43  |       const recs = await page.evaluate(() => {
  44  |         try {
  45  |           return window.__smartLearning.getScoredRecommendations();
  46  |         } catch (e) {
  47  |           return { error: e.message };
  48  |         }
  49  |       });
  50  |       console.log('Recommendations:', JSON.stringify(recs).substring(0, 2000));
  51  | 
  52  |       // 3. Check dashboard for SLE cards
  53  |       const sleCardsOnDashboard = await page.evaluate(() => {
  54  |         const grid = document.getElementById('dashboard-grid');
  55  |         if (!grid) return { found: false, reason: 'no dashboard-grid' };
  56  |         const sleCards = grid.querySelectorAll('.db-sle-card, [id^="sle-rec-"]');
  57  |         return {
  58  |           found: sleCards.length > 0,
  59  |           count: sleCards.length,
  60  |           ids: Array.from(sleCards).map(c => c.id || 'no-id'),
  61  |         };
  62  |       });
  63  |       console.log('SLE cards on dashboard:', JSON.stringify(sleCardsOnDashboard));
  64  |     }
  65  | 
  66  |     // 4. Check that the dashboard-grid has content
  67  |     const dashboardContent = await page.evaluate(() => {
  68  |       const grid = document.getElementById('dashboard-grid');
  69  |       if (!grid) return { exists: false };
  70  |       return {
  71  |         exists: true,
  72  |         htmlLength: grid.innerHTML.length,
  73  |         childCount: grid.children.length,
  74  |         firstChildTag: grid.children[0] ? grid.children[0].tagName : 'none',
  75  |         firstChildClass: grid.children[0] ? grid.children[0].className : 'none',
  76  |         hasGreeting: !!grid.querySelector('.db-greeting'),
  77  |         hasHeroBar: !!grid.querySelector('.db-hero-bar'),
  78  |         hasPathsGrid: !!grid.querySelector('.db-paths-grid'),
  79  |       };
  80  |     });
  81  |     console.log('Dashboard content:', JSON.stringify(dashboardContent));
  82  | 
  83  |     // 5. Check for errors in all bundle initialization
  84  |     const bundleInitCheck = await page.evaluate(() => {
  85  |       const checks = {
  86  |         hasAllWords: typeof ALL_WORDS !== 'undefined',
  87  |         hasSRS: typeof window.__srs !== 'undefined',
  88  |         hasAnalytics: typeof window.__analytics !== 'undefined',
  89  |         hasAdaptive: typeof window.__adaptive !== 'undefined',
  90  |         hasSmartLearning: typeof window.__smartLearning !== 'undefined',
  91  |         hasReader: typeof window.__reader !== 'undefined',
  92  |         hasLearnScreen: typeof window.__learnScreen !== 'undefined',
  93  |         hasProfileUI: typeof window.__profileUI !== 'undefined',
  94  |       };
  95  |       return checks;
  96  |     });
  97  |     console.log('Bundle initialization:', JSON.stringify(bundleInitCheck));
  98  | 
  99  |     // 6. Navigate to Learn view and check learn screen header
> 100 |     await page.click('#tab-learn');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  101 |     await page.waitForTimeout(2000);
  102 | 
  103 |     const learnContent = await page.evaluate(() => {
  104 |       const header = document.getElementById('learn-action-header');
  105 |       if (!header) return { exists: false, reason: 'no learn-action-header' };
  106 |       return {
  107 |         exists: true,
  108 |         htmlLength: header.innerHTML.length,
  109 |         hasGreeting: !!header.querySelector('.ls-greeting'),
  110 |         hasCompHeadline: !!header.querySelector('.ls-comp-headline'),
  111 |         hasGoalRow: !!header.querySelector('.ls-goal-row'),
  112 |         hasSmartRec: !!header.querySelector('#ls-smart-rec'),
  113 |         hasPathsGrid: !!header.querySelector('.ls-paths-grid'),
  114 |         hasMotivation: !!header.querySelector('.ls-motivation'),
  115 |       };
  116 |     });
  117 |     console.log('Learn content:', JSON.stringify(learnContent));
  118 | 
  119 |     // Assertions
  120 |     expect(dashboardContent.exists).toBe(true);
  121 |     expect(dashboardContent.hasGreeting).toBe(true);
  122 | 
  123 |     if (sleExists) {
  124 |       expect(Array.isArray(recs)).toBe(true);
  125 |     }
  126 |   });
  127 | });
  128 | 
```