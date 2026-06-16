// PulseMCP adapter — passive auto-indexer.

import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

export class PulseMcpAdapter implements Adapter {
  readonly name = 'pulsemcp';
  readonly required = false;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    return {
      kind: 'no-op',
      reason: `PulseMCP ingests from the official registry. Listing will appear at https://www.pulsemcp.com/servers/${encodeURIComponent(spec.npm_package)} once the official submission propagates`,
    };
  }
}
