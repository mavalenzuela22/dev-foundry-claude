import { dashboardServer, listenLocal } from './http.mjs';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) {
  console.error('Usage: npm --prefix tools/dashboard run dashboard -- --port <1024–65535>');
  process.exit(1);
}
const server = dashboardServer();
try {
  const address = await listenLocal(server, Number(args[1]));
  console.log(`dev-foundry-claude read-only dashboard: http://127.0.0.1:${address.port}`);
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? 'Requested port is occupied; select another explicit local port.' : error.message);
  process.exit(1);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
