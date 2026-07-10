const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Log any browser errors
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
  });

  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Skip onboarding
  try {
    await page.waitForSelector('#onboarding-skip', { timeout: 2000 });
    await page.click('#onboarding-skip');
    await page.waitForTimeout(500);
  } catch (e) {}

  console.log('=== window.__validation.runFullValidation() ===\n');

  const result = await page.evaluate(() => {
    if (typeof window.__validation === 'undefined') return { error: '__validation is not defined' };
    if (typeof window.__validation.runFullValidation !== 'function') return { error: 'runFullValidation is not a function' };
    try {
      return window.__validation.runFullValidation();
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });

  // Pretty-print the full result
  console.log(JSON.stringify(result, null, 2));

  // Summary line
  if (result && result.passed !== undefined) {
    console.log('\n=== OVERALL: ' + (result.passed ? '✅ PASSED' : '❌ FAILED') + ' ===');
  }

  await browser.close();
})();
