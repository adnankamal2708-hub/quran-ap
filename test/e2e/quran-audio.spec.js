// ═══════════════════════════════════════════════════════════════
// quran-audio.spec.js — Al-Husary in the reader, and word audio
//
//   1. "Listen" plays a surah verse by verse, with the basmala first
//      (not for Al-Fatihah), and the button returns to Listen at the end.
//   2. A verse's play button plays that verse alone.
//   3. A word's panel plays quran.com's recording of that word.
//   4. Read Arabic from zero: each letter card plays a word starting
//      with it.
// The recordings are replaced by a short silent sound, so nothing is
// fetched from everyayah.com or quran.com.
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// The service worker would fetch the audio itself, out of reach of
// page.route; its audio caching is covered in test/audio.test.js.
test.use({ serviceWorkers: 'block' });

/** A 0.2 s silent WAV (8 kHz, 8-bit mono). */
function silentWav() {
  const samples = 1600;
  const buf = Buffer.alloc(44 + samples, 128);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(8000, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples, 40);
  return buf;
}

async function stubAudio(page) {
  const played = [];
  const body = silentWav();
  const fulfil = (route) => {
    played.push(route.request().url());
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

const verse = (s, v) => 'https://everyayah.com/data/Husary_128kbps/' +
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
