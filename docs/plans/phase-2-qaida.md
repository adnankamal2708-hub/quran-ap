# Phase 2: Qaida Implementation Plan

**Goal:** Add the "Read Arabic from zero" (Qaida) track: letter and mark data, lessons in Noorani order, the "% of the Quran you can read" figure, audio with slots, Qaida exercises and lesson screen, and the Qaida placement test.

**Spec:** [docs/learning-tracks-design.md](../learning-tracks-design.md)

## Context

Phase 1 built the track system with one live track, Word meanings. The user now wants Qaida added: the first new learning content, for complete beginners who can't yet read Arabic. Most decisions were already made and are recorded in `docs/learning-tracks-design.md` (Qaida levels, exercise types, Progress, Audio, Placement tests). This plan turns them into work.

The user said not to wait for the audio-permission replies. Gmail checked 2026-11-03: no replies yet.
- **Verse audio:** everyayah.com's stated terms are "credit and link back". We use Al-Husary now, with the credit line and a Sources & credits page.
- **Letter audio:** Quran In Depth's recordings are "all rights reserved", so they are **not** used. Default chosen (the user didn't pick): every letter and mark gets an **audio slot**. A recording dropped into `assets/audio/qaida/` switches it on with no code change. Until then lessons use the audio-free exercises. Nothing synthetic or AI-voiced.
- **Teacher review:** the design says Qaida stays unreleased until a qualified teacher approves it. Default here: the track is built and released. Its path shows a quiet line, "These lessons are awaiting review by a qualified teacher", which is removed after review. Flip `isTrackReleased('qaida')` to hide it if the user prefers.

## What exists to reuse (from exploration)

- **`js/data-core/tracks.js`:**
  - `TRACK_IDS` already includes `'qaida'`.
  - `isTrackReleased` (:27) is `id === 'words'`.
  - Also reuse: `joinTrack`, `setMainTrack`, `raiseTrackLevel`, `recordTrackPercent` (only grows, returns `gained`), `setStartFromZero`, `nextPlacementAttempt`, `mergeTrackState`.
- **`js/data-core/word-meanings-track.js`:** the API shape to mirror (`get…Levels`, `get…LevelLock`, `get…Level`, `get…NextLesson`, `refresh…Percent`).
- **Exercise engine (`js/exercises/exercise-engine.js`, `js/ui/exercise-ui.js`):**
  - Item types: `read-choose`, `build`, `spot`, plus `checkExercise` and `validateExercise`.
  - View builders: `EXERCISE_VIEW_BUILDERS`.
  - Arabic is auto-detected and marked `lang="ar"`.
- **Placement engine (`js/exercises/placement.js`):** `createPlacementTest(bank)` is generic; the bank shape is `{0..3: Item[]}`.
- **Lesson runner pattern (`js/ui/root-lesson-ui.js`):** step through exercises, then show `+x%` at the end.
- **Sync (`js/services/sync-service.js:106`):** the key map plus merge (:634) is the pattern for a new synced key.
- **Normalizers:** `OCCURRENCE_INDEX_NORM` (`js/data/occurrence-index.js`) and the lazy Quran text (`js/quran/quran-data.js`, `window.__quranLoader`).
- **Text and tests:** strings via `t()` in `js/i18n/strings-en.js`; tests follow `test/tracks.test.js` (eval-load, local `test()` helper, add to `test/run-all.js`).

## Places hard-wired to `'words'` that must take a track id

- `tracks-ui.js`: `_trackPercent` (:31), `_joinedTrackCard` (:40), `_levelSection` (:127), `renderTrackPath` (:170), `_unjoinedTrackCard` (:68, no Join button yet).
- `dashboard.js`: Up next (:304–321) and the track rows (:216–237).
- `placement-ui.js`: `startPlacementTest` (:49), `_finishPlacement` (:66), `begin` / `_startPlacedLesson`.
- `ux-polish.js` onboarding: "completely new" and "take a test" are bound to `DEFAULT_TRACK_ID` (:359–369, :618).

## Tasks

Each task is one commit with its own tests, pushed after review.

### 1. Letter and mark data
- **Files:** new `js/qaida/qaida-letters.js` and `js/qaida/qaida-marks.js`, listed explicitly in `build-files.js`. They go in their own directory, not `js/data/`, so they never enter `ALL_WORDS` ordering.
- **Letters:** 28 entries: `{id, char, forms:{isolated, initial, medial, final}, joins: bool, shapeGroup, translit}`. Six letters don't join to the next one: ا د ذ ر ز و.
- **Marks:** fatḥa, kasra, ḍamma, the three tanwīn, sukūn, shaddah, the madd letters, dagger alif, maddah, hamza forms, plus the waṣl and silent-letter cases needed for verse reading.
- **English text:** names and descriptions as `qaida.letter.<id>.name` etc. in `strings-en.js`, never in the data.
- **Test:** `test/qaida-data.test.js` checks there are 28 letters, each form renders in Scheherazade, every string key exists, and no duplicates. Extend `corpus-characters.test.js` to cover the new files.

