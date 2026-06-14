'use strict';
const { exec }  = require('child_process');
const path      = require('path');
const { createRun, updateRun, getTestsByRunId } = require('../db');

const ROOT = path.join(__dirname, '..', '..');

// ── Shared live state ─────────────────────────────────────────────────────
const live = {
  status:  'idle',
  runId:   null,
  steps:   [],
  clients: new Set(),
};

function broadcastEvent(eventName, data) {
  const msg = 'event: ' + eventName + '\ndata: ' + JSON.stringify(data) + '\n\n';
  live.clients.forEach(c => {
    try { c.write(msg); } catch (_) { live.clients.delete(c); }
  });
}

function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Run a single playwright command, streaming steps ─────────────────────
function runCmd(cmd, env, stepOffset) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { cwd: ROOT, maxBuffer: 20 * 1024 * 1024, env });

    child.on('error', reject);

    let stdoutBuf = '';
    child.stdout.on('data', chunk => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop();
      lines.forEach(line => {
        if (!line.trim()) return;
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'step') {
            const stepped = { ...obj, step: obj.step + stepOffset };
            const idx = live.steps.findIndex(s => s.step === stepped.step);
            if (idx >= 0) live.steps[idx] = stepped;
            else live.steps.push(stepped);
            broadcastEvent('step', stepped);
          }
        } catch (_) {}
      });
    });

    child.stderr.on('data', () => {});
    child.on('close', code => resolve(code));
  });
}

// ── Handler ───────────────────────────────────────────────────────────────
function handleTrigger(req, res, upath) {

  if (req.method === 'GET' && upath === '/api/status') {
    json(res, { status: live.status, runId: live.runId });
    return true;
  }

  if (req.method === 'GET' && upath === '/api/live') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('event: init\ndata: ' + JSON.stringify({
      status: live.status,
      runId:  live.runId,
      steps:  live.steps,
    }) + '\n\n');
    live.clients.add(res);
    req.on('close', () => live.clients.delete(res));
    return true;
  }

  if (req.method === 'POST' && upath === '/api/trigger') {
    if (live.status === 'running') {
      json(res, { error: 'A run is already in progress' }, 409);
      return true;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch (_) {}

      const suite    = payload.suite    || 'all';
      const testCase = payload.testCase || '';

      // Credentials come from .env — no regions.json needed
      // Derive a human-readable run name from the suite/testCase
      const runName = suite === 'all' ? 'OTM Full Suite'
        : testCase.toLowerCase().includes('login') ? 'Login'
        : testCase.toLowerCase().includes('poland') || testCase.toLowerCase().includes('e2e') ? 'Poland OTM E2E'
        : testCase || 'Manual Run';
      const runId    = createRun('manual', runName, 'poland', 'Europe - Poland');
      const runStart = Date.now();
      live.status    = 'running';
      live.runId     = runId;
      live.steps     = [];

      broadcastEvent('start', { runId, status: 'running', region: 'poland', regionLabel: 'Europe - Poland' });

      const baseEnv = {
        ...process.env,
        OTM_RUN_ID:    String(runId),
        OTM_TEST_CASE: testCase,
        HEADLESS:      '1',
      };

      const finish = (exitCode) => {
        const status     = exitCode === 0 ? 'passed' : 'failed';
        const durationMs = Date.now() - runStart;
        live.status      = 'idle';

        const tests  = getTestsByRunId(runId);
        const passed = tests.filter(t => t.status === 'passed').length;
        const failed = tests.filter(t => t.status === 'failed').length;

        updateRun(runId, {
          status,
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          total_tests: tests.length || 1,
          passed:      tests.length ? passed : (exitCode === 0 ? 1 : 0),
          failed:      tests.length ? failed : (exitCode === 0 ? 0 : 1),
        });

        broadcastEvent('done', { status, runId, durationMs });
      };

      const generateReport = () => runCmd('npm run report', baseEnv, 0).catch(() => {});

      if (suite === 'all') {
        runCmd('npm run test:login', { ...baseEnv, OTM_TEST_CASE: 'login' }, 0)
          .then(loginCode => {
            const divider = { type: 'step', step: 11, total: 11, name: '── Poland OTM E2E Starting ──', status: 'pass', duration_ms: 0 };
            live.steps.push(divider);
            broadcastEvent('step', divider);
            return runCmd('npm run test:poland', { ...baseEnv, OTM_TEST_CASE: 'poland-e2e' }, 100)
              .then(polandCode => generateReport().then(() => finish(loginCode === 0 && polandCode === 0 ? 0 : 1)));
          })
          .catch(err => { broadcastEvent('error', { message: err.message }); finish(1); });
      } else {
        const tcLower = testCase.toLowerCase();
        const cmd = tcLower.includes('login') ? 'npm run test:login' : 'npm run test:poland';
        runCmd(cmd, baseEnv, 0)
          .then(code => generateReport().then(() => finish(code)))
          .catch(err => { broadcastEvent('error', { message: err.message }); finish(1); });
      }

      json(res, { runId, status: 'started' });
    });
    return true;
  }

  return false;
}

module.exports = handleTrigger;
