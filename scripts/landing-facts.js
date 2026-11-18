// ═══════════════════════════════════════════════════════════════
// landing-facts.js — fill the landing page from js/data-core/app-facts.js
//
// The landing page is a static page, so build.js fills it while copying
// it to dist/. Marked elements get the current facts:
//   data-fact="wordCount"      the element's text (any getAppFacts() key)
//   data-plan="free"           a <ul>, filled with that plan's lines
//   data-track="qaida"         a track card, shown as live once released
//   data-track-pill="qaida"    a pill, "Available now" once released
// What isn't marked is left exactly as written.
// ═══════════════════════════════════════════════════════════════

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST_INDENT = '              '; // the pricing lists' indent in landing.html
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/** Run the app's data files in a bare context and return getAppFacts() with getPlanLines. */
function loadAppFacts() {
  const { DATA_FILES } = require('../build-files').getBuildFiles();
  const noop = function () {};
  const el = { style: {}, classList: { add: noop, remove: noop }, setAttribute: noop, appendChild: noop };
  const ctx = {
    console: { log: noop, warn: noop, error: console.error, info: noop, debug: noop },
    localStorage: { getItem: function () { return null; }, setItem: noop, removeItem: noop },
    navigator: {},
    document: {
      addEventListener: noop, getElementById: function () { return null; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      createElement: function () { return el; }, head: el, body: el,
    },
    location: { search: '', hash: '', pathname: '/' },
    addEventListener: noop, setTimeout: setTimeout, clearTimeout: clearTimeout,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  DATA_FILES.forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  });
  // The app builds the Foundation Course at startup; do the same here.
  const facts = vm.runInContext('getCanonicalWords(); buildFoundationCourse(); getAppFacts()', ctx);
  facts.planLines = {};
  ['free', 'premium', 'yearly'].forEach(function (plan) {
    facts.planLines[plan] = vm.runInContext('getPlanLines(' + JSON.stringify(plan) + ', false)', ctx);
  });
  return JSON.parse(JSON.stringify(facts)); // plain objects, not the context's
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The landing page with every marked fact filled in.
 * @param {string} html
 * @param {object} facts from loadAppFacts()
 */
function fillLandingFacts(html, facts) {
  html = html.replace(/(<(\w+)[^>]*\sdata-fact="(\w+)"[^>]*>)[^<]*(<\/\2>)/g, function (all, open, tag, key, close) {
    if (!Object.prototype.hasOwnProperty.call(facts, key)) throw new Error('landing.html: unknown fact "' + key + '"');
    return open + escapeHtml(facts[key]) + close;
  });
  html = html.replace(/(<ul[^>]*\sdata-plan="(\w+)"[^>]*>)[\s\S]*?(<\/ul>)/g, function (all, open, plan, close) {
    const lines = facts.planLines[plan];
    if (!lines) throw new Error('landing.html: unknown plan "' + plan + '"');
    const items = lines.map(function (line) { return LIST_INDENT + '  <li>' + CHECK_ICON + escapeHtml(line) + '</li>'; });
    return open + '\n' + items.join('\n') + '\n' + LIST_INDENT + close;
  });
  html = html.replace(/<article([^>]*)\sdata-track="(\w+)"([^>]*)>/g, function (all, before, id, after) {
    if (!facts.tracks[id]) return all;
    return ('<article' + before + ' data-track="' + id + '"' + after + '>').replace('lp-track-soon', 'lp-track-live');
  });
  html = html.replace(/<span([^>]*)\sdata-track-pill="(\w+)"([^>]*)>[^<]*<\/span>/g, function (all, before, id, after) {
    if (!facts.tracks[id]) return all;
    const attrs = (before + ' data-track-pill="' + id + '"' + after).replace(/class="lp-pill"/, 'class="lp-pill lp-pill-live"');
    return '<span' + attrs + '>Available now</span>';
  });
  return html;
}

module.exports = { loadAppFacts, fillLandingFacts };
