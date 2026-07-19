// Minimal Playwright test — verify browser can launch and navigate
const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true, timeout: 15000 });
    console.log('Browser launched OK');

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    console.log('Page created');

    await page.goto('http://127.0.0.1:8080/', { timeout: 10000, waitUntil: 'domcontentloaded' });
    console.log('Navigation OK');

    const title = await page.title();
    console.log('Page title:', title);

    const hasDashboard = await page.locator('#view-dashboard').isVisible();
    console.log('Dashboard visible:', hasDashboard);

    await browser.close();
    console.log('Browser closed OK');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
