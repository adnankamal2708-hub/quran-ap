# Phase 1: Track System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Bayan around learning tracks. Today's course becomes
the Word meanings track. Add the five-tab navigation, the Practice tab, the
new onboarding question and the Word meanings placement test. Root study
becomes a real lesson built from data the app already has. No new lesson
content is written.

**Architecture:** One new data module owns track membership, main track,
levels and per-track percentages. It is stored under one new localStorage key
and synced as one new field. A second data module maps the existing Word
meanings content (Foundation Course, guided-reading surahs, surah and root
study) onto the four levels. A small exercise engine with three audio-free
types runs the placement test and the new Practice drills. The UI work
regroups existing screens rather than rewriting them: the Learn tab gains a
track list and a track path, the review center becomes Practice, and the
dashboard becomes Home.

**Tech Stack:** Vanilla JS (ES5-style `var`/`function`, as in the
surrounding code), HTML, CSS tokens in styles.css, Firebase modular SDK v12
(unchanged), plain-Node unit tests (`node test/run-all.js`), Playwright e2e.

**Spec:** [docs/learning-tracks-design.md](../learning-tracks-design.md)

## Global Constraints

- No XP, points or leaderboards. Progress is shown as % of the Quran, and
  each track has its own percentage, never combined.
- Track ids, in display order: `qaida`, `tajweed`, `words`, `understanding`.
  Only `words` is released in Phase 1; the others show "Coming soon".
- Levels are the integers 0–3 for Beginner, Elementary, Intermediate and
  Advanced.
- Existing progress keys (`quran_foundation_progress`, `quran_srs_data`,
  `quran_streak`, …) are read but never rewritten by the new code. The
  existing user lands in the Word meanings track with everything intact, so
  no migration is needed.
- New track state lives in localStorage key `quran_tracks` and syncs as
  field `tracks` of the `learning/{uid}` document. Firestore rules need no
  change because that document has no field whitelist.
- All new English UI text comes from `js/i18n/strings-en.js` through `t(key)`.
  Existing strings are not migrated in this phase.
- Free: the Beginner level of every track and every placement test. Premium:
  what is Premium today. Guided reading needs `GUIDED_READING`; surah and root
  study need `VOCABULARY_EXPANSION`.
- Every new source file is listed in `build-files.js`, and every new test
  file in `test/run-all.js`.
- Inline `<script>` in index.html uses block comments only, because the build
  joins lines.
- Mobile-first. It must work in the light and dark themes and on the 1024px+
  sidebar layout, with no horizontal scroll at 320px.
- One logical change per commit. Review each change, then commit and push to
  `main`. Before pushing, check `git log HEAD..origin/main`, because Codex
  works in the same checkout.

## Review Focus

1. **Existing learner opens the updated app.** Expected: Word meanings is
   joined and is the main track, and Foundation progress, the streak and SRS
   are unchanged. Tested in Task 1 (`default state for an existing learner`).
2. **Leaving tracks.** Expected:
   - Leaving the main track promotes the next joined track.
   - Leaving the last joined track is refused, and the menu disables it.
   - Rejoining restores the old level and percentage.

   Tested in Task 1.
3. **Retaking a placement test and scoring lower.** Expected: the track level
   never goes down, and the result screen says the learner's level stays.
   Tested in Task 1 (`raiseTrackLevel never lowers`) and Task 7.
4. **Two devices that disagree.** Expected:
   - Membership and main track take the newer `updatedAt`.
   - Level and percentage take the higher value.

   Tested in Task 1 (`mergeTrackState`).
5. **Free learner placed at Elementary or higher.** Expected: the path shows
   those levels with a Premium lock, and nothing routes them into gated
   content. Tested in Task 3 (`getWordMeaningsLevelLock`) and Task 6.

---

### Task 1: Track state module and sync

**Files:**
- Create: `js/data-core/tracks.js`
- Modify: `build-files.js` (add to `DATA_CORE_FILES` after `surah-progress.js`)
- Modify: `js/services/sync-service.js` (`SYNC_KEY_MAP`, `mergeData`)
- Test: `test/tracks.test.js` (add to `test/run-all.js`)

**Interfaces:**
- Produces, as globals in `js/data-core/tracks.js`:
  - `TRACK_IDS`: `['qaida','tajweed','words','understanding']`
  - `TRACK_LEVEL_COUNT`: `4`
  - `TRACKS_KEY`: `'quran_tracks'`
  - `isTrackReleased(id) -> boolean`: true only for `'words'` in Phase 1.
  - `loadTracks() -> TrackState`
  - `getJoinedTrackIds() -> string[]`: main track first, then `TRACK_IDS`
    order.
  - `getMainTrackId() -> string`
  - `joinTrack(id) -> boolean`: false if unknown or unreleased.
  - `leaveTrack(id) -> boolean`: false if it is the last joined track.
  - `setMainTrack(id) -> boolean`: false unless joined.
  - `getTrackLevel(id) -> 0..3`
  - `raiseTrackLevel(id, level) -> boolean`: true only if the level went up.
  - `recordTrackPercent(id, percent) -> { percent, gained }`
  - `getTrackPercent(id) -> number`
  - `setStartFromZero(on)` and `isStartFromZero() -> boolean`
  - `nextPlacementAttempt(id) -> number`: returns the current count, then
    increments it.
  - `mergeTrackState(local, cloud) -> TrackState`
