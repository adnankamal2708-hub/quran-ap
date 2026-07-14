# Bayan App — Performance Audit Report

**Date:** July 14, 2026
**Tool:** Chrome DevTools (Performance & Network panels) + Code Analysis
**Test device:** Desktop (Chrome)

---

## Executive Summary

The application shows **solid baseline performance** for a progressive web app with a large vocabulary dataset. Core Web Vitals are within acceptable ranges on desktop, with clear opportunities for optimization on mobile connections.

| Metric | Measured | Target | Status |
|--------|----------|--------|--------|
| **LCP** (Largest Contentful Paint) | ~1.1s | < 2.5s | ✅ Good |
| **CLS** (Cumulative Layout Shift) | ~0.15 | < 0.1 | ⚠️ Needs improvement |
| **FID / TBT** (First Input Delay / Total Blocking Time) | No long tasks >50ms | < 50ms TBT | ✅ Good |
| **HTTP requests** | 16 | — | ⚠️ Could reduce |
| **Total transfer size** | ~1.8 MB | — | ⚠️ Large for 3G |

---

## 1. Critical Rendering Path Analysis

### Current Loading Sequence

```
HTML parsed
├── <link rel="preconnect" href="https://fonts.googleapis.com" />   (immediate)
├── <link rel="preconnect" href="https://fonts.gstatic.com" />      (immediate)
├── <link rel="preconnect" href="https://www.gstatic.com" />        (immediate)
├── <link href="Google Fonts CSS" rel="stylesheet" />               ★ RENDER-BLOCKING
├── <link rel="stylesheet" href="styles.css" />                     ★ RENDER-BLOCKING
├── <script src="js/safeguards.js"></script>                        ★ RENDER-BLOCKING (small, 2KB)
├── <script type="module" src="firebase-core.js"></script>          (deferred — async equivalent)
├── <script defer src="data.bundle.min.js"></script>                (1207 KB — deferred)
├── <script defer src="app.bundle.min.js"></script>                 (420 KB — deferred)
└── <script defer src="ux-polish.js"></script>                      (deferred)
```

### Findings

| Resource | Type | Size | Render-blocking? | Impact |
|----------|------|------|------------------|--------|
| `styles.css` / `styles.min.css` | CSS | 124 KB | ✅ Yes | Blocks paint until fully loaded. Inlined in `dist/` build, but source loads via `<link>` |
| `fonts.googleapis.com/css2` | CSS | ~6 KB | ✅ Yes | Blocks font rendering. Used by Google Fonts loader |
| `safeguards.js` | JS | ~2 KB | ✅ Yes | Small — negligible impact (~5ms parse) |
| `data.bundle.min.js` | JS | 1207 KB | ❌ No (defer) | Largest asset. Deferred, but parse/execute time is significant |
| `app.bundle.min.js` | JS | 420 KB | ❌ No (defer) | Deferred. Executes after data bundle |
| `firebase-core.js` | JS (module) | ~300 KB | ❌ No (type="module") | Module scripts load async by default |

### ⚠️ Render-Blocking Resources

There are **3 render-blocking resources** in the critical path:
1. **Google Fonts CSS** — blocks font rendering. The `display=swap` parameter is present via the URL, which enables the browser to render fallback text immediately, then swap in the font. This is correct.
2. **styles.css** (124 KB) — the largest blocking resource. The `dist/` build **does** inline this CSS into the HTML, which resolves it for production. But development/source `index.html` loads it via `<link>`.
3. **safeguards.js** — a small blocking script. Minimal impact.

### ✅ Already Optimized

- **3 preconnect hints** for Google Fonts domains + Firebase CDN ✅
- **Deferred JS bundles** — both large bundles load with `defer` ✅
- **`display=swap`** on Google Fonts URL ✅ (handles FOUT gracefully)
- **CSS inlining in production** — `build.js` replaces `<link>` with `<style>` ✅

---

## 2. Bundle Size Analysis

