// ═══════════════════════════════════════════════════════════════
// word-meanings.spec.js — A meaning under every word in the reader
//
//   1. Al-Baqarah 2:3 with Meanings on: all 8 words show their meaning,
//      and no word in the surah is left without one.
//   2. بَعۡدَ مَا in 2:181 is one word with one meaning.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

async function openBaqarah(page) {
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
  await page.evaluate(() => openSurahForReading(2));
  await page.waitForSelector('#quran-ayah-2-3', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => window.__ux && window.__ux.closeTooltips && window.__ux.closeTooltips());
  // A tip bubble can sit over the button, so click it directly
  await page.evaluate(() => document.getElementById('reader-meanings').click());
  await expect(page.locator('#reader-meanings')).toHaveAttribute('aria-pressed', 'true');
}

test('every word of 2:3 shows its meaning', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openBaqarah(page);
  const glosses = await page.locator('#quran-ayah-2-3 .quran-ayah-arabic > span').evaluateAll(
    (spans) => spans.map((s) => s.getAttribute('data-gloss')));
  expect(glosses).toEqual(['Those who', 'believe', 'in the unseen', 'and establish', 'the prayer',
    'and out of what', 'We have provided them', 'they spend']);
  const missing = await page.locator('#quran-verses .quran-ayah-arabic > span:not([data-gloss])').count();
  expect(missing).toBe(0);
  expect(errors).toEqual([]);
});

test('a word written in two parts keeps one meaning (2:181)', async ({ page }) => {
  await openBaqarah(page);
  const word = page.locator('#quran-ayah-2-181 [data-gloss="after what"]');
  await expect(word).toHaveText('بَعۡدَ مَا');
});

test('tapping a word opens its panel, and Report a mistake fills in the feedback form', async ({ page }) => {
  await openBaqarah(page);
  await page.locator('#quran-ayah-2-3 [data-n="2"]').click();
  const panel = page.locator('#word-panel-overlay');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.word-panel-word')).toHaveText('يُؤۡمِنُونَ');
  await expect(panel.locator('.word-panel-meaning')).toHaveText('believe');
  await panel.locator('#word-panel-report').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#fb-text')).toHaveValue('Mistake in a word meaning. Verse 2:3, word 2: يُؤۡمِنُونَ, shown as "believe". What is wrong:\n');
});
