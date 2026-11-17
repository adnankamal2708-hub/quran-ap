# Quran map: design

Status: approved by the owner 2026-11-17 (mockup shown in the session).
Idea 3 of the six feature ideas; idea 6 (listening with Al-Husary) follows.

## Intent

"% of the Quran" is a number. The map makes it something the learner can
see: all 604 pages of the Madinah Mushaf, each shaded by how much of it
they understand, growing from pale to gold as they learn. Tapping a page
shows its Arabic with every known word lit up, so the learner sees exactly
which words stand between them and that page.

## Goals

- One square per Mushaf page (604), grouped in rows by juz, shaded in
  five steps of the app's gold by the share of the page's words known.
- The page view: the page's ayahs in Arabic, known words in gold and
  underlined, every word tappable for its meaning (the reader's existing
  word panel).
- The map agrees with the "% of the Quran" figure: a word counts as known
  exactly when it counts toward that figure (its occurrence-index key
  belongs to a mastered lesson word, SRS stage 2+).
- Works offline once opened; costs nothing at app start.

## Non-goals

- No change to progress, SRS or the Firestore schema; the map only reads.
- No new audio (idea 6 is separate).
- Not a replacement for the surah reader; the page view links into it.

## Approaches considered

- **A. Build-time token index, lazy-loaded (chosen).** A script tags every
  Quran word with its occurrence-index key (or none) and writes it with
  the 604 page starts. The browser loads it only when the map opens. It
  uses the exact matcher behind the % figure, so the two always agree.
  Measured: 151 KB raw, 53 KB gzipped.
- B. Per-page counts only (smaller), with highlighting recomputed in the
  browser. The browser does not have the build's matcher, so highlights
  could disagree with the shading. Rejected.
- C. Compute everything in the browser from the full Quran text. Needs the
  2.8 MB text and a second copy of the matcher. Rejected.

## Design

- **Data:** `scripts/build-quran-map.js` writes `js/quran/quran-map-data.js`:
  `pages` (604 `[surah, ayah]` starts, Tanzil's Madinah page index, credited
  in Sources & credits), `keys` (occurrence-index keys) and, per ayah, its
  words' key indexes in reading order (empty for words that are not lesson
  words). Tokens are split exactly as the occurrence index splits them.
- **Logic (`js/data-core/quran-map.js`, pure):** page shares from the
  mastered keys; shade step 0–4; per-word known flags for a page.
- **Screen (`js/ui/quran-map-ui.js`):** a "Your Quran map" card at the top
  of the Quran tab's surah list opens the map; the Home % links to it too.
  The page view loads the page's surahs with the existing loader.
- **Words:** meanings come from the checked word-by-word data (`verse.w`),
  shown in the existing word panel.
- **Offline:** the data file is precached by the service worker.

## Left to the builder

Exact shade thresholds (equal 20% bands unless the build shows they look
wrong), square size at phone width, and accessible labels for each square
("Page 604, juz 30, 87% known").
