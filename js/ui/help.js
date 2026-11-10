// ═══════════════════════════════════════════════════════════════
// help.js — How to use Bayan
//
// A short guide in plain words: what each tab at the bottom is for,
// the text size choice (js/ui/text-size.js), and a way to see the
// welcome screens again. Opened from Home and from Profile → About.
// ═══════════════════════════════════════════════════════════════

var HELP_TABS = ['home', 'learn', 'practice', 'quran', 'profile'];

function _helpHtml() {
  var size = getTextSize();
  var h = '<div class="modal-content help-dialog">';
  h += '<h2 class="modal-title" id="help-title">' + t('help.title') + '</h2>';
  h += '<p class="help-intro">' + t('help.intro') + '</p>';
  h += '<ul class="help-tabs">';
  HELP_TABS.forEach(function (tab) {
    h += '<li><strong>' + t('help.tab.' + tab) + '</strong> ' + t('help.tab.' + tab + '.desc') + '</li>';
  });
  h += '</ul>';
  h += '<h3 class="help-heading" id="help-size-label">' + t('help.textSize') + '</h3>';
  h += '<div class="help-sizes" role="group" aria-labelledby="help-size-label">';
  TEXT_SIZE_ORDER.forEach(function (s) {
    h += '<button class="btn btn-outline help-size help-size-' + s + '" type="button" data-size="' + s + '" aria-pressed="' + (s === size) + '">' + t('textSize.' + s) + '</button>';
  });
  h += '</div>';
  h += '<p class="help-note">' + t('help.textSize.note') + '</p>';
  h += '<p class="help-note">' + t('help.theme') + '</p>';
  h += '<div class="help-actions">';
  h += '<button class="btn btn-outline" type="button" id="help-welcome">' + t('help.welcome') + '</button>';
  h += '<button class="btn" type="button" id="help-close">' + t('help.close') + '</button>';
  h += '</div></div>';
  return h;
}

function hideHelp() {
  var overlay = document.getElementById('help-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  document.removeEventListener('keydown', overlay._escHandler);
  if (typeof releaseFocusTrap === 'function') releaseFocusTrap(overlay);
}

/** Open How to use Bayan. */
function showHelp() {
  var overlay = document.getElementById('help-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'help-title');
    document.body.appendChild(overlay);
  }
  // A tip bubble sits above dialogs, so close any that is open
  if (window.__ux && typeof window.__ux.closeTooltips === 'function') window.__ux.closeTooltips();
  overlay.innerHTML = _helpHtml();
  overlay.style.display = 'flex';

  // Clicking the dimmed background closes it, like the other dialogs
  overlay.onclick = function (e) { if (e.target === overlay) hideHelp(); };
  overlay._escHandler = function (e) { if (e.key === 'Escape') hideHelp(); };
  document.addEventListener('keydown', overlay._escHandler);

  overlay.querySelectorAll('.help-size').forEach(function (btn) {
    btn.onclick = function () {
      setTextSize(btn.getAttribute('data-size'));
      overlay.querySelectorAll('.help-size').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
    };
  });
  document.getElementById('help-close').onclick = hideHelp;
  document.getElementById('help-welcome').onclick = function () {
    hideHelp();
    if (window.__ux && typeof window.__ux.showOnboarding === 'function') window.__ux.showOnboarding();
  };
  if (typeof trapFocus === 'function') trapFocus(overlay);
}
