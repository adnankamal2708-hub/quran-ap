/**
 * The app's public root URL, used for Polar return/success links.
 *
 * APP_URL overrides it (e.g. for a custom domain). The default is the live
 * GitHub Pages deployment. Trailing slashes are stripped so callers can
 * append `/?...` safely.
 */

const DEFAULT_APP_URL = 'https://adnankamal2708-hub.github.io/quran-ap';

function getAppUrl() {
  return (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/+$/, '');
}

module.exports = { getAppUrl, DEFAULT_APP_URL };
