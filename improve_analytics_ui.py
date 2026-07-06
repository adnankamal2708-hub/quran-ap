# -*- coding: utf-8 -*-
import sys
import io

# Force UTF-8 for stdout to avoid Windows cp1252 issues
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import re

with open('js/ui.js', 'r', encoding='utf-8') as f:
    ui = f.read()

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

changes = []

# Replace vocabulary growth chart
old_vocab = '''    // Vocabulary Growth Chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">\U0001F4C8 Vocabulary Growth</div>';
    var vocab = trends.mastered;
    if (vocab && vocab.length > 0) {
      var maxVocab = Math.max.apply(null, vocab) || 1;
      for (var vi = 0; vi < vocab.length; vi++) {
        var pct = Math.round((vocab[vi] / maxVocab) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels[vi] || '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + pct + '%;background:var(--gold)"></div></div>';
        html += '<span class="analytics-bar-value">' + vocab[vi] + '</span>';
        html += '</div>';
      }
    }'''

new_vocab = '''    // Vocabulary Growth Chart (animated SVG)
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">\U0001F4C8 Vocabulary Growth</div>';
    var vocab = trends.mastered;
    if (vocab && vocab.length > 0) {
      var maxVocab = Math.max.apply(null, vocab) || 1;
      var sw = Math.max(vocab.length * 40, 200);
      var sh = 160;
      html += '<div class="analytics-svg-chart-wrap">';
      html += '<svg class="analytics-svg-chart" viewBox="0 0 ' + sw + ' ' + (sh + 30) + '" preserveAspectRatio="none">';
      html += '<line x1="0" y1="' + sh + '" x2="' + sw + '" y2="' + sh + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh * 0.75) + '" x2="' + sw + '" y2="' + Math.round(sh * 0.75) + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh * 0.5) + '" x2="' + sw + '" y2="' + Math.round(sh * 0.5) + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh * 0.25) + '" x2="' + sw + '" y2="' + Math.round(sh * 0.25) + '" class="analytics-chart-gridline" />';
      html += '<defs><linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFD700" /><stop offset="100%" stop-color="#DAA520" /></linearGradient></defs>';
      var bw = Math.max(12, Math.min(30, Math.round(sw / vocab.length) - 4));
      var bs = Math.round(sw / vocab.length);
      for (var vi = 0; vi < vocab.length; vi++) {
        var bh = Math.round((vocab[vi] / maxVocab) * sh);
        var bx = vi * bs + Math.round((bs - bw) / 2);
        html += '<rect class="analytics-svg-bar" x="' + bx + '" y="' + sh + '" width="' + bw + '" height="0" data-target-y="' + (sh - bh) + '" data-target-h="' + bh + '" rx="2" fill="url(#goldGrad)">';
        html += '<title>' + (trends.labels[vi] || '') + ': ' + vocab[vi] + '</title>';
        html += '</rect>';
      }
      html += '</svg>';
      html += '<div class="analytics-chart-labels">';
      for (var vli = 0; vli < vocab.length; vli++) {
        html += '<span class="analytics-chart-label">' + (trends.labels[vli] || '') + '</span>';
      }
      html += '</div></div>';
    }'''

if old_vocab in ui:
    ui = ui.replace(old_vocab, new_vocab, 1)
    changes.append('vocabulary chart -> animated SVG')
else:
    changes.append('vocabulary chart pattern MISSING')

# Replace coverage chart
old_cov = '''    // Quran Coverage Growth Chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">\U0001F4D6 Quran Coverage Growth</div>';
    var coverage = trends.coverage;
    if (coverage && coverage.length > 0) {
      var maxCoverage = 100;
      for (var ci = 0; ci < coverage.length; ci++) {
        var pct = Math.round((coverage[ci] / maxCoverage) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels[ci] || '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + pct + '%;background:var(--green)"></div></div>';
        html += '<span class="analytics-bar-value">' + coverage[ci] + '%</span>';
        html += '</div>';
      }
    }'''

