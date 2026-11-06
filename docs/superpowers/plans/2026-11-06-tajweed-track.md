# Tajweed Track (makhārij and fluent recitation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Tajweed track: 12 Beginner makhārij lessons, private record-and-compare practice, whole-Quran verse practice with Al-Husary's teaching recitation, its review queue, placement test and progress. It stays hidden until all 28 letter recordings exist.

**Architecture:** Mirrors the Qaida track. Data files in `js/tajweed/` and a track module, `js/data-core/tajweed-track.js`, hold progress, locks, percent and the review queue. A small shared scheduler, `js/data-core/review-schedule.js`, is extracted from Qaida's queue. A microphone service, `js/services/recorder.js`, records on the device. The screens are a lesson and verse-practice view, `js/ui/tajweed-ui.js`, wired into the existing track and placement registries and the Practice tab.

**Tech Stack:** Vanilla ES6 scripts concatenated by `build.js` (`build-files.js` lists them), MediaRecorder, the existing exercise engine, placement engine and audio service. Tests: plain Node test files (eval-load sources, local `test()` helper, listed in `test/run-all.js`) and Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-06-tajweed-track-design.md` (approved 2026-11-06). Background: `docs/learning-tracks-design.md`.

## Global Constraints

- No XP, points or leaderboards. Progress is a percentage of the Quran that only grows (`recordTrackPercent`).
- All English text in `js/i18n/strings-en.js` via `t()`, keys under `tajweed.*`, `percent.tajweed*`, `test.tajweed.*`, `drill.tajweed.*`. No English in data files.
- No synthetic or AI voices. Letter audio comes only from `QAIDA_AUDIO_MANIFEST` files in `assets/audio/qaida/`, one per letter id, in the form أَ + letter + sukūn.
- Recordings stay in memory on the device. Nothing is uploaded, synced or written to storage. The microphone is requested only on the first tap of Record.
- New progress goes in a new key, `quran_tajweed_progress`, synced as `tajweedProgress`. Nothing existing changes.
- Review ids are namespaced: `tj-letter:<letterId>` and `tj-verse:<surah>:<ayah>`. Schedule: retry after 10 minutes, then 1, 3, 7, 21 days (the Qaida values).
- The reading check passes at 0.8.
- Verse practice uses `https://everyayah.com/data/Husary_Muallim_128kbps/SSSAAA.mp3`. The murattal elsewhere is unchanged.
- No teacher-review note on Tajweed.
- Files are LF or CRLF as they already are; match each file. One logical change per commit. Check `git log HEAD..origin/main` before pushing; stage only this task's files; never stage `output/`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After every task: `node test/run-all.js`, `node test/dry-load.js`, `node test/comment-lint.js` all pass; `npm run build` succeeds.

## Review Focus

1. **No microphone, or access refused:** Record shows a short message, and Play, Compare-free practice and self-marking still work. Pinned in Task 6 (recorder unit tests) and Task 8 (UI test with the recorder reporting unsupported).
2. **A letter without its recording:** the intro card shows the letter and makhraj with no Play or Compare, and audio exercises are left out. Pinned in Task 7 (`buildTajweedLessonItems` with an empty manifest) and Task 8.
3. **Recording twice:** the previous recording's object URL is revoked and Compare plays only the newest. Pinned in Task 6.
4. **Verse practice past the last verse, or a verse the loader can't fetch offline:** a finished message or the existing "text could not be loaded" message, never a blank screen. Pinned in Task 8.
5. **Progress on two devices:** merge keeps every completed lesson, every "Smooth" verse (earliest time) and the less advanced review copy; the percent never drops after a merge. Pinned in Task 5.

---

### Task 1: Extract the review scheduler shared by Qaida and Tajweed

**Files:**
- Create: `js/data-core/review-schedule.js`
- Modify: `js/data-core/qaida-track.js` (use the shared scheduler; behaviour unchanged), `build-files.js` (add before `qaida-track.js`)
- Test: `test/review-schedule.test.js` (new, add to `test/run-all.js`); `test/qaida-track.test.js` must still pass unchanged

