// ═══════════════════════════════════════════════════════════════
// components.js — Reusable UI Component Helpers
// Bayan Unified Design System
// ═══════════════════════════════════════════════════════════════

/**
 * Create a styled button element.
 * @param {string} label - Button text
 * @param {string} [variant='primary'] - primary|secondary|ghost|danger
 * @param {Object} [opts] - { className, id, disabled, ariaLabel, onClick }
 * @returns {HTMLButtonElement}
 */
function createBtn(label, variant, opts) {
  variant = variant || 'primary';
  opts = opts || {};
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  var classMap = {
    primary: 'btn',
    secondary: 'btn btn-outline',
    danger: 'btn btn-outline account-action-danger',
    ghost: 'btn account-action-danger',
  };
  btn.className = classMap[variant] || 'btn';
  if (opts.className) btn.className += ' ' + opts.className;
  if (opts.id) btn.id = opts.id;
  if (opts.disabled) btn.disabled = true;
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel);
  if (opts.onClick) btn.onclick = opts.onClick;
  btn.style.minHeight = '44px';
  btn.style.minWidth = '44px';
  return btn;
}

/**
 * Create an empty state block with icon, title, message, and optional action.
 * @param {Object} opts - { icon, iconSvg, title, message, actionLabel, actionOnClick }
 * @returns {HTMLElement}
 */
function createEmptyState(opts) {
  opts = opts || {};
  var el = document.createElement('div');
  el.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px;line-height:1.6';
  el.setAttribute('aria-live', 'polite');
  var html = '';
  if (opts.iconSvg) {
    html += '<div style="font-size:48px;margin-bottom:16px;line-height:1;opacity:0.4" aria-hidden="true">' + opts.iconSvg + '</div>';
  } else if (opts.icon) {
    html += '<div style="font-size:48px;margin-bottom:16px;line-height:1;opacity:0.7" aria-hidden="true">' + opts.icon + '</div>';
  }
  if (opts.title) html += '<div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">' + opts.title + '</div>';
  if (opts.message) html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;line-height:1.5;max-width:320px;margin-left:auto;margin-right:auto">' + opts.message + '</div>';
  el.innerHTML = '';
  el.insertAdjacentHTML('beforeend', html);
  if (opts.actionLabel && opts.actionOnClick) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.textContent = opts.actionLabel;
    btn.onclick = opts.actionOnClick;
    btn.style.minHeight = '44px';
    el.appendChild(btn);
  }
  return el;
}

/**
 * Create a progress bar element.
 * @param {number} percent - 0-100
 * @param {Object} [opts] - { height, color, showLabel }
 * @returns {HTMLElement}
 */
function createProgressBar(percent, opts) {
  opts = opts || {};
  var pct = Math.min(100, Math.max(0, percent || 0));
  var wrap = document.createElement('div');
  wrap.className = 'db-progress';
  var track = document.createElement('div');
  track.className = 'db-progress-track';
  track.style.height = (opts.height || 6) + 'px';
  var fill = document.createElement('div');
  fill.className = 'db-progress-fill';
  fill.style.width = pct + '%';
  if (opts.color) fill.style.background = opts.color;
  track.appendChild(fill);
  wrap.appendChild(track);
  if (opts.showLabel) {
    var lbl = document.createElement('span');
    lbl.className = 'db-progress-text';
    lbl.textContent = pct + '%';
    wrap.appendChild(lbl);
  }
  return wrap;
}

/**
 * Return an SVG icon markup string.
 * @param {string} name - Icon name: book|star|check|target|trend|chart|bolt|brain|clock|calendar|crown|fire|bookmark|empty-box|list|scroll|heart|search|play|settings|user|award|layers
 * @param {Object} [opts] - { size, className }
 * @returns {string} SVG markup
 */