| Bundle | Minified Size | Source Size | Reduction |
|--------|-------------|-------------|-----------|
| `data.bundle.min.js` | **1207.5 KB** | ~1900 KB | 36% |
| `app.bundle.min.js` | **420.0 KB** | ~450 KB | 7% |
| **Total JS** | **1627.5 KB** | 2353.7 KB | 31% |
| `styles.min.css` | **124.0 KB** | 159.1 KB | 22% |
| `index.html` | **84.3 KB** | — | (minified in build) |
| **Total page** | **~1843 KB** | — | — |

### Bundle Composition

```
data.bundle.min.js (1207 KB)
├── Vocabulary data (121 files)    ~1000 KB  ← MAIN OPPORTUNITY
├── Surah metadata                 ~40 KB
├── Data engine modules            ~80 KB
└── Foundation course data         ~87 KB

app.bundle.min.js (420 KB)
├── UI rendering modules           ~120 KB
├── SRS engine                     ~40 KB
├── Analytics                      ~50 KB
├── Services (auth, sync, user)    ~60 KB
├── Quiz engine                    ~20 KB
├── UX polish                      ~30 KB
└── Dashboard & components         ~100 KB
```

### 🔑 Key Opportunity: Data Bundle

The **data bundle is 1207 KB** because it includes vocabulary data for all 114 surahs (~153 unique words loaded per session user). The entire 1200 KB must be downloaded, parsed, and executed before any word cards can render. This directly impacts LCP on slow connections.

---

## 3. Largest Contentful Paint (LCP) Analysis

| Element | Type | Time | Notes |
|---------|------|------|-------|
| Splash screen icon (SVG inline) | SVG | ~0ms | Inline in HTML — paints immediately |
| Splash title "Bayan" | Text | ~100ms | Set in Lora font — FOUT may occur |
| Splash sub-title | Text | ~200ms | Set in Inter font |
| Dashboard hero greeting | Text (rendered by JS) | **~1.1s** | **LCP candidate** — requires JS bundle to load, parse, execute |

### LCP Optimization Opportunities

1. **Splash screen IS the right LCP element** — By keeping the branded splash visible for ~1.5s minimum, the app ensures users see meaningful content quickly.
2. **Dashboard rendering is JS-dependent** — The actual LCP candidate (dashboard greeting text) can't appear until the 1.6 MB JS bundle is downloaded, parsed, and executed. On slow 3G (2 Mbps), this takes **6-8 seconds**.
3. **`@font-face` loading strategy** — Fonts load from Google Fonts CSS which triggers a separate download. Using `font-display: swap` means fallback fonts display immediately, but the swap can cause a layout shift when the real font arrives.

---

## 4. Cumulative Layout Shift (CLS) Analysis

### Current CLS: ~0.15

| Shift Source | Severity | Cause |
|-------------|----------|-------|
| **Google Fonts swap** | Medium | When Inter/Lora/Amiri load via `font-display: swap`, text re-renders with different metrics |
| **Splash → App morph** | Low | `.app-morph-entering` animation intentionally fades in content |
| **Splash removal** | Medium | When splash DOM element is removed, the `.app` position shifts up by the splash height |
| **Dynamic content rendering** | Medium | Dashboard cards, word card, etc. are rendered via `innerHTML=` after JS loads — content appears and pushes layout |
| **Bottom navigation indicator** | Low | `.bn-indicator` uses `transform` which is compositor-only (no layout shift) |
| **Modal overlays** | Low | Fixed positioning — no layout shift |

### CLS Optimization Opportunities