new_cov = '''    // Quran Coverage Growth Chart (animated SVG + trend line)
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">\U0001F4D6 Quran Coverage Growth</div>';
    var coverage = trends.coverage;
    if (coverage && coverage.length > 0) {
      var maxCoverage = 100;
      var sw2 = Math.max(coverage.length * 40, 200);
      var sh2 = 160;
      html += '<div class="analytics-svg-chart-wrap">';
      html += '<svg class="analytics-svg-chart" viewBox="0 0 ' + sw2 + ' ' + (sh2 + 30) + '" preserveAspectRatio="none">';
      html += '<line x1="0" y1="' + sh2 + '" x2="' + sw2 + '" y2="' + sh2 + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh2 * 0.75) + '" x2="' + sw2 + '" y2="' + Math.round(sh2 * 0.75) + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh2 * 0.5) + '" x2="' + sw2 + '" y2="' + Math.round(sh2 * 0.5) + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh2 * 0.25) + '" x2="' + sw2 + '" y2="' + Math.round(sh2 * 0.25) + '" class="analytics-chart-gridline" />';
      html += '<defs><linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4CAF50" /><stop offset="100%" stop-color="#2E7D32" /></linearGradient></defs>';
      var bw2 = Math.max(12, Math.min(30, Math.round(sw2 / coverage.length) - 4));
      var bs2 = Math.round(sw2 / coverage.length);
      var points = [];
      for (var ci = 0; ci < coverage.length; ci++) {
        var cx = ci * bs2 + bs2 / 2;
        var cy = sh2 - Math.round((coverage[ci] / maxCoverage) * sh2);
        points.push(cx + ',' + cy);
        var bh2 = Math.round((coverage[ci] / maxCoverage) * sh2);
        var bx2 = ci * bs2 + Math.round((bs2 - bw2) / 2);
        html += '<rect class="analytics-svg-bar" x="' + bx2 + '" y="' + sh2 + '" width="' + bw2 + '" height="0" data-target-y="' + (sh2 - bh2) + '" data-target-h="' + bh2 + '" rx="2" fill="url(#greenGrad)" opacity="0.6">';
        html += '<title>' + (trends.labels[ci] || '') + ': ' + coverage[ci] + '%</title>';
        html += '</rect>';
      }
      if (points.length > 1) {
        html += '<polyline class="analytics-chart-line" points="' + points.join(' ') + '" fill="none" stroke="var(--green)" stroke-width="2" stroke-linejoin="round" />';
        var lastP = points[points.length - 1].split(',');
        html += '<circle class="analytics-chart-dot" cx="' + lastP[0] + '" cy="' + lastP[1] + '" r="3" fill="var(--green)" />';
      }
      html += '</svg>';
      html += '<div class="analytics-chart-labels">';
      for (var cli = 0; cli < coverage.length; cli++) {
        html += '<span class="analytics-chart-label">' + (trends.labels[cli] || '') + '</span>';
      }
      html += '</div></div>';
    }'''

if old_cov in ui:
    ui = ui.replace(old_cov, new_cov, 1)
    changes.append('coverage chart -> animated SVG + trend line')
else:
    changes.append('coverage chart pattern MISSING')

# Replace reviews chart
old_rev = '''    // Daily Reviews Chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">\U0001F517 Daily Reviews</div>';
    var reviews = trends.reviews;
    if (reviews && reviews.length > 0) {
      var maxReviews = Math.max.apply(null, reviews) || 1;
      for (var ri = 0; ri < reviews.length; ri++) {
        var pct = Math.round((reviews[ri] / maxReviews) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels[ri] || '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + pct + '%;background:var(--purple)"></div></div>';
        html += '<span class="analytics-bar-value">' + reviews[ri] + '</span>';
        html += '</div>';
      }
    }'''

