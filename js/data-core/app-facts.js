// ═══════════════════════════════════════════════════════════════
// app-facts.js — what Bayan says about itself, stated once
//
// Prices, the free plan's limits and what each plan includes live here.
// Word, root and Foundation counts are worked out from the word data, and
// track status comes from isTrackReleased (tracks.js). The code that
// enforces a limit reads it from APP_FACTS, the in-app plan picker
// renders these lines, and the build fills the landing page from them
// (scripts/landing-facts.js), so a change here reaches every place.
//
// Monthly and Yearly unlock the same features (premium.js hasFeature does
// not look at the plan), so Yearly only adds the saving.
// ═══════════════════════════════════════════════════════════════

var APP_FACTS = {
  // Set in the Polar dashboard; change both places together.
  prices: { monthly: 2.99, yearly: 19.99 },
  limits: {
    freeWords: 303,          // the most frequent canonical words (vocabulary.js)
    bookmarks: 20,           // free bookmarks (vocabulary.js)
    tafsirPerDay: 5,         // free tafsir notes a day (user-service.js)
    reviewsPerDayMax: 100,   // highest daily review setting (profile-ui.js)
  },
};

// {placeholders} are filled from getAppFacts(). `brief` lines also show in
// the in-app plan picker; `track` lines show only while that track is live.
var PLAN_LINES = {
  free: [
    { text: 'The Foundation Course: the {foundationWords} most frequent words', brief: true },
    { text: 'The {freeWords} most frequent Quranic words in full detail', brief: true },
    { text: 'Read Arabic from zero: the letters and marks', track: 'qaida', brief: true },
    { text: 'Tajweed: recite with correct pronunciation', track: 'tajweed' },
    { text: 'Quran reader with word meanings and Al-Husary’s recitation' },
    { text: 'Today’s ayah and the Quran map' },
    { text: 'Placement tests, quizzes and practice drills' },
    { text: 'Up to {reviewsPerDayMax} reviews a day, {bookmarks} bookmarks and {tafsirPerDay} tafsir notes a day' },
  ],
  premium: [
    { text: 'Everything in Free', brief: true },
    { text: 'All {wordCount} Quranic words across {rootCount} root families', brief: true },
    { text: 'Guided reading, surah by surah', brief: true },
    { text: 'Full word relationships', brief: true },
    { text: 'Unlimited reviews, bookmarks and tafsir', brief: true },
    { text: 'Detailed progress insights' },
    { text: 'Cloud sync across devices', brief: true },
    { text: 'Back up and restore your progress' },
  ],
  yearly: [
    { text: 'Everything in Monthly', brief: true },
    { text: 'About {yearlyMonthsFree} months free compared with monthly', brief: true },
  ],
};

/** "$2.99" */
function formatPrice(amount) {
  return '$' + amount.toFixed(2);
}

/** 1314 → "1,314" */
function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Distinct root families among the given words (spacing and dashes ignored). */
function countRootFamilies(words) {
  var seen = {};
  var count = 0;
  (words || []).forEach(function (w) {
    var root = String((w && w.root) || '').replace(/[\s\-ـ]/g, '');
    if (!root || /^[—–]+$/.test(root) || seen[root]) return;
    seen[root] = true;
    count++;
  });
  return count;
}

/** Whole months a year of Yearly saves against twelve months of Monthly. */
function yearlyMonthsFree(prices) {
  return Math.floor((prices.monthly * 12 - prices.yearly) / prices.monthly);
}

/** Every fact the app states about itself, worked out now. */
function getAppFacts() {
  var words = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  var foundation = typeof getAllFoundationWords === 'function' ? getAllFoundationWords() : [];
  var released = typeof isTrackReleased === 'function' ? isTrackReleased : function () { return false; };
  var L = APP_FACTS.limits;
  return {
    monthlyPrice: formatPrice(APP_FACTS.prices.monthly),
    yearlyPrice: formatPrice(APP_FACTS.prices.yearly),
    yearlyMonthsFree: yearlyMonthsFree(APP_FACTS.prices),
    wordCount: formatCount(words.length),
    rootCount: formatCount(countRootFamilies(words)),
    foundationWords: formatCount(foundation.length),
    freeWords: formatCount(L.freeWords),
    bookmarks: L.bookmarks,
    tafsirPerDay: L.tafsirPerDay,
    reviewsPerDayMax: L.reviewsPerDayMax,
    tracks: { qaida: !!released('qaida'), tajweed: !!released('tajweed') },
  };
}

/**
 * The lines a plan lists, filled in.
 * @param {'free'|'premium'|'yearly'} plan
 * @param {boolean} [brief] only the lines the in-app plan picker shows
 * @param {object} [facts] from getAppFacts() (worked out when omitted)
 * @returns {string[]}
 */
function getPlanLines(plan, brief, facts) {
  facts = facts || getAppFacts();
  return (PLAN_LINES[plan] || []).filter(function (line) {
    if (brief && !line.brief) return false;
    return !line.track || facts.tracks[line.track];
  }).map(function (line) {
    return line.text.replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(facts, name) ? String(facts[name]) : match;
    });
  });
}
