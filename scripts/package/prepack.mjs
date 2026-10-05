import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const execPath = process.env.npm_execpath;
const [command, prefix] = execPath && /\.c?js$/.test(execPath) ? [process.execPath, [execPath]] : ['npm', []];
// Keep build diagnostics on stderr so npm pack --json remains machine-readable.
const result = spawnSync(command, [...prefix, '--prefix', 'tools/dashboard', 'run', 'build'], {
  cwd: packageRoot, stdio: ['ignore', process.stderr, process.stderr],
});
if (result.error || result.status !== 0) {
  console.error('prepack: dashboard build failed. Install producer dashboard dependencies before packing.');
  process.exit(result.status || 1);
}
await import('./payload-manifest.mjs');