### 2. Lessons as data, in Noorani order
- **File:** `js/qaida/qaida-lessons.js`.
- **Shape:** `{id, level, number, titleKey, teaches:[skillIds], practice:[skillIds], kind:'lesson'|'check'}`. Exercise items are generated from this; there's no per-item hand-writing.
- **Beginner:**
  1. Letters 1–7, 8–14, 15–21 and 22–28 (four lessons).
  2. Letters that share a shape (ب ت ث, ج ح خ, د ذ, ر ز, س ش, ص ض, ط ظ, ع غ, ف ق).
  3. Joined forms: initial, medial and final.
  4. The six letters that don't join forward.
  5. The ḥurūf muqaṭṭaʿāt (ألم, كهيعص …).
  6. A reading check.
- **Elementary:** fatḥa, kasra, ḍamma, mixed short vowels; tanwīn (3 lessons plus mixed); long vowels with ا و ي; a reading check.
- **Intermediate:** sukūn, shaddah, shaddah with vowels and tanwīn, joining words (hamzat al-waṣl, silent letters, lām shamsiyyah as reading only); a reading check.
- **Advanced:** reading words, then short verses from Juz ʿAmma (Al-Fātiḥah, 114–108), each with Al-Husary's audio; a final reading check.
- **Test:** every `teaches` skill exists, there's exactly one check per level as its last lesson, and lessons are numbered 1..n per level.

### 3. Qaida track module and progress
- **File:** new `js/data-core/qaida-track.js`, mirroring the Word meanings API:
  - `getQaidaLevels()`, `getQaidaLevelLock(level)` (all free; a level opens after the previous check, or by placement).
  - `getQaidaLevel()`, `getQaidaNextLesson(level)`, `completeQaidaLesson(id, score)`.
  - `getLearnedQaidaSkills()`.
- **Storage:** new localStorage key `quran_qaida_progress` `{completed:{lessonId:{at, score}}}`. It is added to the sync-service key map, and merging takes the union of completed lessons with the earliest `at`. This is a new field alongside existing data; nothing existing changes.
- **Test:** `test/qaida-track.test.js` covers locks, next lesson, placement raising the level, and the merge.

### 4. "% of the Quran you can read"
- **Generator:** a build-time script, `scripts/build-qaida-readability.js`, reads `js/quran/quran-data.js`. For each word occurrence it works out the set of skills needed to read it (letters plus marks) as a bitmask. It aggregates the occurrence count per unique mask and writes `js/qaida/qaida-readability.js` (`[[maskHi, maskLo, count], …]` plus the total), which stays small.
- **Percent:** `getQaidaPercent()` is the occurrences whose mask ⊆ learned skills, over the total. `refreshQaidaPercent()` records it via `recordTrackPercent('qaida', …)`.
- **Strings:** `percent.qaida` ("X% of the Quran's words you can read") and `percent.qaida.gained`.
- **Test:** no skills gives 0%; all skills give 100%; learning a letter never lowers the figure; the generated file's total equals the corpus word count (77,429, the figure already asserted for coverage).

### 5. Audio service with slots, and verse audio
- **Service:** `js/services/audio.js` provides `playAudio(url)` (one shared `<audio>` element, stopping the previous one) and `qaidaAudioUrl(skillId)`.
- **Letter manifest:** `qaidaAudioUrl` looks the skill up in `js/qaida/qaida-audio-manifest.js`. The manifest is empty now; adding a file plus a line switches the slot on.
- **Verse audio:** `verseAudioUrl(surah, ayah)` gives everyayah `Husary_128kbps/SSSAAA.mp3`. The exact folder is verified against everyayah.com before use.
- **Caching:**
  - `sw.js` gets a long-lived `bayan-audio` cache for everyayah and `assets/audio/` (today, cross-origin requests skip the service worker and the release cache is wiped on each update).
  - It fetches the full file, not a 206 Range response, so the cached copy works offline.
  - A lesson's audio is cached when the lesson opens; verse audio is cached once played.
- **Credit:** a quiet line under every player: "Recitation: Al-Husary · everyayah.com" (linked).
- **Test:** URL building, the manifest lookup returns null when empty, and the SW caches audio under the right cache name (unit test on the routing function).

