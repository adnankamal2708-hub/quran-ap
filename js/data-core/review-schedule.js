// ── Review schedule shared by the Qaida and Tajweed tracks ───────
// Pure functions over a review map { <id>: { due, step } }: a missed
// item comes back soon, then each right answer spaces it further out
// until it leaves the queue. The tracks own the storage; this owns the
// timing, and the cleared map that keeps a left entry from coming back.

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

// ── Entries that left the queue ─────────────────────────────────
// Cloud uploads merge into the stored document and never delete a nested
// key, so a deleted review entry would come back from the cloud's older
// copy. Each track keeps a `cleared` map { <id>: <time it left> } instead,
// and a record scheduled at or before that time is dropped; a later miss
// schedules a newer record, which stays.

/** When a record was scheduled: its due time less the wait its step was given. */
function reviewScheduledAt(rec) {
  return rec.due - (rec.step === 0 ? REVIEW_RETRY_MS : REVIEW_DAYS[rec.step - 1] * _REVIEW_DAY_MS);
}

/** A clean copy of a stored cleared map: finite times under ids `isValidId` accepts. */
function normalizeClearedMap(src, isValidId) {
  var out = {};
  src = src && typeof src === 'object' ? src : {};
  Object.keys(src).forEach(function (id) {
    if (isValidId(id) && typeof src[id] === 'number' && isFinite(src[id])) out[id] = src[id];
  });
  return out;
}

/** The union of two cleared maps, each id keeping its later time. */
function mergeClearedMaps(a, b) {
  var out = {};
  [a, b].forEach(function (src) {
    Object.keys(src).forEach(function (id) {
      if (!(out[id] >= src[id])) out[id] = src[id];
    });
  });
  return out;
}

/** A copy of a review map without the records scheduled at or before their id was cleared. */
function dropClearedReviews(review, cleared) {
  var out = {};
  Object.keys(review).forEach(function (id) {
    if (!(cleared[id] >= reviewScheduledAt(review[id]))) out[id] = review[id];
  });
  return out;
}

/** Ids due at `now`, most overdue first. */
function dueReviewIds(map, now) {
  return Object.keys(map)
    .filter(function (id) { return map[id].due <= now; })
    .sort(function (x, y) { return map[x].due - map[y].due; });
}
