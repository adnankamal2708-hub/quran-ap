# Salah track: understand every word of your prayer

Date: 2026-11-23
Status: draft, awaiting the owner's approval
Builds on: `docs/learning-tracks-design.md`, the Qaida track (`js/data-core/qaida-track.js`)

## Why

Most Muslims pray five times a day without knowing what they are saying.
Bayan already teaches the words of the Quran; the prayer is the place a
learner meets those words most often. This track teaches the meaning of
every word said in ṣalāh, in the order the learner meets it, so that
their prayer becomes something they understand.

The owner's priorities: authenticity first (correct steps, words and
meanings, each from a named authentic source), then a progressive path
from the basics to the long duʿāʾs, then a polished, glitch-free release.

## Goals

1. Every word said in an obligatory prayer understood, word by word.
2. The steps of the prayer, in order, shown by a faceless animated figure.
3. The learner's own school (madhab) respected where the schools differ,
   with the source of each view.
4. Progress shown as "% of the words in your prayer you understand".

## Non-goals (this version)

- Audio for the duʿāʾs. Plain text only (owner's decision). Short phrases
  (Allāhu akbar, subḥānallāh) get audio only if a clearly licensed or
  public-domain clip is found, and the owner sees it before it is added.
- Fiqh rulings beyond the steps: what breaks the prayer, sujūd as-sahw,
  making up missed prayers, wuḍūʾ. (Candidates for a later version.)
- Sunnah and nafl prayers other than Witr; Jumuʿah, ʿĪd, Janāzah.
- Women's differences in posture. The figure is a man (owner's decision);
  the text notes that some details differ for women in some schools.

## Anti-goals (a failure even if it works)

- Any duʿāʾ, meaning or step without a named source.
- Presenting one school's view as the only correct one.
- A drawn face or eyes on the figure.
- AI or synthetic voices; splicing Quran word clips into duʿāʾs.
- XP, points or leaderboards.
- Copying a copyrighted English translation (sunnah.com's English is
  copyrighted). Meanings are written for Bayan; the Arabic is public domain.
- Releasing without the "awaiting teacher review" note while no teacher
  has checked the madhab content.

## Decisions made with the owner

- **Madhab:** one course with a madhab setting. When joining the track the
  learner picks Ḥanafī, Mālikī, Shāfiʿī, Ḥanbalī, or "I'm not sure";
  Settings can change it later. Shared content is written once; only the
  points of difference are tagged per school, each with its source.
  "I'm not sure" shows the majority view with a note that the others are
  valid too.
- **Audio:** none for duʿāʾs (see Non-goals).
- **Approach A, a full track like Qaida:** a path of 4 levels of numbered
  lessons, exercises from the existing exercise engine, a reading check at
  the end of each level, phrase words feeding review, progress as a %.
- **The figure:** faceless man in a white thobe and kufi, side view facing
  the qibla, SVG with hinged limbs, works offline, still poses when reduced
  motion is on, gold rings marking the detail of each position. Approved
  from prototype 2 (2026-11-23). It follows the madhab for hand placement
  and hand raising. It is part of the teacher review.
- **Order:** the Salah track is the last track in the list.

## Approaches considered

- **A. Full track like Qaida (chosen).** Levels, lessons, exercises, review,
  a progress %. Most work, but it is what turns "reading the words" into
  "understanding them", and it reuses the engine the other tracks use.
- **B. A reference guide.** One scrolling page per step with the Arabic,
  meaning and figure. Fast to build, but nothing checks understanding and
  nothing is remembered; rejected as too shallow for the goal.
- **C. Words only, added to the Word meanings track.** Reuses everything,
  but loses the order of the prayer, the steps and the madhab differences.

## The path

Each level ends with a reading check: the learner reads each phrase of the
level and picks its meaning, word by word. 80% passes (the Qaida value).

