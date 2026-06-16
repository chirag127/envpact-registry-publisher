// Official MCP Registry adapter — wraps the upstream `mcp-publisher` CLI.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

const execFileP = promisify(execFile);

export class OfficialRegistryAdapter implements Adapter {
  readonly name = 'official-mcp-registry';
  readonly required = true;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    if (!process.env.MCP_PUBLISHER_TOKEN) {
      return {
        kind: 'error',
        message: 'MCP_PUBLISHER_TOKEN not set; skipping official registry',
        manualLink: 'https://registry.modelcontextprotocol.io/docs/publishing',
      };
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envpact-pub-'));
    const tmpFile = path.join(tmpDir, 'server.json');
    fs.writeFileSync(tmpFile, JSON.stringify(spec, null, 2));
    try {
      const { stdout } = await execFileP('npx', [
        '-y', '@modelcontextprotocol/publisher',
        'publish', '--file', tmpFile,
      ], {
        env: { ...process.env, MCP_PUBLISHER_TOKEN: process.env.MCP_PUBLISHER_TOKEN },
        timeout: 120_000,
      });
      const url = `https://registry.modelcontextprotocol.io/servers/${encodeURIComponent(spec.name)}`;
      return { kind: 'submitted', url, detail: stdout.split('\n').pop() || undefined };
    } catch (e: any) {
      return {
        kind: 'error',
        message: `mcp-publisher CLI failed: ${e.stderr || e.message}`,
        manualLink: 'https://registry.modelcontextprotocol.io/docs/publishing',
      };
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
