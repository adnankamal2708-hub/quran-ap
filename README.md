# Bayan — Understand the Quran, One Word at a Time

**Bayan** (بيان) is a modern Quran vocabulary learning platform that helps you understand the words of the Quran through spaced repetition, root analysis, morphological relationships, and contextual learning.

## Features

- **Foundation Course** — Master the 100 most frequent Quranic words across 10 progressive lessons (~84% of all Quranic word occurrences)
- **Learn by Surah** — Study vocabulary in Quranic context, surah by surah
- **Root Family Learning** — Explore Arabic morphology by studying words grouped by root letters
- **Adaptive Spaced Repetition (SRS)** — SM-2 algorithm with automatic review scheduling
- **Interactive Quiz System** — Multiple-choice quizzes with intelligent distractors
- **Vocabulary Explorer** — Comprehensive word reference with root families, derived forms, semantic groups, and morphological relationships
- **Quran Reading Coverage** — Track what percentage of Quranic vocabulary you've mastered
- **Offline-First PWA** — Study offline, sync when connected via Firebase
- **User Accounts** — Cloud sync across devices via Firebase Auth + Firestore
- **Analytics Dashboard** — Learning insights, trend tracking, achievements, and forecasts
- **Personal Notes** — Annotate words for contextual learning

## Architecture

```
├── index.html              — App shell (PWA entry point)
├── styles.css              — Global styles
├── manifest.json           — PWA manifest
├── sw.js                   — Service worker for offline support
├── build.js                — Production build script (minification + bundling)
├── js/
│   ├── app.js              — Application bootstrap & orchestration
│   ├── data-core/          — Split data modules (vocab, foundation, SRS, etc.)
│   ├── ui/                 — Split UI modules (word-card, explorer, dashboard, etc.)
│   ├── vocabulary.js       — Word search, filtering, relationships engine
│   ├── srs.js              — SM-2 spaced repetition algorithm
│   ├── quiz.js             — Quiz system with intelligent distractors
│   ├── analytics.js        — Learning analytics & insights
│   ├── ux-polish.js        — Onboarding tour, toast system, milestones
│   ├── auth-ui.js          — Login/signup form handlers
│   ├── profile-ui.js       — Profile & settings UI
│   ├── data/               — Quranic vocabulary word files (auto-discovered)
│   └── services/           — Firebase auth, sync, and user services
├── test/                   — Unit tests, dry-load, Playwright E2E
├── .github/workflows/      — CI/CD pipelines (test + deploy)
└── dist/                   — Production build output
```

## Getting Started

1. **Development**: Open `index.html` in a browser (no build step required)
2. **Production Build**: `node build.js` — bundles app JS, minifies (Terser), generates service worker
3. **Run Unit Tests**: `node test/run-all.js` — runs all test suites

---

## CI/CD Pipeline

### Build Pipeline (`node build.js`)

The production build performs these steps in order:

1. **Source Validation** — Scans all JS files for duplicate `const`/`let`/`var`/`function` declarations that would cause parse errors in the concatenated bundle. Fails fast with a clear report.
2. **Comment Lint** (`node test/comment-lint.js`) — Checks for malformed comment patterns (e.g., an unclosed block-comment opener inside a line comment) that would break minification.
3. **Concat** — Combines ~130 data files from `js/data/` into `data.bundle.js` and ~19 app files from `js/` into `app.bundle.js`. Data files are auto-discovered (adding a new `words-surah-NN-name.js` is automatic — no build script edits needed).
4. **Minify** — Minifies both bundles with Terser (3 compression passes), strips console logs, and mangles identifiers (preserving `ALL_WORDS`, `SURAH_INFO`, `LESSONS`).
5. **CSS Minification** — Strips comments and whitespace from `styles.css`.<br>_Typical reduction: 93 KB → 73 KB (22%)._
6. **HTML Generation** — Reads `index.html`, inlines the minified CSS, and minifies the HTML. Updates the service worker precache list with production asset URLs and a unique cache version (timestamp-based).
7. **Asset Copying** — Copies `firebase-core.js`, `ux-polish.js`, `sw.js`, `manifest.json`, and `favicon.ico` to `dist/`.<br>_Typical JS reduction: 1977 KB → 1425 KB (28%)._

