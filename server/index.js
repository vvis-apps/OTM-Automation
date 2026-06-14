'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const fs   = require('fs');
const path = require('path');

const handleRuns     = require('./routes/runs');
const handleTests    = require('./routes/tests');
const handleTrigger  = require('./routes/trigger');
const handleRegistry = require('./routes/registry');

const PORT        = process.env.PORT || 3000;

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
const ALLURE_DIR  = path.join(__dirname, '..', 'allure-report');

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webm': 'video/webm',
  '.mp4':  'video/mp4',
};

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  const upath = (req.url || '/').split('?')[0];

  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API routes ─────────────────────────────────────────────────────────
  if (upath.startsWith('/api/')) {


    if (handleRegistry(req, res, upath)) return;
    if (handleRuns(req, res, upath))     return;
    if (handleTests(req, res, upath))    return;
    if (handleTrigger(req, res, upath))  return;
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  // ── Allure report ──────────────────────────────────────────────────────
  if (upath.startsWith('/report')) {
    const rel  = upath === '/report' || upath === '/report/' ? 'index.html' : upath.replace(/^\/report\/?/, '');
    const file = path.join(ALLURE_DIR, rel);
    if (!serveFile(res, file)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2 style="font-family:sans-serif;padding:40px;color:#64748b">No Allure report found.<br>Run tests first, then click the report link again.</h2>');
    }
    return;
  }

  // ── Screenshots & videos from test-results/ ───────────────────────────
  if (upath.startsWith('/test-results/') || upath.startsWith('/screenshots/')) {
    const rel      = upath.replace(/^\/(test-results|screenshots)\//, '');
    const base     = path.basename(rel);
    const TR       = path.join(__dirname, '..', 'test-results');
    // Try: exact path, screenshots subfolder, flat root
    if (serveFile(res, path.join(TR, rel)))                    return;
    if (serveFile(res, path.join(TR, 'screenshots', base)))    return;
    if (serveFile(res, path.join(TR, base)))                   return;
  }

  // ── React SPA (client/dist) ────────────────────────────────────────────
  // Try exact static asset first
  if (upath !== '/' && serveFile(res, path.join(CLIENT_DIST, upath))) return;

  // SPA fallback → index.html
  const indexFile = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexFile).pipe(res);
    return;
  }

  // Client not built yet
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .box{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:40px;max-width:520px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.06)}
    h2{color:#1e3a8a;margin-bottom:16px}p{color:#64748b;line-height:1.6}code{background:#f1f5f9;padding:2px 8px;border-radius:6px;color:#334155;font-size:.85em}</style>
    </head><body><div class="box">
    <h2>⚡ OTM Automation Portal</h2>
    <p>The React frontend has not been built yet.</p>
    <p>Run: <code>cd client &amp;&amp; npm install &amp;&amp; npm run build</code></p>
    <p style="margin-top:16px">Then restart the server.</p>
    </div></body></html>`);
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n[ERROR] Port ' + PORT + ' is already in use.\nRun: Stop-Process -Id (Get-NetTCPConnection -LocalPort ' + PORT + ').OwningProcess -Force\n');
    process.exit(1);
  } else {
    throw e;
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ╔══════════════════════════════════════════╗');
  console.log('  ║   OTM Automation Portal                  ║');
  console.log('  ║   http://localhost:' + PORT + '                  ║');
  console.log('  ╚══════════════════════════════════════════╝\n');
  if (process.platform === 'win32') {
    require('child_process').exec('start http://localhost:' + PORT);
  }
});