**Interfaces:**
- Produces:
  - `REVIEW_RETRY_MS = 600000` and `REVIEW_DAYS = [1, 3, 7, 21]`. Keep `QAIDA_REVIEW_RETRY_MS` and `QAIDA_REVIEW_DAYS` as aliases of these.
  - `scheduleReviewAnswer(rec, correct, now) -> {due, step} | null | undefined`. `null` means leave the queue; `undefined` means no change.
  - `normalizeReviewMap(src, isValidId) -> {id: {due, step}}`
  - `mergeReviewMaps(a, b) -> map`, keeping the lower step, then the earlier due.
  - `dueReviewIds(map, now) -> string[]`, most overdue first.

- [ ] **Step 1: Write the failing tests** in `test/review-schedule.test.js`:
  - a miss gives `{due: now + 600000, step: 0}`
  - a right answer on a due step-k record gives `{due: now + REVIEW_DAYS[k]*86400000, step: k+1}`
  - a right answer at step 4 gives `null`
  - a right answer on a record that isn't due, or isn't present, gives `undefined`
  - `normalizeReviewMap` drops bad `due`, a step outside `0..4`, and ids that `isValidId` rejects
  - `mergeReviewMaps` and `dueReviewIds` behave as the `qaida-track.test.js` review tests already describe
- [ ] **Step 2: Run** `node test/review-schedule.test.js`. Expected: FAIL, `scheduleReviewAnswer is not defined`.
- [ ] **Step 3: Implement** the four functions by moving the logic out of `recordQaidaAnswer`, `_normalizeQaidaReview`, `mergeQaidaProgress` (its review part) and `getDueQaidaSkills`, which now call them.
- [ ] **Step 4: Run** `node test/review-schedule.test.js && node test/qaida-track.test.js && node test/run-all.js`. Expected: all pass.
- [ ] **Step 5: Commit** "Share the review schedule between tracks".

### Task 2: Makhārij data and Beginner lessons

**Files:**
- Create: `js/tajweed/tajweed-makharij.js`, `js/tajweed/tajweed-lessons.js`
- Modify: `js/i18n/strings-en.js`, `build-files.js` (after the `js/qaida/*` data files)
- Test: `test/tajweed-data.test.js` (new, add to run-all)

**Interfaces:**
- Consumes: `QAIDA_LETTERS`, `getQaidaLetter(id)` (`js/qaida/qaida-letters.js`).
- Produces:
  - `TAJWEED_AREAS = ['throat', 'tongue', 'lips', 'nose', 'cavity']`.
  - `TAJWEED_MAKHARIJ`: one entry per letter id, `{ letter, area, point }`. `point` is a string id; the standard 17 points.
  - `TAJWEED_QUALITIES`: `{ heavy: [letterIds], qalqalah: [...], whispered: [...] }`.
  - `TAJWEED_CONFUSED_PAIRS = [['hha','ha'], ['ain','hamza']…]`. hamzah is the `hamza` skill.
  - `TAJWEED_LESSONS`: 12 entries `{ id: 'tj0-1'..'tj0-12', level: 0, number, kind: 'lesson'|'check', letters: [letterIds], topic: 'areas'|'points'|'qualities'|'confused'|'check' }`.
  - `getTajweedLesson(id)`, `getTajweedLevelLessons(level)`.
- Strings: `tajweed.area.<area>.name/desc`, `tajweed.point.<point>` (one line on where the sound comes from), `tajweed.quality.<q>.name/desc`, `tajweed.lesson.<id>.title`.

- [ ] **Step 1: Write the failing tests:**
  - every one of the 28 letters has exactly one makhraj and its area is in `TAJWEED_AREAS`
  - the qalqalah letters are exactly `qaf, tta, ba, jim, dal`
  - the heavy letters are exactly `kha, sad, dad, ghayn, tta, qaf, zza`
  - the lesson ids are `tj0-1..tj0-12`, numbered 1..12, with one `check` and it comes last
  - lessons 2–8 together teach all 28 letters once, in the spec's grouping (throat; back; middle; side and edge; tip; lips; cavity)
  - every `t()` key the data implies exists in `strings-en.js`
