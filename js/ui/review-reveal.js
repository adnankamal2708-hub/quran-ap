/**
 * review-reveal.js — in a review, recall the meaning before seeing it
 *
 * A review card shows the Arabic first. The meaning and the rating
 * buttons stay hidden until "Show meaning" is tapped (or Space pressed),
 * so the rating records whether the word was recalled, not recognised.
 */

/** Hide the meaning and rating buttons (hide=true), or leave the card as is. */
function setupReviewReveal(hide) {
  var card = document.getElementById('word-card');
  var btn = document.getElementById('reveal-meaning-btn');
  if (!card || !btn) return;
  card.classList.toggle('meaning-hidden', !!hide);
  btn.hidden = !hide;
  if (hide) _setRatingVisible(false);
}

/** Show the meaning and rating buttons. Returns true if it was hidden. */
function revealReviewMeaning() {
  var card = document.getElementById('word-card');
  if (!card || !card.classList.contains('meaning-hidden')) return false;
  card.classList.remove('meaning-hidden');
  var btn = document.getElementById('reveal-meaning-btn');
  if (btn) btn.hidden = true;
  _setRatingVisible(true);
  var good = document.getElementById('srs-good');
  if (good) good.focus();
  return true;
}

function _setRatingVisible(visible) {
  var row = document.getElementById('srs-row');
  var label = document.getElementById('srs-label');
  if (row) row.style.display = visible ? 'grid' : 'none';
  if (label) label.style.display = visible ? 'block' : 'none';
}
