import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import * as fs from 'fs';
import * as path from 'path';
import { takeStepScreenshot } from './helpers/jet-helpers';

import dotenv from 'dotenv';
import * as pathMod from 'path';
dotenv.config({ path: pathMod.resolve(__dirname, '../.env') });

// ── Constants ─────────────────────────────────────────────────────────────
const OTM_URL       = (process.env.OTM_URL       ?? '').replace(/\/$/, '');
const WM_URL        = process.env.WM_URL          ?? '';
const WS_USER       = process.env.WS_USER         ?? '';
const WS_PASS       = process.env.WS_PASS         ?? '';
const UI_USER       = process.env.OTM_USERNAME    ?? '';
const UI_PASS       = process.env.OTM_PASSWORD    ?? '';
const DELIVERY_NOTE = '0087299329';
const PLACEHOLDER   = '1104191935';
const TOTAL_STEPS   = 43;

const OTM_REGION       = process.env.OTM_REGION       ?? 'poland';
const OTM_REGION_LABEL = process.env.OTM_REGION_LABEL ?? 'Europe - Poland';
const EXTERNAL_RUN_ID  = process.env.OTM_RUN_ID ? parseInt(process.env.OTM_RUN_ID) : null;

const SCREENSHOTS_DIR = path.resolve('test-results');

// ── Live step emitter (portal dashboard) ──────────────────────────────────
function emitStep(opts: {
  step: number; name: string; status: 'running' | 'pass' | 'fail';
  durationMs?: number; screenshot?: string | null; error?: string | null;
}) {
  process.stdout.write(JSON.stringify({
    type:        'step',
    step:        opts.step,
    total:       TOTAL_STEPS,
    name:        opts.name,
    status:      opts.status,
    duration_ms: opts.durationMs ?? null,
    screenshot:  opts.screenshot ?? null,
    error:       opts.error ?? null,
  }) + '\n');
}

// ── DB helpers (same pattern as login.spec.ts) ────────────────────────────
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

