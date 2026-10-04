export const menu = Object.freeze([
  { caption: 'Overview', path: '/' },
  { caption: 'Live Activity', path: '/calls' },
  { caption: 'Executions', path: '/executions' },
  { caption: 'Validations', path: '/validations' },
  { caption: 'Telemetry', path: '/telemetry' },
]);
export const telemetryTabs = Object.freeze([
  { caption: 'Throughput', path: '/telemetry' },
  { caption: 'Transactions', path: '/transactions' },
]);
export function parseRoute(path) {
  try { path = decodeURIComponent(path); } catch { return { section: 'unknown', ids: [] }; }
  if (path.includes('\\') || path.includes('\0') || path.split('/').some((s) => s === '.' || s === '..')) return { section: 'unknown', ids: [] };
  if (path === '/') return { section: 'overview', ids: [] };
  if (path === '/telemetry') return { section: 'telemetry', ids: [] };
  const match = /^\/(calls|executions|validations|transactions)(?:\/([A-Za-z0-9_-]{1,400}))?(?:\/([A-Za-z0-9_-]{1,400}))?$/.exec(path);
  if (!match) return { section: 'unknown', ids: [] };
  const ids = match.slice(2).filter(Boolean);
  if (ids.length && ids.length !== (match[1] === 'executions' ? 2 : 1)) return { section: 'unknown', ids: [] };
  return { section: match[1], ids };
}
export function recordPath(record) {
  return `/${record.kind}/${record.kind === 'executions' ? `${record.taskId || 'unavailable'}/` : ''}${record.id}`;
}
