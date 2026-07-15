#!/usr/bin/env node
/**
 * run-all.js — Combined Test Runner
 *
 * Executes all test suites sequentially and reports
 * comprehensive results. Exit code 0 = all pass.
 *
 * Run: node test/run-all.js
 */

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var TEST_DIR = __dirname;
var TESTS = [
  "navigation.test.js",
  "review.test.js",
  "keyboard.test.js",
  "analytics.test.js",
  "ux-polish.test.js",
  "srs.test.js",
  "srs-edge.test.js",
  "vocabulary.test.js",
  "quiz.test.js",
  "data-validation.test.js",
  "dashboard.test.js",
  "review-center.test.js",
  "achievements-ui.test.js",
  "services.test.js",
  "foundation-course.test.js",
  "regression.test.js",
];
var totalPassed = 0;
var totalFailed = 0;
var totalTests = 0;
var results = [];
var startTime = Date.now();

console.log('='.repeat(60));
console.log('  QURAN VOCABULARY APP — COMPREHENSIVE TEST SUITE');
console.log('='.repeat(60));
console.log('Date: ' + new Date().toISOString());
console.log('Node: ' + process.version);
console.log('='.repeat(60) + '\n');

TESTS.forEach(function(testFile) {
  var testPath = path.join(TEST_DIR, testFile);
  if (!fs.existsSync(testPath)) {
    console.log('\u26A0 Skipping ' + testFile + ' (not found)');
    return;
  }

  console.log('\uD83D\uDD0D Running: ' + testFile);
  var testStart = Date.now();

  try {
    var output = cp.execSync('node "' + testPath + '"', {
      cwd: path.join(TEST_DIR, '..'),
      timeout: 30000,
      encoding: 'utf8',
    });

    var elapsed = ((Date.now() - testStart) / 1000).toFixed(1);
    console.log(output);

    // Parse results
    var match = output.match(/Results: (\d+) passed, (\d+) failed/);
    if (match) {
      var p = parseInt(match[1], 10);
      var f = parseInt(match[2], 10);
      totalPassed += p;
      totalFailed += f;
      totalTests += p + f;
      results.push({ file: testFile, passed: p, failed: f, elapsed: elapsed, status: f === 0 ? 'PASS' : 'FAIL' });
    } else {
      results.push({ file: testFile, passed: 0, failed: 1, elapsed: elapsed, status: 'ERROR' });
      totalFailed++;
    }
  } catch (e) {
    var elapsed = ((Date.now() - testStart) / 1000).toFixed(1);
    console.log('  \u274C ' + testFile + ' — exited with error');
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log('  stderr: ' + e.stderr.substring(0, 200));
    results.push({ file: testFile, passed: 0, failed: -1, elapsed: elapsed, status: 'CRASH' });
    totalFailed++;
  }
  console.log('');
});

// ── Summary Report ──

var totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('='.repeat(60));
console.log('  QA REPORT — COMPREHENSIVE TEST SUMMARY');
console.log('='.repeat(60));
console.log('');
console.log('  Test Suite            | Status | Passed | Failed | Time');
console.log('  ' + '-'.repeat(55));
results.forEach(function(r) {
  var icon = r.status === 'PASS' ? '\u2705' : r.status === 'FAIL' ? '\u26A0' : '\u274C';
  var name = r.file.padEnd(22);
  console.log('  ' + icon + ' ' + name + ' | ' + r.status.padEnd(5) + ' | ' +
    String(r.passed).padStart(5) + ' | ' + String(r.failed >= 0 ? r.failed : 'N/A').padStart(5) + ' | ' + r.elapsed + 's');
});
console.log('  ' + '-'.repeat(55));
console.log('  \uD83D\uDCCA Total: ' + totalTests + ' tests | ' + totalPassed + ' passed | ' +
  totalFailed + ' failed | ' + totalElapsed + 's');
console.log('');

if (totalFailed === 0) {
  console.log('  \u2705 ALL TESTS PASSING');
} else {
  console.log('  \u26A0 ' + totalFailed + ' FAILURES — review logs above');
}

console.log('='.repeat(60));

process.exit(totalFailed > 0 ? 1 : 0);
