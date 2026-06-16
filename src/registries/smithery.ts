// Smithery adapter — REST first, Playwright fallback.

import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

const API_BASE = 'https://api.smithery.ai';
const SUBMIT_URL = 'https://smithery.ai/new';

export class SmitheryAdapter implements Adapter {
  readonly name = 'smithery';
  readonly required = false;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    const key = process.env.SMITHERY_API_KEY;
    if (key) {
      const restResult = await this.tryRest(spec, key);
      if (restResult.kind !== 'error') return restResult;
    }
    return await this.tryPlaywright(spec);
  }

  private async tryRest(spec: ServerSpec, apiKey: string): Promise<AdapterStatus> {
    try {
      const r = await fetch(`${API_BASE}/servers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'envpact-registry-publisher/0.1.0',
        },
        body: JSON.stringify({
          name: spec.name,
          description: spec.description,
          repository: spec.repository,
          version: spec.version,
        }),
      });
      if (r.ok) {
        return {
          kind: 'submitted',
          url: `https://smithery.ai/server/${encodeURIComponent(spec.npm_package)}`,
          detail: 'submitted via REST API',
        };
      }
      if (r.status === 409) {
        return { kind: 'no-op', reason: 'server already listed; Smithery will re-index from npm' };
      }
      const body = await r.text();
      return { kind: 'error', message: `Smithery REST ${r.status}: ${body.slice(0, 200)}` };
    } catch (e: any) {
      return { kind: 'error', message: `Smithery REST failed: ${e.message}` };
    }
  }

  private async tryPlaywright(spec: ServerSpec): Promise<AdapterStatus> {
    let chromium: any;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      return {
        kind: 'error',
        message: 'playwright not installed and Smithery REST unavailable',
        manualLink: SUBMIT_URL,
      };
    }
    const browser = await chromium.launch({ headless: !!process.env.CI });
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(SUBMIT_URL, { waitUntil: 'networkidle', timeout: 30000 });
      const repoInput = await page.$('input[name="repository"], input[placeholder*="github"]');
      if (!repoInput) {
        return {
          kind: 'error',
          message: 'Smithery submit form layout changed; could not find repository input',
          manualLink: SUBMIT_URL,
        };
      }
      await repoInput.fill(spec.repository);
      const submit = await page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Add")');
      if (!submit) {
        return {
          kind: 'error',
          message: 'Smithery submit button not found',
          manualLink: SUBMIT_URL,
        };
      }
      await submit.click();
      await page.waitForURL((u: URL) => !u.pathname.endsWith('/new'), { timeout: 30000 });
      return {
        kind: 'submitted',
        url: page.url(),
        detail: 'submitted via Playwright form',
      };
    } catch (e: any) {
      return {
        kind: 'error',
        message: `Smithery Playwright failed: ${e.message}`,
        manualLink: SUBMIT_URL,
      };
    } finally {
      await browser.close();
    }
  }
}
