// ═══════════════════════════════════════════════════════════════
// quran-scroll.js — Bring a verse into view in a long surah
//
// Verse cards are drawn lazily (content-visibility: auto, styles.css), so a
// card far down the surah is first measured at an estimated height. One
// scroll lands short once the real cards near it are drawn (2:255 ended up
// near 2:157), and the cards around it are drawn a frame or two after each
// scroll. So for about half a second this puts the verse back whenever it
// moves. A touch, wheel or key from the reader stops it at once.
// ═══════════════════════════════════════════════════════════════

var QURAN_SCROLL_HOLD_FRAMES = 30; // about half a second
var QURAN_SCROLL_DRIFT_PX = 2;
// A verse taller than this share of the screen (2:255) is shown from its
// start, below the reader's bar (scroll-margin-top in styles.css); a shorter
// one is centred.
var QURAN_SCROLL_TALL_SHARE = 0.6;

/** @param {Element} el - a verse card */
function scrollVerseIntoView(el) {
  if (!el || !el.scrollIntoView) return;
  var frames = 0;
  var stopped = false;
  var events = ['touchstart', 'wheel', 'keydown'];
  function stop() {
    stopped = true;
    events.forEach(function (name) { window.removeEventListener(name, stop, true); });
  }
  events.forEach(function (name) { window.addEventListener(name, stop, { capture: true, passive: true }); });

  function scroll() {
    // 'instant': the reader scrolls smoothly (styles.css), and a smooth
    // scroll would still be under way when the next frame measures.
    var block = el.offsetHeight > window.innerHeight * QURAN_SCROLL_TALL_SHARE ? 'start' : 'center';
    try { el.scrollIntoView({ block: block, behavior: 'instant' }); }
    catch (e) { el.scrollIntoView({ block: block }); } // browsers without 'instant'
    return el.getBoundingClientRect().top;
  }
  var placedAt = scroll();
  function check() {
    if (stopped || !el.isConnected) return stop();
    // Cards drawn since the last scroll moved it: put it back.
    if (Math.abs(el.getBoundingClientRect().top - placedAt) >= QURAN_SCROLL_DRIFT_PX) placedAt = scroll();
    if (++frames >= QURAN_SCROLL_HOLD_FRAMES) return stop();
    requestAnimationFrame(check);
  }
  requestAnimationFrame(check);
}