- [ ] **Step 2: Run** `node test/tajweed-data.test.js`. Expected: FAIL (not defined).
- [ ] **Step 3: Write the data and strings.** Lesson titles follow the spec list ("The five areas", "Throat letters", …, "Reading check"). Point descriptions are one plain sentence each. Mark the file header comment: "Content to be checked by the owner before release".
- [ ] **Step 4: Run** the test and `node test/run-all.js`. Expected: PASS.
- [ ] **Step 5: Commit** "Add the makharij data and the Tajweed Beginner lessons".

### Task 3: Verse word counts for the progress figure

**Files:**
- Create: `scripts/build-verse-word-counts.js`, generated `js/tajweed/verse-word-counts.js`
- Modify: `build-files.js`
- Test: `test/verse-word-counts.test.js` (new, add to run-all)

**Interfaces:**
- Produces:
  - `VERSE_WORD_COUNTS`: `{ <surah>: number[] }`, where index `ayah-1` gives the word count.
  - `QURAN_WORD_TOTAL = 77429`.
  - `verseWordCount(surah, ayah) -> number`, 0 when unknown.

- [ ] **Step 1: Write the failing tests:**
  - the counts sum to exactly `77429` (the corpus figure already asserted for coverage)
  - there are 114 surahs and 6236 verses in all
  - `verseWordCount(1, 1) === 4`
  - `verseWordCount(115, 1) === 0`
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Write the generator.** Count words exactly as `scripts/build-qaida-readability.js` does, and write a compact file with a "generated, do not edit" header. Run it.
- [ ] **Step 4: Run** the test and run-all. Expected: PASS.
- [ ] **Step 5: Commit** "Add per-verse word counts for the Tajweed progress figure".

### Task 4: Tajweed track module: progress, locks, review, percent, sync

**Files:**
- Create: `js/data-core/tajweed-track.js`
- Modify: `js/services/sync-service.js` (key map `tajweedProgress: 'quran_tajweed_progress'`, plus a merge branch beside the Qaida one), `js/data-core/tracks.js` (`isTrackReleased`), `build-files.js`
- Test: `test/tajweed-track.test.js` (new, add to run-all); `test/services.test.js` (one merge test)

**Interfaces:**
- Consumes: Task 1 (scheduler), Task 2 (`TAJWEED_LESSONS`, `getTajweedLesson`), Task 3 (`verseWordCount`, `QURAN_WORD_TOTAL`); `getTrackLevel`, `recordTrackPercent`, `queueTracksSync`, `TRACK_LEVEL_COUNT`; `qaidaAudioUrl(letterId)`.
- Produces:
  - `TAJWEED_TRACK_ID = 'tajweed'`, `TAJWEED_PROGRESS_KEY = 'quran_tajweed_progress'`, `TAJWEED_CHECK_PASS = 0.8`.
  - Progress: `loadTajweedProgress() -> {completed, review, smooth, updatedAt}` and `mergeTajweedProgress(local, cloud)`.
  - Lessons: `completeTajweedLesson(id, score) -> boolean` (true when newly finished), `getTajweedLevels()` (track-screen shape, `kind: 'tajweed'`), `getTajweedLevelLock(level) -> null|'progress'|'coming'`, `getTajweedLevel()`, `getTajweedNextLesson(level)`, `isTajweedLessonUnlocked(id)`.
  - Letters covered: `getTajweedLettersCovered() -> number` (0..28; letters in finished lessons, plus all 28 when placed above level 0).
  - Verses: `markTajweedVerse(surah, ayah, smooth, now)`, `getNextTajweedVerse() -> {surah, ayah}|null` (the next not-smooth verse in `TAJWEED_VERSE_ORDER`, which is [1], then 114 down to 78, then 2 to 77).
  - Percent: `getTajweedPercent() -> number` (smooth words / 77429 * 100, rounded to 0.1), `refreshTajweedPercent()`.
  - Review: `recordTajweedReview(id, ok, now)` and `getDueTajweedItems(now) -> string[]`.
  - Release: `areLetterRecordingsComplete() -> boolean`.
