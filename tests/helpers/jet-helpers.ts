import { Page } from '@playwright/test';
import { allure } from 'allure-playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = path.join(__dirname, '..', '..', 'test-results', 'screenshots');

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

export async function waitForJETPage(page: Page): Promise<void> {
  await allure.step('Wait for JET page to load', async () => {
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('[class*="oj-"]') !== null,
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForFunction(() => {
      const win = window as any;
      if (win.oj?.Context?.getPageContext) {
        const ctx = win.oj.Context.getPageContext().getBusyContext();
        return ctx ? ctx.isReady() : true;
      }
      return true;
    }, { timeout: 30000 }).catch(() => {});
  });
}

export async function jetClick(page: Page, selector: string): Promise<void> {
  await allure.step('Click: ' + selector, async () => {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(300);
    await el.click();
  });
}

export async function jetFill(page: Page, selector: string, value: string): Promise<void> {
  await allure.step('Fill: ' + selector, async () => {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 30000 });
    await el.click();
    await el.click({ clickCount: 3 });
    await el.fill(value);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
  });
}

export async function jetSelectDropdown(page: Page, selector: string, value: string): Promise<void> {
  await allure.step('Select "' + value + '" from: ' + selector, async () => {
    const trigger = page.locator(selector).first();
    await trigger.waitFor({ state: 'visible', timeout: 30000 });
    await trigger.click();
    await page.waitForSelector('.oj-listbox-result, [role="option"]', { state: 'visible', timeout: 10000 });
    await page.locator('[role="option"]').filter({ hasText: value }).first().click();
    await page.waitForTimeout(300);
  });
}

export async function waitForPopup(page: Page): Promise<void> {
  await allure.step('Wait for OTM popup', async () => {
    await page.waitForSelector('.oj-dialog, .oj-popup, [role="dialog"]', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
  });
}

export async function closePopup(page: Page): Promise<void> {
  await allure.step('Close OTM popup', async () => {
    const btn = page.locator('.oj-dialog-header-close, button[title="Close"], button:has-text("Cancel")').first();
    if (await btn.isVisible()) {
      await btn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForSelector('.oj-dialog, [role="dialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });
}

/**
 * Takes a named screenshot, saves it to test-results/screenshots/, attaches to Allure,
 * and returns the filename (for DB storage).
 */
export async function takeStepScreenshot(page: Page, stepName: string): Promise<string | null> {
  try {
    ensureScreenshotsDir();
    const safeName = stepName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename  = safeName + '_' + Date.now() + '.png';
    const filePath  = path.join(SCREENSHOTS_DIR, filename);

    // Wait for page to fully settle before capturing
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const buffer = await page.screenshot({ fullPage: false });
    fs.writeFileSync(filePath, buffer);

    await allure.step('Screenshot: ' + stepName, async () => {
      await allure.attachment(stepName, buffer, 'image/png');
    });

    return filename;
  } catch (_) {
    return null;
  }
}
