// ═══════════════════════════════════════════════════════════════
// verify-stage-a.js — TEMPORARY verification script (not committed)
//
// Runs all six Stage A manual-verification steps against the REAL
// Firebase project in a real browser (headless Chromium via Playwright):
//
//   Step 6  Header "Sign in" link → login view WITHOUT the Google option
//   Step 1  Profile tab (signed out) → login view WITH the Google option
//   Step 5  Cancel = silent · account-exists = clear message ·
//           popup-blocked = clear message · signed-out Google flow completes
//   Step 3  Real email/password sign-in (real Firebase session)
//   Step 4  Premium baseline (false, no subscription doc) · profile doc
//           absent → Google branch creates profiles/{uid} for REAL via the
//           same saveProfile path · premium still independent of profile
//   Cleanup Delete the throwaway account (profile doc + auth user)
//
// The one thing that cannot be automated is Google's own OAuth popup
// (requires a real Google account; Google blocks automated sign-in) —
// that is stubbed at window.signInWithGoogle, everything downstream is real.
// ═══════════════════════════════════════════════════════════════

const { chromium } = require('playwright');

const API_KEY = 'AIzaSyActPDi21DFbyGl7KeecPC_CFuJuor9fxo';
const BASE = 'http://127.0.0.1:8080';

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, label, detail) {
  if (cond) { passed++; console.log('  \u2705 ' + label); }
  else { failed++; failures.push(label); console.log('  \u274c ' + label + (detail ? ' — ' + detail : '')); }
}

async function skipOnboarding(page) {
  try {
    await page.waitForSelector('#onboarding-overlay', { timeout: 8000, state: 'visible' });
    await page.locator('#onboarding-skip').click();
    await page.waitForSelector('#onboarding-overlay', { state: 'hidden', timeout: 3000 });
  } catch (e) {}
  try {
    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 5000 });
    const skip = page.locator('#plan-picker-skip');
    if (await skip.isVisible()) await skip.click();
  } catch (e) {}
}

async function viewDisplay(page, id) {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return el ? getComputedStyle(el).display : 'missing';
  }, id);
}

