// ═══════════════════════════════════════════════════════════════
// landing-auth-gate.js — Landing Page Auth Gate
//
// The landing page must NEVER be shown to an already signed-in
// returning user (free or premium). This script:
//
//   1. Initializes the existing auth service (js/services/auth-service.js).
//   2. Redirects immediately if a session is already known.
//   3. Subscribes to auth changes: a restored session → redirect to the
//      app; a confirmed signed-out state → reveal the page.
//   4. Falls back to revealing the page after a short timeout if
//      Firebase never resolves (e.g. the visitor is fully offline) —
//      a visitor who cannot reach the auth servers is, by definition,
//      not carrying a usable session, and the app itself handles any
//      session restore once they enter.
//
// While the gate is unresolved the page shows a quiet branded loading
// state (`.landing-gate`), so no marketing content flashes to a
// signed-in user whose session is still restoring.
//
// This file is intentionally OUTSIDE the app bundle (build.js uses an
// explicit APP_FILES list) — it only ever runs on the landing page.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /** Where signed-in users are sent — the app (index.html at repo root). */
  var REDIRECT_URL = './';

  /**
   * Longest we will hold the gate for a genuinely signed-out visitor.
   * Session restore for signed-in users typically completes in well
   * under a second; this only ever bites when Firebase is unreachable.
   */
  var MAX_AUTH_WAIT_MS = 3000;

  /** @type {number|null} */
  var _timer = null;

  /** @type {boolean} Whether a redirect has already been issued. */
  var _redirected = false;

  /** @type {boolean} Whether the page has already been revealed. */
  var _revealed = false;

  function redirectToApp() {
    // Once we redirect, never reveal; and never issue a second redirect.
    if (_redirected) return;
    _redirected = true;
    if (_timer !== null) { clearTimeout(_timer); _timer = null; }
    // replace() so the landing page never stays in the browser history.
    window.location.replace(REDIRECT_URL);
  }

  function revealPage() {
    // Never reveal the page to a visitor we are (or were) about to send away.
    if (_redirected || _revealed) return;
    _revealed = true;
    if (_timer !== null) { clearTimeout(_timer); _timer = null; }
    // html.landing-ready fades the gate out and the content in.
    var root = document.documentElement;
    if (root && root.classList) root.classList.add('landing-ready');
  }

  function onAuthUser(user) {
    // Any truthy user — free or premium — goes straight to the app.
    if (user) redirectToApp();
    else revealPage();
  }

  function start() {
    var auth = window.__auth || null;

    // Auth service unavailable (scripts blocked, CDN offline): nothing to
    // gate against — show the page. Any real session is caught by the app.
    if (!auth || typeof auth.init !== 'function' || typeof auth.onAuthChange !== 'function') {
      revealPage();
      return;
    }

    // Safe to call multiple times (firebase-core.initCore is idempotent).
    auth.init();

    // A session already known synchronously → redirect without waiting.
    if (typeof auth.getCurrentUser === 'function') {
      var user = auth.getCurrentUser();
      if (user) { redirectToApp(); return; }
    }

    // Subscribe: fires with the restored user (redirect) or null (reveal)
    // once Firebase resolves the session. Also catches a late sign-in while
    // the page is still open.
    auth.onAuthChange(onAuthUser);

    // Safety net: if nothing resolved within the window, treat the visitor
    // as signed out and reveal. onAuthChange still redirects if a session
    // appears afterwards.
    _timer = setTimeout(function () {
      var current = (typeof auth.getCurrentUser === 'function') ? auth.getCurrentUser() : null;
      if (!current) revealPage();
    }, MAX_AUTH_WAIT_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
