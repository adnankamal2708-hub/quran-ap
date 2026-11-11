# Data audit — 10 November 2026

A one-off check of the information Bayan shows: the Quran text, the verse
translations, the word-by-word meanings, the 1,251 lesson words and their
example verses, the surah and juz tables, and the Qaida and Tajweed tables.
Nothing was changed. Every list below is for review and fixing.

How it was done: scripts compared each item with the app's own Quran text
and with a second copy of the text (quran.com, QPC Hafs). Every flagged
item in sections 1, 2, 5 and 8 was then read by hand. Counts marked
"at least" come from checks that can miss cases, so the real number may be
higher.

## Status after the repair (11 November 2026)

- **Fixed: 1, 2, 3, 4, 5, 8.** Every example is now the exact text of
  the one verse it cites, with that verse's translation, and the highlight
  is the taught word. A lesson word that isn't in the Quran in the form
  given was replaced by the real word from the verse (168 words). Meanings
  come from the quran.com word-by-word data, and progress carries over through
  `cid`. The 23 Names of Allah that come only from the hadith are kept,
  labelled "from the hadith" and given a count of 0. `test/lesson-examples.test.js`
  checks all of this on every build.
- **Fixed: 6.** The notes are now Ibn Kathir's own Arabic, quoted word
  for word from `data-sources/ibn-kathir-ar.json` (611 words). Words with no
  quote that clearly explains them show links only (to the full Arabic and
  the abridged English on quran.com). The test checks every quote against
  the source.
- **Fixed: 9, 10.** Roots, parts of speech and counts come from the
  Quranic Arabic Corpus.
- **12, changed.** In 107 surah-lesson words, the word doesn't occur
  anywhere in the lesson's surah. They now cite a verse where they really
  occur, instead of a verse from the surah that doesn't contain them. When
  the surah has the same word in another form (ٱلصَّلَوٰةَ for صَلَاة), the
  lesson now teaches that form, in that surah. Still open: whether to swap
  those 107 for words that are in the surah.
- **Fixed: 7.** `js/data-core/word-forms.js` tells look-alikes apart by
  their vowel marks (مِنْ / مَنْ, الْجَنَّة / الْجِنَّة). The occurrence
  index gives such a lesson word its own key, so counts, coverage, verse
  lists, highlights and drills no longer mix them. Coverage is now 41.2% of
  the Quran for all words (was 43.7%) and 28.4% for the Foundation Course
  (was 30.3%).
- **Fixed: 11.** A word written the same way now has one meaning in every
  lesson. هَوَىٰ keeps two, "desire" and "it fell", because it is two
  words. `test/canonical-ids.test.js` checks this.
- **Fixed: 13.** فَٱدَّٰرَٰٔتُمۡ in 2:72 shows as one word.
- The Foundation Course words (the first 100) keep their form and order.

## Summary

| # | Problem | How many | How serious |
|---|---|---|---|
| 1 | Example "verses" containing text that is not in the Quran, or is reworded | at least 33 lesson words | Critical |
| 2 | Lesson words that are not in the Quran, shown with a verse reference | at least 28 words, plus 19 of the Names of Allah | Critical |
| 3 | The taught word is not in the verse the lesson cites | 94 lesson words | High |
| 4 | Example made of pieces from several verses under one reference | 45 lesson words | High |
| 5 | Verse reference is wrong (the text is real, from another verse) | 15 lesson words | High |
| 6 | Notes that say "Ibn Kathir explains…" with no source to check | 823 lesson words | High |
| 7 | Different words that look alike without vowel marks are treated as one word | at least 1,250 Quran words (1.6%) | High |
| 8 | Example verse shows a different word from the one taught | at least 10 lesson words | High |
| 9 | Made-up roots for particles and names | at least 15 lesson words | Medium |
| 10 | Stored word counts differ from the real count | 50 lesson words | Medium |
| 11 | Same word entered more than once with different meanings | 23 words | Medium |
| 12 | Lesson's surah number differs from its verse reference | 13 lesson words | Low |
| 13 | One Quran word is split in two on screen (2:72) | 1 word | Low |

Problems 1–5 are concentrated in the Names of Allah lesson and in the surah
lessons from surah 10 onward. Problem 8 is in the high-frequency word
batches. Sections 1–5 overlap: one lesson word can appear in several.

## What checked out

- **Quran text:** 6,234 of 6,236 verses match the second copy character for
  character (ignoring the stretching mark, tatweel, and spaces). The two
  differences are 2:72 (section 13) and 11:41, where the imālah mark under
  مَجۡر۪ىٰهَا is stored as U+065C and the second copy uses U+06EA. Both draw
  a mark under the letter, so 11:41 needs no change.
- **Verse counts and surah types:** all 114 surahs have the standard verse
  count (6,236 in total) and the standard Meccan/Medinan label.
- **Juz table:** all 30 start points match the Madinah mushaf.
- **Verse translations:** none empty, none with leftover markup.
- **Word-by-word meanings:** all 77,429 line up with the text (checked at
  build time), none empty, no markup.
- **Qaida and Tajweed tables:** 28 letters, the six letters that don't join
  forward (ا د ذ ر ز و), and the articulation points are the standard ones.
