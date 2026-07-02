// ═══════════════════════════════════════════════════════════════
// surahs.js — Surah Metadata for All 114 Surahs
//
// Provides canonical names, verse counts, revelation types,
// and Juz' ranges for the entire Quran.
//
// This file must be loaded BEFORE the word data files so that
// word entries can reference surahId.
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SurahInfo
 * @property {number} id - Surah number (1-114)
 * @property {string} name - Arabic name with definite article
 * @property {string} nameSimple - Simple transliteration name
 * @property {string} english - English name / translation
 * @property {number} verses - Number of verses (ayahs)
 * @property {string} revelation - 'Meccan' | 'Medinan' | 'Mixed'
 * @property {string} juz - Juz' range (e.g. "1" or "25-26")
 * @property {string} meaning - Short meaning of the Surah name
 */

/** @type {Object<number, SurahInfo>} */
const SURAH_INFO = {
  1:  { id: 1,  name: 'الفاتحة',           nameSimple: 'Al-Fatiha',          english: 'The Opening',              verses: 7,   revelation: 'Meccan',  juz: '1',      meaning: 'The Opening' },
  2:  { id: 2,  name: 'البقرة',            nameSimple: 'Al-Baqarah',         english: 'The Cow',                  verses: 286, revelation: 'Medinan', juz: '1-3',    meaning: 'The Cow' },
  3:  { id: 3,  name: 'آل عمران',          nameSimple: 'Aal-e-Imran',        english: 'Family of Imran',          verses: 200, revelation: 'Medinan', juz: '3-4',    meaning: 'Family of Imran' },
  4:  { id: 4,  name: 'النساء',            nameSimple: 'An-Nisa',            english: 'The Women',                verses: 176, revelation: 'Medinan', juz: '4-6',    meaning: 'The Women' },
  5:  { id: 5,  name: 'المائدة',           nameSimple: "Al-Ma'idah",         english: 'The Table Spread',         verses: 120, revelation: 'Medinan', juz: '6-7',    meaning: 'The Table Spread' },
  6:  { id: 6,  name: "الأنعام",           nameSimple: "Al-An'am",           english: 'The Cattle',               verses: 165, revelation: 'Meccan',  juz: '7-8',    meaning: 'The Cattle' },
  7:  { id: 7,  name: 'الأعراف',           nameSimple: "Al-A'raf",           english: 'The Heights',              verses: 206, revelation: 'Meccan',  juz: '8-9',    meaning: 'The Heights' },
  8:  { id: 8,  name: 'الأنفال',           nameSimple: 'Al-Anfal',           english: 'The Spoils of War',        verses: 75,  revelation: 'Medinan', juz: '9-10',   meaning: 'The Spoils of War' },
  9:  { id: 9,  name: 'التوبة',            nameSimple: 'At-Tawbah',          english: 'The Repentance',           verses: 129, revelation: 'Medinan', juz: '10-11',  meaning: 'The Repentance' },
  10: { id: 10, name: 'يونس',              nameSimple: 'Yunus',              english: 'Jonah',                    verses: 109, revelation: 'Meccan',  juz: '11',     meaning: 'Jonah' },
  11: { id: 11, name: 'هود',               nameSimple: 'Hud',                english: 'Hud',                      verses: 123, revelation: 'Meccan',  juz: '11-12',  meaning: 'Hud' },
  12: { id: 12, name: 'يوسف',              nameSimple: 'Yusuf',              english: 'Joseph',                   verses: 111, revelation: 'Meccan',  juz: '12-13',  meaning: 'Joseph' },
  13: { id: 13, name: 'الرعد',             nameSimple: "Ar-Ra'd",            english: 'The Thunder',              verses: 43,  revelation: 'Medinan', juz: '13',     meaning: 'The Thunder' },
  14: { id: 14, name: 'إبراهيم',           nameSimple: 'Ibrahim',            english: 'Abraham',                  verses: 52,  revelation: 'Meccan',  juz: '13',     meaning: 'Abraham' },
  15: { id: 15, name: 'الحجر',             nameSimple: 'Al-Hijr',            english: 'The Rocky Tract',          verses: 99,  revelation: 'Meccan',  juz: '14',     meaning: 'The Rocky Tract' },
  16: { id: 16, name: 'النحل',             nameSimple: 'An-Nahl',            english: 'The Bee',                  verses: 128, revelation: 'Meccan',  juz: '14',     meaning: 'The Bee' },
  17: { id: 17, name: 'الإسراء',           nameSimple: "Al-Isra'",           english: 'The Night Journey',        verses: 111, revelation: 'Meccan',  juz: '15',     meaning: 'The Night Journey' },
  18: { id: 18, name: 'الكهف',             nameSimple: 'Al-Kahf',            english: 'The Cave',                 verses: 110, revelation: 'Meccan',  juz: '15-16',  meaning: 'The Cave' },
  19: { id: 19, name: 'مريم',              nameSimple: 'Maryam',             english: 'Mary',                     verses: 98,  revelation: 'Meccan',  juz: '16',     meaning: 'Mary' },
  20: { id: 20, name: 'طه',                nameSimple: 'Ta-Ha',              english: 'Ta-Ha',                    verses: 135, revelation: 'Meccan',  juz: '16',     meaning: 'Ta-Ha' },
  21: { id: 21, name: 'الأنبياء',          nameSimple: "Al-Anbiya'",         english: 'The Prophets',             verses: 112, revelation: 'Meccan',  juz: '17',     meaning: 'The Prophets' },
  22: { id: 22, name: 'الحج',              nameSimple: 'Al-Hajj',            english: 'The Pilgrimage',           verses: 78,  revelation: 'Medinan', juz: '17',     meaning: 'The Pilgrimage' },
  23: { id: 23, name: 'المؤمنون',          nameSimple: "Al-Mu'minun",        english: 'The Believers',            verses: 118, revelation: 'Meccan',  juz: '18',     meaning: 'The Believers' },
  24: { id: 24, name: 'النور',             nameSimple: 'An-Nur',             english: 'The Light',                verses: 64,  revelation: 'Medinan', juz: '18',     meaning: 'The Light' },
  25: { id: 25, name: 'الفرقان',           nameSimple: 'Al-Furqan',          english: 'The Criterion',            verses: 77,  revelation: 'Meccan',  juz: '18-19',  meaning: 'The Criterion' },
  26: { id: 26, name: 'الشعراء',           nameSimple: "Ash-Shu'ara",        english: 'The Poets',                verses: 227, revelation: 'Meccan',  juz: '19',     meaning: 'The Poets' },
  27: { id: 27, name: 'النمل',             nameSimple: 'An-Naml',            english: 'The Ant',                  verses: 93,  revelation: 'Meccan',  juz: '19-20',  meaning: 'The Ant' },
  28: { id: 28, name: 'القصص',             nameSimple: 'Al-Qasas',           english: 'The Stories',              verses: 88,  revelation: 'Meccan',  juz: '20',     meaning: 'The Stories' },
  29: { id: 29, name: 'العنكبوت',          nameSimple: 'Al-Ankabut',         english: 'The Spider',               verses: 69,  revelation: 'Meccan',  juz: '20-21',  meaning: 'The Spider' },
  30: { id: 30, name: 'الروم',             nameSimple: 'Ar-Rum',             english: 'The Romans',               verses: 60,  revelation: 'Meccan',  juz: '21',     meaning: 'The Romans' },
  31: { id: 31, name: 'لقمان',             nameSimple: 'Luqman',             english: 'Luqman',                   verses: 34,  revelation: 'Meccan',  juz: '21',     meaning: 'Luqman' },
  32: { id: 32, name: 'السجدة',            nameSimple: 'As-Sajdah',          english: 'The Prostration',          verses: 30,  revelation: 'Meccan',  juz: '21',     meaning: 'The Prostration' },
  33: { id: 33, name: 'الأحزاب',           nameSimple: 'Al-Ahzab',           english: 'The Confederates',         verses: 73,  revelation: 'Medinan', juz: '21-22',  meaning: 'The Confederates' },
  34: { id: 34, name: 'سبأ',               nameSimple: "Saba'",              english: 'Sheba',                    verses: 54,  revelation: 'Meccan',  juz: '22',     meaning: 'Sheba' },
  35: { id: 35, name: 'فاطر',              nameSimple: 'Fatir',              english: 'The Originator',           verses: 45,  revelation: 'Meccan',  juz: '22',     meaning: 'The Originator' },
  36: { id: 36, name: 'يس',                nameSimple: 'Ya-Sin',             english: 'Ya-Sin',                   verses: 83,  revelation: 'Meccan',  juz: '22-23',  meaning: 'Ya-Sin' },
  37: { id: 37, name: 'الصافات',           nameSimple: 'As-Saffat',          english: 'Those Who Set the Ranks',  verses: 182, revelation: 'Meccan',  juz: '23',     meaning: 'Those Who Set the Ranks' },
  38: { id: 38, name: 'ص',                 nameSimple: 'Sad',                english: 'Sad',                      verses: 88,  revelation: 'Meccan',  juz: '23',     meaning: 'Sad' },
  39: { id: 39, name: 'الزمر',             nameSimple: 'Az-Zumar',           english: 'The Groups',               verses: 75,  revelation: 'Meccan',  juz: '23-24',  meaning: 'The Groups' },
  40: { id: 40, name: 'غافر',              nameSimple: 'Ghafir',             english: 'The Forgiver',             verses: 85,  revelation: 'Meccan',  juz: '24',     meaning: 'The Forgiver' },
  41: { id: 41, name: 'فصلت',              nameSimple: 'Fussilat',           english: 'Explained in Detail',      verses: 54,  revelation: 'Meccan',  juz: '24',     meaning: 'Explained in Detail' },
  42: { id: 42, name: 'الشورى',            nameSimple: 'Ash-Shura',          english: 'The Consultation',         verses: 53,  revelation: 'Meccan',  juz: '25',     meaning: 'The Consultation' },
  43: { id: 43, name: 'الزخرف',            nameSimple: 'Az-Zukhruf',         english: 'The Gold Adornments',      verses: 89,  revelation: 'Meccan',  juz: '25',     meaning: 'The Gold Adornments' },
  44: { id: 44, name: 'الدخان',            nameSimple: 'Ad-Dukhan',          english: 'The Smoke',                verses: 59,  revelation: 'Meccan',  juz: '25',     meaning: 'The Smoke' },
  45: { id: 45, name: 'الجاثية',           nameSimple: 'Al-Jathiyah',        english: 'The Kneeling',             verses: 37,  revelation: 'Meccan',  juz: '25',     meaning: 'The Kneeling' },
  46: { id: 46, name: 'الأحقاف',           nameSimple: 'Al-Ahqaf',           english: 'The Wind-Curved Sandhills', verses: 35, revelation: 'Meccan',  juz: '26',     meaning: 'The Wind-Curved Sandhills' },
  47: { id: 47, name: 'محمد',              nameSimple: 'Muhammad',           english: 'Muhammad',                 verses: 38,  revelation: 'Medinan', juz: '26',     meaning: 'Muhammad' },
  48: { id: 48, name: 'الفتح',             nameSimple: 'Al-Fath',            english: 'The Victory',              verses: 29,  revelation: 'Medinan', juz: '26',     meaning: 'The Victory' },
  49: { id: 49, name: 'الحجرات',           nameSimple: 'Al-Hujurat',         english: 'The Dwellings',            verses: 18,  revelation: 'Medinan', juz: '26',     meaning: 'The Dwellings' },
  50: { id: 50, name: 'ق',                 nameSimple: 'Qaf',                english: 'Qaf',                      verses: 45,  revelation: 'Meccan',  juz: '26',     meaning: 'Qaf' },
  51: { id: 51, name: 'الذاريات',          nameSimple: 'Adh-Dhariyat',       english: 'The Winnowing Winds',      verses: 60,  revelation: 'Meccan',  juz: '26-27',  meaning: 'The Winnowing Winds' },
  52: { id: 52, name: 'الطور',             nameSimple: 'At-Tur',             english: 'The Mount',                verses: 49,  revelation: 'Meccan',  juz: '27',     meaning: 'The Mount' },
  53: { id: 53, name: 'النجم',             nameSimple: 'An-Najm',            english: 'The Star',                 verses: 62,  revelation: 'Meccan',  juz: '27',     meaning: 'The Star' },
  54: { id: 54, name: 'القمر',             nameSimple: 'Al-Qamar',           english: 'The Moon',                 verses: 55,  revelation: 'Meccan',  juz: '27',     meaning: 'The Moon' },
  55: { id: 55, name: 'الرحمن',            nameSimple: 'Ar-Rahman',          english: 'The Most Gracious',        verses: 78,  revelation: 'Medinan', juz: '27',     meaning: 'The Most Gracious' },
  56: { id: 56, name: 'الواقعة',           nameSimple: "Al-Waqi'ah",         english: 'The Inevitable Event',     verses: 96,  revelation: 'Meccan',  juz: '27',     meaning: 'The Inevitable Event' },
  57: { id: 57, name: 'الحديد',            nameSimple: 'Al-Hadid',           english: 'The Iron',                 verses: 29,  revelation: 'Medinan', juz: '27',     meaning: 'The Iron' },
  58: { id: 58, name: 'المجادلة',          nameSimple: 'Al-Mujadilah',       english: 'The Pleading Woman',       verses: 22,  revelation: 'Medinan', juz: '28',     meaning: 'The Pleading Woman' },
  59: { id: 59, name: 'الحشر',             nameSimple: 'Al-Hashr',           english: 'The Gathering',            verses: 24,  revelation: 'Medinan', juz: '28',     meaning: 'The Gathering' },
  60: { id: 60, name: 'الممتحنة',          nameSimple: 'Al-Mumtahanah',      english: 'The Examined Woman',       verses: 13,  revelation: 'Medinan', juz: '28',     meaning: 'The Examined Woman' },
  61: { id: 61, name: 'الصف',              nameSimple: 'As-Saff',            english: 'The Ranks',                verses: 14,  revelation: 'Medinan', juz: '28',     meaning: 'The Ranks' },
  62: { id: 62, name: 'الجمعة',            nameSimple: "Al-Jumu'ah",         english: 'The Congregation Prayer',  verses: 11,  revelation: 'Medinan', juz: '28',     meaning: 'The Friday Prayer' },
  63: { id: 63, name: 'المنافقون',         nameSimple: 'Al-Munafiqun',       english: 'The Hypocrites',           verses: 11,  revelation: 'Medinan', juz: '28',     meaning: 'The Hypocrites' },
  64: { id: 64, name: 'التغابن',           nameSimple: 'At-Taghabun',        english: 'The Loss and Gain',        verses: 18,  revelation: 'Medinan', juz: '28',     meaning: 'The Mutual Disillusion' },
  65: { id: 65, name: 'الطلاق',            nameSimple: 'At-Talaq',           english: 'The Divorce',              verses: 12,  revelation: 'Medinan', juz: '28',     meaning: 'The Divorce' },
  66: { id: 66, name: 'التحريم',           nameSimple: 'At-Tahrim',          english: 'The Prohibition',          verses: 12,  revelation: 'Medinan', juz: '28',     meaning: 'The Prohibition' },
  67: { id: 67, name: 'الملك',             nameSimple: 'Al-Mulk',            english: 'The Sovereignty',          verses: 30,  revelation: 'Meccan',  juz: '29',     meaning: 'The Sovereignty' },
  68: { id: 68, name: 'القلم',             nameSimple: 'Al-Qalam',           english: 'The Pen',                  verses: 52,  revelation: 'Meccan',  juz: '29',     meaning: 'The Pen' },
  69: { id: 69, name: 'الحاقة',            nameSimple: "Al-Haqqah",          english: 'The Reality',              verses: 52,  revelation: 'Meccan',  juz: '29',     meaning: 'The Reality' },
  70: { id: 70, name: 'المعارج',           nameSimple: "Al-Ma'arij",         english: 'The Ascending Stairways',  verses: 44,  revelation: 'Meccan',  juz: '29',     meaning: 'The Ascending Stairways' },
  71: { id: 71, name: 'نوح',               nameSimple: 'Nuh',                english: 'Noah',                     verses: 28,  revelation: 'Meccan',  juz: '29',     meaning: 'Noah' },
  72: { id: 72, name: 'الجن',              nameSimple: 'Al-Jinn',            english: 'The Jinn',                 verses: 28,  revelation: 'Meccan',  juz: '29',     meaning: 'The Jinn' },
  73: { id: 73, name: 'المزمل',            nameSimple: 'Al-Muzzammil',       english: 'The Enwrapped One',        verses: 20,  revelation: 'Meccan',  juz: '29',     meaning: 'The Enwrapped One' },
  74: { id: 74, name: 'المدثر',            nameSimple: 'Al-Muddaththir',     english: 'The Cloaked One',          verses: 56,  revelation: 'Meccan',  juz: '29',     meaning: 'The Cloaked One' },
  75: { id: 75, name: 'القيامة',           nameSimple: 'Al-Qiyamah',         english: 'The Resurrection',         verses: 40,  revelation: 'Meccan',  juz: '29',     meaning: 'The Resurrection' },
  76: { id: 76, name: 'الإنسان',           nameSimple: "Al-Insan",           english: 'The Human Being',          verses: 31,  revelation: 'Medinan', juz: '29',     meaning: 'The Human Being' },
  77: { id: 77, name: 'المرسلات',          nameSimple: 'Al-Mursalat',        english: 'Those Sent Forth',         verses: 50,  revelation: 'Meccan',  juz: '29',     meaning: 'Those Sent Forth' },
  78: { id: 78, name: 'النبأ',             nameSimple: "An-Naba'",           english: 'The Great News',           verses: 40,  revelation: 'Meccan',  juz: '30',     meaning: 'The Great News' },
  79: { id: 79, name: 'النازعات',          nameSimple: 'An-Nazi\'at',        english: 'Those Who Pull Out',       verses: 46,  revelation: 'Meccan',  juz: '30',     meaning: 'Those Who Pull Out' },
  80: { id: 80, name: 'عبس',               nameSimple: "'Abasa",              english: 'He Frowned',               verses: 42,  revelation: 'Meccan',  juz: '30',     meaning: 'He Frowned' },
  81: { id: 81, name: 'التكوير',           nameSimple: 'At-Takwir',          english: 'The Overthrowing',         verses: 29,  revelation: 'Meccan',  juz: '30',     meaning: 'The Overthrowing' },
  82: { id: 82, name: 'الانفطار',          nameSimple: 'Al-Infitar',         english: 'The Splitting',            verses: 19,  revelation: 'Meccan',  juz: '30',     meaning: 'The Splitting' },
  83: { id: 83, name: 'المطففين',          nameSimple: 'Al-Mutaffifin',      english: 'The Defrauders',           verses: 36,  revelation: 'Meccan',  juz: '30',     meaning: 'The Defrauders' },
  84: { id: 84, name: 'الانشقاق',          nameSimple: 'Al-Inshiqaq',        english: 'The Splitting Open',       verses: 25,  revelation: 'Meccan',  juz: '30',     meaning: 'The Splitting Open' },
  85: { id: 85, name: 'البروج',            nameSimple: 'Al-Buruj',           english: 'The Great Constellations', verses: 22,  revelation: 'Meccan',  juz: '30',     meaning: 'The Constellations' },
  86: { id: 86, name: 'الطارق',            nameSimple: 'At-Tariq',           english: 'The Nightcomer',           verses: 17,  revelation: 'Meccan',  juz: '30',     meaning: 'The Nightcomer' },
  87: { id: 87, name: 'الأعلى',            nameSimple: "Al-A'la",            english: 'The Most High',            verses: 19,  revelation: 'Meccan',  juz: '30',     meaning: 'The Most High' },
  88: { id: 88, name: 'الغاشية',           nameSimple: 'Al-Ghashiyah',       english: 'The Overwhelming Event',    verses: 26,  revelation: 'Meccan',  juz: '30',     meaning: 'The Overwhelming Event' },
  89: { id: 89, name: 'الفجر',             nameSimple: 'Al-Fajr',            english: 'The Dawn',                 verses: 30,  revelation: 'Meccan',  juz: '30',     meaning: 'The Dawn' },
  90: { id: 90, name: 'البلد',             nameSimple: 'Al-Balad',           english: 'The City',                 verses: 20,  revelation: 'Meccan',  juz: '30',     meaning: 'The City' },
  91: { id: 91, name: 'الشمس',             nameSimple: 'Ash-Shams',          english: 'The Sun',                  verses: 15,  revelation: 'Meccan',  juz: '30',     meaning: 'The Sun' },
  92: { id: 92, name: 'الليل',             nameSimple: 'Al-Layl',            english: 'The Night',                verses: 21,  revelation: 'Meccan',  juz: '30',     meaning: 'The Night' },
  93: { id: 93, name: 'الضحى',             nameSimple: 'Ad-Duha',            english: 'The Morning Brightness',   verses: 11,  revelation: 'Meccan',  juz: '30',     meaning: 'The Morning Hours' },
  94: { id: 94, name: 'الشرح',             nameSimple: 'Ash-Sharh',          english: 'The Relief',               verses: 8,   revelation: 'Meccan',  juz: '30',     meaning: 'The Opening of the Heart' },
  95: { id: 95, name: 'التين',             nameSimple: 'At-Tin',             english: 'The Fig',                  verses: 8,   revelation: 'Meccan',  juz: '30',     meaning: 'The Fig' },
  96: { id: 96, name: 'العلق',             nameSimple: 'Al-Alaq',            english: 'The Clot',                 verses: 19,  revelation: 'Meccan',  juz: '30',     meaning: 'The Clinging Clot' },
  97: { id: 97, name: 'القدر',             nameSimple: 'Al-Qadr',            english: 'The Power',                verses: 5,   revelation: 'Meccan',  juz: '30',     meaning: 'The Decree' },
  98: { id: 98, name: 'البينة',            nameSimple: 'Al-Bayyinah',        english: 'The Clear Proof',          verses: 8,   revelation: 'Medinan', juz: '30',     meaning: 'The Clear Evidence' },
  99: { id: 99, name: 'الزلزلة',           nameSimple: 'Az-Zalzalah',        english: 'The Earthquake',           verses: 8,   revelation: 'Medinan', juz: '30',     meaning: 'The Earthquake' },
  100: { id: 100, name: 'العاديات',        nameSimple: "Al-'Adiyat",         english: 'The Courser',              verses: 11,  revelation: 'Meccan',  juz: '30',     meaning: 'The Charging Steeds' },
  101: { id: 101, name: 'القارعة',         nameSimple: "Al-Qari'ah",         english: 'The Calamity',             verses: 11,  revelation: 'Meccan',  juz: '30',     meaning: 'The Striking Calamity' },
  102: { id: 102, name: 'التكاثر',         nameSimple: 'At-Takathur',        english: 'The Rivalry',              verses: 8,   revelation: 'Meccan',  juz: '30',     meaning: 'Worldly Competition' },
  103: { id: 103, name: 'العصر',           nameSimple: "Al-'Asr",            english: 'The Time',                 verses: 3,   revelation: 'Meccan',  juz: '30',     meaning: 'The Declining Day' },
  104: { id: 104, name: 'الهمزة',          nameSimple: 'Al-Humazah',         english: 'The Slanderer',            verses: 9,   revelation: 'Meccan',  juz: '30',     meaning: 'The Backbiter' },
  105: { id: 105, name: 'الفيل',           nameSimple: 'Al-Fil',             english: 'The Elephant',             verses: 5,   revelation: 'Meccan',  juz: '30',     meaning: 'The Elephant' },
  106: { id: 106, name: 'قريش',            nameSimple: 'Quraysh',            english: 'Quraysh',                  verses: 4,   revelation: 'Meccan',  juz: '30',     meaning: 'Quraysh' },
  107: { id: 107, name: 'الماعون',         nameSimple: "Al-Ma'un",           english: 'The Small Kindness',       verses: 7,   revelation: 'Meccan',  juz: '30',     meaning: 'The Small Charity' },
  108: { id: 108, name: 'الكوثر',          nameSimple: 'Al-Kawthar',         english: 'The Abundance',            verses: 3,   revelation: 'Meccan',  juz: '30',     meaning: 'The River of Paradise' },
  109: { id: 109, name: 'الكافرون',        nameSimple: 'Al-Kafirun',         english: 'The Disbelievers',         verses: 6,   revelation: 'Meccan',  juz: '30',     meaning: 'The Disbelievers' },
  110: { id: 110, name: 'النصر',           nameSimple: 'An-Nasr',            english: 'The Help',                 verses: 3,   revelation: 'Medinan', juz: '30',     meaning: 'The Divine Support' },
  111: { id: 111, name: 'المسد',           nameSimple: 'Al-Masad',           english: 'The Palm Fibre',           verses: 5,   revelation: 'Meccan',  juz: '30',     meaning: 'The Twisted Strands' },
  112: { id: 112, name: 'الإخلاص',         nameSimple: 'Al-Ikhlas',          english: 'The Sincerity',            verses: 4,   revelation: 'Meccan',  juz: '30',     meaning: 'Absolute Purity' },
  113: { id: 113, name: 'الفلق',           nameSimple: 'Al-Falaq',           english: 'The Daybreak',             verses: 5,   revelation: 'Meccan',  juz: '30',     meaning: 'The Dawn' },
  114: { id: 114, name: 'الناس',           nameSimple: 'An-Nas',             english: 'The Mankind',              verses: 6,   revelation: 'Meccan',  juz: '30',     meaning: 'Humankind' },
};

