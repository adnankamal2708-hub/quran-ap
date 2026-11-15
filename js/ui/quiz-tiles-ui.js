// ═══════════════════════════════════════════════════════════════
// quiz-tiles-ui.js — draws the tiles question (js/exercises/quiz-tiles.js)
// in the quiz card. Arabic tiles show the English meanings; English tiles
// show the Arabic phrase. That goes where the Arabic word usually is, with
// the answer line under it; the tiles and a Check button go in the options
// area. Uses the tile look of the build exercise (exerciseChip, exerciseRow).
// ═══════════════════════════════════════════════════════════════

/** @param {Object} question - from buildQuizTilesQuestion() */
function renderQuizTilesQuestion(word, question) {
  var wordEl = document.getElementById('quiz-word');
  var optionsEl = document.getElementById('quiz-options');
  document.getElementById('btn-next-quiz').style.display = 'none';
  document.getElementById('quiz-feedback').textContent = '';
  _setQuizPrompt(question.english
    ? 'Tap the meaning of each word, starting from the right'
    : 'Tap the Arabic for these words, in order', true);

  var meaning = question.english ? _quizTilesArabic(question.shown) : _quizTilesMeanings(question.shown);
  var line = exerciseRow('ex-line quiz-tiles-line', question.tiles);
  line.setAttribute('aria-label', 'Your answer');
  if (question.english) line.dir = 'ltr'; // the word box around it is right-to-left
  wordEl.textContent = '';
  wordEl.appendChild(meaning);
  wordEl.appendChild(line);

  var box = exerciseEl('div', 'quiz-tiles');
  var tray = exerciseRow('ex-pieces quiz-tiles-tray', question.tiles);
  var check = exerciseEl('button', 'quiz-opt quiz-tiles-check', 'Check');
  check.type = 'button';
  check.disabled = true;
  var chosen = [];
  var trayButtons = question.tiles.map(function (tile, i) {
    var button = exerciseChip('ex-piece', tile);
    button.addEventListener('click', function () { toggle(i); });
    tray.appendChild(button);
    return button;
  });

  function toggle(i) {
    var at = chosen.indexOf(i);
    if (at === -1) chosen.push(i);
    else chosen.splice(at, 1);
    setExercisePressed(trayButtons[i], at === -1);
    renderLine();
  }

  // The line shows the chosen tiles in order; tapping one there puts it back.
  function renderLine() {
    line.textContent = '';
    chosen.forEach(function (i) {
      var chip = exerciseChip('ex-piece ex-placed', question.tiles[i]);
      chip.removeAttribute('aria-pressed');
      chip.addEventListener('click', function () {
        toggle(i);
        trayButtons[i].focus();
      });
      line.appendChild(chip);
    });
    check.disabled = chosen.length !== question.answer.length;
  }

  check.addEventListener('click', function () {
    var picked = chosen.map(function (i) { return question.tiles[i]; });
    var sep = question.english ? ' · ' : ' ';
    var correct = question.answer.join(sep);
    handleQuizAnswer(check, isQuizTilesCorrect(picked, question.answer) ? correct : picked.join(sep), correct, word.id);
  });

  optionsEl.innerHTML = '';
  box.appendChild(tray);
  box.appendChild(check);
  optionsEl.appendChild(box);
}

/** English meanings in order, with a dot between them. */
function _quizTilesMeanings(glosses) {
  var el = exerciseEl('div', 'quiz-tiles-meaning');
  el.lang = 'en';
  el.dir = 'ltr';
  glosses.forEach(function (g, i) {
    if (i) el.appendChild(exerciseEl('span', 'quiz-tiles-sep', '·'));
    el.appendChild(exerciseEl('span', 'quiz-tiles-gloss', g));
  });
  return el;
}

/** The Arabic phrase, read right to left. */
function _quizTilesArabic(words) {
  var el = exerciseEl('div', 'quiz-tiles-arabic', words.join(' '));
  el.lang = 'ar';
  el.dir = 'rtl';
  return el;
}

/** After answering: tiles lock, the line turns green or red, and the ayah's translation shows. */
function showQuizTilesAnswer(question, correct) {
  document.querySelectorAll('#quiz-word .ex-piece, #quiz-options .ex-piece').forEach(function (b) { b.disabled = true; });
  var line = document.querySelector('#quiz-word .quiz-tiles-line');
  if (line) line.classList.add(correct ? 'correct' : 'wrong');
  var feedback = document.getElementById('quiz-feedback');
  if (!feedback || !question.translation) return;
  var text = exerciseEl('div', 'quiz-verse-translation', question.translation + ' (' + question.ref + ')');
  feedback.appendChild(text);
}
