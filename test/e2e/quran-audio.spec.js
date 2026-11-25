// ═══════════════════════════════════════════════════════════════
// quran-audio.spec.js — Al-Husary in the reader, and word audio
//
//   1. "Listen" plays a surah verse by verse, with the basmala first
//      (not for Al-Fatihah), and the button returns to Listen at the end.
//   2. A verse's play button plays that verse alone.
//   3. A word's panel plays quran.com's recording of that word.
//   4. Read Arabic from zero: each letter card plays a word starting
//      with it.
//   5. Follow along: the word being recited lights up, never during the
//      basmala, and clears on Stop.
//   6. Speed and Repeat, and tapping a verse to play the surah from it.
// The recordings are replaced by a short silent sound, so nothing is
// fetched from everyayah.com or quran.com.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// The service worker would fetch the audio itself, out of reach of
// page.route; its audio caching is covered in test/audio.test.js.
test.use({ serviceWorkers: 'block' });

/** A silent WAV (8 kHz, 8-bit mono), 0.2 s unless asked for longer. */
function silentWav(seconds) {
  const samples = Math.round(8000 * (seconds || 0.2));
  const buf = Buffer.alloc(44 + samples, 128);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(8000, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples, 40);
  return buf;
}

async function stubAudio(page, seconds) {
  const played = [];
  const body = silentWav(seconds);
  const fulfil = (route) => {
    // Only what the audio element plays; fetches that cache the next
    // verse ahead (playAudioQueue) are not plays.
    if (route.request().resourceType() !== 'fetch') played.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'audio/wav', body, headers: { 'Access-Control-Allow-Origin': '*' } });
  };
  await page.route('https://everyayah.com/**', fulfil);
  await page.route('https://audio.qurancdn.com/**', fulfil);
  return played;
}

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

const verse = (s, v) => 'https://everyayah.com/data/Husary_64kbps/' +
  String(s).padStart(3, '0') + String(v).padStart(3, '0') + '.mp3';

