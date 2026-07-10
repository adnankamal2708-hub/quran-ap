// Diagnostics v2 — uses page.evaluate extensively
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  // Collect console output
  var allOutput = [];
  page.on('console', msg => {
    allOutput.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    allOutput.push({ type: 'pageerror', text: err.message, stack: err.stack });
  });
  
  // Load page
  console.log('Loading page...');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // Check if bundles loaded
  var loaded = await page.evaluate(function() {
    return {
      hasAppBundle: typeof renderDashboard === 'function',
      hasAnalyticsBundle: typeof renderAnalytics === 'function' && typeof renderAnalyticsAchievements === 'function',
      hasOldUI: typeof loadStreakData === 'function' && typeof renderWordList === 'function',
      functions: {
        renderDashboard_dashboard: typeof renderDashboard === 'function' ? renderDashboard.toString().substring(0, 50) : 'undefined',
        renderAnalytics: typeof renderAnalytics === 'function' ? 'defined' : 'undefined',
        renderAnalyticsAchievements: typeof renderAnalyticsAchievements === 'function' ? 'defined' : 'undefined',
        goToFoundationLesson: typeof goToFoundationLesson === 'function' ? 'defined' : 'undefined',
        startReview: typeof startReview === 'function' ? 'defined' : 'undefined',
        switchView: typeof switchView === 'function' ? 'defined' : 'undefined',
      },
      window: {
        srs: !!window.__srs,
        analytics: !!window.__analytics,
      }
    };
  });
  
  console.log('Bundle check:', JSON.stringify(loaded, null, 2));
  
  // Check for page errors and warnings about missing JS resources
  console.log('\nCONSOLE ERRORS/WARNINGS during load:');
  allOutput.forEach(function(entry) {
    if (entry.type === 'error' || entry.type === 'warning' || entry.type === 'pageerror') {
      console.log(JSON.stringify(entry));
    }
  });
  
  // Skip onboarding
  try {
    await page.evaluate(function() {
      var skipBtn = document.getElementById('onboarding-skip');
      if (skipBtn) skipBtn.click();
    });
    await page.waitForTimeout(500);
  } catch(e) {}
  
  // Now check the dashboard after it's rendered
  var dashDetails = await page.evaluate(function() {
    var result = {};
    
    // Check if renderDashboard ran by looking for generated elements
    result.elements = {};
    var ids = ['db-continue', 'db-foundation', 'db-surah', 'db-review', 'db-hero-streak'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        result.elements[id] = {
          exists: true,
          onclick_type: typeof el.onclick,
          onclick_is_func: typeof el.onclick === 'function',
        };
      } else {
        result.elements[id] = { exists: false };
      }
    });
    
    // Check the dashboard-grid content
    var grid = document.getElementById('dashboard-grid');
    result.gridContent = grid ? grid.innerHTML.substring(0, 200) : 'NO GRID';
    
    return result;
  });
  
  console.log('\nDashboard details:', JSON.stringify(dashDetails, null, 2));
  
  // Try clicking via evaluate
  console.log('\nTrying evaluate-based clicks...');
  var clickResult = await page.evaluate(function() {
    var result = [];
    
    var contBtn = document.getElementById('db-continue');
    if (contBtn) {
      result.push('contBtn onclick is ' + (typeof contBtn.onclick));
      if (typeof contBtn.onclick === 'function') {
        try { contBtn.onclick(); result.push('contBtn onclick executed OK'); }
        catch(e) { result.push('contBtn onclick ERROR: ' + e.message); }
      }
    }
    
    var surahCard = document.getElementById('db-surah');
    if (surahCard) {
      result.push('surahCard onclick is ' + (typeof surahCard.onclick));
      if (typeof surahCard.onclick === 'function') {
        try { surahCard.onclick(); result.push('surahCard onclick executed OK'); }
        catch(e) { result.push('surahCard onclick ERROR: ' + e.message); }
      }
    }
    
    var foundCard = document.getElementById('db-foundation');
    if (foundCard) {
      result.push('foundCard onclick is ' + (typeof foundCard.onclick));
      if (typeof foundCard.onclick === 'function') {
        try { foundCard.onclick(); result.push('foundCard onclick executed OK'); }
        catch(e) { result.push('foundCard onclick ERROR: ' + e.message); }
      }
    }
    
    return result;
  });
  
  console.log('\nClick results:', JSON.stringify(clickResult, null, 2));
  
  // Now test analytics tabs via evaluate
  console.log('\nTesting analytics tabs via evaluate...');
  var analResult = await page.evaluate(function() {
    var result = [];
    
    // Go to analytics
    var analTab = document.getElementById('tab-analytics');
    if (analTab) {
      analTab.click();
      result.push('Clicked analytics tab');
    }
    
    // Wait briefly (simulated)
    var content = document.getElementById('analytics-content');
    result.push('Content exists: ' + !!content);
    if (content) result.push('Content: ' + content.innerHTML.substring(0, 100));
    
    // Try insights tab
    var insightsTab = document.querySelector('.analytics-tab[data-analytics-tab="insights"]');
    if (insightsTab) {
      insightsTab.click();
      result.push('Clicked insights tab');
    }
    
    content = document.getElementById('analytics-content');
    if (content) result.push('Insights content: ' + content.innerHTML.substring(0, 100));
    
    // Try achievements tab
    var achTab = document.querySelector('.analytics-tab[data-analytics-tab="achievements"]');
    if (achTab) {
      achTab.click();
      result.push('Clicked achievements tab');
    }
    
    content = document.getElementById('analytics-content');
    if (content) result.push('Achievements content: ' + content.innerHTML.substring(0, 100));
    
    return result;
  });
  
  console.log('\nAnalytics results:', JSON.stringify(analResult, null, 2));
  
  // Check for any new console errors
  console.log('\nNew console errors after interactions:');
  allOutput.slice(allOutput.length - 30).forEach(function(entry) {
    if (entry.type === 'error' || entry.type === 'pageerror') {
      console.log(JSON.stringify(entry));
    }
  });
  
  console.log('\n=== DIAGNOSTICS COMPLETE ===');
  await browser.close();
})().catch(function(err) {
  console.error('FATAL:', err.message);
  process.exit(1);
});
