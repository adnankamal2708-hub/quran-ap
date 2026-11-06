// ── Review schedule shared by the Qaida and Tajweed tracks ───────
// Pure functions over a review map { <id>: { due, step } }: a missed
// item comes back soon, then each right answer spaces it further out
// until it leaves the queue. The tracks own the storage; this owns the
// timing.

/** A missed item comes back this long after the miss (as SRS "again") */
var REVIEW_RETRY_MS = 10 * 60 * 1000;

/** Days until the next review after each right answer; after the last, the item leaves the queue */
var REVIEW_DAYS = [1, 3, 7, 21];

var _REVIEW_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The record an answer leaves. A miss (re)starts the item; a right answer
 * when it is due moves it to the next REVIEW_DAYS step, and after the last
 * step it leaves.
 * @param {{due: number, step: number}|undefined} rec - the item's current record
 * @param {boolean} correct
 * @param {number} now
 * @returns {{due: number, step: number}|null|undefined} the new record; null to leave the queue; undefined for no change
 */
function scheduleReviewAnswer(rec, correct, now) {
  if (!correct) return { due: now + REVIEW_RETRY_MS, step: 0 };
  if (!rec || rec.due > now) return undefined;
  if (rec.step >= REVIEW_DAYS.length) return null;
  return { due: now + REVIEW_DAYS[rec.step] * _REVIEW_DAY_MS, step: rec.step + 1 };
}

/**
 * A clean copy of a stored review map: entries with a numeric due, a whole
 * step within 0..REVIEW_DAYS.length and an id `isValidId` accepts.
 * @param {Object} src
 * @param {function(string): boolean} isValidId
 */
function normalizeReviewMap(src, isValidId) {
  var out = {};
  src = src && typeof src === 'object' ? src : {};
  Object.keys(src).forEach(function (id) {
    var rec = src[id] || {};
    if (!isValidId(id)) return;
    if (typeof rec.due !== 'number' || !isFinite(rec.due)) return;
    if (!(rec.step >= 0 && rec.step <= REVIEW_DAYS.length && rec.step % 1 === 0)) return;
    out[id] = { due: rec.due, step: rec.step };
  });
  return out;
}

/** The union of two review maps, each id keeping its less advanced copy (lower step, then earlier due). */
function mergeReviewMaps(a, b) {
  var out = {};
  [a, b].forEach(function (src) {
    Object.keys(src).forEach(function (id) {
      var prev = out[id];
      var rec = src[id];
      if (!prev || rec.step < prev.step || (rec.step === prev.step && rec.due < prev.due)) {
        out[id] = { due: rec.due, step: rec.step };
      }
    });
  });
  return out;
}

/** Ids due at `now`, most overdue first. */
function dueReviewIds(map, now) {
  return Object.keys(map)
    .filter(function (id) { return map[id].due <= now; })
    .sort(function (x, y) { return map[x].due - map[y].due; });
}
