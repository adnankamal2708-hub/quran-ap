# Learning tracks: design

Status: agreed design, 2026-10-31. Nothing here is built yet. Phase 1 is
planned step by step in [plans/phase-1-tracks.md](plans/phase-1-tracks.md).

Bayan grows from one vocabulary course into four learning tracks, so a
learner can choose what they want to learn, from reading Arabic letters for
the first time to understanding verses in depth. The app keeps its current
look, feel and calm tone.

## Principles

- **No gamification.** No XP, points or leaderboards. Progress is shown as
  the share of the Quran a learner has opened up (see [Progress](#progress)).
- **Accuracy before release.** Every Qaida, Tajweed and Understanding lesson
  is reviewed and approved by a qualified teacher. A track without that
  review stays unreleased.
- **One recitation.** Ḥafṣ ʿan ʿĀṣim only.
- **Interactive, not read-and-memorise.** Every lesson is built from
  exercises.
- **Lessons are data.** Lesson content lives in data files and all English
  text in a separate per-language file, so adding Urdu or another language
  needs no code change.
- **Build in phases.** One track at a time, each reviewed, committed and
  released on its own.

## Tracks

| Track | Teaches | Starts in |
|---|---|---|
| Read Arabic from zero (Qaida) | Reading the Arabic letters and marks, in the Noorani Qaida lesson order | Phase 2 |
| Tajweed | Correct recitation: makhārij, letter qualities, rules | Phase 3 |
| Word meanings | Today's vocabulary course | Phase 1 |
| Understanding | Translation plus the grammar needed for it | Phase 4 |

There is no separate grammar track; Understanding teaches the grammar it
needs.

- A learner can join several tracks. One of them is the **main track**,
  which drives the Home screen's "Up next" card.
- Each track card in Learn has a "⋯" menu with **Make main track** and
  **Leave track**. Leaving keeps the track's progress, so rejoining picks up
  where the learner left off.
- Every track has four levels, **Beginner, Elementary, Intermediate,
  Advanced**, each made of numbered lessons.
- **Start from zero** is a guided plan for complete beginners: Qaida, then
  Tajweed foundations, then the Word meanings Foundation Course, then
  Understanding level 1, with milestones along the way. The learner can leave
  the plan at any time.

### Qaida levels

All content is written fresh for Bayan, following the Noorani Qaida order.
Each level ends with a short reading check before the next one opens.

| Level | Content |
|---|---|
| Beginner | Single letters, letter shapes, joined letters |
| Elementary | Short vowels, tanwīn, long vowels |
| Intermediate | Sukūn, shaddah, joining words |
| Advanced | Fluent reading of whole verses, ending at Juz ʿAmma |

### Tajweed levels

The reviewing teacher may adjust the order. The makhārij level depends most
on letter audio and ships right after Qaida.

| Level | Content |
|---|---|
| Beginner | Makhārij (the 5 areas and 17 articulation points), ṣifāt (letter qualities), letters learners commonly confuse (ح/ه, ع/ء, ص/س, ط/ت) |
| Elementary | Nūn sākinah and tanwīn (iẓhār, idghām, iqlāb, ikhfāʾ), mīm sākinah, ghunnah, lām shamsiyyah and qamariyyah, qalqalah |
| Intermediate | Madd types and counts (ṭabīʿī 2; muttaṣil and munfaṣil 4–5; lāzim 6; ʿāriḍ lis-sukūn 2/4/6; līn; badal), tafkhīm and tarqīq (rāʾ, the lām in the name of Allah), hamzat al-waṣl |
| Advanced | Waqf and ibtidāʾ and the muṣḥaf's pause signs, the four saktāt, Ḥafṣ special words (ishmām 12:11, imālah 11:41, tas-hīl 41:44), applying everything over longer passages |

### Word meanings levels

Today's course, unchanged in content. The Foundation Course and surah
lessons map onto the four levels, and the Words list moves inside this
track.

### Understanding levels

Builds on Word meanings: words the learner already knows become the
examples.

| Level | Content |
|---|---|
| Beginner | Short surahs of Juz ʿAmma word by word; noun, verb and particle; pronouns and attached pronouns |
| Elementary | Past and present verbs and commands, iḍāfah, prepositions, nominal and verbal sentences |
| Intermediate | Roots and patterns, verb forms I–X, medium-length surahs with less help |
| Advanced | Longer passages, word order and emphasis, comparing translations |

## Lessons and exercises

All tracks share one exercise engine and one set of exercise types:

| Exercise | What the learner does | Needs audio |
|---|---|---|
| Listen and choose | Hear a letter, word or verse and pick it | Yes |
| Read and choose | Read Arabic and pick its sound or meaning | No |
| Tap what you hear | Tap the letters or words in the order heard | Yes |
| Build it | Assemble a word, phrase or verse from pieces | No |
| Spot the rule | Find where a tajweed rule or grammar point occurs | No |
| Record and compare | Record yourself, then compare with the teacher's recording | Yes |

Recordings made in "Record and compare" stay on the device. Automatic
recitation checking through the microphone is a later step; phase 2 starts
with listening only.

## Progress

Each track measures progress as its own percentage of the Quran. The
figures are never combined, so they don't get mixed up. Each one only ever
grows, and every lesson ends by showing what it added, for example "+0.4%".

| Track | Percentage measures |
|---|---|
| Word meanings, Understanding | Words of the Quran the learner understands. This is the existing Quran coverage figure. |
| Qaida | Words of the Quran the learner can read, because they have learned all of the word's letters and marks |
| Tajweed | Places in the Quran where a tajweed rule applies and the learner has learned that rule. Needs tajweed-annotated text; arrives with Phase 3. |

- One streak and one daily goal across all tracks; each track keeps its own
  progress and level.
- New track progress is saved in new fields alongside existing data.
  Nothing existing changes, so no migration is needed; today's progress and
  streak carry over into the Word meanings track as they are.

## Placement tests

- One optional test per track, adaptive and retakeable. Skipping it starts
  the learner at the beginning.
- The same shape for every track: 10–20 questions, about 5 minutes, harder
  after a right answer and easier after a wrong one. The test stops once the
  level is clear.
- Scoring uses fixed, deterministic rules, not AI.
- The result is a level per track (Beginner to Advanced) with strengths and
  gaps, not a rank against other users, plus a recommended starting point.

| Track | Questions |
|---|---|
| Qaida | Hear a letter or word and pick it; read a word and pick its sound |
| Tajweed | Spot the rule in a verse; makhārij questions (recording comes later) |
| Word meanings | Meanings, from the most frequent words downwards |
| Understanding | Translate a short phrase; grammar questions |

## Screens

**Navigation:** five tabs, as few as possible: **Home, Learn, Practice,
Quran, Profile**.

**Home**, top to bottom:
1. Greeting.
2. Up next, from the main track.
3. Streak and daily goal, shared across tracks.
4. One slim progress row per joined track, showing that track's percentage.
5. Today's due reviews.

**Learn:** the learner's tracks as cards, main track first. Tapping a card
opens the track's path: four levels, numbered lessons, and a lock on what
isn't reached yet. Tracks not yet joined appear below under "Add a track".

**Practice**, top to bottom:
1. **Due today**: one spaced-repetition queue mixing all joined tracks.
2. **Drills**: practice by skill, such as confused letters, tajweed rules,
   word families and listening.
3. **Tests**: placement tests and level-up retakes.

**Quran reader:** verse audio, and in Phase 3 an optional colour-coded
tajweed view switched on from the reader's toolbar. That view uses
tajweed-annotated Quran text whose licence is verified first, and it feeds
the "Spot the rule" exercise.

**Onboarding** keeps the daily-time question. The level question becomes
**"What do you want to learn?"**, which allows several tracks, offers a
"completely new" option that starts the Start from zero plan, and offers
"take a short test". Tracks not released yet show as "Coming soon".

**Credits:** a short line under every audio player (e.g. "Recitation:
Al-Husary · everyayah.com") and a full **Sources & credits** page in
Profile → About listing every dataset, translation and recording with its
licence and link.

## Audio

Audio is a prerequisite for Qaida and Tajweed.

- **Verse audio:** Mahmoud Khalil Al-Husary's murattal recitation is the
  default. His muʿallim (teaching) recitation is used for tajweed practice.
  Muhammad Siddiq Al-Minshawi may come later as a second voice. The source
  is everyayah.com, credited with a link.
- **Letter audio**, in order of preference:
  1. Quran In Depth Academy's existing recordings, with permission.
  2. A one-off paid recording by a certified teacher, from them or another
     online academy.
  3. The app owner records on a phone and an online teacher reviews it.

  No synthetic or AI voices: they can't be trusted to get the makhārij
  right.
- **Caching:**
  - Lesson audio is cached when a lesson is first opened.
  - Verse audio streams and is cached once played.
  - A "download surah" option comes later.

## Free and Premium

- **Free:**
  - All of Qaida.
  - Tajweed foundations.
  - The first level of every track.
  - All placement tests.
- **Premium:**
  - Higher Tajweed and deeper Understanding levels.
  - Everything that is Premium today: opposites, derived forms, similar
    words, often confused, advanced analytics.

## Phases

1. **Track system and exercise engine.** Today's course becomes the Word
   meanings track. Also: new navigation, the Practice tab, the new
   onboarding question, and the Word meanings placement test. No new
   content.
2. **Audio and Qaida**, with the Qaida placement test.
3. **Tajweed**, with its placement test and the reader's tajweed view.
4. **Understanding**, with its placement test.

## Open items

| Item | Status | Needed by |
|---|---|---|
| everyayah.com / quran.com permission for Al-Husary and Al-Minshawi audio | Request sent 2026-10-30, awaiting reply | Phase 2 |
| Quran In Depth permission for letter recordings | Request sent 2026-10-30, awaiting reply | Phase 2 |
| Qualified teacher to review Qaida and Tajweed lessons | Not yet found | Phase 2 release |
| Saheeh International translation licence | To verify; find a clearly licensed translation if needed | Phase 4 |
| Tajweed-annotated Quran text and its licence | To find and verify | Phase 3 |
