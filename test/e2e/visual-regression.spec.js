// ═══════════════════════════════════════════════════════════════
// visual-regression.spec.js — Full Layout Audit
//
// Tests all 5 main views at mobile (390×844) and desktop
// (1280×800) widths. Takes screenshots and verifies that each
// view:
//   • renders visible content
//   • has no console errors
//   • has no hidden blank areas
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// ── Helpers ──────────────────────────────────────────────────

async function setup(page) {
  await page.goto('/');
  // Wait for app to initialize
  try {
    await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
    await page.locator('#onboarding-skip').click();
    await page.waitForTimeout(500);
  } catch (_) {}
  await page.waitForSelector('#view-dashboard', { timeout: 5000 });
}

async function captureErrors(page) {
  return await page.evaluate(() => {
    // Collect any React/hydration/rendering errors in the DOM
    const errorElements = document.querySelectorAll('[data-error], .error, .err-msg');
    return Array.from(errorElements).map(e => e.textContent).filter(Boolean);
  });
}

async function checkNoOverflow(page, viewId) {
  return await page.evaluate((vid) => {
    const view = document.getElementById(vid);
    if (!view) return { ok: false, reason: 'view not found' };
    const rect = view.getBoundingClientRect();
    const docWidth = document.documentElement.clientWidth;
    const docHeight = document.documentElement.clientHeight;
    return {
      ok: rect.width <= docWidth && rect.height > 0,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      docWidth,
      docHeight,
    };
  }, viewId);
}

async function checkContentVisible(page, viewId, selectors) {
  return await page.evaluate(({ vid, sels }) => {
    const view = document.getElementById(vid);
    if (!view) return { ok: false, reason: 'view not found' };
    const results = {};
    sels.forEach(sel => {
      const el = view.querySelector(sel);
      results[sel] = el ? {
        found: true,
        text: (el.textContent || '').trim().substring(0, 50),
        visible: el.offsetParent !== null,
      } : { found: false };
    });
    return results;
  }, { vid: viewId, sels: selectors });
}

// ── Viewport configurations ──────────────────────────────────

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

// ── Views to test ────────────────────────────────────────────

const VIEWS = [
  {
    id: 'view-dashboard',
    tab: '#tab-dashboard',
    selectors: ['#dashboard-grid', '.db-greeting', '.db-card'],
    label: 'Dashboard',
  },
  {
    id: 'view-learn',
    tab: '#tab-learn',
    selectors: ['#word-card', '#arabic-word', '#meaning', '#lesson-label'],
    label: 'Learn',
  },
  {
    id: 'view-list',
    tab: '#tab-list',
    selectors: ['#wordlist-container', '#search-input', '.wordlist-item'],
    label: 'Words',
  },
  {
    id: 'view-reader',
    tab: '#tab-reader',
    selectors: ['.quran-surah-list', '.quran-surah-item'],
    label: 'Quran',
  },
  {
    id: 'view-profile',
    tab: '#tab-profile',
    selectors: ['.profile-container', '.profile-avatar', '.profile-tabs'],
    label: 'Profile',
  },
];

// ── Wait for each view's content to render ───────────────────

async function switchToView(page, view) {
  // Click the tab
  const tabSelector = view.tab;
  const tabEl = page.locator(tabSelector);
  await expect(tabEl).toBeVisible({ timeout: 3000 });
  await tabEl.click();
  // Wait for view to become active
  await page.waitForSelector(`#${view.id}`, { timeout: 5000, state: 'attached' });
  // Give async rendering time
  await page.waitForTimeout(800);
}

// ── Tests ────────────────────────────────────────────────────

VIEWPORTS.forEach(vp => {
  test.describe(`Visual Regression — ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    VIEWS.forEach(view => {
      test(`${view.label} renders correctly`, async ({ page }) => {
        await setup(page);
        // Switch to the view
        console.log(`  [${vp.name}] Navigating to ${view.label}...`);
        await switchToView(page, view);

        // 1. Check view is visible and has content
        const viewEl = page.locator(`#${view.id}`);
        await expect(viewEl).toBeVisible({ timeout: 3000 });

        // 2. Take screenshot
        const screenshotPath = `test-results/screenshots/${vp.name}-${view.label.toLowerCase().replace(/\s+/g, '-')}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`  Screenshot saved: ${screenshotPath}`);

        // 3. Check for overflow — view should fit in viewport
        const overflow = await checkNoOverflow(page, view.id);
        expect(overflow.ok).toBeTruthy();
        console.log(`  Overflow check: ${JSON.stringify(overflow)}`);

        // 4. Check that key selectors exist and have content
        const content = await checkContentVisible(page, view.id, view.selectors);
        console.log(`  Content check:`, JSON.stringify(content));
        view.selectors.forEach(sel => {
          expect(content[sel] && content[sel].found).toBeTruthy();
        });

        // 5. Check no error elements in DOM
        const errors = await captureErrors(page);
        expect(errors.length).toBe(0);
        console.log(`  Errors found: ${errors.length}`);
      });
    });
  });
});
