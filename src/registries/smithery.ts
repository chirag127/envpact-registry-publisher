// Smithery adapter — wraps the official @smithery/cli.
//
// As of 2026, Smithery has a real CLI with three publish modes:
//   1. Hosted HTTPS:  npx @smithery/cli mcp publish "https://x" -n org/repo
//   2. .mcpb bundle:  npx @smithery/cli mcp publish ./server.mcpb -n org/repo
//   3. Container:     repo with smithery.yaml + Dockerfile, then publish
//                     the GitHub URL itself (Smithery clones + builds)
//
// Earlier versions of this adapter speculatively POSTed to
// api.smithery.ai/servers — that endpoint never existed for
// submission. Removed in favour of shelling out to the documented CLI.
//
// We pick the mode by inspecting server.json fields:
//   - if spec.smithery?.mode is set, honour it
//   - else if spec.repository points to a GitHub repo with smithery.yaml,
//     use container mode (CLI does the right thing on a GitHub URL)
//   - else fall back to GitHub-URL mode (Smithery will index from npm)

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

const execFileP = promisify(execFile);

const SUBMIT_MANUAL_URL = 'https://smithery.ai/new';

export class SmitheryAdapter implements Adapter {
  readonly name = 'smithery';
  readonly required = false;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    // The CLI authenticates via `smithery login` which caches a token
    // in ~/.smithery/credentials. CI users should run `smithery login`
    // once locally and then ship the credentials file as a secret OR
    // use SMITHERY_API_KEY which the CLI honours when set.
    if (!process.env.SMITHERY_API_KEY && !this.hasCachedCreds()) {
      return {
        kind: 'error',
        message: 'SMITHERY_API_KEY not set and no cached credentials found. Run `npx @smithery/cli login` once, or set SMITHERY_API_KEY.',
        manualLink: SUBMIT_MANUAL_URL,
      };
    }

    const orgRepo = this.deriveOrgRepo(spec.repository);
    if (!orgRepo) {
      return {
        kind: 'error',
        message: `could not parse "<org>/<repo>" from repository URL: ${spec.repository}`,
        manualLink: SUBMIT_MANUAL_URL,
      };
    }

    // Default strategy: pass the GitHub URL itself. Smithery's CLI
    // looks at the repo, finds smithery.yaml + Dockerfile (container
    // mode), or falls back to npm-package indexing if neither.
    // This works for envpact-mcp (stdio server with smithery.yaml).
    const target = spec.repository;

    try {
      const args = ['-y', '@smithery/cli', 'mcp', 'publish', target, '-n', orgRepo];
      const env: Record<string, string | undefined> = { ...process.env };
      if (process.env.SMITHERY_API_KEY) {
        env.SMITHERY_API_KEY = process.env.SMITHERY_API_KEY;
      }
      const { stdout } = await execFileP('npx', args, {
        env,
        timeout: 180_000,
      });
      // CLI normally prints the public listing URL on success; capture
      // the last non-empty line.
      const lines = stdout.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const last = lines[lines.length - 1] ?? '';
      const publicUrl = last.startsWith('http')
        ? last
        : `https://smithery.ai/server/${encodeURIComponent(orgRepo)}`;
      return {
        kind: 'submitted',
        url: publicUrl,
        detail: `published via @smithery/cli (${orgRepo})`,
      };
    } catch (e: any) {
      const stderr = (e.stderr ?? '').toString();
      // Smithery's CLI returns a specific non-zero exit when the
      // server already exists and is up-to-date. Treat as no-op.
      if (/already (?:up.to.date|exists|published)/i.test(stderr)) {
        return { kind: 'no-op', reason: 'Smithery already has this version listed' };
      }
      return {
        kind: 'error',
        message: `@smithery/cli failed: ${stderr || e.message}`,
        manualLink: SUBMIT_MANUAL_URL,
      };
    }
  }

  /** Pull "<owner>/<repo>" out of a GitHub repository URL. */
  private deriveOrgRepo(url: string): string | null {
    let m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url);
    if (m) return `${m[1]}/${m[2]}`;
    m = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
    if (m) return `${m[1]}/${m[2]}`;
    return null;
  }

  /** Cheap sniff for ~/.smithery/credentials so we can short-circuit. */
  private hasCachedCreds(): boolean {
    try {
      const p = path.join(os.homedir(), '.smithery', 'credentials');
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }
}
