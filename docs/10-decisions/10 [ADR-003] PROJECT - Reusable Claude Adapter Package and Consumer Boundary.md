---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-003
  type: ADR
  title: Reusable Claude Adapter Package and Consumer Boundary
  status: ACCEPTED
artifactVersion: "2"
authorityScope: dev-foundry-claude-adapter-package-and-consumer-boundary
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-adapter-package-form
    - claude-consumer-mcp-launch-and-runtime-pin
    - claude-adapter-write-boundary
    - claude-prepared-versus-active-model
  appliesTo:
    components:
      - claude-adapter-package
      - claude-governance-mcp
    tasks:
      - TSK-012
  excludes:
    - package-registry-selection-or-publication
    - consumer-repository-modification
    - mature-runner-modification
    - compatibility-layer
    - cross-surface-protocol
    - methodology-change
    - hooks
    - skills
    - agent-teams
    - additional-subagents
    - remote-telemetry
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ARC-001
    - OVR-001
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-003] dev-foundry-claude - Reusable Claude Adapter Package and Consumer Boundary

## 1. Context

`dev-foundry-claude` is a self-hosted reference implementation of the Claude-native
adapter (ADR-001, ADR-002). An existing governed brownfield repository must be able to
adopt the adapter without becoming a clone of this repository, without copying this
repository's authority or history, and without disturbing its own product authority or
the mature runner that currently governs it.

ADR-002 fixes the self-hosted launch as `${CLAUDE_PROJECT_DIR:-.}/src/governance-mcp/server.js`.
That path is valid only where the source tree is present. It cannot be the consumer form.
The POP holds one binding per role, so Claude bindings can only replace, never join, a
runner binding.

## 2. Decision

1. **Package.** The reusable runtime is distributed as one versioned npm package,
   provisionally `@dev-foundry/claude-adapter` (bin `dev-foundry-claude`), built from this
   repository as a reproducible `npm pack` tarball with bundled runtime dependencies and
   `private: true`. Registry choice, scope ownership, and publication are not decided here.
2. **Consumer launch.** A consumer `.mcp.json` entry invokes the installed runtime:
   `command: dev-foundry-claude`, `args: ["mcp", "--expect", "<version>:sha256:<root>"]`. The
   server still takes its project root only from `CLAUDE_PROJECT_DIR`. ADR-002 remains
   binding for self-hosted launch; this ADR does not supersede it.
3. **Runtime pin.** The expected value covers every regular file the package actually ships,
   including bundled dependencies, through a manifest produced at pack time from npm's own
   file list. The manifest is the only unlisted file, and its bytes are bound by the expected
   root. `package-lock.json` is not shipped by npm; it remains a repository build input, and
   the build checks that bundled dependencies match it. A mismatch, an absent or
   malformed expectation, or a missing manifest stops the process before serving or launching.
   The pin is adapter-owned configuration, is not product or methodology authority, and
   involves no network lookup.
4. **Ordinary write boundary.** For an already governed consumer, ordinary adapter
   installation, setup, managed refresh, and package replacement directly write only
   adapter-owned non-authority surface: the subagent definitions, marker-delimited
   `CLAUDE.md` block, MCP entry, and required telemetry ignore rule. They do not
   arbitrarily rewrite established POP, Authority Index, Platform Bootstrap, Actor or
   Capability Profiles, project decisions, or the selected framework release.
   ADR-007 and SPC-008 define two explicit lifecycle exceptions to that ordinary
   direct-write boundary: (a) Operator-confirmed initial authority bootstrap when no
   valid project authority exists, and (b) a bounded legacy/governed migration whose
   exact source/target identities, migration boundary and authorization are independently
   established. Those paths are not permission for generic adapter code to edit authority.
5. **Prepared versus active.** For an already governed brownfield consumer, ordinary
   adapter preparation remains non-active until the consumer's own atomic cutover binds
   the governed roles and activates the Claude Platform Bootstrap. No dual binding or
   compatibility layer is introduced. Activation derives only from consumer authority
   (POP, Platform Bootstrap, Authority Index, referenced profiles); adapter-owned files
   and capability confer no authority. An ungoverned repository has no prior runtime
   binding to preserve: its explicit initial bootstrap may establish the first active
   Claude bindings as part of the Operator-confirmed DEV FOUNDRY adoption defined by
   ADR-007/SPC-008.
6. **Consumer-mode guard.** When launched through the packaged `mcp` entry, the MCP returns
   `BINDING_INACTIVE` for governed resolution unless activation is complete. The guard sits at
   the MCP boundary; `resolver.js` and authority-resolution semantics are unchanged. Source-run
   self-hosted behavior is unchanged because the guard is off by default.

## 3. Alternatives not chosen

- Copying runtime code into each consumer: forks the runtime and breaks the one-source rule.
- A project-local or absolute-path launch form: needs Node tooling in every consumer or
  embeds a machine-specific path.
- A separate adapter lock artifact: adds a configured artifact needing routing and a second
  read path where one argument suffices.
- Version-only or source-only pins: two materially different builds could share a pin.
- Preparing Claude bootstrap or profiles inside an already governed consumer before its
  authorized cutover: no evidence that a foreign active runtime tolerates those configured
  entries, and an unrouted active profile violates the Authority Index rule. This does not
  prohibit ADR-007 initial bootstrap in a repository that has no prior project authority.
- Dual binding or a bridge between runner and Claude: excluded; one role has one binding.

## 4. Consequences

- A consumer receives configuration, not code; the runtime is loaded from the installed
  package and is verifiable against the pin.
- Existing governed brownfield authority and any active mature runner remain untouched by
  ordinary adapter preparation until the consumer chooses to cut over. Explicit legacy or
  governed migration is a separate ADR-007/SPC-008 lifecycle, not an implicit package side effect.
- A different adapter build on `PATH` fails closed rather than silently governing.
- The pin detects drift and differing builds. It does not defend against a hostile local
  actor who can alter both the install and its verifier, and it does not cover Node or the OS.
- Adapter upgrades are not automatic. The project remains pinned until an explicit upgrade
  or migration is authorized. Releases from the 1.4.0 self-update baseline forward use the
  governed migration/restart lifecycle in ADR-007/SPC-008 when authority changes are required.
- The self-hosted repository is unchanged apart from additive distribution files and the
  default-off guard.
