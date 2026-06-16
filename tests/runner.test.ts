// Unit tests — pure validation + manifest-shape logic only.

import { test } from 'node:test';
import assert from 'node:assert';
import { validateServerSpec } from '../src/types.js';
import { shouldExitNonZero, RunResult } from '../src/runner.js';

test('validateServerSpec: accepts a complete spec', () => {
  const spec = validateServerSpec({
    name: 'io.github.chirag127/envpact-mcp',
    description: 'd',
    version: '0.4.0',
    homepage: 'https://example.com',
    repository: 'https://github.com/chirag127/envpact-mcp',
    npm_package: 'envpact-mcp',
    license: 'MIT',
    categories: ['productivity'],
    install: { command: 'npx', args: ['-y', 'envpact-mcp'] },
  });
  assert.strictEqual(spec.name, 'io.github.chirag127/envpact-mcp');
});

test('validateServerSpec: rejects missing required fields', () => {
  assert.throws(() => validateServerSpec({}), /name/);
  assert.throws(() => validateServerSpec({ name: 'foo', description: 'x' }), /version/);
});

test('validateServerSpec: rejects malformed name', () => {
  assert.throws(() => validateServerSpec({
    name: 'not-the-canonical-form',
    description: 'd', version: '0.0.1', homepage: 'h', repository: 'r',
    npm_package: 'p', license: 'MIT', categories: [], install: { command: 'a', args: [] },
  }), /io\.github/);
});

test('shouldExitNonZero: false when all results are submitted/no-op', () => {
  const results: RunResult[] = [
    { adapter: 'official-mcp-registry', status: { kind: 'submitted' }, durationMs: 10 },
    { adapter: 'smithery', status: { kind: 'no-op', reason: 'x' }, durationMs: 10 },
  ];
  assert.strictEqual(shouldExitNonZero(results), false);
});

test('shouldExitNonZero: true if a REQUIRED adapter errored', () => {
  const results: RunResult[] = [
    { adapter: 'official-mcp-registry', status: { kind: 'error', message: 'down' }, durationMs: 10 },
    { adapter: 'smithery', status: { kind: 'submitted' }, durationMs: 10 },
  ];
  assert.strictEqual(shouldExitNonZero(results), true);
});

test('shouldExitNonZero: false if only OPTIONAL adapters errored', () => {
  const results: RunResult[] = [
    { adapter: 'official-mcp-registry', status: { kind: 'submitted' }, durationMs: 10 },
    { adapter: 'smithery', status: { kind: 'error', message: 'rate limited' }, durationMs: 10 },
    { adapter: 'mcp.so', status: { kind: 'error', message: 'form changed' }, durationMs: 10 },
  ];
  assert.strictEqual(shouldExitNonZero(results), false);
});
