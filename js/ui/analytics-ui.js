function renderExplorerAllOccurrences(listEl, w) {
  if (!listEl || !w || !w.occurrences || w.occurrences.length === 0) {
    listEl.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px">No occurrence data available.</div>';
    return;
  }
  
  var html = '<div class="explorer-all-occ-inner">';
  for (var oi = 0; oi < w.occurrences.length; oi++) {
    var occ = w.occurrences[oi];
    var surahName = '';
    if (occ.surahId && SURAH_INFO && SURAH_INFO[occ.surahId]) {
      surahName = SURAH_INFO[occ.surahId].name;
    }
    var ref = occ.ayahR || occ.verseKey || '';
    var ayahText = occ.ayahA || '';
    // Highlight the word in the ayah text
    if (ayahText && w.arabic) {
      ayahText = ayahText.replace(
        new RegExp(w.arabic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        '<span class="explorer-ayah-highlight">' + w.arabic + '</span>'
      );
    }
    html += '<div class="explorer-occ-item">' +
      '<div class="explorer-occ-ref">' + (surahName ? surahName + ' ' : '') + ref + '</div>' +
      '<div class="explorer-occ-ayah" lang="ar" dir="rtl">' + ayahText + '</div>' +
      '<div class="explorer-occ-trans">' + (occ.ayahT || '') + '</div>' +
    '</div>';
  }
  html += '</div>';
  listEl.innerHTML = html;
}

// Export explorer for cross-module access

// ═══════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD — Comprehensive Learning Analytics
// ═══════════════════════════════════════════════════════════════

/**
 * Render the full Analytics Dashboard.
 * Called by switchView('analytics').
 * Displays: overview, trends, insights, achievements tabs
 */
function renderAnalytics() {
  try {

  var analytics = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
  if (!analytics) {
    DOM.get('analytics-content').innerHTML = '<div class="analytics-empty">Start learning to see your analytics!</div>';
    return;
  }
  
  var activeTab = document.querySelector('.analytics-tab-active');
  var tabName = activeTab ? activeTab.getAttribute('data-analytics-tab') : 'overview';
  renderAnalyticsTab(tabName, analytics);
  
  // Wire tab switching
  var tabs = document.querySelectorAll('.analytics-tab');
  for (var ti = 0; ti < tabs.length; ti++) {
    (function(tab) {
      tab.onclick = function() {
        document.querySelectorAll('.analytics-tab').forEach(function(t) {
          t.classList.remove('analytics-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('analytics-tab-active');
        tab.setAttribute('aria-selected', 'true');
        renderAnalyticsTab(tab.getAttribute('data-analytics-tab'), analytics);
      };
    })(tabs[ti]);
  }

  } catch (e) {
    console.error('[analytics] renderAnalytics error:', e);
    var container = document.getElementById('analytics-content');
    if (container) container.innerHTML = '<div class="analytics-empty">\u26A0\uFE0F Something went wrong loading analytics. <button class="btn btn-sm mt-10" onclick="window.location.reload()">Reload</button></div>';
  }
}

function renderAnalyticsTab(tabName, analytics) {
  try {

  var container = DOM.get('analytics-content');
  if (!container) return;
  
  var html = '';
  
  switch (tabName) {
    case 'overview':
      html = renderAnalyticsOverview(analytics);
      break;
    case 'trends':
      html = renderAnalyticsTrends(analytics);
      break;
    case 'insights':
      html = renderAnalyticsInsightsPage(analytics);
      break;
    case 'achievements':
      html = renderAnalyticsAchievements();
      break;
  }
  
  container.innerHTML = html;
  
  // Wire trend period tabs (only when trends tab is active)
  var trendTabs = container.querySelectorAll('.analytics-trend-tab');
  for (var tti = 0; tti < trendTabs.length; tti++) {
    (function(tt) {
      tt.onclick = function() {
        var parentTabs = tt.closest('.analytics-trend-tabs');
        if (parentTabs) {
          var siblings = parentTabs.querySelectorAll('.analytics-trend-tab');
          for (var si = 0; si < siblings.length; si++) {
            siblings[si].classList.remove('analytics-trend-active');
          }
        }
        tt.classList.add('analytics-trend-active');
        var insights = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
        if (insights) {
          renderAnalyticsTab('trends', insights);
        }
      };
    })(trendTabs[tti]);
  }
  
  // Wire "View All Achievements" button
  var viewAllAchBtn = container.querySelector('#analytics-view-all-ach');
  if (viewAllAchBtn) {
    viewAllAchBtn.onclick = function() {
      var achTab = document.querySelector('.analytics-tab[data-analytics-tab="achievements"]');
      if (achTab) {
        document.querySelectorAll('.analytics-tab').forEach(function(t) {
          t.classList.remove('analytics-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        achTab.classList.add('analytics-tab-active');
        achTab.setAttribute('aria-selected', 'true');
        var insights = (window.__analytics && window.__analytics.getComprehensiveInsights) ? window.__analytics.getComprehensiveInsights() : null;
        renderAnalyticsTab('achievements', insights);
      }
    };
  }

  } catch (e) {
    console.error('[analytics] renderAnalyticsTab error:', e);
    var container = document.getElementById('analytics-content');
    if (container) container.innerHTML = '<div class="analytics-empty">\u26A0\uFE0F Error loading ' + tabName + ' tab.</div>';
  }
}

// ── OVERVIEW TAB ──

function renderAnalyticsOverview(analytics) {
  try {
  var html = '';
  var profile = analytics.profile;
  var periods = analytics.periods;
  var forecasts = analytics.forecasts;
  
  // Coverage & Comprehension Card
  var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
  var fCompleted = (typeof getCompletedFoundationLessonCount === 'function') ? getCompletedFoundationLessonCount() : 0;
  var fTotal = (typeof getFoundationLessonCount === 'function') ? getFoundationLessonCount() : 0;
  var coveragePct = coverage ? coverage.coveragePercent : 0;
  var compPct = coverage ? coverage.estimatedComprehension : 0;
  
  // Foundation Ring
  var foundationPct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📊 Progress Overview</div>';
  html += '<div class="analytics-stats-grid">';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.masteredWords : 0) + '</div><div class="analytics-stat-label">Mastered</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.studiedWords : 0) + '</div><div class="analytics-stat-label">Studied</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.adaptiveDifficulty : 1) + '</div><div class="analytics-stat-label">Level</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + coveragePct + '%</div><div class="analytics-stat-label">Quran Coverage</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + compPct + '%</div><div class="analytics-stat-label">Comprehension</div></div>';
  html += '<div class="analytics-stat-card"><div class="analytics-stat-value">' + (profile ? profile.quizAccuracy || '-' : '-') + '</div><div class="analytics-stat-label">Quiz Accuracy</div></div>';
  html += '</div></div>';
  
  // Foundation Progress
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📘 Foundation Course</div>';
  html += '<div class="analytics-progress-block">';
  html += '<div class="analytics-progress-track-big"><div class="analytics-progress-fill-big" style="width:' + foundationPct + '%"></div></div>';
  html += '<div class="analytics-progress-info">';
  html += '<span class="analytics-progress-pct">' + foundationPct + '%</span>';
  html += '<span class="analytics-progress-detail">' + fCompleted + ' of ' + fTotal + ' lessons</span>';
  html += '</div></div></div>';
  
  // Quran Reading Coverage Ring
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📖 Quran Reading Coverage</div>';
  html += '<div class="analytics-coverage-card">';
  html += '<div class="analytics-coverage-ring-wrap">';
  html += '<svg class="analytics-coverage-ring" viewBox="0 0 36 36">';
  html += '<path class="goal-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />';
  var covOffset = Math.round((coveragePct / 100) * 100);
  html += '<path class="goal-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="' + covOffset + ', 100" style="stroke:var(--gold)" />';
  html += '<text class="goal-ring-text" x="18" y="20.5" style="fill:var(--gold);font-size:9px">' + coveragePct + '%</text>';
  html += '</svg></div>';
  html += '<div class="analytics-coverage-details">';
  if (coverage) {
    html += '<div class="analytics-cov-row"><span>Words Mastered</span><span>' + coverage.masteredWords + ' / ' + coverage.totalWords + '</span></div>';
    html += '<div class="analytics-cov-row"><span>Occurrences Recognized</span><span>' + coverage.masteredOccurrences.toLocaleString() + ' / ' + coverage.totalOccurrences.toLocaleString() + '</span></div>';
    html += '<div class="analytics-cov-row"><span>Estimated Comprehension</span><span>' + compPct + '%</span></div>';
  }
  html += '</div></div></div>';
  
  // Surah Comprehension
  var allSurahComp = (typeof getAllSurahComprehension === 'function') ? getAllSurahComprehension() : [];
  if (allSurahComp && allSurahComp.length > 0) {
    allSurahComp.sort(function(a,b) { return b.estimatedComprehension - a.estimatedComprehension; });
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📖 Surah Comprehension</div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    html += '<div style="flex:1;min-width:130px"><div style="font-size:10px;color:var(--green);margin-bottom:6px;font-weight:500">✅ Best understood</div>';
    var topCount = Math.min(3, allSurahComp.length);
    for (var sci = 0; sci < topCount; sci++) {
      var sc = allSurahComp[sci];
      var sInfo = (typeof getSurahInfo === 'function') ? getSurahInfo(sc.surahId) : null;
      html += '<div style="font-size:11px;color:var(--text);padding:4px 0;border-bottom:1px solid var(--border)">' + (sInfo ? sInfo.name : 'Surah ' + sc.surahId) + ' <span style="color:var(--gold-dim);float:right">' + sc.estimatedComprehension + '%</span></div>';
    }
    html += '</div>';
    allSurahComp.sort(function(a,b) { return a.estimatedComprehension - b.estimatedComprehension; });
    html += '<div style="flex:1;min-width:130px"><div style="font-size:10px;color:var(--red);margin-bottom:6px;font-weight:500">🌱 Needs work</div>';
    var bottomCount = Math.min(3, allSurahComp.length);
    for (var si = 0; si < bottomCount; si++) {
      var sc2 = allSurahComp[si];
      var sInfo2 = (typeof getSurahInfo === 'function') ? getSurahInfo(sc2.surahId) : null;
      html += '<div style="font-size:11px;color:var(--text);padding:4px 0;border-bottom:1px solid var(--border)">' + (sInfo2 ? sInfo2.name : 'Surah ' + sc2.surahId) + ' <span style="color:var(--gold-dim);float:right">' + sc2.estimatedComprehension + '%</span></div>';
    }
    html += '</div></div>';
   
  // Vocabulary Relationships
  var roots = (typeof getRootFamilyMastery === 'function') ? getRootFamilyMastery() : null;
  var relStats = (typeof getRelationshipStats === 'function') ? getRelationshipStats() : null;
  if (roots || relStats) {
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📚 Vocabulary Relationships</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">';
    if (roots) {
      var rootsPct = roots.totalRoots > 0 ? Math.round(roots.fullyMasteredRoots / roots.totalRoots * 100) : 0;
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--gold)">' + roots.fullyMasteredRoots + '<span style="font-size:12px;color:var(--text-muted);font-weight:400">/' + roots.totalRoots + '</span></div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">Root families mastered</div><div style="font-size:9px;color:var(--green);margin-top:2px">' + rootsPct + '%</div></div>';
    }
    if (relStats && relStats.totalWords > 0) {
      var derivedPct = Math.round(relStats.wordsWithDerivedForms / relStats.totalWords * 100);
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--blue)">' + relStats.wordsWithDerivedForms + '<span style="font-size:12px;color:var(--text-muted);font-weight:400">/' + relStats.totalWords + '</span></div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">Derived forms</div><div style="font-size:9px;color:var(--blue);margin-top:2px">' + derivedPct + '%</div></div>';
      var semanticPct = Math.round(relStats.wordsWithSemanticGroups / relStats.totalWords * 100);
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--purple)">' + relStats.wordsWithSemanticGroups + '<span style="font-size:12px;color:var(--text-muted);font-weight:400">/' + relStats.totalWords + '</span></div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">Semantic groups</div><div style="font-size:9px;color:var(--purple);margin-top:2px">' + semanticPct + '%</div></div>';
    }
    if (roots && roots.partiallyMasteredRoots > 0) {
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--gold-dim)">' + roots.partiallyMasteredRoots + '</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">In progress roots</div></div>';
    }
    html += '</div></div>';
  }

 var avgComp = 0;
    for (var ai = 0; ai < allSurahComp.length; ai++) avgComp += allSurahComp[ai].estimatedComprehension;
    avgComp = allSurahComp.length > 0 ? Math.round(avgComp / allSurahComp.length) : 0;
    html += '<div style="font-size:10px;color:var(--text-muted);margin-top:8px;text-align:center">Average: ' + avgComp + '% across ' + allSurahComp.length + ' surahs with vocabulary</div>';
    html += '</div>';
  } else {
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📖 Surah Comprehension</div>';
    html += '<div class="analytics-empty">Study words to see surah-level comprehension.</div></div>';
  }
  
  // Learning Paths Progress
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">🛤️ Learning Paths</div>';
  html += '<div class="analytics-progress-block">';
  var pathProgress = (typeof getLearningPathProgress === 'function') ? getLearningPathProgress() : null;
  if (pathProgress) {
    var pathKeys = ['foundation', 'surah', 'rootFamily', 'difficulty'];
    var pathNames = { foundation: 'Foundation Course', surah: 'By Surah', rootFamily: 'Root Families', difficulty: 'Difficulty' };
    var pathColors = { foundation: 'var(--gold)', surah: 'var(--green)', rootFamily: 'var(--purple)', difficulty: 'var(--blue)' };
    for (var pki = 0; pki < pathKeys.length; pki++) {
      var pk = pathKeys[pki];
      var pp = pathProgress[pk];
      if (!pp) continue;
      var pct = pp.percent || 0;
      html += '<div class="analytics-path-row">';
      html += '<div class="analytics-path-label">' + (pathNames[pk] || pk) + '</div>';
      html += '<div class="analytics-path-track"><div class="analytics-path-fill" style="width:' + pct + '%;background:' + (pathColors[pk] || 'var(--gold)') + '"></div></div>';
      html += '<div class="analytics-path-value">' + pct + '%</div>';
      html += '</div>';
    }
  }
  html += '</div></div>';
  
  // Period Summaries
  if (periods) {
    var periodKeys = [
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'allTime', label: 'All Time' },
    ];
    for (var psi = 0; psi < periodKeys.length; psi++) {
      var pInfo = periodKeys[psi];
      var data = periods[pInfo.key];
      if (!data) continue;
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">📅 ' + pInfo.label + '</div>';
      html += '<div class="analytics-period-card">';
      html += '<div class="analytics-period-grid">';
      html += '<div><span class="analytics-period-value">' + (data.gainMastered || 0) + '</span><span class="analytics-period-label">Gained</span></div>';
      html += '<div><span class="analytics-period-value">' + data.totalReviews + '</span><span class="analytics-period-label">Reviews</span></div>';
      html += '<div><span class="analytics-period-value">' + data.daysActive + '</span><span class="analytics-period-label">Active Days</span></div>';
      html += '<div><span class="analytics-period-value">' + (data.gainCoverage || '0') + '%</span><span class="analytics-period-label">Coverage +</span></div>';
      html += '</div></div></div>';
    }
    
    // Consistency
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">🔥 Learning Consistency</div>';
    html += '<div class="analytics-health-card">';
    html += '<div class="analytics-health-row"><span>Active Study Days</span><span>' + periods.consistency + '%</span></div>';
    html += '<div class="analytics-health-row"><span>Current Streak</span><span>' + (profile ? profile.streak || 0 : 0) + ' days</span></div>';
    html += '<div class="analytics-health-row"><span>Avg Reviews/Day</span><span>' + (periods.week ? periods.week.avgReviewsPerDay || 0 : 0) + '</span></div>';
    html += '</div></div>';
  }
  
    // Forecasts — Clean Grid Layout
  if (forecasts) {
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">🔮 Forecasts</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 10px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--gold);line-height:1.2">' + forecasts.predictedMastered['7'] + '</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">7 days</div><div style="font-size:9px;color:var(--text-muted)">reviews forecast</div></div>';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 10px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--gold);line-height:1.2">' + forecasts.predictedMastered['30'] + '</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">30 days</div><div style="font-size:9px;color:var(--text-muted)">reviews forecast</div></div>';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 10px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--gold);line-height:1.2">' + forecasts.predictedMastered['90'] + '</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px">90 days</div><div style="font-size:9px;color:var(--text-muted)">reviews forecast</div></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">Current pace</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + forecasts.masteryRatePerDay + ' <span style="font-size:10px;font-weight:400;color:var(--text-muted)">words/day</span></div></div>';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">Est. completion</div><div style="font-size:16px;font-weight:600;color:var(--text)">~' + (forecasts.daysToFoundationCompletion != null ? forecasts.daysToFoundationCompletion : (forecasts.daysToNextMilestone != null ? forecasts.daysToNextMilestone : '—')) + ' <span style="font-size:10px;font-weight:400;color:var(--text-muted)">days</span></div></div>';
    html += '</div>';
    var completionDate = forecasts.completionDate ? new Date(forecasts.completionDate) : null;
    if (completionDate && !isNaN(completionDate.getTime())) {
      var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      html += '<div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:8px;padding:6px;background:var(--surface2);border-radius:8px">🎯 Estimated all-vocabulary mastery: ' + monthNames[completionDate.getMonth()] + ' ' + completionDate.getFullYear() + '</div>';
    }
  html += '</div>';
  }

  // Review Forecast
  var srsData = (typeof loadSRS === 'function') ? loadSRS() : {};
  var now = Date.now();
  var dayMs = 24 * 60 * 60 * 1000;
  var dueTomorrow = 0, dueThisWeek = 0, dueThisMonth = 0;
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0) ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  for (var ri = 0; ri < allWords.length; ri++) {
    var entry = srsData[allWords[ri].id];
    if (entry && entry.dueDate) {
      if (entry.dueDate <= now + dayMs) dueTomorrow++;
      if (entry.dueDate <= now + 7 * dayMs) dueThisWeek++;
      if (entry.dueDate <= now + 30 * dayMs) dueThisMonth++;
    }
  }
  var dailyWorkload = dueThisWeek > 0 ? Math.ceil(dueThisWeek / 7) : 0;
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📅 Review Forecast</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
  html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--gold)">' + dueTomorrow + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:4px">Due tomorrow</div></div>';
  html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--gold)">' + dueThisWeek + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:4px">Due this week</div></div>';
  html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--gold)">' + dueThisMonth + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:4px">Due this month</div></div>';
  html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--blue)">' + dailyWorkload + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:4px">Daily workload</div></div>';
  html += '</div></div>';


