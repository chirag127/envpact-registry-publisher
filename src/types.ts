// envpact-registry-publisher — adapter interface and shared types.
//
// Every registry has its own quirks (REST endpoint, web form, PR
// flow, completely passive). The Adapter interface normalises them
// to a single submit() method so runner.ts can iterate without
// caring what each one is doing under the hood.

/** Parsed contents of server.json — the canonical descriptor. */
export interface ServerSpec {
  /** "io.github.<user>/<package>" — the canonical MCP id format */
  name: string;
  /** Short description shown in registry listings */
  description: string;
  /** Semver version of the npm package being announced */
  version: string;
  /** Marketing/landing URL */
  homepage: string;
  /** Public source repository */
  repository: string;
  /** npm package name (often differs from id) — used for install command */
  npm_package: string;
  /** SPDX license identifier */
  license: string;
  /** Free-form tags used by mcp.so / awesome-mcp categorisation */
  categories: string[];
  /** Install command shown in MCP-client config snippets */
  install: { command: string; args: string[] };
}

/** Outcome of a single adapter run. */
export type AdapterStatus =
  | { kind: 'submitted'; url?: string; detail?: string }
  | { kind: 'no-op'; reason: string }
  | { kind: 'error'; message: string; manualLink?: string };

export interface Adapter {
  /** Display name shown in CI logs */
  readonly name: string;
  /** Hard-fail vs soft-fail when submit() throws. Hard-fail propagates non-zero exit. */
  readonly required: boolean;
  /** Run the submission. Throws on hard error; returns AdapterStatus otherwise. */
  submit(spec: ServerSpec): Promise<AdapterStatus>;
}

/** Validate a parsed JSON object shape — narrow defensively. */
export function validateServerSpec(v: unknown): ServerSpec {
  if (typeof v !== 'object' || v === null) {
    throw new Error('server.json must be an object');
  }
  const o = v as Record<string, unknown>;
  const req = (k: string, t: 'string' | 'object' | 'array') => {
    const got = o[k];
    if (t === 'array' ? !Array.isArray(got) : typeof got !== t) {
      throw new Error(`server.json: required field "${k}" must be a ${t}`);
    }
  };
  req('name', 'string'); req('description', 'string');
  req('version', 'string'); req('homepage', 'string');
  req('repository', 'string'); req('npm_package', 'string');
  req('license', 'string'); req('categories', 'array');
  req('install', 'object');
  const inst = o.install as Record<string, unknown>;
  if (typeof inst.command !== 'string' || !Array.isArray(inst.args)) {
    throw new Error('server.json: install.command (string) and install.args (array) are required');
  }
  // Nail down the canonical id shape so we don't ship bogus names to
  // registries that pattern-match on it.
  if (!/^io\.github\.[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(o.name as string)) {
    throw new Error('server.json: name must match "io.github.<user>/<package>"');
  }
  return v as ServerSpec;
}
