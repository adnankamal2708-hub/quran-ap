// ═══════════════════════════════════════════════════════════════
// theme.js — Light / dark theme choice
//
// System (follows the device), Light or Dark, picked with the top bar
// button and remembered on this device (localStorage bayan_theme). The
// inline script in index.html <head> applies it before first paint and
// exposes window.__applyTheme to re-apply after a change.
// ═══════════════════════════════════════════════════════════════

var THEME_KEY = 'bayan_theme';
var THEME_ORDER = ['system', 'light', 'dark'];
var THEME_INFO = {
  system: { icon: 'monitor', label: 'Theme: matches your device' },
  light: { icon: 'sun', label: 'Theme: light' },
  dark: { icon: 'moon', label: 'Theme: dark' },
};

function getThemePref() {
  var pref = 'system';
  try { pref = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { /* storage unavailable */ }
  return THEME_INFO[pref] ? pref : 'system';
}

function setThemePref(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch (e) { /* storage unavailable: still applies for this visit */ }
  if (typeof window.__applyTheme === 'function') window.__applyTheme();
  _updateThemeButton(pref);
}

function _updateThemeButton(pref) {
  var btn = document.getElementById('theme-btn');
  if (!btn) return;
  var info = THEME_INFO[pref];
  btn.innerHTML = typeof uiIcon === 'function' ? uiIcon(info.icon, true) : '';
  btn.setAttribute('aria-label', info.label + '. Change theme');
  btn.title = info.label;
}

/** Wire the top bar button: System → Light → Dark → System. */
function initThemeButton() {
  var btn = document.getElementById('theme-btn');
  if (!btn) return;
  _updateThemeButton(getThemePref());
  btn.onclick = function () {
    var next = THEME_ORDER[(THEME_ORDER.indexOf(getThemePref()) + 1) % THEME_ORDER.length];
    setThemePref(next);
  };
}
