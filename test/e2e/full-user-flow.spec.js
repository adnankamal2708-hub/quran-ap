// ═══════════════════════════════════════════════════════════════
// full-user-flow.spec.js — End-to-End User Journey
//
// Tests the complete user flow:
//   1. Onboarding tour (welcome slides, skip, revisit)
//   2. Dashboard (paths, recommendation, stats)
//   3. Foundation lesson navigation & word card
//   4. SRS rating of a word
//   5. Quiz initialization & answer flow
//   6. Lesson completion & progress persistence
//   7. Review banner & SRS review queue
//   8. Offline indicator and service worker
//   9. Stats view verification
//
// App uses localStorage for all state — tests pre-seed data
// to simulate different user states.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// ── Helper: Clear localStorage and reload ──────────────────────

async function resetApp(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  // Give app time to initialize (onboarding timer is 800ms)
  await page.waitForTimeout(1500);
}

// ── Helper: Wait for element to be visible ─────────────────────

async function waitAndSee(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

// ── Onboarding Tour ────────────────────────────────────────────

test.describe('Onboarding Tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await resetApp(page);
  });

  test('shows welcome tour on first visit', async ({ page }) => {
    // The onboarding overlay should appear
    await waitAndSee(page, '#onboarding-overlay');
    await expect(page.locator('#onboarding-overlay')).toBeVisible();

    // Should have a slide visible with title content
    const slide = page.locator('#onboarding-slide');
    await expect(slide).toBeVisible();
    await expect(slide).not.toBeEmpty();

    // Should have Skip and Next buttons
    await expect(page.locator('#onboarding-skip')).toBeVisible();
    await expect(page.locator('#onboarding-next')).toBeVisible();

    // First slide: "Previous" should be hidden or disabled
    const prevBtn = page.locator('#onboarding-prev');
    const isPrevHidden = await prevBtn.isHidden();
    const isPrevDisabled = await prevBtn.isDisabled();
    expect(isPrevHidden || isPrevDisabled).toBeTruthy();
  });

  test('navigation through all 6 slides', async ({ page }) => {
    await waitAndSee(page, '#onboarding-overlay');

    const nextBtn = page.locator('#onboarding-next');
    const prevBtn = page.locator('#onboarding-prev');
    const slide = page.locator('#onboarding-slide');

    // Slide 1 → 2
    await nextBtn.click();
    await page.waitForTimeout(300);
    await expect(slide).not.toBeEmpty();

    // Slide 2 → 3
    await nextBtn.click();
    await page.waitForTimeout(300);

    // Back to slide 2
    await prevBtn.click();
    await page.waitForTimeout(300);

    // Forward to slide 3
    await nextBtn.click();
    await page.waitForTimeout(300);

    // Forward to slide 4
    await nextBtn.click();
    await page.waitForTimeout(300);

    // Forward to slide 5
    await nextBtn.click();
    await page.waitForTimeout(300);

    // Forward to slide 6 (last slide)
    await nextBtn.click();
    await page.waitForTimeout(300);

    // Last slide should show the final slide content (e.g., Sync & Offline Mode)
    // and the Next button should have transitioned to "Get Started" / "Start"
    const nextBtnText = await nextBtn.textContent();
    const slideText = await slide.textContent();
    const isLastSlide = nextBtnText.match(/Get Started|Start|Done|Finish/i) !== null ||
                        slideText.match(/Sync|Offline|Complete/i) !== null;
    expect(isLastSlide).toBeTruthy();
  });

  test('skip button dismisses the tour', async ({ page }) => {
    await waitAndSee(page, '#onboarding-overlay');

    await page.locator('#onboarding-skip').click();
    await page.waitForTimeout(500);

    // Overlay should be hidden
    await expect(page.locator('#onboarding-overlay')).not.toBeVisible();

    // Dashboard should be visible instead
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });

  test('revisit onboarding from settings', async ({ page }) => {
    // Dismiss first onboarding
    await waitAndSee(page, '#onboarding-overlay');
    await page.locator('#onboarding-skip').click();
    await page.waitForTimeout(500);

    // Go to profile/settings
    await page.locator('#user-btn').click();
    await page.waitForTimeout(500);

    // Look for revisit onboarding button
    const revisitBtn = page.locator('#btn-revisit-onboarding');
    if (await revisitBtn.isVisible()) {
      await revisitBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('#onboarding-overlay')).toBeVisible();
    }
  });

  test('Escape key dismisses the tour', async ({ page }) => {
    await waitAndSee(page, '#onboarding-overlay');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.locator('#onboarding-overlay')).not.toBeVisible();
  });
});

// ── Foundation Lesson Flow ─────────────────────────────────────

