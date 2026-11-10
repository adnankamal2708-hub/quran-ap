// ═══════════════════════════════════════════════════════════════
// text-size.js — Text size for the whole app
//
// Normal, Large or Larger, picked with the top bar "Aa" button or in
// How to use Bayan, and remembered on this device (localStorage
// bayan_text_size). The inline script in index.html <head> sets
// data-text-size on <html> before first paint and exposes
// window.__applyTextSize; styles.css sizes text in rem, so the root
// font size scales every label.
// ═══════════════════════════════════════════════════════════════

var TEXT_SIZE_KEY = 'bayan_text_size';
var TEXT_SIZE_ORDER = ['normal', 'large', 'larger'];

function getTextSize() {
  var size = null;
  try { size = localStorage.getItem(TEXT_SIZE_KEY); } catch (e) { /* storage unavailable */ }
  return TEXT_SIZE_ORDER.indexOf(size) >= 0 ? size : 'normal';
}

function setTextSize(size) {
  if (TEXT_SIZE_ORDER.indexOf(size) < 0) return;
  try {
    if (size === 'normal') localStorage.removeItem(TEXT_SIZE_KEY);
    else localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch (e) { /* storage unavailable: still applies for this visit */ }
  if (typeof window.__applyTextSize === 'function') window.__applyTextSize();
  _updateTextSizeButton(size);
}

function _updateTextSizeButton(size) {
  var btn = document.getElementById('text-size-btn');
  if (!btn) return;
  var label = t('textSize.current', { size: t('textSize.' + size) });
  btn.setAttribute('aria-label', label + '. ' + t('textSize.change'));
  btn.title = label;
}

/** Wire the top bar button: Normal → Large → Larger → Normal. */
function initTextSizeButton() {
  var btn = document.getElementById('text-size-btn');
  if (!btn) return;
  _updateTextSizeButton(getTextSize());
  btn.onclick = function () {
    setTextSize(TEXT_SIZE_ORDER[(TEXT_SIZE_ORDER.indexOf(getTextSize()) + 1) % TEXT_SIZE_ORDER.length]);
  };
}
