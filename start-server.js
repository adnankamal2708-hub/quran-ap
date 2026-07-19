var http = require('http');
var fs = require('fs');
var path = require('path');
var server = http.createServer(function(req, res) {
  var filePath = req.url === '/' ? '/dist/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  try {
    var content = fs.readFileSync(filePath);
    var ext = path.extname(filePath);
    var types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(content);
  } catch(e) {
    try {
      // Fallback to root index.html
      var content = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch(e2) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
    }
  }
});
server.listen(8082, '127.0.0.1', function() {
  console.log('Server on http://127.0.0.1:8082');
});
