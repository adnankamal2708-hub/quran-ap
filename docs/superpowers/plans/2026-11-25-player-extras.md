# Player extras and saved verses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speed, repeat and tap-a-verse for Al-Husary's recitation in the Quran reader, and a Save button for verses with a synced Saved verses list.

**Architecture:** The reader's queue (`js/ui/quran-player.js`) plays one verse at a time and picks the next when a verse ends, reading the remembered Speed/Repeat options. Saved verses are a new synced store (`quran_saved_verses`) with its own module and UI, merged per verse by the existing change log in `sync-service.js`.

**Tech Stack:** ES5 vanilla JS, Node test scripts (`node test/x.test.js`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-25-player-extras-design.md`

## Global Constraints

- Every UI string via `t()` in `js/i18n/strings-en.js`; code files < 300 lines; new files in `build-files.js` and new tests in `test/run-all.js`.
- Speeds: 0.75, 1, 1.25, 1.5. Repeats: 1, 2, 3, 5, 10. Defaults 1 and 1.
- Free limits: `APP_FACTS.limits.bookmarks = 15` (words, changed from 20), `APP_FACTS.limits.savedVerses = 10`. Premium unlimited. Existing word bookmarks over 15 are kept (the gate only blocks adding).
- Free plan line: `Up to {reviewsFree} reviews a day, {bookmarks} saved words, {savedVerses} saved verses and {tafsirPerDay} tafsir notes a day`.
- No transitions or animation; native `<select>` with 16 px text.
- Stage only own files by path; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Tapping a word inside a verse while playing must open the word panel, not jump (e2e asserts panel opens and queue unchanged).
- A verse's play button with Repeat 3 plays that verse exactly 3 times, then stops (e2e counts URLs).
- Word recordings played after recitation at 1.5× play at 1× (unit: `playAudio` without rate resets to 1).
- Unsave on device A then sync with older device B keeps it unsaved (unit: merge with change log).
- Corrupt `quran_saved_verses` JSON loads as empty, not an exception (unit).

---

### Task 1: Speed

**Files:** Modify `js/services/audio.js`, `js/ui/quran-player.js`, `js/ui/quran.js` (prefs), `index.html` (controls row), `styles.css`, `js/i18n/strings-en.js`. Create `js/ui/quran-player-options.js` (load/save/wire options). Test: `test/audio.test.js`, new `test/quran-player.test.js`.

**Interfaces — Produces:**
- `playAudio(url, onEnd, onStop, rate)`; `playAudioQueue(urls, opts)` with `opts.rate`. Rate set on `playbackRate` and `defaultPlaybackRate` after `src`; missing rate → 1.
- `setCurrentAudioRate(rate)` applies to the playing element.
- `quranPlayerOptions()` → `{ rate: number, repeat: number }` from `bayan_player_options`; `setQuranPlayerOption(name, value)` validates against the lists, saves, and for `rate` calls `setCurrentAudioRate` if recitation plays. `wireQuranPlayerOptions()` called from `wireReaderControls()`.
- DOM: `#reader-rate`, `#reader-repeat` selects in a `.reader-player-options` row.

- [ ] Tests: `playAudio(url, null, null, 1.5)` → element `playbackRate === 1.5`; next `playAudio(url)` → 1. `quranPlayerOptions()` ignores invalid saved values (`rate: 7` → 1).
- [ ] Implement, run `node test/audio.test.js` and `node test/quran-player.test.js`: PASS. Commit "Reader: recitation speed".

### Task 2: Repeat (and next-verse driven queue)

**Files:** Modify `js/ui/quran-player.js`. Test: `test/quran-player.test.js`.

**Interfaces — Produces:** `quranNextPlay(verses, index, played, repeat)` (pure) → `{ index, played }` of the next play or `null` when done; `played` counts plays of `verses[index]` so far.
- `_quranRecite` plays basmala (if any) then verse by verse via `playAudio`, calling `quranNextPlay` with the current `quranPlayerOptions().repeat` on each end.

- [ ] Tests: `quranNextPlay([1,2],0,1,1)` → `{index:1,played:1}`; `([1,2],0,1,3)` → `{index:0,played:2}`; `([1],0,3,3)` → null; repeat lowered below played → moves on.
- [ ] Implement; existing e2e order (`quran-audio.spec.js` test 1) still passes. Commit "Reader: repeat each verse".

### Task 3: Tap a verse to play from it

**Files:** Modify `js/ui/quran.js` (click handler), `js/ui/quran-player.js`, `styles.css` (cursor). Test: `test/quran-player.test.js`.

**Interfaces — Produces:** `reciteSurahFrom(verse)`: verses of the open surah ≥ `verse`; basmala only when starting at the first verse.
- Click on `.quran-ayah` not inside `[data-n]`, `button`, `a` → `reciteSurahFrom(n)`.

- [ ] Test: with verse keys 1..4, `reciteSurahFrom(3)` queues 3,4 with no basmala; `reciteSurahFrom(1)` queues basmala first (surah ≠ 1, 9).
- [ ] Implement. Commit "Reader: tap a verse to play from it".

### Task 4: Saved verses store and sync

**Files:** Create `js/data-core/saved-verses.js`. Modify `js/data-core/app-facts.js` (limits, plan line), `js/services/sync-service.js` (`savedVerses` key, meta kind `verses`, merge), `build-files.js`, `test/run-all.js`. Test: new `test/saved-verses.test.js`, `test/app-facts.test.js`, sync test file.

**Interfaces — Produces:**
- `SAVED_VERSES_KEY = 'quran_saved_verses'`; `loadSavedVerses()` → `{ "s:v": savedAtMs }`; `isVerseSaved(key)`; `toggleSavedVerse(key)` → `'saved' | 'removed' | 'limit'`; `savedVerseList()` → keys newest first. Toggle calls `markSyncChange('verses', key, on)` and the existing sync trigger used by `toggleFavorite`.
- `markSyncChange` accepts `'verses'`; `_loadSyncMeta` returns `verses`; `mergeData` merges `savedVerses` with `_mergeTracked` (legacy pick: union, keep newest time).

- [ ] Tests: toggle saves/unsaves; 11th save when free → `'limit'` and not stored; premium unlimited; corrupt JSON → `{}`; merge: removal newer than cloud save stays removed; app-facts free line reads "15 saved words, 10 saved verses".
- [ ] Implement, run tests. Commit "Saved verses: store and sync; free limits 15 words, 10 verses".

### Task 5: Save button and Saved verses list

**Files:** Create `js/ui/saved-verses-ui.js`. Modify `js/ui/quran.js` (button markup, click), `js/ui/quran-player.js` or new file (sync button state), `index.html`/surah browser (list container), `styles.css`, `js/i18n/strings-en.js`, `build-files.js`.

**Interfaces — Produces:** `syncSavedVerseButtons()`; `renderSavedVerses(container)`; button `.quran-ayah-save[data-verse]`, `aria-pressed`, labels `reader.saveVerse` / `reader.unsaveVerse`; limit toast `reader.saveLimit`.

- [ ] Test (unit, fake DOM): list renders newest first with surah names; empty → hidden.
- [ ] Implement. Commit "Saved verses: button and list".

### Task 6: E2E and verification

- [ ] Extend `test/e2e/quran-audio.spec.js`: speed select sets `playbackRate` on the audio element; Repeat 2 + verse play → URL twice; tapping verse 3's translation while playing → next URL is verse 3; tapping a word opens panel. New `test/e2e/saved-verses.spec.js`: save 2:255-like verse, appears on list, opens reader at it, unsave.
- [ ] `node test/run-all.js`, e2e suite, `npm run build`; 375 px light and dark screenshots; push; CI green.
