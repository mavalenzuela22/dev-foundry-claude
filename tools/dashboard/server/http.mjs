import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readClaudeOtel } from './claude-otel.mjs';
import { readRecords, safeFile, summary } from './evidence.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const defaultUiRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const prefix = '/api/dashboard/v1/';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const route = /^\/(?:calls(?:\/[^/]+)?|executions(?:\/[^/]+\/[^/]+)?|validations(?:\/[^/]+)?|telemetry|transactions(?:\/[^/]+)?)?$/;

export function dashboardHandler({ root = repositoryRoot, uiRoot = defaultUiRoot } = {}) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    // UUI 6.5.1 publishes its font faces at this fixed origin. Permit font
    // assets only; scripts, connections and the listener remain local.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data: https://static.cdn.epam.com; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(req.method === 'HEAD' ? undefined : type.startsWith('application/json') ? JSON.stringify(body) : body);
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, { error: 'Read-only dashboard: GET/HEAD only' });
    }
    // Host validation prevents DNS rebinding. No cross-origin data API is exposed.
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) return send(403, { error: 'Loopback host required' });
    let pathname;
    try {
      pathname = decodeURIComponent((req.url || '').split('?')[0]);
      if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some((p) => p === '..' || p === '.')) throw new Error();
    } catch { return send(400, { error: 'Unsafe path' }); }
    try {
      if (pathname.startsWith(prefix)) {
        const [kind, ...ids] = pathname.slice(prefix.length).split('/');
        if (kind === 'health' && !ids.length) {
          let uiAvailability = 'available';
          try { await safeFile(uiRoot, 'index.html', { maxBytes: 8 * 1024 * 1024 }); }
          catch { uiAvailability = 'unavailable'; }
          const data = {};
          for (const name of ['executions', 'validations', 'transactions']) {
            const model = await readRecords(root, name);
            data[name] = { availability: model.availability, records: model.records.length, issues: model.issues, recordIssues: model.records.filter((r) => r.issue).length, truncated: model.truncated };
          }
          return send(200, { product: 'dev-foundry-claude', dashboard: { api: 'available', ui: uiAvailability }, mode: 'read-only durable evidence', liveActivity: 'unavailable', throughput: 'unavailable', data });
        }
        if (kind === 'claude-otel' && !ids.length) return send(200, await readClaudeOtel(root));
        if (!['executions', 'validations', 'transactions'].includes(kind)) return send(404, { error: 'Unknown endpoint' });
        if (ids.length !== 0 && ids.length !== (kind === 'executions' ? 2 : 1)) return send(404, { error: 'Unknown detail route' });
        if (ids.some((id) => !/^[A-Za-z0-9_-]{1,400}$/.test(id))) return send(400, { error: 'Invalid record identifier' });
        const model = await readRecords(root, kind);
        if (!ids.length) return send(200, summary(model));
        const record = model.records.find((r) => r.id === ids.at(-1) && (kind !== 'executions' || r.taskId === ids[0] || (!r.taskId && ids[0] === 'unavailable')));
        return record ? send(200, record) : send(404, { error: 'Evidence record unavailable in bounded scan' });
      }
      if (pathname.startsWith('/api/')) return send(404, { error: 'Unknown endpoint' });
      const asset = pathname.startsWith('/assets/') || pathname === '/logo.svg';
      if (!asset && !route.test(pathname)) return send(404, { error: 'Unknown route' });
      const file = asset ? pathname.slice(1) : 'index.html';
      const body = await safeFile(uiRoot, file, { maxBytes: 8 * 1024 * 1024, binary: true });
      return send(200, body, mime[path.extname(file)] || 'application/octet-stream');
    } catch {
      return send(503, { error: 'Dashboard UI or evidence unavailable; build the local workspace and retry' });
    }
  };
}

export function dashboardServer(options) { return createServer(dashboardHandler(options)); }

export function listenLocal(server, port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Provide an explicit --port between 1024 and 65535');
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => { server.removeListener('error', reject); resolve(server.address()); });
  });
}