// Achievements Summary
  if (analytics.achievements) {
    var earnedCount = analytics.achievements.earnedCount || 0;
    var totalCount = analytics.achievements.totalCount || 1;
    var achPct = Math.min(100, Math.round((earnedCount / totalCount) * 100));
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">🏆 Achievements</div>';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    html += '<span style="font-size:12px;color:var(--text)">' + earnedCount + ' / ' + totalCount + ' unlocked</span>';
    html += '<span style="font-size:10px;color:var(--gold)">' + achPct + '%</span>';
    html += '</div>';
    html += '<div class="analytics-progress-track-big" style="height:8px;margin-bottom:12px"><div class="analytics-progress-fill-big" style="width:' + achPct + '%;height:8px;border-radius:4px"></div></div>';
    html += '<div style="font-size:22px;font-weight:700;color:var(--gold);margin-bottom:4px">' + earnedCount + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">' + (earnedCount === 1 ? 'Achievement unlocked' : 'Achievements unlocked') + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);line-height:1.4;margin-bottom:12px">Keep learning to unlock more milestones.</div>';
    html += '<button id="analytics-view-all-ach" class="btn btn-sm" style="width:100%;padding:8px;border-radius:8px;font-size:11px">View All Achievements →</button>';
    html += '</div></div>';
  }

