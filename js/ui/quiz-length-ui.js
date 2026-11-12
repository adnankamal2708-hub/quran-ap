// ═══════════════════════════════════════════════════════════════
// quiz-length-ui.js — the Short / Normal / Long picker on the quiz
// screen (#quiz-length in index.html). Picking a length starts the
// quiz again with that many questions.
// ═══════════════════════════════════════════════════════════════

/** Marks the saved length as pressed. */
function syncQuizLengthPicker() {
  var current = getQuizLength();
  var buttons = document.querySelectorAll('#quiz-length [data-quiz-length]');
  for (var i = 0; i < buttons.length; i++) {
    var on = buttons[i].getAttribute('data-quiz-length') === current;
    buttons[i].classList.toggle('chip-active', on);
    buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function setupQuizLengthPicker() {
  var picker = document.getElementById('quiz-length');
  if (!picker) return;
  picker.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-quiz-length]');
    if (!btn) return;
    var length = btn.getAttribute('data-quiz-length');
    if (length === getQuizLength()) return;
    if (!setQuizLength(length)) return;
    syncQuizLengthPicker();
    restartQuiz();
  });
  syncQuizLengthPicker();
}
