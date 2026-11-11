// ═══════════════════════════════════════════════════════════════
// quran-word-panel.js — Tap a word in the Quran reader
//
// Shows the word as written, its meaning in this verse, "Open lesson"
// when the word is taught in Bayan, and "Report a mistake", which opens
// the feedback form (js/services/feedback.js) already filled in with the
// verse, the word and the meaning shown. "Listen" plays quran.com's
// recording of the word (js/services/audio.js).
// ═══════════════════════════════════════════════════════════════

function _escWordPanel(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The feedback text for a reported word. */
function quranWordReportText(info) {
  return t('wordPanel.reportText', {
    ref: info.verseKey,
    n: info.wordNum,
    arabic: info.arabic,
    meaning: info.meaning || '–',
  }) + '\n';
}

function hideQuranWordPanel() {
  var overlay = document.getElementById('word-panel-overlay');
  if (!overlay || overlay.style.display === 'none') return;
  overlay.style.display = 'none';
  document.removeEventListener('keydown', overlay._escHandler);
  if (typeof releaseFocusTrap === 'function') releaseFocusTrap(overlay);
}

/**
 * Open the panel for one word.
 * @param {{verseKey: string, wordNum: number, arabic: string, meaning: string, audioUrls: ?string[], onOpenLesson: ?function}} info
 */
function showQuranWordPanel(info) {
  var overlay = document.getElementById('word-panel-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'word-panel-overlay';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'word-panel-word');
    document.body.appendChild(overlay);
  }
  if (window.__ux && typeof window.__ux.closeTooltips === 'function') window.__ux.closeTooltips();

  var h = '<div class="modal-content word-panel">';
  h += '<div class="word-panel-word" id="word-panel-word" lang="ar" dir="rtl">' + _escWordPanel(info.arabic) + '</div>';
  h += '<div class="word-panel-meaning">' + _escWordPanel(info.meaning || '–') + '</div>';
  h += '<div class="word-panel-ref">' + _escWordPanel(t('wordPanel.ref', { ref: info.verseKey, n: info.wordNum })) + '</div>';
  h += '<div class="word-panel-actions">';
  if (info.audioUrls && info.audioUrls.length) h += '<button class="btn" type="button" id="word-panel-listen">' + iconText('play', t('wordPanel.listen')) + '</button>';
  if (info.onOpenLesson) h += '<button class="btn" type="button" id="word-panel-lesson">' + t('wordPanel.openLesson') + '</button>';
  h += '<button class="btn btn-outline" type="button" id="word-panel-report">' + t('wordPanel.report') + '</button>';
  h += '<button class="btn btn-outline" type="button" id="word-panel-close">' + t('help.close') + '</button>';
  h += '</div></div>';
  overlay.innerHTML = h;
  overlay.style.display = 'flex';

  overlay.onclick = function (e) { if (e.target === overlay) hideQuranWordPanel(); };
  overlay._escHandler = function (e) { if (e.key === 'Escape') hideQuranWordPanel(); };
  document.addEventListener('keydown', overlay._escHandler);

  document.getElementById('word-panel-close').onclick = hideQuranWordPanel;
  document.getElementById('word-panel-report').onclick = function () {
    hideQuranWordPanel();
    if (window.__feedback && typeof window.__feedback.showModal === 'function') {
      window.__feedback.showModal(quranWordReportText(info));
    }
  };
  var listenBtn = document.getElementById('word-panel-listen');
  if (listenBtn) listenBtn.onclick = function () { playAudioQueue(info.audioUrls); };
  var lessonBtn = document.getElementById('word-panel-lesson');
  if (lessonBtn) lessonBtn.onclick = function () { hideQuranWordPanel(); info.onOpenLesson(); };
  if (typeof trapFocus === 'function') trapFocus(overlay);
}
