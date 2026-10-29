/**
 * load-components.js — Load the real js/ui/components.js into the global
 * scope, for tests that render UI from a single module without the bundle.
 *
 * UI modules call its icon helpers (uiIcon, iconText, dataIcon) directly, as
 * they can in the bundle where components.js is always loaded first.
 */
var fs = require('fs');
var path = require('path');

module.exports = function loadComponents() {
  if (typeof global.window === 'undefined') global.window = {};
  var code = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'components.js'), 'utf8');
  (0, eval)(code); // indirect eval: declarations become globals
};
