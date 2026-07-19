# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Quiz Flow >> quiz completes with score display
- Location: test\e2e\full-user-flow.spec.js:344:3

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.click: Test timeout of 180000ms exceeded.
Call log:
  - waiting for locator('#tab-learn')

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
        - generic [ref=e18]: Foundation • Lesson 1 — The Essential Framework
        - generic [ref=e19]: ·
        - generic [ref=e20]: "0"
        - generic [ref=e21]: Learned
        - generic [ref=e22]: ·
        - generic [ref=e23]: "0"
        - generic [ref=e24]: Due
        - generic [ref=e25]: ·
        - generic [ref=e26]: —
        - generic [ref=e27]: Quiz
        - 'progressbar "Daily review goal: 0 of 50 (0%)" [ref=e28] [cursor=pointer]':
          - img [ref=e29]:
            - generic [ref=e32]: "0"
      - progressbar "Session progress" [ref=e33]:
        - generic [ref=e36]: 1 / 10
    - main [ref=e37]:
      - region "Learn words" [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - button "Previous" [ref=e41] [cursor=pointer]:
              - img [ref=e42]
            - generic [ref=e45]: 0 of 10 foundation lessons complete
            - button "Next" [ref=e46] [cursor=pointer]:
              - img [ref=e47]
          - generic [ref=e49]:
            - combobox "Select mode" [ref=e50]:
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
            - button "📖 Foundation 1 — The Essential Framework" [ref=e51] [cursor=pointer]
        - article "Current word" [ref=e52]:
          - generic [ref=e53]: Word 1 of 10
          - generic [ref=e54]: لَا
          - generic [ref=e55]: Lā
          - generic [ref=e56]: 📖 محمد · Verse 19
          - generic [ref=e57]: Particle (negation)
          - generic [ref=e58]: No — negation, denial
          - generic [ref=e59]: 🆕 New word
          - generic [ref=e60]: ✦ Appears 6,000 times
        - generic [ref=e61]:
          - button "Previous word" [disabled] [ref=e62]: ← Prev
          - button "Next word" [ref=e63] [cursor=pointer]: Next →
        - generic [ref=e64]:
          - button "Show in ayah" [ref=e65] [cursor=pointer]:
            - img [ref=e66]
            - text: Show in ayah
          - button "Show full tafsir" [ref=e69] [cursor=pointer]:
            - img [ref=e70]
            - text: Show full tafsir
          - button "Root system" [ref=e74] [cursor=pointer]:
            - img [ref=e75]
            - text: Root system
          - button "☆ Bookmark" [ref=e77] [cursor=pointer]
          - button "Toggle quick flashcard mode" [ref=e78] [cursor=pointer]:
            - img [ref=e79]
            - generic [ref=e81]: Toggle quick flashcard mode
            - text: Quick
        - generic [ref=e82]:
          - generic [ref=e83]:
            - img [ref=e84]
            - text: Personal Notes
          - textbox "Write your notes about this word…" [ref=e87]
        - generic [ref=e88]:
          - generic [ref=e89]:
            - button "Learning Paths" [ref=e90] [cursor=pointer]:
              - img [ref=e91]
              - generic [ref=e94]: Learning Paths
              - img [ref=e95]
            - generic:
              - button "Continue learning" [ref=e97] [cursor=pointer]:
                - img [ref=e99]
                - generic [ref=e103]:
                  - generic [ref=e104]: Foundation 1 of 10
                  - generic [ref=e105]: 0% complete
                - img [ref=e107]
              - generic [ref=e110]:
                - button "Foundation course" [ref=e111] [cursor=pointer]:
                  - img [ref=e112]
                  - generic [ref=e116]: Foundation
                  - generic [ref=e117]: 0%
                - button "Learn by surah" [ref=e118] [cursor=pointer]:
                  - img [ref=e119]
                  - generic [ref=e122]: Surahs
                  - generic [ref=e123]: 0%
                - button "Learn by roots" [ref=e124] [cursor=pointer]:
                  - img [ref=e125]
                  - generic [ref=e128]: Roots
                  - generic [ref=e129]: 0%
                - button "Learn by difficulty" [ref=e130] [cursor=pointer]:
                  - img [ref=e131]
                  - generic [ref=e135]: Difficulty
                  - generic [ref=e136]: 0%
                - button "Take a quiz" [ref=e137] [cursor=pointer]:
                  - img [ref=e138]
                  - generic [ref=e140]: Quiz
                  - generic [ref=e141]: ⚡
          - generic [ref=e142]:
            - button "Lesson Statistics" [ref=e143] [cursor=pointer]:
              - img [ref=e144]
              - generic [ref=e146]: Lesson Statistics
              - img [ref=e147]
            - generic:
              - generic [ref=e149]:
                - generic [ref=e150]: The Essential Framework · +19.2% comprehension
                - generic [ref=e151]: "46.8% of Quranic vocabulary · Cumulative: 46.8%"
                - generic [ref=e152]: These are the most frequent words in the Quran. Mastering them unlocks the basic structure of every verse.
              - generic [ref=e154]:
                - heading "🔓 After this lesson you will:" [level=3] [ref=e155]
                - generic [ref=e156]:
                  - generic [ref=e157]: ✓ Recognize 1 noun and 2 verbs common in the Quran
                  - generic [ref=e158]: ✓ Understand words from 10 root families
                  - generic [ref=e159]: ✓ Improve understanding of basic sentence structures, frequent verb forms, common prepositions
                  - generic [ref=e160]: "📈 Estimated comprehension gain: +19.2%"
              - generic [ref=e162]:
                - heading "🗺️ Your Journey" [level=4] [ref=e163]
                - generic [ref=e166]: "Foundation: 0 / 10 lessons"
                - generic [ref=e167]:
                  - generic [ref=e168]:
                    - generic [ref=e169]: 0.0%
                    - generic [ref=e170]: Comprehension
                  - generic [ref=e171]:
                    - generic [ref=e172]: "0"
                    - generic [ref=e173]: Words
                  - generic [ref=e174]:
                    - generic [ref=e175]: 0/114
                    - generic [ref=e176]: Surahs (50%+)
          - generic [ref=e177]:
            - button "Root Families & Learning Context" [ref=e178] [cursor=pointer]:
              - img [ref=e179]
              - generic [ref=e181]: Root Families & Learning Context
              - img [ref=e182]
            - generic [ref=e184]:
              - generic [ref=e185]:
                - button "🌱 Root families in this lesson ▼" [expanded] [ref=e186] [cursor=pointer]:
                  - generic [ref=e187]: 🌱 Root families in this lesson
                  - generic [ref=e188]: ▼
                - generic [ref=e189]:
                  - generic [ref=e190]:
                    - generic [ref=e191]: ل-ا (Negation)
                    - generic [ref=e192]: ف-ي-ي (Containment, inclusion)
                    - generic [ref=e193]: م-ا (Question, relation, negation)
                    - generic [ref=e194]: م-ن-ن (To bestow, to cut off)
                    - generic [ref=e195]: أ-ل-ه (Deity, one deserving worship)
                    - generic [ref=e196]: ل-ذ-ي (Reference, relation)
                    - generic [ref=e197]: ع-ل-و (Height, elevation, supremacy)
                    - generic [ref=e198]: م-ن (Person, identity)
                    - generic [ref=e199]: ق-و-ل (To speak, to say)
                    - generic [ref=e200]: ك-و-ن (To be, to exist, to happen)
                  - generic [ref=e201]: "Related words coming in future lessons:"
                  - generic [ref=e202]:
                    - generic [ref=e203]: لِلَّهِ (To/Belongs to Allah) - Lesson 2
                    - generic [ref=e204]: بِمَا (By What/With What) - Lesson 3
                    - generic [ref=e205]: قُلْ (Say!) - Lesson 3
                    - generic [ref=e206]: إِلَٰهٍ (God/Deity) - Lesson 6
                    - generic [ref=e207]: إِلَٰهَ (God/Deity) - Lesson 6
                    - generic [ref=e208]: نَقُولُ (We Say) - Lesson 6
              - generic [ref=e209]:
                - button "📝 Grammar notes" [ref=e210] [cursor=pointer]:
                  - generic [ref=e211]: 📝 Grammar notes
                  - img [ref=e213]
                - generic [ref=e215]: Focus on the root letters and their core meaning. Notice how different patterns (wazn) modify the meaning. Pay attention to how this word functions in its ayah context.
              - generic [ref=e216]:
                - button "💡 Learning tips" [ref=e217] [cursor=pointer]:
                  - generic [ref=e218]: 💡 Learning tips
                  - img [ref=e220]
                - generic [ref=e222]: Review the root family words together to see patterns. Try to recognize this word when you see it in Quranic verses. Consistent daily review is more effective than cramming.
    - navigation "Main navigation" [ref=e223]:
      - button "Dashboard" [ref=e224] [cursor=pointer]:
        - img [ref=e226]
        - generic [ref=e231]: Dashboard
      - button "Learn" [ref=e232] [cursor=pointer]:
        - img [ref=e234]
        - generic [ref=e237]: Learn
      - button "Words" [ref=e238] [cursor=pointer]:
        - img [ref=e240]
        - generic [ref=e241]: Words
      - button "Read" [ref=e242] [cursor=pointer]:
        - img [ref=e244]
        - generic [ref=e247]: Read
      - button "Profile" [ref=e248] [cursor=pointer]:
        - img [ref=e250]
        - generic [ref=e253]: Profile
```

# Test source

```ts
  245 |     await page.locator('#tab-learn').click();
  246 |     await page.waitForTimeout(500);
  247 |     await page.locator('#surah-select').selectOption('foundation');
  248 |     await page.waitForTimeout(500);
  249 |   });
  250 | 
  251 |   test('SRS buttons become visible after first word', async ({ page }) => {
  252 |     // Navigate forward to make SRS row visible
  253 |     await page.locator('#btn-next').click();
  254 |     await page.waitForTimeout(300);
  255 | 
  256 |     const srsRow = page.locator('#srs-row');
  257 |     const srsLabel = page.locator('#srs-label');
  258 |     await expect(srsRow).toBeVisible();
  259 |     await expect(srsLabel).toBeVisible();
  260 | 
  261 |     // All 4 buttons should be visible
  262 |     await expect(page.locator('#srs-again')).toBeVisible();
  263 |     await expect(page.locator('#srs-hard')).toBeVisible();
  264 |     await expect(page.locator('#srs-good')).toBeVisible();
  265 |     await expect(page.locator('#srs-easy')).toBeVisible();
  266 |   });
  267 | 
  268 |   test('rating a word updates stats and navigates', async ({ page }) => {
  269 |     // Navigate forward to enable SRS
  270 |     await page.locator('#btn-next').click();
  271 |     await page.waitForTimeout(300);
  272 | 
  273 |     // Click "Good" rating
  274 |     await page.locator('#srs-good').click();
  275 |     await page.waitForTimeout(500);
  276 | 
  277 |     // Stats should show learned count > 0
  278 |     const learned = page.locator('#stat-learned');
  279 |     const learnedText = await learned.textContent();
  280 |     expect(parseInt(learnedText)).toBeGreaterThanOrEqual(0);
  281 |   });
  282 | });
  283 | 
  284 | // ── Quiz Flow ──────────────────────────────────────────────────
  285 | 
  286 | test.describe('Quiz Flow', () => {
  287 |   test.beforeEach(async ({ page }) => {
  288 |     await page.goto('/');
  289 |     try {
  290 |       await page.waitForSelector('#onboarding-overlay', { timeout: 3000, state: 'visible' });
  291 |       await page.locator('#onboarding-skip').click();
  292 |       await page.waitForTimeout(500);
  293 |     } catch (e) {}
  294 |   });
  295 | 
  296 |   test('quiz view shows questions after navigating from lesson', async ({ page }) => {
  297 |     // Start with foundation lesson, then go to quiz
  298 |     await page.locator('#tab-learn').click();
  299 |     await page.waitForTimeout(500);
  300 |     await page.locator('#surah-select').selectOption('foundation');
  301 |     await page.waitForTimeout(500);
  302 | 
  303 |     // Navigate to quiz
  304 |     await page.locator('#tab-quiz').click();
  305 |     await page.waitForTimeout(500);
  306 | 
  307 |     await expect(page.locator('#view-quiz')).toBeVisible();
  308 | 
  309 |     // Quiz should have a question displayed
  310 |     const quizWord = page.locator('#quiz-word');
  311 |     const options = page.locator('.quiz-opt');
  312 |     const optCount = await options.count();
  313 | 
  314 |     await expect(quizWord).toBeVisible();
  315 |     expect(optCount).toBeGreaterThanOrEqual(2);
  316 |   });
  317 | 
  318 |   test('answering quiz moves to next question', async ({ page }) => {
  319 |     await page.locator('#tab-learn').click();
  320 |     await page.waitForTimeout(500);
  321 |     await page.locator('#surah-select').selectOption('foundation');
  322 |     await page.waitForTimeout(500);
  323 | 
  324 |     await page.locator('#tab-quiz').click();
  325 |     await page.waitForTimeout(500);
  326 | 
  327 |     // Answer first question
  328 |     const firstOption = page.locator('.quiz-opt').first();
  329 |     await firstOption.click();
  330 |     await page.waitForTimeout(300);
  331 | 
  332 |     // Next button should appear
  333 |     await expect(page.locator('#btn-next-quiz')).toBeVisible();
  334 | 
  335 |     // Feedback should be shown
  336 |     const feedback = page.locator('#quiz-feedback');
  337 |     await expect(feedback).not.toBeEmpty();
  338 | 
  339 |     // Score display should show progress
  340 |     const score = page.locator('#quiz-score-display');
  341 |     await expect(score).toContainText(/correct/);
  342 |   });
  343 | 
  344 |   test('quiz completes with score display', async ({ page }) => {
> 345 |     await page.locator('#tab-learn').click();
      |                                      ^ Error: locator.click: Test timeout of 180000ms exceeded.
  346 |     await page.waitForTimeout(500);
  347 |     await page.locator('#surah-select').selectOption('foundation');
  348 |     await page.waitForTimeout(500);
  349 | 
  350 |     await page.locator('#tab-quiz').click();
  351 |     await page.waitForTimeout(500);
  352 | 
  353 |     // Answer all quiz questions (foundation lesson 1 has 10 words)
  354 |     const maxAnswers = 12; // safety limit
  355 |     for (let i = 0; i < maxAnswers; i++) {
  356 |       const isNextVisible = await page.locator('#btn-next-quiz').isVisible();
  357 |       if (!isNextVisible) {
  358 |         // No next button means quiz hasn't started yet or is done
  359 |         const opts = page.locator('.quiz-opt');
  360 |         const count = await opts.count();
  361 |         if (count === 0) break; // Quiz complete
  362 |       }
  363 | 
  364 |       try {
  365 |         const option = page.locator('.quiz-opt').first();
  366 |         await option.click({ timeout: 2000 });
  367 |         await page.waitForTimeout(200);
  368 |       } catch (e) {
  369 |         break; // No more options
  370 |       }
  371 | 
  372 |       try {
  373 |         const nextBtn = page.locator('#btn-next-quiz');
  374 |         if (await nextBtn.isVisible({ timeout: 1000 })) {
  375 |           await nextBtn.click();
  376 |           await page.waitForTimeout(200);
  377 |         }
  378 |       } catch (e) {
  379 |         break;
  380 |       }
  381 |     }
  382 | 
  383 |     // After all questions, quiz should show completion
  384 |     await page.waitForTimeout(500);
  385 |     const feedback = page.locator('#quiz-feedback');
  386 |     const feedbackText = await feedback.textContent();
  387 |     expect(feedbackText).toContain('Done');
  388 |   });
  389 | });
  390 | 
  391 | // ── Review Banner & SRS Review ─────────────────────────────────
  392 | 
  393 | test.describe('Review Banner & SRS Review', () => {
  394 |   test('review banner appears when words are due', async ({ page }) => {
  395 |     // Seed SRS data with a due word
  396 |     await page.goto('/');
  397 |     // Clear and seed localStorage with a due review
  398 |     await page.evaluate(() => {
  399 |       localStorage.clear();
  400 |       const dueDate = Date.now() - 86400000; // 1 day overdue
  401 |       const srsData = {
  402 |         'cw_0': {
  403 |           dueDate: dueDate,
  404 |           interval: 1,
  405 |           lastRating: 2,
  406 |           ratedAt: dueDate,
  407 |           stage: 2,
  408 |           reps: 3,
  409 |           totalReviews: 3,
  410 |           lapses: 0,
  411 |           easeFactor: 2.5,
  412 |           leechCount: 0,
  413 |           isLeech: false,
  414 |         },
  415 |       };
  416 |       localStorage.setItem('quran_srs_data', JSON.stringify(srsData));
  417 |       localStorage.setItem('quran_onboarding_done', 'true');
  418 |     });
  419 | 
  420 |     await page.reload();
  421 |     await page.waitForLoadState('networkidle');
  422 |     await page.waitForTimeout(1500);
  423 | 
  424 |     // Navigate to learn view
  425 |     await page.locator('#tab-learn').click();
  426 |     await page.waitForTimeout(500);
  427 | 
  428 |     // Review banner should be visible
  429 |     const banner = page.locator('#review-banner');
  430 |     await expect(banner).toBeVisible();
  431 |     await expect(page.locator('#review-banner-text')).not.toBeEmpty();
  432 |   });
  433 | 
  434 |   test('start review button enters review mode', async ({ page }) => {
  435 |     await page.goto('/');
  436 |     await page.waitForLoadState('networkidle');
  437 |     await page.evaluate(() => {
  438 |       localStorage.clear();
  439 |       const dueDate = Date.now() - 86400000;
  440 |       const srsData = {
  441 |         'cw_0': {
  442 |           dueDate: dueDate,
  443 |           interval: 1,
  444 |           lastRating: 2,
  445 |           ratedAt: dueDate,
```