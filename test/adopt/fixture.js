import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { applyUnifiedDiff } from '../../src/adopt/diff.js';
import { ROLES } from '../../src/adopt/common.js';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const adapterIdentity = { version: '9.9.9', payloadRoot: 'f'.repeat(64), expect: `9.9.9:sha256:${'f'.repeat(64)}` };
export const PROJECT = 'acme-billing';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const actorFiles = {
  'governance-author': 'governance-author-v3', 'governance-auditor': 'governance-auditor-v2', 'implementation-executor': 'implementation-executor-v2',
  'mechanical-validator': 'mechanical-validator-v2', 'evidence-custodian': 'evidence-custodian-v1',
};
const doc = (id, type, status, governedBy, phase, body = '') =>
  `---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: ${id}\n  type: ${type}\n  status: ${status}\nauthority:\n  governedBy: [${governedBy.join(', ')}]\nlifecycle:\n  phase: ${phase}\n---\n\n${body}\n`;

export function gitIn(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
}

// options.name overrides the project name; options.ignore overrides .dev-foundry/.gitignore content;
// options.git === false skips git; options.governed === false builds an ungoverned repository.
export async function makeConsumer(options = {}) {
  const project = options.name ?? PROJECT;
  const root = await mkdtemp(path.join(os.tmpdir(), 'acme-consumer-'));
  const put = async (relative, contents) => {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  };
  await put('src/billing.js', 'export const total = (items) => items.reduce((sum, item) => sum + item.price, 0);\n');
  await put('docs/00-overview/OVR-001.md', doc('OVR-001', 'OVR', 'ACTIVE', [], 'active', 'ACME_OVERVIEW_MARKER'));
  await put('docs/10-decisions/ADR-001.md', doc('ADR-001', 'ADR', 'ACCEPTED', ['OPS-001'], 'accepted'));
  await put('docs/70-tasks/TSK-001.md', doc('TSK-001', 'TSK', 'IN_PROGRESS', ['ADR-001'], 'in-progress', 'ACME_TASK_MARKER'));
  await put('CLAUDE.md', '# Acme billing\n\nBuild with `npm test`. Keep invoices immutable.\n');
  await put('.mcp.json', `${JSON.stringify({ mcpServers: { other: { type: 'stdio', command: 'other-server', args: ['--flag'] } } }, null, 2)}\n`);
  await put('.claude/settings.local.json', `${JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }, null, 2)}\n`);
  await put('.dev-foundry/.gitignore', options.ignore ?? 'execution-requests/\nprompts/\n');
  if (options.governed !== false) {
    await cp(path.join(repoRoot, '.dev-foundry/releases'), path.join(root, '.dev-foundry/releases'), { recursive: true });
    const runnerProfile = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml';
    await put(runnerProfile, stringify({
      schema_version: 'dev-foundry.capability-profile.v1', id: 'ACME-IMPLEMENTATION-EXECUTOR-RUNNER-V2', status: 'active',
      limits: { repository: project, platform: 'runner', implementation_identity: 'acme-runner' },
    }));
    await put('.dev-foundry/platform-bootstrap.yaml', stringify({
      schema_version: 'dev-foundry.platform-bootstrap.v2', id: 'ACME-PLATFORM-BOOTSTRAP', title: `${project} Platform Bootstrap`, kind: 'platform-bootstrap',
      status: 'active', artifact_version: '2.1.0-local.1', canonical: false, methodology_authority: false,
      repository: { expected_name: options.bootstrapName ?? project, workspace_binding: 'repository-root' },
      sources: { project_operating_profile: '.dev-foundry/profiles/project-operating-profile.yaml', authority_index: '.dev-foundry/authority-index.yaml' },
      actor_resolution: { mode: 'fixed', eligible_profiles: [], fixed_profile: '.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml', default_role: 'governance-author', rule: 'Runner bootstrap.' },
      platform: { id: 'acme-runner', startup_constraints: ['start from the repository root'] },
      constraints: ['capability does not grant authority'],
    }));
    const bindings = {};
    for (const role of ROLES) {
      bindings[role] = {
        profile: `.dev-foundry/releases/2.1.0/actor-profiles/${actorFiles[role]}.yaml`,
        implementation: { kind: 'service', identity: 'acme-runner', platform: 'runner' },
        capability_profiles: role === 'implementation-executor' ? [runnerProfile] : [],
        status: 'active',
      };
    }
    await put('.dev-foundry/profiles/project-operating-profile.yaml', stringify({
      schema_version: 'dev-foundry.project-operating-profile.v2', id: options.popId ?? 'ACME-PROJECT-OPERATING-PROFILE', title: `${project} Project Operating Profile`,
      kind: 'project-operating-profile', status: 'active', artifact_version: '2.1.0-local.1', canonical: false,
      repository: { name: project, classification: 'brownfield', authority_index: '.dev-foundry/authority-index.yaml' },
      framework: { adopted_version: '2.1.0', selected_authority_index: '.dev-foundry/releases/2.1.0/authority-index.yaml', selected_manifest: '.dev-foundry/releases/2.1.0/release-integrity-manifest.yaml', adoption_status: 'active' },
      operator: { kind: 'human', identity: 'Acme Operator' },
      actor_bindings: bindings,
      platform_bootstraps: { 'primary-governance-agent': { path: '.dev-foundry/platform-bootstrap.yaml', status: 'active' } },
      policies: { frontmatter_schema: 'dev-foundry.sot-document.v2', metadata_migration_mode: 'on-touch', audit_triggers: [], promotion_rules: [], default_role: 'governance-author' },
      deviations: [],
    }));
    const route = (id, file, authority_class, governs) => ({ id, path: file, authority_class, governs, section_id: null });
    await put('.dev-foundry/authority-index.yaml', stringify({
      schema_version: 'dev-foundry.authority-index.v2', id: 'ACME-AUTHORITY-INDEX', title: `${project} Authority Index`, kind: 'authority-index', status: 'active', artifact_version: '2.1.0-local.1', canonical: false,
      subject: { kind: 'project', id: options.indexSubject ?? project, version: null, base_version: '2.1.0', manifest: null },
      routes: [
        route('active-framework', '.dev-foundry/releases/2.1.0/authority-index.yaml', 'methodology', ['reusable-dev-foundry-methodology']),
        route('project-overview', 'docs/00-overview/OVR-001.md', 'product', ['project-purpose']),
        route('adr-001', 'docs/10-decisions/ADR-001.md', 'decision', ['billing-decision']),
        route('tsk-001', 'docs/70-tasks/TSK-001.md', 'task', ['billing-task']),
      ],
      bindings: [
        { id: 'project-operating-profile', path: '.dev-foundry/profiles/project-operating-profile.yaml', kind: 'project-operating-profile', authority_class: 'configured', required: true },
        { id: 'platform-bootstrap', path: '.dev-foundry/platform-bootstrap.yaml', kind: 'platform-bootstrap', authority_class: 'configured', required: true },
        { id: 'implementation-executor-capability', path: runnerProfile, kind: 'capability-profile', authority_class: 'configured', required: true },
      ],
      rules: { single_authoritative_home_required: true, unindexed_active_authority_forbidden: true, evidence_is_normative: false, consumer_copy_is_canonical: false, runtime_capability_grants_authority: false, automatic_framework_upgrade: false },
    }));
  }
  if (options.git !== false) {
    gitIn(root, 'init', '-q');
    gitIn(root, 'config', 'user.email', 'test@example.invalid');
    gitIn(root, 'config', 'user.name', 'Test');
    gitIn(root, 'config', 'commit.gpgsign', 'false');
    gitIn(root, 'add', '-A');
    gitIn(root, 'commit', '-q', '-m', 'baseline');
  }
  return {
    root, put,
    commit() { gitIn(root, 'add', '-A'); gitIn(root, 'commit', '-q', '-m', 'step', '--allow-empty'); },
    read: (relative) => readFile(path.join(root, relative), 'utf8'),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export async function listTree(root) {
  const tree = new Map();
  const walk = async (directory, relative) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (relative === '' && entry.name === '.git') continue;
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), rel);
      else tree.set(rel, sha(await readFile(path.join(directory, entry.name))));
    }
  };
  await walk(root, '');
  return tree;
}

