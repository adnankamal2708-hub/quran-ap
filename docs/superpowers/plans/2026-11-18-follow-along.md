# Follow Along with Al-Husary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While Al-Husary recites in the Quran reader, the word he is saying is highlighted, in exact time with the voice.

**Architecture:** A build script turns quran-align's `Husary_64kbps` word timings into a compact, delta-encoded file (`js/quran/recitation-timing.js`, minified by the build). A pure module decodes one ayah's timings and finds the word at a given millisecond. The reader loads the file on the first press of play. While a verse plays, a `requestAnimationFrame` loop reads the audio element's `currentTime` and moves one class between the ayah's word spans.

**Tech Stack:** Vanilla JS (ES5 style, like the rest of `js/`), Node build scripts, the app's own test runner (`test/run-all.js`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-18-follow-along-design.md`

## Global Constraints

- Verse audio: `https://everyayah.com/data/Husary_64kbps/` everywhere `verseAudioUrl` is used. `AUDIO_TEACHING_BASE` (`Husary_Muallim_128kbps`) unchanged.
- Timing source: quran-align release 2016-11-24, `Husary_64kbps.json`, CC BY 4.0. The raw JSON is never committed; only the generated `js/quran/recitation-timing.js`.
- An ayah whose word count differs from the app's whitespace tokens gets no timings (expected: 6,226 timed, 10 dropped).
- No highlight is better than a wrong one. No animation: class swap only, no CSS transition on the highlight.
- Nothing extra loads for people who never press play: the timing file is not in the bundle and not in the SW precache list.
- If the timing file fails to load, recitation plays exactly as today.
- Credit line in Profile → About: word timings from quran-align by Collin Fair, CC BY 4.0.
- AGENTS.md: code files under 300 lines; new files added to `build-files.js`; tests added to `test/run-all.js`.

## Review Focus

1. **Pause/stop mid-word:** the highlight must clear at once, and the rAF loop must stop (no loop left running after stop, surah change or leaving the reader).
2. **Switching verses/recitations quickly:** pressing another verse's play while one is highlighting must never leave a stale highlight on the first verse.
3. **The basmala clip before a surah:** no word lit during it, including in surah 1 where 1:1 *is* the basmala and is played as a verse.
4. **Seek/buffering stalls:** while audio is buffering `currentTime` doesn't advance, so the highlight must hold, not run ahead.
5. **Re-render of the reader while playing** (e.g. known-word colours refresh): the loop must re-find spans by selector each frame or tolerate missing spans, never throw.

Each line has a test in Task 3 or Task 4.

---

### Task 1: Switch verse audio to 64 kbps

**Files:**
- Modify: `js/services/audio.js:18`
- Test: `test/audio.test.js`, `test/e2e/quran-audio.spec.js` (update any `Husary_128kbps` verse URL assertion)

- [ ] **Step 1:** In `test/audio.test.js`, assert `verseAudioUrl(112, 1) === 'https://everyayah.com/data/Husary_64kbps/112001.mp3'` and that `AUDIO_TEACHING_BASE` still contains `Husary_Muallim_128kbps`.
- [ ] **Step 2:** Run `node test/audio.test.js`. Expected: FAIL on the verse URL.
- [ ] **Step 3:** Change `AUDIO_VERSE_BASE` to `'https://everyayah.com/data/Husary_64kbps/'`. Update the e2e spec's URL pattern if it names the folder.
- [ ] **Step 4:** Run `node test/audio.test.js` and `node test/run-all.js`. Expected: PASS.
- [ ] **Step 5:** Commit `Recitation: verse audio at 64 kbps (same recording, half the data)`.

### Task 2: Timing data — build script and generated file

**Files:**
- Create: `scripts/build-recitation-timing.js`
- Create (generated, committed): `js/quran/recitation-timing.js`
- Modify: `build.js` (next to the 4b-i3 map line), `.gitignore` only if needed (raw JSON lives outside the repo)
- Test: `test/recitation-timing-data.test.js`, added to `test/run-all.js`

**Interfaces:**
- Produces: `window.__RECITATION_TIMING = { v: 1, unit: 10, s: { "<surah>": ["<ayah1>", "<ayah2>", ...] } }`. Each ayah string is `"<d1>,<d2>,...;<end>"`: base36 start-time deltas in 10 ms units from the previous word's start (first from 0), `''` for a word the source left out (delta continues from the last timed word), and `<end>` = base36 delta from the last timed word's start to the ayah's last `endMs`. An ayah with no timings is `""`.
- Build output: `js/quran/recitation-timing.min.js`.

- [ ] **Step 1: Write the data test.** Load `js/quran/recitation-timing.js` with `vm` (like `quran-map-data.test.js`). Assert:
  - 114 surahs; each surah's array length equals its verse count from the corpus.
  - Non-empty ayah count is 6,226; the 10 empty ones are exactly 2:181, 8:6, 12:1, 13:37, 15:1, 15:7, 27:20, 36:22, 37:164, 41:47.
  - For each non-empty ayah, the number of comma fields equals the app's whitespace token count for that verse.
