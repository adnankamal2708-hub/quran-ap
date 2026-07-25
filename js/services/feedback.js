// ═══════════════════════════════════════════════════════════════
// feedback.js — Lightweight Beta Feedback & Analytics
//
// Exposes window.__feedback with:
//   • sendFeedback(text, email) — submit user feedback to Firestore
//   • trackEvent(name, data)   — record anonymous analytics event
//   • showModal()              — open the feedback modal
//
// Gracefully degrades when Firebase/Firestore is unavailable.
// All analytics are fire-and-forget: never crash the app.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Collection names ────────────────────────────────────────
  var COLLECTION_FEEDBACK = 'feedback';
  var COLLECTION_EVENTS = 'analytics_events';

  // ── State ───────────────────────────────────────────────────
  var _enabled = false;
  var _db = null;
  var _doc = null;
  var _setDoc = null;
  var _serverTimestamp = null;

  // ── Init ────────────────────────────────────────────────────
  function initFeedback() {
    try {
      var core = window.__firebaseCore;
      if (!core || !core.initCore || !core.initCore()) {
        console.log('[feedback] Firebase not available — feedback & analytics disabled.');
        return false;
      }
      _db = core.getDb();
      _doc = core.doc;
      _setDoc = core.setDoc;
      _serverTimestamp = core.serverTimestamp;
      _enabled = !!( _db && _doc && _setDoc);
      if (_enabled) {
        console.log('[feedback] ✓ Feedback & analytics enabled.');
      }
    } catch (e) {
      console.warn('[feedback] Init failed (non-blocking):', e.message);
    }
    return _enabled;
  }

  // ── Send Feedback ───────────────────────────────────────────
  /**
   * Submit user feedback. Stores to Firestore if available,
   * otherwise falls back to localStorage.
   * @param {string} text  — Feedback text (required)
   * @param {string} email — Optional email for reply
   * @returns {Promise<{ok: boolean, stored?: string, error?: string}>}
   */
  async function sendFeedback(text, email) {
    if (!text || !text.trim()) return { ok: false, error: 'No feedback text' };

    var payload = {
      text: text.trim(),
      email: email || null,
      timestamp: Date.now(),
      appVersion: '2.0',
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown',
      screenSize: typeof window !== 'undefined' && window.screen
        ? window.screen.width + 'x' + window.screen.height : 'unknown',
      userAgent: typeof navigator !== 'undefined' && navigator.userAgent
        ? navigator.userAgent.slice(0, 200) : 'unknown',
    };

    if (_enabled && _db && _doc && _setDoc) {
      try {
        var id = '_fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        var ref = _doc(_db, COLLECTION_FEEDBACK, id);
        if (_serverTimestamp) {
          payload.ts = _serverTimestamp();
        }
        await _setDoc(ref, payload);
        return { ok: true, stored: 'firestore' };
      } catch (e) {
        console.warn('[feedback] Firestore write failed, storing locally:', e.message);
      }
    }

    // Fallback: localStorage
    _storeLocal(payload);
    return { ok: true, stored: 'local' };
  }

  // ── Track Event ─────────────────────────────────────────────
  /**
   * Record an anonymous analytics event.
   * Fire-and-forget: never throws, never blocks.
   * @param {string} eventName — e.g. 'onboarding_completed'
   * @param {Object} [data]    — Optional event-specific data
   */
  function trackEvent(eventName, data) {
    if (!_enabled || !_db || !_doc || !_setDoc) return;

    try {
      var id = '_evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      var ref = _doc(_db, COLLECTION_EVENTS, id);
      var payload = {
        event: eventName,
        data: data || {},
        timestamp: _serverTimestamp ? _serverTimestamp() : Date.now(),
        appVersion: '2.0',
        platform: typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown',
        screenSize: typeof window !== 'undefined' && window.screen
          ? window.screen.width + 'x' + window.screen.height : 'unknown',
      };
      // Fire and forget — do not await
      _setDoc(ref, payload).catch(function () {});
    } catch (e) {
      // Silent fail — analytics never crash the app
      if (window.__DEV__) console.warn('[feedback] trackEvent failed:', eventName, e.message);
    }
  }

  // ── Local Fallback ──────────────────────────────────────────
  function _storeLocal(payload) {
    try {
      var key = 'quran_feedback_pending';
      var pending = JSON.parse(localStorage.getItem(key) || '[]');
      pending.push({
        text: payload.text,
        email: payload.email,
        timestamp: payload.timestamp,
        stored: Date.now(),
      });
      if (pending.length > 20) pending = pending.slice(-20);
      localStorage.setItem(key, JSON.stringify(pending));
    } catch (e) { /* ignore */ }
  }

  // ── Feedback Modal ──────────────────────────────────────────
  /**
   * Show the feedback submission modal. Creates DOM on first call.
   */
  function showModal() {
    var existing = document.getElementById('fb-modal');
    if (existing) {
      existing.style.display = 'flex';
      var textarea = document.getElementById('fb-text');
      if (textarea) textarea.focus();
      return;
    }

    var modal = document.createElement('div');
    modal.id = 'fb-modal';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:9999;' +
      'background:rgba(0,0,0,0.6);' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:16px;animation:fadeIn 0.2s ease';

    var card = document.createElement('div');
    card.style.cssText =
      'background:var(--surface);border:1px solid var(--border);' +
      'border-radius:var(--radius-card);max-width:400px;width:100%;' +
      'padding:24px;box-shadow:var(--shadow-elevated)';

    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div style="font-size:16px;font-weight:600;color:var(--text)">💬 Send Feedback</div>' +
        '<button id="fb-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px;line-height:1" aria-label="Close">✕</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;line-height:1.5">' +
        'Help improve Bayan. Your feedback helps make the app better for everyone.' +
      '</div>' +
      '<textarea id="fb-text" placeholder="Describe your experience, suggestion, or issue…"' +
        ' style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);' +
        'border-radius:var(--radius-sm);color:var(--text);font-size:13px;padding:10px;' +
        'font-family:var(--body);resize:vertical;outline:none;box-sizing:border-box"' +
        ' aria-label="Your feedback" name="feedback"></textarea>' +
      '<input id="fb-email" name="email" type="email" placeholder="Email (optional — if you want a reply)"' +
        ' style="width:100%;background:var(--bg);border:1px solid var(--border);' +
        'border-radius:var(--radius-sm);color:var(--text);font-size:12px;padding:10px;' +
        'margin-top:8px;font-family:var(--body);outline:none;box-sizing:border-box"' +
        ' aria-label="Email address" />' +
      '<div id="fb-status" style="font-size:11px;margin-top:8px;min-height:18px;color:var(--text-muted)"></div>' +
      '<button id="fb-submit" style="width:100%;background:var(--gold);color:var(--bg);' +
        'border:none;border-radius:var(--radius-btn);padding:10px;font-size:13px;' +
        'font-weight:500;cursor:pointer;margin-top:10px;font-family:var(--body)">Send Feedback</button>';

    modal.appendChild(card);
    document.body.appendChild(modal);

    // Wire events
    document.getElementById('fb-close').onclick = function () {
      modal.style.display = 'none';
    };
    document.getElementById('fb-submit').onclick = _submitFeedback;
    modal.onclick = function (e) {
      if (e.target === modal) modal.style.display = 'none';
    };
    var fbText = document.getElementById('fb-text');
    if (fbText) fbText.focus();
  }

  // ── Submit Handler ──────────────────────────────────────────
  async function _submitFeedback() {
    var textEl = document.getElementById('fb-text');
    var emailEl = document.getElementById('fb-email');
    var statusEl = document.getElementById('fb-status');
    var btnEl = document.getElementById('fb-submit');

    if (!textEl || !textEl.value.trim()) {
      if (statusEl) {
        statusEl.textContent = '⚠ Please enter your feedback.';
        statusEl.style.color = 'var(--red)';
      }
      return;
    }

    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = 'Sending…';
    }

    var result = await sendFeedback(textEl.value, emailEl ? emailEl.value : '');

    if (statusEl) {
      if (result && result.ok) {
        statusEl.textContent = '✓ Thank you! Your feedback was received.';
        statusEl.style.color = 'var(--green)';
        textEl.value = '';
        if (emailEl) emailEl.value = '';
        setTimeout(function () {
          var m = document.getElementById('fb-modal');
          if (m) m.style.display = 'none';
        }, 2000);
      } else {
        statusEl.textContent = '⚠ Could not send feedback. Saved locally.';
        statusEl.style.color = 'var(--gold-dim)';
      }
    }

    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = 'Send Feedback';
    }
  }

  // ── Hook into diagnostics for crash reporting ──────────────
  var _reportingError = false;
  var _hookTimer = null;

  function hookDiagnostics() {
    if (!window.__diag || !window.__diag.error) return;
    // Only hook once — check if already wrapped
    if (window.__diag.error._fbHooked) return;
    var origError = window.__diag.error;
    window.__diag.error = function (component, fn, message, error, state) {
      var result = origError.call(window.__diag, component, fn, message, error, state);
      // Re-entrancy guard: prevent infinite loop if trackEvent itself errors
      if (result && _enabled && !_reportingError) {
        _reportingError = true;
        try {
          trackEvent('error', {
            component: component,
            fn: fn,
            message: message ? message.slice(0, 200) : '',
            severity: 'error',
          });
        } finally {
          _reportingError = false;
        }
      }
      return result;
    };
    window.__diag.error._fbHooked = true;
    // Cancel pending timer if hook succeeded
    if (_hookTimer) { clearTimeout(_hookTimer); _hookTimer = null; }
  }

  // Try to hook diagnostics. If __diag isn't ready yet, retry after a delay.
  if (typeof window.__diag !== 'undefined') {
    hookDiagnostics();
  } else {
    _hookTimer = setTimeout(function () {
      hookDiagnostics();
    }, 2000);
  }

  // ── Public API ───────────────────────────────────────────────
  window.__feedback = {
    init: initFeedback,
    sendFeedback: sendFeedback,
    trackEvent: trackEvent,
    showModal: showModal,
    hookDiagnostics: hookDiagnostics,
    isEnabled: function () { return _enabled; },
  };

  // Auto-init on DOM ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initFeedback();
  } else {
    document.addEventListener('DOMContentLoaded', initFeedback);
  }
})();
