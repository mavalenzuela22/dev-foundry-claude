import { runLauncher } from '../../src/telemetry/launch.js';

process.exitCode = await runLauncher({ argv: process.argv.slice(2) });
