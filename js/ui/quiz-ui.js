function updateStreak() {
  var data = loadStreakData();
  var today = getDateKey();

  if (data.lastDate === today) {
    return;
  }

  if (data.lastDate === getYesterdayKey()) {
    data.streak = (data.streak || 0) + 1;
  } else {
    data.streak = 1;
  }
  data.lastDate = today;
  saveStreakData(data);
}

/**
 * Render quiz question with educational distractors.
 */
function renderQuizQuestion(currentWordObj, allWords) {
  const wordEl = document.getElementById('quiz-word');
  const feedbackEl = document.getElementById('quiz-feedback');
  const nextBtn = document.getElementById('btn-next-quiz');

  nextBtn.style.display = 'none';
  feedbackEl.textContent = '';

  _setQuizPrompt('What does this word mean?', false);
  wordEl.textContent = currentWordObj.arabic;

  const correct = getShortMeaning(currentWordObj.meaning);

  // Use educational distractors from vocabulary service
  var distractors = getDistractors(currentWordObj, 3);
  var opts = [correct];
  distractors.forEach(function (d) {
    var label = getShortMeaning(d.meaning);
    if (label !== correct && opts.indexOf(label) === -1 && !sharesQuizSense(currentWordObj, d)) {
      opts.push(label);
    }
  });
  // Fallback if not enough options
  if (opts.length < 4) {
    allWords.forEach(function (w) {
      if (w !== currentWordObj && opts.length < 4 && !sharesQuizSense(currentWordObj, w)) {
        var label = getShortMeaning(w.meaning);
        if (label !== correct && opts.indexOf(label) === -1) {
          opts.push(label);
        }
      }
    });
  }
  // Fisher-Yates shuffle for unbiased ordering
  for (var si = opts.length - 1; si > 0; si--) {
    var sj = Math.floor(Math.random() * (si + 1));
    var tmp = opts[si];
    opts[si] = opts[sj];
    opts[sj] = tmp;
  }

  _renderQuizOptions(opts, correct, currentWordObj.id, false);
}

/** Answer buttons; `arabic` marks them as Arabic text. */
function _renderQuizOptions(opts, correct, wordId, arabic) {
  var optionsEl = document.getElementById('quiz-options');
  optionsEl.innerHTML = '';
  opts.forEach(function (opt) {
    var b = document.createElement('button');
    b.className = 'quiz-opt' + (arabic ? ' is-arabic' : '');
    b.textContent = opt;
    b.setAttribute('role', 'button');
    if (arabic) { b.lang = 'ar'; b.dir = 'rtl'; }
    // Mark the correct answer so feedback highlighting doesn't rely on textContent matching
    if (opt === correct) b.setAttribute('data-correct', 'true');
    b.onclick = function () { handleQuizAnswer(b, opt, correct, wordId); };
    optionsEl.appendChild(b);
  });
}

function _setQuizPrompt(text, verse) {
  var promptEl = document.getElementById('quiz-q');
  if (promptEl) promptEl.textContent = text;
  var wordEl = document.getElementById('quiz-word');
  if (wordEl) wordEl.classList.toggle('is-verse', verse);
}

/**
 * Verse fill-in: the ayah with the word's English meaning in the gap, and
 * Arabic options. `question` comes from buildQuizVerseQuestion().
 */
function renderQuizVerseQuestion(word, question) {
  var wordEl = document.getElementById('quiz-word');
  var verse = question.verse;
  document.getElementById('btn-next-quiz').style.display = 'none';
  document.getElementById('quiz-feedback').textContent = '';
  _setQuizPrompt('Which word fills the gap?', true);

  wordEl.textContent = '';
  wordEl.appendChild(document.createTextNode(verse.before + ' '));
  var blank = document.createElement('span');
  blank.className = 'quiz-blank';
  blank.lang = 'en';
  blank.dir = 'ltr';
  blank.textContent = getShortMeaning(word.meaning);
  wordEl.appendChild(blank);
  wordEl.appendChild(document.createTextNode(' ' + verse.after));
  var ref = document.createElement('span');
  ref.className = 'quiz-verse-ref';
  ref.lang = 'en';
  ref.dir = 'ltr';
  ref.textContent = verse.ref;
  wordEl.appendChild(ref);

  _renderQuizOptions(question.options, word.arabic, word.id, true);
}

/** After answering: the real word goes into the gap, the translation under the feedback. */
function showQuizVerseAnswer(verse) {
  var blank = document.querySelector('#quiz-word .quiz-blank');
  if (blank) {
    blank.textContent = verse.token;
    blank.lang = 'ar';
    blank.dir = 'rtl';
    blank.classList.add('is-filled');
  }
  var feedback = document.getElementById('quiz-feedback');
  if (!feedback || !verse.translation) return;
  var line = document.createElement('div');
  line.className = 'quiz-verse-translation';
  line.textContent = verse.translation + ' (' + verse.ref + ')';
  feedback.appendChild(line);
}

// Senses a particle can share with another word, so that word's meaning
// would also be a right answer (مَا can mean "not", so "No" is not wrong).
var QUIZ_SHARED_SENSES = ['negation'];

function sharesQuizSense(a, b) {
  var am = String(a.meaning || '').toLowerCase();
  var bm = String(b.meaning || '').toLowerCase();
  return QUIZ_SHARED_SENSES.some(function (s) { return am.indexOf(s) >= 0 && bm.indexOf(s) >= 0; });
}

/**
 * Navigate to a word in the learn view.
 * Supports both lesson mode and surah mode.
 */
function navigateToWord(w) {
  // Open the Vocabulary Explorer for the given word
  openExplorer(w);
}

/**
 * Show word content (ayah + tafsir) for the current word.
 * This is a safe wrapper that also handles canonical words with multiple occurrences.
 */
function showWordContent(w) {
  if (!w) return;
  showAyah(w);
  loadTafsir(w);
}