test('Listen plays Al-Ikhlas after the basmala, verse by verse', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const played = await stubAudio(page);
  await openSurah(page, 112);
  await page.evaluate(() => document.getElementById('reader-listen').click());
  await expect(page.locator('#reader-listen')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#reader-listen')).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 });
  const recitation = played.filter((u) => u.includes('everyayah'));
  expect(recitation).toEqual([verse(1, 1), verse(112, 1), verse(112, 2), verse(112, 3), verse(112, 4)]);
  await expect(page.locator('#quran-verses .quran-ayah.is-reciting')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Al-Fatihah has no extra basmala; Stop ends the recitation', async ({ page }) => {
  const played = await stubAudio(page);
  await openSurah(page, 1);
  await page.evaluate(() => document.getElementById('reader-listen').click());
  await expect.poll(() => played.length).toBeGreaterThan(0);
  expect(played[0]).toBe(verse(1, 1));
  await page.evaluate(() => document.getElementById('reader-listen').click());
  await expect(page.locator('#reader-listen')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#reader-listen')).toHaveText('Listen');
});

test('a verse play button plays that verse alone', async ({ page }) => {
  const played = await stubAudio(page);
  await openSurah(page, 112);
  await expect(page.locator('#quran-ayah-112-2 .quran-ayah-play')).toHaveAttribute('aria-label', 'Play verse 2');
  await page.evaluate(() => document.querySelector('#quran-ayah-112-2 .quran-ayah-play').click());
  await expect.poll(() => played.length).toBe(1);
  expect(played[0]).toBe(verse(112, 2));
  await expect(page.locator('#reader-listen')).toHaveAttribute('aria-pressed', 'false');
});

test('a word panel plays quran.com\'s recording of the word', async ({ page }) => {
  const played = await stubAudio(page);
  await openSurah(page, 112);
  await page.evaluate(() => document.querySelector('#quran-ayah-112-1 .quran-ayah-arabic > span[data-pos="2"]').click());
  await page.waitForSelector('#word-panel-listen', { state: 'visible', timeout: 5000 });
  await page.evaluate(() => document.getElementById('word-panel-listen').click());
  await expect.poll(() => played.length).toBe(1);
  expect(played[0]).toBe('https://audio.qurancdn.com/wbw/112_001_002.mp3');
});

test('Qaida letter cards play a word starting with each letter', async ({ page }) => {
  await stubAudio(page);
  await openSurah(page, 1);
  await page.evaluate(() => startQaidaLesson('q0-1'));
  const cards = page.locator('.qaida-letter .qaida-letter-word .qaida-play');
  await expect(cards).toHaveCount(7);
  const src = await cards.first().getAttribute('data-src');
  expect(src).toMatch(/^https:\/\/audio\.qurancdn\.com\/wbw\/\d{3}_\d{3}_\d{3}\.mp3$/);
});

/**
 * Pin the playing sound's clock at a moment. The stub can't be seeked, so
 * this checks the wiring; timing against the real recording is checked by
 * hand (docs/superpowers/plans/2026-11-18-follow-along.md, Task 5).
 */
async function holdAt(page, seconds) {
  await page.waitForFunction(() => { const a = currentAudioElement(); return a && !a.paused; });
  await page.evaluate((t) => {
    Object.defineProperty(currentAudioElement(), 'currentTime', { get: () => t, configurable: true });
  }, seconds);
}

test('the word being recited lights up, and Stop clears it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubAudio(page, 5);
  await openSurah(page, 112);
  await page.evaluate(() => document.querySelector('#quran-ayah-112-1 .quran-ayah-play').click());
  await holdAt(page, 1.6); // 112:1 word 2 runs 1.38–2.10 s
  await expect(page.locator('#quran-verses .is-recited')).toHaveCount(1);
  await expect(page.locator('#quran-ayah-112-1 [data-n="2"]')).toHaveClass(/is-recited/);
  await holdAt(page, 3.9); // word 4 from 3.72 s
  await expect(page.locator('#quran-ayah-112-1 [data-n="4"]')).toHaveClass(/is-recited/);
  await expect(page.locator('#quran-verses .is-recited')).toHaveCount(1);
  await page.evaluate(() => document.querySelector('#quran-ayah-112-1 .quran-ayah-play').click());
  await expect(page.locator('#quran-verses .is-recited')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('nothing lights up during the basmala before a surah', async ({ page }) => {
  const played = await stubAudio(page, 5);
  await openSurah(page, 112);
  await page.evaluate(() => document.getElementById('reader-listen').click());
  await holdAt(page, 1.6);
  expect(played[played.length - 1]).toBe(verse(1, 1));
  await page.waitForTimeout(300);
  await expect(page.locator('#quran-verses .is-recited')).toHaveCount(0);
  await page.evaluate(() => document.getElementById('reader-listen').click());
});

// ── Player extras: Speed, Repeat, tap a verse ──

test('Speed sets how fast Al-Husary recites', async ({ page }) => {
  await stubAudio(page, 5);
  await openSurah(page, 112);
  await page.selectOption('#reader-rate', '1.5');
  await page.evaluate(() => document.querySelector('#quran-ayah-112-1 .quran-ayah-play').click());
  await page.waitForFunction(() => { const a = currentAudioElement(); return a && !a.paused; });
  expect(await page.evaluate(() => currentAudioElement().playbackRate)).toBe(1.5);
  await page.selectOption('#reader-rate', '0.75');
  expect(await page.evaluate(() => currentAudioElement().playbackRate)).toBe(0.75);
  await page.evaluate(() => document.querySelector('#quran-ayah-112-1 .quran-ayah-play').click());
});

test('Repeat 2 with a verse button plays that verse twice', async ({ page }) => {
  const played = await stubAudio(page);
  await openSurah(page, 112);
  await page.selectOption('#reader-repeat', '2');
  await page.evaluate(() => document.querySelector('#quran-ayah-112-2 .quran-ayah-play').click());
  await expect(page.locator('#quran-ayah-112-2')).toHaveClass(/is-reciting/);
  await expect(page.locator('#quran-ayah-112-2')).not.toHaveClass(/is-reciting/, { timeout: 15000 });
  expect(played.filter((u) => u.includes('everyayah'))).toEqual([verse(112, 2), verse(112, 2)]);
});

test('tapping a verse plays the surah on from it; tapping a word still opens its panel', async ({ page }) => {
  const played = await stubAudio(page, 5);
  await openSurah(page, 112);
  await page.locator('#quran-ayah-112-3 .quran-ayah-translation').click();
  await expect.poll(() => played.length).toBe(1);
  expect(played[0]).toBe(verse(112, 3));
  await expect(page.locator('#reader-listen')).toHaveAttribute('aria-pressed', 'true');
  // While it plays, a tap on another verse jumps there
  await page.locator('#quran-ayah-112-1 .quran-ayah-translation').click();
  await expect.poll(() => played[played.length - 1]).toBe(verse(1, 1));
  await page.evaluate(() => document.querySelector('#quran-ayah-112-2 .quran-ayah-arabic > span[data-pos="1"]').click());
  await page.waitForSelector('#word-panel-listen', { state: 'visible', timeout: 5000 });
  expect(played.length).toBe(2); // a word tap does not change the recitation
  await page.evaluate(() => document.getElementById('reader-listen').click());
});