- The `TrackState` shape, stored as JSON:
  `{ version: 1, main: 'words', startFromZero: false, updatedAt: <ms>, tracks: { <id>: { joined: bool, level: 0..3, percentHigh: number, placementAttempts: number, updatedAt: <ms> } } }`.
  `mergeTrackState` takes the higher `placementAttempts`.
  When the key is missing, the default is `words` joined at level 0 and set as
  main.

- [ ] **Step 1: Write the failing tests** in `test/tracks.test.js`. Use the
  `test(name, fn)` and localStorage-mock pattern of
  `test/review-center.test.js`, then eval `js/data-core/tracks.js`.
  - `default state for an existing learner`:
    - Start with only `quran_foundation_progress` set.
    - `getMainTrackId() === 'words'` and
      `getJoinedTrackIds()` deep-equals `['words']`.
    - `quran_foundation_progress` is byte-identical afterwards.
  - `joinTrack refuses unreleased tracks`:
    `joinTrack('qaida') === false`; joined is still `['words']`.
  - `leaveTrack refuses the last joined track`:
    `leaveTrack('words') === false`.
  - `leaving the main track promotes the next joined`:
    - Temporarily stub `isTrackReleased` to return true.
    - Join `qaida`, set it as main, then leave it.
    - `getMainTrackId() === 'words'`.
  - `rejoin restores level and percent`:
    - Raise the level to 2 and record 30, leave, rejoin.
    - Level is 2 and the percentage is 30.
  - `raiseTrackLevel never lowers`:
    - `raiseTrackLevel('words', 2)` returns true.
    - Then `raiseTrackLevel('words', 1)` returns false, and the level stays 2.
  - `recordTrackPercent only grows`:
    - Record 43.2: `gained` is 43.2.
    - Record 43.6: `{ percent: 43.6, gained: 0.4 }`.
    - Record 41: `{ percent: 43.6, gained: 0 }`.
  - `mergeTrackState`:
    - Local has `words` level 1, percentage 10, `updatedAt` 100.
    - Cloud has `words` level 2, percentage 5, `updatedAt` 50.
    - The merge has level 2 and percentage 10.
    - Membership and `main` follow the side with the higher top-level
      `updatedAt`.
  - `corrupt JSON falls back to default`: set the key to `'{'`;
    `getMainTrackId() === 'words'`.
- [ ] **Step 2: Run** `node test/tracks.test.js`.
  Expected: FAIL (the module is not found).
- [ ] **Step 3: Implement `js/data-core/tracks.js`.**
  - Every write sets the track's `updatedAt` and the top-level `updatedAt` to
    `Date.now()`.
  - `gained` is rounded to 0.1.
  - Follow `loadFoundationProgress` / `saveFoundationProgress` for the
    try/catch style.
- [ ] **Step 4: Wire sync.**
  - Add `tracks: 'quran_tracks'` to `SYNC_KEY_MAP`.
  - In `mergeData`, set `merged.tracks = mergeTrackState(local, cloud)` when
    either side has it.
  - Add to `test/services.test.js`: a round-trip that exports, then imports
    with a cloud `tracks` value, and asserts the merged level is the higher
    one.
- [ ] **Step 5: Run** `node test/tracks.test.js && node test/run-all.js`.
  Expected: all pass.
- [ ] **Step 6: Commit** with the message "Add track state module and sync
  it". Push after review.

### Task 2: English strings file

**Files:**
- Create: `js/i18n/strings-en.js`
- Modify: `build-files.js` (first entry of `APP_FILES`)
- Test: `test/i18n.test.js` (add to `run-all.js`)

**Interfaces:**
- Produces:
  - `STRINGS = { en: { … } }`.
  - `t(key, vars) -> string`: replaces `{name}` placeholders from `vars`.
    A missing key returns the key itself and calls `__diag.warn` when
    available.
