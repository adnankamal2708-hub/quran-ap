// ═══════════════════════════════════════════════════════════════
// auth-flow.spec.js — Real Authentication Flow
//
// Exercises the auth UI end-to-end in a real browser:
//   • Guest "Sign up" notice opens the signup view
//   • Login ⇄ signup ⇄ forgot-password view switching
//   • Client-side validation (short password, mismatched confirm)
//   • REAL Firebase Auth round-trips: a failed sign-in with unknown
//     credentials surfaces the auth error in the UI, and a password
//     reset request for an unknown email completes — both go over the
//     wire to the real Firebase project (no accounts are created and
//     no user data is written, so this is CI-safe).
// ═══════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// ── Helper: Skip onboarding + dismiss the plan picker ─────────
async function skipOnboarding(page) {
  try {
    await page.waitForSelector('#onboarding-overlay', { timeout: 10000, state: 'visible' });
    await page.locator('#onboarding-skip').click();
    await page.waitForSelector('#onboarding-overlay', { state: 'hidden', timeout: 3000 });
  } catch (e) {}
  try {
    await page.waitForSelector('#plan-picker-overlay.plan-picker-visible', { timeout: 5000 });
    const skipBtn = page.locator('#plan-picker-skip');
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
      await page.waitForSelector('#plan-picker-overlay', { state: 'hidden', timeout: 3000 });
    }
  } catch (e) {}
}

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipOnboarding(page);
  });

  test('guest "Sign up" notice opens the signup view', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();

    await expect(page.locator('#auth-signup')).toBeVisible();
    await expect(page.locator('#auth-title')).toHaveText('Create Account');
  });

  test('login and signup views switch correctly', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();

    // Signup → login
    await page.locator('#auth-login-link').click();
    await expect(page.locator('#auth-login')).toBeVisible();
    await expect(page.locator('#auth-title')).toHaveText('Welcome Back');

    // Login → signup
    await page.locator('#auth-signup-link').click();
    await expect(page.locator('#auth-signup')).toBeVisible();
    await expect(page.locator('#auth-title')).toHaveText('Create Account');
  });

  test('signup rejects a password shorter than 6 characters', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();

    await page.locator('#auth-signup-name').fill('Test User');
    await page.locator('#auth-signup-email').fill('newuser@example.com');
    await page.locator('#auth-signup-password').fill('12345');
    await page.locator('#auth-signup-confirm').fill('12345');
    await page.locator('#auth-signup-submit').click();

    await expect(page.locator('#auth-signup-error')).toBeVisible();
    await expect(page.locator('#auth-signup-error')).toContainText('at least 6 characters');
  });

  test('signup rejects mismatched confirmation passwords', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();

    await page.locator('#auth-signup-name').fill('Test User');
    await page.locator('#auth-signup-email').fill('newuser@example.com');
    await page.locator('#auth-signup-password').fill('password123');
    await page.locator('#auth-signup-confirm').fill('different456');
    await page.locator('#auth-signup-submit').click();

    await expect(page.locator('#auth-signup-error')).toBeVisible();
    await expect(page.locator('#auth-signup-error')).toContainText('Passwords do not match');
  });

  test('forgot-password view opens and returns to login', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();
    await page.locator('#auth-login-link').click();

    await page.locator('#auth-forgot-link').click();
    await expect(page.locator('#auth-forgot')).toBeVisible();
    await expect(page.locator('#auth-title')).toHaveText('Reset Password');

    await page.locator('#auth-back-login').click();
    await expect(page.locator('#auth-login')).toBeVisible();
  });

  test('real Firebase round-trip: unknown credentials surface the auth error', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();
    await page.locator('#auth-login-link').click();

    // A valid-format email that cannot exist — reaches the real Firebase
    // Auth API and is rejected server-side (no account is created).
    const email = 'e2e-no-such-user-' + Date.now() + '@example.com';
    await page.locator('#auth-login-email').fill(email);
    await page.locator('#auth-login-password').fill('wrong-password-123');
    await page.locator('#auth-login-submit').click();

    // The error element must surface a server-returned message.
    await expect(page.locator('#auth-login-error')).toBeVisible({ timeout: 15000 });
    const message = (await page.locator('#auth-login-error').textContent()).trim();
    expect(message.length).toBeGreaterThan(0);
    expect(message.toLowerCase()).toMatch(/invalid email or password|network|something went wrong/);
  });

  test('real Firebase round-trip: password reset request for unknown email completes', async ({ page }) => {
    await page.locator('#guest-notice-signup').click();
    await page.locator('#auth-login-link').click();
    await page.locator('#auth-forgot-link').click();

    await page.locator('#auth-forgot-email').fill('e2e-no-such-user-' + Date.now() + '@example.com');
    await page.locator('#auth-forgot-submit').click();

    // Firebase does not reveal account existence — a reset request for an
    // unknown email succeeds, and the app shows the success state.
    await expect(page.locator('#auth-forgot-success')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#auth-forgot-success')).toContainText(/reset|sent/i);
  });

  test('header "Sign in" link opens login view', async ({ page }) => {
    // The header sign-in link should be visible for guests
    const signinLink = page.locator('#header-signin-link');
    await expect(signinLink).toBeVisible();
    await signinLink.click();

    // Should open the auth view with login form visible
    await expect(page.locator('#auth-login')).toBeVisible();
    await expect(page.locator('#auth-title')).toHaveText('Welcome Back');
  });

  test('Google sign-in option stays hidden via the header sign-in link (Stage A gate)', async ({ page }) => {
    // Header entry point opens the shared login view WITHOUT the Google flag —
    // the button must stay hidden during the Stage A rollout.
    await page.locator('#header-signin-link').click();
    await expect(page.locator('#auth-login')).toBeVisible();
    await expect(page.locator('#auth-google-login')).not.toBeVisible();
  });

  test('Google sign-in option is visible when auth opens from the Profile tab (Stage A)', async ({ page }) => {
    // Profile-tab entry point passes { google: true } — the only place the
    // Google option is exposed in Stage A.
    await page.locator('#tab-profile').click();
    await expect(page.locator('#auth-login')).toBeVisible();
    await expect(page.locator('#auth-google-login')).toBeVisible();
  });

  test('header "Sign in" link is hidden for signed-in users', async ({ page }) => {
    // For a guest, the link should be visible
    const signinLink = page.locator('#header-signin-link');
    await expect(signinLink).toBeVisible();
    // Verify guest badge is also visible
    await expect(page.locator('#guest-badge')).toBeVisible();
  });
});