// ── Fixture helpers ───────────────────────────────────────────────────────
function generateOrderId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `TEST_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
function loadFixture(filename: string, orderId: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, 'fixtures', filename), 'utf8');
  return raw.split(PLACEHOLDER).join(orderId);
}
async function postXML(xml: string): Promise<{ status: number; body: string }> {
  const creds = Buffer.from(`${WS_USER}:${WS_PASS}`).toString('base64');
  const resp  = await fetch(WM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'Authorization': `Basic ${creds}` },
    body: xml,
  });
  return { status: resp.status, body: await resp.text() };
}
async function captureScreenshot(page: any, filename: string): Promise<string> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const p = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

// ── Test ──────────────────────────────────────────────────────────────────
test.describe('Poland - Kraft Heinz OTM Integration', () => {

  test('Poland OTM E2E - SAP order integration with delivery note', async ({ page }) => {
    test.setTimeout(300_000);

    await allure.epic('OTM Integration');
    await allure.feature('Poland SAP Order Flow');
    await allure.story('T1 initial order → T2 delivery note update');
    await allure.severity('critical');

    const orderId = generateOrderId();
    await allure.parameter('Order ID', orderId);

    const startMs  = Date.now();
    const dbSteps: any[] = [];
    let   lastScreenshot: string | null = null;
    let   errorMsg: string | null = null;

    // Wrapper: emits live events + screenshots + records to DB, mirrors login.spec.ts pattern
    const step = async (num: number, label: string, fn: () => Promise<void>) => {
      emitStep({ step: num, name: label, status: 'running' });
      const t0 = Date.now();
      try {
        await allure.step(label, fn);
        const ss = await takeStepScreenshot(page, label);
        const durationMs = Date.now() - t0;
        if (ss) lastScreenshot = ss;
        emitStep({ step: num, name: label, status: 'pass', durationMs, screenshot: ss });
        dbSteps.push({ name: label, status: 'passed', duration_ms: durationMs, screenshot: ss });
      } catch (e: any) {
        const durationMs = Date.now() - t0;
        errorMsg = e.message;
        const ss = await takeStepScreenshot(page, label + ' (failed)');
        emitStep({ step: num, name: label, status: 'fail', durationMs, error: e.message, screenshot: ss });
        dbSteps.push({ name: label, status: 'failed', duration_ms: durationMs, screenshot: ss });
        throw e;
      }
    };

    // OTM loads finder/detail pages inside an iframe
    const f = page.frameLocator('iframe');

    let t1Result!: { status: number; body: string };
    let t2Result!: { status: number; body: string };

    try {

      // ── LOGIN ──────────────────────────────────────────────────────────
      await step(1, 'Navigate to OTM URL', async () => {
        await page.goto(OTM_URL, { waitUntil: 'domcontentloaded' });
      });

      const SEL_ANY_USER =
        '#idcs-signin-basic-signin-form-username, #username, #userid, ' +
        'input[name="username"], input[name="userid"], input[autocomplete="username"], ' +
        'input[type="text"]:not([hidden])';

      let loginUserSel = '#idcs-signin-basic-signin-form-username, #username, #userid';
      let loginSubmitSel = '#idcs-signin-basic-signin-form-submit, #signin, #submit, input[type="submit"], button[type="submit"]';

      await step(2, 'Login page loaded', async () => {
        await page.waitForSelector(SEL_ANY_USER, { state: 'visible', timeout: 90_000 });
      });

      await step(3, 'Enter username', async () => {
        const field = page.locator(loginUserSel).first();
        await field.waitFor({ state: 'visible', timeout: 15_000 });
        await field.fill(UI_USER);
      });

      await step(4, 'Enter password', async () => {
        const field = page.locator('input[type="password"]').first();
        await field.waitFor({ state: 'visible', timeout: 15_000 });
        await field.fill(UI_PASS);
      });

      await step(5, 'Click Sign In', async () => {
        await page.locator(loginSubmitSel).first().click();
      });

      await step(6, 'Wait for OTM homepage to load', async () => {
        await page.waitForFunction(
          () => !document.title.toLowerCase().includes('sign in'),
          { timeout: 60_000 }
        );
        await page.waitForLoadState('networkidle', { timeout: 60_000 });
      });

      // ── ROLE SWITCH ────────────────────────────────────────────────────
      await step(7, 'Click user menu (LEL7597_TMS)', async () => {
        const menu = page.locator(`[title="${UI_USER}"], button:has-text("${UI_USER}")`).first();
        await menu.waitFor({ state: 'visible', timeout: 20_000 });
        await menu.click();
      });

      await step(8, 'Settings and Actions panel opened', async () => {
        await page.waitForSelector('text=Settings and Actions', { timeout: 15_000 });
      });

      await step(9, 'Select role POLAND_PLANNER', async () => {
        const roleCombo = page.getByRole('combobox', { name: 'User Role' });
        await roleCombo.waitFor({ state: 'visible', timeout: 15_000 });
        await roleCombo.click();
        await page.locator('li:has-text("POLAND_PLANNER")').first().click();
      });

      await step(10, 'Click Save and Close', async () => {
        await page.locator('button:has-text("Save and Close"), input[value="Save and Close"]').first().click();
      });

      await step(11, 'Wait for homepage to reload with new role', async () => {
        await page.waitForLoadState('networkidle', { timeout: 60_000 });
        await page.waitForFunction(
          () => !document.title.toLowerCase().includes('sign in'),
          { timeout: 30_000 }
        );
      });

      // ── SEND T1 ────────────────────────────────────────────────────────
      await step(12, 'Send T1 XML to WMServlet', async () => {
        const xml = loadFixture('poland-t1.xml', orderId);
        t1Result  = await postXML(xml);
      });

      await step(13, 'Verify T1 response is 200 OK', async () => {
        expect(t1Result.status).toBe(200);
      });

      await step(14, 'Verify TransmissionAck received', async () => {
        expect(t1Result.body).toContain('<otm:TransmissionAck');
      });

      // ── SEARCH ORDER AFTER T1 ──────────────────────────────────────────
      await step(15, 'Click Order Release tile', async () => {
        const navBtn = page.getByRole('button', { name: 'Navigator' });
        await navBtn.waitFor({ state: 'visible', timeout: 15_000 });
        await navBtn.click();
        // OTM JET treeview: the inner span bubbles to JET's handler; dispatch on span avoids full-page nav
        const spanLocator = page.locator('[role="treeitem"]:has-text("Order Release") span.oj-treeview-item-text').first();
        await spanLocator.waitFor({ state: 'attached', timeout: 30_000 });
        await page.waitForTimeout(2_000); // let JET attach click handlers
        await spanLocator.dispatchEvent('click');
        await page.locator('iframe').waitFor({ state: 'attached', timeout: 60_000 });
      });

      await step(16, 'Order Release finder opened', async () => {
        await f.getByRole('button', { name: 'Search' }).waitFor({ state: 'visible', timeout: 60_000 });
      });

      await step(17, 'Enter order ID in search field', async () => {
        await f.getByRole('textbox', { name: 'Order Release ID' }).fill(orderId);
      });

      await step(18, 'Click Search', async () => {
        await f.getByRole('button', { name: 'Search' }).first().click();
        await f.locator('text=Total Found:').waitFor({ timeout: 30_000 });
      });

      await step(19, 'Verify Total Found: 1', async () => {
        await expect(f.locator('text=Total Found: 1')).toBeVisible({ timeout: 30_000 });
      });

      const dataRow = () => f.getByRole('row', { name: new RegExp(orderId) }).first();

      await step(20, 'Verify yellow indicator on order row', async () => {
        await expect(f.getByRole('img', { name: /yellow/i })).toBeVisible({ timeout: 15_000 });
      });

      await step(21, 'Verify order status is PLANNING_PLANNED - HOLD', async () => {
        await expect(f.getByRole('gridcell', { name: 'PLANNING_PLANNED - HOLD' })).toBeVisible({ timeout: 15_000 });
      });

      await step(22, 'Verify DELIVERY column is empty', async () => {
        const rowText = await dataRow().textContent() ?? '';
        expect(rowText).not.toContain(DELIVERY_NOTE);
      });

      await step(23, 'Screenshot of T1 state', async () => {
        lastScreenshot = await captureScreenshot(page, 'poland-01-t1-state.png');
      });

      // ── SEND T2 ────────────────────────────────────────────────────────
      await step(24, 'Send T2 XML to WMServlet', async () => {
        const xml = loadFixture('poland-t2.xml', orderId);
        t2Result  = await postXML(xml);
      });

      await step(25, 'Verify T2 response is 200 OK', async () => {
        expect(t2Result.status).toBe(200);
      });

      await step(26, 'Verify TransmissionAck received', async () => {
        expect(t2Result.body).toContain('<otm:TransmissionAck');
      });

      // ── VERIFY T2 STATE ────────────────────────────────────────────────
      await step(27, 'Poll until T2 processed (blue indicator)', async () => {
        await page.keyboard.press('Escape');
        let blueFound = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          await f.getByRole('button', { name: 'New Query' }).click();
          await f.getByRole('button', { name: 'Search' }).waitFor({ state: 'visible', timeout: 30_000 });
          await f.getByRole('textbox', { name: 'Order Release ID' }).fill(orderId);
          await f.getByRole('button', { name: 'Search' }).first().click();
          await f.locator('text=Total Found:').waitFor({ timeout: 30_000 });
          blueFound = await f.getByRole('img', { name: /blue/i }).isVisible({ timeout: 3_000 }).catch(() => false);
          if (blueFound) break;
          await page.waitForTimeout(8_000);
        }
        if (!blueFound) throw new Error('T2 did not produce a blue indicator after polling');
      });

      await step(28, 'Verify blue indicator on order row', async () => {
        await expect(f.getByRole('img', { name: /blue/i })).toBeVisible({ timeout: 5_000 });
      });

      await step(29, 'Verify order status is PLANNING_NEW', async () => {
        await expect(f.getByRole('gridcell', { name: 'PLANNING_NEW' })).toBeVisible({ timeout: 5_000 });
      });

      await step(30, 'Verify DELIVERY column shows 0087299329', async () => {
        await expect(f.locator(`text=${DELIVERY_NOTE}`)).toBeVisible({ timeout: 10_000 });
      });

      await step(31, 'Screenshot of T2 state', async () => {
        lastScreenshot = await captureScreenshot(page, 'poland-02-t2-state.png');
      });

      // ── VERIFY REFERENCE NUMBERS ───────────────────────────────────────
      await step(32, 'Open order detail', async () => {
        await f.getByRole('link', { name: new RegExp(orderId) }).first().click();
        await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
      });

      await step(33, 'Order detail loading', async () => {
        // Wait for iframe to reload with order detail content
        await page.locator('iframe').waitFor({ state: 'attached', timeout: 30_000 });
      });

      await step(34, 'Order detail page loaded', async () => {
        await expect(f.locator(`text=${orderId}`).first()).toBeVisible({ timeout: 30_000 });
      });

      await step(35, 'Scroll to Reference Numbers section', async () => {
        const refSection = f.locator('text=Reference Numbers').first();
        await refSection.waitFor({ timeout: 20_000 });
        await refSection.scrollIntoViewIfNeeded();
      });

      await step(36, 'Reference Numbers section visible', async () => {
        await expect(
          f.locator('table').filter({ has: f.locator('text=Reference Number Qualifier ID') }).first()
        ).toBeVisible({ timeout: 20_000 });
      });

      const assertRefnum = async (qualifier: string, expectedValue: string) => {
        const row   = f.getByRole('row', { name: new RegExp(qualifier) }).first();
        await expect(row).toBeVisible({ timeout: 15_000 });
        const value = (await row.getByRole('cell').nth(1).textContent() ?? '').trim();
        expect(value, `${qualifier} mismatch`).toBe(expectedValue);
      };

      await step(37, 'Verify DELIVERY_NOTE_NUMBER = 0087299329',  async () => { await assertRefnum('DELIVERY_NOTE_NUMBER', '0087299329'); });
      await step(38, 'Verify COMPANY_CODE = 3840',                async () => { await assertRefnum('COMPANY_CODE', '3840'); });
      await step(39, 'Verify CUSTOMER_PO = 2606084341861',        async () => { await assertRefnum('CUSTOMER_PO', '2606084341861'); });
      await step(40, 'Verify PALLET_COUNT = 2',                   async () => { await assertRefnum('PALLET_COUNT', '2'); });
      await step(41, 'Verify PALLET_DECIMAL = 1.818',             async () => { await assertRefnum('PALLET_DECIMAL', '1.818'); });
      await step(42, 'Verify SAP_ORDER_TYPE = ZORS',              async () => { await assertRefnum('SAP_ORDER_TYPE', 'ZORS'); });

      await step(43, 'Screenshot of reference numbers', async () => {
        lastScreenshot = await captureScreenshot(page, 'poland-03-refnums.png');
      });

      // ── Persist result ─────────────────────────────────────────────────
      const durationMs = Date.now() - startMs;
      const video      = page.video();
      await page.close(); // must close before saveAs to finalise the video
      const videoFile  = `poland-e2e-${Date.now()}.webm`;
      const videoDest  = path.resolve(__dirname, '../test-results/videos', videoFile);
      fs.mkdirSync(path.dirname(videoDest), { recursive: true });
      await video?.saveAs(videoDest).catch(() => {});
      saveTestResult(EXTERNAL_RUN_ID, {
        suite_name:      'SAP Integration',
        test_name:       'Poland OTM E2E - SAP order integration with delivery note',
        status:          'passed',
        duration_ms:     durationMs,
        screenshot_path: lastScreenshot,
        video_path:      `test-results/videos/${videoFile}`,
        steps:           dbSteps,
      });

    } catch (e: any) {
      const durationMs = Date.now() - startMs;
      const video      = page.video();
      await page.close();
      const videoFile  = `poland-e2e-${Date.now()}.webm`;
      const videoDest  = path.resolve(__dirname, '../test-results/videos', videoFile);
      fs.mkdirSync(path.dirname(videoDest), { recursive: true });
      await video?.saveAs(videoDest).catch(() => {});
      saveTestResult(EXTERNAL_RUN_ID, {
        suite_name:    'SAP Integration',
        test_name:     'Poland OTM E2E - SAP order integration with delivery note',
        status:        'failed',
        duration_ms:   Date.now() - startMs,
        error_message: errorMsg || e.message,
        video_path:    `test-results/videos/${videoFile}`,
        steps:         dbSteps,
      });
      throw e;
    }
  });
});
