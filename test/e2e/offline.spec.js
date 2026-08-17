// ═══════════════════════════════════════════════════════════════
// offline.spec.js — Real Offline Use (PWA)
//
// Verifies the offline-first promise end-to-end in a real browser:
//   1. The service worker installs, activates and takes control.
//   2. Core app assets (HTML shell, app + data bundles) are precached.
//   3. After going fully offline (context.setOffline), a reload is
//      served from the cache and the app boots without a network.
//   4. Vocabulary reading (word list + word card) works offline — the
//      data bundle is cached, so no words depend on the network.
//   5. Returning online recovers normal operation.
//
// No backend or mocks involved — this is the real service worker,
// real caches, real offline navigation.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// ── Helper: Skip onboarding + dismiss the plan picker ─────────
// Mirrors full-user-flow.spec.js: wait generously for the ~3s onboarding
// timer, click skip, VERIFY it is actually hidden before proceeding, then
// dismiss the auto-shown plan picker for free users.
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

test.describe('Offline Use — PWA', () => {
  test('app boots and vocabulary reading works fully offline via the service worker', async ({ page, context }) => {
    // ── Phase 1: load online so the SW installs + precaches ──
    await page.goto('/');
    await skipOnboarding(page);

    // The SW must be active AND controlling this page before we go offline —
    // only a controlled page's navigations are served from the cache.
    await page.waitForFunction(
      () => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
      null,
      { timeout: 20000 }
    );

    // ── Phase 2: verify the core assets are actually cached ──
    const cachedUrls = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((r) => r.url));
      }
      return urls;
    });
    const isCached = (frag) => cachedUrls.some((u) => u.includes(frag));
    expect(isCached('/index.html') || isCached('/')).toBeTruthy();
    expect(isCached('app.bundle')).toBeTruthy();
    expect(isCached('data.bundle')).toBeTruthy();

    // ── Phase 3: go offline and reload — must come from cache ──
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('.top-bar', { timeout: 15000 });
    await expect(page.locator('.bottom-nav')).toBeVisible();

    // The browser really is offline, and the page still booted.
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await skipOnboarding(page);

    // ── Phase 4: vocabulary reading works offline ──
    // Open the Foundation lesson word card (same path the online suite uses) —
    // its Arabic text + meaning come from the cached data bundle.
    await page.locator('#tab-paths').click();
    await page.waitForTimeout(500);
    await page.locator('#surah-select').selectOption('foundation');
    await page.waitForTimeout(500);
    await expect(page.locator('#word-card')).toBeVisible({ timeout: 10000 });
    const arabic = (await page.locator('#arabic-word').textContent()).trim();
    const meaning = (await page.locator('#meaning').textContent()).trim();
    expect(arabic.length).toBeGreaterThan(0);
    expect(meaning.length).toBeGreaterThan(0);

    // The word-list view also renders from the cached data bundle.
    await page.locator('#tab-list').click();
    await expect(page.locator('#wordlist-container')).toBeVisible({ timeout: 10000 });
    const itemCount = await page.locator('.wordlist-item').count();
    expect(itemCount).toBeGreaterThan(0);

    // ── Phase 5: back online — normal operation recovers ──
    await context.setOffline(false);
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('.top-bar', { timeout: 15000 });
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  });
});