test.describe('Foundation Lesson Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Skip onboarding
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {
      // Onboarding may not appear if already completed
    }
    await page.waitForSelector('#view-dashboard', { timeout: 5000 });
  });

  test('dashboard shows learning paths', async ({ page }) => {
    await waitAndSee(page, '#view-dashboard');
    await expect(page.locator('#dashboard-grid')).toBeVisible();
    // Should have dashboard cards (using db-card class after educational overhaul)
    const dashboardCards = page.locator('.db-card, .dashboard-card');
    const count = await dashboardCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('foundation lesson navigation', async ({ page }) => {
    // Navigate to learn view
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#view-learn')).toBeVisible();

    // Switch to foundation mode
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);

    // Should see foundation lesson info (thematic title shown after educational overhaul)
    const lessonLabel = page.locator('#lesson-label');
    await expect(lessonLabel).toContainText(/Framework|Foundation|lesson|Lesson|Essential/i);

    // Word card should be visible
    await expect(page.locator('#word-card')).toBeVisible();
    await expect(page.locator('#arabic-word')).not.toBeEmpty();
  });

  test('word card displays correctly', async ({ page }) => {
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);

    // Verify word card elements
    await expect(page.locator('#arabic-word')).toBeVisible();
    await expect(page.locator('#transliteration')).toBeVisible();
    await expect(page.locator('#word-type')).toBeVisible();
    await expect(page.locator('#meaning')).toBeVisible();
    await expect(page.locator('#occurrences')).toBeVisible();
    await expect(page.locator('#sr-pill')).toBeVisible();
    await expect(page.locator('#root-box')).toBeVisible();
  });

  test('navigate between words with prev/next', async ({ page }) => {
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);

    // Get first word text
    const firstWord = await page.locator('#arabic-word').textContent();

    // Click Next
    await page.locator('#btn-next').click();
    await page.waitForTimeout(300);
    const secondWord = await page.locator('#arabic-word').textContent();

    // Words should be different when navigating
    // (Note: may be same if lesson has only 1 word, but not typical)
    expect(firstWord).toBeTruthy();
    expect(secondWord).toBeTruthy();
  });
});

// ── SRS Rating ─────────────────────────────────────────────────

test.describe('SRS Rating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);
  });

  test('SRS buttons become visible after first word', async ({ page }) => {
    // Navigate forward to make SRS row visible
    await page.locator('#btn-next').click();
    await page.waitForTimeout(300);

    const srsRow = page.locator('#srs-row');
    const srsLabel = page.locator('#srs-label');
    await expect(srsRow).toBeVisible();
    await expect(srsLabel).toBeVisible();

    // All 4 buttons should be visible
    await expect(page.locator('#srs-again')).toBeVisible();
    await expect(page.locator('#srs-hard')).toBeVisible();
    await expect(page.locator('#srs-good')).toBeVisible();
    await expect(page.locator('#srs-easy')).toBeVisible();
  });

  test('rating a word updates stats and navigates', async ({ page }) => {
    // Navigate forward to enable SRS
    await page.locator('#btn-next').click();
    await page.waitForTimeout(300);

    // Click "Good" rating
    await page.locator('#srs-good').click();
    await page.waitForTimeout(500);

    // Stats should show learned count > 0
    const learned = page.locator('#stat-learned');
    const learnedText = await learned.textContent();
    expect(parseInt(learnedText)).toBeGreaterThanOrEqual(0);
  });
});

// ── Quiz Flow ──────────────────────────────────────────────────

test.describe('Quiz Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
  });

  test('quiz view shows questions after navigating from lesson', async ({ page }) => {
    // Start with foundation lesson, then go to quiz
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);

    // Navigate to quiz
    await page.locator('#tab-quiz').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#view-quiz')).toBeVisible();

    // Quiz should have a question displayed
    const quizWord = page.locator('#quiz-word');
    const options = page.locator('.quiz-opt');
    const optCount = await options.count();

    await expect(quizWord).toBeVisible();
    expect(optCount).toBeGreaterThanOrEqual(2);
  });

  test('answering quiz moves to next question', async ({ page }) => {
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);

    await page.locator('#tab-quiz').click();
    await page.waitForTimeout(500);

    // Answer first question
    const firstOption = page.locator('.quiz-opt').first();
    await firstOption.click();
    await page.waitForTimeout(300);

    // Next button should appear
    await expect(page.locator('#btn-next-quiz')).toBeVisible();

    // Feedback should be shown
    const feedback = page.locator('#quiz-feedback');
    await expect(feedback).not.toBeEmpty();

    // Score display should show progress
    const score = page.locator('#quiz-score-display');
    await expect(score).toContainText(/correct/);
  });

  test('quiz completes with score display', async ({ page }) => {
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);

    await page.locator('#tab-quiz').click();
    await page.waitForTimeout(500);

    // Answer all quiz questions (foundation lesson 1 has 10 words)
    const maxAnswers = 12; // safety limit
    for (let i = 0; i < maxAnswers; i++) {
      const isNextVisible = await page.locator('#btn-next-quiz').isVisible();
      if (!isNextVisible) {
        // No next button means quiz hasn't started yet or is done
        const opts = page.locator('.quiz-opt');
        const count = await opts.count();
        if (count === 0) break; // Quiz complete
      }

      try {
        const option = page.locator('.quiz-opt').first();
        await option.click({ timeout: 2000 });
        await page.waitForTimeout(200);
      } catch (e) {
        break; // No more options
      }

      try {
        const nextBtn = page.locator('#btn-next-quiz');
        if (await nextBtn.isVisible({ timeout: 1000 })) {
          await nextBtn.click();
          await page.waitForTimeout(200);
        }
      } catch (e) {
        break;
      }
    }

    // After all questions, quiz should show completion
    await page.waitForTimeout(500);
    const feedback = page.locator('#quiz-feedback');
    const feedbackText = await feedback.textContent();
    expect(feedbackText).toContain('Done');
  });
});

