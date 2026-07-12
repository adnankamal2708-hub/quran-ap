// ═══════════════════════════════════════════════════════════════
// sle-diagnostic.spec.js — Smart Learning Engine E2E Diagnostic
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

test.describe('Smart Learning Engine E2E', () => {

  test('SLE module loads and renders on dashboard', async ({ page }) => {
    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to app
    await page.goto('/');

    // Wait for splash screen to disappear (max 10s)
    // The splash has class 'splash-screen' and gets 'splash-hidden' class
    await page.waitForFunction(() => {
      const splash = document.querySelector('.splash-screen');
      if (!splash) return true; // Already removed from DOM
      return splash.classList.contains('splash-hidden');
    }, { timeout: 10000 }).catch(() => {});

    // Wait a bit more for the app to fully initialize
    await page.waitForTimeout(3000);

    // Check for JS errors
    console.log('Console errors:', consoleErrors.length > 0 ? consoleErrors : 'none');

    // 1. Check if window.__smartLearning exists
    const sleExists = await page.evaluate(() => {
      return typeof window.__smartLearning !== 'undefined';
    });
    console.log('window.__smartLearning exists:', sleExists);

    if (sleExists) {
      // 2. Get recommendations
      const recs = await page.evaluate(() => {
        try {
          return window.__smartLearning.getScoredRecommendations();
        } catch (e) {
          return { error: e.message };
        }
      });
      console.log('Recommendations:', JSON.stringify(recs).substring(0, 2000));

      // 3. Check dashboard for SLE cards
      const sleCardsOnDashboard = await page.evaluate(() => {
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return { found: false, reason: 'no dashboard-grid' };
        const sleCards = grid.querySelectorAll('.db-sle-card, [id^="sle-rec-"]');
        return {
          found: sleCards.length > 0,
          count: sleCards.length,
          ids: Array.from(sleCards).map(c => c.id || 'no-id'),
        };
      });
      console.log('SLE cards on dashboard:', JSON.stringify(sleCardsOnDashboard));
    }

    // 4. Check that the dashboard-grid has content
    const dashboardContent = await page.evaluate(() => {
      const grid = document.getElementById('dashboard-grid');
      if (!grid) return { exists: false };
      return {
        exists: true,
        htmlLength: grid.innerHTML.length,
        childCount: grid.children.length,
        firstChildTag: grid.children[0] ? grid.children[0].tagName : 'none',
        firstChildClass: grid.children[0] ? grid.children[0].className : 'none',
        hasGreeting: !!grid.querySelector('.db-greeting'),
        hasHeroBar: !!grid.querySelector('.db-hero-bar'),
        hasPathsGrid: !!grid.querySelector('.db-paths-grid'),
      };
    });
    console.log('Dashboard content:', JSON.stringify(dashboardContent));

    // 5. Check for errors in all bundle initialization
    const bundleInitCheck = await page.evaluate(() => {
      const checks = {
        hasAllWords: typeof ALL_WORDS !== 'undefined',
        hasSRS: typeof window.__srs !== 'undefined',
        hasAnalytics: typeof window.__analytics !== 'undefined',
        hasAdaptive: typeof window.__adaptive !== 'undefined',
        hasSmartLearning: typeof window.__smartLearning !== 'undefined',
        hasReader: typeof window.__reader !== 'undefined',
        hasLearnScreen: typeof window.__learnScreen !== 'undefined',
        hasProfileUI: typeof window.__profileUI !== 'undefined',
      };
      return checks;
    });
    console.log('Bundle initialization:', JSON.stringify(bundleInitCheck));

    // 6. Navigate to Learn view and check learn screen header
    await page.click('#tab-learn');
    await page.waitForTimeout(2000);

    const learnContent = await page.evaluate(() => {
      const header = document.getElementById('learn-action-header');
      if (!header) return { exists: false, reason: 'no learn-action-header' };
      return {
        exists: true,
        htmlLength: header.innerHTML.length,
        hasGreeting: !!header.querySelector('.ls-greeting'),
        hasCompHeadline: !!header.querySelector('.ls-comp-headline'),
        hasGoalRow: !!header.querySelector('.ls-goal-row'),
        hasSmartRec: !!header.querySelector('#ls-smart-rec'),
        hasPathsGrid: !!header.querySelector('.ls-paths-grid'),
        hasMotivation: !!header.querySelector('.ls-motivation'),
      };
    });
    console.log('Learn content:', JSON.stringify(learnContent));

    // Assertions
    expect(dashboardContent.exists).toBe(true);
    expect(dashboardContent.hasGreeting).toBe(true);

    if (sleExists) {
      expect(Array.isArray(recs)).toBe(true);
    }
  });
});
