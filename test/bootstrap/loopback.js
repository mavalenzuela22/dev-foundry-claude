import { createServer } from 'node:net';

// Observe socket availability independently of product startup. Only a host
// permission denial may skip live transport checks; other failures still fail.
export async function requireLoopback(t) {
  const socket = createServer();
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
    t.skip(`Host prohibits loopback sockets (${error.code}); live transport remains unverified`);
    return false;
  }
  await new Promise((resolve) => socket.close(resolve));
  return true;
}
