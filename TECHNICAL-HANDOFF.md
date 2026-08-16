# Bayan — Technical Handoff Document

This document is a reference for anyone taking over work on Bayan (Quran Learning App).
It covers the architecture, the key subsystems, and the two recurring bug patterns the
codebase is structured around preventing. Everything is cited to real files/functions —
read the linked code before changing it.

**Stack:** Vanilla JS (ES6, IIFE modules), HTML/CSS, Firebase v12 Modular SDK, GitHub Pages + PWA.
No framework. No build step beyond concatenation + minification (see [Build](#build)).

---

## 1. Architecture

### 1.1 Build & Deployment

`build.js` is the entire build system (Node, no bundler). It:

- Auto-discovers data files from `js/data/` and `js/data-core/` (see `DATA_FILES` builder in `build.js`).
- Concatenates everything into two production bundles served by `index.html`:
  - `data.bundle.min.js` — data-core modules + all word data + `js/data.js`
  - `app.bundle.min.js` — everything else (services, UI, app wiring)
- Minifies both with **terser**, minifies CSS and inlines it, generates `dist/`, and
  updates the service worker (`sw.js`) precache list.
- Loading order is preserved deterministically (data-core first, then surah metadata,
  thematic files, then per-surah files sorted by surah number) so word IDs (`w_N` legacy,
  `cw_N` canonical) stay stable across builds.

Deployment: GitHub Actions. `.github/workflows/test.yml` ("Bayan CI") runs the unit suite on
Node 18/20 and the full Playwright E2E suite on Node 20 as a hard gate on every push/PR;
only when that workflow succeeds on `main` does `.github/workflows/deploy.yml` auto-trigger
(`workflow_run`) and deploy the exact validated commit (`head_sha`) to GitHub Pages.
A manual `workflow_dispatch` deploy skips the CI gate.

**Key rule:** adding a new `js/data/words-surah-NN-name.js` file requires **no** build-script
change — auto-discovery handles it.

### 1.2 Module System

No ES modules — everything is IIFEs exposing namespaces on `window`. The canonical
public namespaces are:

| Namespace | Source file | Responsibility |
|---|---|---|
| `window.__firebaseCore` | `js/services/firebase-core.js` | Firebase init + v9 wrapper (`getDb`, `getAuth`, `doc`, `getDoc`, `setDoc`, `onSnapshot`, `subscribeToAuth`) |
| `window.__auth` | `js/services/auth-service.js` | Sign-in/up, session state, `onAuthChange` |
| `window.__premium` | `js/services/premium.js` | Entitlement state, `isPremium`, `hasFeature`, `onChange`, `requestUpgrade` — **single source of truth for premium** |
| `window.__sync` | `js/services/sync-service.js` | Cloud sync (queue/upload/download/merge) |
| `window.__vocabAccess` | `js/vocabulary.js` | Free-tier gate: `getLimit`, `getFrequencyRank`, `isFreeAccessible`, `getFreeVocabularyCount` |
| `window.__vocabularyRelations` | `js/vocabulary.js` | Semantic groups, derived forms, contextual equivalents, relationship cache |
| `window.__srs` | `js/srs.js` | SRS engine: `rateSRSWord`, `getSRSStats`, `getDueReviews`, `invalidateStatsCache` |
| `window.__recommendationSlot` | `js/recommendation-slot.js` | `getPrimary(state)` — rule-based recommendation card |
| `window.__analytics` | `js/analytics.js` | Achievements, insights, daily snapshots |
| `window.__ux` | `js/ux-polish.js` | Onboarding, plan picker, progressive disclosure (`getProgressiveVisibility`) |

Cross-module access is via these globals only — never via raw `window.X` ad-hoc lookups.
When modules need each other's functions they call the top-level hoisted functions
(e.g. `isFreeAccessible`, `loadSRS`, `getCanonicalWords`), which exist as globals because
the bundle concatenates them into one scope.

### 1.3 Data Pipeline

- **Sources:** `js/data-core/vocab-data.js` (defines `ALL_WORDS`/`CANONICAL_WORDS`),
  `js/data/occurrence-index.js` (real Quranic token/occurrence counts),
  `js/data/surahs.js`, and ~120 `words-surah-*.js` files plus thematic files.
- **Enrichment:** `enrichCanonicalMetadata` (in `js/data-core/foundation.js` / `js/data.js`)
  computes per-word `frequencyRank` and `frequencyPercentile` from **real occ data**
  (the occurrence index), not file order. Foundation Course top-100 and the free-tier-300
  gate both derive from this same ranking (see §3.1).
- **Storage:** progress/SRS lives in `localStorage` under `quran_*` keys
  (`quran_srs_data`, `quran_favorites`, `quran_notes`, `quran_streak`, `quran_quiz`,
  `quran_lesson_progress`, `quran_surah_progress`, `quran_foundation_progress`,
  `quran_analytics_*`). Cloud copies live in Firestore `learning/{uid}` (whole blob) and
  `profiles/{uid}`; subscriptions in `subscriptions/{uid}`.

### 1.4 Firebase

- Always v9 modular via `window.__firebaseCore` — never the namespaced legacy API.
- Firestore reads are gated and cached; `premium.js` holds the one live `onSnapshot`
  listener on `subscriptions/{uid}` (see §3.2).
- `firestore.rules` + `api/` (Vercel functions, e.g. `create-checkout-session`) handle
  the server side; client never exposes secrets. The Vercel handlers are covered by
  `test/api-checkout.test.js` + `test/api-webhook.test.js` (see §4).

---

## 2. Key Subsystems

### 2.1 SRS Engine — `js/srs.js`

- Modified SM-2: 3 learning stages, rating 0–3 (`rateSRSWord(wordId, rating)`), per-entry
  `{ dueDate, interval, stage, reps, totalReviews, lapses, easeFactor, leechCount, isLeech }`.
- Retention: `estimateRetention(entry)` = `0.9 ^ (daysSinceReview / (interval * 0.5))`,
  clamped 0.6–0.99. `getRetentionPercent` rounds to 0–100 for display.
- Aggregates: `getSRSStats()` (total, mature, dueToday, totalReviews, overdue, retention),
  `getDueReviews()`, `getMixedReviewQueue(limit)` (in `js/data-core/lesson-system.js`).
- Stats cache is invalidated after every rating (`invalidateStatsCache`).

### 2.2 Vocabulary & the Free-Tier Gate — `js/vocabulary.js`

- `getCanonicalWords()` — the 1,207-word canonical set (canonical ids `cw_N`).
- **Free-tier gate (vocabularyExpansion):** `FREE_VOCABULARY_LIMIT = 300`; `isFreeAccessible(word)`
  returns true if premium has `vocabularyExpansion`, else `getWordFrequencyRank(word) <= 300`.
  Ranking is computed lazily by `_buildFreqRankMap()` — sorts canonical words by `occ`
  descending (same sort Foundation uses), assigning 1-based ranks. **Not a hardcoded list**,
  so new vocabulary stays correct automatically.
- Search: `searchWords(query)` (multi-field index built once), used by the Words tab list
  (`renderWordList` in `js/ui/stats-ui.js`) and Quran reader matching.
- Relationships: `getSemanticGroups` / `getDerivedForms` / `getContextualEquivalents` /
  `getConfusedWith` etc., backed by a cache (`invalidateRelationsCache`) and capped by
  `MAX_SEMANTIC_GROUP_SIZE = 130` (noise-group defense).

### 2.3 Premium Entitlement — `js/services/premium.js`

The single source of truth. `isPremium()` applies a documented **5-rule priority order**
(see header comment, implemented in `_applySubscriptionDoc`): no doc → false; status ≠
`active` → false; active but `currentPeriodEnd` in the past → false; missing
`currentPeriodEnd` → true; future → true. All upgrade CTAs go through
`requestUpgrade(reason, {plan})` (Stripe Checkout POST → Vercel), and feature checks go
through `hasFeature(FEATURES.X)`.

### 2.4 Foundation Course — `js/data-core/foundation.js` + `js/learning-journey.js`

- Dynamic top-100 selection by real frequency (same occ ranking as §2.2) —
  `FOUNDATION_LESSONS` built from that set.
- Lesson order, completion tracking (`quran_foundation_progress`), quizzes
  (`js/quiz.js`), and review integration are all wired through
  `getFoundationLessonWords(i)`, `isFoundationLessonCompleted(i)`, etc.

### 2.5 UI Layer

- `js/ui/navigation.js` — view switching (`switchView`), bottom-nav (5 tabs:
  dashboard/paths/words/profile/quran), and the **single cross-module premium subscriber**
  (`__premium.onChange → rerenderCurrentView`, lines 510–514).
- `js/ui/dashboard.js` — `renderDashboard()`, the most-gated screen (see §3.3).
- `js/ui/learn-screen.js` — Learn tab / active word-study card.
- `js/ui/word-card.js` — the word card in Learn; also gates root analysis behind
  progressive disclosure (`getProgressiveVisibility().showRootAnalysis`, needs 3+
  completed foundation lessons).
- `js/ui/explorer.js` — Words tab detail view: `renderExplorer()` + locked variant
  `renderExplorerLocked(w)` for premium-tier words; relationship panels gated by premium.
- `js/ui/stats-ui.js` — Words list rendering + badges; locked rows for premium words.
- `js/ui/quran.js` — Quran reader; word tokens render from the corpus (visible for all
  words), tapping opens Explorer which applies the gate.
- `js/ui/review-center.js` — Review Center with the `_RC_RETENTION_MIN_REVIEWS` gate
  (see §3.3).
- `js/profile-ui.js` — Profile/Progress/Insights tabs, `renderProfileProgress()` with the
  `LOWEST_COMP_HIDE_THRESHOLD` gate.
- `js/ux-polish.js` — onboarding slides, plan-picker auto-show, `getProgressiveVisibility`.

---

## 3. The Two Documented Bug Patterns

These are the two recurring failure classes this codebase has been hardened against.
**Every new UI/feature change must be checked against both.**

### 3.1 Bug Pattern 1 — Stale Premium Checks / Live-Unlock Failures

**History:** the app repeatedly hit a bug class where premium status was read once at
render time and cached, so a user who purchased/upgraded mid-session kept seeing locked
UI until a full page reload. Known incidents: Word Relationships, SRS stats, and the
in-app plan picker. This pattern is now enforced against by design:

1. **Single source of truth:** `js/services/premium.js` is the only module that reads the
   subscription. Everything else calls `window.__premium.isPremium()` /
   `hasFeature(...)`. No module may read `subscriptions/` from Firestore directly.
2. **Live listener:** `_loadSubscriptionFromFirestore(uid)` (premium.js) attaches an
   `onSnapshot` listener to `subscriptions/{uid}` and also does a one-shot read. State
   changes flow through `_setPremiumState` → `_notifyListeners`.
3. **Live re-render subscribers** — these are what make a mid-session upgrade show up
   without reload:
   - `js/ui/navigation.js` lines 510–514: `__premium.onChange(() => rerenderCurrentView())`
     — the catch-all: every visible view re-renders on any premium change.
   - `js/vocabulary.js` lines 1711–1715: `onChange → invalidateRelationsCache()` — the
     relationships cache is stored empty for free users and must be rebuilt after upgrade
     (the exact Word Relationships bug).
   - `js/profile-ui.js` lines 24–28: `onChange → _refreshDataExportButtons()` — export/import
     buttons refresh in place (the SRS-stats / plan-picker class of bug).
4. **The free-tier gate is derived, not cached:** `isFreeAccessible()` (vocabulary.js) calls
   `window.__premium.hasFeature(...)` on every invocation, so the 300-word limit lifts the
   moment the premium doc flips. Screens that consume it (Explorer `renderExplorer` line 131,
   stats-ui locked rows line 268) re-run it on every render — which the navigation.js
   subscriber guarantees happens on change.

**Checklist for new premium-gated UI:** (a) check via `window.__premium.hasFeature(FEATURES.X)`,
never a cached copy; (b) ensure the view re-renders via `rerenderCurrentView` or registers its
own `onChange` if it caches anything premium-dependent; (c) verify the free→premium transition
live in-browser, not just on reload.

### 3.2 Bug Pattern 2 — Zero-Data Clutter / First-Time-User Noise

**History:** the app repeatedly shipped screens that show meaningless 0% / 0-value stats,
duplicate actions, and overlapping cards to brand-new users (Session Complete showed 11
cards for a 1-word session; Word Detail had 6+ near-redundant actions and 3 overlapping
info cards; Profile/Progress showed a wall of zero-stats; Dashboard ~half cards were
zero-noise). The established fix pattern, applied consistently across screens:

**A. The 5-review minimum-data rule** — hide anything that is meaningless below
`totalReviews >= 5`. Canonical definition: `_RC_RETENTION_MIN_REVIEWS = 5` in
`js/ui/review-center.js` (line 31). Consumers of the same threshold:
- Review Center retention stat: `showRetention: (totalReviews || 0) >= _RC_RETENTION_MIN_REVIEWS`
  (review-center.js line 171).
- Dashboard Review-Center prompt card: only renders when `dueCount > 0 || totalReviews >= 5`
  (dashboard.js lines 566–567).
- Explorer detail "My Learning Progress" detailed rows: `showDetailedStats = totalReviews >= 5`
  (explorer.js lines 668–672); below that, a one-line "Not studied yet — see it in a lesson
  to track progress here" (`explorer-progress-empty`, explorer.js line 586) replaces the
  dash/zero grid.
- Profile SRS Health + Review Forecast: gated behind the same 5-review rule
  (profile-ui.js line 705).
- Word list badges: unstudied words get **no** badge at all — the "else" default-star branch
  was removed (stats-ui.js lines 247–262).

**B. `LOWEST_COMP_HIDE_THRESHOLD = 5`** — surah-comprehension lists (bottom-5 surahs,
"0/86 above 50%") are zero-noise until several surahs have real progress. Defined in
`js/profile-ui.js` line 679 and reused by `js/ui/dashboard.js` lines 590–591 (dashboard's
Surah Comprehension card only renders when ≥5 surahs have non-zero comprehension).

**C. `noProgress` / `hasAnyProgress` flags** — Dashboard computes
`$noProgress = fCompleted === 0 && masteredCount === 0` (dashboard.js line 181) and
`$hasAnyProgress = fCompleted + masteredCount + totalReviews > 0` (line 675). Used to:
- Suppress the recommendation slot entirely for new users (dashboard.js lines 630–633) —
  it duplicated the Continue-Learning CTA; `recommendation-slot.js` also has a
  `noProgress` rule (line 104).
- Hide the Progress Overview card until real progress exists (line 675).
- Swap hero stats to a single "Start Today" stat and replace repeated CTAs with generic
  welcome copy for new users (lines 237, 322).
- Gate the comprehension ring: a 0% ring renders as a plain welcome line instead
  (`$comprehensionPct > 0` checks at dashboard.js lines 249, 265–266, 279).

**D. One-line-empty-state instead of placeholder grids** — the established preference:
a clean sentence beats a dash/zero grid (see explorer.js `explorer-progress-empty`,
review-center.js empty states lines 372–375, achievements empty text in profile-ui.js
line 1084).

**Checklist for new UI:** (a) if a stat is meaningless at zero data, gate it behind the
existing 5-review rule or `LOWEST_COMP_HIDE_THRESHOLD` — do not invent a new threshold;
(b) don't show a second CTA doing what an existing card already does; (c) don't render
placeholder grids — use a one-line message; (d) test both a fresh account and an
account with real progress before considering it done.

---

## 4. Testing & Verification Conventions

- **Unit tests:** `test/*.test.js`, run via `node test/run-all.js` (or `npm test`).
  Covers SRS, quiz, vocabulary gates, review-center gating, dashboard gating, production
  build integrity, and the Vercel payment handlers:
  - `test/api-checkout.test.js` — `create-checkout-session`: auth rejection, plan
    validation, the exact Polar request payload (`metadata.uid` / `external_customer_id`),
    provider-error mapping, and generic-error (no-leak) responses.
  - `test/api-webhook.test.js` — `webhook`: Standard-Webhooks HMAC verification (incl.
    tamper + replay rejection), event routing, and the exact Firestore `subscriptions/{uid}`
    doc shape `isPremium()` reads.
  Both stub `firebase-admin` and `micro` via `Module._load` interception
  (`test/api-handler-helpers.js`), so they need no Firebase credentials and no network —
  `npm run test:api` runs them standalone.
- **E2E:** `test/e2e/` Playwright specs, configured in `playwright.config.js` (auto-starts
  `node serve-e2e.js` against `dist/`). Six specs:
  - `full-user-flow.spec.js` — onboarding, dashboard, lessons, quiz, review, stats; the
    guard that caught the stale-premium and zero-clutter regressions.
  - `visual-regression.spec.js`, `sle-diagnostic.spec.js` — view rendering + SLE diagnostics.
  - `auth-flow.spec.js` — auth UX (view switching, validation) + **real Firebase Auth
    round-trips** (failed login, password-reset request for an unknown email) that create
    no accounts and write no data.
  - `premium-flow.spec.js` — checkout frontend contract: guest entitlement, the plan-picker
    sign-in prompt, `?checkout=success|cancel` param handling.
  - `offline.spec.js` — real PWA offline use: SW install/control, precache verification,
    offline reload + vocabulary reading from cache.
- **CI gate:** "Bayan CI" runs the unit suite on Node 18/20 and the full Playwright suite on
  Node 20 (Chromium installed in-job, artifacts uploaded on failure); the deploy workflow
  only fires after CI passes on `main` (§1.1).
- **Verification of the two patterns:** every change touching premium gating should be
  browser-tested with a free→premium live upgrade (no reload); every change touching
  display density should be browser-tested with a fresh (zero-history) account **and** a
  returning account with real progress.

**PWA note (offline):** `offline.spec.js` caught a real bug — the SW's `.js`/`.json` fetch
handler only served the dynamic cache, so the precached bundles (app/data/firebase-core)
failed offline with `ERR_FAILED` on a freshly installed app. `sw.js` now serves
`staleWhileRevalidate` as dynamic cache → precache (`CACHE_NAME`) → network, and the
precache fallback is exactly what makes first-offline-session reading work.