- **Lesson words:** none has an empty required field or an invalid verse
  number.

## Not checked

- Whether each "tafsir" note is true to its source (section 6).
- The English wording of each example translation (`ayahT`).
- Transliterations, word patterns (`pattern`) and root-family lists.
- Whether the Saheeh International text matches its published edition.
- Whether each word-by-word meaning is the best translation; only that it
  is the source's meaning for that word.
- Audio.

## 1. Example verses with text that is not in the Quran

The lesson shows this Arabic as a verse, with a verse reference. Each one
below was read against the verse.

| Word | Meaning | Cites | Lesson | What is wrong |
|---|---|---|---|---|
| الَّذِينَ | Those Who | 1:7 | grammar | Skips words: the verse is صِرَٰطَ ٱلَّذِينَ…, and ٱهۡدِنَا ٱلصِّرَٰطَ belongs to 1:6 |
| عَزِيزٌ | Almighty | 2:209 | attributes | Not the wording of 2:209 (أَنَّ ٱللَّهَ عَزِيزٌ حَكِيمٌ) |
| سُبْحَانَ | Glory be to | 17:43 | isra | Not a verse (a dhikr phrase from hadith) |
| عَلَى | Upon/On | 20:5 | grammar | Not a verse. 20:5 is ٱلرَّحۡمَٰنُ عَلَى ٱلۡعَرۡشِ ٱسۡتَوَىٰ |
| خَيْر | Good | 4:149 | baqarah | Ending changed; 4:149 ends كَانَ عَفُوّٗا قَدِيرًا |
| أَرْض | Earth | 40:64 | baqarah | Garbled; 40:64 starts ٱللَّهُ ٱلَّذِي جَعَلَ لَكُمُ ٱلۡأَرۡضَ |
| الم | Alif, Lam, Meem | 2:1 | muqattaat | Corrupt characters and wrong vowel marks |
| الْمُؤْمِنُ | The Guardian of Faith | 59:23 | asma-al-husna | Opening changed (59:23 starts هُوَ ٱللَّهُ ٱلَّذِي) |
| الْمُهَيْمِنُ | The Protector | 59:23 | asma-al-husna | Word اللَّهُ added in front |
| الْجَبَّارُ | The Compeller | 59:23 | asma-al-husna | Word اللَّهُ added in front |
| الْمُتَكَبِّرُ | The Supreme | 59:23 | asma-al-husna | Word اللَّهُ added in front |
| الْمَجِيدُ | The Glorious | 11:73 | asma-al-husna | Not a verse (mixes 27:26 and 85:15) |
| الْبَاعِثُ | The Resurrector | 22:7 | asma-al-husna | Contains ثُمَّ يَقُولُ لِلْأَرْضِ … كُونِي, not a verse; 22:7 says يَبۡعَثُ, not بَاعِثُ |
| الْمُحْيِي | The Giver of Life | 40:68 | asma-al-husna | إِنَّ اللَّهَ هُوَ الْمُحْيِي is not a verse |
| الْمَاجِدُ | The Noble | 11:73 | asma-al-husna | إِنَّ اللَّهَ حَمِيدٌ مَجِيدٌ and وَأَنَّ كُلَّ شَيْءٍ… are reworded |
| الْمُقَدِّمُ | The Advancer | 54:55 | asma-al-husna | A hadith phrase shown as verse 54:55 |
| الْمُؤَخِّرُ | The Delayer | 54:55 | asma-al-husna | A hadith phrase shown as verse 54:55 |
| الرَّءُوفُ | The Compassionate | 9:117 | asma-al-husna | وَأَنَّ اللَّهَ بِالْمُؤْمِنِينَ لَرَءُوفٌ is not a verse |
| النَّافِعُ | The Benefiter | 10:106 | asma-al-husna | إِنَّ اللَّهَ هُوَ النَّافِعُ الضَّارُّ is not a verse |
| الْفُجَّارِ | The Wicked | 11:46 | hud | وَنُودِيَ أَن لَّعْنَةُ اللَّهِ… is reworded (7:44) |
| الظَّالِمِينَ | The Wrongdoers | 11:101 | hud | Last word changed (6:11 has ٱلۡمُكَذِّبِينَ) |
| آنَاءَ | Hours/Periods | 11:114 | hud | أَقِمِ الصَّلَاةَ آنَاءَ اللَّيْلِ is not a verse |
| مَقَامِي | My Station | 14:37 | ibrahim | Verse cut short and مَقَامِي added (that word is in 14:14) |
| الْقُرْبَانِ | Sacrifice/Offering | 22:34 | hajj | Reworded (22:52 has وَمَآ أَرۡسَلۡنَا) |
| الْغَيْبِ | The Unseen | 24:44 | nur | Reworded (10:61 has وَمَا تَكُونُ فِي شَأۡنٖ) |
| الْبَيِّنَاتِ | Clear Evidences | 3:183 | aal-e-imran | Reworded (6:104 has قَدۡ جَآءَكُم بَصَآئِرُ) |
| مِيثَاقَ | Covenant | 4:90 | an-nisa | Reworded (2:27 has عَهۡدَ ٱللَّهِ) |
| الْخِزْيِ | Disgrace | 40:37 | ghafir | فَأَسَاءُوا فِيهَا الظَّنَّ… is not a verse |
| فَاصْبِرْ | So Be Patient | 44:59 | dukhan | فَاصْبِرْ إِنَّهُم مُّنتَظِرُونَ is not a verse (32:30 has وَٱنتَظِرۡ) |
| بِمَا | By What/With What | 68:1 | qalam | 68:1 has وَمَا يَسۡطُرُونَ, not بِمَا; the taught word is not in the verse |
| الَّذِينَ | Those Who | 7:2 | grammar | وَمَنْ يُعْرِضْ… فَلَنْ يَعْلَمَ… is not a verse |
| بَدْرٍ | Badr | 8:42 | al-anfal | يَوْمَ بَدْرٍ is not in the Quran (Badr is named once, 3:123) |
| لِلَّذِينَ يَشَاءُونَ | For Those Who Will | 81:28 | takwir | Verse repeated twice; the taught phrase لِلَّذِينَ يَشَاءُونَ is not in the Quran |

