const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const consoleLogs = [];
  const errors = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push({ type: 'console-' + msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', err => errors.push({ type: 'pageerror', msg: err.message, stack: err.stack }));
  page.on('response', resp => {
    if (resp.status() >= 400) {
      errors.push({ type: 'network', url: resp.url(), status: resp.status() });
    }
  });

  console.log('=== 1. LOAD APP ===');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Skip onboarding
  try {
    await page.waitForSelector('#onboarding-skip', { timeout: 2000 });
    await page.click('#onboarding-skip');
    await page.waitForTimeout(500);
    console.log('Onboarding skipped');
  } catch (e) {
    console.log('No onboarding');
  }

  // Helper: switch view by evaluating JS directly in the app
  async function switchView(viewName) {
    await page.evaluate((v) => {
      if (typeof switchView === 'function') switchView(v);
    }, viewName);
    await page.waitForTimeout(800);
    console.log('Switched to: ' + viewName);
  }

  // Simulate a full user session
  console.log('\n=== 2. DASHBOARD ===');
  // Click dashboard cards via JS
  var visibleCards = await page.evaluate(() => {
    var cards = ['db-continue', 'db-foundation', 'db-surah', 'db-review'];
    var found = [];
    cards.forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.offsetParent !== null) {
        found.push(id);
        if (typeof el.onclick === 'function') el.onclick();
      }
    });
    return found;
  });
  console.log('Clicked dashboard cards:', visibleCards);

  // Navigate through views
  await switchView('learn');
  await switchView('quiz');
  await switchView('list');
  await switchView('stats');
  await switchView('analytics');

  await page.waitForTimeout(1000);

  // Click each analytics tab
  var analyticsTabs = await page.evaluate(() => {
    var tabs = document.querySelectorAll('[data-analytics-tab]');
    var clicked = [];
    tabs.forEach(function(tab) {
      var name = tab.getAttribute('data-analytics-tab');
      if (typeof tab.onclick === 'function') {
        tab.onclick();
        clicked.push(name);
      }
    });
    return clicked;
  });
  console.log('Clicked analytics tabs:', analyticsTabs);

  await page.waitForTimeout(1000);

  // Go back to dashboard
  await switchView('dashboard');
  await page.waitForTimeout(500);

  // Now check diagnostics
  console.log('\n=== 3. DIAGNOSTICS RESULTS ===');

  var diagResult = await page.evaluate(() => {
    var result = {};

    if (typeof window.__diag === 'undefined') {
      result.error = '__diag is not defined';
      return result;
    }

    // Error stats
    if (typeof window.__diag.getErrorStats === 'function') {
      try {
        result.stats = window.__diag.getErrorStats();
      } catch (e) {
        result.statsError = e.message;
      }
    } else {
      result.statsError = 'getErrorStats not a function';
    }

    // Error log
    if (typeof window.__diag.getErrorLog === 'function') {
      try {
        result.log = window.__diag.getErrorLog();
        result.logCount = Array.isArray(result.log) ? result.log.length : 'not array';
      } catch (e) {
        result.logError = e.message;
      }
    } else {
      result.logError = 'getErrorLog not a function';
    }

    // Also get the internal _errorLog directly
    if (window.__diag._errorLog) {
      result.internalLogCount = window.__diag._errorLog.length;
    }

    // Check validation
    if (typeof window.__validation !== 'undefined') {
      if (typeof window.__validation.runFullValidation === 'function') {
        try {
          result.validation = window.__validation.runFullValidation();
        } catch(e) {
          result.validationError = e.message;
        }
      }
    }

    return result;
  });

  console.log(JSON.stringify(diagResult, null, 2));

  // Print any errors caught during the session
  console.log('\n=== 4. SESSION ERRORS (' + errors.length + ') ===');
  if (errors.length > 0) {
    errors.forEach(function(e, i) {
      console.log('Error #' + (i + 1) + ': ' + JSON.stringify(e));
    });
  } else {
    console.log('No errors captured during session');
  }

  await browser.close();
})();
