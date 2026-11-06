// ═══════════════════════════════════════════════════════════════
// tajweed.spec.js — The Tajweed track screens, end to end
//
// The track stays hidden until all 28 letter recordings exist, so these
// tests open the screens directly:
//   1. Lesson tj0-2: the intro shows its letters with no Play buttons,
//      and answering every exercise reaches the finish screen.
//   2. Verse practice opens at 1:1 with Listen; Smooth moves to 1:2.
//   3. No page errors on either screen.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

async function freshApp(page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#onboarding-overlay', { timeout: 10000, state: 'visible' });
  await page.locator('#onboarding-skip').click();
  try {
    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 3000 });
    await page.locator('#plan-picker-skip').click();
    await page.waitForSelector('#plan-picker-overlay', { state: 'hidden', timeout: 3000 });
  } catch (e) { /* not shown */ }
}

/** Answer the current lesson's exercises correctly, reading the answers from the run. */
async function answerLesson(page) {
  for (let i = 0; i < 30; i++) {
    const step = await page.evaluate(() => (window._tajweedRun ? _tajweedRun.step : 'none'));
    if (step !== 'practice') return step;
    await page.evaluate(() => {
      const item = _tajweedRun.items[_tajweedRun.index];
      const ex = document.querySelector('#tajweed-exercise .ex');
      if (item.type === 'read-choose' || item.type === 'listen-choose') ex.querySelectorAll('.ex-option')[item.answer].click();
      else if (item.type === 'spot') item.answer.forEach(k => ex.querySelectorAll('.ex-token')[k].click());
      else {
        const chips = [...ex.querySelectorAll('.ex-pieces .ex-piece')];
        const used = [];
        item.answer.forEach(w => { const k = item.pieces.findIndex((p, j) => p === w && !used.includes(j)); used.push(k); chips[k].click(); });
      }
    });
    await page.locator('#tajweed-exercise .ex-check').click();
    await expect(page.locator('#tajweed-exercise .ex-feedback')).toHaveText('Correct');
    await page.locator('#tajweed-next .qaida-next').click();
  }
  return 'too many';
}

test.describe('Tajweed', () => {
  test('a lesson shows its letters without Play buttons and can be finished', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await freshApp(page);
    await page.evaluate(() => startTajweedLesson('tj0-2'));
    await expect(page.locator('#view-tajweed-lesson')).toBeVisible();
    await expect(page.locator('#view-tajweed-lesson .tajweed-card')).toHaveCount(6);
    await expect(page.locator('#view-tajweed-lesson [data-action="tj-play"]')).toHaveCount(0);

    await page.locator('#view-tajweed-lesson [data-action="practice"]').click();
    expect(await answerLesson(page)).toBe('finish');
    // hamza is not counted, so the six letters cover 5 of 28
    await expect(page.locator('#view-tajweed-lesson .qaida-finish')).toContainText('5 of 28 letters covered');
    expect(errors).toEqual([]);
  });

  test('verse practice opens at 1:1 and Smooth moves to 1:2', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await freshApp(page);
    await page.evaluate(() => startTajweedVersePractice());
    const card = page.locator('#tajweed-verse-card');
    await expect(card.locator('.tajweed-verse-ref')).toContainText('1:1');
    await expect(card.locator('.tajweed-verse-text')).toBeVisible({ timeout: 15000 });
    await expect(card.locator('[data-action="tj-play"]')).toContainText('Listen');

    await card.locator('[data-action="tj-ok"]').click();
    await page.locator('#tajweed-next [data-action="verse-next"]').click();
    await expect(page.locator('#tajweed-verse-card .tajweed-verse-ref')).toContainText('1:2');
    expect(errors).toEqual([]);
  });
});
