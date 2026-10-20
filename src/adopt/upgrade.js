import path from 'node:path';
import { currentMigrationMaterial, legacyVersion, migrationRequiresGovernedSession } from './migration.js';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { AGENT_PATHS, BOOTSTRAP_PATH, CLAUDE_MD, MCP_FILE, MCP_SERVER_NAME, POP_PATH, PROFILE_PATHS, RECONCILIATION_FILE, RECONCILIATION_KEY, isObject, parseYamlStrict, pathHasSymlink, readContained, readYamlContained } from './common.js';
import { makeUnifiedDiff } from './diff.js';
import { git } from './ignore.js';
import { createPlan, hasUnresolvedDirtyPaths, reconciliationSurface } from './plan.js';
import { canonicalJson, parseExpect, selfPin, sha256 } from './pin.js';

const exactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const resolutionPaths = new Set([...Object.values(AGENT_PATHS), CLAUDE_MD, ...Object.values(PROFILE_PATHS), BOOTSTRAP_PATH]);

// This is Operator-selected candidate data, not a self-attesting authorization.
// Explicit application of the reviewed exact plan is the authorization boundary.
async function readResolution(file, root, source, target) {
  const location = path.resolve(file);
  const relative = path.relative(root, location);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) ||
      await pathHasSymlink(path.parse(location).root, location.slice(path.parse(location).root.length).split(path.sep).join('/')) ||
      !(await lstat(location)).isFile()) throw new Error();
  const bytes = await readFile(location);
  const input = JSON.parse(bytes.toString('utf8'));
  // Also reject duplicate JSON keys and invalid UTF-8 rather than reinterpret them.
  if (!bytes.equals(Buffer.from(bytes.toString('utf8'))) || !parseYamlStrict(bytes) ||
      !exactKeys(input, ['format', 'repository', 'source', 'target', 'files']) ||
      input.format !== 'dev-foundry.managed-resolution.v1' ||
      !exactKeys(input.repository, ['root', 'head']) || input.repository.root !== root ||
      input.repository.head !== git(root, ['rev-parse', 'HEAD']).stdout.trim() ||
      input.source !== source || input.target !== target || !Array.isArray(input.files) || !input.files.length) throw new Error();
  const seen = new Set();
  for (const item of input.files) {
    if (!exactKeys(item, ['path', 'before_sha256', 'base_sha256', 'current_sha256', 'target_sha256', 'resolved_sha256', 'resolved_content']) ||
        !resolutionPaths.has(item.path) || seen.has(item.path) ||
        !['before_sha256', 'base_sha256', 'current_sha256', 'target_sha256', 'resolved_sha256'].every((key) => hash(item[key])) ||
        typeof item.resolved_content !== 'string' || !item.resolved_content || /[\u0000\ufffd]/.test(item.resolved_content) ||
        Buffer.from(item.resolved_content).toString('utf8') !== item.resolved_content || sha256(item.resolved_content) !== item.resolved_sha256) throw new Error();
    seen.add(item.path);
  }
  return { files: input.files, provenance: { path: location, sha256: sha256(bytes), source: 'operator-selected-file', authorization: 'explicit-reviewed-plan-apply-required' } };
}

