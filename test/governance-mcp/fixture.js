import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const roles = ['governance-author', 'implementation-executor', 'mechanical-validator', 'governance-auditor', 'evidence-custodian'];

export async function makeProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'governance-mcp-'));
  const put = async (relative, contents) => {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  };
  const doc = (id, type, status, governedBy = [], lifecycle = 'active', body = '') =>
    `---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: ${id}\n  type: ${type}\n  status: ${status}\nauthority:\n  governedBy: [${governedBy.join(', ')}]\nlifecycle:\n  phase: ${lifecycle}\n---\n\n${body}\n`;
  const taskPath = 'docs/tasks/task.md';
  const decisionPath = 'docs/decisions/decision.md';
  const overviewPath = 'docs/overview/overview.md';
  const frameworkDocPath = '.dev-foundry/releases/2.1.0/docs/OPS-001.md';
  await put(taskPath, doc('TSK-002', 'TSK', 'IN_PROGRESS', ['ADR-001'], 'in-progress', 'PRIVATE_TASK_BODY_MARKER'));
  await put(decisionPath, doc('ADR-001', 'ADR', 'ACCEPTED', ['OPS-001'], 'accepted'));
  await put(overviewPath, doc('OVR-001', 'OVR', 'ACTIVE', [], 'active'));
  await put(frameworkDocPath, doc('OPS-001', 'OPS', 'ACTIVE', [], 'active'));
  const projectRoutes = [
    { id: 'active-framework', path: '.dev-foundry/releases/2.1.0/authority-index.yaml', authority_class: 'methodology', governs: ['reusable-dev-foundry-methodology'], section_id: null },
    { id: 'task-route-with-independent-id', path: taskPath, authority_class: 'task', governs: ['task'], section_id: null },
    { id: 'decision-route', path: decisionPath, authority_class: 'decision', governs: ['decision'], section_id: null },
    { id: 'project-overview-route', path: overviewPath, authority_class: 'product', governs: ['project'], section_id: null },
  ];
  const projectIndex = {
    schema_version: 'dev-foundry.authority-index.v2', id: 'PROJECT-AUTHORITY-INDEX', status: 'active',
    subject: { kind: 'project', id: 'fixture-project', base_version: '2.1.0' }, routes: projectRoutes,
  };
  const frameworkIndex = {
    schema_version: 'dev-foundry.authority-index.v2', id: 'FRAMEWORK-AUTHORITY-INDEX', status: 'active',
    subject: { kind: 'framework-release', id: 'DF-FRAMEWORK-2.1.0', version: '2.1.0' },
    routes: [{ id: 'framework-route-not-artifact-id', path: frameworkDocPath, authority_class: 'methodology', governs: ['lifecycle'], section_id: null }],
  };
  const bindings = {};
  for (const role of roles) {
    const profilePath = `.dev-foundry/releases/2.1.0/actor-profiles/${role}.yaml`;
    bindings[role] = { profile: profilePath, status: 'active', capability_profiles: [] };
    await put(profilePath, `schema_version: dev-foundry.actor-profile.v2\nid: ${role}-profile\nstatus: active\nrole: ${role}\n`);
  }
  const capabilityPath = '.dev-foundry/profiles/capability-profiles/executor.yaml';
  bindings['implementation-executor'].capability_profiles = [capabilityPath];
  await put(capabilityPath, 'schema_version: dev-foundry.capability-profile.v1\nid: EXECUTOR-CAPABILITY\nstatus: active\n');
  const pop = {
    schema_version: 'dev-foundry.project-operating-profile.v2', id: 'PROJECT-POP', status: 'active',
    repository: { name: 'fixture-project' },
    framework: { adopted_version: '2.1.0', selected_authority_index: '.dev-foundry/releases/2.1.0/authority-index.yaml', selected_manifest: '.dev-foundry/releases/2.1.0/release-integrity-manifest.yaml', adoption_status: 'active' },
    policies: { default_role: 'governance-author' }, actor_bindings: bindings,
  };
  await put('.dev-foundry/profiles/project-operating-profile.yaml', `${JSON.stringify(pop, null, 2)}\n`);
  await put('.dev-foundry/authority-index.yaml', `${JSON.stringify(projectIndex, null, 2)}\n`);
  await put('.dev-foundry/releases/2.1.0/authority-index.yaml', `${JSON.stringify(frameworkIndex, null, 2)}\n`);
  return {
    root,
    taskPath,
    decisionPath,
    frameworkDocPath,
    async write(relative, value) { await put(relative, value); },
    async cleanup() { await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true })); },
  };
}