- [ ] **Step 2:** Run it. Expected: FAIL (file missing).
- [ ] **Step 3: Implement `scripts/build-recitation-timing.js <path-to-Husary_64kbps.json>`.** Use `require('./build-occurrence-index.js').loadQuranCorpus()` for the app's verse words (split on `/\s+/`, as `build-quran-map.js` does). For each source entry: drop it (write `""`) when the source's highest word index + 1 ≠ the app's token count; otherwise take each segment's `startMs` for word `wordStart` (a multi-word segment lights its first word; the others in it get `''`), keep the last segment's `endMs`. Assert all times are multiples of 10 and exit non-zero otherwise. Print `timed N, dropped M (list)`. Write the file with a header comment naming the source, release and licence.
- [ ] **Step 4:** Run the script against the scratchpad download, then the data test and `node test/run-all.js`. Expected: script prints `timed 6226, dropped 10`; tests PASS. File size about 262 KB.
- [ ] **Step 5:** Add the minify line to `build.js` (`writeFile('js/quran/recitation-timing.min.js', basicMinify(stripComments(readFile('js/quran/recitation-timing.js'))))`). Run `npm run build`. Expected: `dist/js/quran/recitation-timing.min.js` exists. Do **not** add it to the `sw.js` precache list.
- [ ] **Step 6:** Commit `Recitation: word timings for every ayah (quran-align, CC BY 4.0)`.

### Task 3: Decoder and word lookup (pure)

**Files:**
- Create: `js/data-core/recitation-timing.js` (add to `build-files.js` near `quran-map.js`)
- Test: `test/recitation-timing.test.js`, added to `test/run-all.js`

**Interfaces:**
- Consumes: the `__RECITATION_TIMING` shape from Task 2.
- Produces:
  - `recitationWordTimes(timing, surah, ayah) → { starts: (number|null)[], end: number } | null` — ms; `null` when timing is missing, the surah/ayah is absent, or the ayah string is `""`.
  - `recitationWordAt(times, ms) → number` — 0-based index of the last timed word whose start ≤ `ms`; `-1` before the first timed start or at/after `end`.
  - `RECITATION_LEAD_MS = 0` — added to `ms` before the lookup (a constant, not a setting).

- [ ] **Step 1: Write tests** against a real decode of 112:1 from the generated file:
  - `recitationWordTimes(T, 112, 1)` deep-equals `{ starts: [850, 1380, 2100, 3720], end: 4610 }`.
  - `recitationWordAt(t, 0) === -1`, `(t, 849) === -1`, `(t, 850) === 0`, `(t, 1379) === 0`, `(t, 1380) === 1`, `(t, 4609) === 3`, `(t, 4610) === -1`.
  - A hand-made ayah `"a,,b;c"` decodes to `starts: [100, null, 210]`, `end: 330`, and `recitationWordAt` at 150 returns 0 (missing word keeps the previous lit), at 215 returns 2.
  - `recitationWordTimes(T, 2, 181) === null`; `recitationWordTimes(null, 1, 1) === null`; `recitationWordTimes(T, 115, 1) === null`.
  - Stall case (Review Focus 4): calling `recitationWordAt` twice with the same `ms` returns the same index.
- [ ] **Step 2:** Run. Expected: FAIL (functions not defined).
- [ ] **Step 3:** Implement. Cache decoded ayahs in a plain object keyed `"s:a"` so a verse is decoded once.
- [ ] **Step 4:** Run the test and `node test/run-all.js`. Expected: PASS.
- [ ] **Step 5:** Commit `Recitation: decode an ayah's word times and find the word at a moment`.

### Task 4: Follow along in the reader

**Files:**
- Create: `js/ui/quran-follow-along.js` (loader + rAF loop; add to `build-files.js` right after `js/ui/quran-player.js`)
- Modify: `js/services/audio.js` (one accessor), `js/ui/quran-player.js` (start/stop calls), `styles.css` (one rule), `js/profile-ui.js:1142` area (credit line), `js/i18n/strings-en.js` only if the credit uses `t()`
- Test: `test/quran-follow-along.test.js` (added to `test/run-all.js`), `test/e2e/quran-audio.spec.js` (one new case)

**Interfaces:**
- Consumes: `recitationWordTimes`, `recitationWordAt`, `RECITATION_LEAD_MS` (Task 3); `recitation-timing.min.js` (Task 2).
- Produces:
  - `currentAudioElement() → HTMLAudioElement|null` in `audio.js` (returns `_audioEl`).
  - `loadRecitationTiming() → Promise<object|null>` — script-inject of `./js/quran/recitation-timing.min.js`, same pattern as `loadQuranMapData()` (cache the promise; on error reset and resolve `null`).
  - `startFollowAlong(surah, verse)` — begins highlighting `#quran-ayah-{surah}-{verse} [data-n]` against `currentAudioElement()`; no-op if timings are missing.
  - `stopFollowAlong()` — cancels the frame and removes `is-recited` everywhere in `#quran-verses`.

