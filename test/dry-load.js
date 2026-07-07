#!/usr/bin/env node
/**
 * dry-load.js — Runtime ReferenceError Detection
 *
 * Loads all source JS files in a Node.js vm sandbox with mock browser
 * globals, simulating how the browser loads the concatenated bundles.
 * Reports any ReferenceError (or other runtime error) that indicates
 * broken cross-file variable references or undefined identifiers.
 *
 * Also performs static analysis on firebase-core.js to catch
 * unresolved variable references in the ES module.
 *
 * Usage:  node test/dry-load.js
 *         node test/dry-load.js --verbose  (show each file as it loads)
 *
 * Exit code: 0 = all clean, 1 = errors found
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var VERBOSE = process.argv.indexOf('--verbose') >= 0;

// ═══════════════════════════════════════════════════════════════
// File Discovery (mirrors build.js ordering)
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

// firebase-core.js is NOT included in this list — it's loaded as a
// separate ES module (<script type="module">) with CDN imports.
// It is checked via static analysis below.
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
  'js/app.js',
];

var ALL_KEY_FILES = DATA_FILES.concat(APP_FILES);

// ═══════════════════════════════════════════════════════════════
// Mock Browser Globals
// ═══════════════════════════════════════════════════════════════

function createSandbox() {
  var store = {};

  var mockLocalStorage = {
    getItem: function (key) { return store[key] !== undefined ? store[key] : null; },
    setItem: function (key, val) { store[key] = String(val); },
    removeItem: function (key) { delete store[key]; },
    clear: function () { store = {}; },
    get length() { return Object.keys(store).length; },
  };

  function createMockElement(tag) {
    return {
      tagName: tag ? tag.toUpperCase() : 'DIV',
      style: {},
      classList: {
        _classes: [],
        add: function (c) { if (this._classes.indexOf(c) < 0) this._classes.push(c); },
        remove: function (c) { var i = this._classes.indexOf(c); if (i >= 0) this._classes.splice(i, 1); },
        contains: function (c) { return this._classes.indexOf(c) >= 0; },
        toggle: function (c) { if (this.contains(c)) this.remove(c); else this.add(c); },
      },
      addEventListener: function () {},
      removeEventListener: function () {},
      setAttribute: function () {},
      getAttribute: function () { return null; },
      removeAttribute: function () {},
      focus: function () {},
      blur: function () {},
      click: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      closest: function () { return null; },
      scrollIntoView: function () {},
      appendChild: function (child) { return child; },
      removeChild: function (child) { return child; },
      insertBefore: function (child) { return child; },
      contains: function () { return false; },
      textContent: '',
      innerHTML: '',
      value: '',
      disabled: false,
      onclick: null,
      oninput: null,
      onblur: null,
      onchange: null,
      options: [],
      remove: function (idx) {
        if (idx >= 0 && idx < this.options.length) this.options.splice(idx, 1);
      },
      selectedIndex: 0,
      type: 'text',
      placeholder: '',
      rows: 0,
      cols: 0,
      checked: false,
      tabIndex: 0,
      dir: '',
      lang: '',
      hidden: false,
      ariaLabel: '',
      ariaExpanded: false,
      ariaLive: '',
      role: '',
      min: 0,
      max: 0,
      step: 0,
      autocomplete: '',
      name: '',
      form: null,
      labels: [],
      validity: { valid: true },
      reportValidity: function () { return true; },
      scrollTop: 0,
      scrollLeft: 0,
      offsetTop: 0,
      offsetLeft: 0,
      offsetWidth: 0,
      offsetHeight: 0,
      clientWidth: 0,
      clientHeight: 0,
      parentNode: null,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      children: [],
      childNodes: [],
      hasChildNodes: function () { return false; },
      insertAdjacentHTML: function () {},
      insertAdjacentElement: function () {},
      replaceChildren: function () {},
      prepend: function () {},
      before: function () {},
      after: function () {},
      cloneNode: function () { return createMockElement(); },
    };
  }

  var mockDoc = {
    _elements: {},
    getElementById: function (id) {
      if (!this._elements[id]) {
        this._elements[id] = createMockElement();
      }
      return this._elements[id];
    },
    createElement: function (tag) {
      return createMockElement(tag);
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createTextNode: function () { return {}; },
    activeElement: { tagName: 'BODY', blur: function () {} },
    documentElement: { style: {} },
    body: { classList: { add: function () {}, remove: function () {} } },
    head: { appendChild: function () {}, insertBefore: function () {} },
  };

  var mockWindow = {
    document: mockDoc,
    localStorage: mockLocalStorage,
    navigator: {
      serviceWorker: { register: function () { return Promise.resolve(); } },
      userAgent: 'Node.js Test',
      onLine: true,
    },
    console: {
      _buffer: [],
      log: function () {
        this._buffer.push({ level: 'log', args: Array.prototype.slice.call(arguments) });
      },
      warn: function () {
        this._buffer.push({ level: 'warn', args: Array.prototype.slice.call(arguments) });
      },
      error: function () {
        this._buffer.push({ level: 'error', args: Array.prototype.slice.call(arguments) });
      },
      info: function () {
        this._buffer.push({ level: 'info', args: Array.prototype.slice.call(arguments) });
      },
    },
    location: {
      href: 'http://localhost:8080/',
      origin: 'http://localhost:8080',
      search: '',
      hash: '',
      pathname: '/',
      hostname: 'localhost',
      port: '8080',
    },
    performance: {
      now: function () { return 0; },
      mark: function () {},
      measure: function () {},
      getEntriesByType: function () { return []; },
    },
    setTimeout: function (fn, ms) {
      if (typeof fn === 'string') {
        try { eval(fn); } catch (e) { /* ignore */ }
      }
      return 1;
    },
    clearTimeout: function () {},
    setInterval: function () { return 1; },
    clearInterval: function () {},
    requestAnimationFrame: function () { return 1; },
    cancelAnimationFrame: function () {},
    fetch: function () {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
    },
    Promise: Promise,
    Set: Set,
    Map: Map,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    URL: (typeof URL !== 'undefined') ? URL : function () {},
    URLSearchParams: function (str) {
      this._params = {};
      if (str) {
        str.replace(/[?&]([^=]+)=([^&]*)/g, function (_, k, v) {
          this._params[k] = v;
        }.bind(this));
      }
      this.get = function (key) { return this._params[key] || null; };
    },
    customElements: { define: function () {}, get: function () { return undefined; } },
    matchMedia: function () { return { matches: false, addListener: function () {}, removeListener: function () {} }; },
    scrollTo: function () {},
    scrollBy: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    dispatchEvent: function () { return true; },
    Event: function () {},
    CustomEvent: function () {},
    JSON: JSON,
    Math: Math,
    Date: Date,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    encodeURI: encodeURI,
    encodeURIComponent: encodeURIComponent,
    decodeURI: decodeURI,
    decodeURIComponent: decodeURIComponent,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    SyntaxError: SyntaxError,
    ReferenceError: ReferenceError,
    _kbdHintsShown: false,
    _kbdHintsAutoShown: false,
    __auth: {},
    __sync: {},
    __user: {},
    __ux: {},
    __srs: {},
    __analytics: {},
    __adaptive: {},
    __lastReviewWasMixed: false,
  };

  // Make window reference itself
  mockWindow.window = mockWindow;
  mockWindow.self = mockWindow;
  mockWindow.globalThis = mockWindow;
  mockWindow.top = mockWindow;
  mockWindow.parent = mockWindow;
  mockDoc.defaultView = mockWindow;

  // Initialize __firebaseCore with stub functions
  mockWindow.__firebaseCore = {
    initCore: function () { return true; },
    subscribeToAuth: function () { return function () {}; },
    isReady: function () { return true; },
    getAuth: function () { return null; },
    getDb: function () { return null; },

    // Auth stubs
    createUserWithEmailAndPassword: function () { return Promise.resolve({ user: {} }); },
    signInWithEmailAndPassword: function () { return Promise.resolve({ user: {} }); },
    signOut: function () { return Promise.resolve(); },
    sendPasswordResetEmail: function () { return Promise.resolve(); },
    confirmPasswordReset: function () { return Promise.resolve(); },
    applyActionCode: function () { return Promise.resolve(); },
    updateProfile: function () { return Promise.resolve(); },
    updateEmail: function () { return Promise.resolve(); },
    updatePassword: function () { return Promise.resolve(); },
    sendEmailVerification: function () { return Promise.resolve(); },
    deleteUser: function () { return Promise.resolve(); },
    reauthenticateWithCredential: function () { return Promise.resolve(); },
    EmailAuthProvider: { credential: function () { return {}; } },
    setPersistence: function () { return Promise.resolve(); },
    browserLocalPersistence: 'local',
    browserSessionPersistence: 'session',

    // Firestore stubs
    doc: function () { return {}; },
    getDoc: function () {
      return Promise.resolve({ exists: function () { return false; }, data: function () { return null; } });
    },
    setDoc: function () { return Promise.resolve(); },
    deleteDoc: function () { return Promise.resolve(); },
    serverTimestamp: function () { return null; },
  };

  return vm.createContext(mockWindow);
}

