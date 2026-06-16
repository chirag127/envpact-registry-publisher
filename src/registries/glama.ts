// glama.ai adapter — passive auto-indexer; no submission needed.

import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

export class GlamaAdapter implements Adapter {
  readonly name = 'glama';
  readonly required = false;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    return {
      kind: 'no-op',
      reason: `glama auto-indexes from the official registry; listing will appear at https://glama.ai/mcp/servers/${spec.npm_package} within minutes of the official-registry submission`,
    };
  }
}