**Behaviour to pin:**
- Each frame: if the audio element is paused or ended, clear the highlight and keep waiting (do not cancel; it may resume); compute `recitationWordAt(times, currentTime*1000 + RECITATION_LEAD_MS)`; if the index changed, move `is-recited` from the old span to the span with `data-n = index + 1` (look it up inside the ayah element each time it changes, so a re-render can't leave a dangling reference). Index `-1` → no span lit.
- `_quranRecite`'s `onEach` calls `startFollowAlong(surah, verse)` for verse clips and `stopFollowAlong()` for the basmala clip (`at < 0`). `_quranRecitationEnded` and `stopQuranRecitation` call `stopFollowAlong()`. Leaving the reader / switching surah already goes through `stopQuranRecitation`; confirm, and add the call where it doesn't.
- `_quranRecite` calls `loadRecitationTiming()` without awaiting it; `startFollowAlong` simply does nothing until the data is there (first verse may start unhighlighted on a slow first load; acceptable, and never wrong).
- CSS: `.quran-ayah [data-n].is-recited` gets an underline-style mark that keeps the word's colour class readable — `box-shadow: inset 0 -2px 0 currentColor; background: var(--gold-soft, rgba(212,175,55,.18)); border-radius: 4px;` and **no** `transition`. Use the app's existing tokens if a gold-tint token exists.
- Credit: a new `pf-about-attrib-line` after the page-index line: `Word timings: <a href="https://github.com/cpfair/quran-align">quran-align</a> by Collin Fair, <a href="{ccBy4}">CC BY 4.0</a>.`

- [ ] **Step 1: Write unit tests** in `test/quran-follow-along.test.js` using a fake DOM (the pattern in `quran-map-ui.test.js`), a fake audio object `{ currentTime, paused, ended }`, a stubbed `requestAnimationFrame` you step by hand, and `window.__RECITATION_TIMING` preset with 112:1:
  - At `currentTime = 1.4`, after one frame, only `[data-n="2"]` in `#quran-ayah-112-1` has `is-recited`.
  - Advancing to `3.8` moves it to `[data-n="4"]`; nothing else is lit.
  - Setting `paused = true` clears all highlights after one frame (Review Focus 1).
  - `stopFollowAlong()` clears highlights and no further frame is requested (Review Focus 1).
  - `startFollowAlong(112, 2)` while 112:1 is lit leaves nothing lit in 112:1 (Review Focus 2).
  - Same `currentTime` across frames keeps the same word lit (Review Focus 4).
  - Removing the ayah element from the fake DOM mid-play: a frame does not throw (Review Focus 5).
  - `startFollowAlong(2, 181)` (no timings) lights nothing and requests no frame.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `quran-follow-along.js`, the `audio.js` accessor, the `quran-player.js` calls, the CSS rule and the credit line. Keep `quran-player.js` under 300 lines.
- [ ] **Step 4:** Run the unit test and `node test/run-all.js`. Expected: PASS.
- [ ] **Step 5: E2E.** In `test/e2e/quran-audio.spec.js`, route `**/Husary_64kbps/**` to a short local silent mp3 fixture (or stub `HTMLMediaElement.prototype.play` the way the existing spec does), open surah 112, press verse 1's play, set the element's `currentTime` to 1.4 via `page.evaluate`, and expect `#quran-ayah-112-1 [data-n="2"]` to have class `is-recited`; press stop and expect no `.is-recited`. Also check surah 112 "Listen": during the basmala clip no `.is-recited` exists (Review Focus 3).
- [ ] **Step 6:** `npm run build`, then the full e2e suite. Expected: all pass.
- [ ] **Step 7:** Commit `Recitation: the word being recited lights up in the reader`.

### Task 5: Timing check against the real audio, then ship

- [ ] **Step 1: Duration check in the browser** (dev preview `bayan-dist`, SW unregistered, caches cleared). For 1:1, 2:255, 36:1, 112:1 and 114:6: play each verse through the app, read `currentAudioElement().duration`, and compare to the decoded `end`. Expected: `duration*1000 ≥ end` and within 1,000 ms of it. Record the numbers in the ledger.
- [ ] **Step 2: Sync check by ear and eye** on 112:1–4 and 1:2–7: watch the highlight with the voice. If words visibly light early or late by a consistent amount, set `RECITATION_LEAD_MS` to the measured offset (ruling in the ledger with the measurements); otherwise leave 0.
- [ ] **Step 3:** Offline check: after playing 112, go offline, reload, play 112:1 — audio plays and highlights from cache.
- [ ] **Step 4:** Screenshots (phone width, light and dark) of a highlighted word.
- [ ] **Step 5:** `git fetch`; `git log HEAD..origin/main` empty; push; confirm Bayan CI and Deploy pass.
