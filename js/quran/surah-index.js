// ═══════════════════════════════════════════════════════════════
// surah-index.js — Lightweight Quran Surah Metadata
// Loaded FIRST when entering the Read section. Contains only
// surah names and verse counts — no verse text (~9 KB).
// Individual surah verse data is loaded on demand.
// ═══════════════════════════════════════════════════════════════

var QURAN_INDEX = [
  {
    "id": 1,
    "name": "الفاتحة",
    "transliteration": "Al-Fatihah",
    "englishName": "The Opener",
    "type": "meccan",
    "total_verses": 7
  },
  {
    "id": 2,
    "name": "البقرة",
    "transliteration": "Al-Baqarah",
    "englishName": "The Cow",
    "type": "medinan",
    "total_verses": 286
  },
  {
    "id": 3,
    "name": "آل عمران",
    "transliteration": "Ali 'Imran",
    "englishName": "Family of Imran",
    "type": "medinan",
    "total_verses": 200
  },
  {
    "id": 4,
    "name": "النساء",
    "transliteration": "An-Nisa",
    "englishName": "The Women",
    "type": "medinan",
    "total_verses": 176
  },
  {
    "id": 5,
    "name": "المائدة",
    "transliteration": "Al-Ma'idah",
    "englishName": "The Table Spread",
    "type": "medinan",
    "total_verses": 120
  },
  {
    "id": 6,
    "name": "الأنعام",
    "transliteration": "Al-An'am",
    "englishName": "The Cattle",
    "type": "meccan",
    "total_verses": 165
  },
  {
    "id": 7,
    "name": "الأعراف",
    "transliteration": "Al-A'raf",
    "englishName": "The Heights",
    "type": "meccan",
    "total_verses": 206
  },
  {
    "id": 8,
    "name": "الأنفال",
    "transliteration": "Al-Anfal",
    "englishName": "The Spoils of War",
    "type": "medinan",
    "total_verses": 75
  },
  {
    "id": 9,
    "name": "التوبة",
    "transliteration": "At-Tawbah",
    "englishName": "The Repentance",
    "type": "medinan",
    "total_verses": 129
  },
  {
    "id": 10,
    "name": "يونس",
    "transliteration": "Yunus",
    "englishName": "Jonah",
    "type": "meccan",
    "total_verses": 109
  },
  {
    "id": 11,
    "name": "هود",
    "transliteration": "Hud",
    "englishName": "Hud",
    "type": "meccan",
    "total_verses": 123
  },
  {
    "id": 12,
    "name": "يوسف",
    "transliteration": "Yusuf",
    "englishName": "Joseph",
    "type": "meccan",
    "total_verses": 111
  },
  {
    "id": 13,
    "name": "الرعد",
    "transliteration": "Ar-Ra'd",
    "englishName": "The Thunder",
    "type": "medinan",
    "total_verses": 43
  },
  {
    "id": 14,
    "name": "ابراهيم",
    "transliteration": "Ibrahim",
    "englishName": "Abraham",
    "type": "meccan",
    "total_verses": 52
  },
  {
    "id": 15,
    "name": "الحجر",
    "transliteration": "Al-Hijr",
    "englishName": "The Rocky Tract",
    "type": "meccan",
    "total_verses": 99
  },
  {
    "id": 16,
    "name": "النحل",
    "transliteration": "An-Nahl",
    "englishName": "The Bee",
    "type": "meccan",
    "total_verses": 128
  },
  {
    "id": 17,
    "name": "الإسراء",
    "transliteration": "Al-Isra",
    "englishName": "The Night Journey",
    "type": "meccan",
    "total_verses": 111
  },
  {
    "id": 18,
    "name": "الكهف",
    "transliteration": "Al-Kahf",
    "englishName": "The Cave",
    "type": "meccan",
    "total_verses": 110
  },
  {
    "id": 19,
    "name": "مريم",
    "transliteration": "Maryam",
    "englishName": "Mary",
    "type": "meccan",
    "total_verses": 98
  },
  {
    "id": 20,
    "name": "طه",
    "transliteration": "Taha",
    "englishName": "Ta-Ha",
    "type": "meccan",
    "total_verses": 135
  },
  {
    "id": 21,
    "name": "الأنبياء",
    "transliteration": "Al-Anbya",
    "englishName": "The Prophets",
    "type": "meccan",
    "total_verses": 112
  },
  {
    "id": 22,
    "name": "الحج",
    "transliteration": "Al-Hajj",
    "englishName": "The Pilgrimage",
    "type": "medinan",
    "total_verses": 78
  },
  {
    "id": 23,
    "name": "المؤمنون",
    "transliteration": "Al-Mu'minun",
    "englishName": "The Believers",
    "type": "meccan",
    "total_verses": 118
  },
  {
    "id": 24,
    "name": "النور",
    "transliteration": "An-Nur",
    "englishName": "The Light",
    "type": "medinan",
    "total_verses": 64
  },
  {
    "id": 25,
    "name": "الفرقان",
    "transliteration": "Al-Furqan",
    "englishName": "The Criterion",
    "type": "meccan",
    "total_verses": 77
  },
  {
    "id": 26,
    "name": "الشعراء",
    "transliteration": "Ash-Shu'ara",
    "englishName": "The Poets",
    "type": "meccan",
    "total_verses": 227
  },
  {
    "id": 27,
    "name": "النمل",
    "transliteration": "An-Naml",
    "englishName": "The Ant",
    "type": "meccan",
    "total_verses": 93
  },
  {
    "id": 28,
    "name": "القصص",
    "transliteration": "Al-Qasas",
    "englishName": "The Stories",
    "type": "meccan",
    "total_verses": 88
  },
  {
    "id": 29,
    "name": "العنكبوت",
    "transliteration": "Al-'Ankabut",
    "englishName": "The Spider",
    "type": "meccan",
    "total_verses": 69
  },
  {
    "id": 30,
    "name": "الروم",
    "transliteration": "Ar-Rum",
    "englishName": "The Romans",
    "type": "meccan",
    "total_verses": 60
  },
  {
    "id": 31,
    "name": "لقمان",
    "transliteration": "Luqman",
    "englishName": "Luqman",
    "type": "meccan",
    "total_verses": 34
  },
  {
    "id": 32,
    "name": "السجدة",
    "transliteration": "As-Sajdah",
    "englishName": "The Prostration",
    "type": "meccan",
    "total_verses": 30
  },
  {
    "id": 33,
    "name": "الأحزاب",
    "transliteration": "Al-Ahzab",
    "englishName": "The Combined Forces",
    "type": "medinan",
    "total_verses": 73
  },
  {
    "id": 34,
    "name": "سبإ",
    "transliteration": "Saba",
    "englishName": "Sheba",
    "type": "meccan",
    "total_verses": 54
  },
  {
    "id": 35,
    "name": "فاطر",
    "transliteration": "Fatir",
    "englishName": "Originator",
    "type": "meccan",
    "total_verses": 45
  },
  {
    "id": 36,
    "name": "يس",
    "transliteration": "Ya-Sin",
    "englishName": "Ya Sin",
    "type": "meccan",
    "total_verses": 83
  },
  {
    "id": 37,
    "name": "الصافات",
    "transliteration": "As-Saffat",
    "englishName": "Those who set the Ranks",
    "type": "meccan",
    "total_verses": 182
  },
  {
    "id": 38,
    "name": "ص",
    "transliteration": "Sad",
    "englishName": "The Letter \"Saad\"",
    "type": "meccan",
    "total_verses": 88
  },
  {
    "id": 39,
    "name": "الزمر",
    "transliteration": "Az-Zumar",
    "englishName": "The Troops",
    "type": "meccan",
    "total_verses": 75
  },
  {
    "id": 40,
    "name": "غافر",
    "transliteration": "Ghafir",
    "englishName": "The Forgiver",
    "type": "meccan",
    "total_verses": 85
  },
  {
    "id": 41,
    "name": "فصلت",
    "transliteration": "Fussilat",
    "englishName": "Explained in Detail",
    "type": "meccan",
    "total_verses": 54
  },
  {
    "id": 42,
    "name": "الشورى",
    "transliteration": "Ash-Shuraa",
    "englishName": "The Consultation",
    "type": "meccan",
    "total_verses": 53
  },
  {
    "id": 43,
    "name": "الزخرف",
    "transliteration": "Az-Zukhruf",
    "englishName": "The Ornaments of Gold",
    "type": "meccan",
    "total_verses": 89
  },
  {
    "id": 44,
    "name": "الدخان",
    "transliteration": "Ad-Dukhan",
    "englishName": "The Smoke",
    "type": "meccan",
    "total_verses": 59
  },
  {
    "id": 45,
    "name": "الجاثية",
    "transliteration": "Al-Jathiyah",
    "englishName": "The Crouching",
    "type": "meccan",
    "total_verses": 37
  },
  {
    "id": 46,
    "name": "الأحقاف",
    "transliteration": "Al-Ahqaf",
    "englishName": "The Wind-Curved Sandhills",
    "type": "meccan",
    "total_verses": 35
  },
  {
    "id": 47,
    "name": "محمد",
    "transliteration": "Muhammad",
    "englishName": "Muhammad",
    "type": "medinan",
    "total_verses": 38
  },
  {
    "id": 48,
    "name": "الفتح",
    "transliteration": "Al-Fath",
    "englishName": "The Victory",
    "type": "medinan",
    "total_verses": 29
  },
  {
    "id": 49,
    "name": "الحجرات",
    "transliteration": "Al-Hujurat",
    "englishName": "The Rooms",
    "type": "medinan",
    "total_verses": 18
  },
  {
    "id": 50,
    "name": "ق",
    "transliteration": "Qaf",
    "englishName": "The Letter \"Qaf\"",
    "type": "meccan",
    "total_verses": 45
  },
  {
    "id": 51,
    "name": "الذاريات",
    "transliteration": "Adh-Dhariyat",
    "englishName": "The Winnowing Winds",
    "type": "meccan",
    "total_verses": 60
  },
  {
    "id": 52,
    "name": "الطور",
    "transliteration": "At-Tur",
    "englishName": "The Mount",
    "type": "meccan",
    "total_verses": 49
  },
  {
    "id": 53,
    "name": "النجم",
    "transliteration": "An-Najm",
    "englishName": "The Star",
    "type": "meccan",
    "total_verses": 62
  },
  {
    "id": 54,
    "name": "القمر",
    "transliteration": "Al-Qamar",
    "englishName": "The Moon",
    "type": "meccan",
    "total_verses": 55
  },
  {
    "id": 55,
    "name": "الرحمن",
    "transliteration": "Ar-Rahman",
    "englishName": "The Beneficent",
    "type": "medinan",
    "total_verses": 78
  },
  {
    "id": 56,
    "name": "الواقعة",
    "transliteration": "Al-Waqi'ah",
    "englishName": "The Inevitable",
    "type": "meccan",
    "total_verses": 96
  },
  {
    "id": 57,
    "name": "الحديد",
    "transliteration": "Al-Hadid",
    "englishName": "The Iron",
    "type": "medinan",
    "total_verses": 29
  },
  {
    "id": 58,
    "name": "المجادلة",
    "transliteration": "Al-Mujadila",
    "englishName": "The Pleading Woman",
    "type": "medinan",
    "total_verses": 22
  },
  {
    "id": 59,
    "name": "الحشر",
    "transliteration": "Al-Hashr",
    "englishName": "The Exile",
    "type": "medinan",
    "total_verses": 24
  },
  {
    "id": 60,
    "name": "الممتحنة",
    "transliteration": "Al-Mumtahanah",
    "englishName": "She that is to be examined",
    "type": "medinan",
    "total_verses": 13
  },
  {
    "id": 61,
    "name": "الصف",
    "transliteration": "As-Saf",
    "englishName": "The Ranks",
    "type": "medinan",
    "total_verses": 14
  },
  {
    "id": 62,
    "name": "الجمعة",
    "transliteration": "Al-Jumu'ah",
    "englishName": "The Congregation, Friday",
    "type": "medinan",
    "total_verses": 11
  },
  {
    "id": 63,
    "name": "المنافقون",
    "transliteration": "Al-Munafiqun",
    "englishName": "The Hypocrites",
    "type": "medinan",
    "total_verses": 11
  },
  {
    "id": 64,
    "name": "التغابن",
    "transliteration": "At-Taghabun",
    "englishName": "The Mutual Disillusion",
    "type": "medinan",
    "total_verses": 18
  },
  {
    "id": 65,
    "name": "الطلاق",
    "transliteration": "At-Talaq",
    "englishName": "The Divorce",
    "type": "medinan",
    "total_verses": 12
  },
  {
    "id": 66,
    "name": "التحريم",
    "transliteration": "At-Tahrim",
    "englishName": "The Prohibition",
    "type": "medinan",
    "total_verses": 12
  },
  {
    "id": 67,
    "name": "الملك",
    "transliteration": "Al-Mulk",
    "englishName": "The Sovereignty",
    "type": "meccan",
    "total_verses": 30
  },
  {
    "id": 68,
    "name": "القلم",
    "transliteration": "Al-Qalam",
    "englishName": "The Pen",
    "type": "meccan",
    "total_verses": 52
  },
  {
    "id": 69,
    "name": "الحاقة",
    "transliteration": "Al-Haqqah",
    "englishName": "The Reality",
    "type": "meccan",
    "total_verses": 52
  },
  {
    "id": 70,
    "name": "المعارج",
    "transliteration": "Al-Ma'arij",
    "englishName": "The Ascending Stairways",
    "type": "meccan",
    "total_verses": 44
  },
  {
    "id": 71,
    "name": "نوح",
    "transliteration": "Nuh",
    "englishName": "Noah",
    "type": "meccan",
    "total_verses": 28
  },
  {
    "id": 72,
    "name": "الجن",
    "transliteration": "Al-Jinn",
    "englishName": "The Jinn",
    "type": "meccan",
    "total_verses": 28
  },
  {
    "id": 73,
    "name": "المزمل",
    "transliteration": "Al-Muzzammil",
    "englishName": "The Enshrouded One",
    "type": "meccan",
    "total_verses": 20
  },
  {
    "id": 74,
    "name": "المدثر",
    "transliteration": "Al-Muddaththir",
    "englishName": "The Cloaked One",
    "type": "meccan",
    "total_verses": 56
  },
  {
    "id": 75,
    "name": "القيامة",
    "transliteration": "Al-Qiyamah",
    "englishName": "The Resurrection",
    "type": "meccan",
    "total_verses": 40
  },
  {
    "id": 76,
    "name": "الانسان",
    "transliteration": "Al-Insan",
    "englishName": "The Man",
    "type": "medinan",
    "total_verses": 31
  },
  {
    "id": 77,
    "name": "المرسلات",
    "transliteration": "Al-Mursalat",
    "englishName": "The Emissaries",
    "type": "meccan",
    "total_verses": 50
  },
  {
    "id": 78,
    "name": "النبإ",
    "transliteration": "An-Naba",
    "englishName": "The Tidings",
    "type": "meccan",
    "total_verses": 40
  },
  {
    "id": 79,
    "name": "النازعات",
    "transliteration": "An-Nazi'at",
    "englishName": "Those who drag forth",
    "type": "meccan",
    "total_verses": 46
  },
  {
    "id": 80,
    "name": "عبس",
    "transliteration": "'Abasa",
    "englishName": "He Frowned",
    "type": "meccan",
    "total_verses": 42
  },
  {
    "id": 81,
    "name": "التكوير",
    "transliteration": "At-Takwir",
    "englishName": "The Overthrowing",
    "type": "meccan",
    "total_verses": 29
  },
  {
    "id": 82,
    "name": "الإنفطار",
    "transliteration": "Al-Infitar",
    "englishName": "The Cleaving",
    "type": "meccan",
    "total_verses": 19
  },
  {
    "id": 83,
    "name": "المطففين",
    "transliteration": "Al-Mutaffifin",
    "englishName": "The Defrauding",
    "type": "meccan",
    "total_verses": 36
  },
  {
    "id": 84,
    "name": "الإنشقاق",
    "transliteration": "Al-Inshiqaq",
    "englishName": "The Sundering",
    "type": "meccan",
    "total_verses": 25
  },
  {
    "id": 85,
    "name": "البروج",
    "transliteration": "Al-Buruj",
    "englishName": "The Mansions of the Stars",
    "type": "meccan",
    "total_verses": 22
  },
  {
    "id": 86,
    "name": "الطارق",
    "transliteration": "At-Tariq",
    "englishName": "The Nightcommer",
    "type": "meccan",
    "total_verses": 17
  },
  {
    "id": 87,
    "name": "الأعلى",
    "transliteration": "Al-A'la",
    "englishName": "The Most High",
    "type": "meccan",
    "total_verses": 19
  },
  {
    "id": 88,
    "name": "الغاشية",
    "transliteration": "Al-Ghashiyah",
    "englishName": "The Overwhelming",
    "type": "meccan",
    "total_verses": 26
  },
  {
    "id": 89,
    "name": "الفجر",
    "transliteration": "Al-Fajr",
    "englishName": "The Dawn",
    "type": "meccan",
    "total_verses": 30
  },
  {
    "id": 90,
    "name": "البلد",
    "transliteration": "Al-Balad",
    "englishName": "The City",
    "type": "meccan",
    "total_verses": 20
  },
  {
    "id": 91,
    "name": "الشمس",
    "transliteration": "Ash-Shams",
    "englishName": "The Sun",
    "type": "meccan",
    "total_verses": 15
  },
  {
    "id": 92,
    "name": "الليل",
    "transliteration": "Al-Layl",
    "englishName": "The Night",
    "type": "meccan",
    "total_verses": 21
  },
  {
    "id": 93,
    "name": "الضحى",
    "transliteration": "Ad-Duhaa",
    "englishName": "The Morning Hours",
    "type": "meccan",
    "total_verses": 11
  },
  {
    "id": 94,
    "name": "الشرح",
    "transliteration": "Ash-Sharh",
    "englishName": "The Relief",
    "type": "meccan",
    "total_verses": 8
  },
  {
    "id": 95,
    "name": "التين",
    "transliteration": "At-Tin",
    "englishName": "The Fig",
    "type": "meccan",
    "total_verses": 8
  },
  {
    "id": 96,
    "name": "العلق",
    "transliteration": "Al-'Alaq",
    "englishName": "The Clot",
    "type": "meccan",
    "total_verses": 19
  },
  {
    "id": 97,
    "name": "القدر",
    "transliteration": "Al-Qadr",
    "englishName": "The Power",
    "type": "meccan",
    "total_verses": 5
  },
  {
    "id": 98,
    "name": "البينة",
    "transliteration": "Al-Bayyinah",
    "englishName": "The Clear Proof",
    "type": "medinan",
    "total_verses": 8
  },
  {
    "id": 99,
    "name": "الزلزلة",
    "transliteration": "Az-Zalzalah",
    "englishName": "The Earthquake",
    "type": "medinan",
    "total_verses": 8
  },
  {
    "id": 100,
    "name": "العاديات",
    "transliteration": "Al-'Adiyat",
    "englishName": "The Courser",
    "type": "meccan",
    "total_verses": 11
  },
  {
    "id": 101,
    "name": "القارعة",
    "transliteration": "Al-Qari'ah",
    "englishName": "The Calamity",
    "type": "meccan",
    "total_verses": 11
  },
  {
    "id": 102,
    "name": "التكاثر",
    "transliteration": "At-Takathur",
    "englishName": "The Rivalry in world increase",
    "type": "meccan",
    "total_verses": 8
  },
  {
    "id": 103,
    "name": "العصر",
    "transliteration": "Al-'Asr",
    "englishName": "The Declining Day",
    "type": "meccan",
    "total_verses": 3
  },
  {
    "id": 104,
    "name": "الهمزة",
    "transliteration": "Al-Humazah",
    "englishName": "The Traducer",
    "type": "meccan",
    "total_verses": 9
  },
  {
    "id": 105,
    "name": "الفيل",
    "transliteration": "Al-Fil",
    "englishName": "The Elephant",
    "type": "meccan",
    "total_verses": 5
  },
  {
    "id": 106,
    "name": "قريش",
    "transliteration": "Quraysh",
    "englishName": "Quraysh",
    "type": "meccan",
    "total_verses": 4
  },
  {
    "id": 107,
    "name": "الماعون",
    "transliteration": "Al-Ma'un",
    "englishName": "The Small kindnesses",
    "type": "meccan",
    "total_verses": 7
  },
  {
    "id": 108,
    "name": "الكوثر",
    "transliteration": "Al-Kawthar",
    "englishName": "The Abundance",
    "type": "meccan",
    "total_verses": 3
  },
  {
    "id": 109,
    "name": "الكافرون",
    "transliteration": "Al-Kafirun",
    "englishName": "The Disbelievers",
    "type": "meccan",
    "total_verses": 6
  },
  {
    "id": 110,
    "name": "النصر",
    "transliteration": "An-Nasr",
    "englishName": "The Divine Support",
    "type": "medinan",
    "total_verses": 3
  },
  {
    "id": 111,
    "name": "المسد",
    "transliteration": "Al-Masad",
    "englishName": "The Palm Fiber",
    "type": "meccan",
    "total_verses": 5
  },
  {
    "id": 112,
    "name": "الإخلاص",
    "transliteration": "Al-Ikhlas",
    "englishName": "The Sincerity",
    "type": "meccan",
    "total_verses": 4
  },
  {
    "id": 113,
    "name": "الفلق",
    "transliteration": "Al-Falaq",
    "englishName": "The Daybreak",
    "type": "meccan",
    "total_verses": 5
  },
  {
    "id": 114,
    "name": "الناس",
    "transliteration": "An-Nas",
    "englishName": "Mankind",
    "type": "meccan",
    "total_verses": 6
  }
];

/**
 * Get surah metadata by surah ID (1-114).
 * @param {number} id
 * @returns {Object|undefined}
 */
function getQuranIndexSurah(id) {
  return QURAN_INDEX[id - 1] || null;
}

/**
 * Search surah index by name or transliteration.
 * @param {string} query
 * @returns {Object[]}
 */
function searchQuranIndex(query) {
  if (!query) return [];
  var q = query.toLowerCase();
  return QURAN_INDEX.filter(function(s) {
    return s.name.indexOf(q) >= 0 ||
      s.transliteration.toLowerCase().indexOf(q) >= 0 ||
      s.englishName.toLowerCase().indexOf(q) >= 0;
  });
}

// Export
window.__QURAN_INDEX = QURAN_INDEX;
window.__QURAN_INDEX_GET = getQuranIndexSurah;
window.__QURAN_INDEX_SEARCH = searchQuranIndex;
