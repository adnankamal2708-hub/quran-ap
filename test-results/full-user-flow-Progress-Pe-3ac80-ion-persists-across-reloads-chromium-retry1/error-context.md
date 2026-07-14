# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Progress Persistence >> lesson completion persists across reloads
- Location: test\e2e\full-user-flow.spec.js:1265:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
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
        - generic [ref=e17]:
          - generic [ref=e18]: 📖 Lesson 2 — Sequential Vocabulary
          - generic [ref=e19]: 10 words · ~0.4% of Quranic occurrences · 1 of 90 lessons complete
        - generic [ref=e20]: ·
        - generic [ref=e21]: "0"
        - generic [ref=e22]: Learned
        - generic [ref=e23]: ·
        - generic [ref=e24]: "0"
        - generic [ref=e25]: Due
        - generic [ref=e26]: ·
        - generic [ref=e27]: —
        - generic [ref=e28]: Quiz
        - 'progressbar "Daily review goal: 0 of 25 (0%)" [ref=e29] [cursor=pointer]':
          - img [ref=e30]:
            - generic [ref=e33]: "0"
      - progressbar "Session progress" [ref=e34]:
        - generic [ref=e37]: 1 / 10
    - main [ref=e38]:
      - region "Learning Dashboard" [ref=e39]:
        - generic [ref=e40]:
          - 'button "Review Center: 0 reviews due" [ref=e41] [cursor=pointer]':
            - generic [ref=e42]:
              - generic [ref=e43]: 📋
              - generic [ref=e44]:
                - generic [ref=e45]: Review Center
                - generic [ref=e46]: All caught up — track your revision progress
              - generic [ref=e47]: →
          - generic [ref=e48]:
            - img [ref=e50]
            - generic [ref=e53]:
              - heading "Assalamu Alaikum" [level=2] [ref=e54]
              - paragraph [ref=e55]: Your journey to understand the Quran
          - 'button "Quran comprehension: 0%" [ref=e56] [cursor=pointer]':
            - img [ref=e58]:
              - generic [ref=e61]: 0%
            - generic [ref=e62]:
              - generic [ref=e63]: 0% Quran Comprehension
              - generic [ref=e64]: Start learning Quranic vocabulary to unlock comprehension.
          - generic [ref=e65]:
            - generic [ref=e66]:
              - generic [ref=e67]: 0%
              - generic [ref=e68]: Coverage
            - generic [ref=e69]:
              - generic [ref=e70]: "0"
              - generic [ref=e71]: Mastered
            - generic [ref=e72]:
              - generic [ref=e73]: "939"
              - generic [ref=e74]: Total Words
          - generic [ref=e75]:
            - generic [ref=e76]:
              - img [ref=e78]
              - text: Today's Goal
            - generic [ref=e85]: 0 / 15
            - generic [ref=e87]:
              - img [ref=e89]
              - generic [ref=e92]: 15 items remaining
              - generic [ref=e93]: ~8 min
          - generic [ref=e94]:
            - img [ref=e96]
            - text: Continue Reading
          - button "Start reading the Quran" [ref=e99] [cursor=pointer]:
            - generic [ref=e100]:
              - generic [ref=e101]: 📖
              - generic [ref=e102]:
                - generic [ref=e103]: Start Reading
                - generic [ref=e104]: Begin your Quran reading journey with Surah Al-Fatiha
              - button "Begin" [ref=e105]
          - generic [ref=e106]:
            - img [ref=e108]
            - text: Continue Learning
          - button "Continue Foundation Course" [ref=e112] [cursor=pointer]:
            - generic [ref=e113]:
              - img [ref=e115]
              - generic [ref=e119]:
                - generic [ref=e120]: Foundation Course
                - generic [ref=e121]: The Essential Framework · Lesson 1 of 10
              - button "Resume" [ref=e122]
            - generic [ref=e125]: 0/10
          - generic [ref=e126]:
            - generic [ref=e127]:
              - img [ref=e129]
              - text: Surah Comprehension
            - 'button "الفاتحة: 0% comprehension" [ref=e132]':
              - generic [ref=e133]: الفاتحةThe Opening
              - text: 0%
            - 'button "البقرة: 0% comprehension" [ref=e134]':
              - generic [ref=e135]: البقرةThe Cow
              - text: 0%
            - 'button "آل عمران: 0% comprehension" [ref=e136]':
              - generic [ref=e137]: آل عمرانFamily of Imran
              - text: 0%
            - 'button "النساء: 0% comprehension" [ref=e138]':
              - generic [ref=e139]: النساءThe Women
              - text: 0%
            - 'button "المائدة: 0% comprehension" [ref=e140]':
              - generic [ref=e141]: المائدةThe Table Spread
              - text: 0%
            - generic [ref=e142]: 0/114 surahs above 50% comprehension
          - generic [ref=e143]:
            - img [ref=e145]
            - text: Smart Recommendations
          - 'button "Continue Lesson 1: The Essential Framework" [ref=e147] [cursor=pointer]':
            - generic [ref=e148]:
              - img [ref=e150]
              - generic [ref=e153]:
                - generic [ref=e154]: "Continue Lesson 1: The Essential Framework"
                - generic [ref=e155]: Completing this lesson will increase your Quran comprehension by +19.2%.
              - generic [ref=e156]: →
          - button "5 weak areas detected" [ref=e157] [cursor=pointer]:
            - generic [ref=e158]:
              - img [ref=e160]
              - generic [ref=e162]:
                - generic [ref=e163]: 5 weak areas detected
                - generic [ref=e164]: Focus on Nouns and 4 more to strengthen your foundation.
              - generic [ref=e165]: →
          - button "Begin reading the Quran" [ref=e166] [cursor=pointer]:
            - generic [ref=e167]:
              - img [ref=e169]
              - generic [ref=e172]:
                - generic [ref=e173]: Begin reading the Quran
                - generic [ref=e174]: Reading the Quran alongside vocabulary study reinforces your learning in real context.
              - generic [ref=e175]: →
          - generic [ref=e176]:
            - generic [ref=e177]:
              - img [ref=e179]
              - text: Progress Overview
            - generic [ref=e181]: Foundation Course0/10
            - generic [ref=e185]: Root Families0/552
            - generic [ref=e189]: Difficulty Levels0/5
            - generic [ref=e193]: Surahs Completed0/114
            - generic [ref=e196]:
              - generic [ref=e197]: 0Mastered
              - generic [ref=e198]: 0Streak
              - generic [ref=e199]: 0Due
              - generic [ref=e200]: 0Today
          - generic [ref=e202]:
            - generic [ref=e203]: 🌱
            - paragraph [ref=e204]:
              - text: Start the Foundation Course to unlock
              - strong [ref=e205]: ~0%
              - text: of Quranic word occurrences in just 10 lessons!
          - generic [ref=e206]:
            - 'button "Streak: 0 days" [ref=e207]':
              - img [ref=e209]
              - generic [ref=e211]: "0"
              - generic [ref=e212]: Streak
            - 'button "Words mastered: 0" [ref=e213]':
              - generic [ref=e214]: "0"
              - generic [ref=e215]: Mastered
            - 'button "Quran comprehension: 0%" [ref=e216]':
              - generic [ref=e217]: 0%
              - generic [ref=e218]: Comprehension
            - 'button "Reviews today: 0" [ref=e219]':
              - generic [ref=e220]: "0"
              - generic [ref=e221]: Reviews
    - navigation "Main navigation" [ref=e222]:
      - button "Dashboard" [ref=e223] [cursor=pointer]:
        - img [ref=e225]
        - generic [ref=e230]: Dashboard
      - button "Paths" [ref=e231] [cursor=pointer]:
        - img [ref=e233]
        - generic [ref=e236]: Paths
      - button "Words" [ref=e237] [cursor=pointer]:
        - img [ref=e239]
        - generic [ref=e240]: Words
      - button "Read" [ref=e241] [cursor=pointer]:
        - img [ref=e243]
        - generic [ref=e246]: Read
      - button "Profile" [ref=e247] [cursor=pointer]:
        - img [ref=e249]
        - generic [ref=e252]: Profile