Also, 14 examples drop words from the middle of a verse without
showing "…" (for example الْجَنَّةَ at 2:25 and الظَّاهِرُ at 57:3).

## 2. Lesson words that are not in the Quran

Taught as Quran vocabulary, with a verse reference and a count, but the word
is not in the Quran in this form. Some are typing mistakes
(الْحَاقِلَاتِ for ٱلۡحَٰمِلَٰتِ, لَأَنْعَامِ for ٱلۡأَنۡعَٰمِ). Others are
topic words that the Quran does not use (الْخِتَانِ, الظِّهَارِ, بِلْقِيسَ).

| Word | Meaning | Cites | Lesson | |
|---|---|---|---|---|
| بِلْقِيسَ | Queen of Sheba | 27:23 | naml |  |
| الْخِتَانِ | Circumcision | 33:49 | ahzab |  |
| الظِّهَارِ | Zihar (Divorce by Likening) | 33:4 | ahzab |  |
| ظِهَارِ | Zihar (Divorce by Likening) | 58:2 | mujadilah |  |
| الْحَاقِلَاتِ | Those That Bear Heavy Loads | 51:2 | dhariyat |  |
| الْمُبْتَغِينَ | Those Who Seek | 24:33 | nur |  |
| السَّجْدَةِ | The Prostration | 32:15 | sajdah |  |
| مُلْتَقُونَ | Those Who Meet | 37:24 | saffat |  |
| مُّزْدَجِرُونَ | Admonished/Warned | 54:5 | qamar |  |
| خَسَفَتْ | Is Collapsed | 84:3 | inshiqaq |  |
| الْمُلْحِدِينَ | The Deviators | 90:7 | balad |  |
| لَن نَّبْرَحَهُ | We Will Never Leave Him | 72:6 | jinn |  |
| شِرَاءَ | Purchase/Trade | 14:28 | ibrahim |  |
| الْفَاجِرِينَ | The Wicked | 28:50 | qasas |  |
| الْعَنَاءِ | Hardship | 29:7 | ankabut |  |
| الْمُغِيرَةِ | Raiding/Charging | 31:31 | luqman |  |
| الْأَرْوَاحُ | The Souls | 32:11 | sajdah |  |
| بَيْعَةِ | The Pledge of Allegiance | 48:10 | fath |  |
| وَاغْتِبِ | And Backbite | 49:12 | hujurat |  |
| التَّحْرِيمِ | The Prohibition | 66:1 | tahrim |  |
| حَاسِبًا | Reckoning | 84:8 | inshiqaq |  |
| يُجَادِلُكَ | She Disputes With You | 58:1 | mujadilah |  |
| الْفَطْرَتِ | Natural Disposition | 6:79 | al-anam |  |
| لَأَنْعَامِ | Livestock/Cattle | 16:5 | hijr |  |
| الْإِسْرَاءَ | The Night Journey | 17:1 | isra |  |
| الْفَرَجَ | Relief/Deliverance | 18:16 | kahf |  |
| لِلَّذِينَ يَشَاءُونَ | For Those Who Will | 81:28 | takwir |  |
| فَأَعْطَىٰ | He Gave | 92:5 | layl |  |

Names of Allah from the traditional list of 99 that are not words in the
Quran text, though each is shown with a verse: الْقَابِضُ، الْخَافِضُ، الرَّافِعُ، الْمُذِلُّ، الْجَلِيلُ، الْبَاعِثُ، الْمُحْصِي، الْمُبْدِئُ، الْمُعِيدُ، الْمُمِيتُ، الْوَاجِدُ، الْمَاجِدُ، الْمُقَدِّمُ، الْمُؤَخِّرُ، الْمُنْتَقِمُ، الْمُقْسِطُ، الْمُغْنِي، النَّافِعُ، الصَّبُورُ.
These can stay as names, but should say they come from the traditional
list, and should not carry a Quran word count.

## 3. Taught word is not in the cited verse

