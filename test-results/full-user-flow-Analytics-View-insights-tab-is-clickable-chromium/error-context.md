# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Analytics View >> insights tab is clickable
- Location: test\e2e\full-user-flow.spec.js:1234:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#tab-analytics')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#content"
  - application "Bayan — Quran Learning App" [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e7]: بِسْمِ اللَّهِ
          - generic [ref=e8]: ✓ Offline ready
          - generic [ref=e9]:
            - img [ref=e10]
            - text: Guest
        - generic "Profile" [ref=e14] [cursor=pointer]: U
      - status "Learning statistics" [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]:
            - img [ref=e19]
            - text: Foundation Lesson 1 — The Essential Framework
          - generic [ref=e22]: "Covers ~46.8% of Quran word occurrences · Understanding: 0.0% → 19.2%"
        - generic [ref=e23]: ·
        - generic [ref=e24]: "0"
        - generic [ref=e25]: Learned
        - generic [ref=e26]: ·
        - generic [ref=e27]: "0"
        - generic [ref=e28]: Due
        - generic [ref=e29]: ·
        - generic [ref=e30]: —
        - generic [ref=e31]: Quiz
        - 'progressbar "Daily review goal: 0 of 50 (0%)" [ref=e32] [cursor=pointer]':
          - img [ref=e33]:
            - generic [ref=e36]: "0"
      - progressbar "Session progress" [ref=e37]:
        - generic [ref=e40]: 1 / 10
    - main [ref=e41]:
      - region "Learn words" [ref=e42]:
        - generic [ref=e43]:
          - generic [ref=e44]:
            - img [ref=e46]
            - generic [ref=e49]:
              - generic [ref=e50]: Assalamu Alaikum
              - generic [ref=e51]: Your journey to understand the Quran
            - generic "0-day streak" [ref=e52]:
              - img [ref=e53]
              - text: "0"
          - generic [ref=e55]:
            - generic [ref=e56]: 0%
            - generic [ref=e57]: Quran Comprehension (0 of 897 words mastered)
          - generic [ref=e58]:
            - 'generic "Daily review goal: 0 of 50" [ref=e59]':
              - img [ref=e60]:
                - generic [ref=e63]: "0"
            - generic [ref=e64]:
              - generic [ref=e65]: Today's Goal
              - generic [ref=e66]: 0 of 50 reviews
          - button "Strengthen Root أ-ل-و (To be blessed, to be favored)" [ref=e67]:
            - img [ref=e69]
            - generic [ref=e71]:
              - generic [ref=e72]: Strengthen Root أ-ل-و (To be blessed, to be favored)
              - generic [ref=e73]: Root family mastery is only 0% (0/2 words). Strengthening this root helps you re…
            - generic [ref=e74]: "100"
          - button "Continue learning" [ref=e75]:
            - img [ref=e77]
            - generic [ref=e81]:
              - generic [ref=e82]: Foundation 1 of 10
              - generic [ref=e83]: 0% complete · ~0% comprehension
            - img [ref=e85]
          - generic [ref=e88]:
            - button "Foundation course" [ref=e89]:
              - img [ref=e90]
              - text: Foundation 0%
            - button "Learn by surah" [ref=e94]:
              - img [ref=e95]
              - text: Surahs 0%
            - button "Learn by roots" [ref=e98]:
              - img [ref=e99]
              - text: Roots 0%
            - button "Learn by difficulty" [ref=e102]:
              - img [ref=e103]
              - text: Difficulty 0%
            - button "Take a quiz" [ref=e107]:
              - img [ref=e108]
              - text: Quiz ⚡
          - generic [ref=e110]:
            - img [ref=e112]
            - generic [ref=e115]: 🌟 Start your learning journey today!
          - generic [ref=e116]:
            - generic [ref=e117]:
              - img [ref=e118]
              - text: Today's Plan
            - generic [ref=e120]:
              - img [ref=e122]
              - text: Complete Foundation Lesson 1 of 10
        - generic [ref=e125]:
          - generic [ref=e126]:
            - button "Previous" [ref=e127] [cursor=pointer]:
              - img [ref=e128]
            - generic [ref=e131]: 0 of 10 foundation lessons complete · ~19.2% comprehension
            - button "Next" [ref=e132] [cursor=pointer]:
              - img [ref=e133]
          - generic [ref=e135]:
            - combobox "Select mode" [ref=e136]:
              - option "📚 Lessons (sequential)" [selected]
              - option "📘 Foundation Course (frequency)"
              - option "─── Surahs ───" [disabled]
              - option "📖 Surah Mode (by surah)"
              - option "─── Individual Surahs ───" [disabled]
              - option "1. الفاتحة — The Opening"
              - option "2. البقرة — The Cow"
              - option "3. آل عمران — Family of Imran"
              - option "4. النساء — The Women"
              - option "5. المائدة — The Table Spread"
              - option "6. الأنعام — The Cattle"
              - option "7. الأعراف — The Heights"
              - option "8. الأنفال — The Spoils of War"
              - option "9. التوبة — The Repentance"
              - option "10. يونس — Jonah"
              - option "11. هود — Hud"
              - option "12. يوسف — Joseph"
              - option "13. الرعد — The Thunder"
              - option "14. إبراهيم — Abraham"
              - option "15. الحجر — The Rocky Tract"
              - option "16. النحل — The Bee"
              - option "17. الإسراء — The Night Journey"
              - option "18. الكهف — The Cave"
              - option "19. مريم — Mary"
              - option "20. طه — Ta-Ha"
              - option "21. الأنبياء — The Prophets"
              - option "22. الحج — The Pilgrimage"
              - option "23. المؤمنون — The Believers"
              - option "24. النور — The Light"
              - option "25. الفرقان — The Criterion"
              - option "26. الشعراء — The Poets"
              - option "27. النمل — The Ant"
              - option "28. القصص — The Stories"
              - option "29. العنكبوت — The Spider"
              - option "30. الروم — The Romans"
              - option "31. لقمان — Luqman"
              - option "32. السجدة — The Prostration"
              - option "33. الأحزاب — The Confederates"
              - option "34. سبأ — Sheba"
              - option "35. فاطر — The Originator"
              - option "36. يس — Ya-Sin"
              - option "37. الصافات — Those Who Set the Ranks"
              - option "38. ص — Sad"
              - option "39. الزمر — The Groups"
              - option "40. غافر — The Forgiver"
              - option "41. فصلت — Explained in Detail"
              - option "42. الشورى — The Consultation"
              - option "43. الزخرف — The Gold Adornments"
              - option "44. الدخان — The Smoke"
              - option "45. الجاثية — The Kneeling"
              - option "46. الأحقاف — The Wind-Curved Sandhills"
              - option "47. محمد — Muhammad"
              - option "48. الفتح — The Victory"
              - option "49. الحجرات — The Dwellings"
              - option "50. ق — Qaf"
              - option "51. الذاريات — The Winnowing Winds"
              - option "52. الطور — The Mount"
              - option "53. النجم — The Star"
              - option "54. القمر — The Moon"
              - option "55. الرحمن — The Most Gracious"
              - option "56. الواقعة — The Inevitable Event"
              - option "57. الحديد — The Iron"
              - option "58. المجادلة — The Pleading Woman"
              - option "59. الحشر — The Gathering"
              - option "60. الممتحنة — The Examined Woman"
              - option "61. الصف — The Ranks"
              - option "62. الجمعة — The Congregation Prayer"
              - option "63. المنافقون — The Hypocrites"
              - option "64. التغابن — The Loss and Gain"
              - option "65. الطلاق — The Divorce"
              - option "66. التحريم — The Prohibition"
              - option "67. الملك — The Sovereignty"
              - option "68. القلم — The Pen"
              - option "69. الحاقة — The Reality"
              - option "70. المعارج — The Ascending Stairways"
              - option "71. نوح — Noah"
              - option "72. الجن — The Jinn"
              - option "73. المزمل — The Enwrapped One"
              - option "74. المدثر — The Cloaked One"
              - option "75. القيامة — The Resurrection"
              - option "76. الإنسان — The Human Being"
              - option "77. المرسلات — Those Sent Forth"
              - option "78. النبأ — The Great News"
              - option "79. النازعات — Those Who Pull Out"
              - option "80. عبس — He Frowned"
              - option "81. التكوير — The Overthrowing"
              - option "82. الانفطار — The Splitting"
              - option "83. المطففين — The Defrauders"
              - option "84. الانشقاق — The Splitting Open"
              - option "85. البروج — The Great Constellations"
              - option "86. الطارق — The Nightcomer"
              - option "87. الأعلى — The Most High"
              - option "88. الغاشية — The Overwhelming Event"
              - option "89. الفجر — The Dawn"
              - option "90. البلد — The City"
              - option "91. الشمس — The Sun"
              - option "92. الليل — The Night"
              - option "93. الضحى — The Morning Brightness"
              - option "94. الشرح — The Relief"
              - option "95. التين — The Fig"
              - option "96. العلق — The Clot"
              - option "97. القدر — The Power"
              - option "98. البينة — The Clear Proof"
              - option "99. الزلزلة — The Earthquake"
              - option "100. العاديات — The Courser"
              - option "101. القارعة — The Calamity"
              - option "102. التكاثر — The Rivalry"
              - option "103. العصر — The Time"
              - option "104. الهمزة — The Slanderer"
              - option "105. الفيل — The Elephant"
              - option "106. قريش — Quraysh"
              - option "107. الماعون — The Small Kindness"
              - option "108. الكوثر — The Abundance"
              - option "109. الكافرون — The Disbelievers"
              - option "110. النصر — The Help"
              - option "111. المسد — The Palm Fibre"
              - option "112. الإخلاص — The Sincerity"
              - option "113. الفلق — The Daybreak"
              - option "114. الناس — The Mankind"
            - button "📖 Foundation 1 — The Essential Framework" [ref=e137] [cursor=pointer]
          - generic [ref=e138]:
            - generic [ref=e139]: The Essential Framework · +19.2% comprehension
            - generic [ref=e140]: "46.8% of Quranic vocabulary · Cumulative: 46.8%"
            - generic [ref=e141]: These are the most frequent words in the Quran. Mastering them unlocks the basic structure of every verse.
          - generic [ref=e143]:
            - heading "🔓 After this lesson you will:" [level=3] [ref=e144]
            - generic [ref=e145]: "✓ Recognize 1 noun and 2 verbs common in the Quran✓ Understand words from 10 root families✓ Improve understanding of basic sentence structures, frequent verb forms, common prepositions📈 Estimated comprehension gain: +19.2%"
          - generic [ref=e147]:
            - heading "🗺️ Your Journey" [level=4] [ref=e148]
            - generic [ref=e151]: "Foundation: 0 / 10 lessons"
            - generic [ref=e152]:
              - generic [ref=e153]:
                - generic [ref=e154]: 0.0%
                - generic [ref=e155]: Comprehension
              - generic [ref=e156]:
                - generic [ref=e157]: "0"
                - generic [ref=e158]: Words
              - generic [ref=e159]:
                - generic [ref=e160]: 0/114
                - generic [ref=e161]: Surahs (50%+)
          - generic [ref=e163]:
            - generic [ref=e164]:
              - button "🌱 Root families in this lesson ▼" [expanded] [ref=e165] [cursor=pointer]:
                - generic [ref=e166]: 🌱 Root families in this lesson
                - generic [ref=e167]: ▼
              - generic [ref=e168]:
                - generic [ref=e169]:
                  - generic [ref=e170]: ل-ا (Negation)
                  - generic [ref=e171]: ف-ي-ي (Containment, inclusion)
                  - generic [ref=e172]: م-ا (Question, relation, negation)
                  - generic [ref=e173]: م-ن-ن (To bestow, to cut off)
                  - generic [ref=e174]: أ-ل-ه (Deity, one deserving worship)
                  - generic [ref=e175]: ل-ذ-ي (Reference, relation)
                  - generic [ref=e176]: ع-ل-و (Height, elevation, supremacy)
                  - generic [ref=e177]: م-ن (Person, identity)
                  - generic [ref=e178]: ق-و-ل (To speak, to say)
                  - generic [ref=e179]: ك-و-ن (To be, to exist, to happen)
                - generic [ref=e180]: "Related words coming in future lessons:"
                - generic [ref=e181]:
                  - generic [ref=e182]: لِلَّهِ (To/Belongs to Allah) - Lesson 2
                  - generic [ref=e183]: بِمَا (By What/With What) - Lesson 3
                  - generic [ref=e184]: قُلْ (Say!) - Lesson 3
                  - generic [ref=e185]: إِلَٰهٍ (God/Deity) - Lesson 6
                  - generic [ref=e186]: إِلَٰهَ (God/Deity) - Lesson 6
                  - generic [ref=e187]: نَقُولُ (We Say) - Lesson 6
            - generic [ref=e188]:
              - button "📝 Grammar notes" [ref=e189] [cursor=pointer]:
                - generic [ref=e190]: 📝 Grammar notes
                - img [ref=e192]
              - generic [ref=e194]: Focus on the root letters and their core meaning. Notice how different patterns (wazn) modify the meaning. Pay attention to how this word functions in its ayah context.
            - generic [ref=e195]:
              - button "💡 Learning tips" [ref=e196] [cursor=pointer]:
                - generic [ref=e197]: 💡 Learning tips
                - img [ref=e199]
              - generic [ref=e201]: Review the root family words together to see patterns. Try to recognize this word when you see it in Quranic verses. Consistent daily review is more effective than cramming.
        - article "Current word" [ref=e202]:
          - generic [ref=e203]: Word 1 of 10
          - generic [ref=e204]: لَا
          - generic [ref=e205]: Lā
          - generic [ref=e206]: 📖 محمد · Verse 19
          - generic [ref=e207]: Particle (negation)
          - generic [ref=e208]: No — negation, denial
          - generic [ref=e209]: 🆕 New word
          - generic [ref=e210]: ✦ Appears 6,000 times
        - generic [ref=e211]:
          - button "← Prev" [disabled] [ref=e212]
          - button "Next →" [ref=e213] [cursor=pointer]
        - generic [ref=e214]:
          - button "Show in ayah" [ref=e215] [cursor=pointer]:
            - img [ref=e216]
            - text: Show in ayah
          - button "Show full tafsir" [ref=e219] [cursor=pointer]:
            - img [ref=e220]
            - text: Show full tafsir
          - button "Root system" [ref=e224] [cursor=pointer]:
            - img [ref=e225]
            - text: Root system
          - button "☆ Bookmark" [ref=e227] [cursor=pointer]
          - button "Toggle quick flashcard mode" [ref=e228] [cursor=pointer]:
            - img [ref=e229]
            - generic [ref=e231]: Toggle quick flashcard mode
            - text: Quick
        - generic [ref=e232]:
          - generic [ref=e233]:
            - img [ref=e234]
            - text: Personal Notes
          - textbox "Write your notes about this word…" [ref=e237]
    - navigation "Main navigation" [ref=e238]:
      - button "Dashboard" [ref=e239] [cursor=pointer]:
        - img [ref=e241]
        - generic [ref=e246]: Dashboard
      - button "Paths" [ref=e247] [cursor=pointer]:
        - img [ref=e249]
        - generic [ref=e252]: Paths
      - button "Words" [ref=e253] [cursor=pointer]:
        - img [ref=e255]
        - generic [ref=e256]: Words
      - button "Read" [ref=e257] [cursor=pointer]:
        - img [ref=e259]
        - generic [ref=e262]: Read
      - button "Profile" [ref=e263] [cursor=pointer]:
        - img [ref=e265]
        - generic [ref=e268]: Profile