return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsOverview error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading Overview tab.</div>";
  }
}

// ── TRENDS TAB ──

function renderAnalyticsTrends(analytics) {
  try {
  var html = '';
  
  // Period selector
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">📈 Progress Trends</div>';
  html += '<div class="analytics-trend-periods">';
  html += '<div class="analytics-trend-tabs">';
  var trendPeriods = ['7days', '30days', '90days'];
  var trendLabels = ['7 Days', '30 Days', '90 Days'];
  for (var tpi = 0; tpi < trendPeriods.length; tpi++) {
    html += '<button class="analytics-trend-tab' + (tpi === 0 ? ' analytics-trend-active' : '') + '" data-trend-period="' + trendPeriods[tpi] + '" type="button">' + trendLabels[tpi] + '</button>';
  }
  html += '</div></div>';
  
  // Default to 7 days trend data
  var trends = (window.__analytics && window.__analytics.getTrends) ? window.__analytics.getTrends('7days') : null;
  
  if (trends) {
    // Summary stats
    html += '<div class="analytics-trend-summary">';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">+' + (trends.gainMastered || 0) + '</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Words Gained</span></div>';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">+' + (trends.gainCoverage || '0') + '%</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Coverage +</span></div>';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">' + trends.totalReviews + '</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Reviews</span></div>';
    html += '<div class="analytics-trend-stat"><span class="analytics-trend-value">' + trends.avgReviewsPerDay + '</span><span class="analytics-trend-stat-label" style="display:block;font-size:9px;color:var(--text-muted);margin-top:2px">Reviews/Day</span></div>';
    html += '</div>';
    
    // Mastered trend chart (bar chart)
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">📚 Vocabulary Growth</div>';
    var mastered = trends.mastered;
    if (mastered && mastered.length > 0) {
      var maxMastered = 1;
      for (var mi = 0; mi < mastered.length; mi++) {
        if (mastered[mi] > maxMastered) maxMastered = mastered[mi];
      }
      for (var mi = 0; mi < mastered.length; mi++) {
        var pct = Math.round((mastered[mi] / maxMastered) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels && trends.labels[mi] ? trends.labels[mi] : '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '<span class="analytics-bar-value">' + mastered[mi] + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center">Not enough data yet. Keep studying!</div>';
    }
    html += '</div>';
    
    // Coverage trend chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">📖 Quran Coverage Growth</div>';
    var coverage = trends.coverage;
    if (coverage && coverage.length > 0) {
      var maxCoverage = 100;
      for (var ci = 0; ci < coverage.length; ci++) {
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels && trends.labels[ci] ? trends.labels[ci] : '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + coverage[ci] + '%;background:linear-gradient(90deg,var(--green),var(--gold))"></div></div>';
        html += '<span class="analytics-bar-value">' + coverage[ci] + '%</span>';
        html += '</div>';
      }
    } else {
      html += '<div style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center">Not enough data yet. Keep studying!</div>';
    }
    html += '</div>';
    
    // Reviews per day chart
    html += '<div class="analytics-trend-chart">';
    html += '<div class="analytics-trend-chart-title">🔁 Daily Reviews</div>';
    var reviews = trends.reviews;
    if (reviews && reviews.length > 0) {
      var maxReviews = 1;
      for (var ri = 0; ri < reviews.length; ri++) {
        if (reviews[ri] > maxReviews) maxReviews = reviews[ri];
      }
      for (var ri = 0; ri < reviews.length; ri++) {
        var rpct = Math.round((reviews[ri] / maxReviews) * 100);
        html += '<div class="analytics-bar-row">';
        html += '<span class="analytics-bar-label">' + (trends.labels && trends.labels[ri] ? trends.labels[ri] : '') + '</span>';
        html += '<div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:' + rpct + '%;background:linear-gradient(90deg,var(--gold-dim),var(--gold))"></div></div>';
        html += '<span class="analytics-bar-value">' + reviews[ri] + '</span>';
        html += '</div>';
      }
    } else {
      html += '<div style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center">Not enough data yet. Keep studying!</div>';
    }
    html += '</div>';
    
  } else {
    html += '<div class="analytics-empty">Not enough data yet. Study for at least 2 days to see trends.</div>';
  }
  
  // Wire trend period switchers
  // Trend tabs wired in renderAnalyticsTab()
  
  return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsTrends error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading Trends tab.</div>";
  }
}

// ── INSIGHTS TAB ──

function renderAnalyticsInsightsPage(analytics) {
  try {
  var html = '';
  var profile = analytics.profile;
  
  if (profile) {
    // Strongest Roots
    if (profile.strongRoots && profile.strongRoots.length > 0) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">💪 Strongest Root Families</div>';
      html += '<div class="analytics-insight-list">';
      for (var sri = 0; sri < Math.min(profile.strongRoots.length, 8); sri++) {
        var sr = profile.strongRoots[sri];
        html += '<div class="analytics-insight-row">';
        html += '<span class="analytics-insight-label">' + sr.root + '</span>';
        html += '<span class="analytics-insight-sub">' + (sr.rootMeaning || '') + '</span>';
        html += '<span class="analytics-insight-value">' + sr.masteryScore + '%</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    
    // Weakest Roots
    if (profile.weakRoots && profile.weakRoots.length > 0) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">🌱 Weakest Root Families</div>';
      html += '<div class="analytics-insight-list">';
      for (var wri = 0; wri < Math.min(profile.weakRoots.length, 8); wri++) {
        var wr = profile.weakRoots[wri];
        html += '<div class="analytics-insight-row">';
        html += '<span class="analytics-insight-label" style="color:var(--red)">' + wr.root + '</span>';
        html += '<span class="analytics-insight-sub">' + (wr.rootMeaning || '') + '</span>';
        html += '<span class="analytics-insight-value" style="color:var(--red)">' + wr.masteryScore + '%</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    
    // Forgetting Curve Analysis
    if (profile) {
      html += '<div class="analytics-section">';
      html += '<div class="analytics-section-title">🧠 Memory Health</div>';
      html += '<div class="analytics-health-card">';
      var stages = profile.stageDistribution || { newCount: 0, learning: 0, young: 0, mature: 0 };
      html += '<div class="analytics-health-row"><span>🆕 New words</span><span>' + (stages.newCount || 0) + '</span></div>';
      html += '<div class="analytics-health-row"><span>🔁 Learning</span><span>' + (stages.learning || 0) + '</span></div>';
      html += '<div class="analytics-health-row"><span>🌱 Young</span><span>' + (stages.young || 0) + '</span></div>';
      html += '<div class="analytics-health-row"><span>💡 Mature</span><span>' + (stages.mature || 0) + '</span></div>';
      html += '<div class="analytics-health-row" style="color:var(--red)"><span>⏰ Critically Overdue</span><span>' + (profile.criticallyOverdue || 0) + '</span></div>';
      html += '</div></div>';
    }
    
    // Quiz Performance
    html += '<div class="analytics-section">';
    html += '<div class="analytics-section-title">📝 Quiz Performance</div>';
    html += '<div class="analytics-health-card">';
    var quizHistory = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
    var qTotal = quizHistory ? quizHistory.total : 0;
    var qCorrect = quizHistory ? quizHistory.correct : 0;
    var qAccuracy = qTotal > 0 ? Math.round((qCorrect / qTotal) * 100) : 0;
    html += '<div class="analytics-health-row"><span>Quiz Questions Answered</span><span>' + qTotal + '</span></div>';
    html += '<div class="analytics-health-row"><span>Correct Answers</span><span>' + qCorrect + '</span></div>';
    html += '<div class="analytics-health-row"><span>Overall Accuracy</span><span>' + qAccuracy + '%</span></div>';
    html += '</div></div>';
    
    // SRS Health
    var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
    if (srsStats) {
      html += '<div class="analytics-section-title">💖 SRS Health</div>';
    html += '<div class="analytics-health-card">';
    if (srsStats) {
      // Compute additional metrics
      var retentionRate = srsStats.avgRetention ? srsStats.avgRetention + '%' : '—';
      var wordsAtRisk = srsStats.overdue || 0;
      var matureWords = srsStats.mature || 0;
      var learningWords = srsStats.learning || 0;
      var youngWords = srsStats.young || 0;
      var totalSrsWords = matureWords + youngWords + learningWords || 1;
      var maturePct = Math.round(matureWords / totalSrsWords * 100);
      var learningPct = Math.round(learningWords / totalSrsWords * 100);
      var youngPct = Math.round(youngWords / totalSrsWords * 100);
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">';
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--green)">' + retentionRate + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Retention rate</div></div>';
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:700;color:' + (wordsAtRisk > 0 ? 'var(--red)' : 'var(--green)') + '">' + wordsAtRisk + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">' + (wordsAtRisk === 1 ? 'Word' : 'Words') + ' at risk</div></div>';
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--gold)">' + matureWords + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Mature words</div></div>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">';
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--purple)">' + learningWords + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Learning</div><div style="font-size:9px;color:var(--purple);margin-top:2px">' + learningPct + '%</div></div>';
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gold-dim)">' + youngWords + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Young</div><div style="font-size:9px;color:var(--gold-dim);margin-top:2px">' + youngPct + '%</div></div>';
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--green)">' + matureWords + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Mature</div><div style="font-size:9px;color:var(--green);margin-top:2px">' + maturePct + '%</div></div>';
      html += '</div>';
      html += '<div style="display:flex;gap:8px">';
      html += '<div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:14px;font-weight:600;color:var(--blue)">' + (srsStats.avgEaseFactor ? srsStats.avgEaseFactor.toFixed(2) : '2.50') + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Avg ease factor</div></div>';
      html += '<div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:14px;font-weight:600;color:' + (srsStats.leechCount > 0 ? 'var(--red)' : 'var(--text)') + '">' + (srsStats.leechCount || 0) + '</div><div style="font-size:9px;color:var(--text-muted);margin-top:3px">Leeched words</div></div>';
      html += '</div>';
    } else {
      html += '<div style="padding:12px;color:var(--text-muted);font-size:11px;text-align:center">Start learning to see SRS health metrics.</div>';
    }
    html += '</div></div>';
html += '<div class="analytics-section-title">📊 Progress by Category</div>';
      html += '<div class="analytics-progress-block">';
      var catNames = { foundation: 'Foundation', coverage: 'Coverage', mastery: 'Mastery', streak: 'Streak', review: 'Review', quiz: 'Quiz', root: 'Root', path: 'Path', consistency: 'Consistency' };
      var catColors = { foundation: 'var(--gold)', coverage: 'var(--green)', mastery: 'var(--blue)', streak: 'var(--red)', review: 'var(--purple)', quiz: 'var(--pink)', root: 'var(--green)', path: 'var(--gold-dim)', consistency: 'var(--blue)' };
      var catKeys = Object.keys(achievementStats.byCategory);
      for (var cki = 0; cki < catKeys.length; cki++) {
        var ck = catKeys[cki];
        var cat = achievementStats.byCategory[ck];
        var catPct = cat.total > 0 ? Math.round((cat.earned / cat.total) * 100) : 0;
        html += '<div class="analytics-path-row">';
        html += '<div class="analytics-path-label">' + (catNames[ck] || ck) + '</div>';
        html += '<div class="analytics-path-track"><div class="analytics-path-fill" style="width:' + catPct + '%;background:' + (catColors[ck] || 'var(--gold)') + '"></div></div>';
        html += '<div class="analytics-path-value">' + cat.earned + '/' + cat.total + '</div>';
        html += '</div>';
      }
      html += '</div></div>';
    }
  }
  
  // Achievement cards
  html += '<div class="analytics-section">';
  html += '<div class="analytics-section-title">🎯 All Achievements</div>';
  html += '<div class="analytics-ach-grid">';
  for (var ai = 0; ai < allAchievements.length; ai++) {
    var ach = allAchievements[ai];
    html += '<div class="analytics-ach-card' + (ach.earned ? ' analytics-ach-earned' : '') + '">';
    html += '<div class="analytics-ach-icon">' + ach.icon + '</div>';
    html += '<div class="analytics-ach-title">' + ach.title + '</div>';
    html += '<div class="analytics-ach-desc">' + ach.description + '</div>';
    if (ach.earned && ach.earnedDate) {
      html += '<div class="analytics-ach-date">Earned ' + ach.earnedDate + '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';
  
  return html;

  } catch (e) {
    console.error("[analytics] renderAnalyticsAchievements error:", e);
    return "<div class='analytics-empty'>\u26A0\uFE0F Error loading Achievements tab.</div>";
  }
}

// Export for app.js
window.__renderAnalytics = renderAnalytics;

window.__openExplorer = openExplorer;
window.__explorerWord = function() { return _explorerWord; };

// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COMPREHENSION ANIMATIONS — Smooth number counting, ring fill, milestone celebration
// ═══════════════════════════════════════════════════════════════

/**
 * Animate a number element counting from 0 to target.
 * @param {Element} el - The DOM element to update
 * @param {number} target - The target value (0-100)
 * @param {number} duration - Animation duration in ms (default 800)
 */
function animateComprehensionNumber(el, target, duration) {
  if (!el) return;
  duration = duration || 800;
  var startTime = null;
  var startVal = 0;
  
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min(1, (timestamp - startTime) / duration);
    // Ease out cubic
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(eased * target);
    el.textContent = current + '%';
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target + '%';
      el.classList.add('animate-count');
    }
  }
  
  requestAnimationFrame(step);
}

