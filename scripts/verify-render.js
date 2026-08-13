// One-off headless-browser verification: renders the 48 fixed verses (plus a
// sample of unaffected verses) with the app's actual font (Amiri) and checks:
//   1. Every verse's text contains no U+FFFD.
//   2. document.fonts.check() reports Amiri covers every verse (no tofu/notdef).
//   3. A screenshot is saved for visual confirmation.
// Run: node scripts/verify-render.js

const fs = require('fs');
const path = require('path');

global.window = {};
// quran-data.js declares `var QURAN_TEXT`; run it in global scope via new Function
// to avoid clashing with this module's own bindings.
new Function(fs.readFileSync(path.join(__dirname, '..', 'js', 'quran', 'quran-data.js'), 'utf8'))();
const QURAN_TEXT = JSON.parse(JSON.stringify(global.window.__QURAN_TEXT));

// All 48 verses that were corrupted with U+FFFD (now fixed) + 5 unaffected spot-checks
const affected = [
  '2:25','2:60','2:61','2:68','2:85','2:95','2:102','2:103','2:106','2:109','2:196','2:237',
  '3:17','3:79','3:146','4:97','5:3','5:21','5:46','6:151','10:29','10:66','10:102','11:27',
  '12:44','12:79','16:27','16:95','17:5','17:44','17:80','19:64','20:130','25:76','26:72','29:53',
  '32:5','36:57','39:38','40:75','41:28','42:43','48:4','56:92','70:6','74:26','78:35','96:18',
];
const spotChecks = ['1:1', '2:255', '36:1', '112:1', '55:13'];
const keys = affected.concat(spotChecks);

const verseHtml = keys.map(function (k) {
  const p = k.split(':');
  const text = QURAN_TEXT[p[0]].verses[+p[1] - 1].text;
  return '<div class="verse"><div class="label">Surah ' + p[0] + ':' + p[1] + '</div>' + text + '</div>';
}).join('');

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Bayan Quran rendering check (post-fix)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>
  body { background:#0f0e0c; color:#e8e2d5; font-family:'Inter',sans-serif; padding:24px; }
  .verse { font-family:'Amiri', serif; font-size:24px; direction:rtl; text-align:right; line-height:2; margin-bottom:14px; padding:10px 14px; border:1px solid #2e2b24; border-radius:10px; background:#1a1915; }
  .label { font-size:12px; color:#918777; margin-bottom:2px; direction:ltr; text-align:left; }
</style>
</head>
<body>
<h3 style="color:#c9a84c; font-family:sans-serif">Bayan — Quran rendering check (post U+FFFD fix)</h3>
<div id="verses">${verseHtml}</div>
<script>
  var verses = ${JSON.stringify(keys.map(k => {
    const p = k.split(':');
    return { key: k, text: QURAN_TEXT[p[0]].verses[+p[1] - 1].text };
  }))};
  window.__RESULTS = {};
  (async function () {
    try { await document.fonts.ready; } catch (e) {}
    verses.forEach(function (v) {
      var ok = document.fonts.check("24px 'Amiri'", v.text);
      var hasFFFD = v.text.indexOf('\uFFFD') >= 0;
      window.__RESULTS[v.key] = { covered: ok, hasFFFD: hasFFFD };
    });
    window.__DONE = true;
  })();
</script>
</body>
</html>`;

const outPath = path.join(__dirname, 'verify-render.html');
fs.writeFileSync(outPath, html, 'utf8');

(async function () {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 480, height: 1600 } });
  await page.goto('file://' + outPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__DONE === true, null, { timeout: 30000 });
  const results = await page.evaluate(() => window.__RESULTS);

  let fail = 0;
  for (const k of keys) {
    const r = results[k];
    const status = r && r.covered && !r.hasFFFD ? 'OK ' : 'FAIL';
    if (status === 'FAIL') fail++;
    console.log(status + '  ' + k + '  covered=' + (r ? r.covered : 'n/a') + ' hasFFFD=' + (r ? r.hasFFFD : 'n/a'));
  }
  await page.screenshot({ path: path.join(__dirname, 'verify-render.png'), fullPage: true });
  console.log('\nScreenshot saved: scripts/verify-render.png');
  console.log(fail === 0 ? '✅ ALL ' + keys.length + ' verses render with no tofu and no U+FFFD' : '❌ ' + fail + ' verses FAILED');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });
