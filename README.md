# dev-foundry-claude

Claude Code adapter for DEV FOUNDRY: a local governance MCP resolver, a minimal
project bootstrap, two governed subagents, and local operational telemetry.

This README is orientation only and is not authority.

- Authority routing: `.dev-foundry/authority-index.yaml`; project purpose and
  current state: `docs/00-overview/00 [OVR-001] PROJECT - System Overview.md`.
  `CLAUDE.md`, summaries, memory, and runtime records are not authority.
- Tests: `npm ci` then `npm test` (Node >= 20). The suite does not depend on
  whether it runs inside or outside the launcher.
- Start a session through the canonical launcher:
  `scripts/telemetry/run-claude.sh <direct|dial|codemie> -- <claude args>`.
