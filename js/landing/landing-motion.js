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
//   • Hero card: tap a word of Al-Fatihah 1:5 for its meaning and root
//   • Header: solid background once the page scrolls
//   • [data-reveal]: fade/rise in on first view
//   • Statement: words light up with scroll progress
//   • How it works: sticky phone frame follows the active step
//   • Timeline: still, marked up to the stage being built now
//   • Progress: example ring and counter
//   • Try it: "Spot the word" demo and the root family
//   • Golden lines: run down the whole page and meet behind the verse
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

  // Timeline: still. The first TIMELINE_REACHED stages ("Available now"
  // and "Next") are marked, and the beam runs from the top to the last of
  // them, so it shows where the roadmap stands rather than moving with
  // the scroll (the golden lines already do that).
  var TIMELINE_REACHED = 2;
  function initTimeline() {
    var tl = $('.lp-timeline');
    if (!tl) return;
    var beam = $('.lp-tl-beam', tl);
    var stops = $all('.lp-tl-item', tl);
    var last = stops[Math.min(TIMELINE_REACHED, stops.length) - 1];
    stops.forEach(function (s, i) { s.classList.toggle('is-reached', i < TIMELINE_REACHED); });
    function place() {
      var line = tl.getBoundingClientRect();
      var reach = last ? (last.getBoundingClientRect().top - line.top + 14) / Math.max(1, line.height) : 0;
      beam.style.setProperty('--reach', clamp(reach, 0, 1).toFixed(4));
    }
    place();
    window.addEventListener('resize', place);
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
      var DURATION = 900;
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

  // ── Hero card: tap a word of 1:5 to see its meaning and root ───
  function initHeroCard() {
    var card = $('.lp-hc');
    if (!card) return;
    var words = $all('.lp-hc-w', card);
    words.forEach(function (btn) {
      btn.addEventListener('click', function () {
        words.forEach(function (w) {
          var on = w === btn;
          w.classList.toggle('is-on', on);
          w.setAttribute('aria-pressed', on ? 'true' : 'false');
          document.getElementById(w.getAttribute('aria-controls')).hidden = !on;
        });
      });
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

  // ── Golden lines through the page ──────────────────────────────
  // A ribbon of curves like the hero's: it enters from the left edge low
  // in the hero (fading in where the hero's own lines fade out), swings
  // across the page behind every section, leaving and re-entering at the
  // edges so no line starts or ends in view, then opens into a fan that
  // converges on the light behind the closing verse and fades into it.
  // Each line is one path per section, so only sections on screen animate
  // (gold light drifting along them), and sections with motion of their
  // own get a quieter ribbon. Each line also brightens from the top down
  // to the reader's position; when that reaches the verse, the verse
  // lights up. With reduced motion the ribbon is drawn, still.
  var FLOW_LINES = narrow ? 5 : 8;
  var FLOW_STEP = narrow ? 160 : 120;   // px between the points each line passes through
  var FLOW_SPREAD = 900;                // px over which the ribbon opens into a fan
  var FLOW_TUCK = 320;                  // px above the closing section by which the fan is open (behind the pricing cards)
  var FLOW_PULSE = 70;                  // px of each drifting pulse of light
  var FLOW_PULSE_GAP = 280;             // px between pulses
  var FLOW_PULSE_SPEED = 55;            // px per second
  var FLOW_READ_LINE = 0.55;            // share of the viewport height the light follows
  var flowState = null;                 // { pieces, targetY, groups, sections, main }
  var flowPlaysVerse = false;

  // Smooth curve through points (Catmull-Rom as cubic Béziers): the 'C'
  // command for each span, with the span's start and end heights.
  function flowSpans(pts) {
    var spans = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      spans.push({
        from: p1, y0: p1.y, y1: p2.y, len: Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)),
        c: 'C' + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(1) + ' ' +
          (p2.x - (p3.x - p1.x) / 6).toFixed(1) + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(1) + ' ' +
          p2.x.toFixed(1) + ' ' + p2.y.toFixed(1),
      });
    }
    return spans;
  }

  // A gold gradient in page coordinates along one axis: stops are [offset, opacity].
  function flowFade(id, axis, from, to, stops) {
    var grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute(axis + '1', String(from)); grad.setAttribute(axis + '2', String(to));
    grad.setAttribute((axis === 'x' ? 'y' : 'x') + '1', '0'); grad.setAttribute((axis === 'x' ? 'y' : 'x') + '2', '0');
    stops.forEach(function (st) {
      var stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', String(st[0]));
      stop.setAttribute('style', 'stop-color: var(--gold); stop-opacity: ' + st[1]);
      grad.appendChild(stop);
    });
    return grad;
  }

  function flowPath(cls, d, extra) {
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    if (extra) extra(p);
    return p;
  }

  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // Where line k of the ribbon sits at height y.
  function ribbonX(k, y, geo) {
    var share = (k - (FLOW_LINES - 1) / 2) / ((FLOW_LINES - 1) / 2);   // -1 .. 1 across the ribbon
    // One swing across and back per period; the amplitude carries the
    // ribbon past both edges, and the phase starts it off the left one.
    var x = geo.w / 2 + share * geo.gap * (FLOW_LINES - 1) / 2 +
      geo.w * (0.6 + 0.03 * k) * Math.sin(((y - geo.y0) / geo.period) * Math.PI * 2 - Math.PI / 2 + k * 0.05);
    // Behind the pricing cards the ribbon opens into a wide fan; from just
    // above the closing section the fan closes on the verse from both
    // sides, the way its rays open out.
    var fanWidth = Math.min(geo.w * 0.42, 620);
    var fanTop = geo.fanTop;
    var open = smoothstep((y - (fanTop - FLOW_SPREAD)) / FLOW_SPREAD);
    var close = clamp((y - fanTop) / (geo.target.y - fanTop), 0, 1);
    var fan = geo.target.x + share * fanWidth * Math.pow(1 - close, 1.35);
    return x * (1 - open) + fan * open;
  }

  function buildFlow(svg, main) {
    var mainBox = main.getBoundingClientRect();
    var light = $('.lp-closing-light');
    var sections = $all(':scope > section', main);
    if (!light || sections.length < 3) return null;
    var w = main.clientWidth, h = main.clientHeight;
    var lb = light.getBoundingClientRect();
    var tops = sections.map(function (sec) { return sec.getBoundingClientRect().top - mainBox.top; });
    var geo = {
      w: w,
      gap: narrow ? 14 : 26,
      y0: sections[0].getBoundingClientRect().height * 0.55,
      period: Math.max(1700, window.innerHeight * 2.1),
      target: { x: lb.left - mainBox.left, y: lb.top - mainBox.top },
      fanTop: tops[tops.length - 1] - FLOW_TUCK,
    };

    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = document.createElementNS(SVG_NS, 'defs');
    // Fade in low in the hero; fade into the verse's light at the end; in
    // between, full strength in the side margins and faint behind the
    // content column, so the lines never compete with text.
    var col = Math.max(24, (w - 1120) / 2 + 24);
    defs.appendChild(flowFade('lp-flow-in', 'y', geo.y0, geo.y0 + 360, [[0, 0], [1, 1]]));
    defs.appendChild(flowFade('lp-flow-out', 'y', geo.fanTop, geo.target.y, [[0, 1], [0.6, 1], [1, 0]]));
    defs.appendChild(flowFade('lp-flow-side', 'x', 0, w, [
      [0, 1], [clamp((col - 70) / w, 0, 0.5), 1], [clamp((col + 50) / w, 0, 0.5), 0.13],
      [clamp(1 - (col + 50) / w, 0.5, 1), 0.13], [clamp(1 - (col - 70) / w, 0.5, 1), 1], [1, 1],
    ]));
    svg.appendChild(defs);
    var groups = sections.map(function (sec) {
      var g = document.createElementNS(SVG_NS, 'g');
      // Quieter where the section has motion of its own.
      if (sec.classList.contains('lp-statement') || sec.id === 'soon') g.setAttribute('class', 'is-quiet');
      svg.appendChild(g);
      return g;
    });
    // The fan belongs to the closing section from where it opens, behind
    // the pricing cards, so its change of strength is hidden by them.
    function sectionIndex(y) {
      if (y >= geo.fanTop) return tops.length - 1;
      for (var i = tops.length - 1; i >= 0; i--) if (y >= tops[i]) return i;
      return 0;
    }

    var pieces = [];
    for (var k = 0; k < FLOW_LINES; k++) {
      var pts = [];
      for (var y = geo.y0; y < geo.target.y; y += FLOW_STEP) pts.push({ x: ribbonX(k, y, geo), y: y });
      pts.push({ x: geo.target.x, y: geo.target.y });
      // One path per section: join the spans whose middle falls in it.
      var bySection = {};
      flowSpans(pts).forEach(function (span) {
        var i = sectionIndex((span.y0 + span.y1) / 2);
        var run = bySection[i] || (bySection[i] = { d: 'M' + span.from.x.toFixed(1) + ' ' + span.from.y.toFixed(1), y0: span.y0, y1: span.y1, len: 0 });
        run.d += span.c;
        run.y1 = span.y1;
        run.len += span.len;
      });
      Object.keys(bySection).forEach(function (key) {
        var i = Number(key), run = bySection[key];
        var fade = i === 0 ? 'url(#lp-flow-in)' : i === sections.length - 1 ? 'url(#lp-flow-out)' : 'url(#lp-flow-side)';
        function styled(p) {
          if (fade) p.style.stroke = fade;
          p.setAttribute('stroke-width', ((narrow ? 0.8 : 1) + k * 0.11).toFixed(2));
          return p;
        }
        groups[i].appendChild(styled(flowPath('lp-flow-base', run.d)));
        // Pulses sized in pixels, so they look the same on long and short pieces.
        var len = Math.max(1, run.len);
        var dur = len / FLOW_PULSE_SPEED;
        groups[i].appendChild(styled(flowPath('lp-flow-drift', run.d, function (p) {
          p.style.strokeDasharray = (FLOW_PULSE / len).toFixed(4) + ' ' + (FLOW_PULSE_GAP / len).toFixed(4);
          p.style.setProperty('--dur', dur.toFixed(1) + 's');
          p.style.setProperty('--delay', '-' + (((k * 0.37 + i * 0.21) % 1) * dur).toFixed(1) + 's');
        })));
        var lit = styled(flowPath('lp-flow-lit', run.d));
        groups[i].appendChild(lit);
        pieces.push({ el: lit, y0: run.y0, y1: run.y1, f: -1 });
      });
    }
    return { pieces: pieces, targetY: geo.target.y, groups: groups, sections: sections };
  }

  function updateFlow() {
    if (!flowState) return;
    var main = flowState.main;
    var line = window.innerHeight * FLOW_READ_LINE - main.getBoundingClientRect().top;
    for (var i = 0; i < flowState.pieces.length; i++) {
      var piece = flowState.pieces[i];
      var f = clamp((line - piece.y0) / Math.max(1, piece.y1 - piece.y0), 0, 1);
      f = Math.round(f * 200) / 200;
      if (f === piece.f) continue;
      piece.f = f;
      piece.el.style.strokeDashoffset = String(1 - f);
    }
    if (flowPlaysVerse && line >= flowState.targetY) {
      var closing = $('.lp-closing');
      if (closing) closing.classList.add('is-playing');
      flowPlaysVerse = false;
    }
  }

  function initFlow() {
    var main = $('main');
    if (!main || !document.createElementNS) return;
    var host = document.createElement('div');
    host.className = 'lp-flow';
    host.setAttribute('aria-hidden', 'true');
    var svg = document.createElementNS(SVG_NS, 'svg');
    host.appendChild(svg);
    main.insertBefore(host, main.firstChild);

    var io = null;
    function build() {
      var built = buildFlow(svg, main);
      if (!built) return;
      built.main = main;
      flowState = built;
      if (reduceMotion || !('IntersectionObserver' in window)) {
        host.classList.add('is-still');
        return;
      }
      // Animate only the pieces beside sections that are on screen.
      if (io) io.disconnect();
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var g = built.groups[built.sections.indexOf(entry.target)];
          if (g) g.classList.toggle('is-live', entry.isIntersecting);
        });
      }, { rootMargin: '25% 0px' });
      built.sections.forEach(function (s) { io.observe(s); });
      updateFlow();
    }

    build();
    if (!flowState) return;
    if (!reduceMotion) {
      flowPlaysVerse = true;
      scrollTasks.push(updateFlow);
    }
    // Rebuild when the layout changes (resize, fonts, images).
    var timer = null;
    var lastW = main.clientWidth, lastH = main.clientHeight;
    function rebuildSoon() {
      if (main.clientWidth === lastW && main.clientHeight === lastH) return;
      lastW = main.clientWidth; lastH = main.clientHeight;
      clearTimeout(timer);
      timer = setTimeout(build, 150);
    }
    if ('ResizeObserver' in window) new ResizeObserver(rebuildSoon).observe(main);
    else window.addEventListener('resize', rebuildSoon);
  }

  // ── Closing verse ──────────────────────────────────────────────
  // Al-Qamar 54:17 lights up word by word (timing in CSS), once: when the
  // golden lines reach it, or (without them) when most of it is in view.
  // Its rays pause while it is off screen.
  function initClosingVerse() {
    var section = $('.lp-closing');
    var words = section && $('.lp-verse-words', section);
    if (!words || reduceMotion || !('IntersectionObserver' in window)) return;
    section.classList.add('is-armed');
    if (flowPlaysVerse) updateFlow();
    else {
      var play = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        section.classList.add('is-playing');
        play.disconnect();
      }, { threshold: 0.6 });
      play.observe(words);
    }
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
    initHeroCard();
    initSpotDemo();
    initRootFamily();
    initSpotlight();
    initFlow();
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
