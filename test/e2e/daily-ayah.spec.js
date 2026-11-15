// ═══════════════════════════════════════════════════════════════
// daily-ayah.spec.js — Today's ayah, from the Home card to the count
//
// The learner has mastered قُلْ هُوَ اللَّهُ أَحَدٌ (seeded SRS). Home shows
// "Today's ayah"; opening it runs the new words, the ayah on its own and
// the check, and "I understood it" turns the card into the read count.
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

// A new learner lands in a lesson after onboarding; the card lives on Home.
async function goHome(page) {
  await page.locator('#tab-home').click();
  await expect(page.locator('#view-dashboard')).toBeVisible();
}

test.describe("Today's ayah", () => {
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
    await goHome(page);
  });

  test('read today\'s ayah on your own and see the count', async ({ page }) => {
    const card = page.locator('#db-daily-ayah [data-action="open"]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText("Today's ayah");
    await card.click();

    const view = page.locator('#view-daily-ayah');
    await expect(view).toBeVisible();
    // New words first, if there are any
    for (let i = 0; i < 3 && await view.locator('[data-action="next"]').count(); i++) {
      await view.locator('[data-action="next"]').click();
    }
    const words = view.locator('[data-action="word"]');
    expect(await words.count()).toBeGreaterThanOrEqual(4);
    await words.first().click();
    await expect(view.locator('#daily-ayah-meaning')).not.toBeEmpty();

    await view.locator('[data-action="understood"]').click();
    await expect(view.locator('.daily-ayah-translation')).not.toBeEmpty();
    await view.locator('[data-action="home"]').last().click();

    const done = page.locator('#db-daily-ayah');
    await expect(done).toContainText('Read today', { timeout: 10000 });
    await expect(done).toContainText('1 ayah read on your own');

    await page.reload();
    await goHome(page);
    await expect(page.locator('#db-daily-ayah')).toContainText('1 ayah read on your own', { timeout: 15000 });
  });

  test('the ayah screen works with Back after reload', async ({ page }) => {
    await page.locator('#db-daily-ayah [data-action="open"]').click({ timeout: 15000 });
    await expect(page.locator('#view-daily-ayah')).toBeVisible();
    await page.reload();
    await skipOnboarding(page);
    await goHome(page);
    await expect(page.locator('#db-daily-ayah [data-action="open"]')).toBeVisible({ timeout: 15000 });
  });
});