```

# Test source

```ts
  1135 |     await expect(page.locator('#explorer-next-review')).toBeVisible();
  1136 |     await expect(page.locator('#explorer-review-count')).toBeVisible();
  1137 |     await expect(page.locator('#explorer-foundation-status')).toBeVisible();
  1138 |   });
  1139 | 
  1140 |   test('explorer back button returns to previous view', async ({ page }) => {
  1141 |     await navigateToWordAndOpenExplorer(page);
  1142 | 
  1143 |     await expect(page.locator('#view-explorer')).toBeVisible();
  1144 | 
  1145 |     // Click back button
  1146 |     await page.locator('#explorer-back').click();
  1147 | 
  1148 |     // Wait for explorer view to be dismissed (animation ~400ms)
  1149 |     await expect(page.locator('#view-explorer')).not.toBeVisible({ timeout: 3000 });
  1150 | 
  1151 |     // Should return to a view — either learn or list was the previous view
  1152 |     // The view-entrance animation may briefly hide the target, so wait for content
  1153 |     await page.waitForTimeout(500);
  1154 |     const isLearnVisible = await page.locator('#view-learn').isVisible();
  1155 |     const isListVisible = await page.locator('#view-list').isVisible();
  1156 |     expect(isLearnVisible || isListVisible).toBeTruthy();
  1157 |   });
  1158 | 
  1159 |   test('explorer has action buttons (bookmark, study, review)', async ({ page }) => {
  1160 |     await navigateToWordAndOpenExplorer(page);
  1161 | 
  1162 |     await expect(page.locator('#explorer-btn-bookmark')).toBeVisible();
  1163 |     await expect(page.locator('#explorer-btn-study')).toBeVisible();
  1164 |     await expect(page.locator('#explorer-btn-review')).toBeVisible();
  1165 |   });
  1166 | 
  1167 |   test('explorer word relationships section has semantic groups', async ({ page }) => {
  1168 |     await navigateToWordAndOpenExplorer(page);
  1169 | 
  1170 |     // Various relationship lists should exist
  1171 |     await expect(page.locator('#explorer-semantic-list')).toBeVisible();
  1172 |     await expect(page.locator('#explorer-similar-list')).toBeVisible();
  1173 |     await expect(page.locator('#explorer-related-list')).toBeVisible();
  1174 |   });
  1175 | });
  1176 | 
  1177 | // ── Analytics View ─────────────────────────────────────────────
  1178 | 
  1179 | test.describe('Analytics View', () => {
  1180 |   test.beforeEach(async ({ page }) => {
  1181 |     await page.goto('/');
  1182 |     try {
  1183 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  1184 |       await page.locator('#onboarding-skip').click();
  1185 |       await page.waitForTimeout(500);
  1186 |     } catch (e) {}
  1187 |   });
  1188 | 
  1189 |   test('analytics tab renders content', async ({ page }) => {
  1190 |     await page.locator('#tab-analytics').click();
  1191 |     await page.waitForTimeout(1000);
  1192 | 
  1193 |     await expect(page.locator('#view-analytics')).toBeVisible();
  1194 | 
  1195 |     // Analytics tabs should be present
  1196 |     const tabs = page.locator('.analytics-tab');
  1197 |     const tabCount = await tabs.count();
  1198 |     expect(tabCount).toBeGreaterThanOrEqual(3);
  1199 | 
  1200 |     // Analytics content area should be present
  1201 |     const content = page.locator('#analytics-content');
  1202 |     await expect(content).toBeVisible();
  1203 |   });
  1204 | 
  1205 |   test('overview tab shows learning stats', async ({ page }) => {
  1206 |     await page.locator('#tab-analytics').click();
  1207 |     await page.waitForTimeout(1000);
  1208 | 
  1209 |     // Overview tab should be active by default and show stat cards
  1210 |     const overviewTab = page.locator('.analytics-tab-active');
  1211 |     await expect(overviewTab).toBeVisible();
  1212 |     await expect(overviewTab).toContainText(/Overview/i);
  1213 | 
  1214 |     // Content area should have analytics content
  1215 |     const content = page.locator('#analytics-content');
  1216 |     await expect(content).not.toBeEmpty();
  1217 |   });
  1218 | 
  1219 |   test('trends tab is clickable', async ({ page }) => {
  1220 |     await page.locator('#tab-analytics').click();
  1221 |     await page.waitForTimeout(1000);
  1222 | 
  1223 |     // Click the Trends tab
  1224 |     const trendsTab = page.locator('.analytics-tab').filter({ hasText: /Trends/i });
  1225 |     await expect(trendsTab).toBeVisible();
  1226 |     await trendsTab.click();
  1227 |     await page.waitForTimeout(500);
  1228 | 
  1229 |     // Should have content
  1230 |     const content = page.locator('#analytics-content');
  1231 |     await expect(content).not.toBeEmpty();
  1232 |   });
  1233 | 
  1234 |   test('insights tab is clickable', async ({ page }) => {
> 1235 |     await page.locator('#tab-analytics').click();
       |                                          ^ Error: locator.click: Test timeout of 60000ms exceeded.
  1236 |     await page.waitForTimeout(1000);
  1237 | 
  1238 |     // Click the Insights tab
  1239 |     const insightsTab = page.locator('.analytics-tab').filter({ hasText: /Insights/i });
  1240 |     await expect(insightsTab).toBeVisible();
  1241 |     await insightsTab.click();
  1242 |     await page.waitForTimeout(500);
  1243 | 
  1244 |     const content = page.locator('#analytics-content');
  1245 |     await expect(content).not.toBeEmpty();
  1246 |   });
  1247 | 
  1248 |   test('achievements tab is clickable', async ({ page }) => {
  1249 |     await page.locator('#tab-analytics').click();
  1250 |     await page.waitForTimeout(1000);
  1251 | 
  1252 |     const achievementsTab = page.locator('.analytics-tab').filter({ hasText: /Achievements/i });
  1253 |     await expect(achievementsTab).toBeVisible();
  1254 |     await achievementsTab.click();
  1255 |     await page.waitForTimeout(500);
  1256 | 
  1257 |     const content = page.locator('#analytics-content');
  1258 |     await expect(content).not.toBeEmpty();
  1259 |   });
  1260 | });
  1261 | 
  1262 | // ── Progress Persistence ───────────────────────────────────────
  1263 | 
  1264 | test.describe('Progress Persistence', () => {
  1265 |   test('lesson completion persists across reloads', async ({ page }) => {
  1266 |     await page.goto('/');
  1267 |     await page.waitForLoadState('networkidle');
  1268 |     // Seed lesson progress data
  1269 |     await page.evaluate(() => {
  1270 |       localStorage.clear();
  1271 |       const progress = {
  1272 |         currentLesson: 1,
  1273 |         completedLessons: [0],
  1274 |         quizPassed: { '0': true },
  1275 |       };
  1276 |       localStorage.setItem('quran_lesson_progress', JSON.stringify(progress));
  1277 |       localStorage.setItem('quran_onboarding_done', 'true');
  1278 |     });
  1279 | 
  1280 |     await page.reload();
  1281 |     await page.waitForLoadState('networkidle');
  1282 |     await page.waitForTimeout(1500);
  1283 |     await page.locator('#tab-learn').click();
  1284 |     await page.waitForTimeout(500);
  1285 | 
  1286 |     const lessonLabel = page.locator('#lesson-label');
  1287 |     const text = await lessonLabel.textContent();
  1288 |     // The lesson label should reflect the saved progress
  1289 |     expect(text).toContain('Lesson');
  1290 |   });
  1291 | 
  1292 |   test('SRS data persists across page reloads', async ({ page }) => {
  1293 |     // Seed SRS data
  1294 |     await page.goto('/');
  1295 |     await page.evaluate(() => {
  1296 |       localStorage.clear();
  1297 |       const srsData = {
  1298 |         'test_word_1': {
  1299 |           dueDate: Date.now() + 86400000,
  1300 |           interval: 1,
  1301 |           lastRating: 2,
  1302 |           ratedAt: Date.now(),
  1303 |           stage: 1,
  1304 |           reps: 1,
  1305 |           totalReviews: 1,
  1306 |           lapses: 0,
  1307 |           easeFactor: 2.5,
  1308 |           leechCount: 0,
  1309 |           isLeech: false,
  1310 |         },
  1311 |       };
  1312 |       localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
  1313 |       localStorage.setItem('quran_onboarding_done', 'true');
  1314 |     });
  1315 | 
  1316 |     await page.reload();
  1317 |     await page.waitForLoadState('networkidle');
  1318 |     await page.waitForTimeout(1500);
  1319 | 
  1320 |     // Navigate to stats to check SRS data persisted
  1321 |     await page.locator('#tab-stats').click();
  1322 |     await page.waitForTimeout(500);
  1323 | 
  1324 |     await expect(page.locator('#view-stats')).toBeVisible();
  1325 |   });
  1326 | });
  1327 | 
  1328 | // ── Quick Flashcard Mode ───────────────────────────────────────
  1329 | 
  1330 | test.describe('Quick Flashcard Mode', () => {
  1331 |   test.beforeEach(async ({ page }) => {
  1332 |     await page.goto('/');
  1333 |     try {
  1334 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  1335 |       await page.locator('#onboarding-skip').click();
```