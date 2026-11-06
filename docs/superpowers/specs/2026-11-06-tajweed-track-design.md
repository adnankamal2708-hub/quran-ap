# Tajweed track, first version: makhārij and fluent recitation

Date: 2026-11-06
Status: draft for approval
Builds on: `docs/learning-tracks-design.md` (Phase 3), the Qaida track (Phase 2)

## Why

A learner who has finished Qaida can read the letters but cannot yet
pronounce them properly. The owner's view, which this design follows:
the makhārij (points of articulation) are the base of tajweed. Once a
learner pronounces every letter from its proper place, the rest of tajweed
builds on that. The end goal is a learner who recites a verse straight
through without getting stuck, with the letters flowing on their own, and
whose practice is "spot on".

## Goals

1. Every one of the 28 letters pronounced from its proper makhraj.
2. The letter qualities (ṣifāt) that change how a letter sounds, and the
   pairs learners commonly confuse (ح/ه, ع/ء, ص/س, ط/ت and similar).
3. Fluent recitation of real verses, from short Juz ʿAmma verses up to
   longer ones, without stopping mid-word.
4. Practice the learner can trust: they hear the correct sound as often as
   they want, record their own attempt, and compare the two side by side.

## Non-goals (this version)

- The tajweed rules: nūn sākinah and tanwīn, mīm sākinah, madd, waqf and
  the rest (design-doc levels Elementary to Advanced). They come in later
  versions.
- The Quran reader's colour-coded tajweed view and the "Spot the rule"
  exercise (they need tajweed-annotated text with a verified licence).
- Automatic pronunciation scoring by the app (speech recognition or AI).

## Anti-goals (would make it a failure even if it works)

- Synthetic or AI voices for letters. Only human recordings.
- Uploading or storing a learner's voice anywhere off their device.
- Asking for the microphone before the learner chooses to record.
- XP, points, scores against other users, or any gamification.
- A level that looks finished but can't be practised because its audio is
  missing.

## Decisions made with the owner

- **Scope:** makhārij and letter qualities plus fluent verse recitation
  first. The rules come later.
- **How a learner checks themselves:** trial and error by ear. Every letter
  has a reference recording they can replay as often as they like; they
  record their own attempt in the app and compare.
- **Record and compare:** the app records the learner on the device. A
  Compare button plays the reference, then their attempt, back to back.
  The recording never leaves the device and is replaced by the next
  attempt. Without a microphone, or if access is refused, everything else
  still works and the learner compares out loud.
- **Letter recordings:** recorded by the owner, who knows proper makhārij.
  The same recordings fill the empty Qaida audio slots
  (`js/qaida/qaida-audio-manifest.js`), so Qaida gets listening exercises
  too.
- **Build now, release when the recordings are in:** everything is built
  now. The owner adds the letter recordings step by step afterwards; each
  file switches on its audio in Qaida straight away, and the Tajweed track
  becomes visible once all 28 letters have their recording.
- **No teacher-review note** on the Tajweed track. This overrides the
  general "accuracy before release" principle in
  `docs/learning-tracks-design.md` for this track; that document is
  updated to say so.

## What the learner sees

### The path (Learn → Tajweed)

Four levels as in every track. In this version, the **Beginner** level has
lessons. Elementary, Intermediate and Advanced appear as "Coming later" (not
as premium locks).

Beginner lessons, in order (each one numbered, like Qaida):

1. **The five areas** of articulation: the throat, the tongue, the lips, the
   nasal passage and the mouth's empty space. One lesson introducing where
   sound comes from.
2. **Throat letters** (ء ه, ع ح, غ خ).
3. **Back of the tongue** (ق ك).
4. **Middle of the tongue** (ج ش ي).
5. **Side of the tongue** (ض) and **edge of the tongue** (ل ن ر).
6. **Tip of the tongue** (ت د ط, ث ذ ظ, ص س ز).
7. **Lips** (ف, ب م و).
8. **Empty space of the mouth** (the madd letters ا و ي).
9. **Letter qualities, part 1:** heavy and light letters (tafkhīm and
   tarqīq as a quality), whispered and voiced letters (hams and jahr).
10. **Letter qualities, part 2:** qalqalah letters (ق ط ب ج د), and the
    remaining qualities that matter for a beginner.
11. **Letters people confuse:** ح/ه, ع/ء, ص/س, ط/ت, ض/د, ظ/ذ, ق/ك, ث/س.
12. **Reading check:** a short check like Qaida's; passing it completes the
    level.

The exact grouping of articulation points follows the standard 17-point
scheme. The builder lays it out as data and the owner checks it (see
"Left to the builder").

### A lesson

Same flow as a Qaida lesson (intro, then exercises, then the finish screen):

- **Intro:** for each letter, a card showing the letter, its name, where in
  the mouth it comes from (a short sentence, and a simple diagram per area
  if available), a **Play** button for the reference, a **Record** button,
  and a **Compare** button once a recording exists.
- **Exercises**, built from the lesson data like Qaida's:
  - Hear a letter, pick it (needs the recording; skipped while a slot is
    empty).
  - Which area does this letter come from?
  - Which of these letters is heavy / has qalqalah / is whispered?
  - Hear one of a confused pair, pick which it was.
  - Record and compare: say the letter, compare, then mark yourself
    **"Got it"** or **"Not yet"**.
