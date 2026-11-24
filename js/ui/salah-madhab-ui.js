// ═══════════════════════════════════════════════════════════════
// salah-madhab-ui.js — Choosing a madhab for the Salah track
//
// The picker shows in #view-salah-lesson (js/ui/salah-ui.js draws it when
// the run's step is 'madhab'). The track path's header names the choice and
// offers a change (salahPathHeaderHtml, used by tracks-ui.js).
// ═══════════════════════════════════════════════════════════════

/** The picker: five choices, each with one line. */
function salahPickerMarkup() {
  var mine = getSalahMadhab();
  var h = '<div class="qaida-screen salah-picker">' + _sHead();
  h += _sTitle(t('salah.madhab.title'));
  h += '<p class="qaida-note">' + _sEsc(t('salah.madhab.intro')) + '</p>';
  h += '<ul class="salah-madhabs">';
  SALAH_MADHABS.forEach(function (m) {
    h += '<li><button type="button" class="salah-madhab' + (m === mine ? ' is-current' : '') + '" data-action="madhab"' +
      ' data-madhab="' + m + '" aria-pressed="' + (m === mine) + '">' +
      '<span class="salah-madhab-name">' + _sEsc(t('salah.madhab.' + m)) + '</span>' +
      '<span class="salah-madhab-desc">' + _sEsc(t('salah.madhab.' + m + '.desc')) + '</span></button></li>';
  });
  return h + '</ul></div>';
}

/**
 * Show the madhab picker. onDone runs once a choice is saved; without it
 * the learner goes back to the track's path.
 */
function openSalahMadhabPicker(onDone) {
  _salahRun = { step: 'madhab', onDone: onDone || null };
  switchView('salah-lesson');
}

function _chooseSalahMadhab(id) {
  var run = _salahRun;
  if (!setSalahMadhab(id)) return;
  if (run && run.onDone) run.onDone();
  else _leaveSalah();
}

/** "Your madhab: Ḥanafī · Change", for the top of the track's path. */
function salahPathHeaderHtml() {
  var mine = getSalahMadhab();
  var name = mine ? t('salah.madhab.' + mine) : t('salah.madhab.none');
  return '<p class="salah-path-madhab">' + _sEsc(t('salah.madhab.yours', { name: name })) +
    ' · <button type="button" class="salah-path-change" data-action="salah-madhab">' +
    _sEsc(t(mine ? 'salah.madhab.change' : 'salah.madhab.choose')) + '</button></p>';
}
