import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { canonicalJson, sha256 } from '../adopt/pin.js';
import { parseYamlStrict } from '../adopt/common.js';
import { refuse, resolveConsumer, safeAbsolute, inside } from './identity.js';
import { defaultStoreRoot, installedRuntime, stageRuntime, promoteRuntime } from './store.js';
import { authoritySnapshot, repository, readSafe, buildRuntimePlan, decodePlan } from './plan.js';
import { runtimeUpgradeStatus, journalLocation, exclusiveBytes } from './journal.js';
import { prepare, commit, recover, verify } from './transition.js';
import { authorize, approvedFields } from './authorization.js';
import { dispatchPlan } from './dispatch.js';

function keys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => ![...required, ...optional].includes(k))) refuse('invalid-runtime-evidence-format');
}
export function readRuntimeInput(file) {
  const bytes = file === '-' ? readFileSync(0) : readFileSync(safeAbsolute(path.resolve(file)));
  if (bytes.length > 4 * 1024 * 1024) refuse('runtime-input-too-large');
  const input = JSON.parse(bytes);
  if (canonicalJson(input) !== canonicalJson(parseYamlStrict(bytes))) refuse('ambiguous-runtime-input');
  return input;
}
function transactionInput(data, root, action) {
  keys(data, ['format', 'root', 'plan', 'planSha256', 'approval', 'evidence'], ['recovery', 'session', 'reconcileLock']);
  if (data.format !== 'dev-foundry.runtime-request.v1' || data.root !== root) refuse('wrong-runtime-request');
  const planBytes = Buffer.from(canonicalJson(data.plan));
  const plan = decodePlan(planBytes, data.planSha256);
  keys(data.approval, ['format', 'operator', 'operatorApproved', 'sourceAuthorized', 'expiresAt', 'bound', 'phases']);
  keys(data.approval.bound, Object.keys(approvedFields(plan, data.planSha256)));
  for (const gate of data.evidence ?? []) keys(gate, ['id', 'sha256', 'status']);
  if (data.recovery) keys(data.recovery, ['operatorApproved', 'planSha256', 'outcome', 'reason']);
  if (data.session) keys(data.session, ['format', 'evidence']);
  if ((data.recovery && action !== 'recover') || (data.session && action !== 'verify')) refuse('unrecognized-phase-evidence');
  if (data.reconcileLock) keys(data.reconcileLock, ['id', 'nonce', 'pid', 'host', 'createdAt']);
  return { ...data, root, planBytes, owner: 'runtime-cli-b3' };
}

// Actual fresh MCP process, stdio only. Never trusts a caller's independent:true
// or pin/authority assertion. A bounded read-only resource is available while
// B2 blocks governed work in await-new-session.
export async function observeFreshMcp({ root, runtime, planSha256, authority, timeoutMs = 10000 }) {
  const nonce = randomUUID();
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !['NODE_OPTIONS', 'NODE_PATH', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'].includes(k)));
  Object.assign(env, { CLAUDE_PROJECT_DIR: root, DEV_FOUNDRY_RUNTIME_PROBE: nonce });
  const child = spawn(safeAbsolute(process.execPath), [path.join(runtime.packageRoot, 'bin/dev-foundry-claude.js'), 'mcp', '--expect', runtime.expect], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  let buffered = '', size = 0, observation;
  try {
    observation = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fresh target MCP did not verify; keep transaction pending and inspect runtime doctor.')), timeoutMs);
      const finish = (error, value) => { clearTimeout(timer); error ? reject(error) : resolve(value); };
      child.once('error', e => finish(e)); child.once('exit', () => finish(new Error('Fresh target MCP exited before verification.')));
      child.stderr.on('data', () => {});
      child.stdout.on('data', bytes => {
        size += bytes.length; if (size > 1024 * 1024) { finish(new Error('Unbounded MCP response.')); return; }
        buffered += bytes.toString();
        while (buffered.includes('\n')) {
          const index = buffered.indexOf('\n'), line = buffered.slice(0, index); buffered = buffered.slice(index + 1);
          let response; try { response = JSON.parse(line); } catch { finish(new Error('Invalid MCP response.')); return; }
          if (response.id === 1) {
            if (response.error || !response.result?.protocolVersion) { finish(new Error('MCP initialization failed.')); return; }
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'dev-foundry://runtime/identity' } }) + '\n');
          } else if (response.id === 2) {
            let identity; try { identity = JSON.parse(response.result.contents[0].text); } catch { finish(new Error('MCP identity unavailable.')); return; }
            if (identity.activation !== 'active') { finish(new Error('Fresh target MCP binding is inactive; retain the pending transaction and review current POP/index/profile ownership.')); return; }
            if (identity.format !== 'dev-foundry.runtime-identity.v1' || identity.probe !== nonce || identity.pid !== child.pid || identity.repositoryRoot !== root || identity.packageRoot !== runtime.packageRoot || identity.pin !== runtime.expect || identity.planSha256 !== planSha256 || identity.authority !== authority || !identity.sessionId || !['await-new-session', 'verifying'].includes(identity.journalState)) { finish(new Error('Fresh MCP identity mismatch.')); return; }
            finish(null, identity);
          }
        }
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'dev-foundry-runtime-verifier', version: '1' } } }) + '\n');
    });
  } finally {
    // This child was created here and is never a shared listener. Ordinary
    // termination only; no SIGKILL or arbitrary process discovery.
    child.stdin.end(); child.kill('SIGTERM'); child.stdout.destroy(); child.stderr.destroy();
  }
  return observation;
}

