var fs = require('fs');
var path = require('path');

// ── 1. Add getSurahsImprovedByLesson to data.js ──
var dataPath = path.join(__dirname, '..', 'js', 'data.js');
var dataContent = fs.readFileSync(dataPath, 'utf8');

// Check if function already exists
if (dataContent.indexOf('function getSurahsImprovedByLesson') === -1) {
  // Find the insert point: after getCompletedLessonCount()
  var insertMarker = 'function getCompletedLessonCount() {\n  var progress = loadLessonProgress();\n  return progress.completedLessons.length;\n}';
  var insertPos = dataContent.indexOf(insertMarker);
  if (insertPos >= 0) {
    var endOfFn = insertPos + insertMarker.length;
    var newFn = '\n\n/**\n * Get a list of surahs whose comprehension improves after completing\n * a specific standard sequential lesson. Returns top 5 surahs with comprehension change.\n */\nfunction getSurahsImprovedByLesson(lessonIndex) {\n  var lessonWords = typeof getLessonWords === \'function\' ? getLessonWords(lessonIndex) : [];\n  if (!lessonWords || lessonWords.length === 0) return [];\n  \n  var mastered = typeof getMasteredWordIds === \'function\' ? getMasteredWordIds() : {};\n  \n  // Simulate mastery of this lesson\'s words\n  var simulatedMastered = {};\n  Object.keys(mastered).forEach(function(id) { simulatedMastered[id] = true; });\n  for (var wi = 0; wi < lessonWords.length; wi++) {\n    if (lessonWords[wi].id) simulatedMastered[lessonWords[wi].id] = true;\n  }\n  \n  var allSurahIds = typeof getSurahsWithVocabulary === \'function\' ? getSurahsWithVocabulary() : [];\n  var improvements = [];\n  \n  for (var si = 0; si < allSurahIds.length; si++) {\n    var sid = allSurahIds[si];\n    var words = typeof getSurahWords === \'function\' ? getSurahWords(sid) : [];\n    if (!words || words.length === 0) continue;\n    \n    var lessonWordsInSurah = 0;\n    for (var wi2 = 0; wi2 < lessonWords.length; wi2++) {\n      if (!lessonWords[wi2].id) continue;\n      for (var wj = 0; wj < words.length; wj++) {\n        if (words[wj].id === lessonWords[wi2].id) {\n          lessonWordsInSurah++;\n          break;\n        }\n      }\n    }\n    \n    if (lessonWordsInSurah > 0) {\n      var totalWords = words.length;\n      var masteredBefore = 0;\n      var masteredAfter = 0;\n      for (var wk = 0; wk < words.length; wk++) {\n        if (mastered[words[wk].id]) masteredBefore++;\n        if (simulatedMastered[words[wk].id]) masteredAfter++;\n      }\n      var beforePct = totalWords > 0 ? Math.round(masteredBefore / totalWords * 100) : 0;\n      var afterPct = totalWords > 0 ? Math.round(masteredAfter / totalWords * 100) : 0;\n      \n      if (afterPct > beforePct) {\n        var surahName = \'\';\n        if (typeof SURAH_INFO !== \'undefined\' && SURAH_INFO[sid]) {\n          surahName = SURAH_INFO[sid].name;\n        }\n        improvements.push({\n          surahId: sid,\n          name: surahName || \'Surah \' + sid,\n          beforePct: beforePct,\n          afterPct: afterPct,\n          gain: afterPct - beforePct,\n          wordsLearned: lessonWordsInSurah,\n        });\n      }\n    }\n  }\n  \n  improvements.sort(function(a, b) { return b.gain - a.gain; });\n  return improvements.slice(0, 5);\n}\n';
    dataContent = dataContent.slice(0, endOfFn) + newFn + dataContent.slice(endOfFn);
    fs.writeFileSync(dataPath, dataContent, 'utf8');
    console.log('✓ Added getSurahsImprovedByLesson to data.js');
  } else {
    console.log('✗ Could not find insert point in data.js');
  }
} else {
  console.log('✓ getSurahsImprovedByLesson already exists in data.js');
}

// ── 2. Wire surah connection into quiz.js standard lesson completion ──
var quizPath = path.join(__dirname, '..', 'js', 'quiz.js');
var quizContent = fs.readFileSync(quizPath, 'utf8');

// Check if the standard lesson branch already has surah connection call
if (quizContent.indexOf('getSurahsImprovedByLesson(activeLessonIndex)') === -1) {
  // Find the standard lesson completion branch (not foundation mode)
  // Pattern: after completeLesson and checkForLessonCompletionCelebration in the else block
  var marker = 'if (hadLesson && typeof checkForLessonCompletionCelebration === \'function\') {\n          checkForLessonCompletionCelebration(activeLessonIndex);\n        }';
  var markerEnd = marker.length;
  var markerPos = quizContent.indexOf(marker);
  
  if (markerPos >= 0) {
    var insertAt = markerPos + marker.length;
    var surahConnectionCall = '\n        \n        // Show surah connection after lesson completion\n        if (hadLesson && typeof getSurahsImprovedByLesson === \'function\') {\n          var surahImprovements = getSurahsImprovedByLesson(activeLessonIndex);\n          if (surahImprovements && surahImprovements.length > 0 && typeof showSurahConnectionToast === \'function\') {\n            showSurahConnectionToast(surahImprovements);\n          }\n        }';
    quizContent = quizContent.slice(0, insertAt) + surahConnectionCall + quizContent.slice(insertAt);
    fs.writeFileSync(quizPath, quizContent, 'utf8');
    console.log('✓ Wired surah connection into quiz.js standard lesson completion');
  } else {
    console.log('✗ Could not find insertion point in quiz.js');
  }
} else {
  console.log('✓ Surah connection already wired in quiz.js');
}

console.log('Done.');
