// ═══════════════════════════════════════════════════════════════
// qaida.spec.js — Read Arabic from zero (Qaida track), end to end
//
//   1. Onboarding: "I'm completely new" makes Qaida the main track and
//      opens its first lesson.
//   2. A lesson: intro, every exercise answered, the finish screen, and
//      the next lesson unlocked on the Learn path.
//   3. Home: Up next is the next Qaida lesson, with a Qaida progress row.
//   4. The Qaida placement test runs from Practice → Tests.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

async function freshApp(page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#onboarding-overlay', { timeout: 10000, state: 'visible' });
}

async function dismissPlanPicker(page) {
  try {
    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 3000 });
    await page.locator('#plan-picker-skip').click();
    await page.waitForSelector('#plan-picker-overlay', { state: 'hidden', timeout: 3000 });
  } catch (e) { /* not shown */ }
}

/** Answer the current lesson's exercises correctly, reading the answers from the run. */
async function answerLesson(page) {
  for (let i = 0; i < 30; i++) {
    const step = await page.evaluate(() => (window._qaidaRun ? _qaidaRun.step : 'none'));
    if (step !== 'practice') return step;
    await page.evaluate(() => {
      const item = _qaidaRun.items[_qaidaRun.index];
      const ex = document.querySelector('#qaida-exercise .ex');
      if (item.type === 'read-choose' || item.type === 'listen-choose') ex.querySelectorAll('.ex-option')[item.answer].click();
      else if (item.type === 'spot') item.answer.forEach(k => ex.querySelectorAll('.ex-token')[k].click());
      else {
        const chips = [...ex.querySelectorAll('.ex-pieces .ex-piece')];
        const used = [];
        item.answer.forEach(w => { const k = item.pieces.findIndex((p, j) => p === w && !used.includes(j)); used.push(k); chips[k].click(); });
      }
    });
    await page.locator('#qaida-exercise .ex-check').click();
    await expect(page.locator('#qaida-exercise .ex-feedback')).toHaveText('Correct');
    await page.locator('.qaida-next').click();
  }
  return 'too many';
}

test.describe('Read Arabic from zero', () => {
  test('"completely new" starts Qaida, and a lesson can be finished', async ({ page }) => {
    await freshApp(page);
    const next = page.locator('#onboarding-next');
    const slide = page.locator('#onboarding-slide');
    await next.click();
    await slide.locator('.onboarding-choice').first().click();
    await next.click();
    await expect(slide).toContainText('What do you want to learn?');
    await slide.locator('.onboarding-choice[data-value="new"]').click();
    await expect(slide.locator('.onboarding-choice[data-value="qaida"]')).toHaveAttribute('aria-checked', 'true');
    await next.click();
    await dismissPlanPicker(page);

    // The first Qaida lesson opens at its intro
    await expect(page.locator('#view-qaida-lesson')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#qaida-title')).toHaveText('Letters alif to khā');
    expect(await page.evaluate(() => getMainTrackId())).toBe('qaida');

    await page.locator('#view-qaida-lesson [data-action="practice"]').click();
    expect(await answerLesson(page)).toBe('finish');
    await expect(page.locator('.qaida-finish')).toContainText('Lesson complete');

    // Back on the path, lesson 2 is open
    await page.locator('.qaida-finish [data-action="back"]').click();
    await expect(page.locator('#view-track')).toBeVisible();
    await expect(page.locator('#view-track .track-lesson[data-ref="q0-1"]')).toHaveClass(/is-done/);
    await expect(page.locator('#view-track .track-lesson[data-ref="q0-2"]')).not.toHaveClass(/is-locked/);

    // Home: Up next is the next Qaida lesson, with a Qaida row
    await page.locator('#tab-home').click();
    await expect(page.locator('#db-track-next')).toContainText('Read Arabic from zero');
    await expect(page.locator('#db-track-next')).toContainText('Letters dāl to ṣād');
    await expect(page.locator('#db-track-row-qaida')).toBeVisible();
  });

  test('the Qaida placement test runs from Practice', async ({ page }) => {
    await freshApp(page);
    await page.locator('#onboarding-skip').click();
    await dismissPlanPicker(page);
    await page.locator('#tab-practice').click();
    await page.locator('#rc-test-qaida').click();
    await expect(page.locator('#view-test')).toBeVisible();
    await expect(page.locator('#placement-exercise .ex')).toBeVisible();
    await page.locator('.placement-quit').click();
    await expect(page.locator('#view-review-center')).toBeVisible();
  });
});