94 lesson words, found by script. Letters were compared without vowels,
so a few may be spelling differences. Each line is: word, meaning, cited
verse, lesson, and the word highlighted in the example (hl) if there is one.

- الْخَافِضُ [The Abaser] 22:18 (asma-al-husna)
- الرَّافِعُ [The Exalter] 94:4 (asma-al-husna)
- الْمُعِيدُ [The Restorer] 85:13 (asma-al-husna) hl=يُعِيدُهُ
- الْمُحْيِي [The Giver of Life] 40:68 (asma-al-husna) hl=الْمُحْيِي
- الْوَاجِدُ [The Finder] 93:6 (asma-al-husna)
- الْمُؤَخِّرُ [The Delayer] 54:55 (asma-al-husna) hl=الْمُؤَخِّرُ
- النَّافِعُ [The Benefiter] 10:106 (asma-al-husna)
- الصَّبُورُ [The Patient] 21:89 (asma-al-husna)
- يَقِينًا [Certainty] 10:52 (yunus) hl=الْيَقِينُ
- الْفُجَّارِ [The Wicked] 11:46 (hud)
- الْحَقِّ [The Truth] 11:101 (hud) hl=الْحَقِّ
- الْمِثْقَالَ [The Weight] 13:17 (rad)
- مَقَامِي [My Station] 14:37 (ibrahim) hl=مَقَامِي
- شِرَاءَ [Purchase/Trade] 14:28 (ibrahim)
- الْخَطِيئَاتِ [Sins/Offenses] 14:10 (ibrahim)
- نَقُولُ [We Say] 15:65 (common) hl=وَقُلْنَا
- عَسَلٍ [Honey] 16:69 (nahl)
- الْمَعْرُوفِ [Good/Right] 16:90 (nahl)
- الْفِتْنَةِ [Trial/Temptation] 18:7 (kahf)
- الْمُسْتَقِيمَ [The Straight] 18:2 (kahf)
- سَيِّدًا [A Master/Leader] 19:32 (maryam)
- النُّبُوَّةِ [Prophethood] 19:30 (maryam)
- قَلْبِي [My Heart] 20:25 (taha)
- الذِّكْرُ [Remembrance] 20:2 (taha)
- الأنبياء [The Prophets] 21:7 (anbiya)
- الظَّالِمِينَ [The Wrongdoers] 21:11 (anbiya)
- الْكَعْبَةِ [The Kaaba] 22:26 (hajj)
- الزَّبَانِيَةَ [The Angels of Punishment] 22:22 (hajj)
- الْإِذْنِ [Permission] 22:62 (hajj)
- الْقُرْبَانِ [Sacrifice/Offering] 22:34 (hajj)
- الْمِيزَانُ [The Balance] 23:102 (muminun)
- جَنَّةِ [Garden/Paradise] 23:11 (muminun)
- الْغَيْبِ [The Unseen] 24:44 (nur) hl=غَيْبَ
- الْكَبَائِرَ [Major Sins] 25:70 (furqan)
- أَلِيمٌ [Painful] 25:65 (furqan)
- الْأُمِّيِّينَ [The Unlettered] 26:198 (shuara)
- طَغَىٰ [He Transgressed] 26:11 (shuara) hl=طَغَىٰ
- الْأَعْرَافِ [The Heights] 26:102 (shuara)
- الْعَذَابُ [The Punishment] 26:105 (shuara)
- بِلْقِيسَ [Queen of Sheba] 27:23 (naml)
- الصِّرَاطِ [The Path] 27:2 (naml)
- جِبْتِ [False Object of Worship] 28:63 (qasas)
- التَّابُوتِ [The Ark/Chest] 28:7 (qasas)
- الْأَرْحَامِ [Kinship Ties / The Wombs] 29:8 (ankabut)
- السَّمْعَ [Hearing] 3:20 (aal-e-imran) hl=سَمِعْنَا
- الْمُغِيرَةِ [Raiding/Charging] 31:31 (luqman)
- الْمَهْدِ [The Cradle] 32:27 (sajdah)
- الْأَرْوَاحُ [The Souls] 32:11 (sajdah)
- يَتَخَافَتُونَ [They Whisper] 32:3 (sajdah)
- الظِّهَارِ [Zihar (Divorce by Likening)] 33:4 (ahzab)
- الْخِتَانِ [Circumcision] 33:49 (ahzab)
- وَهَنُوا [They Weakened] 35:44 (fatir)
- يَسْعَوْنَ [They Strive/Run] 36:55 (yasin)
- حَتَّىٰ [Until/Even] 36:67 (grammar)
- الْأَنْهَارِ [Rivers] 36:34 (yasin)
- الذَّبْحِ [Slaughter/Sacrifice] 37:107 (saffat)
- الْأَصْنَامَ [Idols] 37:95 (saffat)
- حَقَّ [Truly/With Certainty] 39:29 (zumar)
- اللَّقَاءِ [The Meeting] 39:54 (zumar)
- الْخَمْرِ [Wine/Intoxicants] 4:43 (an-nisa) hl=الْخَمْرُ
- الْأَبْصَارُ [The Eyes/Sight] 40:17 (ghafir)
- الْخِزْيِ [Disgrace] 40:37 (ghafir)
- أَعْرَاضَ [Sides/Flanks] 41:23 (fussilat)
- الْمُسْتَغْفِرِينَ [Those Who Seek Forgiveness] 41:5 (fussilat)
- نَجَّاهُمْ [He Delivered Them] 42:32 (shura)
- ذُنُوبَنَا [Our Sins] 42:37 (shura)
- الزُّخْرُفِ [The Gold Adornments] 43:33 (zukhruf) hl=زُخْرُفًا
- فَاصْبِرْ [So Be Patient] 44:59 (dukhan) hl=فَاصْبِرْ
- الْحِسَابِ [The Reckoning] 45:26 (jathiyah)
- مَوَدَّةَ [Affection/Love] 45:30 (jathiyah)
- مُّسْتَكْبِرِينَ [Arrogant] 46:11 (ahqaf)
- ازْدَجَرَ [He Repelled/Deterred] 46:29 (ahqaf)
- مَغْفِرَةً [Forgiveness] 48:2 (fath)
- النَّجْوَىٰ [Private Consultation] 5:52 (al-maidah) hl=النَّجْوَىٰ
- ذَرَأْنَا [We Created] 51:56 (dhariyat)
- أَكْوَابٍ [Cups/Goblets] 52:23 (tur)
- آيَاتِ [Signs] 54:22 (qamar)
- لَا إِكْرَاهَ [No Compulsion] 57:7 (hadid)
- كَفَّارَةٌ [Expiation] 58:3 (mujadilah)
- الشِّرْكَ [Associating Partners with Allah / Polytheism] 6:82 (al-anam) hl=الشِّرْكَ
- ذَرُونِي [Leave Me] 61:5 (saff)
- لَاهِيَةً [Distracted/Heedless] 62:11 (jumuah)
- السَّاعَةُ [The Hour] 63:9 (munafiqun)
- الطَّلَاقِ [The Divorce] 65:1 (talaq)
- أَجَلًا [Appointed Term] 65:2 (talaq)
- صَالِحِينَ [Righteous] 66:6 (tahrim)
- الَّذِينَ [Those Who] 7:2 (grammar) hl=الْمُنذِرِينَ
- بَدْرٍ [Badr] 8:42 (al-anfal) hl=بَدْرٍ
- الصَّفَّ [The Row/Rank] 8:45 (al-anfal) hl=صَفًّا
- سَبِيلِ [Way/Path] 8:39 (al-anfal) hl=سَبِيلِ
- الْأَسْحَارِ [The Dawning Hours] 82:18 (infitar) hl=الْأَسْحَارِ
- يَسْخَرُونَ [They Mock] 83:30 (mutaffifin)
- الزَّكَاةَ [The Purifying Alms] 9:60 (at-tawbah) hl=الزَّكَاةَ
- قَدِيرٌ [All-Powerful] 99:8 (zalzalah)

