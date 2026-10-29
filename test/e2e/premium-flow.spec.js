// ═══════════════════════════════════════════════════════════════
// premium-flow.spec.js — Premium Checkout Flow (frontend contract)
//
// The full purchase cannot run in CI (it needs a signed-in user, the
// Vercel function and the Polar sandbox — the server side is covered
// by test/api-checkout.test.js and test/api-webhook.test.js). What IS
// testable end-to-end in a real browser:
//   • Guest entitlement state (isPremium() === false, no premium badge)
//   • Choosing a paid plan in the auto-shown plan picker as a guest →
//     sign-in prompt (the requestUpgrade contract, real UI)
//   • ?checkout=success / ?checkout=cancel redirect handling
//     (URL cleaned, no crash, cancel stays silent)
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// ── Helper: Skip onboarding + dismiss the plan picker ─────────
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

test.describe('Premium Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipOnboarding(page);
  });

  test('guest has no premium entitlement', async ({ page }) => {
    // The entitlement service reports non-premium for a signed-out user.
    const isPremium = await page.evaluate(() => (window.__premium ? window.__premium.isPremium() : null));
    expect(isPremium).toBe(false);

    // Profile view shows no premium badge for a guest.
    await page.locator('#tab-profile').click();
    await expect(page.locator('#profile-premium-badge')).toBeHidden();
  });

  test('checkout=success param is cleaned and does not crash the app', async ({ page }) => {
    // Simulates returning from the hosted checkout with a successful payment.
    await page.goto('/?checkout=success');
    await skipOnboarding(page);

    // The param is stripped from the URL so a refresh cannot re-trigger it.
    expect(page.url()).not.toContain('checkout=');
    await expect(page.locator('.top-bar')).toBeVisible();
    await expect(page.locator('.bottom-nav')).toBeVisible();
  });

  test('checkout=cancel param is silently dismissed and cleaned', async ({ page }) => {
    await page.goto('/?checkout=cancel');
    await skipOnboarding(page);

    expect(page.url()).not.toContain('checkout=');
    await expect(page.locator('.top-bar')).toBeVisible();

    // Cancel must not raise a success/payment toast.
    const toastText = ((await page.locator('#toast-container').textContent().catch(() => '')) || '').toLowerCase();
    expect(toastText).not.toContain("you're premium");
    expect(toastText).not.toContain('payment received');
  });

});

// The plan-picker test deliberately does NOT use the beforeEach above: the
// picker is offered once, on a visit after the first Foundation lesson, so
// this test seeds that state instead of going through onboarding.
test.describe('Premium Checkout — Plan Picker (guest)', () => {
  test('choosing a paid plan in the plan picker prompts sign-in for guests', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('quran_onboarding_done', 'true');
      localStorage.setItem('quran_foundation_progress', JSON.stringify({
        currentLesson: 1, completedLessons: [0], quizPassed: { '0': true },
      }));
    });
    await page.reload();

    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 15000 });
    await page.locator('.plan-card[data-plan="monthly"]').click();

    // requestUpgrade for a signed-out user → sign-in prompt + toast.
    await expect(page.locator('#toast-container')).toContainText('Please sign in to upgrade to premium', {
      timeout: 5000,
    });
    // The picker closes after the choice.
    await page.waitForSelector('#plan-picker-overlay', { state: 'hidden', timeout: 3000 });
  });
});