// ═══════════════════════════════════════════════════════════════
// Firebase Core Static Reference Analysis
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze firebase-core.js for unresolved identifier references.
 * Since it's an ES module with CDN imports that don't resolve in Node,
 * we can't execute it. Instead, we parse it statically.
 *
 * Strategy: Focus on detecting the most impactful class of errors —
 * capitalized identifiers (like `FIREBASE_CONFIG`) used as bare
 * references but neither imported, locally declared, nor a known global.
 * This catches cross-script constant/config reference errors with zero
 * false positives.
 */
function checkFirebaseCore() {
  var file = 'js/services/firebase-core.js';
  var fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.log('  \u2139 ' + file + ' not found \u2014 skipping static analysis.');
    return true;
  }

  var source = fs.readFileSync(fullPath, 'utf8');

  // Strip comments so capitalized words in them don't cause
  // false positives (e.g. "NOTE" or "ALL" in header comments).
  var codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
    .replace(/\/\/[^\n]*/g, '');           // line comments

  // 1. Extract all imports (named and default)
  var importedNames = [];
  var importRegex = /import\s+(?:(\*\s+as\s+\w+)|(?:\{([^}]+)\})|(\w+))\s+from/g;
  var match;
  while ((match = importRegex.exec(source)) !== null) {
    if (match[2]) {
      match[2].split(',').forEach(function (part) {
        var name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) importedNames.push(name);
      });
    } else if (match[3]) {
      importedNames.push(match[3].trim());
    }
  }

  // 2. Extract all local declarations
  var localDecls = [];

  // const/let/var name = ...
  var declRegex = /(?:const|let|var)\s+(\w+)\s*[=;]/g;
  while ((match = declRegex.exec(source)) !== null) {
    localDecls.push(match[1]);
  }

  // Destructuring: let { a, b: c } = ...
  var destructureRegex = /(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=/g;
  while ((match = destructureRegex.exec(source)) !== null) {
    match[1].split(',').forEach(function (part) {
      var name = part.trim().split(/\s*:\s*/).pop().trim();
      if (name) localDecls.push(name);
    });
  }

  // Function declarations: function name( ... ) { ... }
  var funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
  while ((match = funcRegex.exec(source)) !== null) {
    localDecls.push(match[1]);
  }

  // Build known identifier set
  var knownSet = {};
  importedNames.forEach(function (n) { knownSet[n] = true; });
  localDecls.forEach(function (n) { knownSet[n] = true; });
  //   console.log is a reserved word, not an import or local decl
  knownSet['console'] = true;

  // Common acronyms that appear in comments, log messages, and string
  // literals. These are not imports or declarations but are also not
  // ReferenceErrors — they must be whitelisted to avoid false positives.
  var acronyms = [
    'SDK', 'API', 'URL', 'HTML', 'CSS', 'DOM', 'JSON', 'ID', 'UI', 'UX',
    'DB', 'HTTP', 'HTTPS', 'PWA', 'CLI', 'XML', 'SVG', 'REST',
    'SEO', 'AMP', 'SPA', 'SSR', 'CSR', 'SSG', 'GUID', 'UUID',
    'YAML', 'TOML', 'INI', 'PDF', 'JPG', 'PNG', 'GIF', 'SVG',
    'WASM', 'AST', 'CLI', 'IDE', 'CPU', 'RAM', 'GPU', 'AI',
    'NOTE', 'TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'OPTIMIZE',
    'ALL', 'ANY', 'SOME', 'NONE', 'ONCE', 'MANY',
  ];
  acronyms.forEach(function (a) { knownSet[a] = true; });

  // 3. Find bare references to CAPITALIZED identifiers (SCREAMING_SNAKE_CASE)
  //    Search on codeOnly (comments stripped) to avoid false positives
  //    from capitalized words in comments (e.g. "NOTE", "ALL", "TODO").
  var candidates = [];
  var capRegex = /\b([A-Z][A-Z0-9_]{2,})\b/g;
  while ((match = capRegex.exec(codeOnly)) !== null) {
    var name = match[1];
    if (candidates.indexOf(name) < 0) candidates.push(name);
  }

  // 4. Check each capitalized identifier against known names
  var unresolved = [];
  candidates.forEach(function (name) {
    if (!knownSet[name]) {
      unresolved.push(name);
    }
  });

  if (unresolved.length > 0) {
    console.log('  \u2717 ' + file + ' \u2014 ' + unresolved.length + ' unresolved uppercase identifier(s):');
    unresolved.forEach(function (id) {
      console.log('      \u2192 "' + id + '" is used but not imported or locally declared');
    });
    console.log('      This likely causes a runtime ReferenceError in the browser.');
    return false;
  }

  if (VERBOSE) {
    console.log('  \u2713 ' + file + ' \u2014 ' + importedNames.length + ' imports, ' +
      localDecls.length + ' local decls, 0 unresolved identifiers');
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

var hadError = false;

var sandbox = createSandbox();
var totalFiles = ALL_KEY_FILES.length;

// Step 1: Concatenate all source files (excluding firebase-core.js)
// into a single script. This properly simulates the browser's shared
// global scope where `const` and `let` declarations are visible across
// files — unlike separate vm.runInContext calls which would isolate them.
console.log('');
console.log('  Dry-Load Test: Runtime ReferenceError Detection');
console.log('  ' + totalFiles + ' source files (excluding firebase-core.js)');

var combinedCode = '';
ALL_KEY_FILES.forEach(function (file) {
  var fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.log('  \u2139 Skipping ' + file + ' (not found)');
    return;
  }
  var content = fs.readFileSync(fullPath, 'utf8');
  combinedCode += '// [FILE: ' + file + ']\n' + content + '\n';
});

console.log('  \u25B6 Loading ' + combinedCode.length + ' bytes of concatenated source...');

try {
  vm.runInContext(combinedCode, sandbox, {
    filename: 'combined-bundle.js',
    timeout: 10000,
  });
  console.log('  \u2713 Bundle loaded successfully \u2014 no ReferenceErrors');
} catch (e) {
  hadError = true;
  var errorFile = 'unknown';
  if (e.stack) {
    var stackMatch = e.stack.match(/\[FILE: ([^\]]+\.js)\]/);
    if (stackMatch) errorFile = stackMatch[1];
  }
  console.log('');
  console.log('  \u2717 RUNTIME ERROR DETECTED');
  console.log('    Type:  ' + e.constructor.name);
  console.log('    File:  ' + errorFile);
  console.log('    Error: ' + e.message);
  if (e.stack) {
    var stackLines = e.stack.split('\n');
    console.log('    Stack: ' + stackLines.slice(0, 4).join('\n           '));
  }
}

// Step 2: Check firebase-core.js via static analysis
console.log('');
var coreOk = checkFirebaseCore();
if (!coreOk) hadError = true;

// Step 3: Summary
console.log('');
if (hadError) {
  console.log('  \u2717 Dry-load test FAILED \u2014 runtime errors detected.');
  console.log('');
  process.exit(1);
} else {
  console.log('  \u2713 All files pass \u2014 no ReferenceErrors detected.');
  console.log('');
  process.exit(0);
}