## 4. Examples made of several verses under one reference

| Word | Cites | Pieces | Pieces come from |
|---|---|---|---|
| الرَّافِعُ | 94:4 | 5 | 94:4, 94:5, 94:7, 94:8, 3:159 |
| الْحَسِيبُ | 4:6 | 4 | 16:89, 4:86 |
| الْمُجِيبُ | 11:61 | 2 | 40:60, 11:61 |
| الْوَاسِعُ | 2:115 | 2 | 2:255, 2:115 |
| الْبَاعِثُ | 22:7 | 3 | 30:48, **not in the Quran**, 22:7 |
| الْوَلِيُّ | 2:257 | 2 | 10:62, 2:257 |
| الْمُبْدِئُ | 10:34 | 3 | 29:20, 30:10, 10:34 |
| الْمُحْيِي | 40:68 | 5 | 10:31, 30:19, 3:62, 67:2, **not in the Quran** |
| الْمُمِيتُ | 39:42 | 2 | 67:2, 39:42 |
| الْوَاجِدُ | 93:6 | 6 | 93:6, 93:7, 93:8, 15:86, 11:111, 24:40 |
| الْمَاجِدُ | 11:73 | 4 | 16:98, 4:33, **not in the Quran** |
| الْمُقَدِّمُ | 54:55 | 4 | 2:255, 7:89, 36:36, **not in the Quran** |
| الْبَاطِنُ | 57:3 | 2 | 57:3, 37:66 |
| التَّوَّابُ | 9:104 | 2 | 9:118, 9:104 |
| الرَّءُوفُ | 9:117 | 3 | 2:143, 2:64, **not in the Quran** |
| الْمُغْنِي | 93:8 | 4 | 93:8, 15:86, 53:42, 53:47 |
| النَّافِعُ | 10:106 | 2 | 25:3, **not in the Quran** |
| الْبَاقِي | 16:96 | 3 | 55:26, 55:27, 16:96 |
| الصَّبُورُ | 21:89 | 2 | 3:186, 2:153 |
| آيَاتِ | 10:6 | 6 | 10:6, 7:54, 10:57, 10:61, 10:67, 10:104 |
| يَقِينًا | 10:52 | 6 | 19:73, 13:7, 13:27, 10:108, 27:93, 15:99 |
| الْفُجَّارِ | 11:46 | 7 | 11:46, 11:44, **not in the Quran**, 11:60, 11:47, 11:48 |
| الصَّالِحِينَ | 11:117 | 2 | 11:46, 11:117 |
| الْحَقُّ | 13:19 | 6 | 13:14, 13:15, **not in the Quran**, 39:9, 13:19 |
| الْمِثْقَالَ | 13:17 | 4 | 13:17, 35:27, 39:3 |
| نَقُولُ | 15:65 | 2 | **not in the Quran**, 17:104 |
| التَّقْوَىٰ | 16:128 | 4 | 16:128, 16:127, 3:77 |
| الْإِسْرَاءَ | 17:1 | 4 | 17:1, 17:30, **not in the Quran**, 17:80 |
| الذِّكْرُ | 20:2 | 5 | 20:2, 20:3, 20:114, 87:6 |
| الْإِذْنِ | 22:62 | 2 | 22:62, 31:30 |
| الْغَيْبِ | 24:44 | 4 | 32:4, **not in the Quran**, 10:61, 49:18 |
| الْمُبْتَغِينَ | 24:33 | 2 | 24:33, 3:85 |
| السَّمْعَ | 3:20 | 3 | 2:285, 3:53, 2:93 |
| الظَّالِمِينَ | 4:64 | 3 | 4:64, 25:19, 3:57 |
| الْخَمْرِ | 4:43 | 2 | 4:43, 5:90 |
| مِيثَاقَ | 4:90 | 4 | 9:4, 3:76, 4:152, **not in the Quran** |
| الْحَلَالُ | 5:5 | 3 | 5:1, 5:4, 5:5 |
| النَّجْوَىٰ | 5:52 | 2 | 58:9, 58:10 |
| الشِّرْكَ | 6:82 | 2 | 6:82, 31:13 |
| الْفَطْرَتِ | 6:79 | 4 | 6:79, 30:30, 7:187 |
| بَدْرٍ | 8:42 | 6 | 8:42, 3:76, 8:17, 2:194, **not in the Quran** |
| الصَّفَّ | 8:45 | 2 | 8:45, 61:4 |
| سَبِيلِ | 8:39 | 6 | 8:39, 12:19, 8:40, 8:41, 4:75 |
| الزَّكَاةَ | 9:60 | 2 | 9:60, 2:43 |
| صَدَقَةٍ | 9:60 | 2 | 9:60, 9:103 |

