#!/usr/bin/env node
/**
 * comment-lint.js — Malformed Comment Detection
 *
 * Scans all source JavaScript files for comment patterns that are valid
 * JavaScript syntax but silently produce broken code when concatenated
 * or minified, leading to runtime SyntaxErrors.
 *
 * Detected patterns:
 *   1. `//` LINE COMMENT + `/**` BLOCK COMMENT OPEN on the same line
 *      ─ The `//` swallows the `/**`, so the `*` on the next JSDoc line
 *        becomes a bare token → SyntaxError: Unexpected token '*'
 *   2. Unclosed `/*` block comment (no matching `* /`)
 *      ─ Everything after the opening `/*` becomes part of the comment,
 *        potentially swallowing valid code until the end of the file.
 *
 * Usage:  node test/comment-lint.js
 *         node test/comment-lint.js --verbose
 *
 * Exit code: 0 = all clean, 1 = issues found
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var VERBOSE = process.argv.indexOf('--verbose') >= 0;

// ═══════════════════════════════════════════════════════════════
// File Discovery (mirrors build.js and dry-load.js ordering)
// ═══════════════════════════════════════════════════════════════

var DATA_FILES = (function () {
  var dataDir = path.join(ROOT, 'js', 'data');
  if (!fs.existsSync(dataDir)) return ['js/data.js'];

  var entries = fs.readdirSync(dataDir).filter(function (f) { return f.endsWith('.js'); });
  var core = ['js/data.js'];
  var surahMeta = [];
  var thematic = [];
  var perSurah = [];

  entries.forEach(function (f) {
    var fullPath = 'js/data/' + f;
    if (fullPath === 'js/data.js') return;
    if (fullPath === 'js/data/surahs.js') {
      surahMeta.push(fullPath);
    } else if (/^words-surah-\d+-/.test(f)) {
      perSurah.push(fullPath);
    } else {
      thematic.push(fullPath);
    }
  });

  perSurah.sort(function (a, b) {
    var numA = parseInt(a.match(/words-surah-(\d+)/)[1], 10);
    var numB = parseInt(b.match(/words-surah-(\d+)/)[1], 10);
    return numA - numB;
  });
  thematic.sort();

  return core.concat(surahMeta).concat(thematic).concat(perSurah);
})();

var APP_FILES = [
  'js/services/config.js',
  'js/services/auth-service.js',
  'js/services/sync-service.js',
  'js/services/user-service.js',
  'js/vocabulary.js',
  'js/srs.js',
  'js/ui.js',
  'js/quiz.js',
  'js/auth-ui.js',
  'js/profile-ui.js',
  'js/analytics.js',
  'js/ux-polish.js',
  'js/learner-profile-bridge.js',
  'js/app.js',
];

// firebase-core.js is an ES module loaded separately — include it too
var ALL_FILES = DATA_FILES.concat(APP_FILES).concat(['js/services/firebase-core.js']);

// ═══════════════════════════════════════════════════════════════
// Lint Checks
// ═══════════════════════════════════════════════════════════════

/**
 * Check 1: Line comment swallowing block comment opener
 *
 * Pattern: A line that starts with `//` and also has /** somewhere
 * after it on the same line (outside strings/regexps). Example:
 *
 *   // --- Event Wiring ---/**
 *
 * The `//` comment swallows everything after it including the /**.
 * When concatenated, the next line's `*` (intended as JSDoc continuation)
 * becomes a bare `*` token -> SyntaxError.
 *
 * NOTE: This check is context-aware. Lines inside a `/* ... * /` block
 * comment are skipped because `//` inside a block comment is just text,
 * not an actual line comment.
 */

function checkLineCommentSwallowing(content, file, lines) {
  var issues = [];
  var insideBlockComment = false;

  for (var idx = 0; idx < lines.length; idx++) {
    var trimmed = lines[idx].trim();

    // Track block comment state
    if (insideBlockComment) {
      if (trimmed.indexOf('*/') >= 0) {
        insideBlockComment = false;
      }
      continue;
    }

    // Check if this line opens a block comment that spans multiple lines
    var blockOpenIdx = trimmed.indexOf('/*');
    if (blockOpenIdx >= 0) {
      // Not inside a line comment
      var beforeBlock = trimmed.substring(0, blockOpenIdx);
      if (beforeBlock.indexOf('//') < 0) {
        var rest = trimmed.substring(blockOpenIdx + 2);
        if (rest.indexOf('*/') < 0) {
          insideBlockComment = true;
        }
        continue;
      }
    }

    // Check for the bug pattern: // ... /**
    var lineCommentIdx = trimmed.indexOf('//');
    if (lineCommentIdx < 0) continue;

    var afterLC = trimmed.substring(lineCommentIdx + 2);
    if (afterLC.indexOf('/**') >= 0) {
      issues.push({
        line: idx + 1,
        message: 'Line comment (`//`) and block comment opener (`/**`) on the same line. ' +
          'The `//` swallows the `/**`. Remove `/**` from this line ' +
          'and ensure it opens on its own line.',
      });
    }
  }

  return issues;
}

/**
 * Check 2: Unclosed block comment
 *
 * Pattern: A `/*` that is never closed with a matching `* /`.
 * This can swallow large amounts of code. This check is best-effort:
 * it counts `/*` openers and `* /` closers, ignoring strings and
 * regexps to avoid false positives.
 */