async function main() {
  // ── Create a throwaway email/password user in the REAL project ──
  const email = 'stage-a-verify-' + Date.now() + '@example.com';
  const password = 'TempPass123!';
  let uid = null;
  try {
    const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.localId) throw new Error(JSON.stringify(data));
    uid = data.localId;
    console.log('Created throwaway Firebase user: ' + email + ' (uid ' + uid + ')');
  } catch (e) {
    console.error('Could not create throwaway user via Firebase REST API: ' + e.message);
    process.exit(2);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('    [pageerror] ' + e.message));

  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await skipOnboarding(page);
    await page.waitForTimeout(1200); // let auth state settle

    // ── Step 6: header sign-in link must NOT expose Google (Stage A gate) ──
    console.log('\n[Step 6] Header sign-in link (signed out)');
    await page.locator('#header-signin-link').click();
    await page.locator('#auth-login').waitFor({ state: 'visible', timeout: 8000 });
    ok((await viewDisplay(page, 'auth-google-login')) === 'none', 'Google option hidden via header link (gate)');

    // ── Step 1: Profile tab → login view WITH Google option ──
    console.log('\n[Step 1] Profile tab entry point (signed out)');
    await page.locator('#tab-profile').click();
    await page.locator('#auth-login').waitFor({ state: 'visible', timeout: 8000 });
    ok((await viewDisplay(page, 'auth-google-login')) === 'block', 'Google option visible via Profile tab');

    // ── Step 5: graceful error handling in the real DOM ──
    console.log('\n[Step 5] Graceful error handling');
    // 5a. User closes the popup → completely silent
    await page.evaluate(() => {
      window.signInWithGoogle = () => Promise.reject(Object.assign(new Error('Sign-in cancelled.'), { silent: true }));
    });
    await page.locator('#auth-google-login-btn').click();
    await page.waitForTimeout(400);
    ok(!(await page.locator('#auth-login-error').isVisible()), 'closing the popup is silent (no error shown)');

    // 5b. account-exists-with-different-credential → clear non-technical message
    await page.evaluate(() => {
      window.signInWithGoogle = () => Promise.reject(new Error('An account already exists with this email. Please sign in with your email and password instead.'));
    });
    await page.locator('#auth-google-login-btn').click();
    await page.locator('#auth-login-error').waitFor({ state: 'visible', timeout: 5000 });
    const existsMsg = (await page.locator('#auth-login-error').textContent()).trim();
    ok(existsMsg.indexOf('email and password') >= 0, 'account-exists shows the "use email + password" message', existsMsg);

    // 5c. popup blocked → helpful message
    await page.evaluate(() => {
      window.signInWithGoogle = () => Promise.reject(new Error('Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.'));
    });
    await page.locator('#auth-google-login-btn').click();
    await page.waitForTimeout(400);
    const blockedMsg = (await page.locator('#auth-login-error').textContent()).trim();
    ok(blockedMsg.indexOf('allow popups') >= 0, 'popup-blocked shows allow-popups message', blockedMsg);

    // 5d. Successful (stubbed) Google sign-in while signed out → completes, lands on Learn
    await page.evaluate(() => {
      window.signInWithGoogle = () => Promise.resolve({
        user: { uid: 'stub-google-uid-1', email: 'stub.google.user@example.com', displayName: 'Stub Google', emailVerified: true },
      });
    });
    await page.locator('#auth-google-login-btn').click();
    await page.locator('#view-learn').waitFor({ state: 'visible', timeout: 8000 });
    ok(true, 'Google sign-in (stubbed popup) completes → Learn view (signed out)');

    // ── Step 3: REAL email/password sign-in (real Firebase session) ──
    console.log('\n[Step 3] Real email/password sign-in');
    const loginResult = await page.evaluate(async (args) => {
      const r = await window.__auth.login(args.email, args.password, true);
      return { uid: r.user.uid, email: r.user.email };
    }, { email, password });
    ok(loginResult.uid === uid && loginResult.email === email, 'real Firebase session established', JSON.stringify(loginResult));
    await page.evaluate(() => window.switchView('learn'));
    await page.waitForTimeout(600);

    // ── Step 4: premium resolution + profile-doc shape ──
    console.log('\n[Step 4] Premium + profile-doc equivalence (the critical check)');
    const baseline = await page.evaluate(async (userId) => {
      const u = window.getCurrentUser();
      const prem = window.__premium.isPremium();
      const prof = await window.loadProfile(userId);
      return { currentUid: u ? u.uid : null, premium: prem, profile: prof };
    }, uid);
    ok(baseline.currentUid === uid, 'auth state matches the account');
    ok(baseline.premium === false, 'premium = false (no subscriptions/' + uid + ' doc — same as any new user)');
    ok(baseline.profile === null, 'profile doc absent for email/password login (baseline)');

    // Google branch profile creation through the REAL handler + REAL Firestore write.
    // Drive the exact same code path handleGoogleSignIn uses, with the REAL signed-in
    // uid so saveProfile writes to real Firestore under real rules.
    await page.evaluate(() => {
      window.showAuthView('login', { google: true });
      window.switchView('auth');
      window.signInWithGoogle = () => Promise.resolve({
        user: { uid: window.getCurrentUser().uid, email: window.getCurrentUser().email, displayName: 'Google Verify', photoURL: 'http://example.com/g.png', emailVerified: true },
      });
    });
    await page.locator('#auth-google-login-btn').click();
    await page.locator('#view-learn').waitFor({ state: 'visible', timeout: 8000 });

    const afterGoogle = await page.evaluate(async (userId) => {
      const prof = await window.loadProfile(userId);
      const prem = window.__premium.isPremium();
      const refreshed = await window.__premium.refresh();
      return { profile: prof, premium: prem, refreshed: refreshed };
    }, uid);
    ok(!!afterGoogle.profile, 'profiles/{uid} doc created by the Google branch (REAL Firestore write)');
    ok(afterGoogle.profile && afterGoogle.profile.displayName === 'Google Verify', 'profile has Google displayName');
    ok(afterGoogle.profile && afterGoogle.profile.email === email, 'profile has the account email');
    ok(afterGoogle.profile && afterGoogle.profile.settings && afterGoogle.profile.settings.dailyReviewLimit === 25, 'profile has default settings');
    ok(afterGoogle.profile && afterGoogle.profile.avatarUrl === 'http://example.com/g.png', 'profile has avatarUrl');
    ok(afterGoogle.premium === false, 'premium STILL false after profile creation — profile doc does not affect subscriptions/{uid} resolution');
    ok(afterGoogle.refreshed === false, 'premium.refresh() reads subscriptions/{uid} live → false (no doc)');

    // ── Cleanup: delete the throwaway account (profile doc + auth user) ──
    console.log('\n[Cleanup]');
    const cleaned = await page.evaluate(async (userId) => {
      await window.deleteProfile(userId);
      const profAfter = await window.loadProfile(userId);
      await window.__auth.deleteAccount();
      await new Promise((r) => setTimeout(r, 500));
      return { profileGone: profAfter === null, signedOut: window.getCurrentUser() === null };
    }, uid);
    ok(cleaned.profileGone, 'profiles/' + uid + ' deleted');
    ok(cleaned.signedOut, 'auth user deleted — session cleared');
    console.log('  Removed account: ' + email);
  } catch (e) {
    failed++;
    failures.push('script error: ' + e.message);
    console.error('  \u274c Script error: ' + e.message);
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(56));
  console.log('Stage A verification: ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) { console.log('Failed: ' + failures.join(' | ')); process.exitCode = 1; }
  else console.log('All automatable steps verified against the real Firebase project.');
}

main();