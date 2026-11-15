# Today's ayah: an ayah you can now read on your own

Status: approved by the user (2026-11-16)

## Intent

Bayan's promise is understanding the Quran itself, not word lists. The
strongest moment the app can give is a learner reading a real ayah and
understanding it with no translation. Each day, Home offers one ayah the
learner can mostly read already. The app first teaches the one or two words
they're missing, using that ayah's checked word-by-word meanings. Then it
shows the ayah alone.

The user chose this as the top idea, with meaning hints allowed, and asked
for it to be thorough and never wrong about the ayah or its words.

## Goals

- Every day, one real ayah the learner understands mostly on their own.
- Accuracy over reach: a word counts as known only when it really is the
  lesson word. When in doubt, it becomes a hint.
- It works from about 50 learned words, and gets better as they learn.
- It uses only data the app already ships: Quran text, translation,
  checked word-by-word meanings, and lesson vocabulary.

## Non-goals (v1)

- Showing it at the end of a lesson (option B). The picker is written so
  that can reuse it later.
- Adding hint words to reviews or the SRS. Progress stays as it is.
- Syncing the ayah history to Firestore. That needs a schema change and a
  migration plan, so it stays on the device for now.
- New audio work. If the existing verse player can play the ayah, add a
  play button; otherwise leave it out.

## Anti-goals

- Never call a word "known" when it is a different word that is spelled
  the same without vowels, e.g. أَنْ "that" or إِنْ "if" counted as إِنَّ
  "indeed". Since commit 314a925 all four are lesson words with their own
  index keys, so each is known only when that word itself is mastered.
- No made-up meanings. Every meaning shown comes from the checked
  per-ayah meanings (verse.w) or the lesson word itself.
- No XP, points or streak pressure. Progress stays as % of the Quran.

## What the data shows (measured 2026-11-16)

- All 77,428 words of the Quran have a checked meaning, and alignment
  with the text has 0 errors. There are 4 continuation tokens, e.g. بَعۡدَ مَا.
- A learner going through words in Foundation (frequency) order sees
  these numbers. "Ayahs" means ayahs of 4 or more words where they know at
  least 2/3 of the words and need at most 2 hints. The last column also
  counts a known word with وَ or فَ ("and", "so") attached:

  | Words learned | Quran word coverage | Ayahs | With وَ/فَ |
  |---|---|---|---|
  | 50 | 24.6% | 11 | 23 |
  | 100 | 28.8% | 30 | 64 |
  | 200 | 33.6% | 78 | 140 |
  | 400 | 38.5% | 165 | 274 |
  | 1311 | 42.0% | 283 | 468 |

  At 50 words, a looser rule (half known, up to 3 hints) gives 256 ayahs.
- Matching by spelling without vowels, which today's word index does,
  agrees with the vowels for about 90% of tokens once spelling-mark
  differences are evened out. Most of the rest are only script
  differences, such as عَلَى against عَلَىٰ, or the Uthmani tanwīn marks.
  Some are real different words: إِنَّ against أَن (29), أَنَّ (13) and
  إِن (12). This is why the vowel check is required.

## Approaches considered

- **A. A daily card on Home (chosen by the user).** One ayah a day, the
  same all day, never repeated. It builds a daily habit and gives the
  feature one place.
- B. At the end of a lesson only. A strong moment, but not daily. Kept for
  later; it can reuse the picker.
- C. Both. The most reach, but about twice the screens. Not now.

## Design

### 1. Build-time ayah index (generated)

`scripts/build-ayah-readability.js` writes `js/quran/ayah-readability.js`,
in the same style as `js/qaida/qaida-readability.js`. It is regenerated
when the Quran text, vocabulary or meanings change, and a test fails if it
is out of date.

For every ayah of 4 or more words (after joining continuation tokens), it
stores what each word is:
- a lesson word's canonical id, when the token passes the **known-word
  match** below;
- `and/so + id`, when the token is وَ or فَ plus a word that passes the
  match, and that token's checked meaning starts with "and", "so" or
  "then";
- otherwise nothing, which means it needs a hint.

It keeps only ayahs where at least half the words could ever be known.
That's about 1,220 ayahs; the builder should aim for under 80 KB. The file
loads lazily: Home fetches it when the card first renders, not in the main
bundle. The service worker caches it, so the card works offline.

**Known-word match.** A token counts as lesson word W only when both:
1. today's word index already maps it there (the normalised spelling, plus
   the verse list, which keeps the 12 split homographs apart); and