**Output:** `dist/` folder with 5 HTTP requests total (data bundle + app bundle + inline CSS + Firebase module + manifest).

### Dry-Load Test (`node test/dry-load.js`)

The dry-load test is a **runtime ReferenceError detector** that simulates how the browser loads the concatenated bundles. It:

1. Creates a Node.js `vm` sandbox with mock browser globals (`document`, `localStorage`, `navigator`, `console`, etc.)
2. Concatenates all source files in the same order as the build script
3. Executes the combined bundle in the sandbox
4. Reports any `ReferenceError`, `TypeError`, or `SyntaxError` (with stack trace and originating file)
5. Performs **static analysis** on `firebase-core.js` (an ES module that can't be executed in Node) — detects bare references to capitalized identifiers that aren't imported or declared

**When to run:** After any code change, especially when adding new global variables, renaming functions, or restructuring modules. This catches the exact class of bug where cross-file variable references break silently.

```bash
node test/dry-load.js         # Quick check
node test/dry-load.js --verbose  # Show each file as it loads
```

Exit code `0` = no errors. Exit code `1` = runtime error detected.

### Continuous Integration (CI)

**Test Pipeline** (`.github/workflows/test.yml`) — runs on every push and PR to `main`:

| Step | What it does | Timeout |
|------|-------------|--------|
| `node test/comment-lint.js` | Checks for malformed comment patterns | 2 min |
| `node test/run-all.js` | Runs all unit tests (analytics, SRS, quiz, vocabulary, dashboard, etc.) | 5 min |
| `node build.js` | Builds the production bundle | 5 min |
| `node test/dry-load.js` | Validates the built bundle for runtime errors | 2 min |
| `npx playwright test` | End-to-end tests (see below) | 5 min |
| `npm audit --production` | Security vulnerability scan | 2 min |
| Secret scanning | Checks for leaked API keys in checked-in files | 1 min |

Tests run against Node.js 18.x **and** 20.x for compatibility.

**Deploy Pipeline** (`.github/workflows/deploy.yml`) — triggered by `git push origin main`:

1. Install dependencies (`npm ci`)
2. Build production assets (`npm run build`)
3. Validate build output (`node validate.js`)
4. Upload artifact to GitHub Pages
5. Deploy

> **Prerequisite:** GitHub Pages must be configured with Source → "GitHub Actions" in repository Settings → Pages.

### Test Suites

#### Unit Tests (`node test/run-all.js`)

Runs 10 test suites sequentially with a summary report:

| File | Tests | What it covers |
|------|-------|---------------|
| `analytics.test.js` | ~60 | Learning analytics, trends, snapshots, achievements |
| `ux-polish.test.js` | ~40 | Onboarding tour, toast notifications, milestones |
| `srs.test.js` | ~80 | SM-2 algorithm, scheduling, stats, daily limit |
| `srs-edge.test.js` | ~40 | Leech detection, legacy migration, edge cases |
| `vocabulary.test.js` | ~40 | Search, filtering, relationships, semantic groups |
| `quiz.test.js` | ~50 | Quiz engine, distractors, scoring, completion |
| `data-validation.test.js` | ~30 | Word data integrity, build validation, schema |
| `dashboard.test.js` | ~50 | Dashboard rendering, foundation course, ring chart |
| `services.test.js` | ~30 | Firebase auth/sync/user service stubs |
| `foundation-course.test.js` | ~30 | Foundation lesson system, coverage, milestones |

**Total: ~450+ tests.** All must pass before deployment.

#### End-to-End Tests (`npx playwright test`)

Playwright E2E tests in `test/e2e/` simulate real user flows in Chromium:

| Suite | Tests | Flow tested |
|-------|-------|------------|
| Onboarding Tour | 5 | Welcome slides, navigation, skip, escape, revisit |
| Foundation Lesson | 4 | Dashboard, lesson nav, word card, prev/next |
| SRS Rating | 2 | Button visibility, rating updates stats |
| SRS Rating — Edge Cases | 3 | Again reset, nav back preserves count, Easy update |
| Quiz Flow | 3 | Questions, answering, completion |
| Quiz Completion — Edge Cases | 4 | Score update, multi-answer, inter-question nav, percentage |
| Review Banner & SRS Review | 2 | Due words banner, review mode entry |
| Dashboard | 3 | Paths display, nav switching, stats metrics |
| Word List & Search | 3 | Vocabulary list, search filters, filter chips |
| Keyboard Shortcuts | 3 | Hints (?), view switching (W, S) |
| Vocabulary Explorer | 8 | Explorer view, core info, occurrences, root family, derived forms, SRS progress, back button, action buttons |
| Analytics View | 5 | Overview, Trends, Insights, Achievements tabs |
| Progress Persistence | 2 | Lesson and SRS data across reloads |
| Quick Flashcard Mode | 3 | Toggle on/off, content visibility |
| Offline Indicator | 1 | Online/offline status display |

**Total: 51 E2E tests.**

### Pre-Push Checklist

Run these commands **before every push** to catch issues early:

```bash
# 1. Run all unit tests (~450+ tests, ~15 seconds)
npm test

# 2. Build production bundle (validates source + Terser minification)
npm run build

# 3. Dry-load source files (catch cross-file runtime ReferenceErrors)
node test/dry-load.js

# OR run all of the above in one command:
npm run build && node test/dry-load.js && npm test

# 4. Start local server and run E2E tests
npm run serve         # starts http-server on port 8080
npx playwright test   # runs all 51 E2E tests

# Full validation (all checks):
npm run build && node test/dry-load.js && npm test && npx playwright test
```

### npm Scripts Reference

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run build` | `node build.js` | Production build with Terser |
| `npm test` | `node test/run-all.js` | All unit tests |
| `npm run serve` | `npx http-server dist/ -p 8080 -c-1` | Local preview server |
| `npx playwright test` | — | All E2E tests (server must be running) |
| `node test/dry-load.js` | — | Runtime ReferenceError check |
| `node test/comment-lint.js` | — | Comment pattern validation |
| `node test/run-all.js` | — | Unit test runner (same as `npm test`) |

---

## Module Structure

The monolithic `data.js` (3,443 lines) and `ui.js` (3,401 lines) have been split into focused modules for better maintainability:

**`js/data-core/`** — Data layer (8 modules):
- `vocab-data.js` — `ALL_WORDS`, `CANONICAL_WORDS`, deduplication
- `surah-org.js` — Surah organization mode
- `foundation.js` — Foundation Course, coverage, milestones
- `lesson-system.js` — Lessons, root families, difficulty paths
- `progress-aggregator.js` — Learning path progress aggregator
- `adaptive.js` — Adaptive engine, learner profile
- `quiz-history.js` — Quiz result tracking
- `surah-progress.js` — Surah completion tracking

**`js/ui/`** — UI rendering (7 modules):
- `dom-helpers.js` — DOM element cache
- `word-card.js` — Word card, root box, relationships
- `stats-ui.js` — Stats, filters, word list
- `quiz-ui.js` — Quiz question rendering
- `explorer.js` — Vocabulary explorer
- `analytics-ui.js` — Analytics rendering
- `dashboard.js` — Dashboard rendering

## Tech Stack

- **Vanilla JS** — No framework dependencies
- **Firebase v12 Modular SDK** — Authentication, Firestore sync
- **PWA** — Service worker, offline caching, installable
- **SM-2 Algorithm** — Spaced repetition for optimal retention

## License

MIT
