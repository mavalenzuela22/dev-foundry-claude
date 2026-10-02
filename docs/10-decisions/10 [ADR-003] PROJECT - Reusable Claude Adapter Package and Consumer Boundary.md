---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-003
  type: ADR
  title: Reusable Claude Adapter Package and Consumer Boundary
  status: ACCEPTED
artifactVersion: "1"
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
4. **Write boundary.** The adapter writes only adapter-owned, non-authority surface in a
   consumer: two subagent definitions, a marker-delimited `CLAUDE.md` block, the MCP entry,
   and, only when needed, one telemetry ignore line. It never writes or edits POP, Authority
   Index, Platform Bootstrap, Actor or Capability Profiles, or the selected framework release.
   Every configured-authority change is emitted as one reviewable cutover proposal for the
   consumer's own governed authoring and Operator authorization.
5. **Prepared versus active.** After adoption the adapter is prepared and not active.
   Consumer authority stays byte-identical until the consumer's own atomic cutover, which
   binds all five governed roles and activates the Claude Platform Bootstrap together. No
   dual binding or compatibility layer is introduced. Activation derives only from consumer
   authority (POP, Platform Bootstrap, Authority Index, referenced profiles); adapter-owned
   files and capability confer no authority.
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
- Preparing Claude bootstrap or profiles in consumer authority before cutover: no evidence
  that the mature runner tolerates additional configured entries; an unrouted active profile
  also violates the Authority Index rule.
- Dual binding or a bridge between runner and Claude: excluded; one role has one binding.

## 4. Consequences

- A consumer receives configuration, not code; the runtime is loaded from the installed
  package and is verifiable against the pin.
- Brownfield authority and the mature runner are untouched until the consumer chooses to cut
  over, and Claude role work fails closed meanwhile.
- A different adapter build on `PATH` fails closed rather than silently governing.
- The pin detects drift and differing builds. It does not defend against a hostile local
  actor who can alter both the install and its verifier, and it does not cover Node or the OS.
- Adapter upgrades are not automatic; a different build requires installing the pinned build
  or a future governed re-adoption.
- The self-hosted repository is unchanged apart from additive distribution files and the
  default-off guard.
