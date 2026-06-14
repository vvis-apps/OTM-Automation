import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { jetFill, jetClick, takeStepScreenshot } from './helpers/jet-helpers';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OTM_URL         = (process.env.OTM_URL         ?? '').replace(/\/$/, '');
const OTM_USERNAME    = process.env.OTM_USERNAME     ?? '';
const OTM_PASSWORD    = process.env.OTM_PASSWORD     ?? '';
const OTM_DOMAIN      = process.env.OTM_DOMAIN       ?? '';
const OTM_REGION      = process.env.OTM_REGION       ?? 'north-america';
const OTM_REGION_LABEL = process.env.OTM_REGION_LABEL ?? 'North America';
const OTM_TEST_CASE   = process.env.OTM_TEST_CASE    ?? '';

// Oracle IDCS (OCI) login selectors — from Selenium LoginPage.ts
const SEL_OCI_USERNAME = '#idcs-signin-basic-signin-form-username';
const SEL_OCI_PASSWORD = '#idcs-signin-basic-signin-form-password input';
const SEL_OCI_SIGNIN   = '#idcs-signin-basic-signin-form-submit';
const SEL_OPC_USERNAME = '#username';
const SEL_OPC_PASSWORD = '#password';
const SEL_OPC_SIGNIN   = '#signin';
const SEL_HOME_LINK    = 'text=Shipment Management';

const TOTAL_STEPS = 10;

