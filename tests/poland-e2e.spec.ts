import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import * as fs from 'fs';
import * as path from 'path';

// ── Constants ─────────────────────────────────────────────────────────────
const OTM_URL     = 'https://otmgtm-test-a629995.otmgtm.us-phoenix-1.ocs.oraclecloud.com';
const WM_URL      = 'https://otmgtm-test-a629995.otmgtm.us-phoenix-1.ocs.oraclecloud.com/GC3/glog.integration.servlet.WMServlet';
const WS_USER     = 'TMS.TR_INT';
const WS_PASS     = 'Changeme123$';
const UI_USER     = 'LEL7597_TMS';
const UI_PASS     = 'Changeme123$';
const DELIVERY_NOTE = '0087299329';
const PLACEHOLDER   = '1104191935';

const SCREENSHOTS_DIR = path.resolve('test-results');

// ── Helpers ───────────────────────────────────────────────────────────────
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
  const creds  = Buffer.from(`${WS_USER}:${WS_PASS}`).toString('base64');
  const resp   = await fetch(WM_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'text/xml; charset=UTF-8',
      'Authorization': `Basic ${creds}`,
    },
    body: xml,
  });
  const body = await resp.text();
  return { status: resp.status, body };
}

async function saveScreenshot(page: any, filename: string): Promise<void> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: false });
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

    // ── LOGIN ────────────────────────────────────────────────────────────

    await test.step('1. Navigate to OTM URL', async () => {
      await page.goto(OTM_URL, { waitUntil: 'domcontentloaded' });
    });

    await test.step('2. Login page loaded', async () => {
      await page.waitForFunction(
        () => !!document.querySelector('#idcs-signin-basic-signin-form-username') ||
              !!document.querySelector('#username'),
        { timeout: 30_000 }
      );
    });

    await test.step('3. Enter username', async () => {
      const field = page.locator('#idcs-signin-basic-signin-form-username, #username').first();
      await field.waitFor({ state: 'visible', timeout: 15_000 });
      await field.fill(UI_USER);
    });

    await test.step('4. Enter password', async () => {
      const field = page.locator('input[type="password"]').first();
      await field.waitFor({ state: 'visible', timeout: 15_000 });
      await field.fill(UI_PASS);
    });

    await test.step('5. Click Sign In', async () => {
      await page.locator('#idcs-signin-basic-signin-form-submit, #signin').first().click();
    });

    await test.step('6. Wait for OTM homepage to load', async () => {
      await page.waitForFunction(
        () => !document.title.toLowerCase().includes('sign in'),
        { timeout: 60_000 }
      );
      await page.waitForLoadState('networkidle', { timeout: 60_000 });
    });

    // ── ROLE SWITCH ──────────────────────────────────────────────────────

    await test.step('7. Click user menu (LEL7597_TMS)', async () => {
      const menu = page.locator(`[title="${UI_USER}"], button:has-text("${UI_USER}")`).first();
      await menu.waitFor({ state: 'visible', timeout: 20_000 });
      await menu.click();
    });

    await test.step('8. Settings and Actions panel opened', async () => {
      await page.waitForSelector('text=Settings and Actions', { timeout: 15_000 });
    });

    await test.step('9. Select role POLAND_PLANNER', async () => {
      const roleSelect = page.locator('select').filter({ hasText: /role|planner/i }).first()
        .or(page.locator('select[name*="role" i], select[id*="role" i]').first());
      await roleSelect.waitFor({ state: 'visible', timeout: 15_000 });
      await roleSelect.selectOption({ label: 'POLAND_PLANNER' });
    });

    await test.step('10. Click Save and Close', async () => {
      await page.locator('button:has-text("Save and Close"), input[value="Save and Close"]').first().click();
    });

    await test.step('11. Wait for homepage to reload with new role', async () => {
      await page.waitForLoadState('networkidle', { timeout: 60_000 });
      await page.waitForFunction(
        () => !document.title.toLowerCase().includes('sign in'),
        { timeout: 30_000 }
      );
    });

    // ── SEND T1 ──────────────────────────────────────────────────────────

    let t1Result: { status: number; body: string };

    await test.step('12. Send T1 XML to WMServlet', async () => {
      const xml = loadFixture('poland-t1.xml', orderId);
      t1Result = await postXML(xml);
    });

    await test.step('13. Verify T1 response is 200 OK', async () => {
      expect(t1Result.status).toBe(200);
    });

    await test.step('14. Verify TransmissionAck received', async () => {
      expect(t1Result.body).toContain('<otm:TransmissionAck');
    });

    // ── SEARCH ORDER AFTER T1 ────────────────────────────────────────────

    await test.step('15. Click Order Release tile', async () => {
      await page.locator('text=Order Release').first().click();
    });

    await test.step('16. Order Release finder opened', async () => {
      await page.waitForLoadState('networkidle', { timeout: 30_000 });
      await page.waitForSelector('button:has-text("Search"), input[value="Search"]', { timeout: 20_000 });
    });

    await test.step('17. Enter order ID in search field', async () => {
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill(orderId);
    });

    await test.step('18. Click Search', async () => {
      await page.locator('button:has-text("Search"), input[value="Search"]').first().click();
      await page.waitForLoadState('networkidle', { timeout: 30_000 });
    });

    await test.step('19. Verify Total Found: 1', async () => {
      await expect(page.locator('text=Total Found: 1')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('20. Verify yellow indicator on order row', async () => {
      const row = page.locator(`tr:has-text("${orderId}")`).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      const indicator = row.locator('img').first();
      await expect(indicator).toBeVisible({ timeout: 10_000 });
    });

    await test.step('21. Verify order status is PLANNING_PLANNED - HOLD', async () => {
      const row = page.locator(`tr:has-text("${orderId}")`).first();
      await expect(row).toContainText('PLANNING_PLANNED - HOLD', { timeout: 15_000 });
    });

    await test.step('22. Verify DELIVERY column is empty', async () => {
      const row  = page.locator(`tr:has-text("${orderId}")`).first();
      const cell = row.locator('td').nth(2);
      const text = (await cell.textContent() ?? '').trim();
      expect(text).toBe('');
    });

    await test.step('23. Take screenshot of T1 state', async () => {
      await saveScreenshot(page, 'poland-01-t1-state.png');
    });

    // ── SEND T2 ──────────────────────────────────────────────────────────

    let t2Result: { status: number; body: string };

    await test.step('24. Send T2 XML to WMServlet', async () => {
      const xml = loadFixture('poland-t2.xml', orderId);
      t2Result = await postXML(xml);
    });

    await test.step('25. Verify T2 response is 200 OK', async () => {
      expect(t2Result.status).toBe(200);
    });

    await test.step('26. Verify TransmissionAck received', async () => {
      expect(t2Result.body).toContain('<otm:TransmissionAck');
    });

    // ── VERIFY T2 STATE ──────────────────────────────────────────────────

    await test.step('27. Refresh order search results', async () => {
      // Poll every 5s up to 90s until row shows PLANNING_NEW
      const deadline = Date.now() + 90_000;
      let found = false;
      while (Date.now() < deadline) {
        await page.locator('button:has-text("Search"), input[value="Search"]').first().click();
        await page.waitForLoadState('networkidle', { timeout: 20_000 });
        const row = page.locator(`tr:has-text("${orderId}")`).first();
        const text = await row.textContent().catch(() => '');
        if (text && text.includes('PLANNING_NEW')) { found = true; break; }
        await page.waitForTimeout(5_000);
      }
      expect(found, 'Timed out waiting for PLANNING_NEW status after T2').toBe(true);
    });

    await test.step('28. Verify blue indicator on order row', async () => {
      const row = page.locator(`tr:has-text("${orderId}")`).first();
      await expect(row.locator('img').first()).toBeVisible({ timeout: 10_000 });
    });

    await test.step('29. Verify order status is PLANNING_NEW', async () => {
      await expect(page.locator(`tr:has-text("${orderId}")`).first()).toContainText('PLANNING_NEW');
    });

    await test.step('30. Verify DELIVERY column shows 0087299329', async () => {
      const row  = page.locator(`tr:has-text("${orderId}")`).first();
      const cell = row.locator('td').nth(2);
      await expect(cell).toContainText(DELIVERY_NOTE, { timeout: 10_000 });
    });

    await test.step('31. Take screenshot of T2 state', async () => {
      await saveScreenshot(page, 'poland-02-t2-state.png');
    });

    // ── VERIFY REFERENCE NUMBERS ─────────────────────────────────────────

    await test.step('32. Select order row', async () => {
      const row = page.locator(`tr:has-text("${orderId}")`).first();
      await row.click();
    });

    await test.step('33. Click View to open order detail', async () => {
      await page.locator('[title="View"], button:has-text("View")').first().click();
      await page.waitForLoadState('networkidle', { timeout: 30_000 });
    });

    await test.step('34. Order detail page loaded', async () => {
      await expect(page.locator(`text=${orderId}`).first()).toBeVisible({ timeout: 20_000 });
    });

    await test.step('35. Click More to expand additional fields', async () => {
      const more = page.locator('a:has-text("More"), span:has-text("More")').first();
      if (await more.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await more.click();
        await page.waitForLoadState('networkidle', { timeout: 10_000 });
      }
    });

    await test.step('36. Reference Numbers section visible', async () => {
      await expect(
        page.locator('text=Reference Number Qualifier ID, text=Reference Number').first()
      ).toBeVisible({ timeout: 20_000 });
    });

    async function assertRefnum(qualifier: string, expectedValue: string) {
      const qualifierLink = page.locator(`a:has-text("${qualifier}"), td:has-text("${qualifier}")`).first();
      await expect(qualifierLink).toBeVisible({ timeout: 15_000 });
      const row   = qualifierLink.locator('xpath=ancestor::tr').first();
      const value = (await row.locator('td').last().textContent() ?? '').trim();
      expect(value, `${qualifier} mismatch`).toBe(expectedValue);
    }

    await test.step('37. Verify DELIVERY_NOTE_NUMBER = 0087299329',    async () => { await assertRefnum('DELIVERY_NOTE_NUMBER', '0087299329'); });
    await test.step('38. Verify COMPANY_CODE = 3840',                  async () => { await assertRefnum('COMPANY_CODE', '3840'); });
    await test.step('39. Verify CUSTOMER_PO = 2606084341861',          async () => { await assertRefnum('CUSTOMER_PO', '2606084341861'); });
    await test.step('40. Verify PALLET_COUNT = 2',                     async () => { await assertRefnum('PALLET_COUNT', '2'); });
    await test.step('41. Verify PALLET_DECIMAL = 1.818',               async () => { await assertRefnum('PALLET_DECIMAL', '1.818'); });
    await test.step('42. Verify SAP_ORDER_TYPE = ZORS',                async () => { await assertRefnum('SAP_ORDER_TYPE', 'ZORS'); });

    await test.step('43. Take screenshot of reference numbers', async () => {
      await saveScreenshot(page, 'poland-03-refnums.png');
    });
  });
});
