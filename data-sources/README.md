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

## ibn-kathir-ar.json — Ibn Kathir's commentary, in Arabic

- **What:** for every verse a lesson cites that has a tafsir quote, the full
  Arabic text of Ibn Kathir's *Tafsir al-Quran al-Azim* on that verse, as
  `{"source": ..., "verses": {"surah:verse": text}}`.
- **From:** the quran.com API v4 (`/tafsirs/14/by_ayah/{surah:verse}`,
  resource 14, `ar-tafsir-ibn-kathir`). Downloaded 2026-11-11. The Arabic
  original is public domain. Markup is removed; the words are unchanged.
- **Used by:** the `tafsir` field of each lesson word is one passage copied
  from this text, never reworded. A passage cut short is marked with `…`
  at the cut. Words with no passage that explains the word or its verse
  have an empty `tafsir`, and the app shows only the links to the full
  commentary on quran.com.
- **How passages were chosen:** a passage quotes the cited verse in
  brackets and then explains it (`أي` / `يعني`). Chains of narrators,
  hadith text and dialogue, and quotes of other verses are not used.
- **English shown in the app:** each word with a passage also has a
  `tafsirEn` field, Bayan's own translation of that Arabic passage (names
  transliterated, verse quotes in double quotes, cuts kept as `…`). The card
  shows this English, then links to the Arabic original and the English on
  quran.com.
- **Not stored:** the English on quran.com is an abridged translation that
  is still under copyright, so the app links to it and does not copy it.

### How it is checked

`test/lesson-examples.test.js` checks that every `tafsir` quote, without
its `…` marks, appears word for word in this file under the word's verse;
that every quote has a `tafsirEn` with no Arabic in it and the same `…`
cuts; and that words sharing a quote share its English.
