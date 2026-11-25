// ═══════════════════════════════════════════════════════════════
// saved-verses-ui.js — The Save button on each verse and the
// "Saved verses" list on the Quran tab
//
// Each verse in the reader has a bookmark button beside its play button
// (drawn by js/ui/quran.js, labelled here). The list sits above the surah
// list, newest first; a tap opens the reader at that verse. Storage and
// the free limit: js/data-core/saved-verses.js.
// ═══════════════════════════════════════════════════════════════

function _savedVerseKey(verse) {
  return (typeof _quranSurahId !== 'undefined' ? _quranSurahId : '') + ':' + verse;
}

/** Draw every Save button in the reader to match what is saved. */
function syncSavedVerseButtons() {
  var buttons = document.querySelectorAll('#quran-verses .quran-ayah-save');
  for (var i = 0; i < buttons.length; i++) {
    var verse = parseInt(buttons[i].getAttribute('data-verse'), 10);
    var saved = isVerseSaved(_savedVerseKey(verse));
    buttons[i].innerHTML = uiIcon('bookmark', true);
    buttons[i].setAttribute('aria-pressed', saved ? 'true' : 'false');
    buttons[i].setAttribute('aria-label', t(saved ? 'reader.unsaveVerse' : 'reader.saveVerse', { n: verse }));
  }
}

/** A verse's Save button: save it, or unsave it if it is saved. */
function toggleVerseSave(verse) {
  var result = toggleSavedVerse(_savedVerseKey(verse));
  if (result === 'limit' && typeof showToast === 'function') {
    showToast(t('reader.saveLimit', { n: APP_FACTS.limits.savedVerses }), 'warning', 4000);
  }
  syncSavedVerseButtons();
}

/** The list for the top of the surah list; '' when nothing is saved. */
function savedVersesListHtml() {
  var keys = savedVerseList();
  if (!keys.length) return '';
  var html = '<section class="saved-verses" aria-labelledby="saved-verses-title">' +
    '<h3 class="saved-verses-title" id="saved-verses-title">' + escapeHtml(t('saved.title')) + '</h3>' +
    '<ul class="saved-verses-list">';
  keys.forEach(function (key) {
    var parts = key.split(':');
    var info = typeof _getSurahInfo === 'function' ? _getSurahInfo(+parts[0]) : null;
    var name = info ? info.name : t('saved.surah', { n: parts[0] });
    html += '<li><button type="button" class="saved-verse-item" data-verse-key="' + escapeHtml(key) + '">' +
      uiIcon('bookmark', true) + '<span>' + escapeHtml(t('saved.item', { surah: name, n: parts[1] })) + '</span>' +
      '<span class="saved-verse-ref" aria-hidden="true">' + escapeHtml(key) + '</span></button></li>';
  });
  return html + '</ul></section>';
}

/** Open the reader at a saved verse. */
function openSavedVerse(key) {
  var surah = parseInt(key.split(':')[0], 10);
  if (!surah) return;
  _quranScrollVerse = key;
  openSurahForReading(surah);
}

/** Connect the list's buttons (called after the surah list is drawn). */
function wireSavedVersesList(container) {
  var items = container.querySelectorAll('.saved-verse-item');
  for (var i = 0; i < items.length; i++) {
    items[i].onclick = function () { openSavedVerse(this.getAttribute('data-verse-key')); };
  }
}
