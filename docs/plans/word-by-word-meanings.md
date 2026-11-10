# Word-by-word meanings in the Quran reader — plan

## Status (2026-11-10)

Built and released. The owner chose not to wait for licence replies, so
Step 0 is closed by the owner's decision. Source: the quran.com word-by-word
English (data-sources/README.md). Done:

- Tasks 1–3: `scripts/word-meanings.js` lines up all 77,429 words with the
  app's text at build time (0 errors; 10 verses split words differently and
  are handled by spelling-checked joins, plus one listed exception, 2:72).
  `build.js` attaches each verse's meanings to the per-surah files, so
  they load with the surah and work offline.
- Task 6: a meaning under every word, the repeated-word bug fixed, a word panel with Report a mistake (js/ui/quran-word-panel.js),
  and a credit line under the reader.
- Task 8: `test/word-meanings.test.js` and `test/e2e/word-meanings.spec.js`.

Still open: Task 4 (audit list against the lesson meanings), Task 5 (lesson
links by dictionary form) and Task 7
(teacher review).

## The problem

The reader shows a meaning only under words that are spelled, letter for
letter, like one of the 900 forms taught in the lessons
(`_buildVerseData` in `js/ui/quran.js`). Those cover 43% of the Quran's
77,429 words. Arabic joins prefixes and suffixes onto words and changes
verb forms, so the Quran has about 14,690 written forms. In 2:3 only
الَّذِينَ and يُنفِقُونَ get a meaning. Separately, when a word appears
twice in one verse, only the first one is tappable.

## Goal

Every word in every verse shows its meaning in that verse. Tapping any
word opens its details. A word that is also taught in the lessons links
to its lesson page.

## Accuracy rules (these override everything below)

1. **No meaning is written or guessed by us or by AI.** Every English
   meaning comes from one published, recognised word-by-word source,
   used as published. The only exception is a correction approved by a
   qualified reviewer and recorded in a corrections file (Task 7).
2. **Meanings are per word in its verse, not per spelling.** The same
   spelling can mean different things in different verses, so the data
   is keyed by surah:verse:word position, never by spelling.
3. **Fail safe.** If a word can't be matched to the source with
   certainty, it is shown without a meaning. It never shows a guess.
   The build lists every such word, and release needs zero of them
   (Task 2).
4. **The Quran text is never changed.** The reader keeps showing the
   app's own Uthmani text. The source only supplies meanings.
5. **A word links to a lesson only when the source's dictionary form
   (lemma) exactly matches that lesson word.** Otherwise it shows the
   meaning with no link.
6. **The source is credited** on Profile → About and under the reader,
   as its licence requires.
7. **A qualified teacher reviews it before release** (Task 7), as for the
   Qaida track.

No software can promise that tens of thousands of meanings are perfect.
This plan gets close by using one trusted source unchanged, checking
every word mechanically, having a person review it, and letting readers
report a mistake.

## Step 0 — Choose the source and confirm its licence (owner, before any code)

