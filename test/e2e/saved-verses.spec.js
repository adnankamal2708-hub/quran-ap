// ═══════════════════════════════════════════════════════════════
// saved-verses.spec.js — Saving a verse for later
//
// Save a verse in the reader, find it under "Saved verses" on the Quran
// tab, open the reader at it from there, and unsave it.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

async function openSurah(page, id) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#onboarding-overlay', { timeout: 10000, state: 'visible' });
  await page.locator('#onboarding-skip').click();
  try {
    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 3000 });
    await page.locator('#plan-picker-skip').click();
  } catch (e) { /* not shown */ }
  await page.locator('#tab-quran').click();
  await page.evaluate((s) => openSurahForReading(s), id);
  await page.waitForSelector('#quran-ayah-' + id + '-1', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => window.__ux && window.__ux.closeTooltips && window.__ux.closeTooltips());
}

test('save a verse, open it from Saved verses, then unsave it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openSurah(page, 112);
  const save = page.locator('#quran-ayah-112-3 .quran-ayah-save');
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await expect(save).toHaveAttribute('aria-label', 'Save verse 3');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(save).toHaveAttribute('aria-label', 'Remove verse 3 from saved');
  // Saving does not start the recitation
  await expect(page.locator('#reader-listen')).toHaveAttribute('aria-pressed', 'false');

  await page.evaluate(() => goBackToSurahList());
  const item = page.locator('.saved-verse-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('verse 3');
  await item.click();
  await page.waitForSelector('#quran-ayah-112-3', { state: 'attached', timeout: 15000 });
  await expect(page.locator('#quran-ayah-112-3 .quran-ayah-save')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#quran-ayah-112-3 .quran-ayah-save').click();
  await expect(page.locator('#quran-ayah-112-3 .quran-ayah-save')).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => goBackToSurahList());
  await expect(page.locator('.saved-verses')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a free account can save 10 verses; the 11th shows a message', async ({ page }) => {
  await openSurah(page, 2);
  await page.evaluate(() => {
    for (let v = 1; v <= 10; v++) toggleSavedVerse('3:' + v);
  });
  await page.locator('#quran-ayah-2-5 .quran-ayah-save').click();
  await expect(page.locator('#quran-ayah-2-5 .quran-ayah-save')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('You can save 10 verses on the free plan', { exact: false })).toBeVisible();
});
