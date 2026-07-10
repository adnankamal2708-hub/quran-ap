// Diagnostics script for Bayan app issues
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  const errors = [];
  page.on('pageerror', err => errors.push({ type: 'pageerror', msg: err.message, stack: err.stack }));
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push({ type: 'console-' + msg.type(), msg: msg.text() });
    }
  });
  
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  // Skip onboarding
  try {
    await page.waitForSelector('#onboarding-overlay', { timeout: 2000 });
    await page.click('#onboarding-skip');
    await page.waitForTimeout(500);
  } catch(e) {}
  
  console.log('=== ERRORS DURING STARTUP ===');
  errors.forEach(function(e) { console.log(JSON.stringify(e)); });
  errors.length = 0;
  
  // === ANALYTICS TESTS ===
  console.log('\n=== CLICKING ANALYTICS TAB ===');
  await page.click('#tab-analytics');
  await page.waitForTimeout(1000);
  
  var analContent = await page.evaluate(function() {
    var content = document.getElementById('analytics-content');
    if (!content) return "NO analytics-content element";
    return content.innerHTML.substring(0, 500);
  });
  console.log('ANALYTICS content:', analContent);
  
  // Click each tab
  var tabNames = ['overview', 'trends', 'insights', 'achievements'];
  for (var ti = 0; ti < tabNames.length; ti++) {
    var tabName = tabNames[ti];
    console.log('\n=== CLICKING ' + tabName.toUpperCase() + ' TAB ===');
    try {
      var tabSelector = '.analytics-tab[data-analytics-tab="' + tabName + '"]';
      var tab = await page.$(tabSelector);
      if (tab) {
        await tab.click();
        await page.waitForTimeout(1000);
        var content = await page.evaluate(function() {
          var c = document.getElementById('analytics-content');
          return c ? c.innerHTML.substring(0, 500) : "NO content";
        });
        console.log('Content:', content);
      } else {
        console.log('Tab not found:', tabSelector);
      }
    } catch(e) {
      console.log('Error:', e.message);
    }
  }
  
  console.log('\n=== ERRORS AFTER ANALYTICS ===');
  errors.forEach(function(e) { console.log(JSON.stringify(e)); });
  errors.length = 0;
  
  // === DASHBOARD TESTS ===
  console.log('\n=== DASHBOARD DIAGNOSTICS ===');
  await page.click('#tab-dashboard');
  await page.waitForTimeout(1000);
  
  var dashInfo = await page.evaluate(function() {
    var result = {};
    var ids = ['db-continue', 'db-foundation', 'db-surah', 'db-review', 'db-hero-streak', 'dashboard-grid'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      result[ids[i]] = el ? ('EXISTS, onclick=' + (typeof el.onclick === 'function' ? 'FUNCTION' : (el.onclick || 'null'))) : 'MISSING';
    }
    return result;
  });
  for (var k in dashInfo) console.log(k + ':', dashInfo[k]);
  
  // Click tests
  console.log('\n=== CLICKING DASHBOARD CARDS ===');
  
  async function clickAndCheckView(selector, label) {
    console.log('\n--- ' + label + ' ---');
    var el = await page.$(selector);
    if (!el) { console.log(selector + ' NOT FOUND'); return; }
    try {
      await el.click();
      await page.waitForTimeout(800);
      var activeView = await page.evaluate(function() {
        var views = document.querySelectorAll('.mode-view');
        for (var i = 0; i < views.length; i++) {
          if (views[i].classList.contains('active')) return views[i].id;
        }
        return 'none';
      });
      console.log('Active view after click:', activeView);
      // Return to dashboard
      await page.click('#tab-dashboard');
      await page.waitForTimeout(500);
    } catch(e) { console.log('Error:', e.message); }
  }
  
  await clickAndCheckView('#db-foundation', 'Foundation Course card');
  await clickAndCheckView('#db-surah', 'Learn by Surah card');
  await clickAndCheckView('#db-continue', 'Continue/Start Foundation button');
  
  // Check if Due Reviews card exists (conditional)
  var hasReviewCard = await page.$('#db-review');
  if (hasReviewCard) {
    await clickAndCheckView('#db-review', 'Due Reviews card');
  } else {
    console.log('\n--- Due Reviews card --- MISSING (no words due yet)');
  }
  
  console.log('\n=== FINAL ERROR LOG ===');
  errors.forEach(function(e) { console.log(JSON.stringify(e)); });
  
  console.log('\n=== DIAGNOSTICS COMPLETE ===');
  await browser.close();
})().catch(function(err) {
  console.error('FATAL:', err.message, err.stack);
  process.exit(1);
});