- Keys needed by later tasks, with their English values:
  - Track names:
    - `track.qaida.name`: "Read Arabic from zero"
    - `track.tajweed.name`: "Tajweed"
    - `track.words.name`: "Word meanings"
    - `track.understanding.name`: "Understanding"
  - Track descriptions:
    - `track.qaida.desc`: "Learn to read the Arabic letters and marks"
    - `track.tajweed.desc`: "Recite with correct pronunciation and rules"
    - `track.words.desc`: "Learn the meanings of the Quran's words"
    - `track.understanding.desc`: "Translation and the grammar behind it"
  - Level names, `level.0` to `level.3`: "Beginner", "Elementary",
    "Intermediate", "Advanced".
  - Percentages:
    - `percent.words`: "{p}% of the Quran's words understood"
    - `percent.words.gained`: "+{p}% of the Quran's words"
  - Learn and track menus:
    - `tracks.comingSoon`: "Coming soon"
    - `tracks.add`: "Add a track"
    - `tracks.makeMain`: "Make main track"
    - `tracks.leave`: "Leave track"
    - `tracks.main`: "Main track"
    - `tracks.allWords`: "All words"
  - Practice tab:
    - `practice.due`: "Due today"
    - `practice.drills`: "Drills"
    - `practice.tests`: "Tests"
  - Placement test:
    - `test.words.title`: "Word meanings placement test"
    - `test.words.desc`: "About 5 minutes · finds your level"
    - `test.result.level`: "Your level: {level}"
    - `test.result.kept`: "You're already at {level}; your level stays."
    - `test.result.strengths`: "Strengths"
    - `test.result.gaps`: "To work on"
    - `test.result.start`: "Start at {lesson}"
  - Onboarding:
    - `onboarding.tracks.title`: "What do you want to learn?"
    - `onboarding.tracks.desc`: "Pick one or more. You can change this any time."
    - `onboarding.new`: "I'm completely new"
    - `onboarding.new.desc`: "Start from the very beginning"
    - `onboarding.test`: "Take a short test"
    - `onboarding.test.desc`: "Find your level in about 5 minutes"
  - Drills:
    - `drill.spot.title`: "Spot the word"
    - `drill.spot.prompt`: "Tap the word that means “{meaning}”"
    - `drill.build.title`: "Build the verse"
    - `drill.build.prompt`: "Put the words in order"
- [ ] **Step 1: Write the failing tests:**
  - `t('level.0') === 'Beginner'`.
  - `t('percent.words', {p: 43.2}) === "43.2% of the Quran's words understood"`.
  - `t('no.such.key') === 'no.such.key'`.
