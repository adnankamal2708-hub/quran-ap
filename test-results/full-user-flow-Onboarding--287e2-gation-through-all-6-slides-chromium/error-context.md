# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Onboarding Tour >> navigation through all 6 slides
- Location: test\e2e\full-user-flow.spec.js:69:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('#onboarding-overlay') to be visible
    13 × locator resolved to hidden <div role="dialog" aria-modal="true" id="onboarding-overlay" aria-label="Welcome tour" class="onboarding-overlay">…</div>

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - status "Loading Bayan" [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]: 📖
      - heading "Bayan" [level=1] [ref=e5]
      - paragraph [ref=e6]: Understand the Quran, one word at a time.
  - link "Skip to content" [ref=e9] [cursor=pointer]:
    - /url: "#content"
  - application "Bayan — Quran Learning App" [ref=e10]:
    - banner [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: بِسْمِ اللَّهِ
          - generic [ref=e15]: ✓ Offline ready
        - button "Account" [ref=e17] [cursor=pointer]:
          - generic [ref=e18]: 👤
      - status "Learning statistics" [ref=e20]:
        - generic [ref=e21]: Lesson 1 of 16
        - generic [ref=e22]: ·
        - generic [ref=e23]: "0"
        - generic [ref=e24]: Learned
        - generic [ref=e25]: ·
        - generic [ref=e26]: "0"
        - generic [ref=e27]: Due
        - generic [ref=e28]: ·
        - generic [ref=e29]: —
        - generic [ref=e30]: Quiz
        - progressbar "Daily review goal" [ref=e31] [cursor=pointer]:
          - img [ref=e32]:
            - generic [ref=e35]: "0"
      - progressbar "Session progress" [ref=e36]:
        - generic [ref=e38]: Word 1 / 20
    - main [ref=e39]:
      - region "Learning Dashboard"
    - navigation "Main navigation" [ref=e40]:
      - button "📚 Paths" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: 📚
        - generic [ref=e43]: Paths
      - button "📖 Learn" [ref=e44] [cursor=pointer]:
        - generic [ref=e45]: 📖
        - generic [ref=e46]: Learn
      - button "✏️ Quiz" [ref=e47] [cursor=pointer]:
        - generic [ref=e48]: ✏️
        - generic [ref=e49]: Quiz
      - button "📋 Words" [ref=e50] [cursor=pointer]:
        - generic [ref=e51]: 📋
        - generic [ref=e52]: Words
      - button "📊 Stats" [ref=e53] [cursor=pointer]:
        - generic [ref=e54]: 📊
        - generic [ref=e55]: Stats
      - button "📈 Analytics" [ref=e56] [cursor=pointer]:
        - generic [ref=e57]: 📈
        - generic [ref=e58]: Analytics
      - generic [ref=e59]: 📖Bayan
```

# Test source

```ts
  1   | // ═══════════════════════════════════════════════════════════════
  2   | // full-user-flow.spec.js — End-to-End User Journey
  3   | //
  4   | // Tests the complete user flow:
  5   | //   1. Onboarding tour (welcome slides, skip, revisit)
  6   | //   2. Dashboard (paths, recommendation, stats)
  7   | //   3. Foundation lesson navigation & word card
  8   | //   4. SRS rating of a word
  9   | //   5. Quiz initialization & answer flow
  10  | //   6. Lesson completion & progress persistence
  11  | //   7. Review banner & SRS review queue
  12  | //   8. Offline indicator and service worker
  13  | //   9. Stats view verification
  14  | //
  15  | // App uses localStorage for all state — tests pre-seed data
  16  | // to simulate different user states.
  17  | // ═══════════════════════════════════════════════════════════════
  18  | 
  19  | const { test, expect } = require('@playwright/test');
  20  | 
  21  | // ── Helper: Clear localStorage and reload ──────────────────────
  22  | 
  23  | async function resetApp(page) {
  24  |   await page.evaluate(() => {
  25  |     localStorage.clear();
  26  |     sessionStorage.clear();
  27  |   });
  28  |   await page.reload();
  29  |   await page.waitForLoadState('networkidle');
  30  |   // Give app time to initialize (onboarding timer is 800ms)
  31  |   await page.waitForTimeout(1500);
  32  | }
  33  | 
  34  | // ── Helper: Wait for element to be visible ─────────────────────
  35  | 
  36  | async function waitAndSee(page, selector, timeout = 5000) {
> 37  |   await page.waitForSelector(selector, { state: 'visible', timeout });
      |              ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  38  | }
  39  | 
  40  | // ── Onboarding Tour ────────────────────────────────────────────
  41  | 
  42  | test.describe('Onboarding Tour', () => {
  43  |   test.beforeEach(async ({ page }) => {
  44  |     await page.goto('/');
  45  |     await resetApp(page);
  46  |   });
  47  | 
  48  |   test('shows welcome tour on first visit', async ({ page }) => {
  49  |     // The onboarding overlay should appear
  50  |     await waitAndSee(page, '#onboarding-overlay');
  51  |     await expect(page.locator('#onboarding-overlay')).toBeVisible();
  52  | 
  53  |     // Should have a slide visible with title content
  54  |     const slide = page.locator('#onboarding-slide');
  55  |     await expect(slide).toBeVisible();
  56  |     await expect(slide).not.toBeEmpty();
  57  | 
  58  |     // Should have Skip and Next buttons
  59  |     await expect(page.locator('#onboarding-skip')).toBeVisible();
  60  |     await expect(page.locator('#onboarding-next')).toBeVisible();
  61  | 
  62  |     // First slide: "Previous" should be hidden or disabled
  63  |     const prevBtn = page.locator('#onboarding-prev');
  64  |     const isPrevHidden = await prevBtn.isHidden();
  65  |     const isPrevDisabled = await prevBtn.isDisabled();
  66  |     expect(isPrevHidden || isPrevDisabled).toBeTruthy();
  67  |   });
  68  | 
  69  |   test('navigation through all 6 slides', async ({ page }) => {
  70  |     await waitAndSee(page, '#onboarding-overlay');
  71  | 
  72  |     const nextBtn = page.locator('#onboarding-next');
  73  |     const prevBtn = page.locator('#onboarding-prev');
  74  |     const slide = page.locator('#onboarding-slide');
  75  | 
  76  |     // Slide 1 → 2
  77  |     await nextBtn.click();
  78  |     await page.waitForTimeout(300);
  79  |     await expect(slide).not.toBeEmpty();
  80  | 
  81  |     // Slide 2 → 3
  82  |     await nextBtn.click();
  83  |     await page.waitForTimeout(300);
  84  | 
  85  |     // Back to slide 2
  86  |     await prevBtn.click();
  87  |     await page.waitForTimeout(300);
  88  | 
  89  |     // Forward to slide 3
  90  |     await nextBtn.click();
  91  |     await page.waitForTimeout(300);
  92  | 
  93  |     // Forward to slide 4
  94  |     await nextBtn.click();
  95  |     await page.waitForTimeout(300);
  96  | 
  97  |     // Forward to slide 5
  98  |     await nextBtn.click();
  99  |     await page.waitForTimeout(300);
  100 | 
  101 |     // Forward to slide 6 (last slide)
  102 |     await nextBtn.click();
  103 |     await page.waitForTimeout(300);
  104 | 
  105 |     // Last slide should show the final slide content (e.g., Sync & Offline Mode)
  106 |     // and the Next button should have transitioned to "Get Started" / "Start"
  107 |     const nextBtnText = await nextBtn.textContent();
  108 |     const slideText = await slide.textContent();
  109 |     const isLastSlide = nextBtnText.match(/Get Started|Start|Done|Finish/i) !== null ||
  110 |                         slideText.match(/Sync|Offline|Complete/i) !== null;
  111 |     expect(isLastSlide).toBeTruthy();
  112 |   });
  113 | 
  114 |   test('skip button dismisses the tour', async ({ page }) => {
  115 |     await waitAndSee(page, '#onboarding-overlay');
  116 | 
  117 |     await page.locator('#onboarding-skip').click();
  118 |     await page.waitForTimeout(500);
  119 | 
  120 |     // Overlay should be hidden
  121 |     await expect(page.locator('#onboarding-overlay')).not.toBeVisible();
  122 | 
  123 |     // Dashboard should be visible instead
  124 |     await expect(page.locator('#view-dashboard')).toBeVisible();
  125 |   });
  126 | 
  127 |   test('revisit onboarding from settings', async ({ page }) => {
  128 |     // Dismiss first onboarding
  129 |     await waitAndSee(page, '#onboarding-overlay');
  130 |     await page.locator('#onboarding-skip').click();
  131 |     await page.waitForTimeout(500);
  132 | 
  133 |     // Go to profile/settings
  134 |     await page.locator('#user-btn').click();
  135 |     await page.waitForTimeout(500);
  136 | 
  137 |     // Look for revisit onboarding button
```