import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { refuse, safeAbsolute } from './identity.js';
import { resolveRuntime } from './resolver.js';

// Closed entrypoint inventory only; no arbitrary argv, shell command, child
// process, listener management or authority mutation. B3 owns live integration.
export function dispatchPlan(options) {
  const selection = resolveRuntime(options);
  const root = selection.runtime.packageRoot;
  const manifest = JSON.parse(readFileSync(path.join(root, 'payload-manifest.json'), 'utf8'));
  const listed = new Set(manifest.files.map((entry) => entry.path));
  const file = (relative) => {
    if (!listed.has(relative)) refuse('entrypoint-unowned');
    const full = safeAbsolute(path.join(root, relative));
    if (!lstatSync(full).isFile()) refuse('entrypoint-missing');
    return full;
  };
  const cli = file('bin/dev-foundry-claude.js');
  return { format: 'dev-foundry.runtime-dispatch-plan.v1', status: 'verified-plan',
    execution: 'deferred-B3', repositoryRoot: selection.repositoryRoot, expect: selection.expect,
    packageRoot: root, entrypoints: {
      cli,
      mcp: { cli, args: ['mcp', '--expect', selection.expect], server: file('src/governance-mcp/server.js') },
      dashboard: { command: file('src/dashboard/command.js'), server: file('tools/dashboard/server/http.mjs'),
        launcher: file('tools/dashboard/server/launch.mjs'), evidence: file('tools/dashboard/server/evidence.mjs'),
        collector: file('tools/dashboard/server/claude-otel.mjs'), ui: file('tools/dashboard/dist/index.html') },
      telemetry: { launcher: file('src/telemetry/launch.js'), collector: file('src/telemetry/telemetry.js') },
    } };
}