- [ ] **Step 2: Run** `node test/i18n.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the file with the keys above.
- [ ] **Step 4: Run** `node test/i18n.test.js && node test/run-all.js`.
  Expected: PASS.
- [ ] **Step 5: Commit** "Add the English strings file for new UI text".

### Task 3: Word meanings level map

**Files:**
- Create: `js/data-core/word-meanings-track.js`
- Modify: `build-files.js` (after `tracks.js`)
- Modify: `js/phase2.js` (`_isPhase2Gated`, `getLearningPhase`)
- Test: `test/word-meanings-track.test.js` (add to `run-all.js`)

**Interfaces:**
- Consumes:
  - `getTrackLevel`, `recordTrackPercent` (Task 1).
  - `getFoundationLessonCount`, `isFoundationLessonCompleted`,
    `isFoundationLessonUnlocked`, `calculateCoverage` (foundation.js).
  - `PHASE2_GUIDED_SURAHS`, `isGuidedSurahCompleted`.
  - `window.__premium.hasFeature`.
- Produces:
  - `getWordMeaningsLevels() -> Level[]`. Each `Level` is
    `{ level: 0..3, lessons: Lesson[] }`. Each `Lesson` is
    `{ kind, number, title, completed, ref }`, where `number` is 1-based
    within the level and `kind` is one of:
    - `'foundation'` with `ref` = lesson index
    - `'guided-surah'` with `ref` = surahId
    - `'surah-study'`
    - `'root-families'`
  - The mapping:
    - Level 0: the 10 Foundation lessons, in order.
    - Level 1: guided surahs with `difficulty <= 2`, in list order.
    - Level 2: guided surahs with `difficulty >= 3`, in list order.
    - Level 3: surah study and root families.
  - `getWordMeaningsLevelLock(level) -> null | 'premium' | 'progress'`:
    - Level 0 is never locked.
    - Levels 1–2 are `'premium'` without `GUIDED_READING`.
    - Level 3 is `'premium'` without `VOCABULARY_EXPANSION`.
    - Otherwise a level is `'progress'` when the previous level isn't
      complete and `getTrackLevel('words') < level`.
  - `hasReachedGuidedReading() -> boolean`:
    `isFoundationGraduate() || getTrackLevel('words') >= 1`.
  - `getWordMeaningsPercent() -> number`: `calculateCoverage().coveragePercent`.
- [ ] **Step 1: Write the failing tests:**
  - Level 0 has 10 lessons with `kind 'foundation'` and numbers 1–10.
  - Level 1 is the guided surahs with difficulty ≤2, starting with surahId 1;
    level 2 starts with surahId 102.
  - With a premium stub returning false, `getWordMeaningsLevelLock(1) === 'premium'`.
  - With a premium stub returning true, Foundation 3/10 complete and track
    level 0, `getWordMeaningsLevelLock(1) === 'progress'`.
  - Same as above with `raiseTrackLevel('words', 1)`:
    `getWordMeaningsLevelLock(1) === null`.
  - In `phase2.js`: a free, non-graduate learner placed at level 1 gets
    `getLearningPhase() === 'guided-reading'`, and the gate still reports
    gated.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the module.
  - In `phase2.js`, replace `isFoundationGraduate()` with
    `hasReachedGuidedReading()` inside `_isPhase2Gated` and
    `getLearningPhase` only.
  - Graduation celebrations keep using `isFoundationGraduate`.
- [ ] **Step 4: Run** the new test plus `node test/run-all.js`.
  Expected: PASS, with `foundation-course.test.js` unchanged.
- [ ] **Step 5: Commit** "Map the Word meanings track onto four levels".

### Task 4: Exercise engine (read and choose, build it, spot the rule)

**Files:**
- Create: `js/exercises/exercise-engine.js` (pure checking)
- Create: `js/ui/exercise-ui.js` (rendering)
- Modify: `build-files.js` (engine after `js/srs.js`, UI after
  `js/ui/quiz-ui.js`)
- Modify: `styles.css` (`.ex-*` rules, using existing tokens only)
- Test: `test/exercise-engine.test.js` (add to `run-all.js`)

**Interfaces:**
- Exercise item shapes, plain data:
  - `{ type: 'read-choose', prompt: { arabic }, options: string[], answer: number, tag }`
  - `{ type: 'build', prompt: { text }, pieces: string[], answer: string[], tag }`
  - `{ type: 'spot', prompt: { text }, tokens: string[], answer: number[], tag }`
- Produces:
  - `checkExercise(item, response) -> boolean`. The response is an option
    index, an ordered piece array, or an array of token indexes (order
    ignored).
  - `validateExercise(item) -> string|null`: an error message, or null when
    the item is valid. An item is invalid when:
    - the answer is out of range;
    - options are duplicated;
    - a `build` item's pieces aren't a permutation of its answer;
    - a `spot` item's answer is empty.
  - `renderExercise(container, item, onAnswer(correct, response))`. It is
    keyboard operable: number keys for options, Enter to check.
- [ ] **Step 1: Write the failing tests:** one correct and one wrong
  response per type through `checkExercise`, plus each invalid case of
  `validateExercise`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement both files.**
  - `.ex-option` reuses the look of the quiz option buttons.
  - `.ex-piece` and `.ex-token` are tappable chips at least 44px tall.
- [ ] **Step 4: Run** the tests, then `npm run build` and a manual check in
  the app console. `renderExercise` of each type works in both themes at
  390px and 1440px.
- [ ] **Step 5: Commit** "Add the shared exercise engine".

### Task 5: Placement test algorithm and Word meanings bank

**Files:**
- Create: `js/exercises/placement.js`
- Modify: `build-files.js` (after `exercise-engine.js`)
- Test: `test/placement.test.js` (add to `run-all.js`)

**Interfaces:**
- Consumes:
  - `validateExercise` (Task 4).
  - `getCanonicalWords`, `getFrequencyRank`, `getDistractors`.
- Produces:
  - Constants: `PLACEMENT_MIN = 10`, `PLACEMENT_MAX = 20`,
    `PLACEMENT_START_LEVEL = 1`.
  - `createPlacementTest(bank) -> PlacementState`. The bank is
    `{ 0: Item[], 1: Item[], 2: Item[], 3: Item[] }`.
  - `nextPlacementItem(state) -> Item | null`. Returns null when finished.
  - `answerPlacementItem(state, correct) -> PlacementState`: a new object; the
    input is not mutated.
  - `isPlacementFinished(state) -> boolean`.
  - `getPlacementResult(state) -> { level, perLevel: [{asked, correct}], strengths: string[], gaps: string[] }`.
  - `buildWordMeaningsBank(attempt) -> bank`. Its items are `read-choose`, prompting
    with the Arabic and offering the English meaning plus 3 `getDistractors`.
    Items are tagged with `typeCategory` and banded by frequency rank:
    - Level 0: ranks 1–100.
    - Level 1: ranks 101–300.
    - Level 2: ranks 301–700.
    - Level 3: ranks 701 and above.
  - Within a band, words are ordered by rank. The order is rotated by
    `attempt * 3` so retakes don't repeat the same first words; `attempt` is
    a stored count, so the order stays deterministic.
- Scoring rules: a level "passes" when it has asked ≥2 and correct/asked ≥ 2/3.
  - **The adaptive step:** after a correct answer, level = min(3, level+1);
    after a wrong one, level = max(0, level−1).
  - **`level`** = the highest passing level, or 0 when none passes.
  - **Finished** when any of these holds:
    - asked ≥ `PLACEMENT_MAX`;
    - asked ≥ `PLACEMENT_MIN` and the result level has ≥3 asked, and either
      the result level is 3 or level+1 has ≥2 asked without passing;
    - the band to ask from is exhausted.
  - **Strengths:** tags with ≥2 asked and ≥75% correct.
  - **Gaps:** tags with ≥2 asked and ≤50% correct.
- [ ] **Step 1: Write the failing tests:**
  - `all correct ends at level 3 within 20`.
  - `all wrong ends at level 0 within 20`.
  - `same answers give the same result twice`: deterministic.
  - `alternating right/wrong around level 1 finishes between 10 and 20 with level 1`.
  - `never asks the same item twice`.
  - `every bank item passes validateExercise and contains its correct meaning`.
  - `strengths and gaps follow the 75%/50% thresholds`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests plus `run-all.js`. Expected: PASS.
- [ ] **Step 5: Commit** "Add the adaptive placement test and Word meanings
  question bank".

### Task 6: Five-tab navigation and the Learn tab

**Files:**
- Modify: `index.html`:
  - Tabs become `tab-home`, `tab-learn`, `tab-practice`, `tab-quran`,
    `tab-profile`. `tab-dashboard`, `tab-paths` and `tab-list` are removed.
  - New sections `#view-tracks` and `#view-track`.
- Create: `js/ui/tracks-ui.js`, providing:
  - `renderTracks()`: the track cards, main track first, then
    "Add a track" with the unjoined cards marked "Coming soon".
  - `renderTrackPath(trackId)`: four levels, numbered lessons and locks from
    `getWordMeaningsLevelLock`.
  - A footer row: "All words", Roots, Difficulty, Quiz.
  - Each card has a "⋯" menu with Make main / Leave. The Leave item is
    disabled when only one track is joined.
- Modify: `build-files.js` (`UI_FILES`, after `learn-screen.js`).
- Modify: `js/ui/navigation.js`:
  - `switchView` renders `tracks` and `track`.
  - The `_updateActiveTab` map:
    - `dashboard` → `tab-home`.
    - `tracks`, `track`, `learn`, `quiz`, `list` and `explorer` → `tab-learn`.
    - `review-center` and `test` → `tab-practice`.
- Modify: `js/app.js` (tab click wiring: Learn → `switchView('tracks')`,
  Practice → `switchView('review-center')`).
- Modify: `js/ux-polish.js` (tooltip selectors `#tab-paths` → `#tab-learn`,
  `#tab-dashboard` → `#tab-home`).
- Modify: `styles.css` (`.track-card`, `.track-path`, `.track-level`, with
  existing tokens).
- Test: `test/navigation.test.js` (map cases), `test/tracks-ui.test.js` (new),
  and `test/e2e/*.spec.js` (the three specs that use the old tab ids).

**Interfaces:**
- Consumes: Tasks 1–3, plus the existing `goToFoundationLesson`, `goToSurah`,
  `switchView('list')`, `goToRootFamily` and `goToDifficultyLevel`.
- Produces: `renderTracks()` and `renderTrackPath(trackId)`, plus view names
  `'tracks'` and `'track'`.

- [ ] **Step 1: Write the failing tests:**
  - **Navigation:** `switchView('list')` marks `tab-learn` active, and
    `switchView('review-center')` marks `tab-practice` active.
  - **tracks-ui:**
    - With the default state, `#view-tracks` contains one joined card with
      text "Word meanings" and three "Coming soon" cards.
    - The path for `words` shows "Beginner" with 10 numbered lessons.
    - A free learner sees a Premium lock on level 1.
    - The Leave item is disabled with one track joined.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
  - The tab labels are "Home", "Learn", "Practice", "Quran" and "Profile".
  - Reuse the existing tab icons. Home keeps the grid icon. Practice uses the
    `repeat` icon path from components.js.
- [ ] **Step 4: Update the e2e specs** for the new tab ids, then run
  `npm run test:e2e`. Expected: all pass, including the
  "Wide screen layout" suite with five tabs in the sidebar.
- [ ] **Step 5: Manual check.**
  - Phone 390px and 320px, desktop 1440px, light and dark themes.
  - The nav indicator sits under the active tab on every view, including
    word cards opened from the path.
- [ ] **Step 6: Commit** "Switch to Home, Learn, Practice, Quran, Profile
  with a track list and path".

### Task 7: Placement test screen

