// ═══════════════════════════════════════════════════════════════
// share-card.js — draws the progress card and shares it
//
// "Share my progress" (on a lesson's finish screen, the session summary
// and Profile) draws a 1080×1350 image of what share-progress.js says and
// hands it to the phone's share sheet; where files can't be shared, the
// image is downloaded instead. Nothing is sent anywhere by the app itself.
// ═══════════════════════════════════════════════════════════════

var SHARE_CARD = {
  width: 1080, height: 1350, margin: 96, logoSize: 88,
  colors: { bg: '#0f0e0c', frame: '#2e2b24', gold: '#c9a84c', text: '#e8e2d5', muted: '#ada291' },
  fonts: { serif: "'Lora', Georgia, serif", body: "'Inter', system-ui, sans-serif", arabic: "'Scheherazade New', serif" },
  arabicSizes: [76, 68, 60, 52], // tried in turn until the ayah fits
};
var SHARE_CARD_LOGO = './assets/logo/bayan-icon-emblem-square.png';
var SHARE_CARD_FILE = 'bayan-progress.png';

/** The words % the card shows (the track's high-water mark, as Home shows it). */
function _sharePercent() {
  return typeof refreshWordMeaningsPercent === 'function' ? refreshWordMeaningsPercent().percent : 0;
}

/**
 * "Share my progress" button, or '' while there is nothing to share (0%).
 * Any click on it, anywhere, shares the card.
 */
function shareProgressButtonMarkup(extraClass) {
  if (!canShareProgress(_sharePercent())) return '';
  return '<button type="button" class="btn btn-outline share-progress-btn' + (extraClass ? ' ' + extraClass : '') +
    '" data-share-progress>' + iconText('share', t('share.button')) + '</button>';
}

