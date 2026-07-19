// ═══════════════════════════════════════════════════════════════
// keyboard.js — Keyboard Shortcut System
// Extracted from monolithic app.js for modular maintainability.
// ═══════════════════════════════════════════════════════════════

// ── Keyboard Hints Timer ──────────────────────────────────────

let _kbdHintsTimer = null;

// ── Show/Hide Keyboard Hints ──────────────────────────────────

function showKeyboardHints() {
  var hint = document.getElementById('kbd-hints');
  if (!hint) return;
  hint.classList.add('visible');
  // Announce to screen readers
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  if (_kbdHintsTimer) clearTimeout(_kbdHintsTimer);
  _kbdHintsTimer = setTimeout(function () {
    hint.classList.remove('visible');
    hint.removeAttribute('role');
    hint.removeAttribute('aria-live');
  }, 4000);
}

// ── Setup Keyboard Shortcuts ──────────────────────────────────

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    // Ignore if user is typing in an input/textarea
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Check if any modal is open
    var passwordModal = document.getElementById('password-change-modal');
    var sessionModal = document.getElementById('session-summary-modal');
    var anyModalOpen = (passwordModal && passwordModal.style.display === 'flex') ||
                       (sessionModal && sessionModal.style.display === 'flex');

    if (anyModalOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSessionSummary();
        closePasswordModal();
      }
      return;
    }

    // Show hints on ? key (works with or without Shift)
    if (e.key === '?') {
      e.preventDefault();
      showKeyboardHints();
      return;
    }

    switch (currentView) {
      case 'learn':
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          var btnNext = document.getElementById('btn-next');
          if (btnNext && !btnNext.disabled) btnNext.click();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          var btnPrev = document.getElementById('btn-prev');
          if (btnPrev && !btnPrev.disabled) btnPrev.click();
        } else if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          var srsBtns = ['srs-again', 'srs-hard', 'srs-good', 'srs-easy'];
          var btn = document.getElementById(srsBtns[parseInt(e.key) - 1]);
          if (btn && btn.style.display !== 'none') btn.click();
        } else if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          toggleQuickMode();
        }
        break;

      case 'quiz':
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          var opts = document.querySelectorAll('.quiz-opt:not(:disabled)');
          var idx = parseInt(e.key) - 1;
          if (opts[idx]) opts[idx].click();
        } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          var nextBtn = document.getElementById('btn-next-quiz');
          if (nextBtn && nextBtn.style.display !== 'none') nextBtn.click();
        }
        break;

      case 'list':
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          var searchInput = document.getElementById('search-input');
          if (searchInput) searchInput.focus();
        }
        break;
    }

    // Global navigation shortcuts (no modifier keys) — 5-tab nav
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); switchView('learn'); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); switchView('dashboard'); }
      else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); switchView('list'); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); switchView('quran'); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); switchView('profile'); }
    }

    // Dismiss auto-shown hints on first interaction
    if (window._kbdHintsAutoShown) {
      window._kbdHintsAutoShown = false;
      var hint = document.getElementById('kbd-hints');
      if (hint) {
        clearTimeout(_kbdHintsTimer);
        hint.classList.remove('visible');
      }
    }
  });
}
