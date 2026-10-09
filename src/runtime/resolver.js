import { resolveConsumer } from './identity.js';
import { defaultStoreRoot, installedRuntime } from './store.js';

// Read-only, exact lookup. No bare-version fallback, install or project discovery
// beyond the explicitly selected directory's repository ancestors.
export function resolveRuntime({ cwd, storeRoot = defaultStoreRoot() } = {}) {
  const consumer = resolveConsumer(cwd);
  return { ...consumer, runtime: installedRuntime(storeRoot, consumer.expect) };
}
