import path from 'node:path';
import { currentMigrationMaterial, legacyVersion, migrationRequiresGovernedSession } from './migration.js';
import { readFile, realpath } from 'node:fs/promises';
import { AGENT_PATHS, CLAUDE_MD, MCP_FILE, MCP_SERVER_NAME, POP_PATH, isObject, readContained, readYamlContained } from './common.js';
import { makeUnifiedDiff } from './diff.js';
import { git } from './ignore.js';
import { createPlan } from './plan.js';
import { canonicalJson, parseExpect, selfPin, sha256 } from './pin.js';

// Both upgrade forms use adoption's rendering, collision checks and apply model.
// A refresh additionally proves ownership against the exact pinned old payload.
export async function createUpgradePlan({ root: rootArgument, adapter, currentPackageRoot }) {
  const plan = {
    planFormat: 'dev-foundry.upgrade-plan.v1', mode: 'upgrade', status: 'blocked',
    current: null, target: adapter, repository: null, activation: null,
    create: [], merge: [], delete: [], noop: [], blockers: [], preconditions: {},
  };
  const ops = { writes: [], deletes: [] };
  const finish = () => {
    const bytes = Buffer.from(canonicalJson(plan));
    return { plan, bytes, hash: sha256(bytes), ops };
  };
  const block = (code, message) => plan.blockers.push({ code, message });
  let root, before, config, entry;
  try {
    root = await realpath(path.resolve(rootArgument ?? process.cwd()));
    before = await readContained(root, MCP_FILE);
    config = JSON.parse(before.toString('utf8'));
    entry = config.mcpServers[MCP_SERVER_NAME];
    if (!isObject(entry) || entry.command !== 'dev-foundry-claude' ||
        !Array.isArray(entry.args) || entry.args.length !== 3 || entry.args[0] !== 'mcp' || entry.args[1] !== '--expect') throw new Error();
    const pin = parseExpect(entry.args[2]);
    plan.current = { version: pin.version, payloadRoot: pin.root, expect: entry.args[2] };
  } catch {
    block('upgrade-current-pin-invalid', 'A valid existing adapter runtime pin is required.');
    return finish();
  }

  const release = await currentMigrationMaterial();
  plan.migrationMaterialSha256 = release.materialSha256;
  const currentFrameworkVersion = (await readYamlContained(root, POP_PATH))?.framework?.adopted_version;
  const governedMigration = migrationRequiresGovernedSession(release.material, currentFrameworkVersion);
  if (plan.current.expect !== adapter.expect && governedMigration) {
    block('governed-migration-required', 'This release changes project governance. Continue the upgrade in your currently governed Claude session using the verified staged target.');
    plan.nextAction = 'Continue in your currently governed Claude session; after cutover run dev-foundry-claude start';
    return finish();
  }
  const legacy = adapter.version === release.material.selfUpdateBaseline && legacyVersion(plan.current.version);
  if (legacy) {
    const recipe = release.material.legacy.find((item) => item.source === plan.current.expect);
    if (!recipe || recipe.configuredAuthorityTransforms?.length !== 0 || recipe.preserveForeignRuntime !== true || !Array.isArray(recipe.allowedPaths) ||
        recipe.allowedPaths.length !== 4 || new Set(recipe.allowedPaths).size !== 4 ||
        recipe.allowedPaths.some((file) => ![...Object.values(AGENT_PATHS), CLAUDE_MD, MCP_FILE].includes(file))) {
      block('legacy-source-unsupported', 'This exact legacy build has no verified bridge. Keep the current runtime and obtain its released package and provenance.');
      return finish();
    }
    plan.legacyRecipe = recipe.id;
    plan.upgradeKind = 'legacy-bridge';
    if (!currentPackageRoot) {
      block('legacy-package-required', 'A one-time legacy bridge is available. Keep the exact previous package and pass it with --from-package to prove managed-file ownership.');
      return finish();
    }
  }

  // Keep the current pin while comparing managed bytes through adoption.
  let compatible = await createPlan({ root, adapter: plan.current });
  if ((legacy || compatible.plan.status !== 'noop') && currentPackageRoot) {
    try {
      const source = await realpath(path.resolve(currentPackageRoot));
      if (selfPin(source).expect !== plan.current.expect) throw new Error();
      const relative = path.relative(root, source);
      if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error();
      if (JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')).name !== '@dev-foundry/claude-adapter') throw new Error();
      const previous = await createPlan({ root, adapter: plan.current, templatesRoot: path.join(source, 'templates') });
      if (previous.plan.status !== 'noop') throw new Error();
      compatible = await createPlan({ root, adapter: plan.current, managedRefreshHashes: previous.plan.preconditions });
      const allowed = new Set([...Object.values(AGENT_PATHS), CLAUDE_MD]);
      if (compatible.plan.status === 'blocked' || compatible.plan.create.length || compatible.plan.delete.length ||
          compatible.ops.writes.some((item) => !allowed.has(item.path))) throw new Error();
      plan.currentPackageRoot = source;
      plan.upgradeKind = legacy ? 'legacy-bridge' : 'managed-refresh';
    } catch {
      block('upgrade-ownership-unverified', 'The previous package must match the project pin and every existing managed file. Restore the original managed files or provide the exact previous package with --from-package.');
    }
  }
  plan.activation = compatible.plan.activation;
  plan.preconditions = compatible.plan.preconditions;
  plan.guaranteed_untouched = compatible.plan.guaranteed_untouched;
  const head = git(root, ['rev-parse', 'HEAD']);
  const drift = git(root, ['diff', 'HEAD', '--binary']);
  const status = git(root, ['status', '--porcelain', '--untracked-files=all']);
  if (head.status !== 0 || drift.status !== 0 || status.status !== 0) {
    block('upgrade-repository-invalid', 'Repository state cannot be established.');
  }
  plan.repository = { root, head: head.stdout.trim(), diffSha256: sha256(drift.stdout), statusSha256: sha256(status.stdout) };
  if (compatible.plan.status !== 'noop' && !['managed-refresh', 'legacy-bridge'].includes(plan.upgradeKind)) {
    plan.blockers.push(...compatible.plan.blockers);
    block('upgrade-migration-required', 'Some DEV FOUNDRY-managed files need to be refreshed. Supply the exact previous installed package with --from-package to verify ownership. Your application code will not be changed.');
  }
  if (plan.blockers.length) return finish();
  if (plan.current.expect === adapter.expect && !plan.upgradeKind) {
    plan.status = 'noop';
    plan.noop = [MCP_FILE];
    return finish();
  }
  const touched = git(root, ['status', '--porcelain', '--untracked-files=all', '--', MCP_FILE, ...compatible.ops.writes.map((item) => item.path)]);
  if (touched.status !== 0 || touched.stdout.trim() !== '') {
    block('dirty-working-tree', 'The runtime pin path has uncommitted changes.');
    return finish();
  }
  entry.args[2] = adapter.expect;
  const after = `${JSON.stringify(config, null, 2)}\n`;
  plan.merge = [...compatible.plan.merge, { path: MCP_FILE, before_sha256: sha256(before), after_sha256: sha256(after), diff: makeUnifiedDiff(MCP_FILE, before.toString('utf8'), after) }].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  ops.writes.push(...compatible.ops.writes);
  ops.writes.push({ path: MCP_FILE, content: after });
  plan.status = 'ready';
  return finish();
}

export async function upgradeStatus(options) {
  const { plan } = await createUpgradePlan(options);
  return { status: plan.status === 'noop' ? 'current' : plan.status === 'ready' ? 'upgrade-needed' : 'blocked',
    current: plan.current, target: plan.target, blockers: plan.blockers };
}
