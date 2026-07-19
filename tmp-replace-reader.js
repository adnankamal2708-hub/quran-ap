var fs = require('fs');
var content = fs.readFileSync('index.html', 'utf8');

var startMarker = '<!-- \u2500\u2500 READING MODE VIEW \u2500\u2500 -->';
var endMarker = '<!-- \u2500\u2500 ANALYTICS VIEW \u2500\u2500 -->';

var startIdx = content.indexOf(startMarker);
var endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find reader section markers');
  process.exit(1);
}

var newSection = 
'      <!-- \u2500\u2500 READING MODE VIEW (MVP) \u2500\u2500 -->\n' +
'      <section class="mode-view" id="view-reader" aria-label="Quran Reading Mode">\n' +
'        <!-- Surah Browser (shown by default) -->\n' +
'        <div class="reader-surah-list" id="reader-surah-list">\n' +
'          <!-- Rendered dynamically by renderSurahBrowser() -->\n' +
'        </div>\n' +
'\n' +
'        <!-- Reading View (shown when a surah is selected) -->\n' +
'        <div class="reader-main" id="reader-main" style="display:none">\n' +
'          <div class="reader-top-bar">\n' +
'            <button class="reader-back-btn" id="reader-back-to-list" type="button" aria-label="Back to surah list">\u2190 Back</button>\n' +
'            <h2 class="reader-title" id="reader-surah-title">Select a Surah</h2>\n' +
'          </div>\n' +
'          <div class="reader-verses" id="reader-verses">\n' +
'            <!-- Rendered dynamically by renderAyahs() -->\n' +
'          </div>\n' +
'        </div>\n' +
'      </section>\n';

var newContent = content.substring(0, startIdx) + newSection + content.substring(endIdx);
fs.writeFileSync('index.html', newContent, 'utf8');
console.log('Reader section replaced successfully');

// Verify
var verify = fs.readFileSync('index.html', 'utf8');
var readerCount = (verify.match(/READING MODE VIEW/g) || []).length;
console.log('Found', readerCount, 'READING MODE VIEW markers');

var oldSection = (verify.match(/reader-container|reader-sidebar|reader-sheet-overlay|juz-select/g) || []).length;
console.log('Old reader elements found:', oldSection);