/** Get Surah info by ID. Returns SurahInfo or null. */
function getSurahInfo(surahId) {
  return SURAH_INFO[surahId] || null;
}

/** Get the Arabic name of a Surah. */
function getSurahName(surahId) {
  var info = SURAH_INFO[surahId];
  return info ? info.name : 'Unknown';
}

/** Get the English name of a Surah. */
function getSurahEnglishName(surahId) {
  var info = SURAH_INFO[surahId];
  return info ? info.english : 'Unknown';
}

/** Get the simple transliterated name of a Surah. */
function getSurahNameSimple(surahId) {
  var info = SURAH_INFO[surahId];
  return info ? info.nameSimple : 'Unknown';
}

/** Get the number of verses in a Surah. */
function getSurahVerseCount(surahId) {
  var info = SURAH_INFO[surahId];
  return info ? info.verses : 0;
}

/** Get all Surah IDs in order. */
function getAllSurahIds() {
  return Object.keys(SURAH_INFO).map(Number).sort(function(a, b) { return a - b; });
}

// getSurahsWithVocabulary is defined in data.js (the authoritative version).
// It checks both ALL_WORDS and CANONICAL_WORDS for surahIds.
// That single definition is used throughout the app.
// Do NOT redefine this function here — the data.js version is the source of truth.