**Level 1 · The steps and the short phrases**
1. The steps of one rakʿah, in order (figure walkthrough, no Arabic yet)
2. Takbīr: Allāhu akbar
3. Taʿawwudh and basmalah
4. Rukūʿ: subḥāna rabbiya l-ʿaẓīm
5. Rising: samiʿa Llāhu li-man ḥamidah · rabbanā wa laka l-ḥamd
6. Sujūd: subḥāna rabbiya l-aʿlā
7. Between the two sajdahs: rabbi ghfir lī
8. Taslīm: as-salāmu ʿalaykum wa raḥmatu Llāh

**Level 2 · Al-Fātiḥah and short surahs**, word by word
1–3. Al-Fātiḥah (in three parts) · 4. al-Ikhlāṣ · 5. al-Kawthar ·
6. al-ʿAṣr · 7. al-Falaq · 8. an-Nās

**Level 3 · The opening duʿāʾ and the tashahhud** (per madhab)
1. The opening duʿāʾ (thanāʾ) · 2–3. The tashahhud · 4. Raising the finger
· 5. The first and last sitting (when each is said)

**Level 4 · The longer duʿāʾs**
1–2. Aṣ-ṣalawāt al-Ibrāhīmiyyah · 3. Duʿāʾ before salām (Abū Bakr's) ·
4. Seeking refuge from four things · 5–6. Witr and its qunūt (per madhab)

## Content and sources

Every phrase record carries: Arabic (fully voweled), transliteration,
a word-by-word breakdown (Arabic word, transliteration, meaning, and the
app's word id when the word is in the Quran), a whole-phrase meaning, the
step it belongs to, `madhab` tags where it applies to some schools only,
and `sources` (collection and number). The Quran passages are taken from
the app's own Quran text (`js/quran/quran-data.js`), not retyped.

Shared phrases and their main sources:

| Phrase | Source |
|---|---|
| Takbīr | Bukhārī 757; Abū Dāwūd 61 |
| Rukūʿ and sujūd tasbīḥ | Muslim 772; Abū Dāwūd 869–870 |
| samiʿa Llāhu… / rabbanā wa laka l-ḥamd | Bukhārī 789, 795 |
| rabbi ghfir lī (between sajdahs) | Abū Dāwūd 874; Ibn Mājah 897 |
| Aṣ-ṣalawāt al-Ibrāhīmiyyah | Bukhārī 3370; Muslim 406 |
| Duʿāʾ of Abū Bakr before salām | Bukhārī 834; Muslim 2705 |
| Refuge from four things | Muslim 588 |
| Taslīm | Abū Dāwūd 996; Tirmidhī 295 |

Points of difference, tagged per school (to be confirmed by the teacher):

| Point | Ḥanafī | Mālikī | Shāfiʿī | Ḥanbalī |
|---|---|---|---|---|
| Opening duʿāʾ | subḥānaka Llāhumma… (Abū Dāwūd 775) | none in obligatory prayers | wajjahtu wajhiya… (Muslim 771) | subḥānaka Llāhumma… |
| Tashahhud | Ibn Masʿūd (Bukhārī 831) | ʿUmar (Muwaṭṭaʾ) | Ibn ʿAbbās (Muslim 403) | Ibn Masʿūd |
| Hands in qiyām | right over left, below the navel | at the sides (the well-known view) | right over left, below the chest | right over left, below the navel |
| Raising the hands | opening takbīr only | opening takbīr only | opening, before and after rukūʿ, rising from first tashahhud | opening, before and after rukūʿ |
| The finger | raised at "lā ilāha", lowered at "illā" | moved through the tashahhud | raised at "illā Llāh" | raised at each mention of Allah |
| Short sitting before standing | no | no | yes | no (the well-known view) |
| Qunūt in Fajr | no | yes, before rukūʿ | yes, after rukūʿ | no |
| Witr qunūt | before rukūʿ, all year (Allāhumma innā nastaʿīnuka…) | — (in Fajr instead) | after rukūʿ, second half of Ramaḍān | after rukūʿ, all year (Allāhumma hdinī… Abū Dāwūd 1425) |

"I'm not sure" shows the view held by most schools on each point (for
hands: right over left), with a one-line note that the other views are
also valid and that the learner can follow their local teacher.

## The madhab setting

- Saved as `madhab` in the existing settings (`quran_settings`, already
  synced), one of `hanafi`, `maliki`, `shafii`, `hanbali`, `unsure`.
  No Firestore schema change: settings is an existing field.
- Asked once, when the learner first joins the Salah track, on a short
  screen with the five choices. Changeable in Settings at any time.
- Changing it never loses progress: progress is per lesson, and lessons
  are the same for every school; only the tagged phrases inside change.
  Words already learned stay learned.

## The figure

- `js/ui/salah-figure.js` draws a pose; poses live in
  `js/salah/salah-figure-poses.js`. The approved prototype's maths
  (forward kinematics, two-bone IK for the arms, cubic-eased blending) is
  carried over and split to keep each file under 300 lines.
- Shown in lesson 1.1 (a walkthrough of one rakʿah, tap a step to stop on
  it) and beside each step's phrase in later lessons.
- Madhab: qiyām hand position and extra hand raising (an added takbīr-style
  pose before and after rukūʿ for Shāfiʿī and Ḥanbalī) come from the setting.
- Reduced motion: still poses, no blending. Colours come from theme tokens
  so it works in light and dark.
- Gold rings mark each position's detail; the detail line under the figure
  says it in words, so nothing depends on colour alone.

## Progress and review

- **%:** words in the learner's prayer (their madhab's phrases, Levels 1–4)
  that they understand, over all of them. Recorded with
  `recordTrackPercent('salah', …)`, which only ever grows. The track card
  labels it "of your prayer", not "of the Quran".
- **Review:** a missed word that is in the Quran goes into the normal word
  review under its existing word id, so it also counts towards Quran
  progress. A missed word not in the Quran (for example ghayruk) goes into
  a Salah review queue kept apart, like Qaida's, so the Quran stats stay
  Quran-only. *(My call: the owner asked for the normal queue; this keeps
  that for every Quran word and avoids counting non-Quran words as Quran.)*
- Progress is its own key, `quran_salah_progress`, synced as
  `salahProgress` with a merge that keeps the higher value, as Qaida does.
- Track id `salah` added to `TRACK_IDS` (last). Old saved states load
  unchanged: `normalizeTrackState` fills in missing tracks.

## Release

- `isTrackReleased('salah')` returns true, and the track shows an
  "awaiting teacher review" note on its card and on every Level 3–4 lesson
  until the teacher has checked the madhab content and the figure. The
  note is removed by one flag in the data file when the review is done.

## Files (planned)

- `js/salah/salah-phrases.js`: phrase records and sources (data, not
  word data, so not in `js/data/`)
- `js/salah/salah-lessons.js`: levels and lessons
- `js/salah/salah-figure-poses.js`: poses
- `js/salah/salah-exercises.js`: exercise builders over the engine
- `js/data-core/salah-track.js`: progress, locks, %, review, madhab lookup
- `js/ui/salah-ui.js`, `js/ui/salah-figure.js`, a madhab picker
- Tests in `test/`, added to `test/run-all.js`; files added to `build-files.js`;
  UI strings through `t()`.

## Audit before release

An automated check that fails the build if: a phrase has no source; a word
has no meaning; a Quran passage differs from `quran-data.js`; any of the
five madhab choices leaves a step without its phrase; a lesson refers to a
missing phrase. Then a manual pass over every lesson in every madhab, on a
phone width, light and dark, and the e2e suite.

## Left to the builder

Exercise mix per lesson, the exact copy of notes and screens (plain,
short, through `t()`), and how the walkthrough's controls look, within the
app's existing design language.

## Open, for the teacher

Every row of the differences table, the Mālikī Witr and Fajr qunūt wording,
the hand position for "I'm not sure", and the figure's poses.
