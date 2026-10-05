import { dashboardServer, listenLocal } from './http.mjs';

// Shared by the producer launcher and the installed CLI. No build tooling here.
export async function launchDashboard(options) {
  const server = dashboardServer(options);
  try {
    const address = await listenLocal(server, options.port);
    console.log(`dev-foundry-claude read-only dashboard: http://127.0.0.1:${address.port}`);
  } catch (error) {
    throw new Error(error.code === 'EADDRINUSE' ? 'Requested port is occupied; select another explicit local port.' : error.message);
  }
  const close = () => server.close(() => process.exit(0));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, close);
  return server;
}