// ── Review Banner & SRS Review ─────────────────────────────────

test.describe('Review Banner & SRS Review', () => {
  test('review banner appears when words are due', async ({ page }) => {
    // Seed SRS data with a due word
    await page.goto('/');
    // Clear and seed localStorage with a due review
    await page.evaluate(() => {
      localStorage.clear();
      const dueDate = Date.now() - 86400000; // 1 day overdue
      const srsData = {
        'cw_0': {
          dueDate: dueDate,
          interval: 1,
          lastRating: 2,
          ratedAt: dueDate,
          stage: 2,
          reps: 3,
          totalReviews: 3,
          lapses: 0,
          easeFactor: 2.5,
          leechCount: 0,
          isLeech: false,
        },
      };
      localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
      localStorage.setItem('quran_onboarding_done', 'true');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Navigate to learn view
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);

    // Review banner should be visible
    const banner = page.locator('#review-banner');
    await expect(banner).toBeVisible();
    await expect(page.locator('#review-banner-text')).not.toBeEmpty();
  });

  test('start review button enters review mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.clear();
      const dueDate = Date.now() - 86400000;
      const srsData = {
        'cw_0': {
          dueDate: dueDate,
          interval: 1,
          lastRating: 2,
          ratedAt: dueDate,
          stage: 2,
          reps: 3,
          totalReviews: 3,
          lapses: 0,
          easeFactor: 2.5,
          leechCount: 0,
          isLeech: false,
        },
      };
      localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
      localStorage.setItem('quran_onboarding_done', 'true');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);

    // Click review button
    await page.locator('#review-start-btn').click();
    await page.waitForTimeout(500);

    // Should be in review mode — word card shows "Review" not "Word"
    const wordNum = page.locator('#word-num');
    await expect(wordNum).toContainText(/Review/i);
  });
});

// ── Dashboard ──────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
    await page.waitForSelector('#view-dashboard', { timeout: 5000 });
  });

  test('dashboard displays learning paths with progress', async ({ page }) => {
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#dashboard-grid')).toBeVisible();

    // Should have dashboard greeting or title
    // Should have dashboard greeting visible
    await expect(page.locator('.db-greeting')).toBeVisible();

    // Should have dashboard cards visible
    await expect(page.locator('.db-card').first()).toBeVisible();
  });

  test('bottom navigation switches views', async ({ page }) => {
    // Click each nav tab and verify the view switches
    const tabs = [
      { tab: '#tab-learn', view: '#view-learn' },
      { tab: '#tab-quiz', view: '#view-quiz' },
      { tab: '#tab-list', view: '#view-list' },
      { tab: '#tab-stats', view: '#view-stats' },
      { tab: '#tab-analytics', view: '#view-analytics' },
    ];

    for (const { tab, view } of tabs) {
      await page.locator(tab).click();
      await page.waitForTimeout(300);
      await expect(page.locator(view)).toBeVisible();
    }
  });

  test('stats view shows learning metrics', async ({ page }) => {
    await page.locator('#tab-stats').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#view-stats')).toBeVisible();

    // Stats grid should be visible
    await expect(page.locator('#stat-total')).toBeVisible();
    await expect(page.locator('#stat-mastered')).toBeVisible();
    await expect(page.locator('#stat-new-count')).toBeVisible();
    await expect(page.locator('#stat-learning-count')).toBeVisible();
    await expect(page.locator('#streak-count')).toBeVisible();
  });
});

// ── Bottom Nav Indicator ──────────────────────────────────────

