// ═══════════════════════════════════════════════════════════════
// salah-walk.js — Every step of a two-rakʿah prayer, for the walkthrough
//
// The walkthrough (lesson 1.1) plays a whole prayer: standing, the takbīr,
// the recitation, the bow, rising, going down, both prostrations of each
// rakʿah with the sitting between them, the final sitting and the salām.
// Where the madhabs differ in what the figure does (raising the hands, the
// way down, the sitting of rest, how one sits, one salām or two) the steps
// follow the learner's madhab, and so do some captions (SALAH_WALK_CAPTIONS).
// Labels and captions are strings: salah.walk.step.<kind> and
// salah.walk.c.<kind>[.<variant>].
// ═══════════════════════════════════════════════════════════════

/** Mālikīs put the hands down before the knees */
var SALAH_HANDS_FIRST_MADHABS = ['maliki'];

/** Shāfiʿīs sit briefly (the sitting of rest) before standing for the next rakʿah */
var SALAH_REST_SIT_MADHABS = ['shafii'];

/** Mālikīs sit in tawarruk in every sitting */
var SALAH_TAWARRUK_ALWAYS_MADHABS = ['maliki'];

/** Tawarruk in the last sitting of a two-rakʿah prayer */
var SALAH_TAWARRUK_LAST_MADHABS = ['maliki', 'shafii'];

/** One praying alone ends with a single salām */
var SALAH_ONE_SALAM_MADHABS = ['maliki'];

/** Steps whose caption depends on the madhab: kind → { madhab: caption variant } */
var SALAH_WALK_CAPTIONS = {
  qiyam: { hanafi: 'below', hanbali: 'below', shafii: 'shafii', maliki: 'maliki' },
  qiyam2: { maliki: 'maliki' },
  down: { maliki: 'maliki' },
  jalsa: { maliki: 'maliki', shafii: 'shafii', hanbali: 'hanbali' },
  tashahhud: { maliki: 'tawarruk', shafii: 'tawarruk' },
};

function _salahIn(madhab, list) { return list.indexOf(madhab) >= 0; }

/** One rakʿah's steps, in order: { kind, pose, sit } */
function _salahRakahSteps(n, madhab) {
  var raises = _salahIn(madhab, SALAH_RAISE_MADHABS);
  var sit = _salahIn(madhab, SALAH_TAWARRUK_ALWAYS_MADHABS) ? 'tawarruk' : 'iftirash';
  var out = n === 1 ? [{ kind: 'stand', pose: 'itidal' }, { kind: 'takbir', pose: 'takbir' }, { kind: 'qiyam', pose: 'qiyam' }]
    : [{ kind: 'qiyam2', pose: 'qiyam' }];
  if (raises) out.push({ kind: 'raiseBow', pose: 'raise' });
  out.push({ kind: 'ruku', pose: 'ruku' });
  if (raises) out.push({ kind: 'raiseUp', pose: 'raise' });
  out.push({ kind: 'itidal', pose: 'itidal' },
    { kind: 'down', pose: _salahIn(madhab, SALAH_HANDS_FIRST_MADHABS) ? 'handsDown' : 'kneel' },
    { kind: 'sujud1', pose: 'sujud' }, { kind: 'jalsa', pose: 'jalsa', sit: sit }, { kind: 'sujud2', pose: 'sujud' });
  if (n === 1 && _salahIn(madhab, SALAH_REST_SIT_MADHABS)) out.push({ kind: 'rest', pose: 'jalsa', sit: sit });
  return out;
}

/** The final sitting and the salām */
function _salahEndSteps(madhab) {
  var sit = _salahIn(madhab, SALAH_TAWARRUK_LAST_MADHABS) ? 'tawarruk' : 'iftirash';
  var out = [{ kind: 'tashahhud', pose: 'tashahhud', sit: sit }];
  if (_salahIn(madhab, SALAH_ONE_SALAM_MADHABS)) out.push({ kind: 'salam', pose: 'taslim', sit: sit, turn: 1 });
  else out.push({ kind: 'salamR', pose: 'taslim', sit: sit, turn: 1 }, { kind: 'salamL', pose: 'taslim', sit: sit, turn: -1 });
  return out;
}

/**
 * Every step of a two-rakʿah prayer for this madhab, in order:
 * { id, kind, part ('r1' | 'r2' | 'end'), pose, sit?, turn? }
 */
function getSalahWalkSteps(madhab) {
  var parts = [['r1', _salahRakahSteps(1, madhab)], ['r2', _salahRakahSteps(2, madhab)], ['end', _salahEndSteps(madhab)]];
  var out = [];
  parts.forEach(function (p) {
    p[1].forEach(function (s) {
      s.part = p[0];
      s.id = p[0] + '-' + s.kind;
      out.push(s);
    });
  });
  return out;
}

/** A step's figure: its position, sitting in tawarruk or turned for the salām where the step says. */
function salahWalkFrame(step, madhab) {
  var spec = salahPoseSpec(step.pose, madhab);
  if (step.sit === 'tawarruk') {
    spec.legN = SALAH_TAWARRUK.legN;
    spec.legF = SALAH_TAWARRUK.legF;
    spec.focus = spec.focus.filter(function (k) { return k !== 'toeN'; }).concat(SALAH_TAWARRUK.focus);
  }
  if (step.turn !== undefined) spec.turn = step.turn;
  return salahPoseFrame(spec);
}

function salahWalkLabelKey(step) { return 'salah.walk.step.' + step.kind; }

function salahWalkCaptionKey(step, madhab) {
  var variant = (SALAH_WALK_CAPTIONS[step.kind] || {})[madhab];
  return 'salah.walk.c.' + step.kind + (variant ? '.' + variant : '');
}
