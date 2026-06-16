// mcp.so adapter — Playwright-driven web form.

import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

const SUBMIT_URL = 'https://mcp.so/submit';

export class McpSoAdapter implements Adapter {
  readonly name = 'mcp.so';
  readonly required = false;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    let chromium: any;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      return {
        kind: 'error',
        message: 'playwright not installed; cannot submit to mcp.so',
        manualLink: SUBMIT_URL,
      };
    }
    const browser = await chromium.launch({ headless: !!process.env.CI });
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(SUBMIT_URL, { waitUntil: 'networkidle', timeout: 30000 });
      const ghInput = await page.$('input[name="github_url"], input[placeholder*="github"], input[type="url"]');
      if (!ghInput) {
        return {
          kind: 'error',
          message: 'mcp.so submit form layout changed; could not locate the GitHub URL input',
          manualLink: SUBMIT_URL,
        };
      }
      await ghInput.fill(spec.repository);
      const descArea = await page.$('textarea');
      if (descArea) await descArea.fill(spec.description);
      const submit = await page.$('button:has-text("Submit"), button[type="submit"], button:has-text("Add")');
      if (!submit) {
        return {
          kind: 'error',
          message: 'mcp.so submit button not found',
          manualLink: SUBMIT_URL,
        };
      }
      await submit.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      return {
        kind: 'submitted',
        url: page.url(),
        detail: 'submitted via mcp.so web form',
      };
    } catch (e: any) {
      return {
        kind: 'error',
        message: `mcp.so submission failed: ${e.message}`,
        manualLink: SUBMIT_URL,
      };
    } finally {
      await browser.close();
    }
  }
}