## 5. Wrong verse reference

| Word | Lesson cites | Text is in | Example |
|---|---|---|---|
| عَلِيمٌ | 2:29 | 2:231 | وَاللَّهُ بِكُلِّ شَيْءٍ عَلِيمٌ |
| حَكِيمٌ | 2:129 | 3:6 | وَهُوَ الْعَزِيزُ الْحَكِيمُ |
| سَمِيعٌ | 4:134 | 4:58 | إِنَّ اللَّهَ كَانَ سَمِيعًا بَصِيرًا |
| كَانَ | 4:17 | 4:11 | إِنَّ اللَّهَ كَانَ عَلِيمًا حَكِيمًا |
| الْكَبِيرُ | 22:62 | 31:30 | ذَٰلِكَ بِأَنَّ اللَّهَ هُوَ الْحَقُّ وَأَنَّ مَا يَدْعُونَ مِنْ دُونِ |
| الْمُعِيدُ | 85:13 | 10:4 | إِنَّهُ يَبْدَأُ الْخَلْقَ ثُمَّ يُعِيدُهُ |
| ظَنَّ | 10:36 | 6:116 | إِنْ يَتَّبِعُونَ إِلَّا الظَّنَّ وَإِنْ هُمْ إِلَّا يَخْرُصُونَ |
| الْمِيزَانُ | 101:6 | 7:8 | فَمَن ثَقُلَتْ مَوَازِينُهُ |
| ثَقُلَتْ | 101:6 | 7:8 | فَمَن ثَقُلَتْ مَوَازِينُهُ |
| الْحَقِّ | 11:101 | 34:48 | قُلْ إِنَّ رَبِّي يَقْذِفُ بِالْحَقِّ عَلَّامُ الْغُيُوبِ |
| الْخَطِيئَاتِ | 14:10 | 3:147 | رَبَّنَا اغْفِرْ لَنَا ذُنُوبَنَا وَإِسْرَافَنَا فِي أَمْرِنَا وَثَبِّ |
| طَغَىٰ | 26:11 | 20:24 | إِنَّهُ طَغَىٰ |
| الْأَسْحَارِ | 82:18 | 51:18 | وَبِالْأَسْحَارِ هُمْ يَسْتَغْفِرُونَ |
| يَخْسَرُ | 83:29 | 83:34 | فَالْيَوْمَ الَّذِينَ آمَنُوا مِنَ الْكُفَّارِ يَضْحَكُونَ |
| يَسْخَرُونَ | 83:30 | 33:58 | The example is verse 33:58, which does not contain the word |

Four entries have a reference that does not match their verse number, three
of them not a verse reference at all:

- الْكِتَابِ [The Book] ayahR=Al-Baqarah 2:1-2 verseKey=2:2
- الْمُقَدِّمُ [The Advancer] ayahR=Muslim (hadith, Quranic concept) verseKey=54:55
- الْمُؤَخِّرُ [The Delayer] ayahR=Muslim (hadith, Quranic concept) verseKey=54:55
- الصَّبُورُ [The Patient] ayahR=(From the name itself, reflecting the attribute of patience) verseKey=21:89

## 6. "Ibn Kathir explains…" notes

823 of the 1,251 lesson words have a note that names Ibn Kathir; the other
428 name no source. None gives a volume, page or link, and the wording reads
like a summary written for the app. They may be accurate, but as written
they attribute statements to a scholar with nothing to check them against.
Options: have a teacher verify them, replace them with quoted and
referenced passages, or drop the scholar's name and present them as the
app's own notes.

## 7. Look-alike words treated as one word

The app matches words after removing vowel marks. Different words then
collide, and the app counts and links them as one:

| Lesson word | Also counted | How many |
|---|---|---|
| إِنَّ (indeed) | أَن (that) | 638 |
| مِنْ (from) | مَن (who) | 397 |
| إِلَّا (except) | أَلَا (surely) and أَلَّا (that not) | 99 |
| إِنَّا (indeed we) | أَنَا (I) | 49 |
| عَلِمَ (he knew) | عِلْم (knowledge) | 48 |
| لَمْ (not) | لِمَ (why) | 15 |
| أَلِيمٌ (painful) | الْيَمّ (the sea) | 8 |
| الْجَنَّةَ (Paradise) | الْجِنَّة (the jinn) | 5 |

Effects: the "% of the Quran understood" figure is a little too high, and
"Open lesson" in the reader can open the wrong word. The meaning under each
word in the reader is not affected, because it comes from the verse.

These lesson entries collide with each other:

- الْقُرْآنِ → ق-ر-ء / ق-ر-أ
- مِنْ → م-ن-ن / م-ن
- يَدُعُّ → د-ع-ع / و-د-ع
- أَلِيمٌ → أ-ل-م / ي-م-م
- الدِّينِ → Judgment/Religion (al-fatiha) / Judgment/Religion (maun) / Debt (nahl)
- الْجَنَّةَ → Paradise (baqarah) / The Jinn (nas) / The Paradise (yasin)
- مِنْ → From (grammar) / Who/Whoever (grammar)
- عَلِمَ → He Knew (grammar) / He Taught (alaq)
- أَلَمۡ → Did ... not? (grammar) / Alif, Lam, Meem (muqattaat)
- يَدُعُّ → Repels (maun) / He Leaves (ahqaf)
- أَلِيمٌ → Painful (furqan) / The Sea/River (qasas)
- هَوَىٰ → Desire (qasas) / It Fell/Set (najm)
- خَلَقَ → He Created (rahman) / Character (qalam) / He Created (alaq)

## 8. Example verse shows a different word

The example was picked by spelling without vowels, so it shows another word.

| Taught word | Meaning taught | Example verse actually has |
|---|---|---|
| جُنَاحَ | Sin, blame | 17:24 جَنَاحَ = wing |
| ءَاتَيۡنَا | We gave | 74:47 أَتَىٰنَا = came to us |
| بَشَرٞ | Mankind, human | 4:138 بَشِّرِ = give tidings |
| أَيۡمَٰنِهِمۡ | Their oaths | 32:29 إِيمَٰنُهُمۡ = their belief |
| أُوْلِي | Possessors of | 75:34 أَوۡلَىٰ = woe |
| يَفۡتَرُونَ | They invent (lies) | 21:20 يَفۡتُرُونَ = they slacken |
| يُضِلُّ | He leads astray | 20:52 يَضِلُّ = errs |
| وَلَدٞ | Child | 90:3 وَلَدَ = he begot |
| أَمۡرُ | Command, affair | 96:12 أَمَرَ = he enjoins |
| سَوَآءٌ | Equal, alike | 37:55 سَوَآءِ = the midst |

## 9. Made-up roots

Particles and pronouns have no three-letter root, and foreign names have no
Arabic root, but these entries give one:

- مِنْ → م-ن-ن
- فِي → ف-ي-ي
- إِيَّاكَ → أ-ي-ك
- مِنْهَا → م-ن-ه-ا
- أَنْتُمْ → أ-ن-ت-م
- حَتَّىٰ → ح-ت-و
- إِلَى → أ-ل-و
- مَعَ → م-ع-ي
- إِنَّ → أ-ن-ن
- الَّذِينَ → ل-ذ-ي
- مَرْيَمَ → ر-ي-م-م
- عِيسَىٰ → ع-ي-س-ىٰ
- مُوسَىٰ → م-و-س-ىٰ
- يُونُسَ → ي-ن-س ("to be sociable")
- إِلْيَاسِينَ → أ-ل-ي-س

Also, 76 roots are written in a different format (هـ for ه, or two roots
joined with "/"), and the app has 129 different spellings of word type
("Proper Noun" and "Proper noun", for example).

## 10. Stored counts differ from the real count

50 lesson words. For 40 of them the "total" count is lower than
the exact count, which can't be right. The largest:

