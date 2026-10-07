import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selfPin, sha256 } from './pin.js';

const installedRoot = fileURLToPath(new URL('../../', import.meta.url));
export const MIGRATION_MATERIAL = 'migrations/release.json';
export const legacyVersion = (version) => /^(?:(?:0\.\d+\.\d+|1\.[0-3]\.\d+)(?:[-+].*)?|1\.4\.0-.+)$/.test(version);

// Inspection of a staged target verifies its entire installed payload. No writes/network.
export async function inspectMigrationRelease(packageRoot) {
  const pin = selfPin(packageRoot);
  const bytes = await readFile(path.join(packageRoot, MIGRATION_MATERIAL));
  const material = JSON.parse(bytes.toString('utf8'));
  if (material.format !== 'dev-foundry.migration-release.v1' || material.targetVersion !== pin.version || material.selfUpdateBaseline !== '1.4.0' || !Array.isArray(material.legacy) ||
      !material.selfUpdate || typeof material.selfUpdate.requiresGovernedReconciliation !== 'boolean' || material.selfUpdate.mandatoryRestart !== true || !Array.isArray(material.selfUpdate.configuredAuthorityTransforms)) throw new Error('Invalid migration release material');
  return { identity: { version: pin.version, payloadRoot: pin.root, expect: pin.expect }, materialSha256: sha256(bytes), material };
}

// The running target has already been verified by the CLI. Its material hash is
// included in each plan, so apply also refuses material/package replacement.
export async function currentMigrationMaterial() {
  const bytes = await readFile(path.join(installedRoot, MIGRATION_MATERIAL));
  const material = JSON.parse(bytes.toString('utf8'));
  const pkg = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'));
  if (material.format !== 'dev-foundry.migration-release.v1' || material.targetVersion !== pkg.version || material.selfUpdateBaseline !== '1.4.0' || !Array.isArray(material.legacy) || !material.selfUpdate || material.selfUpdate.mandatoryRestart !== true) throw new Error('Invalid migration release material');
  return { material, materialSha256: sha256(bytes) };
}

export function migrationRequiresGovernedSession(material, currentFrameworkVersion) {
  // Unknown future deterministic modes cannot fall through to an ordinary writer.
  return (currentFrameworkVersion !== undefined && material.frameworkVersion !== currentFrameworkVersion) || material.selfUpdate.requiresGovernedReconciliation !== false || material.selfUpdate.mode !== 'deterministic-managed-surface' ||
    !Array.isArray(material.selfUpdate.configuredAuthorityTransforms) || material.selfUpdate.configuredAuthorityTransforms.length !== 0;
}