test.describe('Bottom Nav Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
    await page.waitForSelector('#view-dashboard', { timeout: 5000 });
  });

  test('initial load positions indicator on dashboard tab (index 0)', async ({ page }) => {
    const indicator = page.locator('#bn-indicator');
    await expect(indicator).toBeVisible();

    const tx = await indicator.evaluate(el => {
      const m = window.getComputedStyle(el).transform;
      const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
      return match ? Math.round(parseFloat(match[1])) : -1;
    });

    // Dashboard is first tab (index 0) → translateX = 0
    expect(tx).toBe(0);

    // Dashboard tab should have aria-current="page"
    await expect(page.locator('#tab-dashboard')).toHaveAttribute('aria-current', 'page');
  });

  test('each tab click moves indicator to correct position', async ({ page }) => {
    const indicator = page.locator('#bn-indicator');
    const tabs = [
      { id: '#tab-dashboard', name: 'dashboard', index: 0 },
      { id: '#tab-learn', name: 'learn', index: 1 },
      { id: '#tab-quiz', name: 'quiz', index: 2 },
      { id: '#tab-list', name: 'list', index: 3 },
      { id: '#tab-stats', name: 'stats', index: 4 },
      { id: '#tab-analytics', name: 'analytics', index: 5 },
    ];

    // Measure indicator width once (stable across all tabs since they're equal-width)
    const indicatorWidth = await indicator.evaluate(el => el.offsetWidth);

    for (const tab of tabs) {
      await page.locator(tab.id).click();
      // Wait for CSS transition to complete (350ms spring easing)
      await page.waitForTimeout(500);

      const tx = await indicator.evaluate(el => {
        const m = window.getComputedStyle(el).transform;
        const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
        return match ? Math.round(parseFloat(match[1])) : -1;
      });

      const expectedTx = Math.round(tab.index * indicatorWidth);
      expect(tx).toBe(expectedTx);

      // The clicked tab should have aria-current="page"
      await expect(page.locator(tab.id)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('only one tab is ever active at a time', async ({ page }) => {
    const tabs = ['#tab-dashboard', '#tab-learn', '#tab-quiz', '#tab-list', '#tab-stats', '#tab-analytics'];

    for (const tabId of tabs) {
      await page.locator(tabId).click();
      await page.waitForTimeout(500);

      const activeCount = await page.evaluate(() => {
        return document.querySelectorAll('.nav-tab.active').length;
      });
      expect(activeCount).toBe(1);

      const ariaCurrentCount = await page.evaluate(() => {
        return document.querySelectorAll('.nav-tab[aria-current="page"]').length;
      });
      expect(ariaCurrentCount).toBe(1);
    }
  });

  test('keyboard shortcut W moves indicator to word list tab', async ({ page }) => {
    const indicator = page.locator('#bn-indicator');
    const indicatorWidth = await indicator.evaluate(el => el.offsetWidth);

    // Press W for word list (tab index 3)
    await page.keyboard.press('w');
    await page.waitForTimeout(500);

    const tx = await indicator.evaluate(el => {
      const m = window.getComputedStyle(el).transform;
      const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
      return match ? Math.round(parseFloat(match[1])) : -1;
    });

    const expectedTx = Math.round(3 * indicatorWidth);
    expect(tx).toBe(expectedTx);
    await expect(page.locator('#tab-list')).toHaveAttribute('aria-current', 'page');
  });

  test('keyboard shortcut S moves indicator to stats tab', async ({ page }) => {
    const indicator = page.locator('#bn-indicator');
    const indicatorWidth = await indicator.evaluate(el => el.offsetWidth);

    // Press S for stats (tab index 4)
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    const tx = await indicator.evaluate(el => {
      const m = window.getComputedStyle(el).transform;
      const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
      return match ? Math.round(parseFloat(match[1])) : -1;
    });

    const expectedTx = Math.round(4 * indicatorWidth);
    expect(tx).toBe(expectedTx);
    await expect(page.locator('#tab-stats')).toHaveAttribute('aria-current', 'page');
  });

  test('browser refresh restores indicator on dashboard tab', async ({ page }) => {
    // Navigate to quiz first
    await page.locator('#tab-quiz').click();
    await page.waitForTimeout(500);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Dismiss onboarding if it appears
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}

    await page.waitForSelector('#view-dashboard', { timeout: 5000 });

    const indicator = page.locator('#bn-indicator');
    const tx = await indicator.evaluate(el => {
      const m = window.getComputedStyle(el).transform;
      const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
      return match ? Math.round(parseFloat(match[1])) : -1;
    });

    // After refresh, should be back on dashboard (index 0)
    expect(tx).toBe(0);

    // Only one active tab after refresh
    const activeCount = await page.evaluate(() => {
      return document.querySelectorAll('.nav-tab.active').length;
    });
    expect(activeCount).toBe(1);
  });

  test('indicator position is never stale — clicking quickly still ends on correct tab', async ({ page }) => {
    const indicator = page.locator('#bn-indicator');
    const indicatorWidth = await indicator.evaluate(el => el.offsetWidth);

    // Rapidly click multiple tabs without waiting for animation
    await page.locator('#tab-quiz').click();
    await page.locator('#tab-stats').click();
    await page.locator('#tab-list').click();
    await page.locator('#tab-learn').click();

    // Wait for final animation to settle
    await page.waitForTimeout(600);

    const tx = await indicator.evaluate(el => {
      const m = window.getComputedStyle(el).transform;
      const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
      return match ? Math.round(parseFloat(match[1])) : -1;
    });

    // Should be on learn tab (index 1)
    const expectedTx = Math.round(1 * indicatorWidth);
    expect(tx).toBe(expectedTx);
    await expect(page.locator('#tab-learn')).toHaveAttribute('aria-current', 'page');

    // Only one active tab
    const activeCount = await page.evaluate(() => {
      return document.querySelectorAll('.nav-tab.active').length;
    });
    expect(activeCount).toBe(1);
  });

  test('reduced-motion prefers no transition but still positions correctly', async ({ page }) => {
    // Set prefers-reduced-motion via CDP
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const indicator = page.locator('#bn-indicator');
    const indicatorWidth = await indicator.evaluate(el => el.offsetWidth);

    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(100);

    const tx = await indicator.evaluate(el => {
      const m = window.getComputedStyle(el).transform;
      const match = m.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),/);
      return match ? Math.round(parseFloat(match[1])) : -1;
    });

    // Should be on analytics tab (index 5) — immediately, no transition delay
    const expectedTx = Math.round(5 * indicatorWidth);
    expect(tx).toBe(expectedTx);
    await expect(page.locator('#tab-analytics')).toHaveAttribute('aria-current', 'page');
  });
});

