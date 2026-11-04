// ═══════════════════════════════════════════════════════════════
// slow-firebase.spec.js — The app starts without waiting for Firebase
//
// Firebase is loaded from Google's CDN (www.gstatic.com). When that host
// is slow or blocked, the app must still open and work as a guest, and
// sign-in must switch on once Firebase arrives:
//   1. gstatic never answers: the page loads, the app runs, tabs work.
//   2. gstatic answers late: auth becomes ready after it arrives.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

async function seedReturningGuest(page) {
  await page.addInitScript(() => {
    localStorage.setItem('quran_onboarding_done', 'true');
    localStorage.setItem('quran_plan_picker_seen', 'true');
  });
}

test.describe('Slow Firebase CDN', () => {
  test('the app opens and works when gstatic never answers', async ({ page }) => {
    await seedReturningGuest(page);
    await page.route('https://www.gstatic.com/**', () => {}); // never answers

    await page.goto('/', { timeout: 15000 });
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 10000 });

    await page.locator('#tab-practice').click();
    await expect(page.locator('#view-review-center')).toBeVisible();
    expect(await page.evaluate(() => typeof window.__firebaseCore)).toBe('undefined');
  });

  test('sign-in switches on once gstatic answers late', async ({ page }) => {
    await seedReturningGuest(page);
    await page.route('https://www.gstatic.com/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    await page.goto('/', { timeout: 15000 });
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => window.__auth.isReady())).toBe(false);

    await expect.poll(() => page.evaluate(() => window.__auth.isReady()), { timeout: 30000 }).toBe(true);
  });

  test('the plan picker still appears when Firebase arrives after its 3-second check', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('quran_onboarding_done', 'true');
      localStorage.setItem('quran_foundation_progress', JSON.stringify({
        currentLesson: 1, completedLessons: [0], quizPassed: { '0': true },
      }));
    });
    await page.route('https://www.gstatic.com/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.continue();
    });

    await page.goto('/', { timeout: 15000 });
    await expect(page.locator('#plan-picker-overlay.plan-picker-visible')).toBeVisible({ timeout: 30000 });
  });
});
