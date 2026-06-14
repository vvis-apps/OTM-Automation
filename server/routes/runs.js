'use strict';
const { getRuns, getRunById, getTestsByRunId, getPassRateTrend, getFlakySteps, getPhaseTimingFromLastRun } = require('../db');

function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleRuns(req, res, upath) {
  if (req.method !== 'GET') return false;

  if (upath === '/api/runs') {
    const qs    = new URL(req.url, 'http://localhost').searchParams;
    const limit = parseInt(qs.get('limit') || '50', 10);
    json(res, getRuns(isNaN(limit) ? 50 : limit));
    return true;
  }

  if (upath === '/api/trend' || upath === '/api/pass-rate-trend') {
    json(res, getPassRateTrend());
    return true;
  }

  if (upath === '/api/flaky-steps') {
    json(res, getFlakySteps());
    return true;
  }

  if (upath === '/api/phase-timing') {
    json(res, getPhaseTimingFromLastRun());
    return true;
  }

  const runMatch = upath.match(/^\/api\/runs\/(\d+)$/);
  if (runMatch) {
    const run = getRunById(parseInt(runMatch[1]));
    if (!run) { json(res, { error: 'Not found' }, 404); return true; }
    const tests = getTestsByRunId(run.id).map(t => {
      try { t.steps = JSON.parse(t.steps || '[]'); } catch (_) { t.steps = []; }
      return t;
    });
    json(res, { ...run, tests });
    return true;
  }

  const testsMatch = upath.match(/^\/api\/runs\/(\d+)\/tests$/);
  if (testsMatch) {
    json(res, getTestsByRunId(parseInt(testsMatch[1])));
    return true;
  }

  return false;
}

module.exports = handleRuns;