/**
 * Animate the SVG comprehension ring from 0 to target percent.
 * @param {Element} ringEl - The SVG path element for the ring fill
 * @param {number} targetPercent - The final percentage (0-100)
 * @param {number} duration - Animation duration in ms (default 800)
 */
function animateComprehensionRing(ringEl, targetPercent, duration) {
  if (!ringEl) return;
  duration = duration || 800;
  var startTime = null;
  targetPercent = Math.min(100, Math.max(0, targetPercent));
  
  // Save original transition and disable it during animation to avoid conflict
  var origTransition = ringEl.style.transition;
  ringEl.style.transition = 'none';
  
  // Start at 0
  ringEl.setAttribute('stroke-dasharray', '0, 100');
  
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min(1, (timestamp - startTime) / duration);
    // Ease out cubic with slight overshoot
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(eased * targetPercent);
    ringEl.setAttribute('stroke-dasharray', current + ', 100');
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      // Restore original transition
      ringEl.style.transition = origTransition || '';
    }
  }
  
  // Force layout to ensure 'none' transition is applied before first frame
  void ringEl.getBoundingClientRect();
  requestAnimationFrame(step);
}

/**
 * Trigger a milestone celebration effect on the comprehension card.
 * @param {Element} cardEl - The dashboard comprehension card element
 */