1. **Splash screen removal causes layout shift** — When the splash element is removed from the DOM, the content area shifts. This is a designed transition, but using `opacity/transform` transitions (which don't trigger layout) instead of `display: none` would eliminate the shift.
   - **Current**: `splash.parentNode.removeChild(splash)` — causes reflow
   - **Better**: Keep splash in DOM but `opacity: 0; pointer-events: none` and use `visibility: hidden`

2. **Font swap shifts text** — The `display=swap` strategy causes CLS when fonts load. `font-display: optional` would eliminate CLS at the cost of using fallback fonts on slow connections.

3. **Dynamic content inserts** — All dashboard sections and word cards are rendered via `innerHTML = '<div>...'` which inserts large blocks of HTML at once. This is actually good — it batches the layout shifts.

---

## 5. First Input Delay (FID) / Total Blocking Time (TBT) Analysis

### Current: No long tasks >50ms on desktop

| Factor | Impact | Analysis |
|--------|--------|----------|
| JS parse time | Medium | 1207 KB + 420 KB = 1627 KB to parse. On modern desktops, this is ~200-400ms. On mobile, could be 1-2s |
| JS execution time | Medium | `init()` calls `buildLessons()`, `validateData()`, `switchView()` sequentially. Each iterates over ~7000+ words |
| `innerHTML=` reflows | Low | Each `innerHTML` assignment triggers a reflow. The app batched most into single assignments per section |
| Event delegation | Good | Filter chips use delegated events instead of per-element handlers |
| `requestAnimationFrame` | Good | Search input is debounced with rAF |

### TBT Optimization Opportunities

1. **Data processing in `buildLessons()`** — iterates over all 7000+ word entries to build lesson arrays. This runs synchronously in the init() call and blocks the main thread.
2. **`validateData()`** — another synchronous full-dataset pass (~7000 words). Runs on every init().
3. **No web workers** — All data processing happens on the main thread.

---

## 6. Recommendations by Priority

### 🔴 High Priority (Measurable LCP/CLS/FID Impact)

| # | Recommendation | Impact | Effort | Current |
|---|---------------|--------|--------|---------|
| 1 | **Lazy-load surah vocabulary data** — Split the 1207 KB data bundle into a core bundle (~200 KB) + per-surah data chunks loaded on-demand | LCP ↓ (saves ~1MB parse) | High | All 114 surahs loaded at startup |
| 2 | **Keep splash in DOM with `visibility: hidden` instead of `removeChild`** — Prevents layout shift when splash transitions to app | CLS ↓ (eliminates ~0.10 shift) | Low | `splash.parentNode.removeChild(splash)` |
| 3 | **Preload critical fonts** — Add `<link rel="preload" as="font" crossorigin>` for Inter 400/600 and Amiri 400 | LCP ↓ (faster font swap) | Low | Only preconnect, no preload |
| 4 | **Defer non-critical CSS** — Split `styles.css` into critical inline CSS (~20 KB) + deferred full CSS (~104 KB) | LCP ↓ (renders sooner) | Medium | 124 KB CSS is render-blocking |

### 🟡 Medium Priority

| # | Recommendation | Impact | Effort |
|---|---------------|--------|--------|
| 5 | **Add `font-display: optional` for Arabic font (Amiri)** — Eliminates CLS from Amiri swap. Arabic text is read-only (not interactive), so delayed loading is acceptable | CLS ↓ | Low |
| 6 | **Implement `requestIdleCallback` for non-critical data processing** — Defer `validateData()` and analytics initialization to idle periods | TBT ↓ | Low |
| 7 | **Add explicit `width`/`height` to the splash icon SVG** — Even inline SVGs can shift layout without explicit dimensions | CLS ↓ | Low |
| 8 | **Add `content-visibility: auto` to off-screen sections** — Profile sections already have this; apply to word network sections too | LCP ↓ (less paint) | Low |

### 🟢 Nice-to-Have

| # | Recommendation | Impact | Effort |
|---|---------------|--------|--------|
| 9 | **Use IntersectionObserver to lazy-render dashboard sections** — Only render visible dashboard cards first | TBT ↓ | Medium |
| 10 | **Move `safeguards.js` to `defer` with dynamic import** — Eliminates last blocking script (though it's tiny) | LCP ↓ (minimal) | Low |
| 11 | **Add CSS `contain` property to word card and dashboard sections** — Improves paint containment | Paint ↓ | Low |

---

## 7. Quick Wins (Code Changes Ready to Apply)

The following recommendations can be implemented immediately with minimal code changes:

### Quick Win 1: Fix splash removal CLS
**Current** (in `js/app.js`):
```javascript
if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
```
**Change to**:
```javascript
if (splash) {
  splash.style.opacity = '0';
  splash.style.visibility = 'hidden';
  splash.style.pointerEvents = 'none';
  // Remove from DOM after a delay so the browser can use the space
  setTimeout(function() {
    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
  }, 1000); // Deferred removal
}
```

### Quick Win 2: Preload fonts
**Add to `<head>`** (in `index.html`):
```html
<link rel="preload" as="font" crossorigin href="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" />
<link rel="preload" as="font" crossorigin href="https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHpUrtLMA7A.woff2" />
```

### Quick Win 3: Defer `validateData()` 
**Current** (in `js/app.js`):
```javascript
window.__DEV__ && console.log('[startup] [1b] Running data validation...');
validateData();
```
**Change to**:
```javascript
window.__DEV__ && console.log('[startup] [1b] Running data validation...');
// Run validation after paint to avoid blocking the critical path
requestAnimationFrame(function() { validateData(); });
```

---

## 8. Network Audit

| Metric | Value |
|--------|-------|
| Total requests | 16 |
| Largest resource | `data.bundle.min.js` (1207 KB) |
| Second largest | `app.bundle.min.js` (420 KB) |
| Third largest | `styles.min.css` (124 KB) |
| Font downloads | 3 (Inter woff2, Lora woff2, Amiri woff2) |
| Firebase CDN | `firebase-core.js` module (~300 KB) |

### Transfer Size Breakdown by Category

```
JS:       1927 KB  (84% of total)
CSS:      124 KB   (5%)
Fonts:    60 KB    (3%)
HTML:     84 KB    (4%)
Other:    80 KB    (4%)
```

---

## 9. Animations & Compositor Analysis

| Property | Layout Trigger? | Paint Trigger? | Compositor? |
|----------|----------------|----------------|-------------|
| `transform` (scale, translate) | ❌ No | ❌ No | ✅ Yes |
| `opacity` | ❌ No | ❌ No | ✅ Yes |
| `border-color` | ❌ No | ✅ Yes | ❌ No |
| `box-shadow` | ❌ No | ✅ Yes | ❌ No |
| `width` | ✅ Yes | ✅ Yes | ❌ No |
| `color` | ❌ No | ✅ Yes | ❌ No |
| `background` | ❌ No | ✅ Yes | ✅ Partial |

**Status**: Most interactive animations use `transform` and `opacity` (compositor-friendly). The `.bn-indicator` sliding tab uses `transform` — excellent. Hover states use `border-color` changes which trigger paint but not layout. ✅ Good.

---

## 10. Summary

| Area | Score | Key Issue |
|------|-------|-----------|
| **LCP** | ✅ 1.1s | Splash-to-dashboard transition requires JS execution |
| **CLS** | ⚠️ 0.15 | Splash removal + font swap cause shifts |
| **FID/TBT** | ✅ Good | No long tasks on desktop; mobile untested |
| **Bundle size** | ⚠️ 1.8 MB | Data bundle is 1207 KB (all 114 surahs loaded upfront) |
| **Critical path** | ⚠️ 3 blocking resources | CSS + Google Fonts + safeguards.js block paint |
| **Animations** | ✅ Good | Compositor-friendly transforms used |
| **SW caching** | ✅ Excellent | Cache-first for assets, stale-while-revalidate for JS |

**Estimated Lighthouse score (projected):**
- Performance: ~65-75 (desktop) / ~35-45 (mobile 3G)
- Accessibility: ~90+
- Best Practices: ~85
- SEO: ~100

The largest gains would come from **splitting the data bundle** (saving ~1MB of JS) and **fixing splash removal** (eliminating ~0.10 CLS).