- `isTrackReleased(id)` becomes `id === 'words' || id === 'qaida' || (id === 'tajweed' && typeof areLetterRecordingsComplete === 'function' && areLetterRecordingsComplete())`.

- [ ] **Step 1: Write the failing tests:**
  - Levels 1–3 lock as `'coming'`, and Beginner is open.
  - Lessons open in order.
  - A check scoring 0.79 isn't completed; one scoring 0.8 is.
  - `getTajweedLettersCovered()` counts the letters of finished lessons only, reaches 28 after lessons 2–8, and is 28 after placement at level 1.
  - `markTajweedVerse(1,1,true)` raises the percent by 4/77429*100 (rounded), and marking it again changes nothing.
  - `markTajweedVerse(1,2,false)` adds `tj-verse:1:2` to the review queue, and a later smooth mark removes it.
  - `getNextTajweedVerse()` starts at 1:1, moves to 114:1 after Al-Fātiḥah's 7 verses, and returns null when everything is smooth.
  - `recordTajweedReview` rejects ids outside the two namespaces.
  - The merge keeps the union of completed lessons and smooth verses (earliest time each) and the less advanced review copy, and the percent after a merge is ≥ both sides.
  - Corrupt storage falls back to empty.
  - `isTrackReleased('tajweed')` is false with an empty manifest and true when all 28 letter ids are in it.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement**, mirroring `js/data-core/qaida-track.js`. A smooth mark clears the verse's review entry; a not-yet mark schedules it as a miss.
- [ ] **Step 4: Run** the test, `test/services.test.js` and run-all. Expected: PASS.
- [ ] **Step 5: Commit** "Add the Tajweed track module: progress, review, percent and sync".

### Task 5: On-device recorder and the teaching recitation

**Files:**
- Create: `js/services/recorder.js`
- Modify: `js/services/audio.js` (add `AUDIO_TEACHING_BASE = 'https://everyayah.com/data/Husary_Muallim_128kbps/'` and `teachingVerseAudioUrl(surah, ayah)`; update the header comment), `build-files.js`
- Test: `test/recorder.test.js` (new, add to run-all); `test/audio.test.js` (one URL test)

**Interfaces:**
- Consumes: `playAudio(url, onEnd)`, `stopAudio()`.
- Produces:
  - `isRecordingSupported() -> boolean` (`navigator.mediaDevices.getUserMedia` and `MediaRecorder` exist).
  - `startRecording() -> Promise<'recording'|'denied'|'unsupported'>`. It asks for the microphone only here.
  - `stopRecording() -> Promise<string|null>`, an object URL. It revokes the previous URL and stops the mic tracks.
  - `getRecordingUrl() -> string|null`.
  - `playComparison(referenceUrl, onDone)`: the reference, then the recording.
  - `discardRecording()`.

- [ ] **Step 1: Write the failing tests** with stubbed `navigator`, `MediaRecorder` and `URL`:
  - unsupported returns `'unsupported'` and never calls getUserMedia
  - a rejected getUserMedia returns `'denied'`
  - start, then stop, gives a URL
  - recording a second time revokes the first URL
  - `playComparison` calls `playAudio(reference)` and then `playAudio(recording)` from the first one's `onEnd`
  - `teachingVerseAudioUrl(1, 1)` ends with `Husary_Muallim_128kbps/001001.mp3`
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep chunks in memory only.
- [ ] **Step 4: Run** the tests and run-all. Expected: PASS.
- [ ] **Step 5: Commit** "Add on-device recording and the teaching recitation".

### Task 6: Tajweed exercises and placement bank

**Files:**
- Create: `js/tajweed/tajweed-exercises.js`
- Modify: `js/i18n/strings-en.js`, `build-files.js` (beside `qaida-exercises.js`)
- Test: `test/tajweed-exercises.test.js` (new, add to run-all)

