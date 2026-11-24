// ═══════════════════════════════════════════════════════════════
// salah.spec.js — The Salah track, end to end
//
//   1. Joining Salah asks for the madhab first, then shows the path.
//   2. Lesson 1.1 shows the figure; lesson 1.2 shows "اللَّهُ أَكْبَرُ",
//      every exercise can be answered, and the finish screen shows a %.
//   3. The lesson stays done after the madhab changes.
//   4. Offline, a reload still opens a lesson.
//   5. No page errors along the way.
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
    const step = await page.evaluate(() => (window._salahRun ? _salahRun.step : 'none'));
    if (step !== 'practice') return step;
    await page.evaluate(() => {
      const item = _salahRun.items[_salahRun.index];
      const ex = document.querySelector('#salah-exercise .ex');
      if (item.type === 'read-choose' || item.type === 'listen-choose') ex.querySelectorAll('.ex-option')[item.answer].click();
      else if (item.type === 'spot') item.answer.forEach(k => ex.querySelectorAll('.ex-token')[k].click());
      else {
        const chips = [...ex.querySelectorAll('.ex-pieces .ex-piece')];
        const used = [];
        item.answer.forEach(w => { const k = item.pieces.findIndex((p, j) => p === w && !used.includes(j)); used.push(k); chips[k].click(); });
      }
    });
    await page.locator('#salah-exercise .ex-check').click();
    await expect(page.locator('#salah-exercise .ex-feedback')).toHaveText('Correct');
    await page.locator('#salah-next .qaida-next').click();
  }
  return 'too many';
}

test.describe('Salah', () => {
  test('join, choose a madhab, finish a lesson, change the madhab', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await freshApp(page);

    // Joining asks for the madhab before the path
    await page.evaluate(() => switchView('tracks'));
    await page.locator('#view-tracks .track-card-join[data-track="salah"]').click();
    await expect(page.locator('#view-salah-lesson .salah-madhab')).toHaveCount(5);
    await page.locator('#view-salah-lesson .salah-madhab[data-madhab="hanafi"]').click();
    await expect(page.locator('#view-track')).toBeVisible();
    await expect(page.locator('#view-track .salah-path-madhab')).toContainText('Ḥanafī');

    // 1.1: the walkthrough shows the figure
    await page.locator('#view-track .track-lesson[data-ref="s1-1"]').click();
    await expect(page.locator('#view-salah-lesson #salah-fig svg.salah-fig')).toBeVisible();
    await page.locator('#view-salah-lesson [data-action="practice"]').click();
    await expect(page.locator('#view-salah-lesson .salah-walk-fig svg')).toBeVisible();
    expect(await answerLesson(page)).toBe('finish');
    await page.locator('#view-salah-lesson [data-action="back"]').first().click();
    await expect(page.locator('#view-track .track-lesson[data-ref="s1-1"]')).toHaveClass(/is-done/);

    // 1.2: the takbīr, answered and finished
    await page.locator('#view-track .track-lesson[data-ref="s1-2"]').click();
    const takbir = await page.evaluate(() => getSalahPhrase('takbir').ar);
    expect(takbir).toBe('اللَّهُ أَكْبَرُ');
    await expect(page.locator('#view-salah-lesson .salah-phrase-ar').first()).toContainText(takbir);
    await page.locator('#view-salah-lesson [data-action="practice"]').click();
    expect(await answerLesson(page)).toBe('finish');
    await expect(page.locator('#view-salah-lesson')).toContainText('%');
    await page.locator('#view-salah-lesson [data-action="back"]').first().click();
    await expect(page.locator('#view-track .track-lesson[data-ref="s1-2"]')).toHaveClass(/is-done/);

    // Changing the madhab keeps the lesson done
    await page.locator('#view-track .salah-path-change').click();
    await page.locator('#view-salah-lesson .salah-madhab[data-madhab="shafii"]').click();
    await expect(page.locator('#view-track .salah-path-madhab')).toContainText('Shāfiʿī');
    await expect(page.locator('#view-track .track-lesson[data-ref="s1-2"]')).toHaveClass(/is-done/);
    expect(errors).toEqual([]);
  });

  test('offline, a reload still opens a lesson', async ({ page, context }) => {
    await freshApp(page);
    await page.evaluate(() => { setSalahMadhab('maliki'); startSalahLesson('s1-4', 1); });
    await expect(page.locator('#view-salah-lesson .salah-phrase')).toBeVisible();
    await page.waitForFunction(() => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller, null, { timeout: 20000 });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => typeof startSalahLesson === 'function');
    await page.evaluate(() => startSalahLesson('s1-4', 1));
    await expect(page.locator('#view-salah-lesson .salah-phrase-ar').first()).toBeVisible();
    await context.setOffline(false);
  });
});