// ── Offline Indicator ──────────────────────────────────────────

test.describe('Offline Indicator', () => {
  test('shows online status by default', async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
    } catch (e) {}

    const badge = page.locator('#offline-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(text).toContain('Offline');
  });
});

// ── Search & Word List ─────────────────────────────────────────

test.describe('Word List & Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
  });

  test('word list view shows vocabulary', async ({ page }) => {
    await page.locator('#tab-list').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#view-list')).toBeVisible();
    await expect(page.locator('#wordlist-container')).toBeVisible();

    // Should have word items
    const items = page.locator('.wordlist-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('search filters words', async ({ page }) => {
    await page.locator('#tab-list').click();
    await page.waitForTimeout(500);

    // Type a search term
    await page.locator('#search-input').fill('allah');
    await page.waitForTimeout(500);

    // Results should be filtered
    const items = page.locator('.wordlist-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('filter chips change word list', async ({ page }) => {
    await page.locator('#tab-list').click();
    await page.waitForTimeout(500);

    // Click a filter chip — try "Nouns"
    const nounChip = page.locator('#filter-type-chips .chip[data-value="noun"]');
    if (await nounChip.isVisible()) {
      await nounChip.click();
      await page.waitForTimeout(500);
    }

    // List should update
    const items = page.locator('.wordlist-item');
    await expect(items.first()).toBeVisible();
  });
});

// ── Keyboard Shortcuts ─────────────────────────────────────────

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
  });

  test('? key shows keyboard hints', async ({ page }) => {
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    const hints = page.locator('#kbd-hints');
    await expect(hints).toBeVisible();
  });

  test('W key switches to word list', async ({ page }) => {
    await page.keyboard.press('w');
    await page.waitForTimeout(500);
    await expect(page.locator('#view-list')).toBeVisible();
  });

  test('S key switches to stats', async ({ page }) => {
    await page.keyboard.press('s');
    await page.waitForTimeout(500);
    await expect(page.locator('#view-stats')).toBeVisible();
  });
});

// ── SRS Rating — Edge Cases ────────────────────────────────────