function createSVGIcon(name, opts) {
  opts = opts || {};
  var size = opts.size || 20;
  var cls = opts.className || '';
  var svgAttrs = 'viewBox="0 0 24 24" width="' + size + '" height="' + size + '" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  if (cls) svgAttrs += ' class="' + cls + '"';
  var paths = {
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    fire: '<path d="M12 2C8 6 4 10 4 14c0 4.418 3.582 8 8 8s8-3.582 8-8c0-4-4-8-8-12z"/>',
    brain: '<path d="M12 2a7 7 0 0 0-7 7c0 2.1 1 4 2.5 5.2V19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-1m3-1a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3.8C20 13 21 11.1 21 9a7 7 0 0 0-7-7z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    crown: '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M2 20h20"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    'empty-box': '<rect x="2" y="2" width="20" height="20" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    scroll: '<path d="M4 4h16v4H4z"/><path d="M4 10h12"/><path d="M4 14h8"/><path d="M4 18h16"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    repeat: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    'upload-cloud': '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/>',
    'download-cloud': '<polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    'zap-off': '<polyline points="12.41 6.75 13 2 10.57 4.92"/><polyline points="18.57 12.91 21 10 15.66 10"/><polyline points="8 8 3 14 12 14 11 22 16 16"/><line x1="1" y1="1" x2="23" y2="23"/>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'thumbs-up': '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    'circle': '<circle cx="12" cy="12" r="10"/>',
    'star-fill': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    celebration: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/><line x1="3" y1="20" x2="21" y2="4"/>',
    'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    'volume-2': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  };
  return '<svg ' + svgAttrs + '>' + (paths[name] || paths.book) + '</svg>';
}

/**
 * Create a stat tile (value + label).
 * @param {string|number} value - The stat value
 * @param {string} label - The stat label
 * @param {Object} [opts] - { onClick, color }
 * @returns {HTMLElement}
 */
function createStatTile(value, label, opts) {
  opts = opts || {};
  var tile = document.createElement('div');
  tile.className = 'profile-stat';
  if (opts.color) tile.style.setProperty('--stat-color', opts.color);
  if (opts.onClick) {
    tile.style.cursor = 'pointer';
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.onclick = opts.onClick;
    tile.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (opts.onClick) opts.onClick();
      }
    };
  }
  tile.innerHTML = '<div class="profile-stat-value">' + value + '</div><div class="profile-stat-label">' + label + '</div>';
  return tile;
}

/**
 * Create a badge/pill element.
 * @param {string} text - Badge text
 * @param {string} [variant='default'] - default|success|warning|danger|info|gold
 * @returns {HTMLElement}
 */
function createBadge(text, variant) {
  var badge = document.createElement('span');
  variant = variant || 'default';
  var colors = {
    default: 'var(--text-muted)',
    success: 'var(--green)',
    warning: 'var(--gold)',
    danger: 'var(--red)',
    info: 'var(--blue)',
    gold: 'var(--gold)',
  };
  badge.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:' + (colors[variant] || colors.default) + '22;color:' + (colors[variant] || colors.default) + ';line-height:1.4';
  badge.textContent = text;
  return badge;
}

/**
 * Create a section header with title and optional action.
 * @param {string} title - Section title
 * @param {Object} [opts] - { actionLabel, actionOnClick, subtitle }
 * @returns {HTMLElement}
 */
function createSectionHeader(title, opts) {
  opts = opts || {};
  var el = document.createElement('div');
  el.className = 'section-header';
  var html = '<h3 class="section-title">' + title + '</h3>';
  if (opts.subtitle) html += '<p class="section-subtitle">' + opts.subtitle + '</p>';
  el.innerHTML = html;
  if (opts.actionLabel && opts.actionOnClick) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-sm section-action';
    btn.textContent = opts.actionLabel;
    btn.onclick = opts.actionOnClick;
    btn.style.minHeight = '44px';
    el.appendChild(btn);
  }
  return el;
}

// Export to global
window.__components = {
  createBtn: createBtn,
  createEmptyState: createEmptyState,
  createProgressBar: createProgressBar,
  createSVGIcon: createSVGIcon,
  createStatTile: createStatTile,
  createBadge: createBadge,
  createSectionHeader: createSectionHeader,
};
