# Player extras and saved verses: design

Builds on the follow-along player (2026-11-18-follow-along-design.md).

## Intent

Make Al-Husary's recitation in the Quran reader easier to study with, the way
other Quran apps allow: start or jump to any verse with a tap, hear a verse
several times, slow the recitation down (or speed it up), and keep verses you
like for later. The user called the player part "a good small feature": keep it
small.

## Goals

1. **Tap a verse to jump.** Tapping a verse card (anywhere except a word or a
   button) plays the surah from that verse. If the surah is playing, it jumps
   there; if nothing is playing, it starts there (the user's answer: yes).
2. **Repeat.** Each verse can be played 1, 2, 3, 5 or 10 times before the next
   one. With a verse's own play button, that verse repeats.
3. **Speed.** 0.75×, 1×, 1.25×, 1.5×. The highlight stays in time at any speed
   (it reads the audio's position every frame).
4. **Save a verse.** A bookmark button on every verse saves it; tapping again
   unsaves. Saved verses are listed on the Quran tab; tapping one opens the
   reader at that verse. Saved verses sync with the account like saved words.

## Non-goals

- Jumping to a word (the user chose verse, not word). Tapping a word keeps
  opening the word panel.
- Repeating a range of verses as a block (held back; "from verse X" plus
  per-verse repeat covers most of it).
- Notes on verses, sharing saved verses, folders or tags.
- Speed or repeat for word recordings, Today's ayah or Qaida audio.

## Anti-goals

- A tap that starts sound by accident while scrolling or reading a word.
- A crowded reader header at 375 px.
- Losing or mixing saved data: verse keys must never land in the word
  bookmarks (`quran_favorites`), whose loader rewrites any key that is not a
  word id and would silently drop them.
- Animation: controls appear by a class/attribute change, no transitions.

## Approaches (saved verses; the user picked 1)

1. **Own list, synced like word bookmarks (chosen).** New key
   `quran_saved_verses`: `{ "2:255": savedAtMs, ... }`. Added to
   `SYNC_KEY_MAP` as `savedVerses`; merged per verse with the existing
   timestamped change log (`quran_sync_meta`, new kind `verses`), so the newest
   save/unsave wins across devices. A new field inside the existing
   `learning/{uid}.learningData` map: nothing moves, Firestore rules unchanged
   (learningData is not field-checked), old app versions ignore it.
2. Reuse the word-bookmark list: rejected, its loader deletes non-word keys and
   the verses would count as words.
3. On this device only: rejected, saved verses would vanish on a new phone.

The player extras had one sensible way: extend the existing queue in
`js/ui/quran-player.js` rather than add a second player.

## Behaviour

**Tap a verse.** One click handler on `#quran-verses` already exists; a click
on `.quran-ayah` that is not on a word (`[data-n]`), a button or a link
starts `_quranRecite(versesFrom(n), 'surah')`. Starting mid-surah skips the
basmala (it is only recited before verse 1). Keyboard: the verse card is not
made focusable (each verse already has a play button); the play button is the
keyboard route.

**Repeat.** The player plays one verse at a time and decides what comes next
when a verse ends (rather than a list built up front): it reads the current
Repeat setting then, so a change while playing applies at once, including to a
verse's own play button (that verse plays N times in total, counting plays so
far). Follow-along restarts each time. (My call.)

**Speed.** `playAudio` gains an optional rate; it sets `playbackRate` and
`defaultPlaybackRate` after setting `src` (a new `src` resets the rate). Any
sound played without a rate plays at 1×, so word recordings stay normal.
Changing speed while playing applies at once to the current verse.

**Controls.** A row "Speed [1×] Repeat [1×]" under the reader buttons, two
native `<select>`s (accessible, compact, 16 px text so iOS does not zoom),
always shown in the reader so they can be set before pressing play (my call,
changed from "only while playing": otherwise a single verse's repeat could not
be set). Values are remembered
on this device under their own key (`bayan_player_options`: `rate`, `repeat`; my call, so the reader's text-size save cannot overwrite them).

**Save.** A bookmark icon button beside each verse's play button,
`aria-pressed` and label "Save verse N" / "Remove verse N from saved".
Free accounts can save 10 verses, a limit separate from saved words, which
drops from 20 to 15 (both the user's decisions; words already saved past 15
are kept, the limit only blocks new ones). It lives in `APP_FACTS.limits.savedVerses`; the free
plan line becomes "… {bookmarks} saved words, {savedVerses} saved verses …"
(Premium already promises unlimited verses and words). At the limit a toast
explains, as for words; word saving is unchanged. Merging two devices never trims saved verses, even
past the limit (as for words; sync is Premium-only anyway). The list on the Quran tab ("Saved verses", above the
surah list, newest first) shows surah name and verse number; hidden when
empty. Tapping opens the reader scrolled to the verse.

**Offline.** No new network use: same audio files, list and saves are local.
New source files are bundled by build-files.js and cached as today.

## Files (expected)

- `js/ui/quran-player.js`: queue from a verse, repeat, rate (stays < 300 lines;
  controls wiring may go to a new `js/ui/quran-player-options.js`).
- `js/services/audio.js`: optional rate in `playAudio` / `playAudioQueue`.
- `js/data-core/saved-verses.js` (new): load/toggle/list, limit, change log.
- `js/ui/saved-verses-ui.js` (new): verse button state and the list.
- `js/services/sync-service.js`: key map entry, meta kind, merge (small).
- `index.html`, `styles.css`, `js/i18n/strings-en.js`, `build-files.js`.
- Tests: unit tests for queue building, rate, saved-verses store and merge;
  `test/e2e/quran-audio.spec.js` (tap, repeat, speed) and a saved-verses e2e.

## Left to the builder (my calls, open to change)

- The exact icon and placement of the controls row within the design language.
- Saved list shows reference only (no verse text) to avoid loading every
  saved verse's surah data.
- Repeat/speed changes mid-verse as described above.

## Commits

1. Speed (audio rate + option). 2. Repeat. 3. Tap a verse to play from it.
4. Saved verses: store and sync. 5. Saved verses: button and list.
Each with its tests; e2e covering all.