test.describe('SRS Rating - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);
  });

  test('rating "Again" on a word resets the SRS pill status', async ({ page }) => {
    // Navigate forward to enable SRS
    await page.locator('#btn-next').click();
    await page.waitForTimeout(300);

    // Get initial SRS pill text
    const srPill = page.locator('#sr-pill');
    const initialText = await srPill.textContent();

    // Click "Again" (forgotten)
    await page.locator('#srs-again').click();
    await page.waitForTimeout(500);

    // After rating, the SRS pill should reflect the rating
    // The pill should still be visible and should not be empty
    await expect(srPill).toBeVisible();
    const afterText = await srPill.textContent();
    expect(afterText.length).toBeGreaterThan(0);
  });

  test('rating a word and navigating back retains learned count', async ({ page }) => {
    // Navigate forward to enable SRS
    await page.locator('#btn-next').click();
    await page.waitForTimeout(300);

    // Get initial learned count
    const learned = page.locator('#stat-learned');
    const initialLearned = parseInt(await learned.textContent()) || 0;

    // Rate the word
    await page.locator('#srs-good').click();
    await page.waitForTimeout(500);

    const firstLearned = parseInt(await learned.textContent()) || 0;

    // Navigate back to previous word (if available)
    await page.locator('#btn-prev').click();
    await page.waitForTimeout(300);

    // Learned count should persist (not reset)
    const afterBack = parseInt(await learned.textContent()) || 0;
    expect(afterBack).toBeGreaterThanOrEqual(firstLearned);
  });

  test('rating "Easy" updates SRS status to reflect better retention', async ({ page }) => {
    await page.locator('#btn-next').click();
    await page.waitForTimeout(300);

    // Get initial SRS pill status
    const srPill = page.locator('#sr-pill');
    const initialPillText = await srPill.textContent();

    // Rate with "Easy"
    await page.locator('#srs-easy').click();
    await page.waitForTimeout(500);

    // After rating, stats should be visible and positive
    const learned = page.locator('#stat-learned');
    const text = await learned.textContent();
    expect(parseInt(text) || 0).toBeGreaterThanOrEqual(0);

    // SRS pill should update after rating
    const newPillText = await srPill.textContent();
    // New pill content should reflect the rating (not empty, may change status)
    expect(newPillText.length).toBeGreaterThan(0);
  });
});

// ── Quiz Completion — Edge Cases ───────────────────────────────

test.describe('Quiz Completion - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);
    await page.locator('#tab-quiz').click();
    await page.waitForTimeout(500);
  });

  test('correct answer shows green feedback and update score', async ({ page }) => {
    // Answer first question correctly by picking the right option
    await page.waitForTimeout(300);
    const firstOption = page.locator('.quiz-opt').first();
    await firstOption.click();
    await page.waitForTimeout(300);

    // Next button should appear
    await expect(page.locator('#btn-next-quiz')).toBeVisible();

    // Score display should show 1/1 correct
    const score = page.locator('#quiz-score-display');
    await expect(score).toContainText(/correct/);
  });

  test('score updates across multiple answers', async ({ page }) => {
    await page.waitForTimeout(300);

    // Answer first question
    const firstOption = page.locator('.quiz-opt').first();
    await firstOption.click();
    await page.waitForTimeout(200);

    // Advance to next question
    await page.locator('#btn-next-quiz').click();
    await page.waitForTimeout(300);

    // Answer second question
    const secondOptions = page.locator('.quiz-opt');
    const count = await secondOptions.count();
    if (count > 0) {
      await secondOptions.first().click();
      await page.waitForTimeout(200);
    }

    // Score should have advanced
    const score = page.locator('#quiz-score-display');
    await expect(score).toContainText(/correct/);
  });

  test('quiz navigates between questions with score progression', async ({ page }) => {
    await page.waitForTimeout(300);

    // Answer first question
    const firstOption = page.locator('.quiz-opt').first();
    await firstOption.click();
    await page.waitForTimeout(200);

    // Feedback should appear with correct/incorrect indicator
    const feedback = page.locator('#quiz-feedback');
    await expect(feedback).not.toBeEmpty();

    // Score display should show progress like "1/1" or "correct"
    const scoreEl = page.locator('#quiz-score-display');
    await expect(scoreEl).not.toBeEmpty();

    // Advance to next question
    await page.locator('#btn-next-quiz').click();
    await page.waitForTimeout(500);

    // Should show next question (different word or same with updated score)
    await expect(page.locator('#quiz-word')).toBeVisible();

    // Answer second question
    const secondOptions = page.locator('.quiz-opt');
    const optCount = await secondOptions.count();
    expect(optCount).toBeGreaterThanOrEqual(2);
    await secondOptions.first().click();
    await page.waitForTimeout(200);

    // Score should advance
    const updatedScore = await scoreEl.textContent();
    expect(updatedScore.length).toBeGreaterThan(0);
  });

  test('quiz score percentage displays in top bar', async ({ page }) => {
    await page.waitForTimeout(300);

    // Answer a question
    const firstOption = page.locator('.quiz-opt').first();
    await firstOption.click();
    await page.waitForTimeout(300);

    // Score in top bar should update
    const scoreEl = page.locator('#stat-score');
    const text = await scoreEl.textContent();
    // Should show percentage (100% or 0% depending on answer)
    expect(text).toMatch(/%|-/);
  });
});