```

# Test source

```ts
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
  1235 |     await page.locator('#tab-analytics').click();
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
> 1283 |     await page.locator('#tab-learn').click();
       |                                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  1336 |       await page.waitForTimeout(500);
  1337 |     } catch (e) {}
  1338 |     await page.locator('#tab-learn').click();
  1339 |     await page.waitForTimeout(500);
  1340 |     await page.locator('#surah-select').selectOption('foundation');
  1341 |     await page.waitForTimeout(500);
  1342 |   });
  1343 | 
  1344 |   test('quick mode toggle button is visible', async ({ page }) => {
  1345 |     await expect(page.locator('#qa-quick-mode')).toBeVisible();
  1346 |   });
  1347 | 
  1348 |   test('toggling quick mode hides extra content', async ({ page }) => {
  1349 |     // Click quick mode button
  1350 |     await page.locator('#qa-quick-mode').click();
  1351 |     await page.waitForTimeout(300);
  1352 | 
  1353 |     // The learn view should have quick-mode class
  1354 |     const learnView = page.locator('#view-learn');
  1355 |     const hasQuickMode = await learnView.evaluate(el => el.classList.contains('quick-mode'));
  1356 |     expect(hasQuickMode).toBeTruthy();
  1357 |   });
  1358 | 
  1359 |   test('toggling quick mode off restores full layout', async ({ page }) => {
  1360 |     // Toggle on — use page.evaluate to bypass smooth-scroll repositioning
  1361 |     await page.evaluate(() => {
  1362 |       var btn = document.getElementById('qa-quick-mode');
  1363 |       if (btn) btn.click();
  1364 |     });
  1365 |     await page.waitForTimeout(300);
  1366 | 
  1367 |     // Toggle off
  1368 |     await page.evaluate(() => {
  1369 |       var btn = document.getElementById('qa-quick-mode');
  1370 |       if (btn) btn.click();
  1371 |     });
  1372 |     await page.waitForTimeout(300);
  1373 | 
  1374 |     // Check quick-mode class is removed
  1375 |     const hasQuickMode = await page.evaluate(() => {
  1376 |       var view = document.getElementById('view-learn');
  1377 |       return view ? view.classList.contains('quick-mode') : false;
  1378 |     });
  1379 |     expect(hasQuickMode).toBeFalsy();
  1380 | 
  1381 |     // Button should say "⚡ Quick" when off
  1382 |     await expect(page.locator('#qa-quick-mode')).toContainText(/Quick(?!: ON)/);
  1383 |   });
```