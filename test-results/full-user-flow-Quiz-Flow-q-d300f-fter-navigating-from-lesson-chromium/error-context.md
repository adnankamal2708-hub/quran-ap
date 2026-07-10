# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Quiz Flow >> quiz view shows questions after navigating from lesson
- Location: test\e2e\full-user-flow.spec.js:296:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#tab-learn')
    - locator resolved to <button type="button" id="tab-learn" class="nav-tab">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="status" id="splash-screen" class="splash-screen" aria-label="Loading Bayan">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="status" id="splash-screen" class="splash-screen" aria-label="Loading Bayan">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    99 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div role="status" id="splash-screen" class="splash-screen" aria-label="Loading Bayan">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms

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
  268 |   test('rating a word updates stats and navigates', async ({ page }) => {
  269 |     // Navigate forward to enable SRS
  270 |     await page.locator('#btn-next').click();
  271 |     await page.waitForTimeout(300);
  272 | 
  273 |     // Click "Good" rating
  274 |     await page.locator('#srs-good').click();
  275 |     await page.waitForTimeout(500);
  276 | 
  277 |     // Stats should show learned count > 0
  278 |     const learned = page.locator('#stat-learned');
  279 |     const learnedText = await learned.textContent();
  280 |     expect(parseInt(learnedText)).toBeGreaterThanOrEqual(0);
  281 |   });
  282 | });
  283 | 
  284 | // ── Quiz Flow ──────────────────────────────────────────────────
  285 | 
  286 | test.describe('Quiz Flow', () => {
  287 |   test.beforeEach(async ({ page }) => {
  288 |     await page.goto('/');
  289 |     try {
  290 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  291 |       await page.locator('#onboarding-skip').click();
  292 |       await page.waitForTimeout(500);
  293 |     } catch (e) {}
  294 |   });
  295 | 
  296 |   test('quiz view shows questions after navigating from lesson', async ({ page }) => {
  297 |     // Start with foundation lesson, then go to quiz
> 298 |     await page.locator('#tab-learn').click();
      |                                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  299 |     await page.waitForTimeout(500);
  300 |     await page.locator('#surah-select').selectOption('foundation');
  301 |     await page.waitForTimeout(500);
  302 | 
  303 |     // Navigate to quiz
  304 |     await page.locator('#tab-quiz').click();
  305 |     await page.waitForTimeout(500);
  306 | 
  307 |     await expect(page.locator('#view-quiz')).toBeVisible();
  308 | 
  309 |     // Quiz should have a question displayed
  310 |     const quizWord = page.locator('#quiz-word');
  311 |     const options = page.locator('.quiz-opt');
  312 |     const optCount = await options.count();
  313 | 
  314 |     await expect(quizWord).toBeVisible();
  315 |     expect(optCount).toBeGreaterThanOrEqual(2);
  316 |   });
  317 | 
  318 |   test('answering quiz moves to next question', async ({ page }) => {
  319 |     await page.locator('#tab-learn').click();
  320 |     await page.waitForTimeout(500);
  321 |     await page.locator('#surah-select').selectOption('foundation');
  322 |     await page.waitForTimeout(500);
  323 | 
  324 |     await page.locator('#tab-quiz').click();
  325 |     await page.waitForTimeout(500);
  326 | 
  327 |     // Answer first question
  328 |     const firstOption = page.locator('.quiz-opt').first();
  329 |     await firstOption.click();
  330 |     await page.waitForTimeout(300);
  331 | 
  332 |     // Next button should appear
  333 |     await expect(page.locator('#btn-next-quiz')).toBeVisible();
  334 | 
  335 |     // Feedback should be shown
  336 |     const feedback = page.locator('#quiz-feedback');
  337 |     await expect(feedback).not.toBeEmpty();
  338 | 
  339 |     // Score display should show progress
  340 |     const score = page.locator('#quiz-score-display');
  341 |     await expect(score).toContainText(/correct/);
  342 |   });
  343 | 
  344 |   test('quiz completes with score display', async ({ page }) => {
  345 |     await page.locator('#tab-learn').click();
  346 |     await page.waitForTimeout(500);
  347 |     await page.locator('#surah-select').selectOption('foundation');
  348 |     await page.waitForTimeout(500);
  349 | 
  350 |     await page.locator('#tab-quiz').click();
  351 |     await page.waitForTimeout(500);
  352 | 
  353 |     // Answer all quiz questions (foundation lesson 1 has 10 words)
  354 |     const maxAnswers = 12; // safety limit
  355 |     for (let i = 0; i < maxAnswers; i++) {
  356 |       const isNextVisible = await page.locator('#btn-next-quiz').isVisible();
  357 |       if (!isNextVisible) {
  358 |         // No next button means quiz hasn't started yet or is done
  359 |         const opts = page.locator('.quiz-opt');
  360 |         const count = await opts.count();
  361 |         if (count === 0) break; // Quiz complete
  362 |       }
  363 | 
  364 |       try {
  365 |         const option = page.locator('.quiz-opt').first();
  366 |         await option.click({ timeout: 2000 });
  367 |         await page.waitForTimeout(200);
  368 |       } catch (e) {
  369 |         break; // No more options
  370 |       }
  371 | 
  372 |       try {
  373 |         const nextBtn = page.locator('#btn-next-quiz');
  374 |         if (await nextBtn.isVisible({ timeout: 1000 })) {
  375 |           await nextBtn.click();
  376 |           await page.waitForTimeout(200);
  377 |         }
  378 |       } catch (e) {
  379 |         break;
  380 |       }
  381 |     }
  382 | 
  383 |     // After all questions, quiz should show completion
  384 |     await page.waitForTimeout(500);
  385 |     const feedback = page.locator('#quiz-feedback');
  386 |     const feedbackText = await feedback.textContent();
  387 |     expect(feedbackText).toContain('Done');
  388 |   });
  389 | });
  390 | 
  391 | // ── Review Banner & SRS Review ─────────────────────────────────
  392 | 
  393 | test.describe('Review Banner & SRS Review', () => {
  394 |   test('review banner appears when words are due', async ({ page }) => {
  395 |     // Seed SRS data with a due word
  396 |     await page.goto('/');
  397 |     // Clear and seed localStorage with a due review
  398 |     await page.evaluate(() => {
```