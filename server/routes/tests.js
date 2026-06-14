'use strict';
const path = require('path');
const fs = require('fs');
const { getTestById } = require('../db');

const ROOT           = path.join(__dirname, '..', '..');
const SCREENSHOTS    = path.join(ROOT, 'test-results', 'screenshots');
const TEST_RESULTS   = path.join(ROOT, 'test-results');

function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleTests(req, res, upath) {
  if (req.method !== 'GET') return false;

  // GET /api/screenshots — list available screenshots sorted newest first
  if (upath === '/api/screenshots') {
    if (!fs.existsSync(SCREENSHOTS)) { json(res, []); return true; }
    const files = fs.readdirSync(SCREENSHOTS)
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
      .map(f => {
        const mtime = fs.statSync(path.join(SCREENSHOTS, f)).mtime;
        return {
          filename: f,
          url:      '/screenshots/' + f,
          label:    f.replace(/[_-]\d{10,}\.png$/i, '').replace(/_/g, ' '),
          mtime:    mtime.getTime(),
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    json(res, files);
    return true;
  }

  const testMatch = upath.match(/^\/api\/tests\/(\d+)$/);
  if (testMatch) {
    const t = getTestById(parseInt(testMatch[1]));
    if (!t) { json(res, { error: 'Not found' }, 404); return true; }
    try { t.steps = JSON.parse(t.steps || '[]'); } catch (_) { t.steps = []; }
    json(res, t);
    return true;
  }

  const ssMatch = upath.match(/^\/api\/screenshots\/(.+)$/);
  if (ssMatch) {
    const name = decodeURIComponent(ssMatch[1]);
    // Try screenshots subfolder first, then flat test-results root
    const candidates = [
      path.join(SCREENSHOTS, name),
      path.join(TEST_RESULTS, name),
      path.join(TEST_RESULTS, path.basename(name)),
    ];
    const file = candidates.find(f => fs.existsSync(f));
    if (!file) { res.writeHead(404); res.end(); return true; }
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  const vidMatch = upath.match(/^\/api\/videos\/(.+)$/);
  if (vidMatch) {
    const file = path.join(TEST_RESULTS, decodeURIComponent(vidMatch[1]));
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return true; }
    const stat = fs.statSync(file);
    res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  return false;
}

module.exports = handleTests;
