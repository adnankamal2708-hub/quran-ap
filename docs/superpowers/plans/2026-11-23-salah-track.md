# Salah Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fifth learning track, Salah, that teaches the meaning of every word said in the prayer, per the learner's madhab, with a faceless animated figure.

**Architecture:** Mirrors the Qaida track. Data files in `js/salah/` (phrases with sources, lessons, figure poses), a progress module in `js/data-core/salah-track.js` (own key, own review queue, madhab, %), exercise builders over the existing `read-choose` engine, and a lesson screen in `js/ui/salah-ui.js` wired into `TRACK_PATHS`. Quran words feed the normal word review through `rateSRSWord`.

**Tech Stack:** Vanilla ES5-style JS (as the rest of the repo), SVG, node test files run by `test/run-all.js`, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-23-salah-track-design.md`. Figure prototype (approved): scratchpad `figure/salah-figure.html`.

## Global Constraints

- Code files under 300 lines; data files (`js/salah/salah-phrases.js`) exempt. No code in `js/data/`.
- Every new file in `build-files.js`; every new test in `test/run-all.js`.
- All UI text through `t()`, keys in `js/i18n/strings-en.js`.
- No XP, points or leaderboards. No audio for duʿāʾs. No drawn face.
- Madhab ids exactly: `hanafi`, `maliki`, `shafii`, `hanbali`, `unsure`.
- Track id `salah`, last in `TRACK_IDS`. Reading-check pass mark 0.8 (reuse `QAIDA_CHECK_PASS`'s value as `SALAH_CHECK_PASS = 0.8`).
- Never reset or lower progress; merges keep the higher value.
- Meanings are written for Bayan, never copied from sunnah.com's English.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by path only.

## Rulings against the spec

- **Madhab storage.** The spec says `quran_settings`. That object is only the signed-in profile's server settings (`user-service.js` `mergeSettings` keeps only 3 known keys), so guests and offline learners couldn't keep a madhab. Ruling: store `madhab` and `madhabAt` in the Salah progress record (`quran_salah_progress`, synced as `salahProgress`), changed from the Salah path screen ("Your madhab · Change"). Cost if wrong: one move of a field later.
- **Free-tier gate.** `rateSRSWord` refuses to add premium-tier words for free users (returns `false`). Ruling: when it returns `false`, the word goes into the Salah review queue instead, so the whole prayer stays free.

## Review Focus

1. Changing madhab after finishing lessons: % and lesson ticks must not drop; new phrases' words simply count as not yet known.
2. Mālikī learner on Level 3 lesson 1 (no opening duʿāʾ in obligatory prayers): the lesson shows a note and completes, never an empty exercise screen.
3. A Quran passage in the data that drifts from `quran-data.js` (wrong diacritic, missing word): the audit test must fail.
4. Reduced motion on: the figure shows still poses and no `requestAnimationFrame` loop runs.
5. Cloud merge of two devices with different madhab choices: the later `madhabAt` wins; progress takes the higher value.

---

### Task 1: Phrase data and the audit test

**Files:**
- Create: `js/salah/salah-phrases.js`
- Test: `test/salah-data.test.js`

**Interfaces:**
- Produces: `SALAH_MADHABS = ['hanafi','maliki','shafii','hanbali','unsure']`; `SALAH_PHRASES` (array of records below); `getSalahPhrase(id) -> record|null`; `salahPhraseFor(madhab) -> (id) => bool` (true when the phrase has no `madhab` list or lists that madhab); `SALAH_TEACHER_REVIEWED = false`.
- Record shape: `{ id, step, ar, tr, en, words: [{ ar, tr, en, wordId? }], sources: [{ book, number }], madhab?: [...], quran?: { surah, from, to } }`.

Phrase ids (exact): `takbir, taawwudh, basmalah, ruku-tasbih, tasmi, tahmid, sujud-tasbih, between-sajdah, taslim, fatiha, ikhlas, kawthar, asr, falaq, nas, thana-subhanaka, thana-wajjahtu, tashahhud-ibn-masud, tashahhud-ibn-abbas, tashahhud-umar, salawat-ibrahimiyyah, dua-abu-bakr, refuge-four, qunut-hadini, qunut-nastainuka`.

Madhab tags (spec table): `thana-subhanaka` hanafi/hanbali/unsure; `thana-wajjahtu` shafii; `tashahhud-ibn-masud` hanafi/hanbali/unsure; `tashahhud-ibn-abbas` shafii; `tashahhud-umar` maliki; `qunut-hadini` shafii/hanbali/unsure; `qunut-nastainuka` hanafi/maliki. Sources as in the spec's tables (e.g. `{ book: 'Muslim', number: '772' }`; Muwaṭṭaʾ cited by book and chapter).

Quran passages (`fatiha` 1:1–7, `ikhlas` 112:1–4, `kawthar` 108:1–3, `asr` 103:1–3, `falaq` 113:1–5, `nas` 114:1–6, `basmalah` 1:1) carry `quran` and their `words` in reading order.

- [ ] **Step 1: Write the failing tests** in `test/salah-data.test.js` (load pattern as `test/qaida-track.test.js`; load `js/quran/quran-data.js` and `test/load-vocabulary.js` for word ids):
  - `every phrase has ar, tr, en, a step and at least one source with book and number`
  - `every word has ar, tr and en`
  - `phrase ids are unique and match the list above`
  - `Quran passages equal the app's text`: the phrase's `words.map(w => w.ar).join(' ')` equals the whitespace tokens of the ayahs `from..to` joined (compare after the repo's existing Arabic normalisation only if the loader already applies one; otherwise exact).
  - `every wordId exists` (`findWordById(id)` not null).
  - `madhab lists use only known ids`
  - `each madhab gets exactly one thanāʾ (or none for maliki), one tashahhud, and one Witr qunūt`: for `hanafi` → `thana-subhanaka`, `tashahhud-ibn-masud`, `qunut-nastainuka`; `maliki` → none, `tashahhud-umar`, `qunut-nastainuka`; `shafii` → `thana-wajjahtu`, `tashahhud-ibn-abbas`, `qunut-hadini`; `hanbali` → `thana-subhanaka`, `tashahhud-ibn-masud`, `qunut-hadini`; `unsure` → `thana-subhanaka`, `tashahhud-ibn-masud`, `qunut-hadini`.
  - `a drifted Quran passage fails the check`: copy `fatiha`, drop its last word, assert the comparison helper used above returns false.
- [ ] **Step 2: Run** `node test/salah-data.test.js`. Expected: FAIL, `SALAH_PHRASES is not defined`.
- [ ] **Step 3: Write `js/salah/salah-phrases.js`.** Arabic of duʿāʾs typed from the cited collections, fully voweled; Quran words copied from `quran-data.js` tokens; word meanings written for Bayan. Look up `wordId` with `findWordByArabic` for each Quran word and duʿāʾ word that is in the vocabulary; leave it out otherwise.
- [ ] **Step 4: Run** `node test/salah-data.test.js`. Expected: all pass.
- [ ] **Step 5: Add** the file to `build-files.js` (next to the qaida data files) and the test to `test/run-all.js`. Commit: `Salah track: prayer phrases with sources`.

### Task 2: Lessons

**Files:**
- Create: `js/salah/salah-lessons.js`
- Test: `test/salah-lessons.test.js`

**Interfaces:**
- Consumes: `getSalahPhrase`, `salahPhraseFor` (Task 1).
- Produces: `SALAH_LESSONS` (array of `{ id: 's<level>-<number>', level, number, kind: 'lesson'|'check'|'walkthrough', titleKey, phrases: [phraseId], noteKey? }`); `getSalahLesson(id)`; `getSalahLevelLessons(level)`; `salahLessonPhrases(lesson, madhab) -> [record]`.

Lessons exactly as the spec's path (Level 1: 8 lessons, 1.1 is `walkthrough`; Level 2: 8; Level 3: 5; Level 4: 6), then one `check` per level as its last lesson (`s<level>-check`), whose `phrases` are every phrase of the level. Lesson 3.1 lists `thana-subhanaka` and `thana-wajjahtu` and has `noteKey: 'salah.note.malikiThana'`.

- [ ] **Step 1: Failing tests:** `lesson ids unique and numbered 1..n per level`; `every level ends with a check`; `every phrase id exists`; `every phrase appears in some lesson`; `for every madhab, every non-walkthrough lesson resolves to at least one phrase or has a noteKey` (pins Review Focus 2); `maliki lesson s3-1 resolves to [] and has noteKey`.
- [ ] **Step 2: Run** `node test/salah-lessons.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `js/salah/salah-lessons.js`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5:** build-files, run-all, commit `Salah track: lessons`.

### Task 3: Track module, track id and sync

**Files:**
- Create: `js/data-core/salah-track.js`
- Modify: `js/data-core/tracks.js` (`TRACK_IDS`, `isTrackReleased`), `js/services/sync-service.js` (key map line ~107, merge block ~643), `js/app-facts.js` or wherever `getPlanLines` lives (a free-plan line for Salah while released)
- Test: `test/salah-track.test.js`; update `test/app-facts.test.js`

**Interfaces:**
- Consumes: Task 1–2; `scheduleReviewAnswer`, `normalizeReviewMap`, `mergeReviewMaps`, `dueReviewIds`, `normalizeClearedMap`, `mergeClearedMaps`, `dropClearedReviews` (`review-schedule.js`); `getTrackLevel`, `recordTrackPercent`.
- Produces: `SALAH_TRACK_ID = 'salah'`, `SALAH_PROGRESS_KEY = 'quran_salah_progress'`, `SALAH_CHECK_PASS = 0.8`;
  `getSalahMadhab() -> id|null` (null until chosen), `setSalahMadhab(id) -> bool`;
  `getSalahLevels()` (same shape as `getQaidaLevels`, `kind: 'salah'`), `getSalahLevelLock(level)`, `getSalahLevel()`, `isSalahLessonUnlocked(id)`, `completeSalahLesson(id, score)`;
  `salahWordKey(word) -> word.wordId || 'salah:' + word.ar`;
  `recordSalahWord(word, correct, now)` (correct → `known[key] = now`; wrong → remove from `known`, and Quran words go to `rateSRSWord(wordId, 0)`, falling back to the Salah queue when it returns `false`; non-Quran words go to the Salah queue);
  `getDueSalahWords(now) -> [key]`; `getSalahPercent() -> number` (known over distinct word keys of all lessons for the current madhab, `unsure` when null, 0..100, 1 decimal); `refreshSalahPercent() -> { percent, gained }`; `mergeSalahProgress(local, cloud)`.
- Progress shape: `{ completed: { id: { at, score } }, known: { key: at }, review, cleared, madhab, madhabAt, updatedAt }`.

- [ ] **Step 1: Failing tests:** level shape and order; first lesson open, second locked until first done; check needs 0.8; `setSalahMadhab('x')` returns false; madhab survives reload; **changing madhab keeps completed lessons and never lowers stored percent** (Review Focus 1: complete s1 lessons under `hanafi`, record %, switch to `shafii`, assert `getTrackPercent('salah')` unchanged and completed ids unchanged); wrong answer on a Quran word calls `rateSRSWord(id, 0)` (stub); stubbed `rateSRSWord` returning false puts the key in the Salah queue; **merge: later `madhabAt` wins, completed and known union, review merged** (Review Focus 5); corrupt storage loads as empty; old `quran_tracks` without `salah` normalises with `salah` not joined.
- [ ] **Step 2: Run** `node test/salah-track.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `salah-track.js`; add `'salah'` last in `TRACK_IDS`; `isTrackReleased` returns true for `'salah'`; sync key `salahProgress: 'quran_salah_progress'` and a merge block copying the qaida one; plan line `plan.free.salah` ("Understand every word of your prayer").
- [ ] **Step 4: Run** `node test/salah-track.test.js && node test/app-facts.test.js && node test/run-all.js`. Expected: all pass (fix any test that pinned `TRACK_IDS.length === 4`).
- [ ] **Step 5:** build-files (after `qaida-track.js`), run-all, commit `Salah track: progress, madhab and sync`.

### Task 4: Exercises

**Files:**
- Create: `js/salah/salah-exercises.js`
- Test: `test/salah-exercises.test.js`

**Interfaces:**
- Consumes: Task 1–3; `qaidaRandom`, `qaidaShuffle` (`qaida-exercises.js`) for seeded randomness.
- Produces: `buildSalahLessonItems(lesson, seed, madhab) -> [item]`; `buildSalahReviewItem(key, seed) -> item|null`. Items are `read-choose` (`{ type, prompt, options, answer, word?, figure? }`), `word` being the word record for `recordSalahWord`.

Mix per lesson: one word-meaning item per distinct word of the lesson's phrases (prompt the Arabic word; options its meaning plus 3 meanings of other words, distinct, from the whole data), then one whole-phrase item per phrase (Arabic phrase → its `en`, distractors from other phrases). Walkthrough lesson: one figure item per step (`figure: poseId`, prompt `t('salah.figure.which')`, options position names). Check: the word items of the whole level, capped at 20, picked by the seed.

- [ ] **Step 1: Failing tests:** same seed → same items (deterministic); options unique, 4 each, answer index points at the right meaning; no option equals another word's identical meaning text (dedupe by text so no question has two right answers); lesson for `maliki` s3-1 returns `[]`; check ≤ 20 items; every word item carries `word`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5:** build-files (near `qaida-exercises.js`), run-all, commit `Salah track: exercises`.

### Task 5: The figure

**Files:**
- Create: `js/salah/salah-figure-poses.js`, `js/ui/salah-figure.js`
- Test: `test/salah-figure.test.js`

**Interfaces:**
- Produces: `SALAH_POSE_IDS = ['takbir','qiyam','ruku','itidal','sujud','jalsa','tashahhud','taslim']`; `getSalahPoses(madhab) -> [pose]` (adds `raise` after `qiyam` and after `ruku` for `shafii` and `hanbali`; `qiyam` hands: `maliki` at sides, `hanafi`/`hanbali` low, `shafii`/`unsure` chest); `salahFigureSvg(poseId, madhab) -> string`; `mountSalahFigure(host, madhab, opts) -> { show(poseId), destroy() }` (animates between poses with `requestAnimationFrame`, cubic ease, MOVE 1000 ms, HOLD 2600 ms; still poses when `prefers-reduced-motion: reduce`).

Carry over the prototype's kinematics (lengths, half widths, `body`, `lowest`, `ik`, `resolveArm`, frame packing, centring on extent). Poses data in `salah-figure-poses.js`, drawing in `salah-figure.js`; colours from CSS custom properties (`--salah-cloth` etc. in `styles.css`, light and dark), `role="img"` with an `aria-label` from `t()`.

- [ ] **Step 1: Failing tests:** every pose renders an `<svg` with no `NaN`; the lowest point of every pose sits on the ground line (±0.5); in `ruku` the near wrist is within 6 units of the near knee; in `sujud` forehead, near palm, near knee and near toe are each within 3 units of the ground; `maliki` qiyam wrists are below the hip, `shafii` qiyam wrists above it; `getSalahPoses('shafii')` includes `raise` twice and `hanafi` none; **reduced motion: `mountSalahFigure` with a stubbed `matchMedia` returning matches never calls the stubbed `requestAnimationFrame`** (Review Focus 4); no `<circle` or path inside the head group other than the head and kufi (no face).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** both files, each under 300 lines.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5:** build-files, run-all, commit `Salah track: prayer figure`.

### Task 6: Screens and wiring

**Files:**
- Create: `js/ui/salah-ui.js` (and `js/ui/salah-madhab-ui.js` if `salah-ui.js` would pass 300 lines)
- Modify: `index.html` (`<section class="mode-view" id="view-salah-lesson" aria-label="Salah lesson">` beside `view-qaida-lesson`; register the view wherever `qaida-lesson` is registered in `navigation.js`), `js/ui/tracks-ui.js` (`TRACK_PATHS.salah`, `_openPathLesson` `'salah'`), `js/ui/review-center.js` (a due card like `_rcQaidaDue`), `js/i18n/strings-en.js`, `styles.css`
- Test: `test/salah-ui.test.js` (pattern of `test/qaida-ui.test.js`)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `startSalahLesson(id)`, `renderSalahLesson()`, `openSalahMadhabPicker(onDone)`.

Behaviour: opening the track (or any lesson) with no madhab shows the picker first (five choices, each with one line; `unsure` notes that the majority view is shown and the others are valid). Lesson screen: intro (figure for the phrase's step, Arabic, transliteration, word-by-word table, meaning, sources line, the lesson's note if any) → practice (`renderExercise`, `recordSalahWord` on each answer) → finish (score, % gained via `refreshSalahPercent`). A lesson with no items after the intro completes on "Done". Walkthrough: the figure with step chips. Teacher note `t('salah.teacherReview')` on the track card and Level 3–4 intros while `SALAH_TEACHER_REVIEWED` is false. Path header shows "Your madhab: <name> · Change". `TRACK_PATHS.salah.percentKey = 'percent.salah'` ("{p}% of the words in your prayer").

- [ ] **Step 1: Failing tests:** no madhab → picker markup shown, not the lesson; intro shows Arabic, every word's meaning and the source line; Mālikī s3-1 intro shows the note and its finish button completes the lesson (Review Focus 2); teacher note present while not reviewed and absent when the flag is true; picker choice saves the madhab.
- [ ] **Step 2: Run** `node test/salah-ui.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, strings and styles (existing design tokens, mobile first).
- [ ] **Step 4: Run** `node test/salah-ui.test.js && node test/run-all.js`. Expected: PASS.
- [ ] **Step 5:** build-files, run-all, commit `Salah track: lesson screens`.

### Task 7: End to end, audit and release

**Files:**
- Create: `test/e2e/salah.spec.js`
- Modify: `docs/learning-tracks-design.md` (add the Salah track and its open teacher review)

- [ ] **Step 1: Write the e2e spec** (pattern of `test/e2e/qaida.spec.js`): join Salah → picker → choose Ḥanafī → lesson 1.1 walkthrough shows the figure → lesson 1.2 intro shows "اللهُ أَكْبَرُ" → answer all → finish shows a % → path shows lesson done → change madhab to Shāfiʿī → lesson still done; offline reload still opens the lesson.
- [ ] **Step 2: Run** `npm run build && npx playwright test test/e2e/salah.spec.js`. Expected: PASS.
- [ ] **Step 3: Manual audit** in the preview at 375 px, light and dark, every lesson in all five madhabs: Arabic renders with its diacritics, no overflow, figure matches the step, sources present. Fix and re-run the unit tests for anything found.
- [ ] **Step 4: Full suite** `node test/run-all.js` then the full e2e suite. Expected: all pass.
- [ ] **Step 5:** commit the docs change, `git fetch`, confirm `git log HEAD..origin/main` is empty, push, wait for Bayan CI and "Build, Validate & Deploy" to succeed.