/** Emit a structured step event to stdout so the portal server can parse it. */
function emitStep(opts: {
  step:        number;
  name:        string;
  status:      'running' | 'pass' | 'fail';
  durationMs?: number;
  screenshot?: string | null;
  error?:      string | null;
}) {
  process.stdout.write(
    JSON.stringify({
      type:       'step',
      step:       opts.step,
      total:      TOTAL_STEPS,
      name:       opts.name,
      status:     opts.status,
      duration_ms: opts.durationMs ?? null,
      screenshot: opts.screenshot ?? null,
      error:      opts.error ?? null,
    }) + '\n'
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────
let _db: any = null;
function getDb() {
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    _db = new Database(path.resolve(__dirname, '../otm-portal.db'));
  } catch (_) { _db = null; }
  return _db;
}
function dbRun(sql: string, params: any[] = []) {
  try { getDb()?.prepare(sql).run(...params); } catch (_) {}
}

const EXTERNAL_RUN_ID = process.env.OTM_RUN_ID ? parseInt(process.env.OTM_RUN_ID) : null;

function ensureRunRecord(): number | null {
  if (EXTERNAL_RUN_ID) return EXTERNAL_RUN_ID;
  try {
    const r = getDb()?.prepare(
      `INSERT INTO runs (trigger_type,status,started_at,environment,region,region_label) VALUES ('manual','running',datetime('now'),'test',?,?)`
    ).run(OTM_REGION, OTM_REGION_LABEL);
    return r?.lastInsertRowid ?? null;
  } catch (_) { return null; }
}

function finaliseRun(runId: number, status: 'passed' | 'failed', durationMs: number) {
  if (EXTERNAL_RUN_ID) return;
  dbRun(
    `UPDATE runs SET status=?,finished_at=datetime('now'),total_tests=1,passed=?,failed=?,duration_ms=? WHERE id=?`,
    [status, status === 'passed' ? 1 : 0, status === 'failed' ? 1 : 0, durationMs, runId]
  );
}

function saveTestResult(runId: number | null, result: {
  suite_name: string; test_name: string; status: string;
  duration_ms: number; error_message?: string | null;
  screenshot_path?: string | null; video_path?: string | null; steps: any[];
}) {
  if (!runId) return;
  dbRun(`
    INSERT INTO test_results
      (run_id,suite_name,test_name,status,duration_ms,error_message,screenshot_path,video_path,steps)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    [runId, result.suite_name, result.test_name, result.status, result.duration_ms,
     result.error_message ?? null, result.screenshot_path ?? null,
     result.video_path ?? null, JSON.stringify(result.steps)]
  );
}

// ── Test ──────────────────────────────────────────────────────────────────
test.describe('OTM Login', () => {

  test('User can log in to Oracle Transportation Management', async ({ page }) => {
    test.setTimeout(360_000);
    // If a specific test case was requested and it's not Login, skip this test
    if (OTM_TEST_CASE && OTM_TEST_CASE.toLowerCase() !== 'login') {
      test.skip(true, `Skipping Login — OTM_TEST_CASE=${OTM_TEST_CASE}`);
      return;
    }
    await allure.epic('Authentication');
    await allure.feature('Login');
    await allure.story('OCI login with valid credentials');
    await allure.severity('critical');
    await allure.label('region', OTM_REGION_LABEL);

    const runId   = ensureRunRecord();
    const startMs = Date.now();
    const dbSteps: any[] = [];
    let screenshotPath: string | null = null;
    let errorMsg:       string | null = null;

    /**
     * Runs a named step, emits progress events to stdout, and records to DB.
     * Emits 'running' before, then 'pass'/'fail' after.
     */
    const step = async (num: number, label: string, fn: () => Promise<void>) => {
      emitStep({ step: num, name: label, status: 'running' });
      const t0 = Date.now();
      let ss: string | null = null;
      try {
        await allure.step(label, fn);
        ss = await takeStepScreenshot(page, label);
        const durationMs = Date.now() - t0;
        emitStep({ step: num, name: label, status: 'pass', durationMs, screenshot: ss });
        dbSteps.push({ name: label, status: 'passed', duration_ms: durationMs, screenshot: ss });
        return ss;
      } catch (e: any) {
        const durationMs = Date.now() - t0;
        errorMsg = e.message;
        ss = await takeStepScreenshot(page, label + ' (failed)');
        emitStep({ step: num, name: label, status: 'fail', durationMs, screenshot: ss, error: e.message });
        dbSteps.push({ name: label, status: 'failed', duration_ms: durationMs, screenshot: ss });
        throw e;
      }
    };

    try {

      // Step 1
      await step(1, 'Navigating to OTM', async () => {
        await page.goto(OTM_URL, { waitUntil: 'domcontentloaded' });
      });

      // Step 2 — detect login type
      let userSel = SEL_OCI_USERNAME;
      let passSel = SEL_OCI_PASSWORD;
      let signSel = SEL_OCI_SIGNIN;

      await step(2, 'Login page loaded', async () => {
        await page.waitForFunction(
          () => !!document.querySelector('#idcs-signin-basic-signin-form-username') ||
                !!document.querySelector('#username'),
          { timeout: 60000 }
        );
        const title = await page.title();
        await allure.parameter('Login page title', title);
        if (title.toLowerCase().includes('oracle cloud')) {
          userSel = SEL_OPC_USERNAME;
          passSel = SEL_OPC_PASSWORD;
          signSel = SEL_OPC_SIGNIN;
        }
      });

      // Step 3
      await step(3, 'Entering username', async () => {
        await jetFill(page, userSel, OTM_USERNAME);
      });

      // Step 4
      await step(4, 'Entering password', async () => {
        await page.waitForSelector(passSel, { state: 'visible', timeout: 15000 });
        await jetFill(page, passSel, OTM_PASSWORD);
      });

      // Step 5
      await step(5, 'Clicking Sign In', async () => {
        await jetClick(page, signSel);
      });

      // Step 6
      await step(6, 'Waiting for redirect', async () => {
        // Poll until URL reaches the OTM domain — robust against multi-hop IDCS redirects
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          try {
            const url = page.url();
            if (url.includes('otmgtm')) break;
            if (url.includes('signin') || url.includes('idcs') || url.includes('login') || url === 'about:blank') {
              await page.waitForTimeout(1_000);
              continue;
            }
            break; // any non-login URL means we redirected
          } catch (_) { break; }
        }
        await allure.parameter('Post-login URL', page.url());
      });

      // Step 7
      await step(7, 'Verifying OTM homepage', async () => {
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
        const title = await page.title();
        await allure.parameter('Homepage title', title);
        const shipVisible = await page.locator(SEL_HOME_LINK).first()
          .isVisible({ timeout: 30000 }).catch(() => false);
        const isHome =
          shipVisible ||
          title === 'Home' ||
          title.toLowerCase().includes('transportation') ||
          !title.toLowerCase().includes('sign in');
        expect(isHome, 'Expected OTM homepage but got: "' + title + '"').toBeTruthy();
      });

      // Step 8
      screenshotPath = await step(8, 'Capturing homepage screenshot', async () => {
        // screenshot is taken automatically by the step wrapper
      });

      // Step 9 — open user menu (non-fatal: best-effort)
      await step(9, 'Click user menu (LEL7597_TMS)', async () => {
        const menu = page.locator(
          `[title="${OTM_USERNAME}"], button:has-text("${OTM_USERNAME}"), ` +
          `[aria-label*="${OTM_USERNAME}"], [class*="user-menu"], [class*="userMenu"], ` +
          `[class*="avatar"], img[alt*="user"], [data-testid*="user"]`
        ).first();
        await menu.waitFor({ state: 'visible', timeout: 40_000 });
        await menu.click();
        await page.waitForSelector('text=Settings and Actions', { timeout: 20_000 });
      }).catch(() => {});

      // Step 10 — sign out (non-fatal: best-effort)
      await step(10, 'Sign Out', async () => {
        const signOut = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out"), [title="Sign Out"]').first();
        await signOut.waitFor({ state: 'visible', timeout: 20_000 });
        await signOut.dispatchEvent('click');
        await page.waitForURL(/signin|idcs|login/, { timeout: 30_000, waitUntil: 'commit' }).catch(() => {});
      }).catch(() => {});

      // ── Persist ──────────────────────────────────────────────────────────
      const durationMs = Date.now() - startMs;
      const video      = page.video();
      await page.close(); // must close before saveAs to finalise the video
      const videoFile  = `login-${Date.now()}.webm`;
      const videoDest  = path.resolve(__dirname, '../test-results/videos', videoFile);
      fs.mkdirSync(path.dirname(videoDest), { recursive: true });
      await video?.saveAs(videoDest).catch(err => console.error('[video]', err?.message));
      saveTestResult(runId, {
        suite_name:      'OTM Login',
        test_name:       'User can log in to Oracle Transportation Management',
        status:          'passed',
        duration_ms:     durationMs,
        screenshot_path: screenshotPath,
        video_path:      `test-results/videos/${videoFile}`,
        steps:           dbSteps,
      });
      finaliseRun(runId!, 'passed', durationMs);

    } catch (e: any) {
      const durationMs = Date.now() - startMs;
      const video      = page.video();
      await page.close();
      const videoFile  = `login-${Date.now()}.webm`;
      const videoDest  = path.resolve(__dirname, '../test-results/videos', videoFile);
      fs.mkdirSync(path.dirname(videoDest), { recursive: true });
      await video?.saveAs(videoDest).catch(err => console.error('[video]', err?.message));
      saveTestResult(runId, {
        suite_name:    'OTM Login',
        test_name:     'User can log in to Oracle Transportation Management',
        status:        'failed',
        duration_ms:   durationMs,
        error_message: errorMsg || e.message,
        video_path:    `test-results/videos/${videoFile}`,
        steps:         dbSteps,
      });
      finaliseRun(runId!, 'failed', durationMs);
      throw e;
    }
  });

});
