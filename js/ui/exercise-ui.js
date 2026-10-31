/**
 * exercise-ui.js — renders one exercise item (see js/exercises/exercise-engine.js).
 *
 * renderExercise(container, item, onAnswer) fills the container, lets the
 * learner respond, and calls onAnswer(correct, response) once after Check.
 * Keyboard: number keys pick an option, Enter checks; chips are real buttons
 * (Tab/Space). All text is set with textContent, so item text is never parsed
 * as HTML.
 */

var EXERCISE_ARABIC_PATTERN = /[؀-ۿ]/;

function exerciseIsArabic(text) {
  return EXERCISE_ARABIC_PATTERN.test(text);
}

function exerciseEl(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Arabic text gets the Arabic font class plus language and direction.
function exerciseMarkArabic(el, text) {
  if (!exerciseIsArabic(text)) return;
  el.classList.add('ex-ar');
  el.setAttribute('lang', 'ar');
  el.setAttribute('dir', 'rtl');
}

function exerciseChip(className, text) {
  var chip = exerciseEl('button', className, text);
  chip.type = 'button';
  chip.setAttribute('aria-pressed', 'false');
  exerciseMarkArabic(chip, text);
  return chip;
}

// A chip row reads right-to-left when any of its words is Arabic.
function exerciseRow(className, words) {
  var row = exerciseEl('div', className);
  if (words.some(exerciseIsArabic)) row.setAttribute('dir', 'rtl');
  return row;
}

function setExercisePressed(chip, pressed) {
  chip.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}

/**
 * Each view builder takes (item, onChange) and returns
 * { el, response(), pick?(i), reveal(correct) }. response() is null until the
 * learner has given a checkable answer; onChange fires whenever it may differ.
 */
function buildReadChooseView(item, onChange) {
  var el = exerciseEl('div', 'quiz-options ex-options');
  el.setAttribute('role', 'group');
  var selected = null;
  var buttons = item.options.map(function(option, i) {
    var button = exerciseEl('button', 'quiz-opt ex-option');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-keyshortcuts', String(i + 1));
    var label = exerciseEl('span', 'ex-option-label', option);
    exerciseMarkArabic(label, option);
    button.appendChild(exerciseEl('span', 'ex-option-num', String(i + 1)));
    button.appendChild(label);
    button.addEventListener('click', function() { pick(i); });
    el.appendChild(button);
    return button;
  });

  function pick(i) {
    if (!buttons[i] || buttons[i].disabled) return;
    selected = i;
    buttons.forEach(function(button, j) { setExercisePressed(button, j === i); });
    onChange();
  }

  return {
    el: el,
    pick: pick,
    response: function() { return selected; },
    reveal: function() {
      buttons.forEach(function(button, i) {
        button.disabled = true;
        if (i === item.answer) button.classList.add('correct');
        else if (i === selected) button.classList.add('wrong');
      });
    },
  };
}

function buildBuildView(item, onChange) {
  var el = exerciseEl('div', 'ex-build');
  var line = exerciseRow('ex-line', item.pieces);
  var tray = exerciseRow('ex-pieces', item.pieces);
  var solution = exerciseEl('div', 'ex-solution');
  var chosen = [];
  var trayButtons = item.pieces.map(function(piece, i) {
    var button = exerciseChip('ex-piece', piece);
    button.addEventListener('click', function() { toggle(i); });
    tray.appendChild(button);
    return button;
  });

  function toggle(i) {
    var at = chosen.indexOf(i);
    if (at === -1) chosen.push(i);
    else chosen.splice(at, 1);
    setExercisePressed(trayButtons[i], at === -1);
    renderLine();
    onChange();
  }

  // The line mirrors the choices in order; tapping a chip there removes it.
  function renderLine() {
    line.textContent = '';
    chosen.forEach(function(i) {
      var chip = exerciseChip('ex-piece ex-placed', item.pieces[i]);
      chip.removeAttribute('aria-pressed');
      chip.addEventListener('click', function() {
        toggle(i);
        trayButtons[i].focus();
      });
      line.appendChild(chip);
    });
  }

  el.appendChild(line);
  el.appendChild(tray);
  el.appendChild(solution);
  return {
    el: el,
    response: function() {
      if (chosen.length !== item.pieces.length) return null;
      return chosen.map(function(i) { return item.pieces[i]; });
    },
    reveal: function(correct) {
      trayButtons.forEach(function(button) { button.disabled = true; });
      line.querySelectorAll('button').forEach(function(button) { button.disabled = true; });
      line.classList.add(correct ? 'correct' : 'wrong');
      if (correct) return;
      solution.textContent = item.answer.join(' ');
      exerciseMarkArabic(solution, solution.textContent);
    },
  };
}

function buildSpotView(item, onChange) {
  var el = exerciseRow('ex-tokens', item.tokens);
  el.setAttribute('role', 'group');
  var selected = [];
  var buttons = item.tokens.map(function(token, i) {
    var button = exerciseChip('ex-token', token);
    button.addEventListener('click', function() {
      var at = selected.indexOf(i);
      if (at === -1) selected.push(i);
      else selected.splice(at, 1);
      setExercisePressed(button, at === -1);
      onChange();
    });
    el.appendChild(button);
    return button;
  });

  return {
    el: el,
    response: function() {
      if (selected.length === 0) return null;
      return selected.slice().sort(function(a, b) { return a - b; });
    },
    reveal: function() {
      buttons.forEach(function(button, i) {
        button.disabled = true;
        if (item.answer.indexOf(i) !== -1) button.classList.add('correct');
        else if (selected.indexOf(i) !== -1) button.classList.add('wrong');
      });
    },
  };
}

var EXERCISE_VIEW_BUILDERS = {
  'read-choose': buildReadChooseView,
  'build': buildBuildView,
  'spot': buildSpotView,
};

function buildExercisePrompt(item) {
  if (item.type !== 'read-choose') return exerciseEl('p', 'ex-prompt', item.prompt.text);
  var prompt = exerciseEl('div', 'quiz-arabic ex-prompt-arabic', item.prompt.arabic);
  prompt.setAttribute('lang', 'ar');
  prompt.setAttribute('dir', 'rtl');
  return prompt;
}

function renderExercise(container, item, onAnswer) {
  var buildView = EXERCISE_VIEW_BUILDERS[item && item.type];
  if (!buildView) return;

  var root = exerciseEl('div', 'ex');
  root.setAttribute('data-type', item.type);
  var checkButton = exerciseEl('button', 'btn ex-check', t('exercise.check'));
  checkButton.type = 'button';
  checkButton.disabled = true;
  var view = buildView(item, function() {
    checkButton.disabled = view.response() === null;
  });
  var feedback = exerciseEl('div', 'ex-feedback');
  feedback.setAttribute('role', 'status');
  var actions = exerciseEl('div', 'ex-actions');
  actions.appendChild(checkButton);
  root.appendChild(buildExercisePrompt(item));
  root.appendChild(view.el);
  root.appendChild(feedback);
  root.appendChild(actions);

  var answered = false;

  function check() {
    var response = view.response();
    if (answered || response === null) return;
    answered = true;
    document.removeEventListener('keydown', onKeyDown);
    var correct = checkExercise(item, response);
    view.reveal(correct);
    feedback.textContent = t(correct ? 'exercise.correct' : 'exercise.incorrect');
    feedback.className = 'ex-feedback ' + (correct ? 'correct' : 'wrong');
    checkButton.disabled = true;
    if (typeof onAnswer === 'function') onAnswer(correct, response);
  }

  // Enter checks when focus is inside the exercise or on nothing (the body),
  // except on the Check button itself, which clicks natively; Enter on any
  // other focused control (Quit, the tabs) is left to it. The listener
  // removes itself once the exercise leaves the page, and ignores keys while
  // the exercise is on screen nowhere (a hidden view stays in the DOM).
  function onKeyDown(e) {
    if (!root.isConnected) {
      document.removeEventListener('keydown', onKeyDown);
      return;
    }
    if (root.getClientRects().length === 0) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Enter') {
      var focusInside = e.target === document.body || root.contains(e.target);
      if (!focusInside || e.target === checkButton) return;
      e.preventDefault();
      check();
    } else if (view.pick && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      view.pick(Number(e.key) - 1);
    }
  }

  checkButton.addEventListener('click', check);
  document.addEventListener('keydown', onKeyDown);
  container.textContent = '';
  container.appendChild(root);
}
