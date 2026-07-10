// Full interaction audit — verify every interactive element
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  var errors = [];
  page.on('pageerror', function(e) { errors.push(e.message); });
  page.on('console', function(msg) {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Skip onboarding
  try {
    await page.evaluate(function() {
      var skip = document.getElementById('onboarding-skip');
      if (skip) skip.click();
    });
    await page.waitForTimeout(500);
  } catch(e) {}
  
  console.log('Page errors during load:', errors.length ? JSON.stringify(errors) : 'NONE');
  errors.length = 0;
  
  // Test all interactive elements
  var results = await page.evaluate(function() {
    var r = [];
    
    function check(selector, label, action) {
      var el = document.querySelector(selector);
      if (!el) { r.push('MISSING: ' + label + ' (' + selector + ')'); return; }
      
      var style = window.getComputedStyle(el);
      var isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      var hasPointerEvents = style.pointerEvents !== 'none';
      var hasOnClick = typeof el.onclick === 'function';
      var hasClickListener = false;
      var clone = el.cloneNode(true);
      // Check for addEventListener
      var boundListeners = el.onclick || el.getAttribute('onclick');
      
      r.push({
        selector: selector,
        label: label,
        exists: true,
        visible: isVisible,
        pointerEvents: hasPointerEvents,
        hasOnClick: hasOnClick,
        zIndex: style.zIndex,
        position: style.position,
      });
    }
    
    // ── Bottom Navigation ──
    r.push('--- BOTTOM NAV ---');
    check('#tab-dashboard', 'Dashboard tab', 'switchView');
    check('#tab-learn', 'Learn tab', 'switchView');
    check('#tab-quiz', 'Quiz tab', 'switchView');
    check('#tab-list', 'List tab', 'switchView');
    check('#tab-stats', 'Stats tab', 'switchView');
    check('#tab-analytics', 'Analytics tab', 'switchView');
    
    // ── Dashboard Cards ──
    r.push('--- DASHBOARD CARDS ---');
    check('#db-continue', 'Start/Continue Foundation', 'goToFoundationLesson');
    check('#db-foundation', 'Foundation Course card', 'goToFoundationLesson');
    check('#db-surah', 'Learn by Surah card', 'switchView');
    check('#db-review', 'Due Reviews card', 'startReview');
    check('#db-hero-streak', 'Hero streak', 'switchView');
    check('#db-hero-mastered', 'Hero mastered', 'switchView');
    check('#db-hero-coverage', 'Hero coverage', 'switchView');
    check('#db-hero-reviews', 'Hero reviews', 'startReview');
    
    // ── Learn View ──
    r.push('--- LEARN VIEW ---');
    check('#btn-prev', 'Prev word', 'prevWord');
    check('#btn-next', 'Next word', 'nextWord');
    check('#qa-show-ayah', 'Show ayah', 'showAyah');
    check('#qa-show-more', 'Show more', 'showWordContent');
    check('#qa-root-family', 'Root family', 'highlightRootBox');
    check('#qa-bookmark', 'Bookmark', 'toggleBookmark');
    check('#qa-quick-mode', 'Quick mode', 'toggleQuickMode');
    check('#srs-again', 'SRS Again', 'rateSRS');
    check('#srs-hard', 'SRS Hard', 'rateSRS');
    check('#srs-good', 'SRS Good', 'rateSRS');
    check('#srs-easy', 'SRS Easy', 'rateSRS');
    check('#review-start-btn', 'Review start', 'startReview');
    check('#continue-learning-btn', 'Continue learning', 'continueLearning');
    check('#prev-lesson-btn', 'Prev lesson', 'goToLesson');
    check('#next-lesson-btn', 'Next lesson', 'goToLesson');
    
    // ── Quiz View ──
    r.push('--- QUIZ VIEW ---');
    check('#btn-next-quiz', 'Next quiz', 'nextQuiz');
    
    // ── Profile/Auth ──
    r.push('--- PROFILE ---');
    check('#user-btn', 'User button', 'showProfile');
    
    return r;
  });
  
  console.log('Interaction audit:', JSON.stringify(results, null, 2));
  
  // Now test actual navigation by clicking
  console.log('\n=== TESTING NAVIGATION ===');
  
  var navTests = [
    { tab: '#tab-learn', expect: 'view-learn' },
    { tab: '#tab-quiz', expect: 'view-quiz' },
    { tab: '#tab-list', expect: 'view-list' },
    { tab: '#tab-stats', expect: 'view-stats' },
    { tab: '#tab-analytics', expect: 'view-analytics' },
    { tab: '#tab-dashboard', expect: 'view-dashboard' },
  ];
  
  for (var i = 0; i < navTests.length; i++) {
    var test = navTests[i];
    try {
      await page.click(test.tab);
      await page.waitForTimeout(500);
      var activeView = await page.evaluate(function() {
        var views = document.querySelectorAll('.mode-view');
        for (var vi = 0; vi < views.length; vi++) {
          if (views[vi].classList.contains('active')) return views[vi].id;
        }
        return 'none';
      });
      console.log('Click ' + test.tab + ' → active: ' + activeView + ' (expected: ' + test.expect + ') ' + (activeView === test.expect ? '✓' : '✗'));
    } catch(e) {
      console.log('Click ' + test.tab + ' → ERROR: ' + e.message);
    }
  }
  
  // Log errors
  console.log('\nErrors:', errors.length ? JSON.stringify(errors) : 'NONE');
  
  console.log('\n=== AUDIT COMPLETE ===');
  await browser.close();
})().catch(function(err) {
  console.error('FATAL:', err.message);
  process.exit(1);
});