// Both upgrade forms use adoption's rendering, collision checks and apply model.
// A refresh additionally proves ownership against the exact pinned old payload.
export async function createUpgradePlan({ root: rootArgument, adapter, currentPackageRoot, resolutionFile }) {
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

  let resolution;
  if (resolutionFile !== undefined) {
    try {
      if (!currentPackageRoot) throw new Error();
      resolution = await readResolution(resolutionFile, root, plan.current.expect, adapter.expect);
      plan.resolutionInput = resolution.provenance;
    } catch {
      block('upgrade-resolution-invalid', 'The explicitly selected resolution file must have the closed schema, exact repository/source/target and content hashes, and only managed conflict paths.');
      return finish();
    }
  }
  // Keep the current pin while comparing managed bytes through adoption.
  let compatible = await createPlan({ root, adapter: plan.current });
  if (currentPackageRoot) {
    try {
      const source = await realpath(path.resolve(currentPackageRoot));
      if (selfPin(source).expect !== plan.current.expect) throw new Error();
      const relative = path.relative(root, source);
      if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error();
      if (JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')).name !== '@dev-foundry/claude-adapter') throw new Error();
      compatible = await createPlan({ root, adapter: plan.current, managedBaseTemplatesRoot: path.join(source, 'templates'), managedResolutions: resolution?.files });
      if (selfPin(source).expect !== plan.current.expect) throw new Error();
      plan.reconciliation = compatible.plan.reconciliation;
      plan.currentPackageRoot = source;
      if (resolution?.files.some((item) => !plan.reconciliation?.some((record) => record.path === item.path && record.classification === 'operator-resolved'))) {
        block('upgrade-resolution-unused', 'Every selected resolution must match an existing verified managed conflict and its exact fingerprints.');
      }
      if (!['noop', 'ready'].includes(compatible.plan.status) || compatible.plan.create.length || compatible.plan.delete.length ||
          compatible.ops.writes.some((item) => !resolutionPaths.has(item.path) ||
            (![...Object.values(AGENT_PATHS), CLAUDE_MD].includes(item.path) &&
              !plan.reconciliation?.some((record) => record.path === item.path && record.classification === 'operator-resolved')))) throw new Error();
      plan.upgradeKind = legacy ? 'legacy-bridge' : 'managed-refresh';
    } catch {
      block('upgrade-ownership-unverified', 'The previous package must match the project pin. Reconciliation requires verified managed content or an explicit resolution of the three known configured artifacts; resolve ownership, content or authority collisions before replanning.');
    }
  }
  plan.activation = compatible.plan.activation;
  plan.preconditions = compatible.plan.preconditions;
  plan.guaranteed_untouched = compatible.plan.guaranteed_untouched;
  plan.noop = compatible.plan.noop;
  plan.blockers.push(...compatible.plan.blockers);
  const head = git(root, ['rev-parse', 'HEAD']);
  const drift = git(root, ['diff', 'HEAD', '--binary']);
  const status = git(root, ['status', '--porcelain', '--untracked-files=all']);
  if (head.status !== 0 || drift.status !== 0 || status.status !== 0) {
    block('upgrade-repository-invalid', 'Repository state cannot be established.');
  }
  plan.repository = { root, head: head.stdout.trim(), diffSha256: sha256(drift.stdout), statusSha256: sha256(status.stdout) };
  if (compatible.plan.status !== 'noop' && !['managed-refresh', 'legacy-bridge'].includes(plan.upgradeKind)) {
    block('upgrade-migration-required', 'Some DEV FOUNDRY-managed files need to be refreshed. Supply the exact previous installed package with --from-package to verify ownership. Your application code will not be changed.');
  }
  if (plan.blockers.length) return finish();
  if (plan.current.expect === adapter.expect && !plan.upgradeKind) {
    plan.status = 'noop';
    plan.noop = [MCP_FILE];
    return finish();
  }
  if (await hasUnresolvedDirtyPaths(root, [MCP_FILE, ...compatible.ops.writes.map((item) => item.path),
    ...(plan.reconciliation ?? []).filter((item) => item.classification === 'operator-resolved' && Object.values(AGENT_PATHS).includes(item.path)).map((item) => item.path)], plan.reconciliation)) {
    block('dirty-working-tree', 'A touched path has uncommitted changes without an exact tracked managed-agent resolution.');
    return finish();
  }
  entry.args[2] = adapter.expect;
  let after = `${JSON.stringify(config, null, 2)}\n`;
  plan.noop = plan.noop.filter((file) => file !== MCP_FILE);
  plan.merge = [...compatible.plan.merge, { path: MCP_FILE, before_sha256: sha256(before), after_sha256: sha256(after), diff: makeUnifiedDiff(MCP_FILE, before.toString('utf8'), after) }].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  ops.writes.push(...compatible.ops.writes);
  ops.writes.push({ path: MCP_FILE, content: after });
  plan.status = 'ready';
  const inherited = compatible.plan.reconciliationEvidence
    ? JSON.parse((await readContained(root, RECONCILIATION_FILE)).toString('utf8')) : null;
  const differing = plan.reconciliation?.filter((record) => record.after_sha256 !== record.target_sha256) ?? inherited?.files ?? [];
  if (differing.length) {
    // No circular hashes: commit the complete deterministic migration candidate
    // before adding its receipt and the runtime commitment. The final reviewed
    // plan includes both writes, and apply regenerates that exact final plan.
    const previousPlanSha256 = sha256(canonicalJson(plan));
    plan.preconditions[RECONCILIATION_FILE] = sha256(await readContained(root, RECONCILIATION_FILE) ?? Buffer.alloc(0));
    if (!inherited) plan.preconditions[RECONCILIATION_FILE] = 'absent';
    try {
      if (await pathHasSymlink(root, RECONCILIATION_FILE) ||
          (!inherited && await readContained(root, RECONCILIATION_FILE) !== null) ||
          await hasUnresolvedDirtyPaths(root, [RECONCILIATION_FILE])) throw new Error();
      const receipt = {
        format: 'dev-foundry.upgrade-reconciliation.v1', repository: root,
        project: { name: compatible.plan.target.project, idPrefix: compatible.plan.target.idPrefix },
        source: plan.current.expect, target: adapter.expect, previousPlanSha256,
        resolutionSha256: plan.resolutionInput?.sha256 ?? inherited?.resolutionSha256 ?? null,
        files: differing.map((record) => Object.fromEntries(['path', 'scope', 'classification', 'before_sha256', 'base_sha256',
          'current_sha256', 'target_sha256', 'after_sha256'].map((key) => [key, record[key]]))),
        state: await reconciliationSurface(root, plan.preconditions, ops.writes),
      };
      const content = canonicalJson(receipt);
      entry.env = { ...entry.env, [RECONCILIATION_KEY]: sha256(content) };
      after = `${JSON.stringify(config, null, 2)}\n`;
      ops.writes.find((item) => item.path === MCP_FILE).content = after;
      const pinWrite = plan.merge.find((item) => item.path === MCP_FILE);
      pinWrite.after_sha256 = sha256(after);
      pinWrite.diff = makeUnifiedDiff(MCP_FILE, before.toString('utf8'), after);
      if (inherited) {
        const old = await readContained(root, RECONCILIATION_FILE);
        plan.merge.push({ path: RECONCILIATION_FILE, before_sha256: sha256(old), after_sha256: sha256(content), diff: makeUnifiedDiff(RECONCILIATION_FILE, old.toString('utf8'), content) });
      } else plan.create.push({ path: RECONCILIATION_FILE, sha256: sha256(content), content });
      ops.writes.push({ path: RECONCILIATION_FILE, content });
      plan.reconciliationEvidence = { path: RECONCILIATION_FILE, sha256: sha256(content), previousPlanSha256 };
      plan.merge.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    } catch {
      block('upgrade-reconciliation-unsafe', 'Upgrade evidence requires an unchanged safe local path and a complete contained authority surface.');
      plan.status = 'blocked';
      plan.create = []; plan.merge = [];
      ops.writes.length = 0;
    }
  }
  return finish();
}

export async function upgradeStatus(options) {
  const { plan } = await createUpgradePlan(options);
  return { status: plan.status === 'noop' ? 'current' : plan.status === 'ready' ? 'upgrade-needed' : 'blocked',
    current: plan.current, target: plan.target, blockers: plan.blockers };
}