**Files:**
- Modify: `index.html` (new `#view-test` section)
- Create: `js/ui/placement-ui.js`
- Modify: `build-files.js` (`UI_FILES`, after `exercise-ui.js`)
- Modify: `js/ui/navigation.js` (render `test`)
- Test: `test/placement-ui.test.js` (add to `run-all.js`)

**Interfaces:**
- Consumes:
  - `createPlacementTest`, `nextPlacementItem`, `answerPlacementItem`,
    `getPlacementResult`, `buildWordMeaningsBank` (Task 5).
  - `renderExercise` (Task 4).
  - `raiseTrackLevel` (Task 1).
- Produces:
  - `startPlacementTest(trackId)`: `'words'` only in Phase 1. It switches to
    `test`.
  - `window.__placement = { start: startPlacementTest }`.
  - Each start calls `buildWordMeaningsBank(nextPlacementAttempt('words'))`
    (Task 1).
- Behaviour:
  - A counter reads "Question n" with no maximum shown. Leaving mid-test
    saves nothing.
  - The result screen shows:
    - `test.result.level`, or `test.result.kept` when `raiseTrackLevel`
      returned false;
    - strengths and gaps as chips;
    - one button, `test.result.start`, with the first lesson of the placed
      level (for example "Start at Foundation lesson 1"). The button opens
      that lesson through the path.
- [ ] **Step 1: Write the failing tests:**
  - **Finishing a test:** with a stubbed bank and all-correct answers, the
    result shows "Your level: Advanced" and `getTrackLevel('words') === 3`.
  - **A lower retake:** a retake that answers all wrong shows the "level
    stays" text, and the level is still 3.
  - **Quitting:** quitting after 3 answers leaves the track level and
    percentage unchanged. Only the attempt count moves.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests, then build, then take the test manually at
  390px in the light and dark themes. Confirm it ends within 20 questions.
- [ ] **Step 5: Commit** "Add the Word meanings placement test screen".

### Task 8: Practice tab

**Files:**
- Modify: `js/ui/review-center.js` (`renderReviewCenter` grouping)
- Create: `js/exercises/word-drills.js`, providing:
  - `buildSpotDrill()`
  - `buildVerseBuildDrill()`
- Modify: `build-files.js` (after `placement.js`)
- Test: `test/review-center.test.js`, `test/word-drills.test.js` (new)

**Interfaces:**
- Consumes:
  - `renderExercise` (Task 4) and `startPlacementTest` (Task 7).
  - The existing SRS helpers.
  - Quran text through `window.__quranLoader`, the same loader the reader
    uses.
- Produces: the Practice layout, top to bottom:
  - **`practice.due`:** the existing "Reviews Due" block, then Smart
    Prioritization, Today's Progress and Forecast, unchanged.
  - **`practice.drills`:**
    - the existing Review Modes, Forgotten, Weak Roots, Recently Learned,
      Bookmarked and Difficult blocks;
    - two new drill cards, "Spot the word" and "Build the verse".
  - **`practice.tests`:** one card per released track's placement test,
    showing `test.words.title` and `test.words.desc`.
- Drill rules:
  - **Spot the word** picks an ayah from Al-Fatihah or Juz ʿAmma that
    contains a word the learner has learned (SRS stage ≥1). The prompt is
    `drill.spot.prompt` with that word's meaning, and the answer is every
    token whose normalized form matches it. It returns null when the learner
    has learned nothing yet; the card then shows "Learn a few words first".
  - **Build the verse** picks an ayah of 3–5 words from the same surahs. The
    prompt is its existing verse translation, and the pieces are its words,
    shuffled so they are never already in order.
- [ ] **Step 1: Write the failing tests:**
  - **Section order:** the rendered HTML has "Due today", then "Drills",
    then "Tests".
  - **Tests section:** it contains "Word meanings placement test".
  - **Spot drill with nothing learned:** `buildSpotDrill()` returns null.
  - **Spot drill with a learned word:** with رَبِّ learned, the item passes
    `validateExercise` and its answer indexes point at tokens that normalize
    to the same form.
  - **Build drill:** the item passes `validateExercise`, and its pieces are
    not in answer order.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the unit tests, then e2e, then a manual check of both
  drills at 390px in both themes.
- [ ] **Step 5: Commit** "Group Practice into Due today, Drills and Tests,
  with two new drills".

### Task 9: Home with track rows

**Files:**
- Modify: `js/ui/dashboard.js` (`renderDashboard`)
- Test: `test/dashboard.test.js`

**Interfaces:**
- Consumes: `getJoinedTrackIds`, `getMainTrackId`, `getTrackPercent` and
  `isTrackReleased` (Task 1), plus `t` (Task 2).
