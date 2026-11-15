# Today's ayah Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each day Home offers one real ayah the learner can mostly read, teaches its 1–3 missing words, then shows it alone.

**Architecture:** A build-time script tags every word of every ayah with the lesson word it is (or "and/so + word", or nothing) and writes a lazy-loaded index. A pure picker chooses today's ayah from that index and the learner's SRS entries. A new view runs the three-step flow; Home shows a card for it.

**Tech Stack:** Vanilla JS (ES5 style, as the codebase), Node scripts and tests, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-16-daily-ayah-design.md`

## Global Constraints

- Code files under 300 lines; new code in small new files, each added to `build-files.js` (generated data files exempt from the line limit).
- Known means SRS stage ≥ 2, the same set `getMasteredWordIds()` (`js/data-core/foundation.js:673`) uses for % of the Quran.
- First choice: ≥ 2/3 of the words known and ≤ 2 hints. Fallback: ≥ 1/2 known and ≤ 3 hints. Otherwise no card.
- Only ayahs of 4 or more words (after joining continuation tokens); the index keeps only ayahs where at least half the words could ever be known; index under 80 KB.
- Storage: localStorage `quran_daily_ayah` = `{date, ref, done: [refs], readCount}`. Device only, no Firestore change.
- Done card copy: "Read today ✓ · N ayahs read on your own" (singular "ayah" for 1). Only "I understood it" adds to `readCount`; either button marks the ayah done.
- Every meaning shown comes from `verse.w` (checked per-ayah meanings) or the lesson word itself. No XP or points.
- Arabic marked `lang="ar" dir="rtl"`; mobile first; keyboard reachable; current design language.
- Never break offline: the index is precached by the service worker like `surah-index.min.js`.

## Review Focus

- A learner with no mastered words, or too few: the card is absent, Home renders as before, no console error. (Task 2 test `null when nothing fits`; Task 3 test `card hidden when picker returns null`.)
- The index or surah file fails to load (offline before first cache, 404): the card stays absent, Home still works. (Task 3 test `card hidden when the index fails to load`.)
- The day rolls over while the app is open, or the learner masters more words mid-day: the pick stays fixed until local midnight, then changes. (Task 2 tests `same pick all day`, `new pick on a new day`.)
- A homograph token (أَن/إِن/أَنَّ against إِنَّ, هَوَىٰ noun/verb) is never shown as known through the wrong word. (Task 1 tests on the vowel cases and ambiguous forms.)
- Every ayah in the index is eventually completed: picker returns null rather than repeating. (Task 2 test `never repeats an ayah`.)

---

### Task 1: The ayah readability index (generator + generated file)

**Files:**
- Create: `scripts/build-ayah-readability.js`
- Create: `js/quran/ayah-readability.js` (generated)
- Create: `test/ayah-readability.test.js`; add to `test/run-all.js`

**Interfaces:**
- Consumes: `buildFormKeys`'s `tokenKey(token)` logic (export `buildFormKeys`, `normalizeArabic`, `loadQuranCorpus` from `scripts/build-occurrence-index.js`, guarding `main()` with `require.main === module`); `arabicSameWord` (`js/data-core/word-forms.js`); `scripts/word-meanings.js` for `verse.w`; `test/load-vocabulary.js` style loading of canonical words.
- Produces: `window.__AYAH_READABILITY = { "s:a": [entry, …] }`, one entry per word after joining continuation tokens. Entry: a number `N` = word `cw_N`; a string `"+N"` = وَ/فَ + `cw_N`; `null` = hint. Module exports `buildAyahReadability(quranText, words, meanings) → object` and `generateFile(obj) → string`.

**Rules (decided here):**
- A token is word `cw_N` when `tokenKey(token)` equals the key of exactly one canonical word whose form passes `arabicSameWord(form, token)`. Zero or several candidates → `null`. (Reuses the matcher % of the Quran already uses, so "known" here equals "credited" there.)
- "and/so": token starts with وَ or فَ followed by fatḥa, the rest passes the rule above, and that word's `verse.w` meaning matches `/^(and|so|then)\b/i`.
- A continuation token (`w` entry `0`) joins the word before it; the joined word is `null`.
- Keep the ayah when it has ≥ 4 words and ≥ half are non-null.

- [ ] **Step 1: Write failing tests** in `test/ayah-readability.test.js`:
  - `arabicSameWord` cases: إِلَى~إِلَىٰ, اللَّهُ~ٱللَّهِ, غَفُورٌ~غَفُورٞ match; إِنَّ against أَن, أَنَّ, إِن does not.
  - every stored id `N` (or `+N`) occurs at that position: the token (minus وَ/فَ for `+N`) has the canonical word's index key;
  - no ayah has fewer than 4 entries; every ayah has ≥ half non-null;
  - no id belongs to a form shared by two canonical words with different meanings (هَوَىٰ);
  - the committed file equals `generateFile(buildAyahReadability(...))` (up to date);
  - the file is under 80 KB; 78:9 is present.
- [ ] **Step 2:** `node test/ayah-readability.test.js` → FAIL (module missing).
- [ ] **Step 3:** Implement the script; run `node scripts/build-ayah-readability.js` to write the file.
- [ ] **Step 4:** Test passes; `node test/run-all.js` passes (occurrence-index tests unchanged after the export guard).
- [ ] **Step 5:** Commit `scripts/build-ayah-readability.js js/quran/ayah-readability.js scripts/build-occurrence-index.js test/ayah-readability.test.js test/run-all.js`.

### Task 2: The picker and its storage

**Files:**
- Create: `js/data-core/daily-ayah.js`; add to `build-files.js`
- Create: `test/daily-ayah.test.js`; add to `test/run-all.js`

**Interfaces:**
- Consumes: the index shape from Task 1; SRS entries `{stage, ratedAt}` keyed `cw_N`.
- Produces:
  - `pickDailyAyah(index, srs, state, dateKey) → {ref, entries, known, total, hints: [positions]} | null` — pure.
  - `dailyAyahDateKey(date) → 'YYYY-MM-DD'` local time.
  - `loadDailyAyahState() → {date, ref, done, readCount}` and `saveDailyAyahState(state)` (localStorage `quran_daily_ayah`, defaults `{date:'', ref:'', done:[], readCount:0}`, tolerant of bad JSON).
  - `completeDailyAyah(state, ref, understood) → newState` — pure: adds ref to `done` once; `readCount + 1` only when `understood` and ref was not already done.

**Picker rules:** if `state.date === dateKey && state.ref` → return that ref's result (even if it no longer meets the thresholds). Otherwise skip refs in `state.done`; first try the first-choice rule, then the fallback; rank by the newest `ratedAt` among the ayah's known words (descending), ties by a string hash of `dateKey + ref`. Caller saves `{date: dateKey, ref}`.

- [ ] **Step 1: Write failing tests:** thresholds (an ayah at 2/3 with 2 hints picked; 3 hints only through the fallback); fallback used only when no first-choice ayah exists; never repeats a done ref; same pick all day after mastering more; new pick on a new day; deterministic for same inputs; null when nothing fits; stage 1 words are hints; `+N` known when `cw_N` mastered; `completeDailyAyah` counts once and only for "understood".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `node test/run-all.js` passes.
- [ ] **Step 5:** Commit.

### Task 3: The card, the flow, and wiring (lazy load, build, SW)

**Files:**
- Create: `js/ui/daily-ayah-ui.js` (card + view; split a `js/ui/daily-ayah-steps.js` if over 300 lines); add to `build-files.js`
- Modify: `index.html` (add `<section class="mode-view" id="view-daily-ayah" aria-label="Today's ayah"></section>` next to `view-root-lesson`), `js/ui/dom-helpers.js:35`, `js/validation.js` (`VALID_ROUTES`, `ROUTE_VIEWS`), `js/ui/navigation.js` (render on switch; tab `tab-home`), `js/ui/dashboard.js` (an empty `<div id="db-daily-ayah"></div>` after the Up next block, and one `renderDailyAyahCard(...)` call after `$d.innerHTML = $h`), `js/i18n/strings-en.js`, `styles.css`, `build.js` (minify `js/quran/ayah-readability.js` into `dist/js/quran/ayah-readability.min.js` next to step 4b-i, add it to the precache list), `sw.js` (`PRECACHE_URLS` source list)
- Create: `test/daily-ayah-ui.test.js`; add to `test/run-all.js`; Create: `test/e2e/daily-ayah.spec.js`

**Interfaces:**
- Consumes: Task 2 functions; `loadQuranSurah(id)` / `getQuranVerse(s, a)` (`js/quran/quran-loader.js`) for text, translation and `w`; canonical words for root and meaning; `verseAudioUrl`, `playAudio`, `audioCreditHtml` (`js/services/audio.js`).
- Produces: `renderDailyAyahCard(container)` (async, hides itself on any failure or null pick); `renderDailyAyah()` for the view; `loadAyahReadability() → Promise<index|null>` (script tag `./js/quran/ayah-readability.min.js`, falls back to the unminified path in dev).

**Screens:** card "Today's ayah · You know 7 of 9 words / An-Naba 78:9 ›"; done "Read today ✓ · N ayahs read on your own". View steps: `words` (one card per hint: the word as written, its `w` meaning, root when it is a lesson word; Next), `ayah` (large, tappable words show their `w` meaning, hints underlined; "I understood it", "Show translation"), `check` (translation, surah name and ayah number, play + credit; Done → dashboard). Clicks by delegation with `data-action`, as in `root-lesson-ui.js`.

- [ ] **Step 1: Write failing tests** (jsdom-free string tests, like `test/tracks-ui.test.js`): card markup for a pick; done markup with count 1 and 12; card hidden on null pick and on index load failure; each step's markup; "I understood it" increments `readCount`, "Show translation" does not; every Arabic span has `lang="ar"`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and wire.
- [ ] **Step 4:** `node test/run-all.js`, `npm run build`, `node test/dry-load.js`, `node test/production-build.test.js` pass.
- [ ] **Step 5:** e2e `daily-ayah.spec.js`: seed SRS with mastered words for 78:9's known words, open Home, see the card, run the flow, see the done card with "1 ayah read on your own"; reload offline and the card still renders. Run the full suite.
- [ ] **Step 6:** Browser check in the preview (phone width, dark and light), then commit.