**Interfaces:**
- Consumes: Task 2 data; `qaidaRandom`, `qaidaShuffle` (`qaida-exercises.js`); `qaidaAudioUrl`; `validateExercise`.
- Produces:
  - `buildTajweedLessonItems(lesson, seed) -> item[]`. Each item carries `skill: 'tj-letter:<id>'` and `tag`.
  - `buildTajweedBank(attempt) -> {0: item[], 1: [], 2: [], 3: []}`. Only level 0 has items; the empty higher levels mean placement can't go past Beginner.
- Item kinds:
  - "Where does this letter come from?" (the area)
  - "Which of these letters is heavy / has qalqalah / is whispered?"
  - "Which point?", for the points lessons
  - Two kinds only when the recordings exist: `listen-choose` "Hear a letter, pick it", and the confused-pair listen.

- [ ] **Step 1: Write the failing tests:**
  - every item for every lesson and seed passes `validateExercise`
  - the answer is always among the options
  - output is deterministic per seed
  - with an empty manifest there are no `listen-choose` items, and with all letters present there are some
  - the distractors for an area question include a letter from a neighbouring area
  - the bank's level 0 has ≥ 8 valid items, and retakes differ
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement**, following `js/qaida/qaida-exercises.js`.
- [ ] **Step 4: Run** the tests and run-all. Expected: PASS.
- [ ] **Step 5: Commit** "Add Tajweed exercises and the placement bank".

### Task 7: Tajweed lesson and verse-practice screens

**Files:**
- Create: `js/ui/tajweed-ui.js`, and `styles.css` additions (a section headed "Tajweed (js/ui/tajweed-ui.js)")
- Modify: `index.html` (add `<section class="mode-view" id="view-tajweed-lesson" aria-label="Tajweed lesson"></section>` beside `view-qaida-lesson`); `js/validation.js`, `js/ui/dom-helpers.js` and `js/ui/navigation.js` (register `tajweed-lesson` exactly as `qaida-lesson` is, under `tab-learn`); `js/i18n/strings-en.js`; `build-files.js`
- Test: `test/tajweed-ui.test.js` (new, add to run-all), with the DOM stubbed like `test/qaida-ui.test.js`

**Interfaces:**
- Consumes: Tasks 4–6, and `renderExercise`, `playAudio`, `qaidaAudioUrl`, `audioCreditHtml`, `cacheAudio`, `window.__quranLoader`.
- Produces:
  - `startTajweedLesson(lessonId, seed)`
  - `startTajweedVersePractice()`
  - `renderTajweedPracticeCard(host, id)`, where `id` is `tj-letter:x` or `tj-verse:s:a`. It's the shared card used by lesson intros, verse practice and review.
- Screens:
  - **Lesson intro:** one card per letter with the letter, name, makhraj line, Play (only with audio), Record and Compare (Compare only after a recording), and Got it / Not yet.
  - **Exercises:** the Task 6 items through `renderExercise`.
  - **Finish:** "<lesson title> done · N of 28 letters covered" (`tajweed.done`), then Next lesson. The check needs 0.8 and offers a retry below it.
  - **Verse practice:** the verse text, Listen (teaching recitation) with the credit line, Record, Compare, then Smooth / Not yet. Smooth shows "+x%" when the figure grew. When none is left, `tajweed.verses.done`. When the text can't load, the existing `drill.unavailable` string.
- Answers: Not yet calls `recordTajweedReview(id, false)` and Got it calls `(id, true)`. Lesson exercise answers call `recordTajweedReview(item.skill, correct)`.

- [ ] **Step 1: Write the failing tests:**
  - the intro shows no Play or Compare for a letter without audio
  - with the recorder unsupported, Record shows `tajweed.record.unsupported` and Got it / Not yet still work
  - Not yet records a miss for `tj-letter:ha`
  - finishing lesson tj0-2 shows "6 of 28 letters covered"
  - a check below 0.8 isn't recorded and offers a retry
  - verse practice marks smooth via `markTajweedVerse` and shows the gained percent
  - when everything is smooth it shows the done message
  - a failed verse load shows `drill.unavailable`
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement**, following `js/ui/qaida-ui.js`: click delegation through `data-action`, and every text through `t()`/`_qEsc`-style escaping. Buttons and spacing come from the existing `qaida-*` classes where they fit.
- [ ] **Step 4: Run** the tests and run-all. Expected: PASS.
- [ ] **Step 5: Commit** "Add the Tajweed lesson and verse-practice screens".