- Produces: Home order:
  1. The greeting.
  2. Up next. In Phase 1 this is the existing card, since the main track is
     always `words`.
  3. The streak and daily goal block (existing).
  4. One `.db-track-row` per joined track. Each row shows the track name and
     `percent.words` with `getTrackPercent`, and tapping it opens that
     track's path.
  5. Today's due reviews.
  6. The remaining existing sections, unchanged.
- [ ] **Step 1: Write the failing tests:**
  - **One row per track:** with the default state, there is exactly one
    `.db-track-row`, its text contains "Word meanings" and "% of the Quran's
    words understood", and it comes after the streak block.
  - **Up next stays first:** the existing "Up next card is first" test still
    passes.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Use a slim row style: a hairline progress bar
  (`--track`/`--gold`) and `--text-sm`.
- [ ] **Step 4: Run** the tests, then do a manual check in both themes.
- [ ] **Step 5: Commit** "Show a progress row per track on Home".

### Task 10: "+x%" after each lesson

**Files:**
- Modify: `js/ui/review.js` (session summary fill)
- Modify: `index.html` (the coverage-gained label text)
- Test: `test/review.test.js`

**Interfaces:**
- Consumes: `recordTrackPercent('words', getWordMeaningsPercent())`
  (Tasks 1 and 3) and `t('percent.words.gained')`.
- Behaviour:
  - The summary card shows `gained` from `recordTrackPercent`, never a raw
    difference. The figure therefore never goes negative, even when an SRS
    lapse lowers coverage.
  - When `gained` is 0, it shows "—".
- [ ] **Step 1: Write the failing tests:**
  - **Gain:** after mastering a stubbed word that raises coverage from 10.0
    to 10.4, `#session-coverage-gained` reads "+0.4%".
  - **No gain:** a lower coverage on the next session reads "—".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests plus `run-all.js`. Expected: PASS.
- [ ] **Step 5: Commit** "Show the Quran percentage gained after each lesson".

### Task 11: Onboarding question "What do you want to learn?"

**Files:**
- Modify: `js/ux-polish.js` (`renderOnboardingScreen` level screen,
  `wireChoiceButtons`, `completeOnboarding`)
- Test: `test/ux-polish.test.js`

**Interfaces:**
- Consumes: `joinTrack`, `setStartFromZero`, `isTrackReleased` (Task 1),
  `startPlacementTest` (Task 7) and `t` (Task 2).
- Behaviour:
  - Screen 3 becomes multi-select. The options are:
    - the four tracks, with unreleased ones disabled and marked "Coming
      soon";
    - `onboarding.new`;
    - `onboarding.test`.
  - Word meanings is preselected, and Next needs at least one track
    selected.
  - `onboarding.new` sets `setStartFromZero(true)` and keeps Word meanings
    at Beginner.
  - `onboarding.test` opens `startPlacementTest('words')` after the overlay
    closes, instead of `navigateToFirstAction()`.
  - The daily-goal screen is unchanged.
  - `getOnboardingLevel()` keeps returning the stored value or
    `'beginner'`, so existing callers keep working.
- [ ] **Step 1: Write the failing tests:**
  - **Rendered screen:** screen 3 renders "What do you want to learn?" with
    three disabled "Coming soon" options.
  - **Completely new:** finishing with "I'm completely new" gives
    `isStartFromZero() === true`.
  - **Short test:** finishing with "Take a short test" calls the stubbed
    `startPlacementTest` with `'words'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests, then e2e, then a manual fresh-profile run in
  the app (clear storage).
- [ ] **Step 5: Commit** "Ask what the learner wants to learn during
  onboarding".

### Task 12: Deeper root lessons

**Files:**
- Create: `js/exercises/root-lesson.js`, which builds the lesson data and is
  pure.
- Create: `js/ui/root-lesson-ui.js`, which renders the lesson.
- Modify: `index.html` (new `#view-root-lesson` section)
- Modify: `build-files.js` (`root-lesson.js` after `word-drills.js`,
  `root-lesson-ui.js` after `placement-ui.js`)
- Modify: `js/ui/tracks-ui.js`. The level-3 "Root families" lesson opens a
  root list, most frequent first, using `getRootFamilyLessons()`. Each row
  opens a root lesson.
- Modify: `js/ui/navigation.js` (render `root-lesson`; its tab is
  `tab-learn`)
- Modify: `styles.css` (`.root-*` rules with existing tokens)
- Test: `test/root-lesson.test.js` (add to `run-all.js`)

**Interfaces:**
- Consumes:
  - `getRootFamilyLessons()`, `completeRootFamily(rootKey)` and
    `isRootFamilyCompleted(rootKey)` (lesson-system.js).
  - `rateSRSWord(wordId, rating)` (srs.js).
  - `renderExercise` and `validateExercise` (Task 4).
  - `recordTrackPercent` and `getWordMeaningsPercent` (Tasks 1 and 3).
  - The Quran text through `window.__quranLoader`.