/** Split `text` into lines no wider than `width`, by words. */
function shareWrapLines(ctx, text, width) {
  var lines = [], line = '';
  String(text).split(/\s+/).filter(Boolean).forEach(function (word) {
    var next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

function _shareFont(weight, size, family) {
  return weight + ' ' + size + 'px ' + family;
}

/** Draw `lines` centred from `y`; returns the y below them. */
function _shareDrawLines(ctx, lines, y, lineHeight) {
  lines.forEach(function (line, i) { ctx.fillText(line, SHARE_CARD.width / 2, y + i * lineHeight); });
  return y + lines.length * lineHeight;
}

/**
 * The ayah block, its Arabic shrunk until the block fits `room` (from the
 * top of the block to the source line's baseline). Null when it fits at no
 * size: the card then goes without an ayah rather than run off the edge.
 */
function _shareAyahLayout(ctx, ayah, room) {
  var width = SHARE_CARD.width - SHARE_CARD.margin * 2;
  var F = SHARE_CARD.fonts, found = null;
  SHARE_CARD.arabicSizes.some(function (size) {
    ctx.font = _shareFont(400, size, F.arabic);
    var arabic = shareWrapLines(ctx, ayah.arabic, width);
    var transSize = Math.round(size * 0.47);
    ctx.font = _shareFont('italic 400', transSize, F.serif);
    var translation = shareWrapLines(ctx, ayah.translation, width);
    var layout = { size: size, arabic: arabic, transSize: transSize, translation: translation };
    layout.height = _shareAyahHeight(layout);
    if (layout.height > room) return false;
    found = layout;
    return true;
  });
  return found;
}

/** From the block's top to the source line's baseline: the steps _shareDrawAyah takes. */
function _shareAyahHeight(l) {
  return 70 + l.size * 0.9 + (l.arabic.length - 1) * l.size * 1.75 + l.size * 0.7 + l.transSize * 1.2 +
    l.translation.length * l.transSize * 1.45 + 24;
}

/** Intro, Arabic (right-to-left), translation and source, from `y` down. */
function _shareDrawAyah(ctx, ayah, l, y) {
  var C = SHARE_CARD.colors, F = SHARE_CARD.fonts, W = SHARE_CARD.width;
  ctx.fillStyle = C.frame;
  ctx.fillRect(W / 2 - 60, y - 40, 120, 2);
  ctx.fillStyle = C.muted;
  ctx.font = _shareFont(400, 30, F.body);
  _shareDrawLines(ctx, [ayah.intro], y + 30, 40);
  ctx.fillStyle = C.text;
  ctx.direction = 'rtl';
  ctx.font = _shareFont(400, l.size, F.arabic);
  var lastArabic = _shareDrawLines(ctx, l.arabic, y + 70 + l.size * 0.9, l.size * 1.75) - l.size * 1.75;
  ctx.direction = 'ltr';
  ctx.font = _shareFont('italic 400', l.transSize, F.serif);
  var below = _shareDrawLines(ctx, l.translation, lastArabic + l.size * 0.7 + l.transSize * 1.2, l.transSize * 1.45);
  ctx.fillStyle = C.muted;
  ctx.font = _shareFont(400, 26, F.body);
  _shareDrawLines(ctx, [ayah.source], below + 24, 36);
}

/** Paint the card for `content` (shareCardContent) onto a canvas 2D context. */
function drawShareCard(ctx, content, logo) {
  var W = SHARE_CARD.width, H = SHARE_CARD.height, M = SHARE_CARD.margin;
  var C = SHARE_CARD.colors, F = SHARE_CARD.fonts;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(M / 2, M / 2, W - M, H - M);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  var top = M + SHARE_CARD.logoSize;
  if (logo) ctx.drawImage(logo, (W - SHARE_CARD.logoSize) / 2, M, SHARE_CARD.logoSize, SHARE_CARD.logoSize);

  // With an ayah: the % and the ayah below it, centred together between the
  // logo and a clear gap above the footer. Without: the % sits mid-card.
  // The ayah block starts AYAH_OFFSET below the %'s baseline.
  var AYAH_OFFSET = 212, FOOTER_GAP = 50, room = H - M - FOOTER_GAP - (top + 230 + AYAH_OFFSET);
  var ayah = content.ayah ? _shareAyahLayout(ctx, content.ayah, room) : null;
  var y = ayah ? top + 230 + Math.round((room - ayah.height) / 2) : H / 2 + 40;

  ctx.fillStyle = C.gold;
  ctx.font = _shareFont(600, 190, F.serif);
  ctx.fillText(content.percent, W / 2, y);
  ctx.fillStyle = C.text;
  ctx.font = _shareFont(400, 44, F.body);
  _shareDrawLines(ctx, [content.claim], y + 86, 56);
  if (ayah) _shareDrawAyah(ctx, content.ayah, ayah, y + AYAH_OFFSET);

  ctx.fillStyle = C.gold;
  ctx.font = _shareFont(500, 34, F.body);
  ctx.fillText(content.footer, W / 2, H - M);
}

/** The card's content: today's % and, if there is one, an ayah fully known. */
function _shareCollect() {
  var percent = _sharePercent();
  return loadAyahReadability().then(function (index) {
    var ref = index ? pickShareAyah(index, loadSRS()) : null;
    if (!ref) return shareCardContent(percent, null, '');
    var p = ref.split(':').map(Number);
    return loadQuranSurah(p[0]).then(function () {
      var verse = getQuranVerse(p[0], p[1]);
      return shareCardContent(percent, verse ? { ref: ref, verse: verse } : null, _dailySurahName(p[0]));
    });
  }).then(function (content) { return { percent: percent, content: content }; });
}

function _shareLoadLogo() {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { resolve(null); };
    img.src = SHARE_CARD_LOGO;
  });
}

/** Wait for the card's fonts; a font that fails falls back, it never blocks. */
function _shareLoadFonts(content) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  var F = SHARE_CARD.fonts;
  var specs = [_shareFont(600, 190, F.serif), _shareFont('italic 400', 36, F.serif), _shareFont(400, 44, F.body), _shareFont(500, 34, F.body)];
  var loads = specs.map(function (spec) { return document.fonts.load(spec); });
  if (content.ayah) loads.push(document.fonts.load(_shareFont(400, 76, F.arabic), content.ayah.arabic));
  return Promise.all(loads).catch(function () {});
}

/** Draw the card; resolves a PNG Blob. */
function renderShareCardBlob(content) {
  return Promise.all([_shareLoadLogo(), _shareLoadFonts(content)]).then(function (got) {
    var canvas = document.createElement('canvas');
    canvas.width = SHARE_CARD.width;
    canvas.height = SHARE_CARD.height;
    drawShareCard(canvas.getContext('2d'), content, got[0]);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('toBlob failed')); }, 'image/png');
    });
  });
}

function _shareDownload(blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = SHARE_CARD_FILE;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  if (typeof showToast === 'function') showToast(t('share.saved'), 'success');
}

/** Make the card and open the share sheet (or download it). */
function shareProgress() {
  return _shareCollect().then(function (got) {
    return renderShareCardBlob(got.content).then(function (blob) {
      var file = new File([blob], SHARE_CARD_FILE, { type: 'image/png' });
      var data = { files: [file], title: t('share.title'), text: shareProgressMessage(got.percent, new URL('./', location.href).href) };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share(data).catch(function (err) {
          if (!err || err.name !== 'AbortError') _shareDownload(blob); // closing the sheet is not a failure
        });
      }
      _shareDownload(blob);
    });
  }).catch(function (err) {
    if (typeof showToast === 'function') showToast(t('share.failed'), 'error');
    if (window.__diag) window.__diag.warn('Share', 'card', String(err && err.message || err));
  });
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-share-progress]') : null;
    if (btn) shareProgress();
  });
}