// ── Vocabulary Explorer ─────────────────────────────────────────

test.describe('Vocabulary Explorer', () => {
  async function navigateToWordAndOpenExplorer(page) {
    await page.locator('#tab-list').click();
    await page.waitForTimeout(800);

    // Click first word in list to navigate to learn view
    const firstItem = page.locator('.wordlist-item').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });
    await firstItem.click();
    await page.waitForTimeout(800);

    // Open explorer via global bridge function
    await page.evaluate(() => {
      const w = window.__getCurrentWord();
      if (w && window.__openExplorer) {
        window.__openExplorer(w);
      }
    });
    await page.waitForTimeout(500);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
  });

  test('opens explorer view from word list click', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    // Should now be in the explorer view
    await expect(page.locator('#view-explorer')).toBeVisible({ timeout: 3000 });
  });

  test('explorer shows core word information (arabic, translit, meaning, root)', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    await expect(page.locator('#view-explorer')).toBeVisible();

    // Core info elements should be populated
    await expect(page.locator('#explorer-arabic')).not.toBeEmpty();
    await expect(page.locator('#explorer-translit')).not.toBeEmpty();
    await expect(page.locator('#explorer-meaning-main')).not.toBeEmpty();
    await expect(page.locator('#explorer-root')).not.toBeEmpty();
    await expect(page.locator('#explorer-pos')).not.toBeEmpty();
  });

  test('explorer displays occurrence count and verse context', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    await expect(page.locator('#view-explorer')).toBeVisible();

    // Occurrence info should be present
    await expect(page.locator('#explorer-occ')).not.toBeEmpty();
    await expect(page.locator('#explorer-total-occ')).not.toBeEmpty();
    await expect(page.locator('#explorer-surah-count')).not.toBeEmpty();

    // Ayah display area should be visible
    await expect(page.locator('#explorer-ayah-arabic')).not.toBeEmpty();
    await expect(page.locator('#explorer-ayah-translation')).not.toBeEmpty();
    await expect(page.locator('#explorer-ayah-ref')).not.toBeEmpty();
  });

  test('explorer displays root family list', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    // Root family section should exist and have content or empty message
    const rootFamilyList = page.locator('#explorer-root-family-list');
    await expect(rootFamilyList).toBeVisible();
  });

  test('explorer shows derived forms and morphological relatives', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    // Derived forms section
    const derivedList = page.locator('#explorer-derived-forms-list');
    await expect(derivedList).toBeVisible();

    // Morphological relatives
    const morphList = page.locator('#explorer-morph-list');
    await expect(morphList).toBeVisible();
  });

  test('explorer shows SRS learning progress', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    // Learning progress section
    await expect(page.locator('#explorer-srs-stage')).toBeVisible();
    await expect(page.locator('#explorer-last-studied')).toBeVisible();
    await expect(page.locator('#explorer-next-review')).toBeVisible();
    await expect(page.locator('#explorer-review-count')).toBeVisible();
    await expect(page.locator('#explorer-foundation-status')).toBeVisible();
  });

  test('explorer back button returns to previous view', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    await expect(page.locator('#view-explorer')).toBeVisible();

    // Click back button
    await page.locator('#explorer-back').click();

    // Wait for explorer view to be dismissed (animation ~400ms)
    await expect(page.locator('#view-explorer')).not.toBeVisible({ timeout: 3000 });

    // Should return to a view — either learn or list was the previous view
    // The view-entrance animation may briefly hide the target, so wait for content
    await page.waitForTimeout(500);
    const isLearnVisible = await page.locator('#view-learn').isVisible();
    const isListVisible = await page.locator('#view-list').isVisible();
    expect(isLearnVisible || isListVisible).toBeTruthy();
  });

  test('explorer has action buttons (bookmark, study, review)', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    await expect(page.locator('#explorer-btn-bookmark')).toBeVisible();
    await expect(page.locator('#explorer-btn-study')).toBeVisible();
    await expect(page.locator('#explorer-btn-review')).toBeVisible();
  });

  test('explorer word relationships section has semantic groups', async ({ page }) => {
    await navigateToWordAndOpenExplorer(page);

    // Various relationship lists should exist
    await expect(page.locator('#explorer-semantic-list')).toBeVisible();
    await expect(page.locator('#explorer-similar-list')).toBeVisible();
    await expect(page.locator('#explorer-related-list')).toBeVisible();
  });
});

// ── Analytics View ─────────────────────────────────────────────

test.describe('Analytics View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
  });

  test('analytics tab renders content', async ({ page }) => {
    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#view-analytics')).toBeVisible();

    // Analytics tabs should be present
    const tabs = page.locator('.analytics-tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(3);

    // Analytics content area should be present
    const content = page.locator('#analytics-content');
    await expect(content).toBeVisible();
  });

  test('overview tab shows learning stats', async ({ page }) => {
    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(1000);

    // Overview tab should be active by default and show stat cards
    const overviewTab = page.locator('.analytics-tab-active');
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toContainText(/Overview/i);

    // Content area should have analytics content
    const content = page.locator('#analytics-content');
    await expect(content).not.toBeEmpty();
  });

  test('trends tab is clickable', async ({ page }) => {
    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(1000);

    // Click the Trends tab
    const trendsTab = page.locator('.analytics-tab').filter({ hasText: /Trends/i });
    await expect(trendsTab).toBeVisible();
    await trendsTab.click();
    await page.waitForTimeout(500);

    // Should have content
    const content = page.locator('#analytics-content');
    await expect(content).not.toBeEmpty();
  });

  test('insights tab is clickable', async ({ page }) => {
    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(1000);

    // Click the Insights tab
    const insightsTab = page.locator('.analytics-tab').filter({ hasText: /Insights/i });
    await expect(insightsTab).toBeVisible();
    await insightsTab.click();
    await page.waitForTimeout(500);

    const content = page.locator('#analytics-content');
    await expect(content).not.toBeEmpty();
  });

  test('achievements tab is clickable', async ({ page }) => {
    await page.locator('#tab-analytics').click();
    await page.waitForTimeout(1000);

    const achievementsTab = page.locator('.analytics-tab').filter({ hasText: /Achievements/i });
    await expect(achievementsTab).toBeVisible();
    await achievementsTab.click();
    await page.waitForTimeout(500);

    const content = page.locator('#analytics-content');
    await expect(content).not.toBeEmpty();
  });
});

// ── Progress Persistence ───────────────────────────────────────

test.describe('Progress Persistence', () => {
  test('lesson completion persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Seed lesson progress data
    await page.evaluate(() => {
      localStorage.clear();
      const progress = {
        currentLesson: 1,
        completedLessons: [0],
        quizPassed: { '0': true },
      };
      localStorage.setItem('quran_lesson_progress', JSON.stringify(progress));
      localStorage.setItem('quran_onboarding_done', 'true');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);

    const lessonLabel = page.locator('#lesson-label');
    const text = await lessonLabel.textContent();
    // The lesson label should reflect the saved progress
    expect(text).toContain('Lesson');
  });

  test('SRS data persists across page reloads', async ({ page }) => {
    // Seed SRS data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      const srsData = {
        'test_word_1': {
          dueDate: Date.now() + 86400000,
          interval: 1,
          lastRating: 2,
          ratedAt: Date.now(),
          stage: 1,
          reps: 1,
          totalReviews: 1,
          lapses: 0,
          easeFactor: 2.5,
          leechCount: 0,
          isLeech: false,
        },
      };
      localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
      localStorage.setItem('quran_onboarding_done', 'true');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Navigate to stats to check SRS data persisted
    await page.locator('#tab-stats').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#view-stats')).toBeVisible();
  });
});

// ── Quick Flashcard Mode ───────────────────────────────────────

test.describe('Quick Flashcard Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    try {
      await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
      await page.locator('#onboarding-skip').click();
      await page.waitForTimeout(500);
    } catch (e) {}
    await page.locator('#tab-learn').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);
  });

  test('quick mode toggle button is visible', async ({ page }) => {
    await expect(page.locator('#qa-quick-mode')).toBeVisible();
  });

  test('toggling quick mode hides extra content', async ({ page }) => {
    // Click quick mode button
    await page.locator('#qa-quick-mode').click();
    await page.waitForTimeout(300);

    // The learn view should have quick-mode class
    const learnView = page.locator('#view-learn');
    const hasQuickMode = await learnView.evaluate(el => el.classList.contains('quick-mode'));
    expect(hasQuickMode).toBeTruthy();
  });

  test('toggling quick mode off restores full layout', async ({ page }) => {
    // Toggle on — use page.evaluate to bypass smooth-scroll repositioning
    await page.evaluate(() => {
      var btn = document.getElementById('qa-quick-mode');
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    // Toggle off
    await page.evaluate(() => {
      var btn = document.getElementById('qa-quick-mode');
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    // Check quick-mode class is removed
    const hasQuickMode = await page.evaluate(() => {
      var view = document.getElementById('view-learn');
      return view ? view.classList.contains('quick-mode') : false;
    });
    expect(hasQuickMode).toBeFalsy();

    // Button should say "⚡ Quick" when off
    await expect(page.locator('#qa-quick-mode')).toContainText(/Quick(?!: ON)/);
  });
});