- **"Not yet"** puts that letter in the review queue (the same queue Qaida
  uses), so it comes back under Practice → Due today.

### Verse practice (fluency)

A section of the Tajweed path (and a card under Practice → Drills):

- The whole Quran in a fixed order: Al-Fātiḥah, then Juz ʿAmma (an-Nās
  back to an-Nabaʾ), then Al-Baqarah onward. Verse text comes from the
  app's lazy Quran loader.
- For each verse: **Listen** (Al-Husary's muʿallim teaching recitation,
  which leaves space to repeat; `everyayah.com/data/Husary_Muallim_128kbps/`,
  verified reachable; its own base URL beside the murattal one, cached in
  the same `bayan-audio` cache), **Record** yourself, **Compare** (his recitation, then
  yours), then mark **"Smooth"** or **"Not yet"**.
- "Smooth" moves the learner on to the next verse; "Not yet" brings that
  verse back in Due today, like a missed letter.

### Progress

As in every track: a percentage of the Quran that only grows. The design
doc's intended Tajweed measure needs tajweed-annotated text, which this
version doesn't have. This version uses **the share of the Quran's words
(77,429) in verses the learner has marked "Smooth"** in verse practice,
weighted by each verse's word count. A verse practice turn ends with "+x%";
a makhārij lesson ends with "Lesson complete" and no percentage (my call;
see the decisions to check).

### Storage, review and levels

- **Own record:** Tajweed progress is its own localStorage key (like
  `quran_qaida_progress`), synced as its own field with the same merge
  rules: `{ completed: { lessonId: { at, score } }, review: { id: { due,
  step } }, smooth: { "<surah>:<ayah>": at } }`.
- **Review ids are namespaced** so they never collide with Qaida's:
  `tj-letter:<letterId>` and `tj-verse:<surah>:<ayah>`. They use the
  same schedule as the Qaida queue (10 minutes, then 1, 3, 7, 21 days).
- **Due today** shows one card per track: Qaida's "Letters and marks" and
  a Tajweed card for its letters and verses.
- **Levels:** the reading check passes at 80% (as Qaida), using only
  questions whose audio exists. A placement result opens the levels below
  it, as in Qaida. Tajweed does not require Qaida to be finished.
- **"Coming later"** levels are labels only, not buttons.

### Placement test

Optional, like the other tracks: makhārij questions (which area does this
letter come from, which letter is heavy, which pair sounds alike), 10–20
questions, deterministic scoring. It can place a learner past the Beginner
lessons they already know. Questions that need audio are used only when the
recordings exist.

## Recordings the owner provides

- **Letters:** one recording per letter in the classical form used to hear
  a makhraj: the letter with sukūn after a hamzah with fatḥah (أَبْ, أَتْ,
  أَثْ …). 28 files, one manifest keyed by letter id, shared by Qaida and
  Tajweed (hearing أَبْ is enough to pick ب in Qaida). The builder gives the owner the exact list, file names
  and format, and how to drop them into `assets/audio/` so they appear
  with no code change.
- **Optional:** each letter with the three short vowels (بَ بِ بُ) for
  Qaida's syllable listening.
- Recorded on a phone in a quiet room is enough. No synthetic voices.

## Constraints

- Vanilla JS, no new framework; reuse the track system
  (`js/data-core/tracks.js`), the exercise engine, the placement engine,
  the Qaida review queue (the `review` field of a track's progress record)
  and the audio service (`js/services/audio.js`).
- Lessons are data; all English text in `js/i18n/strings-en.js`.
- New progress goes in a new key alongside existing data, synced the same
  way Qaida's is; nothing existing changes.
- Offline: lesson audio cached when the lesson opens, verse audio cached
  once played (the existing `bayan-audio` cache).
- Microphone: the browser's own recorder (MediaRecorder). Asked for only
  on the first tap of Record. Recordings live in memory only.
- Free: the whole Beginner level and verse practice (the design doc puts
  "Tajweed foundations" in Free).
- Every lesson works with an empty audio slot: the intro still shows the
  letter and its makhraj, and audio exercises are left out until the file
  exists.

## Left to the builder

- The exact lesson data: which letters sit in which lesson, the one-line
  makhraj description per letter, which qualities go in lessons 9 and 10.
  The owner checks this data before release.
- Diagrams of the mouth areas: simple line drawings, or none if a clear
  one can't be made; text alone is acceptable.
- Exercise counts per lesson, item wording.
- Where the Record and Compare buttons sit and how they look, within the
  current design language.
- How much of Practice → Drills verse practice takes.

## Decisions to check (my calls)

1. **Progress measure:** share of the Quran's words in verses marked
   "Smooth"; makhārij lessons add no percentage. The alternative, counting
   letters whose makhraj is learned, would jump to 100% after one level and
   say little.
2. **Recording form:** أَ + letter + sukūn as the reference for each makhraj.
3. **Verse practice uses Al-Husary's muʿallim recitation** (the design doc
   already says this), with the murattal recitation unchanged elsewhere.
4. **Levels 2–4 show as "Coming later"** rather than being hidden.
5. **Release switch:** the track appears once all 28 letter recordings
   exist; until then it stays hidden, while Qaida picks up each recording
   as it is added.