- عَلَى [Upon/On]: stored 258, real 686
- إِلَى [To/Toward]: stored 165, real 430
- آمَنُوا [They Believed]: stored 0, real 263
- الم [Alif, Lam, Meem]: stored 6, real 84
- شَيْءٍ [Thing]: stored 190, real 267
- آيَاتِ [Signs]: stored 0, real 52
- آيَاتِ [Signs]: stored 0, real 52
- آيَة [Sign/Verse]: stored 2, real 49
- آيَةً [A Sign]: stored 2, real 49
- الْقُرْآنِ [The Quran]: stored 0, real 43
- الْقُرْآنَ [The Quran]: stored 0, real 43
- آلَاءِ [Favors]: stored 0, real 34
- آيَاتِنَا [Our Signs]: stored 0, real 34
- آمَنَ [He Believed]: stored 12, real 39
- مُوسَىٰ [Moses]: stored 91, real 105

## 11. Same word, different meanings

- الرَّحْمَٰنِ → Most Gracious (al-fatiha) / The Most Gracious (zukhruf) / The Most Gracious (rahman)
- الدِّينِ → Judgment/Religion (al-fatiha) / Judgment/Religion (maun) / Debt (nahl)
- الْجَنَّةَ → Paradise (baqarah) / The Jinn (nas) / The Paradise (yasin)
- مِنْ → From (grammar) / Who/Whoever (grammar)
- عَلِمَ → He Knew (grammar) / He Taught (alaq)
- آيَة → Sign/Verse (baqarah) / A Sign (naml)
- أَلَمۡ → Did ... not? (grammar) / Alif, Lam, Meem (muqattaat)
- الصَّمَدُ → Self-Sufficient (ikhlas) / The Self-Sufficient (ikhlas)
- الْمَلِكُ → The King (asma-al-husna) / The King (yusuf) / The Sovereignty (mulk)
- السَّلَامُ → The Source of Peace (asma-al-husna) / Peace (rad) / Peace (ahzab)
- الْعَظِيمُ → The Magnificent (asma-al-husna) / The Great (naba)
- يَدُعُّ → Repels (maun) / He Leaves (ahqaf)
- الْعَزِيزِ → The Mighty/Noble (yusuf) / The Almighty (buruj)
- الذِّكْرَ → The Reminder (hijr) / Remembrance (taha) / The Reminder (anbiya)
- الزَّكَاةِ → The Poor-Due (muminun) / The Purifying Alms (at-tawbah)
- أَلِيمٌ → Painful (furqan) / The Sea/River (qasas)
- هَوَىٰ → Desire (qasas) / It Fell/Set (najm)
- الْأَرْحَامِ → Kinship Ties / The Wombs (ankabut) / Wombs/Kinship Ties (an-nisa)
- حَقَّ → Truly/With Certainty (zumar) / It Became Due (ahqaf)
- مَوَدَّةَ → Affection/Love (jathiyah) / Affection / Love (mumtahanah)
- خَلَقَ → He Created (rahman) / Character (qalam) / He Created (alaq)
- سَبِّحَ → Glorifies (hadid) / Glorify (ala)
- الصَّفِّ → The Rank (saff) / The Row/Rank (al-anfal)

Some of these are the collisions in section 7. The rest are one word
entered in two lessons with different wording.

## 12. Surah number differs from the verse reference

- رَسُول [Messenger] surahId=2 verseKey=5:99
- الْقُرْآنِ [The Quran] surahId=2 verseKey=17:9
- نَبِيٍّ [Prophet] surahId=2 verseKey=33:45
- النَّهْرِ [The River] surahId=12 verseKey=2:249
- الزَّبُورِ [The Psalms] surahId=15 verseKey=21:105
- مِنْهَا [From It/Her] surahId=15 verseKey=2:35
- لَأَنْعَامِ [Livestock/Cattle] surahId=15 verseKey=16:5
- الْكَلِمَاتِ [The Words] surahId=20 verseKey=18:109
- الشِّرْكَ [Associating Partners with Allah / Polytheism] surahId=20 verseKey=31:13
- الزَّبُرِ [The Scriptures] surahId=41 verseKey=3:184
- يُرْسِلُ [He Sends] surahId=42 verseKey=7:57
- نُزُلًا [A Reception/Hospitality] surahId=43 verseKey=18:107
- ثَبِّتْ [Make Firm!] surahId=8 verseKey=2:250

## 13. Verse 2:72

The word فَٱدَّٰرَٰٔتُمۡ is stored with a thin space (U+2009) in the middle,
so the reader draws it as two words: فَٱدَّـٰرَ and ٰٔتُمۡ. The letters are
right; only the space is wrong.

## Suggested order of work

1. Sections 1, 2, 4 and 5: replace every example with the exact text of one
   verse taken from the app's own Quran text, and remove or correct the
   words that are not in the Quran.
2. Add a build check so this can't come back: each example must be found in
   its cited verse, and each taught word must be in that verse.
3. Section 6: decide what to do with the Ibn Kathir notes.
4. Sections 7 and 8: match lesson words with their vowel marks.
5. Sections 9–13.
