#!/usr/bin/env node
// envpact-registry-publish — CLI entrypoint.
//
// Usage:
//   envpact-registry-publish [path/to/server.json]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateServerSpec } from './types.js';
import { runAll, shouldExitNonZero, RunResult } from './runner.js';

async function main() {
  const arg = process.argv[2] ?? './server.json';
  const file = path.resolve(process.cwd(), arg);
  if (!fs.existsSync(file)) {
    console.error(`error: server.json not found at ${file}`);
    process.exit(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e: any) {
    console.error(`error: ${file} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
  const spec = validateServerSpec(parsed);
  console.log(`envpact-registry-publish: ${spec.name} v${spec.version}\n`);

  const results = await runAll(spec);
  printSummary(results);

  if (shouldExitNonZero(results)) {
    console.error('\nOne or more REQUIRED registry submissions failed. See log above.');
    process.exit(1);
  }
  console.log('\nAll submissions complete (or queued for passive indexing).');
}

function printSummary(results: RunResult[]): void {
  for (const r of results) {
    const dur = (r.durationMs / 1000).toFixed(1);
    switch (r.status.kind) {
      case 'submitted':
        console.log(`  [ok] ${pad(r.adapter)}  submitted  ${dur}s  ${r.status.url ?? ''}`);
        if (r.status.detail) console.log(`        ${r.status.detail}`);
        break;
      case 'no-op':
        console.log(`  [--] ${pad(r.adapter)}  no-op      ${dur}s`);
        console.log(`        ${r.status.reason}`);
        break;
      case 'error':
        console.log(`  [!!] ${pad(r.adapter)}  error      ${dur}s`);
        console.log(`        ${r.status.message}`);
        if (r.status.manualLink) {
          console.log(`        manual fallback: ${r.status.manualLink}`);
        }
        break;
    }
  }
}

function pad(s: string): string { return s.padEnd(22); }

main().catch((e) => {
  console.error(`fatal: ${e.stack ?? e.message ?? e}`);
  process.exit(2);
});