| Source | What it gives | Licence status |
|---|---|---|
| **QUL (Tarteel's Quranic Universal Library), English word-by-word** (what quran.com shows) | An English meaning for each word in its verse, keyed `surah:verse:word`, in JSON | QUL allows commercial use "per resource", but the English word-by-word file shows no licence. Its credits name QuranWBW.com. **Needs written confirmation.** |
| **Quranic Arabic Corpus (corpus.quran.com) v0.4** | The dictionary form, root and grammar for every word; this is what makes lesson links accurate | GPL. The file says it may be used "in any website or application" if credited, and must not be changed. Its FAQ also says "not for commercial purposes". **Bayan sells Premium, so this needs written confirmation.** |

Recommendation: QUL English word-by-word for the meanings and the
Quranic Arabic Corpus for lesson links, once both owners confirm in
writing. I can draft the two emails. If the Corpus says no, the meanings
still ship, but lesson links stay limited to today's exact-spelling
matches (rule 5).

The downloaded files go in `data-sources/` with their licence text, the
source URL, the version and a SHA-256 checksum. The build refuses a
file whose checksum doesn't match.

## Tasks

Each task is one commit with its own tests, reviewed, then pushed.

### 1. Import script → one meanings file per surah
- `scripts/build-word-meanings.js` reads the source file and writes
  `js/quran/words-NNN.js`. Each file is keyed by verse and holds an array
  of meanings, one per word of the app's text, in order.
- The files are loaded with the surah, as the text is today
  (`js/quran/quran-loader.js`). They are never in the main bundle, and
  the service worker caches them, so meanings work offline.
- Size budget: about 1.5 MB for the whole Quran, split across 114 files.
  The build reports the sizes.

### 2. Word alignment check (the build fails on any problem)
- For every verse, the source's word count must equal the app's word
  count.
- For every word, the source's Arabic, normalised with the app's own
  `OCCURRENCE_INDEX_NORM`, must equal the app's word normalised the same
  way.
- Known differences in how the two texts split words (for example يَٰٓأَيُّهَا
  or words joined with a small mark) go only in
  `data-sources/alignment-exceptions.json`, one line per case with its
  reason. They are reviewed like code. Nothing is skipped silently.
- Output: a report of every mismatch. The target is zero unexplained
  mismatches across all 6,236 verses.

### 3. Content checks (the build fails on any problem)
- No empty meaning, no leftover markup or footnote tags (`<sup`, `[[`),
  no stray Arabic in the English, and no duplicated or truncated entries.
- Meaning length is within sane bounds; anything outside is listed.
- Total word count equals 77,429, the figure the app already uses.

### 4. Cross-check with the app's own lessons (an audit list, not auto-fixed)
- For every word that also matches one of the 900 lesson words, compare
  the source's meaning with the lesson's meaning.
- Clear disagreements go into a report for the reviewer. This audits the
  existing lesson data too.

### 5. Lesson links (only if the Corpus licence is confirmed)
- Using the Corpus dictionary forms, link a word to a lesson word only
  on an exact dictionary-form match (rule 5).
- Test: a sample of known words (e.g. يُؤْمِنُونَ → آمَنَ, رَزَقْنَاهُمْ →
  رَزَقَ) link correctly, and nothing links on a partial match.

### 6. Reader
- Every word shows its meaning under it when Meanings is on (today's
  CSS `::after`, now on every word).
- Tapping any word opens a small panel with the word as written, its
  meaning in this verse, "In your lessons" if it is linked, and
  "Report a mistake", which opens the existing feedback form with the
  verse and word filled in.
- Fix the bug where a repeated word in a verse loses its meaning.
- Credit line under the reader, plus the About page entry.
- Mastery colours stay only on lesson-linked words, as today.

### 7. Review and corrections
- A qualified teacher reviews all of Al-Fātiḥah, all of Juz ʿAmma, every
  word on the Task 4 list, and a random sample of 500 other words
  (seeded, so the sample can be repeated).
- Any correction goes in `data-sources/meaning-corrections.json`, one
  line per change: `{word: "2:3:5", source: "...", corrected: "...",
  reviewer, date, reason}`. The build applies these and nothing else.
- Release waits for this review, like the Qaida track.

### 8. Tests
- Unit tests:
  - the import on a small fixture
  - the alignment check catches a shifted word and an extra word
  - the content checks catch empty entries and markup
  - the corrections file applies only to its listed words
  - the reader renders a meaning on every word of 2:3
  - a repeated word keeps its meaning
- e2e:
  - open Al-Baqarah 2:3; every word has a meaning
  - tap يُؤْمِنُونَ to open its panel
  - Report a mistake opens feedback
  - it works offline after one visit
- The full existing suite still passes.

## What this does not change

- The lesson data and progress calculations.
- The Quran text itself.
- The "% of the Quran" figures, which still count lesson words only.

## Open decisions for the owner

1. Send the two licence emails (drafts ready on request).
2. Name the qualified reviewer for Task 7.
3. If the Corpus refuses, ship meanings with no new lesson links, or wait.
