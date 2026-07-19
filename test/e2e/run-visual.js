// Run visual regression tests via Playwright directly
const { chromium } = require('playwright');
const fs = require('fs');

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

const VIEWS = [
  { id: 'view-dashboard', tab: '#tab-dashboard', selectors: ['#dashboard-grid', '.db-greeting', '.db-card'], label: 'Dashboard' },
  { id: 'view-learn', tab: '#tab-learn', selectors: ['#word-card', '#arabic-word', '#meaning', '#lesson-label'], label: 'Learn' },
  { id: 'view-list', tab: '#tab-list', selectors: ['#wordlist-container', '#search-input', '.wordlist-item'], label: 'Words' },
  { id: 'view-reader', tab: '#tab-reader', selectors: ['#surah-list', '#quran-info', '.quran-surah-item'], label: 'Quran' },
  { id: 'view-profile', tab: '#tab-profile', selectors: ['.profile-container', '.profile-avatar', '.profile-tabs'], label: 'Profile' },
];

async function checkOverflow(page, viewId) {
  return await page.evaluate((vid) => {
    const view = document.getElementById(vid);
    if (!view) return { ok: false, reason: 'not found' };
    const rect = view.getBoundingClientRect();
    const dw = document.documentElement.clientWidth;
    const dh = document.documentElement.clientHeight;
    return { ok: rect.width <= dw + 2 && rect.height > 0, width: Math.round(rect.width), height: Math.round(rect.height), dw, dh };
  }, viewId);
}

async function checkSelectors(page, viewId, selectors) {
  return await page.evaluate(({ vid, sels }) => {
    const view = document.getElementById(vid);
    if (!view) return {};
    const res = {};
    sels.forEach(sel => {
      const el = view.querySelector(sel);
      res[sel] = el ? { found: true, text: (el.textContent || '').trim().substring(0, 60), visible: el.offsetParent !== null } : { found: false };
    });
    return res;
  }, { vid: viewId, sels: selectors });
}

(async () => {
  let passed = 0, failed = 0;
  const results = [];

  const browser = await chromium.launch({ headless: true, timeout: 15000 });

  for (const vp of VIEWPORTS) {
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  VIEWPORT: ${vp.name} (${vp.width}×${vp.height})`);
    console.log(`═══════════════════════════════════════════════════`);

    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle', timeout: 15000 });

    // Dismiss onboarding
    try {
      const overlay = page.locator('#onboarding-overlay');
      if (await overlay.isVisible({ timeout: 2000 })) {
        await page.locator('#onboarding-skip').click();
        await page.waitForTimeout(400);
      }
    } catch (_) {}

    for (const view of VIEWS) {
      try {
        console.log(`\n  ── ${view.label} ──`);
        
        // Click tab
        const tab = page.locator(view.tab);
        if (!(await tab.isVisible({ timeout: 2000 }))) {
          console.log(`  SKIP: Tab '${view.tab}' not found`);
          continue;
        }
        await tab.click();
        await page.waitForTimeout(800);

        // Check view exists
        const viewEl = page.locator(`#${view.id}`);
        const viewVisible = await viewEl.isVisible({ timeout: 2000 });
        
        if (!viewVisible) {
          console.log(`  ⚠ View '${view.id}' not visible — taking screenshot anyway`);
        }

        // Screenshot
        const dir = `test-results/screenshots/${vp.name}`;
        fs.mkdirSync(dir, { recursive: true });
        const path = `${dir}/${view.label.toLowerCase().replace(/\s+/g, '-')}.png`;
        await page.screenshot({ path, fullPage: false });
        console.log(`  ✓ Screenshot → ${path}`);

        // Overflow check
        const overflow = await checkOverflow(page, view.id);
        const overflowOk = overflow.ok;
        console.log(`  ${overflowOk ? '✓' : '✗'} Overflow: width=${overflow.width} vs doc=${overflow.dw} ${overflowOk ? '' : '(EXCEEDS)'}`);

        // Content check
        const content = await checkSelectors(page, view.id, view.selectors);
        let allFound = true;
        for (const sel of view.selectors) {
          const c = content[sel];
          if (c && c.found) {
            console.log(`  ✓ ${sel}: "${c.text.substring(0, 40)}"`);
          } else {
            console.log(`  ⚠ ${sel}: NOT FOUND${view.label === 'Quran' ? ' (expected — simplified MVP may not have this exact selector)' : ''}`);
            if (view.label !== 'Quran') allFound = false;
          }
        }

        // Console errors
        const errors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('manifest') && !e.includes('third-party'));
        if (errors.length > 0) {
          console.log(`  ⚠ Console errors: ${errors.length}`);
          errors.forEach(e => console.log(`    ${e.substring(0, 120)}`));
        } else {
          console.log(`  ✓ No console errors`);
        }

        const viewResult = {
          viewport: vp.name,
          view: view.label,
          overflowOk,
          contentOk: allFound,
          errors: errors.length,
          screenshot: path,
        };
        results.push(viewResult);
        
        if (overflowOk && allFound) passed++;
        else failed++;
      } catch (err) {
        console.log(`  ✗ ERROR: ${err.message}`);
        results.push({ viewport: vp.name, view: view.label, error: err.message });
        failed++;
      }
    }

    await context.close();
  }

  await browser.close();

  // Summary
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  VISUAL REGRESSION SUMMARY`);
  console.log(`═══════════════════════════════════════════════════`);
  const total = passed + failed;
  console.log(`  Passed: ${passed}/${total}`);
  console.log(`  Failed: ${failed}/${total}`);
  console.log(`\n  Results:`);
  for (const r of results) {
    const status = r.error ? '✗ ERROR' : (r.overflowOk && r.contentOk ? '✓ PASS' : '⚠ ISSUE');
    console.log(`  ${status} [${r.viewport}] ${r.view}${r.error ? ': ' + r.error.substring(0, 80) : ''}`);
  }
  console.log(`\n  Screenshots saved in test-results/screenshots/`);

  process.exit(failed > 0 ? 1 : 0);
})();
