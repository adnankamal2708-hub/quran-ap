const { chromium } = require('playwright');

async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   BAYAN PWA OFFLINE MODE TEST              ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-features=ServiceWorkerRegistrationOnDemand']
  });

  // Use a fresh context with no prior cache
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'allow'
  });

  const page = await context.newPage();

  const errors = [];
  const warnings = [];
  const swEvents = [];

  page.on('pageerror', err => errors.push({ msg: err.message, stack: err.stack }));
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') errors.push({ type: 'console-error', msg: text });
    if (msg.type() === 'warning') warnings.push(text);
    if (text.includes('[SW]')) swEvents.push(text);
  });

  // Track failed network requests
  page.on('requestfailed', req => {
    errors.push({ type: 'network-failure', url: req.url(), reason: req.failure().errorText });
  });

  // Block all Firebase/Fonts requests during online test too
  // (they won't be available offline, so we test with cache only)
  // Actually, let them load first so SW caches them

  // ── PHASE 1: Load app online to populate cache ──
  console.log('📡 PHASE 1: Loading app ONLINE to populate service worker cache...\n');

  await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Skip onboarding
  try {
    await page.waitForSelector('#onboarding-skip', { timeout: 2000 });
    await page.click('#onboarding-skip');
    await page.waitForTimeout(500);
  } catch(e) {}

  // Wait for SW to be active
  await page.waitForTimeout(1000);

  // Check SW status
  const swInfo = await page.evaluate(async () => {
    const info = {};
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        info.active = reg.active ? reg.active.state : null;
        info.installing = reg.installing ? reg.installing.state : null;
        info.waiting = reg.waiting ? reg.waiting.state : null;
        info.scope = reg.scope;
      } else {
        info.error = 'No SW registration found';
      }
    } else {
      info.error = 'ServiceWorker not supported in this browser';
    }
    return info;
  });

  console.log('SW Registration:', JSON.stringify(swInfo, null, 2));

  // Verify SW events fired
  console.log('\nSW Events:', swEvents.length > 0 ? swEvents.join(', ') : 'none captured');

  // Navigate to a few views to cache their dynamic content
  console.log('\n🌐 Caching app views...');
  await page.evaluate(() => {
    if (typeof switchView === 'function') {
      switchView('learn');
      setTimeout(() => switchView('quiz'), 200);
      setTimeout(() => switchView('list'), 400);
      setTimeout(() => switchView('stats'), 600);
      setTimeout(() => switchView('analytics'), 800);
      setTimeout(() => switchView('dashboard'), 1000);
    }
  });
  await page.waitForTimeout(2000);

  // ── PHASE 2: Go offline and reload ──
  console.log('\n📴 PHASE 2: Going OFFLINE...\n');

  // Block ALL network requests to simulate offline mode
  await page.route('**/*', route => {
    // Allow data: URIs (inline images, SVGs)
    if (route.request().url().startsWith('data:')) {
      route.continue();
      return;
    }
    // Block everything else
    route.abort('internetdisconnected');
  });

  // Trigger the 'offline' event so the app's offline listeners fire
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
  });

  // Reload the page — should load from cache
  console.log('🔄 Reloading from service worker cache...\n');

  // Clear previous error tracking to only count offline errors
  errors.length = 0;

  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Skip onboarding
  try {
    await page.waitForSelector('#onboarding-skip', { timeout: 2000 });
    await page.click('#onboarding-skip');
    await page.waitForTimeout(500);
  } catch(e) {}

  // ── PHASE 3: Verify offline functionality ──
  console.log('✅ PHASE 3: Validating OFFLINE functionality...\n');

  const offlineResults = await page.evaluate(() => {
    const results = {};

    // 1. Check app shell rendered
    results.shell = {
      dashboardExists: !!document.getElementById('view-dashboard'),
      contentExists: !!document.getElementById('content'),
      bottomNavExists: !!document.querySelector('.bottom-nav'),
      topBarExists: !!document.querySelector('.top-bar'),
      dashboardGrid: document.getElementById('dashboard-grid') ? 
        document.getElementById('dashboard-grid').children.length > 0 : false
    };

    // 2. Check offline indicator
    const badge = document.getElementById('offline-badge');
    results.offlineBadge = {
      exists: !!badge,
      text: badge ? badge.textContent : null
    };

    // 3. Check navigator.onLine status (CDP should make it false)
    results.navigatorOnline = navigator.onLine;

    // 4. Check service worker is still active
    results.swActive = false;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      results.swActive = true;
      results.swState = navigator.serviceWorker.controller.state;
    }

    // 5. Check caches contain our assets
    if ('caches' in window) {
      results.caches = {};
      return caches.keys().then(cacheNames => {
        results.caches.cacheNames = cacheNames;
        return Promise.all(cacheNames.map(name => {
          return caches.open(name).then(cache => {
            return cache.keys().then(requests => {
              results.caches[name] = requests.length + ' entries';
              // Return the URLs for inspection
              return requests.map(r => r.url);
            });
          });
        })).then(allEntries => {
          results.cacheEntries = [];
          allEntries.forEach((entries, i) => {
            results.cacheEntries.push({ cache: cacheNames[i], entries });
          });
          return results;
        });
      });
    } else {
      results.caches = { error: 'Cache API not available' };
      return results;
    }
  });

  console.log('=== OFFLINE APP SHELL ===');
  Object.entries(offlineResults.shell || {}).forEach(([k, v]) => {
    console.log(`  ${v ? '✅' : '❌'} ${k}: ${v}`);
  });

  console.log('\n=== OFFLINE INDICATOR ===');
  console.log(`  Badge exists: ${offlineResults.offlineBadge?.exists}`);
  console.log(`  Badge text: ${offlineResults.offlineBadge?.text}`);
  console.log(`  navigator.onLine: ${offlineResults.navigatorOnline}`);

  console.log(`\n=== SERVICE WORKER ===`);
  console.log(`  Active: ${offlineResults.swActive}`);
  console.log(`  State: ${offlineResults.swState}`);

  // ── PHASE 4: Test navigation while offline ──
  console.log('\n🧭 PHASE 4: Testing navigation while offline...\n');

  const navResults = [];
  const viewsToTest = ['dashboard', 'learn', 'quiz', 'list', 'stats', 'analytics'];

  for (const view of viewsToTest) {
    try {
      const navOk = await page.evaluate((v) => {
        return new Promise(resolve => {
          // Catch any errors during navigation
          try {
            if (typeof switchView === 'function') {
              switchView(v);
              // Give it a moment to render
              setTimeout(() => {
                const viewEl = document.getElementById('view-' + v);
                const isActive = viewEl && viewEl.classList.contains('active');
                const hasContent = viewEl && viewEl.innerHTML.length > 20;
                resolve({ view: v, switched: true, isActive, hasContent, error: null });
              }, 300);
            } else {
              resolve({ view: v, switched: false, error: 'switchView not found' });
            }
          } catch(e) {
            resolve({ view: v, switched: false, error: e.message });
          }
        });
      }, view);
      navResults.push(navOk);
    } catch(e) {
      navResults.push({ view, switched: false, error: e.message });
    }
  }

  navResults.forEach(r => {
    if (r.error) {
      console.log(`  ❌ ${r.view}: ${r.error}`);
    } else if (r.switched && r.isActive) {
      console.log(`  ✅ ${r.view}: Active, has content: ${r.hasContent}`);
    } else if (r.switched && !r.isActive) {
      console.log(`  ⚠️ ${r.view}: Switch called but view not active`);
    } else {
      console.log(`  ❌ ${r.view}: Failed to switch`);
    }
  });

  // ── PHASE 5: Check for offline errors ──
  console.log('\n🔍 PHASE 5: Error analysis...\n');

  if (errors.length === 0) {
    console.log('  ✅ ZERO errors during offline session');
  } else {
    console.log(`  ⚠️ ${errors.length} errors captured:`);
    errors.forEach((e, i) => {
      console.log(`  #${i+1}: ${JSON.stringify(e)}`);
    });
  }

  if (warnings.length === 0) {
    console.log('  ✅ ZERO warnings during offline session');
  } else {
    console.log(`  ⚠️ ${warnings.length} warnings:`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  // ── PHASE 6: Check cache entries ──
  console.log('\n💾 PHASE 6: Cache contents...\n');

  if (offlineResults.caches && offlineResults.caches.cacheNames) {
    console.log(`  Cache names: ${offlineResults.caches.cacheNames.join(', ')}`);
    if (offlineResults.cacheEntries) {
      offlineResults.cacheEntries.forEach(ce => {
        console.log(`\n  📦 ${ce.cache}:`);
        ce.entries.forEach(url => {
          const shortUrl = url.replace('http://localhost:8080/', '');
          console.log(`    - ${shortUrl}`);
        });
      });
    }
  } else if (offlineResults.caches) {
    console.log(`  ${offlineResults.caches.error || 'No cache info'}`);
  }

  // ── SUMMARY ──
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   RESULTS SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const allNavOk = navResults.every(r => r.switched && r.isActive);
  const shellOk = offlineResults.shell && 
    offlineResults.shell.dashboardExists && 
    offlineResults.shell.bottomNavExists &&
    offlineResults.shell.dashboardGrid;

  console.log(`  ✅ App shell renders offline:   ${shellOk ? 'YES' : 'NO'}`);
  console.log(`  ✅ Navigation works offline:     ${allNavOk ? 'YES' : 'NO'}`);
  console.log(`  ✅ SW active:                    ${offlineResults.swActive ? 'YES' : 'NO'}`);
  console.log(`  ✅ Zero console errors:          ${errors.length === 0 ? 'YES' : 'NO (' + errors.length + ')'}`);
  console.log(`  ✅ Cached assets available:      ${offlineResults.caches && offlineResults.caches.cacheNames ? 'YES' : 'NO'}`);

  const overallPass = shellOk && allNavOk && offlineResults.swActive && errors.length === 0;
  console.log(`\n  ${overallPass ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'} `);

  await browser.close();
  return overallPass;
}

run().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
