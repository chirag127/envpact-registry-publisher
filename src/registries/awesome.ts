// punkpeye/awesome-mcp-servers adapter — fork + branch + PR via gh CLI.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Adapter, AdapterStatus, ServerSpec } from '../types.js';

const execFileP = promisify(execFile);

const UPSTREAM = 'punkpeye/awesome-mcp-servers';
const SECTION_HEADING = '### Developer Tools';

export class AwesomeMcpAdapter implements Adapter {
  readonly name = 'awesome-mcp-servers';
  readonly required = false;

  async submit(spec: ServerSpec): Promise<AdapterStatus> {
    if (!process.env.GH_PAT && !process.env.GITHUB_TOKEN) {
      return {
        kind: 'error',
        message: 'GH_PAT (or GITHUB_TOKEN) required to open a PR on awesome-mcp-servers',
        manualLink: `https://github.com/${UPSTREAM}/edit/main/README.md`,
      };
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envpact-amcp-'));
    try {
      await this.gh(['repo', 'fork', UPSTREAM, '--clone=true', '--remote=false'], tmpDir);
      const cloneDir = path.join(tmpDir, 'awesome-mcp-servers');
      const branch = `add-${spec.npm_package.replace(/[^a-z0-9-]/g, '-')}-${spec.version}`;

      await this.git(['fetch', 'origin', 'main'], cloneDir);
      await this.git(['checkout', '-B', branch, 'origin/main'], cloneDir);

      const readmePath = path.join(cloneDir, 'README.md');
      const readme = fs.readFileSync(readmePath, 'utf8');
      const entry = this.formatEntry(spec);
      if (readme.includes(`[${spec.npm_package}]`)) {
        return { kind: 'no-op', reason: 'package already listed in README — no PR needed' };
      }
      const patched = this.insertUnderHeading(readme, SECTION_HEADING, entry);
      fs.writeFileSync(readmePath, patched, 'utf8');

      await this.git(['add', 'README.md'], cloneDir);
      await this.git(['commit', '-s', '-m', `add ${spec.npm_package} (v${spec.version})`], cloneDir);
      await this.git(['push', '-u', 'origin', branch], cloneDir);

      const prTitle = `Add ${spec.npm_package} — ${spec.description.slice(0, 60)}`;
      const prBody = this.formatPrBody(spec);
      const fork = await this.detectFork();
      const { stdout } = await this.gh([
        'pr', 'create', '--repo', UPSTREAM,
        '--title', prTitle,
        '--body', prBody,
        '--head', `${fork}:${branch}`,
        '--base', 'main',
      ], cloneDir);
      return { kind: 'submitted', url: stdout.trim(), detail: 'PR opened' };
    } catch (e: any) {
      const stderr = (e.stderr ?? '').toString();
      if (stderr.includes('already exists')) {
        return { kind: 'no-op', reason: 'PR for this branch is already open upstream' };
      }
      return {
        kind: 'error',
        message: `awesome-mcp-servers PR failed: ${stderr || e.message}`,
        manualLink: `https://github.com/${UPSTREAM}/pulls`,
      };
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  private formatEntry(spec: ServerSpec): string {
    return `- [${spec.npm_package}](${spec.repository}) — ${spec.description}`;
  }

  private formatPrBody(spec: ServerSpec): string {
    return `## What

Adds [\`${spec.npm_package}\`](${spec.repository}) to the list.

## Description

${spec.description}

## Install

\`\`\`jsonc
{
  "mcpServers": {
    "${spec.npm_package}": {
      "command": "${spec.install.command}",
      "args": ${JSON.stringify(spec.install.args)}
    }
  }
}
\`\`\`

## License

${spec.license}.

(Submitted by [envpact-registry-publisher](https://github.com/chirag127/envpact-registry-publisher).)
`;
  }

  private insertUnderHeading(text: string, heading: string, entry: string): string {
    const lines = text.split('\n');
    const headingIdx = lines.findIndex((l) => l.trim() === heading);
    if (headingIdx < 0) {
      return `${text.trimEnd()}\n\n${heading}\n\n${entry}\n`;
    }
    let i = headingIdx + 1;
    while (i < lines.length && (lines[i].startsWith('- ') || lines[i].trim() === '')) i++;
    lines.splice(i, 0, entry);
    return lines.join('\n');
  }

  private async detectFork(): Promise<string> {
    const { stdout } = await this.gh(['api', 'user', '--jq', '.login'], process.cwd());
    return stdout.trim();
  }

  private gh(args: string[], cwd: string) {
    return execFileP('gh', args, {
      cwd,
      env: {
        ...process.env,
        GH_TOKEN: process.env.GH_PAT || process.env.GITHUB_TOKEN || '',
      },
      timeout: 60_000,
    });
  }
  private git(args: string[], cwd: string) {
    return execFileP('git', args, { cwd, timeout: 60_000 });
  }
}