### Task 8: Wire Tajweed into Learn, Practice, Home and placement

**Files:**
- Modify:
  - `js/ui/tracks-ui.js`: a `TRACK_PATHS.tajweed` entry with `percentKey: 'percent.tajweed'` and no `note`; the `'coming'` lock renders `tracks.comingLater` as a plain label; lesson kind `'tajweed'` opens `startTajweedLesson`; a path footer link for verse practice.
  - `js/ui/placement-ui.js`: a `PLACEMENT_TRACKS.tajweed` entry.
  - `js/ui/review-center.js`: a Due today "Tajweed practice · N to review" card that runs due items one at a time in its own host via `renderTajweedPracticeCard`; a Drills card "Verse practice" when Tajweed is released; a Tests card `rc-test-tajweed`.
  - `js/ui/dashboard.js`: Up next shows `getTajweedNextLesson` when Tajweed is the main track.
  - `js/i18n/strings-en.js`.
- Test: extend `test/tracks-ui.test.js`, `test/review-center.test.js`, `test/placement-ui.test.js` and `test/dashboard.test.js`

**Interfaces:**
- Consumes: Tasks 4–7.

- [ ] **Step 1: Write the failing tests** (each stubs `isTrackReleased` to include `tajweed`):
  - the path shows Beginner's 12 lessons and "Coming later" on levels 1–3, with no upgrade button
  - a lesson button opens `startTajweedLesson`
  - the Due today Tajweed card shows the count and is hidden at 0
  - the Drills "Verse practice" card starts verse practice
  - the Tests card starts `startPlacementTest('tajweed')`
  - Home's Up next names the next Tajweed lesson when it's the main track
  - with Tajweed unreleased, none of these appear
- [ ] **Step 2: Run** those test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them and run-all. Expected: PASS.
- [ ] **Step 5: Commit** "Show the Tajweed track in Learn, Practice, Home and Tests".

### Task 9: Recording guide, credits, docs and e2e

**Files:**
- Create: `docs/recording-letters.md`, `test/e2e/tajweed.spec.js`
- Modify:
  - `js/qaida/qaida-audio-manifest.js`: a header comment pointing to the guide.
  - The Sources & credits page (Profile → About; locate it with `grep -n "credits" js`): add "Al-Husary, muʿallim recitation · everyayah.com".
  - `docs/learning-tracks-design.md`: Phase 3 status; the "Accuracy before release" principle notes Tajweed's owner decision; Tajweed progress is now "words in verses marked Smooth"; open items.
- Test: the e2e spec

- [ ] **Step 1: Write `docs/recording-letters.md`:**
  - the 28 lines `letterId · Arabic (أَبْ…) · file name <letterId>.mp3`
  - the format: mono MP3 or M4A, a quiet room, about 1 second each
  - where files go (`assets/audio/qaida/`) and the manifest line to add (`ba: 'ba.mp3',`)
  - that the track appears once all 28 are listed
- [ ] **Step 2: Write `test/e2e/tajweed.spec.js`.** Call `startTajweedLesson('tj0-2')` directly, since the track is unreleased without recordings, and check:
  - the intro shows 6 letter cards with no Play button
  - answering the exercises reaches "6 of 28 letters covered"
  - `startTajweedVersePractice()` shows Al-Fātiḥah 1:1 with a Listen button, and Smooth moves on to 1:2
  - no page errors
- [ ] **Step 3: Run** `npx playwright test tajweed`. Expected: PASS. Then run the full e2e suite in chunks of under 10 minutes. Expected: all pass.
- [ ] **Step 4: Screenshot** the intro, finish, verse practice and Due today card at 390×844 and 1440×900, dark and light. Fix anything that overflows.
- [ ] **Step 5: Commit** "Add the letter recording guide, credits and Tajweed e2e", then push after checking `git log HEAD..origin/main`.