new_rev = '''    // Daily Reviews Chart (animated SVG)
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">\U0001F517 Daily Reviews</div>';
    var reviews = trends.reviews;
    if (reviews && reviews.length > 0) {
      var maxReviews = Math.max.apply(null, reviews) || 1;
      var sw3 = Math.max(reviews.length * 40, 200);
      var sh3 = 160;
      html += '<div class="analytics-svg-chart-wrap">';
      html += '<svg class="analytics-svg-chart" viewBox="0 0 ' + sw3 + ' ' + (sh3 + 30) + '" preserveAspectRatio="none">';
      html += '<line x1="0" y1="' + sh3 + '" x2="' + sw3 + '" y2="' + sh3 + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh3 * 0.75) + '" x2="' + sw3 + '" y2="' + Math.round(sh3 * 0.75) + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh3 * 0.5) + '" x2="' + sw3 + '" y2="' + Math.round(sh3 * 0.5) + '" class="analytics-chart-gridline" />';
      html += '<line x1="0" y1="' + Math.round(sh3 * 0.25) + '" x2="' + sw3 + '" y2="' + Math.round(sh3 * 0.25) + '" class="analytics-chart-gridline" />';
      html += '<defs><linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#AB47BC" /><stop offset="100%" stop-color="#7B1FA2" /></linearGradient></defs>';
      var bw3 = Math.max(12, Math.min(30, Math.round(sw3 / reviews.length) - 4));
      var bs3 = Math.round(sw3 / reviews.length);
      for (var ri = 0; ri < reviews.length; ri++) {
        var bh3 = Math.round((reviews[ri] / maxReviews) * sh3);
        var bx3 = ri * bs3 + Math.round((bs3 - bw3) / 2);
        html += '<rect class="analytics-svg-bar" x="' + bx3 + '" y="' + sh3 + '" width="' + bw3 + '" height="0" data-target-y="' + (sh3 - bh3) + '" data-target-h="' + bh3 + '" rx="2" fill="url(#purpleGrad)">';
        html += '<title>' + (trends.labels[ri] || '') + ': ' + reviews[ri] + ' reviews</title>';
        html += '</rect>';
      }
      html += '</svg>';
      html += '<div class="analytics-chart-labels">';
      for (var rli = 0; rli < reviews.length; rli++) {
        html += '<span class="analytics-chart-label">' + (trends.labels[rli] || '') + '</span>';
      }
      html += '</div></div>';
    }'''

if old_rev in ui:
    ui = ui.replace(old_rev, new_rev, 1)
    changes.append('reviews chart -> animated SVG')
else:
    changes.append('reviews chart pattern MISSING')

# Write updated ui.js
with open('js/ui.js', 'w', encoding='utf-8') as f:
    f.write(ui)

# Add CSS animations
anim_css = '''
/* Analytics - Animated SVG Chart Styles */
.analytics-svg-chart-wrap {
  position: relative;
  padding: 8px 0;
}
.analytics-svg-chart {
  width: 100%;
  height: 190px;
  overflow: visible;
}
.analytics-svg-bar {
  transition: y 0.8s cubic-bezier(0.4, 0, 0.2, 1), height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  animation: barFadeIn 0.8s ease-out forwards;
}
.analytics-chart-gridline {
  stroke: var(--border);
  stroke-width: 0.5;
  stroke-dasharray: 3,3;
  opacity: 0.5;
}
.analytics-chart-labels {
  display: flex;
  justify-content: space-around;
  padding: 2px 0;
  margin-top: -8px;
}
.analytics-chart-label {
  font-size: 8px;
  color: var(--text-muted);
  text-align: center;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.analytics-chart-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawLine 1.5s ease-out 0.3s forwards;
}
.analytics-chart-dot {
  opacity: 0;
  animation: fadeIn 0.3s ease-out 1.5s forwards;
}
@keyframes barFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
.analytics-section {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-section.visible {
  opacity: 1;
  transform: translateY(0);
}
.analytics-stat-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}
.analytics-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow-gold);
}
.analytics-progress-fill-big,
.analytics-path-fill {
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-ach-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-ach-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.analytics-trend-tab {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-trend-tab:hover {
  opacity: 0.8;
}
.analytics-forecast-item {
  animation: fadeInScale 0.3s ease-out both;
}
.analytics-forecast-item:nth-child(1) { animation-delay: 0s; }
.analytics-forecast-item:nth-child(2) { animation-delay: 0.1s; }
.analytics-forecast-item:nth-child(3) { animation-delay: 0.2s; }
@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.analytics-period-card {
  animation: fadeInUp 0.4s ease-out both;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.analytics-coverage-ring .goal-ring-fill {
  transition: stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-achievement-fill,
.analytics-ach-fill-big {
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-bar-fill {
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.analytics-svg-bar:hover {
  filter: brightness(1.2);
  cursor: pointer;
}
'''

with open('styles.css', 'a', encoding='utf-8') as f:
    f.write('\n' + anim_css)
changes.append('CSS animations added')

print('Changes applied:')
for c in changes:
    print('  ' + c)
print('Done!')
