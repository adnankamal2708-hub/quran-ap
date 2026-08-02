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
//   • Reads subscriptions/{uid} from Firestore
//
// isPremium() priority order:
//   1. No document exists → false
//   2. status !== 'active' → false
//   3. status === 'active' AND currentPeriodEnd exists AND is in the past → false
//   4. status === 'active' AND currentPeriodEnd is missing → true
//   5. status === 'active' AND currentPeriodEnd exists AND is in the future → true
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

    // Data Management
    dataExport: { key: 'data-export', label: 'Data Export & Import', description: 'Back up and restore your full learning progress as a file' },

    // Relationship & Insight
    wordRelationships: { key: 'word-relationships', label: 'Word Relationships', description: 'Explore how words connect: similar, opposite, derived forms, and more' },

    // API-Backed (has real per-request cost)
    unlimitedTafsir: { key: 'unlimited-tafsir', label: 'Unlimited Tafsir', description: 'Unlimited access to Ibn Kathir commentary' },
  };

  // ── Private State ──────────────────────────────────────────

  /** @type {boolean} Whether the current user has premium */
  var _isPremium = false;

  /** @type {Object|null} Current subscription object (from Firestore) */
  var _subscription = null;

  /** @type {boolean} Whether the service has been initialised */
  var _ready = false;

  /** @type {Array<Function>} Premium state change listeners */
  var _listeners = [];

  /** @type {number|null} Pending fetch timer for debouncing */
  var _fetchTimer = null;

  /** @type {number|null} Current fetch promise to avoid concurrent calls */
  var _fetchPromise = null;

  /** @type {string} Firestore collection for subscription documents */
  var SUBSCRIPTIONS_COLLECTION = 'subscriptions';

  /** @type {Function|null} Unsubscribe function for the live subscription listener */
  var _subUnsubscribe = null;

  /**
   * Tear down the live onSnapshot listener (called on logout/auth change)
   * so no listener leaks across users.
   */
  function _unsubscribeSubscriptionListener() {
    if (_subUnsubscribe) {
      try { _subUnsubscribe(); } catch (e) { /* ignore teardown errors */ }
      _subUnsubscribe = null;
    }
  }

  // ── Initialization ─────────────────────────────────────────

  /**
   * Initialize the premium service.
   * Sets up auth listener to read subscription from Firestore on login/logout.
   * Safe to call multiple times.
   */
  function _init() {
    if (_ready) return true;

    // Default: no premium
    _isPremium = false;
    _subscription = null;
    _ready = true;

    // Listen for auth changes to load or reset premium state
    if (typeof onAuthChange === 'function') {
      onAuthChange(function (user) {
        if (user) {
          // User logged in — load subscription + establish live listener
          _loadSubscriptionFromFirestore(user.uid);
        } else {
          // User logged out — unsubscribe listener and reset premium
          _unsubscribeSubscriptionListener();
          if (_isPremium || _subscription !== null) {
            _isPremium = false;
            _subscription = null;
            _notifyListeners();
          }
        }
      });
    } else if (typeof window.__auth !== 'undefined' && window.__auth && typeof window.__auth.onAuthChange === 'function') {
      window.__auth.onAuthChange(function (user) {
        if (user) {
          _loadSubscriptionFromFirestore(user.uid);
        } else {
          _unsubscribeSubscriptionListener();
          if (_isPremium || _subscription !== null) {
            _isPremium = false;
            _subscription = null;
            _notifyListeners();
          }
        }
      });
    }

    return true;
  }

  // ── Firestore Subscription Reader ──────────────────────────

  /**
   * Apply the 5-rule priority order to a subscription document snapshot.
   * Shared by the one-shot read (refresh) and the live onSnapshot listener.
   *
   * @param {Object} docSnap — Firestore DocumentSnapshot (exists()/data())
   */
  function _applySubscriptionDoc(docSnap) {
    if (!docSnap || typeof docSnap.exists !== 'function') {
      _setPremiumState(false, null);
      return;
    }

    if (!docSnap.exists()) {
      // Rule 1: No document exists → false
      _setPremiumState(false, null);
      return;
    }

    var data = docSnap.data();

    // Rule 2: status !== 'active' → false
    if (!data || data.status !== 'active') {
      _setPremiumState(false, data || null);
      return;
    }

    // Rule 3: active AND currentPeriodEnd exists AND is in the past → false
    if (data.currentPeriodEnd && data.currentPeriodEnd.toDate) {
      var endDate = data.currentPeriodEnd.toDate();
      if (endDate < new Date()) {
        _setPremiumState(false, data);
        return;
      }
    } else if (data.currentPeriodEnd && typeof data.currentPeriodEnd === 'object' && data.currentPeriodEnd.seconds) {
      // Handle Firestore Timestamp as plain object (from SSR/deserialized)
      var endMs = data.currentPeriodEnd.seconds * 1000;
      if (endMs < Date.now()) {
        _setPremiumState(false, data);
        return;
      }
    } else if (data.currentPeriodEnd && typeof data.currentPeriodEnd === 'number') {
      // Handle raw epoch ms
      if (data.currentPeriodEnd < Date.now()) {
        _setPremiumState(false, data);
        return;
      }
    } else if (data.currentPeriodEnd && typeof data.currentPeriodEnd === 'string') {
      // Handle ISO string
      if (new Date(data.currentPeriodEnd) < new Date()) {
        _setPremiumState(false, data);
        return;
      }
    }

    // Rule 4: active AND currentPeriodEnd is missing → true (do not fail closed)
    // Rule 5: active AND currentPeriodEnd exists AND is in the future → true
    // Both resolve to true at this point.
    _setPremiumState(true, data);
  }

  /**
   * Read subscription document from Firestore for the given user.
   * Establishes a live onSnapshot listener on subscriptions/{uid} and also
   * performs an immediate one-shot read so state is correct right away.
   *
   * The onSnapshot listener updates _isPremium + notifies onChange listeners
   * whenever the doc changes (e.g. webhook writes after purchase), so
   * already-open tabs/views reflect premium status without a reload.
   *
   * @param {string} uid — Firebase Auth user ID
   */
  async function _loadSubscriptionFromFirestore(uid) {
    if (!uid) return;

    // Tear down any prior listener first so it is always cleared even on an
    // early return below (e.g. Firestore transiently unavailable). Prevents a
    // stale listener for a previous user/session from lingering.
    _unsubscribeSubscriptionListener();

    try {
      var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
      if (!db) return;

      var docRef = window.__firebaseCore.doc(db, SUBSCRIPTIONS_COLLECTION, uid);

      // Live listener: swap in a fresh one each call (refresh/login), never
      // stacking listeners.
      if (typeof window.__firebaseCore.onSnapshot === 'function') {
        try {
          _subUnsubscribe = window.__firebaseCore.onSnapshot(
            docRef,
            function (snap) {
              _applySubscriptionDoc(snap);
            },
            function (err) {
              // Listener error (network/permissions): don't throw, don't crash.
              // Log and fall back to the last known state rather than silently
              // flipping the user out of premium.
              console.warn('[premium] Subscription listener error:', err && err.message || err);
            }
          );
        } catch (e) {
          console.warn('[premium] Failed to attach subscription listener:', e && e.message || e);
        }
      }

      // One-shot read (kept for refresh()/poll semantics — harmless redundancy)
      var docSnap = await window.__firebaseCore.getDoc(docRef);
      _applySubscriptionDoc(docSnap);

    } catch (e) {
      // Error handling: any Firestore read error → false, log with console.warn
      console.warn('[premium] Error reading subscription from Firestore:', e.message || e);
      _setPremiumState(false, null);
    }
  }

  /**
   * Update internal premium state and notify listeners.
   *
   * @param {boolean} isPremium
   * @param {Object|null} subscriptionData
   */
  function _setPremiumState(isPremium, subscriptionData) {
    var changed = (_isPremium !== isPremium) || (_subscription !== subscriptionData);
    _isPremium = isPremium;
    _subscription = subscriptionData;
    if (changed) {
      _notifyListeners();
    }
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
   * Uses the 5-rule priority order against the Firestore subscriptions/{uid} doc.
   *
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
   * Refresh premium status from the source of truth (Firestore).
   * @returns {Promise<boolean>} Whether premium is active after refresh
   */
  async function refresh() {
    _init();

    try {
      var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!user) {
        user = window.__auth && typeof window.__auth.getCurrentUser === 'function' ? window.__auth.getCurrentUser() : null;
      }
      if (user) {
        await _loadSubscriptionFromFirestore(user.uid);
      } else {
        _setPremiumState(false, null);
      }
    } catch (e) {
      console.warn('[premium] refresh error:', e.message || e);
      _setPremiumState(false, null);
    }

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
   * Request an upgrade to premium via Stripe Checkout.
   *
   * Opens a Stripe Checkout session by POSTing to the backend endpoint.
   * Every upgrade button in the app should call this instead of navigating
   * directly. This ensures future payment providers can be plugged in
   * without changing UI code.
   *
   * @param {string} [reason] — Why the upgrade is being requested (for analytics)
   * @param {Object} [options] - { plan: 'monthly'|'yearly' }
   * @returns {Promise<void>}
   */
  async function requestUpgrade(reason, options) {
    _init();

    if (_isPremium) {
      // Already premium — no action needed
      return;
    }

    // Log the request for analytics
    if (window.__DEV__) {
      console.log('[premium] Upgrade requested. Reason:', reason || 'unspecified');
    }

    // Get the current user
    var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) {
      user = window.__auth && typeof window.__auth.getCurrentUser === 'function' ? window.__auth.getCurrentUser() : null;
    }

    if (!user) {
      // No signed-in user — show sign-in prompt
      _showSignInRequired();
      return;
    }

    // Show loading state on the triggering button
    var loadingEl = _showLoadingState(true);

    try {
      // Get Firebase ID token
      var auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
      if (!auth || !auth.currentUser) {
        throw new Error('Auth not available');
      }
      var token = await auth.currentUser.getIdToken();

      // Determine plan: default to monthly unless caller explicitly requests yearly
      var plan = (options && options.plan === 'yearly') ? 'yearly' : 'monthly';

      // POST to the checkout endpoint
      var response = await fetch('https://quran-ap-pzso.vercel.app/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: plan }),
      });

      if (!response.ok) {
        var errorText = '';
        try {
          var errorBody = await response.json();
          errorText = errorBody.error || response.statusText;
        } catch (_) {
          errorText = response.statusText || 'HTTP ' + response.status;
        }
        throw new Error(errorText || 'Checkout request failed');
      }

      var data = await response.json();

      if (!data || !data.url) {
        throw new Error('No checkout URL in response');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch (e) {
      // Clear loading state
      _showLoadingState(false);

      // Show a clear, non-technical error message
      console.warn('[premium] Checkout error:', e.message || e);

      if (window.__ux && typeof window.__ux.showToast === 'function') {
        window.__ux.showToast('Something went wrong starting checkout — please try again', 'error', 5000);
      } else if (typeof showToast === 'function') {
        showToast('Something went wrong starting checkout — please try again', 'warning', 5000);
      } else {
        // Fallback: show an alert
        alert('Something went wrong starting checkout — please try again');
      }
    }
  }

  // ── Loading State Helper ───────────────────────────────────

  /**
   * Show or hide loading state on the button that triggered requestUpgrade.
   * @param {boolean} isLoading
   * @returns {Element|null} The element that was styled
   */
  function _showLoadingState(isLoading) {
    // Try to find the most recently focused button or use a generic selector
    var btn = document.activeElement;
    if (!btn || btn.tagName !== 'BUTTON') {
      // Fallback: look for common premium upgrade button selectors
      btn = document.querySelector('[data-premium-btn], .premium-btn, .upgrade-btn, [data-action="upgrade"]');
    }
    if (btn) {
      if (isLoading) {
        btn.disabled = true;
        btn._premiumOrigText = btn.textContent || btn.innerHTML;
        btn.innerHTML = 'Please wait…';
      } else {
        btn.disabled = false;
        if (btn._premiumOrigText) {
          btn.innerHTML = btn._premiumOrigText;
          delete btn._premiumOrigText;
        }
      }
    }
    return btn;
  }

  // ── Sign-In Prompt ─────────────────────────────────────────

  /**
   * Show a prompt telling the user they need to sign in first.
   * Reuses the existing sign-in UI pattern from the app.
   */
  function _showSignInRequired() {
    // Try to use the app's existing toast pattern
    if (window.__ux && typeof window.__ux.showToast === 'function') {
      window.__ux.showToast('Please sign in to upgrade to premium', 'info', 4000);
    } else if (typeof showToast === 'function') {
      showToast('Please sign in to upgrade to premium', 'info', 4000);
    }

    // Try to open the auth UI if it has a showLogin method
    if (typeof showAuthModal === 'function') {
      showAuthModal('login');
    } else if (window.__auth && typeof window.__auth.showLogin === 'function') {
      window.__auth.showLogin();
    }
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
      DATA_EXPORT: 'dataExport',
      WORD_RELATIONSHIPS: 'wordRelationships',
      UNLIMITED_TAFSIR: 'unlimitedTafsir',
    },
  };

})();
