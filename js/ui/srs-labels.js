/**
 * srs-labels.js — the review buttons say when the word comes back
 *
 * Each button's small label (Again · 10 min, Good · 2 days …) is the
 * scheduler's own next interval for that rating, so the label is always
 * what tapping the button will do.
 */

var SRS_BUTTON_IDS = ['srs-again', 'srs-hard', 'srs-good', 'srs-easy'];
var SRS_MINUTES_BELOW_HOURS = 0.75; // under 45 minutes reads as minutes

/** A next-review interval in days, as a short label. */
function formatSRSInterval(days) {
  var hours = days * 24;
  var minutes = Math.round(hours * 60);
  if (minutes < 1) return 'Now';
  if (hours < SRS_MINUTES_BELOW_HOURS) return minutes + ' min';
  if (days < 1) { var h = Math.max(1, Math.round(hours)); return h + (h === 1 ? ' hour' : ' hours'); }
  var d = Math.round(days);
  if (d <= 1) return 'Tomorrow';
  if (d < 60) return d + ' days';
  return Math.round(d / 30) + ' months';
}

/** Set each rating button's label to the interval it would give this word. */
function updateSRSButtonLabels(wordId) {
  if (!wordId || typeof previewSRSInterval !== 'function') return;
  SRS_BUTTON_IDS.forEach(function (id, rating) {
    var label = document.querySelector('#' + id + ' .srs-days');
    if (label) label.textContent = formatSRSInterval(previewSRSInterval(wordId, rating));
  });
}