### 6. Exercise types for Qaida
- **New type:** `listen-choose` (prompt `{audio}`, options, answer). It has a play button; the builder only creates it when an audio URL exists.
- **Generated item types:**
  - See a letter, pick its name.
  - See a name or transliteration, pick the letter.
  - Pick the form that belongs at the start, middle or end.
  - Read a vowelled syllable or word, pick its sound (transliteration).
  - `build` (assemble a word from letters).
  - `spot` (tap every ب in a word or verse).
- **Builder:** `js/qaida/qaida-exercises.js`, `buildQaidaLessonItems(lesson, seed)`. It is deterministic, and its distractors come from the same shape group, so questions are fair and educational.
- **Test:** every generated item passes `validateExercise`, the answer is always among the options, and the output is deterministic per seed.

### 7. Qaida lesson screen
- **File:** `js/ui/qaida-ui.js`, following the `root-lesson-ui.js` flow.
- **Intro card:** the letter or mark large, its name, its four forms, and a play button if audio exists.
- **Exercises:** run through `renderExercise`.
- **End screen:** "+0.3% of the Quran's words you can read", then Next lesson.
- **Reading checks:** need 80% to pass and open the next level. A failed check shows which skills to revisit.
- **Practice tab:**
  - **Drill:** the "Confused letters" drill becomes real, using the shape groups.
  - **Due today:** missed Qaida skills go into SRS under a `qa_<skill>` namespace. `getDueReviews` keeps returning words only. A small `getDueQaidaSkills()` adds those items to Practice's Due today list, so the existing vocabulary queue is untouched.
- **Test:** `test/qaida-ui.test.js` checks rendering, finishing a lesson records progress and the gained %, and a failed check doesn't unlock.

### 8. Generalise the track screens
- **Registry:** a per-track entry `{levels, levelLock, level, nextLesson, percent, openLesson, placementBank, tagLabels}` in `tracks-ui.js`, plus a placement registry.
- **Use it in:** the `'words'`-only spots listed above.
- **Track cards:** unjoined released tracks get a Join button.
- **Home:** shows a Qaida row and its Up next when Qaida is main.
- **Onboarding:** "Completely new" joins Qaida as the main track and sets `startFromZero`. "Take a short test" runs the chosen track's test.
- **Tests:** existing tracks-ui, dashboard and placement-ui tests keep passing, plus new cases for Qaida.

### 9. Qaida placement test
- **Bank:** `buildQaidaBank(attempt)`.
  - Level 0: name or pick the letter.
  - Level 1: read a vowelled syllable.
  - Level 2: words with sukūn or shaddah.
  - Level 3: read a short verse word.
- **Tags:** skill groups, so the result shows strengths and gaps. It uses audio items only if slots are filled.
- **Test:** the bank has items at every level, they're valid, and retakes rotate.

### 10. Credits and release
- **Sources & credits page:** in Profile → About, listing the Quran text source, Al-Husary via everyayah.com (link), and the Scheherazade New font (SIL OFL).
- **Release:** `isTrackReleased('qaida') → true`, with the "awaiting teacher review" note on the path.
- **Docs:** update `docs/learning-tracks-design.md` (Phase 2 status, the audio decision, open items) and add `docs/plans/phase-2-qaida.md` with these tasks.

## Execution

The same way as Phase 1: one task per commit, each reviewed, tested, committed and pushed to main, with `git log HEAD..origin/main` checked first and only my files staged. Run with subagent-driven development, which the user chose for Phase 1. Tasks 1–4 have no UI and can be done before any screen work.

## Verification

- `node test/run-all.js`: all existing 1863 tests plus the new suites pass. `npm run build` passes, as do `test/dry-load.js` and `test/production-build.test.js`.
- **New Playwright e2e** (`test/e2e/qaida.spec.js`):
  - Pick "Completely new" in onboarding, and Qaida becomes the main track.
  - Open Beginner lesson 1, answer the exercises, and see the "+x%" end screen.
  - Home shows the Qaida row, and Learn shows lesson 2 unlocked.
  - The Qaida placement test runs from Practice → Tests.
  - The full e2e suite still passes (98 tests).
- **Screenshots** of the Qaida path, a lesson, the end screen and the placement result, in dark and light, on phone and desktop.
- **Offline:** play a verse once, go offline, and it plays from the cache.
- **Arabic rendering:** every letter form and mark checked visually in Scheherazade New (marks sit on their letters).
- **CI:** Bayan CI and Deploy are green after each push.

## Before release, outside the code

- **Teacher review:** a qualified teacher reviews every Qaida lesson; this is still open.
- **Letter audio:** recordings fill the slots, either from a teacher or the user's own recordings checked by a teacher.
