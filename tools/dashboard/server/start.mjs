import { launchDashboard } from './launch.mjs';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) {
  console.error('Usage: npm --prefix tools/dashboard run dashboard -- --port <1024–65535>');
  process.exit(1);
}
try {
  await launchDashboard({ port: Number(args[1]) });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
