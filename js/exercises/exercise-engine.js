/**
 * exercise-engine.js — pure checking and validation for shared exercises.
 *
 * Item shapes (plain data, no DOM, no audio):
 *   read-choose { prompt:{arabic}, options:string[], answer:index, tag }
 *   build       { prompt:{text}, pieces:string[], answer:string[], tag }
 *   spot        { prompt:{text}, tokens:string[], answer:index[], tag }
 * Rendering lives in js/ui/exercise-ui.js.
 */

var EXERCISE_TYPES = ['read-choose', 'build', 'spot'];

function isIndexInRange(value, length) {
  return typeof value === 'number' && value % 1 === 0 && value >= 0 && value < length;
}

function sameOrderedList(left, right) {
  return left.length === right.length && left.every(function(value, i) {
    return value === right[i];
  });
}

// Sorted copies compare equal exactly when the lists hold the same items.
function sameItemsAnyOrder(left, right) {
  return sameOrderedList(left.slice().sort(), right.slice().sort());
}

function checkSpotResponse(item, response) {
  if (!Array.isArray(response)) return false;
  var chosen = [];
  response.forEach(function(index) {
    if (chosen.indexOf(index) === -1) chosen.push(index);
  });
  return sameItemsAnyOrder(chosen, item.answer);
}

/**
 * True when the response solves the item. The response is an option index
 * (read-choose), an ordered piece array (build), or an array of token
 * indexes whose order is ignored (spot).
 */
function checkExercise(item, response) {
  if (!item) return false;
  if (item.type === 'read-choose') return response === item.answer;
  if (item.type === 'build') return Array.isArray(response) && sameOrderedList(response, item.answer);
  if (item.type === 'spot') return checkSpotResponse(item, response);
  return false;
}

function validateReadChoose(item) {
  if (!Array.isArray(item.options)) return 'read-choose options must be an array';
  if (!isIndexInRange(item.answer, item.options.length)) return 'read-choose answer is out of range';
  var distinct = item.options.filter(function(option, i) {
    return item.options.indexOf(option) === i;
  });
  if (distinct.length !== item.options.length) return 'read-choose options are duplicated';
  return null;
}

function validateBuild(item) {
  if (!Array.isArray(item.pieces) || !Array.isArray(item.answer)) return 'build pieces and answer must be arrays';
  if (!sameItemsAnyOrder(item.pieces, item.answer)) return 'build pieces are not a permutation of the answer';
  return null;
}

function validateSpot(item) {
  if (!Array.isArray(item.tokens) || !Array.isArray(item.answer)) return 'spot tokens and answer must be arrays';
  if (item.answer.length === 0) return 'spot answer is empty';
  var inRange = item.answer.every(function(index) {
    return isIndexInRange(index, item.tokens.length);
  });
  return inRange ? null : 'spot answer is out of range';
}

/** Returns an error message for a malformed item, or null when it is valid. */
function validateExercise(item) {
  if (!item || typeof item !== 'object') return 'exercise item is missing';
  if (EXERCISE_TYPES.indexOf(item.type) === -1) return 'unknown exercise type: ' + item.type;
  if (item.type === 'read-choose') return validateReadChoose(item);
  if (item.type === 'build') return validateBuild(item);
  return validateSpot(item);
}
