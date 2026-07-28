// ═══════════════════════════════════════════════════════════════
// premium.js — Premium Subscription & Feature Entitlement Service
//
// Single source of truth for all premium/paid features.
// No other module should check Firebase, localStorage, or any
// other source directly for premium status — always use this service.
//
// Architecture:
//   • Centralized entitlement state
//   • Feature gate system (hasFeature)
//   • Upgrade hooks (requestUpgrade)
//   • Subscription listener support (onChange)
//   • Firebase-ready for future Stripe/RevenueCat integration
//
// IMPORTANT: This is the infrastructure layer only.
// No payment provider (Stripe, RevenueCat, etc.) is integrated yet.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Premium Feature Definitions ────────────────────────────
  // Every premium feature is defined here with a unique key.
  // Other modules reference these keys rather than hardcoded checks.
  // To add a new premium feature: add it here, then use hasFeature().

  var PREMIUM_FEATURES = {
    // Learning & Vocabulary
    unlimitedReviews: { key: 'unlimited-reviews', label: 'Unlimited Reviews', description: 'Unlimited daily reviews per session' },
    guidedReading: { key: 'guided-reading', label: 'Guided Reading', description: 'Structured surah-by-surah reading path with comprehension tracking' },
    vocabularyExpansion: { key: 'vocabulary-expansion', label: 'Vocabulary Expansion', description: 'Expanded vocabulary sets beyond the Foundation Course' },
    advancedInsights: { key: 'advanced-insights', label: 'Advanced Insights', description: 'Detailed analytics, trends, and learning predictions' },

    // Data & Sync
    cloudSync: { key: 'cloud-sync', label: 'Cloud Sync', description: 'Sync progress across multiple devices' },
    offlineDownload: { key: 'offline-download', label: 'Offline Download', description: 'Download full surah data for offline reading' },
    unlimitedBookmarks: { key: 'unlimited-bookmarks', label: 'Unlimited Bookmarks', description: 'Save unlimited verses and words' },

    // Appearance
    premiumThemes: { key: 'premium-themes', label: 'Premium Themes', description: 'Exclusive colour themes and visual customisation' },
  };

  // ── Private State ──────────────────────────────────────────

  /** @type {boolean} Whether the current user has premium */
  var _isPremium = false;

  /** @type {Object|null} Current subscription object (placeholder for future) */
  var _subscription = null;

  /** @type {boolean} Whether the service has been initialised */
  var _ready = false;

  /** @type {Array<Function>} Premium state change listeners */
  var _listeners = [];

  // ── Initialization ─────────────────────────────────────────

  /**
   * Initialise the premium service.
   * Currently sets premium to false (placeholder for future Firestore lookup).
   * Safe to call multiple times.
   */
  function _init() {
    if (_ready) return true;

    // For now, premium is always false.
    // Future: read from Firestore document or subscription token.
    _isPremium = false;
    _subscription = null;
    _ready = true;

    // Listen for auth changes to reset premium state on login/logout
    if (typeof onAuthChange === 'function') {
      onAuthChange(function (user) {
        if (!user) {
          // User logged out — reset premium
          if (_isPremium) {
            _isPremium = false;
            _subscription = null;
            _notifyListeners();
          }
        }
        // On login, we could re-check premium status from Firestore.
        // Future: loadSubscriptionStatus(user.uid);
      });
    }

    return true;
  }

  // ── Listener Management ────────────────────────────────────

  /**
   * Notify all registered listeners of a premium state change.
   */
  function _notifyListeners() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i]({ isPremium: _isPremium, subscription: _subscription }); }
      catch (e) { /* listener error — non-critical */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API — window.__premium
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check whether the current user has an active premium subscription.
   * @returns {boolean}
   */
  function isPremium() {
    _init();
    return _isPremium;
  }

  /**
   * Check whether a specific feature is available.
   *
   * @param {string} featureKey — The feature key (e.g. 'guided-reading', 'cloud-sync')
   * @returns {boolean} Whether the feature is available to the current user
   *
   * Usage:
   *   if (window.__premium.hasFeature('guided-reading')) { ... }
   */
  function hasFeature(featureKey) {
    _init();

    // Validate feature key exists
    if (!featureKey || !PREMIUM_FEATURES[featureKey]) {
      if (window.__DEV__) {
        console.warn('[premium] hasFeature: unknown feature "' + featureKey + '"');
      }
      return false;
    }

    // For now, all premium features resolve to false.
    // Future: check subscription plan against feature entitlement.
    return _isPremium;
  }

  /**
   * Get the current subscription object (if any).
   * @returns {Object|null} { plan, status, expiresAt, ... } or null
   */
  function getSubscription() {
    _init();
    return _subscription;
  }

  /**
   * Refresh premium status from the source of truth.
   * Currently a no-op. Future: re-read Firestore document or verify token.
   * @returns {Promise<boolean>} Whether premium is active after refresh
   */
  async function refresh() {
    _init();
    // Future: const status = await loadSubscriptionStatus(user.uid);
    // _isPremium = status.active;
    // _subscription = status;
    // _notifyListeners();
    return _isPremium;
  }

  /**
   * Register a callback for premium state changes.
   * Returns an unsubscribe function.
   *
   * @param {Function} callback — Called with { isPremium, subscription }
   * @returns {Function} unsubscribe
   */
  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};

    _listeners.push(callback);

    // Immediately call with current state
    try { callback({ isPremium: _isPremium, subscription: _subscription }); }
    catch (e) { /* ignore */ }

    // Return unsubscribe function
    return function () {
      var idx = _listeners.indexOf(callback);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  /**
   * Request an upgrade to premium.
   * Currently opens a placeholder dialog explaining this is coming soon.
   * Every upgrade button in the app should call this instead of navigating
   * directly. This ensures future payment providers can be plugged in
   * without changing UI code.
   *
   * @param {string} reason — Why the upgrade is being requested (for analytics)
   */
  function requestUpgrade(reason) {
    _init();

    if (_isPremium) {
      // Already premium — no action needed
      return;
    }

    // Log the request for future analytics
    if (window.__DEV__) {
      console.log('[premium] Upgrade requested. Reason:', reason || 'unspecified');
    }

    // Show placeholder upgrade dialog
    _showUpgradePlaceholder(reason);
  }

  /**
   * Get the list of all premium features with their metadata.
   * Useful for rendering a "Premium Features" table/modal.
   * @returns {Object} Feature key → { key, label, description }
   */
  function getFeatureList() {
    var list = {};
    Object.keys(PREMIUM_FEATURES).forEach(function (k) {
      list[k] = PREMIUM_FEATURES[k];
    });
    return list;
  }

  // ═══════════════════════════════════════════════════════════════
  // UPGRADE PLACEHOLDER DIALOG
  // ═══════════════════════════════════════════════════════════════

  /**
   * Show a placeholder upgrade dialog explaining the feature is coming soon.
   * Replace this with real payment UI when Stripe/RevenueCat is integrated.
   */
  function _showUpgradePlaceholder(reason) {
    // Avoid stacking multiple dialogs
    var existing = document.getElementById('premium-upgrade-modal');
    if (existing) return;

    var modal = document.createElement('div');
    modal.id = 'premium-upgrade-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);animation:fadeIn 0.2s ease';

    var reasonText = reason ? '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Requested: ' + _escapeHtml(reason) + '</div>' : '';

    modal.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--gold-dim);border-radius:var(--radius-card);padding:28px 24px;max-width:340px;width:90%;box-shadow:var(--shadow-elevated);text-align:center">' +
        '<div style="font-size:32px;margin-bottom:12px">⭐</div>' +
        '<div style="font-family:var(--serif);font-size:18px;color:var(--gold-light);margin-bottom:8px">Bayan Premium</div>' +
        '<div style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:16px">' +
          'Premium subscriptions are coming soon. You will be able to unlock advanced features, cloud sync, and more.' +
        '</div>' +
        reasonText +
        '<div style="display:flex;gap:8px;justify-content:center">' +
          '<button id="premium-upgrade-close" style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-btn);padding:10px 24px;color:var(--text);font-size:13px;cursor:pointer;transition:all 0.2s">Got it</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // Close handler
    var closeBtn = document.getElementById('premium-upgrade-close');
    if (closeBtn) {
      closeBtn.onclick = function () { _closeUpgradePlaceholder(); };
    }

    // Close on backdrop click
    modal.onclick = function (e) {
      if (e.target === modal) _closeUpgradePlaceholder();
    };

    // Close on Escape
    var _onKeyDown = function (e) {
      if (e.key === 'Escape') _closeUpgradePlaceholder();
    };
    document.addEventListener('keydown', _onKeyDown);

    // Focus close button
    if (closeBtn) setTimeout(function () { closeBtn.focus(); }, 100);
  }

  function _closeUpgradePlaceholder() {
    var modal = document.getElementById('premium-upgrade-modal');
    if (modal) {
      modal.style.animation = 'fadeOut 0.15s ease';
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 150);
    }
  }

  /**
   * Minimal HTML escape for user-provided strings.
   */
  function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT — window.__premium
  // ═══════════════════════════════════════════════════════════════

  window.__premium = {
    isPremium: isPremium,
    hasFeature: hasFeature,
    getSubscription: getSubscription,
    refresh: refresh,
    onChange: onChange,
    requestUpgrade: requestUpgrade,
    getFeatureList: getFeatureList,
    // Expose feature keys so other modules can reference them without magic strings
    FEATURES: {
      UNLIMITED_REVIEWS: 'unlimitedReviews',
      GUIDED_READING: 'guidedReading',
      VOCABULARY_EXPANSION: 'vocabularyExpansion',
      ADVANCED_INSIGHTS: 'advancedInsights',
      CLOUD_SYNC: 'cloudSync',
      OFFLINE_DOWNLOAD: 'offlineDownload',
      UNLIMITED_BOOKMARKS: 'unlimitedBookmarks',
      PREMIUM_THEMES: 'premiumThemes',
    },
  };

})();