export const treeHash = async (root) => sha(JSON.stringify([...(await listTree(root))].sort()));
export const diffTrees = (before, after) => [...new Set([...before.keys(), ...after.keys()])].filter((key) => before.get(key) !== after.get(key)).sort();

// Runner read-set snapshot: every authority/configuration file under .dev-foundry/** except runtime
// directories and the ignore file, plus docs/**.
export async function readSetSnapshot(root) {
  const tree = await listTree(root);
  const runtime = /^\.dev-foundry\/(?:execution-requests|validation-requests|execution-contracts|prompts|validations|repository-transactions|executions|telemetry)\//;
  return Object.fromEntries([...tree].filter(([key]) => (key.startsWith('.dev-foundry/') && !runtime.test(key) && key !== '.dev-foundry/.gitignore') || key.startsWith('docs/')).sort());
}

// Fixture-simulated governed consumer cutover: applies the proposal as a patch.
export async function applyProposal(root, proposal) {
  for (const edit of proposal.edits) {
    const target = path.join(root, edit.path);
    const base = await readFile(target);
    if (sha(base) !== edit.base_sha256) throw new Error(`stale base for ${edit.path}`);
    await writeFile(target, applyUnifiedDiff(base.toString('utf8'), edit.diff));
  }
  for (const add of proposal.adds) {
    const target = path.join(root, add.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, add.content);
  }
}
