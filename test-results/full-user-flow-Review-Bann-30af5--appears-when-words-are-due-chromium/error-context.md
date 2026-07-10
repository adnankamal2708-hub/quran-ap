# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Review Banner & SRS Review >> review banner appears when words are due
- Location: test\e2e\full-user-flow.spec.js:394:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
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
    199 × waiting for element to be visible, enabled and stable
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
  399 |       localStorage.clear();
  400 |       const dueDate = Date.now() - 86400000; // 1 day overdue
  401 |       const srsData = {
  402 |         'cw_0': {
  403 |           dueDate: dueDate,
  404 |           interval: 1,
  405 |           lastRating: 2,
  406 |           ratedAt: dueDate,
  407 |           stage: 2,
  408 |           reps: 3,
  409 |           totalReviews: 3,
  410 |           lapses: 0,
  411 |           easeFactor: 2.5,
  412 |           leechCount: 0,
  413 |           isLeech: false,
  414 |         },
  415 |       };
  416 |       localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
  417 |       localStorage.setItem('quran_onboarding_done', 'true');
  418 |     });
  419 | 
  420 |     await page.reload();
  421 |     await page.waitForLoadState('networkidle');
  422 |     await page.waitForTimeout(1500);
  423 | 
  424 |     // Navigate to learn view
> 425 |     await page.locator('#tab-learn').click();
      |                                      ^ Error: locator.click: Test timeout of 120000ms exceeded.
  426 |     await page.waitForTimeout(500);
  427 | 
  428 |     // Review banner should be visible
  429 |     const banner = page.locator('#review-banner');
  430 |     await expect(banner).toBeVisible();
  431 |     await expect(page.locator('#review-banner-text')).not.toBeEmpty();
  432 |   });
  433 | 
  434 |   test('start review button enters review mode', async ({ page }) => {
  435 |     await page.goto('/');
  436 |     await page.waitForLoadState('networkidle');
  437 |     await page.evaluate(() => {
  438 |       localStorage.clear();
  439 |       const dueDate = Date.now() - 86400000;
  440 |       const srsData = {
  441 |         'cw_0': {
  442 |           dueDate: dueDate,
  443 |           interval: 1,
  444 |           lastRating: 2,
  445 |           ratedAt: dueDate,
  446 |           stage: 2,
  447 |           reps: 3,
  448 |           totalReviews: 3,
  449 |           lapses: 0,
  450 |           easeFactor: 2.5,
  451 |           leechCount: 0,
  452 |           isLeech: false,
  453 |         },
  454 |       };
  455 |       localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
  456 |       localStorage.setItem('quran_onboarding_done', 'true');
  457 |     });
  458 | 
  459 |     await page.reload();
  460 |     await page.waitForLoadState('networkidle');
  461 |     await page.waitForTimeout(1500);
  462 | 
  463 |     await page.locator('#tab-learn').click();
  464 |     await page.waitForTimeout(500);
  465 | 
  466 |     // Click review button
  467 |     await page.locator('#review-start-btn').click();
  468 |     await page.waitForTimeout(500);
  469 | 
  470 |     // Should be in review mode — word card shows "Review" not "Word"
  471 |     const wordNum = page.locator('#word-num');
  472 |     await expect(wordNum).toContainText(/Review/i);
  473 |   });
  474 | });
  475 | 
  476 | // ── Dashboard ──────────────────────────────────────────────────
  477 | 
  478 | test.describe('Dashboard', () => {
  479 |   test.beforeEach(async ({ page }) => {
  480 |     await page.goto('/');
  481 |     try {
  482 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  483 |       await page.locator('#onboarding-skip').click();
  484 |       await page.waitForTimeout(500);
  485 |     } catch (e) {}
  486 |     await page.waitForSelector('#view-dashboard', { timeout: 5000 });
  487 |   });
  488 | 
  489 |   test('dashboard displays learning paths with progress', async ({ page }) => {
  490 |     await expect(page.locator('#view-dashboard')).toBeVisible();
  491 |     await expect(page.locator('#dashboard-grid')).toBeVisible();
  492 | 
  493 |     // Should have dashboard greeting or title
  494 |     // Should have dashboard greeting visible
  495 |     await expect(page.locator('.db-greeting')).toBeVisible();
  496 | 
  497 |     // Should have dashboard cards visible
  498 |     await expect(page.locator('.db-card').first()).toBeVisible();
  499 |   });
  500 | 
  501 |   test('bottom navigation switches views', async ({ page }) => {
  502 |     // Click each nav tab and verify the view switches
  503 |     const tabs = [
  504 |       { tab: '#tab-learn', view: '#view-learn' },
  505 |       { tab: '#tab-quiz', view: '#view-quiz' },
  506 |       { tab: '#tab-list', view: '#view-list' },
  507 |       { tab: '#tab-stats', view: '#view-stats' },
  508 |       { tab: '#tab-analytics', view: '#view-analytics' },
  509 |     ];
  510 | 
  511 |     for (const { tab, view } of tabs) {
  512 |       await page.locator(tab).click();
  513 |       await page.waitForTimeout(300);
  514 |       await expect(page.locator(view)).toBeVisible();
  515 |     }
  516 |   });
  517 | 
  518 |   test('stats view shows learning metrics', async ({ page }) => {
  519 |     await page.locator('#tab-stats').click();
  520 |     await page.waitForTimeout(500);
  521 | 
  522 |     await expect(page.locator('#view-stats')).toBeVisible();
  523 | 
  524 |     // Stats grid should be visible
  525 |     await expect(page.locator('#stat-total')).toBeVisible();
```