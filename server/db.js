'use strict';
const Database = require('better-sqlite3');
const path = require('path');

// Use /tmp on Render (read-only filesystem); fall back to project root locally
const DB_PATH = process.env.RENDER
  ? path.join('/tmp', 'otm-portal.db')
  : path.join(__dirname, '..', 'otm-portal.db');

let _db = null;

function db() {
  if (!_db) {
    console.log('[db] opening:', DB_PATH);
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initSchema(_db);
    migrate(_db);
    const count = _db.prepare('SELECT COUNT(*) as n FROM test_suites').get().n;
    console.log('[db] test_suites count:', count);
    if (count === 0) {
      console.log('[db] seeding registry data...');
      seedRegistry(_db);
      console.log('[db] seeding complete');
    }
  }
  return _db;
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT    NOT NULL DEFAULT 'manual',
      status       TEXT    NOT NULL DEFAULT 'running',
      started_at   TEXT    NOT NULL,
      finished_at  TEXT,
      total_tests  INTEGER DEFAULT 0,
      passed       INTEGER DEFAULT 0,
      failed       INTEGER DEFAULT 0,
      skipped      INTEGER DEFAULT 0,
      duration_ms  INTEGER DEFAULT 0,
      environment  TEXT    DEFAULT 'test',
      region       TEXT    DEFAULT 'north-america',
      region_label TEXT    DEFAULT 'North America'
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id          INTEGER NOT NULL,
      suite_name      TEXT,
      test_name       TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'running',
      duration_ms     INTEGER DEFAULT 0,
      error_message   TEXT,
      screenshot_path TEXT,
      video_path      TEXT,
      steps           TEXT    DEFAULT '[]',
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE TABLE IF NOT EXISTS test_suites (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      region      TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      description TEXT,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      suite_id        INTEGER NOT NULL REFERENCES test_suites(id),
      region          TEXT    NOT NULL,
      name            TEXT    NOT NULL,
      description     TEXT,
      preconditions   TEXT,
      steps           TEXT    DEFAULT '[]',
      expected_result TEXT,
      is_active       INTEGER DEFAULT 1,
      priority        TEXT    DEFAULT 'medium',
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );
  `);
}

function migrate(d) {
  const runCols = d.prepare(`PRAGMA table_info(runs)`).all().map(c => c.name);
  if (!runCols.includes('region'))       d.exec(`ALTER TABLE runs ADD COLUMN region TEXT DEFAULT 'north-america'`);
  if (!runCols.includes('region_label')) d.exec(`ALTER TABLE runs ADD COLUMN region_label TEXT DEFAULT 'North America'`);
}

// ── Seed ─────────────────────────────────────────────────────────────────
function seedRegistry(d) {
  const insertSuite = d.prepare(
    `INSERT INTO test_suites (region, name, description) VALUES (?, ?, ?)`
  );
  const insertCase = d.prepare(`
    INSERT INTO test_cases
      (suite_id, region, name, description, preconditions, steps, expected_result, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const suite = insertSuite.run('poland', 'OTM Automation', 'Oracle Transportation Management automated test cases').lastInsertRowid;

  insertCase.run(suite, 'poland',
    'Login',
    'Verify successful login to OTM with valid credentials',
    'Valid user credentials exist. OTM instance is accessible.',
    JSON.stringify([
      'Navigate to the OTM URL',
      'Wait for Oracle IDCS sign-in page to load',
      'Enter username in the username field',
      'Enter password in the password field',
      'Click the Sign In button',
      'Wait for OTM homepage to load',
      'Verify OTM homepage is displayed',
      'Capture homepage screenshot',
    ]),
    'User is successfully logged in and OTM homepage is displayed.',
    'high'
  );

  insertCase.run(suite, 'poland',
    'Poland OTM E2E - SAP order integration with delivery note',
    'End-to-end SAP order flow: login, role switch to POLAND_PLANNER, send T1 initial order, send T2 delivery note update, and verify all reference numbers in OTM.',
    'OTM instance accessible. WMServlet credentials valid. XML fixtures present. User LEL7597_TMS with POLAND_PLANNER role exists.',
    JSON.stringify([
      'Navigate to OTM URL','Login page loaded','Enter username (LEL7597_TMS)','Enter password','Click Sign In','Wait for OTM homepage to load',
      'Click user menu','Settings and Actions panel opened','Select role POLAND_PLANNER','Click Save and Close','Wait for homepage to reload with new role',
      'Send T1 XML to WMServlet','Verify T1 response is 200 OK','Verify TransmissionAck received',
      'Open Order Release finder','Order Release finder loaded','Enter order ID','Click Search','Verify Total Found: 1',
      'Verify yellow indicator (HOLD)','Verify status PLANNING_PLANNED - HOLD','Verify DELIVERY column is empty','Screenshot T1 state',
      'Send T2 XML to WMServlet','Verify T2 response is 200 OK','Verify TransmissionAck received',
      'Poll until blue indicator appears','Verify blue indicator (NEW)','Verify status PLANNING_NEW',
      'Verify DELIVERY column shows 0087299329','Screenshot T2 state',
      'Open order detail','Order detail loading','Order detail page loaded','Scroll to Reference Numbers','Reference Numbers section visible',
      'Verify DELIVERY_NOTE_NUMBER = 0087299329','Verify COMPANY_CODE = 3840','Verify CUSTOMER_PO = 2606084341861',
      'Verify PALLET_COUNT = 2','Verify PALLET_DECIMAL = 1.818','Verify SAP_ORDER_TYPE = ZORS','Screenshot reference numbers',
    ]),
    'SAP order created via T1, updated with delivery note via T2, all 6 reference numbers verified in OTM.',
    'high'
  );
}

// ── Run functions ─────────────────────────────────────────────────────────
function createRun(triggerType, environment, region, regionLabel) {
  const r = db().prepare(
    `INSERT INTO runs (trigger_type, status, started_at, environment, region, region_label)
     VALUES (?, 'running', datetime('now'), ?, ?, ?)`
  ).run(triggerType || 'manual', environment || 'test', region || 'north-america', regionLabel || 'North America');
  return r.lastInsertRowid;
}

function updateRun(runId, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const set = keys.map(k => k + ' = ?').join(', ');
  db().prepare(`UPDATE runs SET ${set} WHERE id = ?`).run(...Object.values(data), runId);
}

function saveTestResult(runId, result) {
  const r = db().prepare(`
    INSERT INTO test_results
      (run_id,suite_name,test_name,status,duration_ms,error_message,screenshot_path,video_path,steps)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(runId, result.suite_name || '', result.test_name, result.status,
    result.duration_ms || 0, result.error_message || null,
    result.screenshot_path || null, result.video_path || null,
    JSON.stringify(result.steps || []));
  return r.lastInsertRowid;
}

function getRuns(limit)          { return db().prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit || 50); }
function getRunById(runId)       { return db().prepare('SELECT * FROM runs WHERE id = ?').get(runId); }
function getTestsByRunId(runId)  { return db().prepare('SELECT * FROM test_results WHERE run_id = ? ORDER BY id').all(runId); }
function getTestById(testId)     { return db().prepare('SELECT * FROM test_results WHERE id = ?').get(testId); }

function getPassRateTrend() {
  return db().prepare(`
    SELECT id, started_at, total_tests, passed, failed, region, region_label,
           CASE WHEN total_tests > 0 THEN ROUND(100.0*passed/total_tests,1) ELSE 0 END AS pass_rate
    FROM runs WHERE status IN ('passed','failed') ORDER BY id DESC LIMIT 10
  `).all().reverse();
}

// ── Registry — Suite functions ────────────────────────────────────────────
function getSuitesByRegion(region) {
  const suites = db().prepare('SELECT * FROM test_suites WHERE region = ? ORDER BY name').all(region);
  return suites.map(s => ({
    ...s,
    case_count: db().prepare('SELECT COUNT(*) as n FROM test_cases WHERE suite_id = ?').get(s.id).n,
    active_count: db().prepare("SELECT COUNT(*) as n FROM test_cases WHERE suite_id = ? AND is_active = 1").get(s.id).n,
  }));
}

function createSuite(region, data) {
  const r = db().prepare(
    `INSERT INTO test_suites (region, name, description, is_active) VALUES (?, ?, ?, 1)`
  ).run(region, data.name, data.description || null);
  return r.lastInsertRowid;
}

function updateSuite(id, data) {
  const fields = [];
  const vals   = [];
  if (data.name        !== undefined) { fields.push('name = ?');        vals.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); vals.push(data.description); }
  if (data.is_active   !== undefined) { fields.push('is_active = ?');   vals.push(data.is_active); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now')");
  db().prepare(`UPDATE test_suites SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
}

function deleteSuite(id) {
  db().prepare('DELETE FROM test_cases WHERE suite_id = ?').run(id);
  db().prepare('DELETE FROM test_suites WHERE id = ?').run(id);
}

// ── Registry — Case functions ─────────────────────────────────────────────
function getTestCasesBySuite(suiteId) {
  return db().prepare(`
    SELECT tc.*,
      tr.status       AS last_run_status,
      tr.duration_ms  AS last_run_duration_ms,
      r.finished_at   AS last_run_at
    FROM test_cases tc
    LEFT JOIN test_results tr ON tr.id = (
      SELECT id FROM test_results
      WHERE test_name = tc.name
         OR suite_name = tc.name
         OR test_name LIKE '%' || tc.name || '%'
         OR suite_name LIKE '%' || tc.name || '%'
      ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN runs r ON r.id = tr.run_id
    WHERE tc.suite_id = ?
    ORDER BY tc.priority DESC, tc.name
  `).all(suiteId);
}

function getTestCasesByRegion(region) {
  return db().prepare('SELECT * FROM test_cases WHERE region = ? ORDER BY suite_id, name').all(region);
}

function getTestCaseById(id) {
  return db().prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
}

function createTestCase(suiteId, region, data) {
  const r = db().prepare(`
    INSERT INTO test_cases (suite_id,region,name,description,preconditions,steps,expected_result,priority,is_active)
    VALUES (?,?,?,?,?,?,?,?,1)
  `).run(suiteId, region, data.name, data.description || null, data.preconditions || null,
    JSON.stringify(data.steps || []), data.expected_result || null, data.priority || 'medium');
  return r.lastInsertRowid;
}

function updateTestCase(id, data) {
  const fields = [];
  const vals   = [];
  const map = { name:1, description:1, preconditions:1, expected_result:1, priority:1, is_active:1 };
  Object.entries(data).forEach(([k, v]) => {
    if (map[k]) { fields.push(k + ' = ?'); vals.push(v); }
  });
  if (data.steps !== undefined) { fields.push('steps = ?'); vals.push(JSON.stringify(data.steps)); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now')");
  db().prepare(`UPDATE test_cases SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
}

function deleteTestCase(id) {
  db().prepare('DELETE FROM test_cases WHERE id = ?').run(id);
}

function getLatestStepsForTestName(testName) {
  // Try exact match, then suite_name match, then partial test_name match
  let row = db().prepare(
    `SELECT steps FROM test_results WHERE test_name=? ORDER BY id DESC LIMIT 1`
  ).get(testName);
  if (!row) {
    row = db().prepare(
      `SELECT steps FROM test_results WHERE suite_name LIKE ? ORDER BY id DESC LIMIT 1`
    ).get('%' + testName + '%');
  }
  if (!row) {
    row = db().prepare(
      `SELECT steps FROM test_results WHERE test_name LIKE ? ORDER BY id DESC LIMIT 1`
    ).get('%' + testName + '%');
  }
  return row ? row.steps : null;
}

// ── Analytics ─────────────────────────────────────────────────────────────
function getFlakySteps() {
  const rows = db().prepare(
    "SELECT steps FROM test_results WHERE steps IS NOT NULL AND steps != '[]' ORDER BY id DESC LIMIT 40"
  ).all();
  const map = {};
  for (const r of rows) {
    let steps; try { steps = JSON.parse(r.steps); } catch (_) { continue; }
    for (const s of steps) {
      if (!s.name) continue;
      if (!map[s.name]) map[s.name] = { pass: 0, fail: 0 };
      if (s.status === 'pass' || s.status === 'passed') map[s.name].pass++;
      else if (s.status === 'fail' || s.status === 'failed') map[s.name].fail++;
    }
  }
  return Object.entries(map)
    .filter(([, v]) => v.pass > 0 && v.fail > 0)
    .map(([name, v]) => ({ name, pass: v.pass, fail: v.fail }))
    .sort((a, b) => b.fail - a.fail);
}

function getPhaseTimingFromLastRun() {
  // Prefer a full-suite run (>=2 tests) so all 7 phases have data; fall back to any run
  const run = db().prepare(
    "SELECT * FROM runs WHERE status IN ('passed','failed') AND total_tests >= 2 ORDER BY id DESC LIMIT 1"
  ).get() || db().prepare(
    "SELECT * FROM runs WHERE status IN ('passed','failed') ORDER BY id DESC LIMIT 1"
  ).get();

  const ALL_PHASES = [
    { name: 'Login',              ms: 0, keywords: ['navigat','idcs','oracle','sign in','username','password','login page','click sign','verifying otm','wait for otm','capturing homepage','homepage loaded'] },
    { name: 'Role Switch',        ms: 0, keywords: ['role','planner','save and close','user menu','settings and actions','reload with'] },
    { name: 'Send T1',            ms: 0, keywords: ['send t1','t1 xml','wmservlet','transmissionack','t1 response','verify t1'] },
    { name: 'Search & Verify T1', ms: 0, keywords: ['order release','finder','search','total found','yellow indicator','planning_planned','hold','delivery column is empty','screenshot t1'] },
    { name: 'Send T2',            ms: 0, keywords: ['send t2','t2 xml','t2 response','verify t2','delivery note'] },
    { name: 'T2 Polling',         ms: 0, keywords: ['poll','blue indicator','planning_new','delivery column shows','screenshot t2','open order','order detail'] },
    { name: 'Reference Numbers',  ms: 0, keywords: ['reference','scroll to','delivery_note_number','company_code','customer_po','pallet','sap_order','screenshot reference'] },
  ];

  if (run) {
    const tests = db().prepare('SELECT steps FROM test_results WHERE run_id = ?').all(run.id);
    for (const t of tests) {
      let steps; try { steps = JSON.parse(t.steps || '[]'); } catch (_) { continue; }
      for (const s of steps) {
        const n = (s.name || '').toLowerCase();
        const ms = s.duration_ms || 0;
        for (const p of ALL_PHASES) {
          if (p.keywords.some(k => n.includes(k))) { p.ms += ms; break; }
        }
      }
    }
  }

  // Always return all 7 phases; zero-time phases show as 0s
  return ALL_PHASES.map(p => ({ name: p.name, seconds: Math.round(p.ms / 1000) }));
}

module.exports = {
  createRun, updateRun, saveTestResult,
  getRuns, getRunById, getTestsByRunId, getTestById, getPassRateTrend,
  getSuitesByRegion, createSuite, updateSuite, deleteSuite,
  getTestCasesBySuite, getTestCasesByRegion, getTestCaseById,
  createTestCase, updateTestCase, deleteTestCase,
  getLatestStepsForTestName,
  getFlakySteps, getPhaseTimingFromLastRun,
};
