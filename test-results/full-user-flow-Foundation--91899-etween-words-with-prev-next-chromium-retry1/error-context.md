# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Foundation Lesson Flow >> navigate between words with prev/next
- Location: test\e2e\full-user-flow.spec.js:214:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('#view-dashboard') to be visible
    14 × locator resolved to hidden <section id="view-dashboard" class="mode-view active" aria-label="Learning Dashboard">…</section>

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
  138 |     const revisitBtn = page.locator('#btn-revisit-onboarding');
  139 |     if (await revisitBtn.isVisible()) {
  140 |       await revisitBtn.click();
  141 |       await page.waitForTimeout(500);
  142 |       await expect(page.locator('#onboarding-overlay')).toBeVisible();
  143 |     }
  144 |   });
  145 | 
  146 |   test('Escape key dismisses the tour', async ({ page }) => {
  147 |     await waitAndSee(page, '#onboarding-overlay');
  148 |     await page.keyboard.press('Escape');
  149 |     await page.waitForTimeout(500);
  150 |     await expect(page.locator('#onboarding-overlay')).not.toBeVisible();
  151 |   });
  152 | });
  153 | 
  154 | // ── Foundation Lesson Flow ─────────────────────────────────────
  155 | 
  156 | test.describe('Foundation Lesson Flow', () => {
  157 |   test.beforeEach(async ({ page }) => {
  158 |     await page.goto('/');
  159 |     // Skip onboarding
  160 |     try {
  161 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  162 |       await page.locator('#onboarding-skip').click();
  163 |       await page.waitForTimeout(500);
  164 |     } catch (e) {
  165 |       // Onboarding may not appear if already completed
  166 |     }
> 167 |     await page.waitForSelector('#view-dashboard', { timeout: 5000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  168 |   });
  169 | 
  170 |   test('dashboard shows learning paths', async ({ page }) => {
  171 |     await waitAndSee(page, '#view-dashboard');
  172 |     await expect(page.locator('#dashboard-grid')).toBeVisible();
  173 |     // Should have dashboard cards (using db-card class after educational overhaul)
  174 |     const dashboardCards = page.locator('.db-card, .dashboard-card');
  175 |     const count = await dashboardCards.count();
  176 |     expect(count).toBeGreaterThanOrEqual(1);
  177 |   });
  178 | 
  179 |   test('foundation lesson navigation', async ({ page }) => {
  180 |     // Navigate to learn view
  181 |     await page.locator('#tab-learn').click();
  182 |     await page.waitForTimeout(500);
  183 |     await expect(page.locator('#view-learn')).toBeVisible();
  184 | 
  185 |     // Switch to foundation mode
  186 |     await page.locator('#surah-select').selectOption('foundation');
  187 |     await page.waitForTimeout(500);
  188 | 
  189 |     // Should see foundation lesson info (thematic title shown after educational overhaul)
  190 |     const lessonLabel = page.locator('#lesson-label');
  191 |     await expect(lessonLabel).toContainText(/Framework|Foundation|lesson|Lesson|Essential/i);
  192 | 
  193 |     // Word card should be visible
  194 |     await expect(page.locator('#word-card')).toBeVisible();
  195 |     await expect(page.locator('#arabic-word')).not.toBeEmpty();
  196 |   });
  197 | 
  198 |   test('word card displays correctly', async ({ page }) => {
  199 |     await page.locator('#tab-learn').click();
  200 |     await page.waitForTimeout(500);
  201 |     await page.locator('#surah-select').selectOption('foundation');
  202 |     await page.waitForTimeout(500);
  203 | 
  204 |     // Verify word card elements
  205 |     await expect(page.locator('#arabic-word')).toBeVisible();
  206 |     await expect(page.locator('#transliteration')).toBeVisible();
  207 |     await expect(page.locator('#word-type')).toBeVisible();
  208 |     await expect(page.locator('#meaning')).toBeVisible();
  209 |     await expect(page.locator('#occurrences')).toBeVisible();
  210 |     await expect(page.locator('#sr-pill')).toBeVisible();
  211 |     await expect(page.locator('#root-box')).toBeVisible();
  212 |   });
  213 | 
  214 |   test('navigate between words with prev/next', async ({ page }) => {
  215 |     await page.locator('#tab-learn').click();
  216 |     await page.waitForTimeout(500);
  217 |     await page.locator('#surah-select').selectOption('foundation');
  218 |     await page.waitForTimeout(500);
  219 | 
  220 |     // Get first word text
  221 |     const firstWord = await page.locator('#arabic-word').textContent();
  222 | 
  223 |     // Click Next
  224 |     await page.locator('#btn-next').click();
  225 |     await page.waitForTimeout(300);
  226 |     const secondWord = await page.locator('#arabic-word').textContent();
  227 | 
  228 |     // Words should be different when navigating
  229 |     // (Note: may be same if lesson has only 1 word, but not typical)
  230 |     expect(firstWord).toBeTruthy();
  231 |     expect(secondWord).toBeTruthy();
  232 |   });
  233 | });
  234 | 
  235 | // ── SRS Rating ─────────────────────────────────────────────────
  236 | 
  237 | test.describe('SRS Rating', () => {
  238 |   test.beforeEach(async ({ page }) => {
  239 |     await page.goto('/');
  240 |     try {
  241 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  242 |       await page.locator('#onboarding-skip').click();
  243 |       await page.waitForTimeout(500);
  244 |     } catch (e) {}
  245 |     await page.locator('#tab-learn').click();
  246 |     await page.waitForTimeout(500);
  247 |     await page.locator('#surah-select').selectOption('foundation');
  248 |     await page.waitForTimeout(500);
  249 |   });
  250 | 
  251 |   test('SRS buttons become visible after first word', async ({ page }) => {
  252 |     // Navigate forward to make SRS row visible
  253 |     await page.locator('#btn-next').click();
  254 |     await page.waitForTimeout(300);
  255 | 
  256 |     const srsRow = page.locator('#srs-row');
  257 |     const srsLabel = page.locator('#srs-label');
  258 |     await expect(srsRow).toBeVisible();
  259 |     await expect(srsLabel).toBeVisible();
  260 | 
  261 |     // All 4 buttons should be visible
  262 |     await expect(page.locator('#srs-again')).toBeVisible();
  263 |     await expect(page.locator('#srs-hard')).toBeVisible();
  264 |     await expect(page.locator('#srs-good')).toBeVisible();
  265 |     await expect(page.locator('#srs-easy')).toBeVisible();
  266 |   });
  267 | 
```