- Produces:
  - `buildRootLesson(rootKey) -> RootLesson | null`. A `RootLesson` is
    `{ root, letters: string[], meaning, note, occurrences, groups: [{ pattern, words: Word[] }], exercises: Item[] }`:
    - **`letters`:** the root split into its letters.
    - **`meaning`:** the family's `rootMeaning`.
    - **`note`:** the first non-empty `rootPattern` among its words.
    - **`occurrences`:** the sum of the family's `occ`.
    - **`groups`:** words grouped by their `pattern` field. Words whose
      pattern is `'—'` or missing go in a final group named `'Other forms'`.
    - **`exercises`:** up to 6 items:
      - one `read-choose` per family word, up to 4. The Arabic is the
        prompt, and the options are the correct meaning plus distractors
        taken from the same family first, then `getDistractors`.
      - one `spot` item over an ayah, from `verseKey` of a family word.
        The answer is every token from this root, matched by normalized
        form against the family's words.
    - It returns null for an unknown root.
  - `startRootLesson(rootKey)`: switches to `root-lesson`.
- Lesson flow, one screen per part:
  1. **The root:** its letters, meaning, note, and "Appears {n} times in the
     Quran".
  2. **The family:** words grouped by pattern, each showing Arabic, meaning,
     and the pattern label exactly as stored. No new pattern explanations:
     those wait for teacher review in Phase 4.
  3. **The exercises.**
  4. **The finish screen:**
     - every `read-choose` answer calls `rateSRSWord(word.id, 2)` when
       correct and `rateSRSWord(word.id, 0)` when wrong, as quiz.js does;
     - when the exercises are done, `completeRootFamily(rootKey)` runs;
     - the screen shows `t('percent.words.gained')` from
       `recordTrackPercent('words', getWordMeaningsPercent())`.
- Add string keys to `js/i18n/strings-en.js`:
  - `root.letters`: "The root"
  - `root.appears`: "Appears {n} times in the Quran"
  - `root.family`: "The family"
  - `root.otherForms`: "Other forms"
  - `root.practice`: "Practice"
  - `root.done`: "Root complete"

- [ ] **Step 1: Write the failing tests:**
  - **The most frequent root:** for the first root of
    `getRootFamilyLessons()`:
    - `letters.length` is 3;
    - `occurrences` equals the sum of its words' `occ`;
    - every family word appears in exactly one group;
    - every exercise passes `validateExercise`.
  - **Ungrouped words:** a word with `pattern: '—'` lands in "Other forms".
  - **Unknown root:** `buildRootLesson('xyz') === null`.
  - **Distractors:** a family with ≥4 words gives `read-choose` distractors
    that come from the same family.
  - **SRS ratings:** in the UI test, answering an exercise correctly calls a
    stubbed `rateSRSWord` with rating 2, and wrongly with 0.
  - **Finishing:** finishing calls `completeRootFamily` once.
- [ ] **Step 2: Run** `node test/root-lesson.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement both files** and the path change.
- [ ] **Step 4: Run** the tests, then `run-all.js`, then build. Manually check
  two roots, one large family and one small, at 390px and 1440px in both
  themes.
- [ ] **Step 5: Commit** "Teach each root as a lesson: letters, family by
  pattern, practice".

### Task 13: Docs and final verification

**Files:**
- Modify:
  - `README.md` and `TECHNICAL-HANDOFF.md`: the new modules, the
    `quran_tracks` key and the `tracks` sync field.
  - `AGENTS.md` Core Features: add "Learning tracks".
  - `docs/learning-tracks-design.md`: set the status line to "Phase 1 built".
- [ ] **Step 1: Update the docs** listed above.
- [ ] **Step 2: Run** `npm run build && node test/run-all.js && npx playwright test`.
  Expected: all pass. Record the counts.
- [ ] **Step 3: Manual pass** on the built `dist/`, with the service worker
  and caches cleared:
  - A fresh profile goes through onboarding, the placement test and the
    path.
  - The existing profile with progress shows Word meanings joined and
    unchanged Foundation progress.
  - Offline reload works.
  - 320px, 390px and 1440px, in both themes.
- [ ] **Step 4: Commit** "Document the track system". Push after review.

## Not in Phase 1

- Audio and Qaida (Phase 2).
- Tajweed and the reader's tajweed view (Phase 3).
- Understanding (Phase 4).
- The Sources & credits page, which ships with the first audio.
- The "Start from zero" guided plan screens, which arrive with Qaida.
  Phase 1 only stores the choice.
- Converting today's word-card lesson flow to the exercise engine. Lessons
  keep their current word card and quiz, so lesson order, completion
  tracking and quizzes stay exactly as they are. The engine runs the
  placement test and Practice drills first.
