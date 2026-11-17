// ═══════════════════════════════════════════════════════════════
// quran-map.spec.js — the Quran map, from the Quran tab to a word
//
// The learner has mastered قُلْ هُوَ اللَّهُ أَحَدٌ (seeded SRS). The Quran
// tab's map card opens 604 shaded pages; page 604 shows those words in
// gold, and tapping one opens the word panel with its meaning.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

async function skipOnboarding(page) {
  try {
    await page.waitForSelector('#onboarding-overlay', { timeout: 10000, state: 'visible' });
    await page.locator('#onboarding-skip').click();
    await page.waitForSelector('#onboarding-overlay', { state: 'hidden', timeout: 3000 });
  } catch (e) {}
  try {
    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 5000 });
    const skipBtn = page.locator('#plan-picker-skip');
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
      await page.waitForSelector('#plan-picker-overlay', { state: 'hidden', timeout: 3000 });
    }
  } catch (e) {}
}

test.describe('Quran map', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('quran_srs_data')) return;
      const now = Date.now();
      const srs = {};
      [885, 1059, 234, 26].forEach((n, i) => {
        srs['cw_' + n] = { stage: 2, ratedAt: now - 1000 + i, nextReview: now + 86400000 * 7 };
      });
      localStorage.setItem('quran_srs_data', JSON.stringify(srs));
    });
    await page.goto('/');
    await skipOnboarding(page);
  });

  test('open the map, then page 604, then a known word', async ({ page }) => {
    await page.locator('#tab-quran').click();
    const card = page.locator('#quran-map-card');
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();

    const view = page.locator('#view-quran-map');
    await expect(view).toBeVisible();
    await expect(view.locator('[data-action="page"]')).toHaveCount(604, { timeout: 15000 });
    const last = view.locator('[data-page="604"]');
    await expect(last).toHaveAttribute('aria-label', /^Page 604, juz 30, [1-9]\d?% known$/);
    await last.click();

    await expect(view.locator('#quran-map-title')).toHaveText('Page 604');
    const known = view.locator('.qmap-tok.is-known');
    await expect(known.first()).toBeVisible({ timeout: 15000 });
    await known.first().click();
    await expect(page.locator('#word-panel-overlay')).toBeVisible();
    await expect(page.locator('#word-panel-word')).not.toBeEmpty();
    await page.locator('#word-panel-close').click();

    await view.locator('[data-action="map"]').click();
    await expect(view.locator('[data-action="page"]')).toHaveCount(604);
  });
});
