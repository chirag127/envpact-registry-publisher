// Runner — execute every adapter in priority order, accumulate
// outcomes, fail loud (exit 1) if any required adapter errors.

import { Adapter, AdapterStatus, ServerSpec } from './types.js';
import { OfficialRegistryAdapter } from './registries/official.js';
import { SmitheryAdapter } from './registries/smithery.js';
import { GlamaAdapter } from './registries/glama.js';
import { PulseMcpAdapter } from './registries/pulsemcp.js';
import { McpSoAdapter } from './registries/mcpso.js';
import { AwesomeMcpAdapter } from './registries/awesome.js';

export interface RunResult {
  adapter: string;
  status: AdapterStatus;
  durationMs: number;
}

const ADAPTERS: Adapter[] = [
  new OfficialRegistryAdapter(),
  new SmitheryAdapter(),
  new GlamaAdapter(),
  new PulseMcpAdapter(),
  new McpSoAdapter(),
  new AwesomeMcpAdapter(),
];

export async function runAll(spec: ServerSpec): Promise<RunResult[]> {
  const results: RunResult[] = [];
  for (const adapter of ADAPTERS) {
    const start = Date.now();
    try {
      const status = await adapter.submit(spec);
      results.push({ adapter: adapter.name, status, durationMs: Date.now() - start });
    } catch (e: any) {
      results.push({
        adapter: adapter.name,
        status: { kind: 'error', message: `adapter threw: ${e.message ?? String(e)}` },
        durationMs: Date.now() - start,
      });
    }
  }
  return results;
}

/** True if any required adapter ended in error. */
export function shouldExitNonZero(results: RunResult[]): boolean {
  return results.some((r) => {
    if (r.status.kind !== 'error') return false;
    const adapter = ADAPTERS.find((a) => a.name === r.adapter);
    return adapter?.required ?? false;
  });
}
