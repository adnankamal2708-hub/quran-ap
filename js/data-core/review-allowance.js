// ═══════════════════════════════════════════════════════════════
// review-allowance.js — how many reviews the learner has left today
//
// Each plan has a daily cap (APP_FACTS.limits.reviewsPerDay): Free 10,
// Monthly 100, Yearly none. srs.js counts a review here each time a word
// that was due is rated, and the review queues show no more due words
// than are left. The count is per device and starts again each day.
// ═══════════════════════════════════════════════════════════════

var REVIEWS_TODAY_KEY = 'quran_reviews_today';

/** 'free', 'monthly' or 'yearly' (premium.js knows the plan). */
function currentReviewPlan() {
  var premium = typeof window !== 'undefined' ? window.__premium : null;
  return premium && typeof premium.getPlan === 'function' ? premium.getPlan() : 'free';
}

/** Reviews a day on this plan; Infinity when there is no limit. */
function reviewCap(plan) {
  var cap = APP_FACTS.limits.reviewsPerDay[plan];
  if (cap === undefined) cap = APP_FACTS.limits.reviewsPerDay.free;
  return cap === null ? Infinity : cap;
}

/** Highest daily goal the settings allow: the cap, and never above Monthly's. */
function reviewGoalMax(plan) {
  return Math.min(reviewCap(plan), APP_FACTS.limits.reviewsPerDay.monthly);
}

function _reviewDay() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function reviewsDoneToday() {
  try {
    var saved = JSON.parse(localStorage.getItem(REVIEWS_TODAY_KEY) || 'null');
    return saved && saved.day === _reviewDay() ? saved.count || 0 : 0;
  } catch (e) {
    return 0;
  }
}

function recordReviewDone() {
  try {
    localStorage.setItem(REVIEWS_TODAY_KEY, JSON.stringify({ day: _reviewDay(), count: reviewsDoneToday() + 1 }));
  } catch (e) { /* storage full or blocked: the count is a soft limit */ }
}

/** Reviews left today on the current plan (Infinity on Yearly). */
function reviewsLeftToday() {
  return Math.max(0, reviewCap(currentReviewPlan()) - reviewsDoneToday());
}