export async function runtimeCommand({ argv, cwd = process.cwd(), output = text => console.log(text) }) {
  const [action, ...args] = argv;
  if (!['status', 'doctor', 'stage', 'proposal', 'plan', 'prepare', 'commit', 'recover', 'verify'].includes(action)) refuse('unknown-runtime-action');
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--root', '--store-root', '--input', '--out', '--port', '--json'].includes(flag) || Object.hasOwn(options, flag)) refuse('unknown-runtime-option');
    if (flag === '--json') options[flag] = true;
    else { const value = args[++i]; if (!value || value.startsWith('--')) refuse('runtime-option-value-required'); options[flag] = value; }
  }
  if (options['--out'] && action !== 'plan' || options['--port'] && action !== 'doctor' || options['--input'] && ['status', 'doctor'].includes(action)) refuse('unrecognized-phase-option');
  const { repositoryRoot: root, expect: selectedPin } = resolveConsumer(path.resolve(cwd, options['--root'] ?? '.'));
  const storeRoot = options['--store-root'] ? safeAbsolute(path.resolve(options['--store-root']), { missing: true }) : process.env.DEV_FOUNDRY_RUNTIME_STORE ?? defaultStoreRoot();
  const journal = runtimeUpgradeStatus(root);
  const emit = data => { output(canonicalJson(data).trimEnd()); return data.blocked ? 2 : 0; };
  if (['status', 'doctor'].includes(action)) {
    let dispatch = null, diagnostic = journal.diagnostic;
    try { dispatch = dispatchPlan({ cwd: root, storeRoot }); } catch (e) { diagnostic = e.code ?? e.message; }
    let journalIgnored = true; try { journalLocation(root, { ignore: true }); } catch { journalIgnored = false; }
    let dashboard;
    if (options['--port']) { const { inspectDashboard } = await import('../dashboard/command.js'); dashboard = await inspectDashboard({ root, expect: selectedPin, port: Number(options['--port']) }); }
    const dashboardBlocked = dashboard && ['owned-old-restart-required', 'occupied-unknown'].includes(dashboard.state);
    let nextAction;
    if (journal.state === 'unknown') nextAction = 'Preserve the journal and obtain governed recovery review; do not edit/delete unknown bytes.';
    else if (journal.blocked) nextAction = 'runtime recover with the exact approved plan, or runtime verify from a fresh target session.';
    else if (!dispatch) nextAction = 'One-time verified managed host bootstrap required (B4); preserve installed 1.4.2.';
    else if (dashboardBlocked) nextAction = 'Dashboard restart-required; use its identified owning terminal, or select another explicit local port when ownership is unknown. No process was terminated.';
    else if (!journalIgnored) nextAction = 'Establish the exact repository-local /.dfc-runtime-upgrade/ ignore rule under source authority before prepare.';
    else if (['completed', 'rolled-back'].includes(journal.state)) nextAction = 'Start a fresh session on the selected runtime. Retain transaction evidence; a further plan requires governed review of the existing B2 journal.';
    else nextAction = 'Review runtime proposal and plan under current source authority.';
    return emit({ format: 'dev-foundry.runtime-status.v1', root, selectedPin, managerAvailable: Boolean(dispatch), journalState: journal.state, planSha256: journal.planSha256 ?? null,
      blocked: Boolean(journal.blocked || !dispatch || dashboardBlocked), diagnostic: diagnostic ?? null, journalIgnored, dashboard, nextAction });
  }
  if (!options['--input']) refuse('runtime-input-required');
  const data = readRuntimeInput(options['--input']);
  if (action === 'stage') {
    keys(data, ['format', 'root', 'sourcePin', 'expect', 'candidateRoot', 'permittedCandidateRoots', 'attestation']);
    if (journal.blocked || data.format !== 'dev-foundry.runtime-stage-request.v1' || data.root !== root || data.sourcePin !== selectedPin) refuse('stage-source-mismatch');
    installedRuntime(storeRoot, selectedPin);
    return emit({ ...promoteRuntime(stageRuntime({ ...data, storeRoot })), projectChanged: false, adoptionAuthorized: false });
  }
  if (action === 'proposal') {
    keys(data, ['format', 'root', 'sourcePin', 'targetPin']);
    if (data.format !== 'dev-foundry.runtime-proposal-request.v1' || data.root !== root || data.sourcePin !== selectedPin || journal.blocked) refuse('proposal-source-mismatch');
    const source = installedRuntime(storeRoot, selectedPin), target = installedRuntime(storeRoot, data.targetPin);
    const record = JSON.parse(readFileSync(path.join(path.dirname(target.packageRoot), 'stage.json')));
    if (record.attestation.transition.source !== selectedPin || record.attestation.transition.target !== data.targetPin || selectedPin === data.targetPin) refuse('unsupported-transition-or-noop');
    const recipeBytes = readSafe(target.packageRoot, 'migrations/runtime.json');
    if (!recipeBytes) refuse('target-migration-recipe-required-governed-review');
    return emit({ format: 'dev-foundry.runtime-proposal-review.v1', source, target, repository: repository(root), authority: authoritySnapshot(root),
      recipe: JSON.parse(recipeBytes), recipeSha256: sha256(recipeBytes), adoptionAuthorized: false, nextAction: 'Source Claude must propose semantic deltas, obtain actual Operator choices, and provide validation/audit evidence to runtime plan.' });
  }
  if (action === 'plan') {
    keys(data, ['format', 'candidate']);
    if (data.format !== 'dev-foundry.runtime-candidate.v1') refuse('invalid-runtime-candidate');
    keys(data.candidate, ['root', 'storeRoot', 'sourcePin', 'targetPin', 'branch', 'head', 'framework', 'proposal', 'files', 'choices', 'gates']);
    if (data.candidate.root !== root || data.candidate.storeRoot !== storeRoot || data.candidate.sourcePin !== selectedPin) refuse('wrong-project-or-store');
    for (const file of data.candidate.files) keys(file, ['path', 'owner', 'beforeSha256', 'afterSha256', 'after']);
    for (const choice of data.candidate.choices) keys(choice, ['id', 'value']);
    for (const gate of data.candidate.gates) keys(gate, ['id', 'path', 'sha256']);
    keys(data.candidate.proposal, ['kind', 'sourcePin', 'sourceAuthority', 'sourceSessionId', 'evidence']);
    const result = buildRuntimePlan(data.candidate);
    if (options['--out']) {
      const out = safeAbsolute(path.resolve(options['--out']), { missing: true });
      if (inside(root, out) || inside(storeRoot, out)) refuse('plan-output-must-be-external');
      exclusiveBytes(out, result.bytes);
    }
    return emit({ format: 'dev-foundry.runtime-plan-review.v1', plan: result.plan, planSha256: result.hash, approvalRequired: approvedFields(result.plan, result.hash), adoptionAuthorized: false });
  }
  const input = transactionInput(data, root, action);
  if (input.plan.storeRoot !== storeRoot) refuse('wrong-store');
  authorize(input.plan, input.planSha256, input.approval, input.evidence);
  if (action === 'verify') {
    if (data.session?.format !== 'dev-foundry.runtime-session-request.v1' || !data.session.evidence?.trim()) refuse('fresh-session-evidence-required');
    if (!['await-new-session', 'verifying'].includes(journal.state) || journal.planSha256 !== input.planSha256) refuse('fresh-verification-state-required');
    const runtime = installedRuntime(storeRoot, input.plan.targetPin);
    const observation = await observeFreshMcp({ root, runtime, planSha256: input.planSha256, authority: input.plan.targetAuthority });
    const session = { id: observation.sessionId, independent: true, pin: observation.pin, authority: observation.authority, planSha256: input.planSha256,
      evidence: canonicalJson({ callerEvidence: data.session.evidence, observation }) };
    return emit({ ...verify({ ...input, session }), verification: 'fresh-MCP-process', modelAndHostAcceptance: 'B4-unverified' });
  }
  return emit((action === 'prepare' ? prepare : action === 'commit' ? commit : recover)(input));
}
