// ═══════════════════════════════════════════════════════════════
// quran-player-options.js — Speed and Repeat for Al-Husary's recitation
//
// A row under the reader's buttons with two menus: how fast the reciter
// plays (0.75× to 1.5×) and how many times each verse is recited before the
// next. Remembered on this device. js/ui/quran-player.js reads them as each
// verse starts and ends; a speed change applies to the verse playing now.
// Only recitation in the reader uses them: word recordings play at 1×.
// ═══════════════════════════════════════════════════════════════

var QURAN_RATES = [0.75, 1, 1.25, 1.5];
var QURAN_REPEATS = [1, 2, 3, 5, 10];
var QURAN_PLAYER_OPTIONS_KEY = 'bayan_player_options';

/** The remembered options; anything unknown falls back to 1. */
function quranPlayerOptions() {
  var opts = { rate: 1, repeat: 1 };
  try {
    var saved = JSON.parse(localStorage.getItem(QURAN_PLAYER_OPTIONS_KEY) || '{}');
    if (QURAN_RATES.indexOf(saved.rate) >= 0) opts.rate = saved.rate;
    if (QURAN_REPEATS.indexOf(saved.repeat) >= 0) opts.repeat = saved.repeat;
  } catch (e) { /* corrupt or unavailable storage: use defaults */ }
  return opts;
}

/**
 * Change one option and remember it. A speed change applies to the
 * recitation playing now.
 * @param {'rate'|'repeat'} name
 * @param {number} value - one of QURAN_RATES / QURAN_REPEATS
 */
function setQuranPlayerOption(name, value) {
  var allowed = name === 'rate' ? QURAN_RATES : name === 'repeat' ? QURAN_REPEATS : null;
  if (!allowed || allowed.indexOf(value) < 0) return;
  var opts = quranPlayerOptions();
  opts[name] = value;
  try { localStorage.setItem(QURAN_PLAYER_OPTIONS_KEY, JSON.stringify(opts)); } catch (e) { /* non-critical */ }
  var reciting = typeof _quranRecitation !== 'undefined' && _quranRecitation;
  if (name === 'rate' && reciting && typeof setCurrentAudioRate === 'function') setCurrentAudioRate(value);
}

function _quranOptionSelect(id, name, values, current) {
  var html = '<label class="reader-option" for="' + id + '">' + escapeHtml(t('reader.' + name)) +
    ' <select class="reader-option-select" id="' + id + '">';
  values.forEach(function (v) {
    html += '<option value="' + v + '"' + (v === current ? ' selected' : '') + '>' +
      escapeHtml(t('reader.' + name + 'Value', { n: v })) + '</option>';
  });
  return html + '</select></label>';
}

/** Draw the row and connect its menus. Called by wireReaderControls(). */
function wireQuranPlayerOptions() {
  var row = document.getElementById('reader-player-options');
  if (!row) return;
  var opts = quranPlayerOptions();
  row.innerHTML = _quranOptionSelect('reader-rate', 'rate', QURAN_RATES, opts.rate) +
    _quranOptionSelect('reader-repeat', 'repeat', QURAN_REPEATS, opts.repeat);
  document.getElementById('reader-rate').onchange = function () {
    setQuranPlayerOption('rate', parseFloat(this.value));
  };
  document.getElementById('reader-repeat').onchange = function () {
    setQuranPlayerOption('repeat', parseInt(this.value, 10));
  };
}
