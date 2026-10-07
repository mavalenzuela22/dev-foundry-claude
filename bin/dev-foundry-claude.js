#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { selfPin, verifyPayload } from '../src/adopt/pin.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message, code = 1) => { console.error(message); process.exit(code); };
const verificationFailure = () => fail('Adapter runtime verification failed.');

function flags(argv, allowed) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!Object.hasOwn(allowed, name)) fail(`Unknown argument: ${name}`, 2);
    if (allowed[name] === 'boolean') options[name] = true;
    else if (index + 1 < argv.length) { options[name] = argv[index + 1]; index += 1; } else fail(`Missing value for ${name}`, 2);
  }
  return options;
}

const [command, ...rest] = process.argv.slice(2);
const packageVersion = () => JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;

if (command === '--version') {
  console.log(packageVersion());
} else if (command === 'mcp') {
  if (rest.length !== 2 || rest[0] !== '--expect') verificationFailure();
  try { verifyPayload(packageRoot, rest[1]); } catch { verificationFailure(); }
  globalThis[Symbol.for('dev-foundry-claude.consumer-mode-guard')] = true;
  await import(pathToFileURL(path.join(packageRoot, 'src/governance-mcp/server.js')).href);
} else if (command === 'dashboard') {
  const { dashboardCommand } = await import('../src/dashboard/command.js');
  try { await dashboardCommand({ argv: rest, packageRoot }); }
  catch (error) { fail(error.message, error.exitCode ?? 1); }
} else if (command === 'run') {
  const [runtime, separator, ...claudeArgs] = rest;
  if (!['direct', 'dial', 'codemie'].includes(runtime) || separator !== '--') fail('Usage: dev-foundry-claude run <direct|dial|codemie> -- <claude args>', 2);
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (top.status !== 0) fail('The current directory is not inside a git repository.');
  const root = top.stdout.trim();
  let expect;
  try {
    readFileSync(path.join(root, '.dev-foundry/profiles/project-operating-profile.yaml'));
    expect = JSON.parse(readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers['dev-foundry-governance'].args[2];
    verifyPayload(packageRoot, expect);
  } catch { verificationFailure(); }
  const { runLauncher } = await import('../src/telemetry/launch.js');
  process.exitCode = await runLauncher({ argv: ['--runtime', runtime, '--', ...claudeArgs], projectRoot: root });
} else if (command === 'upgrade') {
  const [action, ...args] = rest;
  if (!['status', 'plan', 'apply'].includes(action)) fail('Usage: dev-foundry-claude upgrade <status|plan|apply> --root <repo>', 2);
  const allowed = { '--root': 'value', ...(action === 'plan' ? { '--out': 'value' } : action === 'apply' ? { '--plan': 'value', '--plan-sha256': 'value' } : {}) };
  const options = flags(args, allowed);
  if (!options['--root']) fail('upgrade requires --root.', 2);
  let adapter;
  try {
    const pin = selfPin(packageRoot);
    adapter = { version: pin.version, payloadRoot: pin.root, expect: pin.expect };
  } catch { verificationFailure(); }
  const root = path.resolve(options['--root']);
  const { createUpgradePlan, upgradeStatus } = await import('../src/adopt/upgrade.js');
  if (action === 'apply') {
    if (!options['--plan'] || !options['--plan-sha256']) fail('apply requires --plan and --plan-sha256.', 2);
    const { applyPlan } = await import('../src/adopt/apply.js');
    try {
      console.log(JSON.stringify(await applyPlan({ root, adapter, upgrade: true,
        planBytes: readFileSync(path.resolve(options['--plan'])), planSha256: options['--plan-sha256'] })));
    } catch (error) { fail(`upgrade apply refused: ${error.code ?? 'error'}`); }
  } else if (action === 'status') {
    const result = await upgradeStatus({ root, adapter });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'blocked' ? 2 : 0;
  } else {
    const result = await createUpgradePlan({ root, adapter });
    if (options['--out']) {
      // Plan artifacts must stay outside the consumer, and never overwrite files.
      const out = path.resolve(options['--out']);
      const destination = path.join(realpathSync(path.dirname(out)), path.basename(out));
      const relative = path.relative(realpathSync(root), destination);
      if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) fail('--out must be outside the consumer repository.', 2);
      writeFileSync(out, result.bytes, { flag: 'wx' });
      console.log(JSON.stringify({ planSha256: result.hash, status: result.plan.status, current: result.plan.current, target: result.plan.target, blockers: result.plan.blockers.map((item) => item.code) }));
    } else {
      process.stdout.write(result.bytes);
      console.error(`plan-sha256: ${result.hash}`);
    }
    process.exitCode = ['ready', 'noop'].includes(result.plan.status) ? 0 : 2;
  }
} else if (command === 'adopt') {
  const [action, ...args] = rest;
  const { evaluateActivation } = await import('../src/adopt/activation.js');
  if (action === 'status') {
    const options = flags(args, { '--root': 'value' });
    const root = path.resolve(options['--root'] ?? process.cwd());
    process.stdout.write(`${JSON.stringify(await evaluateActivation(root), null, 2)}\n`);
  } else if (action === 'plan' || action === 'apply') {
    let adapter;
    try {
      const pin = selfPin(packageRoot);
      adapter = { version: pin.version, payloadRoot: pin.root, expect: pin.expect };
    } catch { verificationFailure(); }
    if (action === 'plan') {
      const options = flags(args, { '--root': 'value', '--project': 'value', '--id-prefix': 'value', '--remove': 'boolean', '--out': 'value' });
      const { createPlan } = await import('../src/adopt/plan.js');
      const result = await createPlan({ root: path.resolve(options['--root'] ?? process.cwd()), project: options['--project'], idPrefix: options['--id-prefix'], remove: options['--remove'] === true, adapter });
      if (options['--out']) {
        writeFileSync(path.resolve(options['--out']), result.bytes);
        console.log(JSON.stringify({ planSha256: result.hash, status: result.plan.status, blockers: result.plan.blockers.map((item) => item.code) }));
      } else {
        process.stdout.write(result.bytes);
        console.error(`plan-sha256: ${result.hash}`);
      }
      process.exitCode = ['ready', 'noop'].includes(result.plan.status) ? 0 : 2;
    } else {
      const options = flags(args, { '--root': 'value', '--plan': 'value', '--plan-sha256': 'value' });
      if (!options['--plan'] || !options['--plan-sha256']) fail('apply requires --plan and --plan-sha256.', 2);
      const { applyPlan } = await import('../src/adopt/apply.js');
      try {
        const outcome = await applyPlan({ planBytes: readFileSync(path.resolve(options['--plan'])), planSha256: options['--plan-sha256'], adapter, root: path.resolve(options['--root'] ?? process.cwd()) });
        console.log(JSON.stringify(outcome));
      } catch (error) { fail(`apply refused: ${error.code ?? 'error'}`); }
    }
  } else fail('Usage: dev-foundry-claude adopt <plan|apply|status>', 2);
} else {
  fail('Usage: dev-foundry-claude <adopt|upgrade|mcp|run|dashboard|--version>', 2);
}
