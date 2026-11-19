# Follow along with Al-Husary: design

Idea 6 of the feature agenda ("Listen and understand with Al-Husary"), first part.

## Intent

Learners should be able to follow the recitation by ear, the way they will hear
the imam in prayer, and see which of the words being recited they already know.
While Al-Husary recites in the Quran reader, the word he is saying lights up,
and the reader's existing colours show which words the learner knows.

## Goals

- In the Quran reader, during "Listen" (whole surah) and a verse's own play
  button, the word being recited is highlighted, word by word, in time with the
  audio.
- The reader's known-word colours stay as they are, so a learner sees at a
  glance which recited words they understand.
- Works offline once the audio and timings have been loaded.

## Non-goals

- The listening practice (hear an ayah with no text, pick its meaning). That is
  the second part of idea 6, planned separately later.
- Highlighting in Today's ayah, the Qaida lessons or the Quran map page view.
  They keep playing audio as they do now (at the new bitrate).
- Choosing another reciter.

## Anti-goals

- A highlight that runs ahead of or behind the voice. Better no highlight on an
  ayah than a wrong one.
- Animation that distracts from listening: the highlight moves by a class
  change, with no transitions.
- Making the reader heavier for people who never press play.

## Decisions (the user's)

- Follow-along first; listening practice comes after it.
- Verse audio switches from everyayah's `Husary_128kbps` to `Husary_64kbps`
  everywhere `verseAudioUrl` is used (reader, Today's ayah, Qaida verses).
  Same recording, half the data; the word timings were measured on these
  files, so they line up. `Husary_Muallim_128kbps` (Qaida teaching audio) is
  unchanged.

## Approaches considered

1. **Ship a timing file built from cpfair/quran-align (chosen).** CC BY 4.0
   word timings for every ayah of `Husary_64kbps`; converted at build time to
   a compact file the app loads when needed. No server, works offline, matches
   the audio we play.
2. Fetch timings from quran.com's API at runtime: needs the network, breaks
   offline, unclear terms for the data. Rejected.
3. Compute our own alignment: large project, ~1% bad spots to hand-check.
   Rejected.

## Data

- Source: quran-align release 2016-11-24, `Husary_64kbps` timing JSON.
  Entries are `{surah, ayah, segments: [[wordStart, wordEnd, startMs, endMs]]}`,
  word indexes 0-based with an exclusive end, words split by spaces in Tanzil's
  `quran-uthmani` text.
- A build script (like `scripts/build-quran-map.js`) converts it to
  `js/quran/recitation-timing.js`; the build splits it into one file per surah
  (`js/quran/timing/timing-N.min.js`), so playing a surah fetches only its own
  timings. The raw download
  stays out of the repo.
- The script checks each ayah's word count against the app's own verse text
  (whitespace tokens, as `quranMapVerseWords` splits them). An ayah whose words
  don't line up gets no timings, so it simply plays without a highlight. The
  script prints how many ayahs were dropped.
- Words the source left out (about 1%, mostly where the qari repeats a phrase)
  get no highlight; the previous word stays lit until the next timed word.

## Behaviour

- The timing file loads the first time the learner presses play in the reader,
  not on app start, and is kept by the service worker for offline use.
- While a verse plays, the current word gets a "being recited" style on top of
  its colour; it clears when the verse ends, is paused or stopped.
- The basmala clip played before a surah has no on-page words; nothing is
  highlighted during it.
- If the timing file can't load, recitation plays exactly as it does today.
- Respects reduced motion (there is no motion to reduce: class swap only).

## Credit

Profile → About gains a line: word timings from quran-align by Collin Fair,
CC BY 4.0. The author asks to be emailed by users of the data; that is the
user's call and is not done by the app or by Claude.

## Left to the builder (my calls, open to change)

- File shape: one file for the whole Quran, delta-encoded milliseconds, like
  the map data; split per surah only if it comes out over ~600 KB minified.
- How the reader finds the current word: `requestAnimationFrame` while
  playing, reading the audio element's `currentTime` each frame
  (`timeupdate` fires only about four times a second, which can lag a short
  word by up to 250 ms; the user asked for no lag).
- Pauses: a word followed by more than 300 ms of silence stores where it
  ends, so nothing is lit while the reciter pauses (the source leaves about
  4,200 such gaps; without this the last word stayed lit through them).
- The exact highlight style, within the reader's design language.
- Old 128 kbps audio left in the offline cache is not deleted; it ages out.