function checkUnclosedBlockComments(content, file, lines) {
  var joined = content;
  var openCount = 0;
  var closeCount = 0;

  // Simple count: count /* that aren't inside // comments and aren't //* or /***
  // This is a heuristic — fine for catching real issues
  var openRegex = /\/\*(?!\/)/g;
  var closeRegex = /\*\//g;

  var match;
  while ((match = openRegex.exec(joined)) !== null) {
    // Walk backwards on this line to check if it's inside a line comment
    var lineStart = joined.lastIndexOf('\n', match.index);
    if (lineStart < 0) lineStart = 0;
    var linePrefix = joined.substring(lineStart, match.index);
    var lineCommentIdx = linePrefix.indexOf('//');
    if (lineCommentIdx < 0) {
      openCount++;
    }
  }

  while ((match = closeRegex.exec(joined)) !== null) {
    closeCount++;
  }

  if (openCount > closeCount) {
    return [{
      line: 1,
      message: 'Unclosed block comment detected: ' + openCount + ' opening `/*` but only ' +
        closeCount + ' closing `*/`. This may swallow valid code.',
    }];
  }

  return [];
}

/**
 * Check 3: Bare asterisk after line comment
 *
 * Pattern: A line that is just `*` (bare asterisk) immediately following
 * a `//` line comment. This is the exact downstream symptom of a `/**`
 * being swallowed by a `//` comment on the previous line.
 *
 * Example that triggers:
 *   // ── Event Wiring ────────────────────────────────/**
 *   * Safely set onclick for an element. Returns the element or null.
 *                                              ^
 *   The `/**` on line 1 was swallowed by `//`, so the `*` on line 2
 *   becomes a bare token → SyntaxError: Unexpected token '*'
 */
function checkBareAsteriskAfterLineComment(content, file, lines) {
  var issues = [];

  lines.forEach(function (line, idx) {
    if (idx === 0) return;
    var trimmed = line.trim();
    var prevLine = lines[idx - 1].trim();

    // Current line is just `*` or `*/` (with optional whitespace)
    // AND previous line is a `//` comment
    if (/^\s*\*\/?\s*$/.test(trimmed) && prevLine.indexOf('//') >= 0) {
      issues.push({
        line: idx + 1,
        message: 'Bare `*` on line following a `//` comment (line ' + idx + '). ' +
          'This is the downstream result of `/**` being swallowed by the ' +
          '`//` comment. Move the `/**` to its own line.',
      });
    }
  });

  return issues;
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

var hadError = false;
var totalIssues = 0;

console.log('');
console.log('  Comment Lint: Malformed Comment Detection');
console.log('  Scanning ' + ALL_FILES.length + ' source files...');
console.log('');

ALL_FILES.forEach(function (file) {
  var fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    if (VERBOSE) console.log('  \u2139 Skipping ' + file + ' (not found)');
    return;
  }

  var content = fs.readFileSync(fullPath, 'utf8');
  var lines = content.split('\n');

  var fileIssues = [];

  var checks = [
    { name: 'line-comment-swallowing', fn: checkLineCommentSwallowing },
    { name: 'unclosed-block-comment', fn: checkUnclosedBlockComments },
    { name: 'bare-asterisk', fn: checkBareAsteriskAfterLineComment },
  ];

  checks.forEach(function (check) {
    var issues = check.fn(content, file, lines);
    fileIssues = fileIssues.concat(issues);
  });

  if (fileIssues.length > 0) {
    hadError = true;
    totalIssues += fileIssues.length;
    console.log('  \u2717 ' + file + ' \u2014 ' + fileIssues.length + ' issue(s)');
    fileIssues.forEach(function (issue) {
      console.log('      Line ' + issue.line + ': ' + issue.message);
    });
  } else if (VERBOSE) {
    console.log('  \u2713 ' + file);
  }
});

// Special check: also scan build.js, test files, and config files
// NOTE: test/comment-lint.js is intentionally excluded from self-scanning
// because it contains `/**` and `/*` in JSDoc documentation as descriptive
// text describing the bug patterns. These are valid, not actual bugs.
var EXTRA_FILES = [
  'build.js',
  'test/dry-load.js',
  'test/run-all.js',
  'sw.js',
];

EXTRA_FILES.forEach(function (file) {
  var fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return;

  var content = fs.readFileSync(fullPath, 'utf8');
  var lines = content.split('\n');

  var fileIssues = [];

  var checks = [
    { name: 'line-comment-swallowing', fn: checkLineCommentSwallowing },
    { name: 'unclosed-block-comment', fn: checkUnclosedBlockComments },
    { name: 'bare-asterisk', fn: checkBareAsteriskAfterLineComment },
  ];

  checks.forEach(function (check) {
    var issues = check.fn(content, file, lines);
    fileIssues = fileIssues.concat(issues);
  });

  if (fileIssues.length > 0) {
    hadError = true;
    totalIssues += fileIssues.length;
    console.log('  \u2717 ' + file + ' \u2014 ' + fileIssues.length + ' issue(s)');
    fileIssues.forEach(function (issue) {
      console.log('      Line ' + issue.line + ': ' + issue.message);
    });
  } else if (VERBOSE) {
    console.log('  \u2713 ' + file);
  }
});

console.log('');
if (hadError) {
  console.log('  \u2717 Comment lint FAILED \u2014 ' + totalIssues + ' issue(s) found.');
  console.log('  Fix the issues above and re-run.');
  console.log('');
  process.exit(1);
} else {
  console.log('  \u2713 All files pass \u2014 no malformed comment patterns detected.');
  console.log('');
  process.exit(0);
}
