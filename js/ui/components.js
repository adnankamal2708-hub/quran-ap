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
