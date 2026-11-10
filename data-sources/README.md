# Data sources

## quran-wbw-en.json — word-by-word English meanings

- **What:** the English meaning of every word of the Quran, in its verse,
  as `{"surah:verse": [[arabic, meaning], ...]}`, one entry per word in
  reading order. Verse-end markers are left out.
- **From:** the quran.com API v4 (`/verses/by_chapter/{n}?words=true&word_fields=text_qpc_hafs&language=en`),
  the same word-by-word meanings quran.com shows. Downloaded 2026-11-10.
- **Changes:** none. Meanings are stored exactly as published. The build
  only trims spaces at the ends.
- **SHA-256:** `1aa128241580f830c948f6bb1a67e228a96417c911c1d273f78298055bf0342d`
  (checked by `scripts/word-meanings.js`; the build stops if it differs).

### How it is checked

`scripts/word-meanings.js` lines every source word up with the app's own
Quran text (`js/quran/quran-data.js`) and the build stops on any word it
cannot match:

- each word's Arabic, normalised with `OCCURRENCE_INDEX_NORM`, must equal
  the app's word;
- where the two texts split words differently, the build only accepts a
  join that spells the same letters (e.g. the app's مَالِيَ is the source's
  مَا + لِيَ, so it shows both meanings), or a case listed with its reason
  in `WORD_SPLIT_EXCEPTIONS` in that script.

The brackets in the meanings, `( )` and `[ ]`, are the source's own; they
mark English words added so the meaning reads well.
