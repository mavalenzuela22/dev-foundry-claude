import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { createPlan } from '../adopt/plan.js';
import { createUpgradePlan } from '../adopt/upgrade.js';
import { applyPlan } from '../adopt/apply.js';
import { selfPin } from '../adopt/pin.js';
import { git, isIgnored, PROBE_PATH } from '../adopt/ignore.js';
import { cutoverState, pathHasSymlink, readContained, POP_PATH, INDEX_PATH } from '../adopt/common.js';
import { runLauncher, RUNTIMES } from '../telemetry/launch.js';
import { legacyVersion } from '../adopt/migration.js';
import { renderHelp } from './help.js';

const cli = 'dev-foundry-claude';
const quotedPath = (value) => process.platform === 'win32' ? `"${value}"` : `'${value.replaceAll("'", "'\\''")}'`;
export class ConsumerUsageError extends Error { constructor(message) { super(message); this.exitCode = 2; } }
function optionsFor(command, argv) {
  const allowed = new Set(['--root', '--verbose', ...(command === 'start' ? ['--runtime'] : ['--json']),
    ...(['setup', 'upgrade'].includes(command) ? ['--yes', '--apply'] : []),
    ...(command === 'setup' ? ['--project', '--classification', '--operator'] : []), ...(command === 'upgrade' ? ['--from-package', '--resolution-file', '--plan-sha256'] : []), ...(command === 'doctor' ? ['--runtime'] : [])]);
  const boolean = new Set(['--verbose', '--json', '--yes', '--apply']);
  const options = { claudeArgs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--' && command === 'start') { options.claudeArgs = argv.slice(index + 1); break; }
    if (!allowed.has(key) || Object.hasOwn(options, key)) throw new ConsumerUsageError(`Invalid argument: ${key}. Next: ${cli} help ${command}`);
    if (boolean.has(key)) options[key] = true;
    else {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new ConsumerUsageError(`Missing value for ${key}. Next: ${cli} help ${command}`);
      options[key] = value;
    }
  }
  if (options['--runtime'] && !RUNTIMES.includes(options['--runtime'])) throw new ConsumerUsageError(`Choose direct, dial or codemie. Next: ${cli} help start`);
  return options;
}
export function runtimeAvailable(runtime, env = process.env) {
  const name = { direct: 'claude', dial: 'dial', codemie: 'codemie-claude' }[runtime];
  const extensions = process.platform === 'win32' ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT').toLowerCase().split(';')] : [''];
  return (env.PATH ?? '').split(path.delimiter).filter(Boolean).some((directory) => extensions.some((extension) => {
    try {
      const file = path.join(directory, `${name}${extension}`);
      accessSync(file, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
      return statSync(file).isFile();
    } catch { return false; }
  }));
}
function writableAncestor(target, root) {
  try {
    while (!existsSync(target) && target !== root) target = path.dirname(target);
    accessSync(target, constants.W_OK);
    return statSync(target).isDirectory();
  } catch { return false; }
}

export async function inspectConsumer({ root: selected, packageRoot, adapter, runtime = 'direct', env = process.env, executableAvailable = runtimeAvailable, bootstrapInputs = {} }) {
  const top = git(selected, ['rev-parse', '--show-toplevel']);
  let root = null;
  try { if (top.status === 0 && top.stdout.trim()) root = realpathSync(top.stdout.trim()); } catch { /* diagnostics below */ }
  const result = { repository: root, project: null, framework: null, adoption: 'unconfigured', integration: 'unconfigured',
    adapterVersion: adapter.version, selectedAdapterVersion: null, payloadVerified: true, runtime, runtimeAvailable: executableAvailable(runtime, env),
    telemetry: 'not-ready', dashboardAvailable: existsSync(path.join(packageRoot, 'tools/dashboard/dist/index.html')),
    readyToWork: false, nextAction: `${cli} help getting-started`, diagnostics: [], plan: null };
  if (!root) { result.summary = 'Open a Git project before setting up Claude.'; result.diagnostics.push('repository-unavailable'); return result; }
  const cutover = await cutoverState(root);
  if (cutover.blocked) {
    result.integration = 'cutover-in-flight'; result.diagnostics.push('cutover-in-flight');
    result.summary = 'The authority switch was interrupted or its journal needs review. Recover it before starting Claude.';
    result.nextAction = `${cli} help cutover`; return result;
  }
  const planned = await createPlan({ root, adapter, initialBootstrap: true, ...bootstrapInputs });
  const plan = planned.plan;
  result.plan = plan;
  result.project = plan.target.project;
  result.framework = plan.framework.version;
  result.adoption = plan.governance.state === 'governed' ? 'configured' : 'unconfigured';
  result.diagnostics = plan.blockers.map((item) => item.code);
  const mcpBytes = await readContained(root, '.mcp.json');
  let entry;
  try { entry = JSON.parse(mcpBytes?.toString('utf8')).mcpServers?.['dev-foundry-governance']; } catch { /* planner reports invalid configuration */ }
  if (typeof entry?.args?.[2] === 'string') result.selectedAdapterVersion = entry.args[2].split(':')[0];
  if (result.adoption === 'unconfigured') {
    const partial = await readContained(root, POP_PATH) || await readContained(root, INDEX_PATH) || entry;
    result.integration = partial ? 'partially-configured' : 'unconfigured';
    result.integration = plan.mode === 'initial-bootstrap' && plan.status === 'ready' ? 'initial-bootstrap' : partial ? 'partially-configured' : 'unconfigured';
    result.summary = result.integration === 'initial-bootstrap' ? 'This repository is not configured yet. Setup can establish DEV FOUNDRY here.' : plan.blockers[0]?.message.split(' Next: ')[0] ?? 'Project configuration needs review.';
    result.nextAction = result.integration === 'initial-bootstrap' ? `${cli} setup` : (plan.blockers[0]?.message.split('Next: ')[1] ?? `${cli} doctor --verbose`);
    return result;
  }
  const active = plan.activation?.overall === 'active';
  result.integration = plan.activation?.overall === 'partial' ? 'partially-configured' : active ? 'active' : plan.status === 'noop' ? 'prepared' : 'unconfigured';
  const telemetryPath = '.dev-foundry/telemetry/local';
  const port = env.DEV_FOUNDRY_TELEMETRY_PORT;
  const portOk = port === undefined || (/^\d+$/.test(port) && Number(port) >= 0 && Number(port) <= 65535);
  const telemetryOk = isIgnored(root, PROBE_PATH) && !(await pathHasSymlink(root, telemetryPath)) && writableAncestor(path.join(root, telemetryPath), root) && portOk;
  result.telemetry = telemetryOk ? 'ready-on-start' : 'not-ready';
  if (!telemetryOk) result.diagnostics.push('telemetry-not-ready');
  if (!result.runtimeAvailable) result.diagnostics.push('runtime-executable-unavailable');
  if (!result.dashboardAvailable) result.diagnostics.push('dashboard-unavailable');
  result.readyToWork = active && plan.status === 'noop' && telemetryOk && result.runtimeAvailable && result.dashboardAvailable;
  if (result.readyToWork) {
    result.integration = 'ready'; result.summary = 'This project is ready to work with Claude.'; result.nextAction = `${cli} start`;
  } else if (result.diagnostics.includes('adapter-runtime-mismatch') || result.diagnostics.includes('agent-file-collision') || result.diagnostics.includes('managed-block-modified')) {
    result.summary = 'The installed adapter and this project need to be brought into sync.'; result.nextAction = `${cli} upgrade`;
  } else if (plan.status === 'blocked') {
    result.summary = 'Claude integration needs attention. Review the project configuration and managed files.'; result.nextAction = `${cli} help setup`;
  } else if (plan.status === 'ready') {
    result.summary = 'This project can be prepared for Claude. Review the managed-file changes below.'; result.nextAction = `${cli} setup --yes`;
  } else if (!active) {
    result.summary = 'Claude files are prepared. The project owner still needs to approve and activate Claude through the project’s existing decision process.'; result.nextAction = `${cli} help setup`;
  } else if (!result.runtimeAvailable) {
    result.summary = `The ${runtime} launch executable is unavailable. Install the selected runtime and complete its sign-in separately.`; result.nextAction = `${cli} help start`;
  } else {
    result.summary = 'Local telemetry or the packaged dashboard needs attention.'; result.nextAction = `${cli} help doctor`;
  }
  if (legacyVersion(result.selectedAdapterVersion ?? '')) {
    result.integration = active ? 'legacy-active' : 'legacy-prepared';
    result.readyToWork = false;
    result.summary = 'This project uses a legacy adapter. Check its exact build for the one-time bridge to the 1.4.0 self-update baseline; the exact previous package is required.';
    result.nextAction = `${cli} upgrade --from-package <previous-package-directory>`;
  }
  return result;
}
const publicView = ({ plan, ...view }) => view;
const changes = (plan) => [...plan.create, ...plan.merge, ...plan.delete].map((item) => item.path);
function humanView(view) {
  return `${view.summary}\nProject: ${view.project ?? 'not configured'}\nRepository: ${view.repository ?? 'not detected'}\nDEV FOUNDRY: ${view.adoption}${view.framework ? ` (${view.framework})` : ''}\nClaude integration: ${view.integration}\nAdapter: ${view.adapterVersion}; project selection: ${view.selectedAdapterVersion ?? 'none'}\nTelemetry: ${view.telemetry} (preflight; collector starts with Claude)\nRuntime (${view.runtime}): ${view.runtimeAvailable ? 'available' : 'unavailable'}\nDashboard: ${view.dashboardAvailable ? 'packaged; run dev-foundry-claude dashboard --port 4319' : 'unavailable'}\nReady to work: ${view.readyToWork ? 'yes' : 'no'}\nNext: ${view.nextAction}`;
}

// Presentation/orchestration only: all writes go through canonical plan/apply.
export async function consumerCommand({ command, argv = [], packageRoot, cwd = process.cwd(), env = process.env,
  launcher = runLauncher, getAdapter = () => { const pin = selfPin(packageRoot); return { version: pin.version, payloadRoot: pin.root, expect: pin.expect }; },
  executableAvailable = runtimeAvailable, output = (text) => console.log(text) }) {
  if (command === 'help') {
    if (argv.length > 1) throw new ConsumerUsageError(`Choose one topic. Next: ${cli} help`);
    output(renderHelp(argv[0]).trimEnd()); return 0;
  }
  const options = optionsFor(command, argv);
  const json = options['--json'];
  const verbose = options['--verbose'];
  const emit = (data, human) => output(json ? JSON.stringify(data, null, 2) : `${human}${verbose ? `\nTechnical detail:\n${JSON.stringify(data, null, 2)}` : ''}`);
  let adapter;
  try { adapter = getAdapter(); }
  catch {
    emit({ readyToWork: false, payloadVerified: false, code: 'payload-invalid', nextAction: `${cli} help getting-started` },
      `The installed adapter could not be verified. Reinstall the release before using it. No application files were changed.\nNext: ${cli} help getting-started`); return 1;
  }
  const selected = path.resolve(cwd, options['--root'] ?? '.');
  const runtime = options['--runtime'] ?? 'direct';
  const bootstrapInputs = { project: options['--project'], classification: options['--classification'], operator: options['--operator'] };
  const view = await inspectConsumer({ root: selected, packageRoot, adapter, runtime, env, executableAvailable, bootstrapInputs });
  if (command === 'status' || command === 'doctor') {
    const data = publicView(view);
    if (command === 'doctor') data.checks = {
      repository: Boolean(view.repository), projectConfig: view.adoption === 'configured', payload: true,
      runtimePin: view.selectedAdapterVersion !== null && !view.diagnostics.includes('adapter-runtime-mismatch') && view.plan?.status !== 'blocked',
      managedSurface: view.plan?.status === 'noop', activation: view.plan?.activation?.overall === 'active',
      runtime: view.runtimeAvailable, telemetry: view.telemetry === 'ready-on-start', dashboard: view.dashboardAvailable,
    };
    emit(data, `${command === 'doctor' ? `Read-only diagnosis: ${view.readyToWork ? 'healthy' : 'attention needed'}\n` : ''}${humanView(view)}`);
    return view.readyToWork ? 0 : 2;
  }
  if (command === 'start') {
    if (!view.readyToWork) { emit(publicView(view), humanView(view)); return 2; }
    output(`Starting Claude (${runtime}) in ${view.project}. Telemetry preflight passed.`);
    const code = await launcher({ argv: ['--runtime', runtime, '--', ...options.claudeArgs], projectRoot: view.repository, env,
      onReady: ({ port }) => output(`Local telemetry is ready.${verbose ? ` Collector: http://127.0.0.1:${port}` : ''}\nDashboard: in another terminal run ${cli} dashboard --port 4319, then open its printed URL. If occupied, select another local port.`) });
    output(code === 0 ? `Claude session finished. Next: ${cli} status` : `Claude could not complete the session. Next: ${cli} doctor --runtime ${runtime}`);
    return code;
  }
  if (command === 'setup') {
    if (!view.plan || !['ready', 'noop'].includes(view.plan.status)) { emit({ ...publicView(view), plan: view.plan }, `${humanView(view)}\nApplication files affected: 0.`); return 2; }
    const result = await createPlan({ root: view.repository, adapter, initialBootstrap: true, ...bootstrapInputs });
    let applied = null;
    if ((options['--yes'] || options['--apply']) && result.plan.status === 'ready') {
      applied = await applyPlan({ root: view.repository, adapter, planBytes: result.bytes, planSha256: result.hash });
    }
    const after = applied ? await inspectConsumer({ root: view.repository, packageRoot, adapter, runtime, env, executableAvailable }) : view;
    const explicitInputs = Object.entries(bootstrapInputs).filter(([, value]) => value !== undefined).map(([key, value]) => ` --${key} ${quotedPath(value)}`).join('');
    const nextAction = applied || result.plan.status === 'noop' ? after.nextAction : `${cli} setup --yes${explicitInputs}`;
    const summary = applied ? `${result.plan.mode === 'initial-bootstrap' ? 'DEV FOUNDRY setup is complete.' : 'Claude integration files were prepared.'} ${after.summary}` : view.summary;
    emit({ ...publicView(after), summary, nextAction, applied, plan: result.plan, planSha256: result.hash },
      `${summary}${result.plan.bootstrap ? `\nProject: ${result.plan.bootstrap.project}\nClassification: ${result.plan.bootstrap.classification}\nHuman Operator: ${result.plan.bootstrap.operator}\nSelected framework: DEV FOUNDRY ${String(result.plan.framework.version ?? 'unknown')}` : ''}\nManaged/configured files ${applied ? 'prepared' : 'planned'}:\n${changes(result.plan).map((file) => `  ${file}`).join('\n') || '  none'}\nApplication files affected: 0.\nNext: ${nextAction}`);
    return 0;
  }
  if (command === 'upgrade') {
    if (!view.repository) { emit(publicView(view), humanView(view)); return 2; }
    const resolutionFile = options['--resolution-file'] ? path.resolve(cwd, options['--resolution-file']) : undefined;
    const result = await createUpgradePlan({ root: view.repository, adapter, currentPackageRoot: options['--from-package'] ? path.resolve(cwd, options['--from-package']) : undefined, resolutionFile });
    const plan = result.plan;
    const refresh = ['managed-refresh', 'legacy-bridge'].includes(plan.upgradeKind) || plan.blockers.some((item) => item.code === 'upgrade-migration-required');
    const applying = options['--yes'] || options['--apply'];
    const reviewRequired = plan.status !== 'blocked' && applying &&
      ((plan.resolutionInput && !options['--plan-sha256']) ||
        (options['--plan-sha256'] && options['--plan-sha256'] !== result.hash));
    const blocked = plan.status === 'blocked' || reviewRequired;
    let applied = null;
    const review = plan.reconciliation?.length ? `\nManaged reconciliation preflight (plan SHA-256 ${result.hash}):\nRepository: ${plan.repository.root}\nHEAD: ${plan.repository.head}\nSource pin: ${plan.current.expect}\nTarget pin: ${plan.target.expect}\n${plan.resolutionInput ? `Decision input: ${plan.resolutionInput.path}\nDecision SHA-256: ${plan.resolutionInput.sha256}\nAuthorization: explicit selection plus --plan-sha256 and --yes for this reviewed plan.\n` : ''}${plan.reconciliation.map((item) =>
      `${item.path} (${item.scope}): ${item.classification}\nBefore file: ${item.before_sha256}\nBase: ${item.base_sha256}\nCurrent: ${item.current_sha256}\nTarget: ${item.target_sha256}\nAfter: ${item.after_sha256 ?? 'unresolved'}\n${item.base_current_diff}${item.base_target_diff}${item.current_target_diff}${item.current_after_diff ?? ''}${item.target_after_diff ?? ''}`).join('\n')}` : '';
    if (!blocked && applying) {
      // Human output precedes any write so explicit application includes the
      // same reviewable preflight. JSON returns the full plan in one response.
      if (!json && review) output(review.trimStart());
      applied = await applyPlan({ root: view.repository, adapter, upgrade: true, planBytes: result.bytes, planSha256: result.hash, resolutionFile });
    }
    const governed = plan.blockers.some((item) => item.code === 'governed-migration-required');
    const unsupported = plan.blockers.some((item) => item.code === 'legacy-source-unsupported');
    const resolutionIssue = plan.blockers.some((item) => /resolution|reconciliation/.test(item.code));
    const applyAction = `${cli} upgrade${options['--from-package'] ? ` --from-package ${quotedPath(path.resolve(cwd, options['--from-package']))}` : ''}${resolutionFile ? ` --resolution-file ${quotedPath(resolutionFile)} --plan-sha256 ${result.hash}` : ''} --yes`;
    const nextAction = reviewRequired ? applyAction : applied && plan.activation?.overall === 'active' ? `${cli} start` : governed ? plan.nextAction : blocked ? refresh || unsupported || resolutionIssue ? `${cli} help upgrade` : `${cli} doctor` : applied || plan.status === 'noop' ? `${cli} status` : applyAction;
    const summary = reviewRequired ? 'Application refused: review this preflight and supply its exact --plan-sha256 with --yes. The reviewed plan is missing or changed.' : unsupported ? 'This exact legacy build has no proven bridge. Keep the current runtime and obtain the exact previous release and its provenance.' : governed ? 'This release changes project governance configuration. Continue the upgrade in your current governed Claude session.' : blocked ? resolutionIssue ? 'Managed-file reconciliation is blocked. Review the conflict diffs and the exact resolution-file requirements in help upgrade.' : refresh ? 'Some DEV FOUNDRY-managed files need to be refreshed. The one-time legacy bridge requires the exact previous package to verify ownership before applying.' : 'Upgrade could not be planned safely. Review the current project configuration.'
      : applied ? 'DEV FOUNDRY upgrade applied.' : plan.status === 'noop' ? 'This project already selects the installed adapter.' : refresh ? 'Some DEV FOUNDRY-managed files need to be refreshed.' : 'A compatible runtime pin upgrade is available.';
    emit({ summary, nextAction, applied, plan, planSha256: result.hash, applicationFilesAffected: 0 },
      `${summary}\nAdapter: ${plan.current?.version ?? 'unknown'} -> ${plan.target.version}\nManaged files ${applied ? 'changed' : 'planned'}: ${blocked ? 'none (plan refused)' : changes(plan).join(', ') || 'none'}${applied ? '' : review}\nYour application code will not be changed. Application files affected: 0.\nNext: ${nextAction}`);
    return blocked ? 2 : 0;
  }
  throw new ConsumerUsageError(`Unknown command. Next: ${cli} help`);
}
