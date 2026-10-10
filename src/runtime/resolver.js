import { resolveConsumer, refuse } from './identity.js';
import { defaultStoreRoot, installedRuntime } from './store.js';
import { runtimeUpgradeStatus } from './journal.js';
import { verifyRuntime } from './identity.js';

// Exact read-only lookup; no bare-version fallback or implicit installation.
export function resolveRuntime({ cwd, storeRoot = defaultStoreRoot(), pendingMcp = false } = {}) {
  const consumer = resolveConsumer(cwd);
  const journal = runtimeUpgradeStatus(consumer.repositoryRoot);
  const pending = pendingMcp && ['await-new-session', 'verifying'].includes(journal.state) && journal.plan.targetPin === consumer.expect;
  if (journal.blocked && !pending) refuse(`runtime-journal-${journal.state}`);
  if (journal.plan && ['authorized', 'prepared'].includes(journal.state) && journal.plan.sourcePin !== consumer.expect) refuse('mixed-runtime-cutover');
  return { ...consumer, journal, runtime: installedRuntime(storeRoot, consumer.expect) };
}

// Used by direct installed commands too: verification is never conferred by an
// environment marker. Legacy 1.4.2 can still run without a managed store.
export function assertPackageSelected({ cwd, packageRoot, expect, pendingMcp = false }) {
  const consumer = resolveConsumer(cwd);
  if (expect && expect !== consumer.expect) refuse('selected-pin-mismatch');
  const journal = runtimeUpgradeStatus(consumer.repositoryRoot);
  if (journal.blocked && !(pendingMcp && ['await-new-session', 'verifying'].includes(journal.state) && journal.plan.targetPin === consumer.expect)) refuse(`runtime-journal-${journal.state}`);
  if (journal.plan && ['authorized', 'prepared'].includes(journal.state) && journal.plan.sourcePin !== consumer.expect) refuse('mixed-runtime-cutover');
  const runtime = verifyRuntime(packageRoot, consumer.expect);
  return { ...consumer, runtime, journal };
}
