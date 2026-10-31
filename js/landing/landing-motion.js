// ═══════════════════════════════════════════════════════════════
// landing-motion.js — Landing page motion and small interactions
//
// Everything here is progressive enhancement: the page reads fully
// without it, and with prefers-reduced-motion every effect shows its
// final state at once. Only transform/opacity are animated, scroll work
// is batched into one requestAnimationFrame, and the hero paths pause
// while off screen or while the tab is hidden.
//
//   • Hero: flowing background paths (drawn here, animated in CSS)
//   • Header: solid background once the page scrolls
//   • [data-reveal]: fade/rise in on first view
//   • Statement: words light up with scroll progress
//   • How it works: sticky phone frame follows the active step
//   • Timeline: gold beam fills with scroll progress
//   • Progress: example ring and counter
//   • Try it: "Spot the word" demo and the root family
//   • Closing: Al-Qamar 54:17 lights up word by word
//
// Outside the app bundle; only the landing page loads it.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  // ── Hero background paths ──────────────────────────────────────
  // Two mirrored fans of thin curves (after Kokonut UI's Background
  // Paths). Each path draws a short gold dash that drifts along it.
  var PATHS_PER_SIDE = narrow ? 12 : 22;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function buildPaths(svg, position) {
    for (var i = 0; i < PATHS_PER_SIDE; i++) {
      var s = i * 1.6;
      var x = 5 * position * s;
      var d = 'M-' + (380 - x) + ' -' + (189 + 6 * s) +
        'C-' + (380 - x) + ' -' + (189 + 6 * s) + ' -' + (312 - x) + ' ' + (216 - 6 * s) + ' ' + (152 - x) + ' ' + (343 - 6 * s) +
        'C' + (616 - x) + ' ' + (470 - 6 * s) + ' ' + (684 - x) + ' ' + (875 - 6 * s) + ' ' + (684 - x) + ' ' + (875 - 6 * s);
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('pathLength', '1');
      p.setAttribute('stroke-width', (0.5 + i * 0.045).toFixed(2));
      p.style.setProperty('--o', (0.08 + i * 0.022).toFixed(3));
      p.style.setProperty('--dur', (22 + ((i * 7) % 11)) + 's');
      p.style.setProperty('--delay', '-' + ((i * 3.7) % 20).toFixed(1) + 's');
      svg.appendChild(p);
    }
  }

  function initHeroPaths() {
    var host = $('.lp-paths');
    if (!host) return;
    $all('svg', host).forEach(function (svg, idx) { buildPaths(svg, idx === 0 ? 1 : -1); });
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    // Pause the drift while the hero is off screen or the tab is hidden.
    var visible = true;
    function sync() { host.classList.toggle('is-paused', !visible || document.hidden); }
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(host);
    document.addEventListener('visibilitychange', sync);
  }

  // ── Header ─────────────────────────────────────────────────────
  function initHeader() {
    var header = $('.lp-header');
    var sentinel = $('.lp-top-sentinel');
    if (!header || !sentinel || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  // ── Reveal on first view ───────────────────────────────────────
  function initReveal() {
    var els = $all('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ── Scroll-linked effects (one rAF per frame) ──────────────────
  var scrollTasks = [];
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      for (var i = 0; i < scrollTasks.length; i++) scrollTasks[i]();
    });
  }

  /** 0 → 1 as `el` travels through the viewport between the two anchors. */
  function progressThrough(el, startAt, endAt) {
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var start = vh * startAt;
    var total = rect.height + vh * (startAt - endAt);
    return clamp((start - rect.top) / total, 0, 1);
  }

  // Statement: words brighten in reading order, a few at a time so the
  // light moves as a soft gradient. It starts just before the paragraph
  // pins and finishes with a third of the pinned scroll to spare, so the
  // whole sentence can be read before it moves on.
  var STATEMENT_SPREAD = 4;          // words fading in at once
  var STATEMENT_FINISH = 0.65;       // share of the pinned scroll used
  function initStatement() {
    var block = $('.lp-statement');
    if (!block) return;
    var text = $('.lp-statement-text', block);
    var words = text.textContent.trim().split(/\s+/);
    text.textContent = '';
    var spans = words.map(function (w, i) {
      var span = document.createElement('span');
      span.className = 'lp-sw';
      span.textContent = w;
      text.appendChild(span);
      if (i < words.length - 1) text.appendChild(document.createTextNode(' '));
      return span;
    });
    if (reduceMotion) { block.classList.add('is-static'); return; }
    var last = -1;
    var levels = spans.map(function () { return 0; });
    scrollTasks.push(function () {
      var rect = block.getBoundingClientRect();
      var vh = window.innerHeight;
      var lead = vh * 0.35;
      var travel = Math.max(rect.height - vh, 1) * STATEMENT_FINISH;
      var p = clamp((lead - rect.top) / (lead + travel), 0, 1);
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      var head = p * (spans.length + STATEMENT_SPREAD);
      for (var i = 0; i < spans.length; i++) {
        var a = Math.round(clamp((head - i) / STATEMENT_SPREAD, 0, 1) * 50) / 50;
        if (a === levels[i]) continue;
        levels[i] = a;
        spans[i].style.setProperty('--a', a);
        spans[i].classList.toggle('is-lit', a === 1);
      }
    });
  }

  // Timeline: the beam grows with scroll; each stop lights when reached.
  function initTimeline() {
    var tl = $('.lp-timeline');
    if (!tl) return;
    var beam = $('.lp-tl-beam', tl);
    var stops = $all('.lp-tl-item', tl);
    if (reduceMotion) {
      beam.style.transform = 'scaleY(1)';
      stops.forEach(function (s) { s.classList.add('is-reached'); });
      return;
    }
    scrollTasks.push(function () {
      var p = progressThrough(tl, 0.6, 0.6);
      beam.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      var line = tl.getBoundingClientRect();
      stops.forEach(function (s) {
        var r = s.getBoundingClientRect();
        var reached = (r.top - line.top + 14) <= p * line.height;
        s.classList.toggle('is-reached', reached);
      });
    });
  }

  // ── How it works: sticky phone follows the step in view ─────────
  function initSteps() {
    var steps = $all('.lp-step');
    var shots = $all('.lp-phone-shot');
    if (!steps.length || !shots.length) return;
    function activate(idx) {
      steps.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
      shots.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
    }
    activate(0);
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) activate(steps.indexOf(entry.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }

  // ── Progress example: ring + counter, once ─────────────────────
  function initProgress() {
    var box = $('.lp-ring');
    if (!box) return;
    var target = parseFloat(box.getAttribute('data-value')) || 0;
    var num = $('.lp-ring-num', box);
    function finish() { box.classList.add('is-in'); num.textContent = target.toFixed(1); }
    if (reduceMotion || !('IntersectionObserver' in window)) { finish(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      box.classList.add('is-in');
      var t0 = null;
      var DURATION = 1600;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = clamp((ts - t0) / DURATION, 0, 1);
        var eased = 1 - Math.pow(1 - k, 3);
        num.textContent = (target * eased).toFixed(1);
        if (k < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(box);
  }

  /** Fill `el` with text and Arabic runs: parts are strings or { ar: '…' }. */
  function setMixed(el, parts) {
    el.textContent = '';
    parts.forEach(function (part) {
      if (typeof part === 'string') { el.appendChild(document.createTextNode(part)); return; }
      var span = document.createElement('span');
      span.lang = 'ar';
      span.dir = 'rtl';
      span.textContent = part.ar;
      el.appendChild(span);
    });
  }

  // ── Try it: Spot the word ──────────────────────────────────────
  function initSpotDemo() {
    var demo = $('.lp-spot');
    if (!demo) return;
    var prompt = $('.lp-spot-meaning', demo);
    var feedback = $('.lp-spot-feedback', demo);
    var tokens = $all('.lp-spot-word', demo);
    var questions = [];
    tokens.forEach(function (t, i) { questions.push({ meaning: t.getAttribute('data-meaning'), index: i }); });
    var order = [2, 0, 3, 1];
    var q = 0;
    var locked = false;
    function ask() {
      var current = questions[order[q % order.length]];
      prompt.textContent = current.meaning;
      feedback.textContent = '';
      feedback.className = 'lp-spot-feedback';
      tokens.forEach(function (t) { t.classList.remove('is-right', 'is-wrong'); t.disabled = false; });
      locked = false;
    }
    tokens.forEach(function (t, i) {
      t.addEventListener('click', function () {
        if (locked) return;
        var current = questions[order[q % order.length]];
        if (i === current.index) {
          locked = true;
          tokens.forEach(function (o) { o.classList.remove('is-wrong'); });
          t.classList.add('is-right');
          setMixed(feedback, ['Correct: ', { ar: t.textContent.trim() }, ' means “' + current.meaning + '”.']);
          feedback.className = 'lp-spot-feedback is-right';
          tokens.forEach(function (o) { o.disabled = true; });
          window.setTimeout(function () { q++; ask(); }, 1900);
        } else {
          t.classList.remove('is-wrong');
          // Restart the shake on repeated wrong taps.
          void t.offsetWidth;
          t.classList.add('is-wrong');
          feedback.textContent = 'Not quite — try another word.';
          feedback.className = 'lp-spot-feedback';
        }
      });
    });
    ask();
  }

  // ── Try it: root family ────────────────────────────────────────
  function initRootFamily() {
    var fam = $('.lp-family');
    if (!fam) return;
    var branches = $all('.lp-branch', fam);
    var lines = $all('.lp-family-lines path', fam);
    var detail = $('.lp-family-detail', fam);
    function select(i) {
      branches.forEach(function (b, j) {
        b.classList.toggle('is-active', i === j);
        b.setAttribute('aria-pressed', i === j ? 'true' : 'false');
      });
      lines.forEach(function (l, j) { l.classList.toggle('is-active', i === j); });
      var b = branches[i];
      setMixed(detail, [
        { ar: $('.ar', b).textContent }, ' ' + $('.en', b).textContent + ': ' + b.getAttribute('data-note') + ', on the pattern ',
        { ar: b.getAttribute('data-pattern') },
      ]);
    }
    branches.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('mouseenter', function () { select(i); });
      b.addEventListener('focus', function () { select(i); });
    });
    select(0);
  }

  // ── Cards: soft light that follows the pointer ─────────────────
  function initSpotlight() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $all('.lp-glow').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // ── Closing verse ──────────────────────────────────────────────
  // Al-Qamar 54:17 lights up word by word (timing in CSS), once, when
  // most of the verse is in view. Its rays pause while it is off screen.
  function initClosingVerse() {
    var section = $('.lp-closing');
    var words = section && $('.lp-verse-words', section);
    if (!words || reduceMotion || !('IntersectionObserver' in window)) return;
    section.classList.add('is-armed');
    var play = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      section.classList.add('is-playing');
      play.disconnect();
    }, { threshold: 0.6 });
    play.observe(words);
    new IntersectionObserver(function (entries) {
      section.classList.toggle('is-offscreen', !entries[0].isIntersecting);
    }).observe(section);
  }

  function init() {
    if (reduceMotion) root.classList.add('lp-reduced');
    initHeroPaths();
    initHeader();
    initReveal();
    initStatement();
    initTimeline();
    initSteps();
    initProgress();
    initSpotDemo();
    initRootFamily();
    initSpotlight();
    initClosingVerse();
    if (scrollTasks.length) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