function triggerMilestoneCelebration(cardEl) {
  if (!cardEl) return;
  
  // Add celebration class
  cardEl.classList.add('milestone-celebration', 'milestone-confetti');
  
  // Pulse the ring
  var ringWrap = cardEl.querySelector('.db-ring-wrap');
  if (ringWrap) ringWrap.classList.add('animate-ring-pulse');
  
  // Remove animation classes after they complete
  setTimeout(function() {
    cardEl.classList.remove('milestone-celebration', 'milestone-confetti');
    if (ringWrap) ringWrap.classList.remove('animate-ring-pulse');
  }, 2000);
}

/**
 * Animate delta rows with staggered entrance
 * @param {Element} container - The parent element containing delta rows
 */
function animateDeltaRows(container) {
  if (!container) return;
  var rows = container.querySelectorAll('.db-delta-row, .db-milestone-row, .db-insight-message, .db-next-milestone');
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.add('animate-delta');
    // Use JS-applied delays instead of CSS nth-child (which counts all siblings)
    rows[i].style.animationDelay = (0.4 + i * 0.1) + 's';
  }
}

/**
 * Full comprehension animation sequence for the dashboard card.
 * @param {Element} cardEl - The dashboard comprehension card
 * @param {number} comprehensionPct - The comprehension percentage to animate to
 * @param {boolean} isNewMilestone - Whether a new milestone was just reached
 */
function animateDashboardComprehension(cardEl, comprehensionPct, isNewMilestone) {
  if (!cardEl) return;
  
  var ringEl = cardEl.querySelector('.db-ring-fill');
  var ringText = cardEl.querySelector('.db-ring-text');
  var ringWrap = cardEl.querySelector('.db-ring-wrap');
  
  // Animate ring fill from 0 to target
  if (ringEl) {
    animateComprehensionRing(ringEl, comprehensionPct);
  }
  
  // Animate ring text number counting up
  if (ringText) {
    animateComprehensionNumber(ringText, comprehensionPct);
  }
  
  // Ring glow effect
  if (ringWrap) {
    ringWrap.classList.add('animate-ring-glow');
    setTimeout(function() {
      ringWrap.classList.remove('animate-ring-glow');
    }, 1500);
  }
  
  // Staggered delta row entrance
  animateDeltaRows(cardEl);
  
  // Milestone celebration
  if (isNewMilestone) {
    triggerMilestoneCelebration(cardEl);
  }
}

// LEARNING PATH DASHBOARD — Multi-Path Progress & Selection
// ═══════════════════════════════════════════════════════════════

/**
 * Render the Learning Path Dashboard.
 * Called by switchView('dashboard').
 */