import { parseDocument } from 'yaml';
import { BOOTSTRAP_KEY, BOOTSTRAP_PATH, INDEX_PATH, POP_PATH, PROFILE_PATHS, ROLES, TARGETS, isObject } from './common.js';
import { makeUnifiedDiff } from './diff.js';
import { sha256 } from './pin.js';

const render = (document) => document.toString({ lineWidth: 0 });

// Builds the single atomic cutover proposal as reviewable text. Nothing here is ever written by apply.
export function buildCutoverProposal(facts, adds, indexBindingIds) {
  const popText = facts.popBytes.toString('utf8');
  const pop = parseDocument(popText);
  const edits = [];
  const retired = [];

  for (const role of ROLES) {
    const target = TARGETS[role];
    const implementation = { kind: target.kind, identity: target.identity, platform: target.platform };
    if (isObject(facts.pop.actor_bindings[role])) {
      pop.setIn(['actor_bindings', role, 'implementation'], pop.createNode(implementation));
      pop.setIn(['actor_bindings', role, 'capability_profiles'], pop.createNode(target.capabilities));
    } else {
      pop.setIn(['actor_bindings', role], pop.createNode({
        profile: facts.actorProfiles[role], implementation, capability_profiles: target.capabilities, status: 'active',
      }));
    }
  }
  for (const entry of facts.bootstraps) {
    if (entry.status !== 'active') continue;
    pop.setIn(['platform_bootstraps', entry.key, 'status'], 'retired');
    retired.push(entry);
  }
  pop.setIn(['platform_bootstraps', BOOTSTRAP_KEY], pop.createNode({ path: BOOTSTRAP_PATH, status: 'active' }));
  edits.push({ path: POP_PATH, base: facts.popBytes.toString('utf8'), after: render(pop) });

  for (const entry of retired) {
    if (!entry.bytes) continue;
    const document = parseDocument(entry.bytes.toString('utf8'));
    document.set('status', 'retired');
    edits.push({ path: entry.path, base: entry.bytes.toString('utf8'), after: render(document) });
  }

  const index = parseDocument(facts.indexBytes.toString('utf8'));
  const bindings = index.get('bindings');
  if (bindings && Array.isArray(bindings.items)) {
    bindings.items.forEach((item, position) => {
      if (isObject(facts.index.bindings?.[position]) && facts.index.bindings[position].kind === 'capability-profile' && facts.index.bindings[position].required === true) {
        index.setIn(['bindings', position, 'required'], false);
      }
    });
  }
  const newBindings = [
    { id: indexBindingIds.executor, path: PROFILE_PATHS.executor, kind: 'capability-profile' },
    { id: indexBindingIds.auditor, path: PROFILE_PATHS.auditor, kind: 'capability-profile' },
    { id: indexBindingIds.bootstrap, path: BOOTSTRAP_PATH, kind: 'platform-bootstrap' },
  ];
  for (const binding of newBindings) {
    if (!index.has('bindings')) index.set('bindings', index.createNode([]));
    index.addIn(['bindings'], index.createNode({ ...binding, authority_class: 'configured', required: true }));
  }
  edits.push({ path: INDEX_PATH, base: facts.indexBytes.toString('utf8'), after: render(index) });

  return {
    atomic: true,
    authorization: 'requires consumer-governed cutover authorization; apply never writes this proposal',
    preconditions: ['every base_sha256 is current', 'runner-bound in-flight work is closed or handed off'],
    edits: edits.map((edit) => ({ path: edit.path, base_sha256: sha256(Buffer.from(edit.base, 'utf8')), diff: makeUnifiedDiff(edit.path, edit.base, edit.after) })),
    adds: Object.entries(adds).sort(([a], [b]) => (a < b ? -1 : 1)).map(([filePath, content]) => ({ path: filePath, sha256: sha256(Buffer.from(content, 'utf8')), content })),
  };
}