2. its vowels agree with W's spelling. The comparison evens out mark order,
   alif waṣla, dagger alif, maddah and hamza seats, the Uthmani tanwīn and
   sukūn marks, the assimilation shadda on a first letter, and the final
   case vowel.

Anything else is a hint. The comparison is built test-first with the
real cases measured above. For example:
- إِلَى must match إِلَىٰ;
- اللَّهُ must match ٱللَّهِ;
- غَفُورٌ must match غَفُورٞ;
- إِنَّ must not match أَن, أَنَّ or إِن.

### 2. The picker, `js/data-core/daily-ayah.js`

A pure function, testable without the DOM:
`pickDailyAyah(index, knownIds, history, dateKey) → {ref, words, hints} | null`

- **Known words:** mastered words (SRS stage ≥ 2), the same set as
  % of the Quran. A word in the ayah is known when its stored id (alone or
  as `and/so + id`) is mastered. Every other word is a hint, including
  lesson words that are learned but not mastered yet.
- **First choice:** at least 2/3 of the words known and at most 2 hints.
  **Fallback:** at least half known and at most 3 hints. If neither
  matches, return null and Home hides the card.
- **Skip:** ayahs already completed.
- **Prefer:** ayahs that use the most recently mastered words, ranked by
  the newest `ratedAt` among the ayah's known words (this field is
  already on SRS entries). Ties break on a hash of the date plus the ref,
  so the result is deterministic.
- **Same ayah all day:** today's pick is stored with its date and kept
  until midnight local time, even if the learner masters more words that
  day.

Storage is localStorage `quran_daily_ayah`:
`{date, ref, done: [refs], readCount}`. It is device only (see non-goals).

### 3. Screens, `js/ui/daily-ayah-ui.js`

**Home card**, under Up next:

```
Today's ayah                     You know 7 of 9 words
An-Naba 78:9                                         ›
```

Once done, the card reads "Read today ✓ · 12 ayahs read on your own".
The user chose to show this running total (it counts ayahs marked "I
understood it", across all days; it is not points and earns nothing).

**The flow:**

1. **New words**, 1 to 3 cards, one per hint. Each shows the word exactly
   as it is written in the ayah, its checked meaning for this ayah, and
   its root when it is a lesson word. Button: Next.
2. **The ayah alone**, large, in the Quran font, with no translation. Any
   word can be tapped to see its meaning, so a forgotten word can be
   checked. Hint words have a quiet underline. Buttons: "I understood it"
   and "Show translation".
3. **The check:** the translation, the surah name and ayah number, and
   play if available. Done goes back to Home. Either button counts the
   ayah as done; only "I understood it" adds to the read count.

It follows the current design language: dark, gold accents, existing card
and button styles. It is mobile first, keyboard reachable, and the Arabic
is marked `lang="ar"` with `dir="rtl"`.

### 4. Files

All code files stay under 300 lines.

- **New:**
  - `scripts/build-ayah-readability.js`
  - `js/quran/ayah-readability.js` (generated)
  - `js/data-core/daily-ayah.js`
  - `js/ui/daily-ayah-ui.js`
  - tests
- **Changed:**
  - `build-files.js`
  - `build.js` (copy the lazy file)
  - `sw.js` (cache it)
  - `js/ui/dashboard.js` (one call to render the card)
  - `styles.css`

### 5. Tests

- **Generator:**
  - every stored id really occurs in that ayah;
  - all the vowel-match cases above;
  - the file is up to date with the sources;
  - no ayah under 4 words.
- **Picker:**
  - the thresholds and the fallback;
  - never repeats an ayah;
  - the same pick all day;
  - deterministic;
  - null when nothing fits;
  - known words come from mastered words only.
- **UI:** each step renders, "I understood it" updates the count, and the
  card hides when the picker returns null.
- **e2e:** a learner with mastered words sees the card and completes the
  flow, offline included.

## Left to the builder

- The exact share of hints per stage within the thresholds above.
- The card's wording, matched to Home's existing tone.
- Whether play appears, depending on what the verse player supports.

## Related change (separate commit, requested by the user)

% of the Quran already tells these apart: the lesson word إِنَّ is credited
only with its own 609 occurrences. أَن (539), إِن (357) and أَنَّ (99) are
not lesson words yet, so they count toward nothing. The user asked for each
to be its own word that raises the % when learned. Adding them as
vocabulary words makes the word index give each its own key, and the
picker here then treats them as known words like any other.
