// Serves the production build (dist/) for the e2e tests. Every path is read
// from dist/, so a test sees exactly what is deployed. A missing file with an
// extension is a 404 (a missing script must fail, not load as HTML); any other
// missing path falls back to the app's index.html.
var http = require('http');
var fs = require('fs');
var path = require('path');
var DIST = path.join(__dirname, 'dist');
var PORT = Number(process.env.E2E_PORT) || 8080;
var server = http.createServer(function(req, res) {
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  var filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (filePath.indexOf(DIST) !== 0) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    var content = fs.readFileSync(filePath);
    var ext = path.extname(filePath);
    var types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(content);
  } catch(e) {
    if (path.extname(urlPath)) {
      res.writeHead(404);
      res.end('Not found: ' + urlPath);
      return;
    }
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(DIST, 'index.html')));
    } catch(e2) {
      res.writeHead(404);
      res.end('Not found: ' + urlPath);
    }
  }
});
server.listen(PORT, '127.0.0.1', function() {
  console.log('E2E server on http://127.0.0.1:' + PORT);
});
