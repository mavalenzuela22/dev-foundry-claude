---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-007
  type: SPC
  title: Guided Consumer CLI and Help Contract
  status: ACTIVE
artifactVersion: "2"
authorityScope: guided-consumer-cli-and-help-contract
ownerRole: governance-author
canonical: true
scope:
  owns:
    - guided-consumer-cli
    - guided-setup-contract
    - guided-start-contract
    - guided-status-contract
    - guided-upgrade-contract
    - consumer-doctor-contract
    - canonical-help-resource-contract
  appliesTo:
    components:
      - claude-adapter-cli
      - claude-governance-mcp
      - telemetry-launcher
      - local-operations-dashboard
      - claude-adapter-package
  excludes:
    - reusable-dev-foundry-methodology
    - provider-authentication
    - consumer-product-code
    - silent-authority-mutation
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-006
    - SPC-005
    - SPC-006
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-007] PROJECT - Guided Consumer CLI and Help Contract

## 1. Consumer command surface

The adapter SHALL expose these primary commands:

`setup`, `start`, `status`, `upgrade`, `doctor`, and `help`.

Existing low-level commands MAY remain available for advanced, scripted and
governed workflows, but the README and normal user guidance SHALL lead with the
primary commands.

Every primary command SHALL support deterministic non-interactive behavior where
required for automation even when the default human UX is guided.

## 2. setup

`setup` is the first command recommended after installation.

It SHALL:

- inspect the current repository before mutation;
- classify enough state to tell the user whether the project is unconfigured,
  prepared, active, partially configured or already ready;
- explain the intended adapter-owned changes in human language;
- explicitly state whether application code is in scope;
- reuse existing adoption planning/apply mechanics rather than implementing a
  second configuration engine;
- never silently mutate consumer governance authority;
- surface a concrete next action until setup is complete.

For a repository with no valid DEV FOUNDRY project authority, `setup` SHALL
implement the SPC-008 initial-bootstrap UX: preview the minimum bootstrap,
identify/ask only the human choices that cannot be derived, state that application
code is unaffected, and require explicit Operator confirmation before
materialization. It SHALL not stop at an unexplained instruction to "adopt DEV
FOUNDRY first."

For an already governed project whose authority requires a separately governed
activation step, `setup` SHALL preserve existing authority, explain the
remaining step in user language and preserve the underlying proposal/evidence
for advanced workflows.

## 3. start

`start` is the recommended Claude launch command for a configured consumer.

It SHALL:

- verify the project is sufficiently configured before launch;
- delegate to the packaged canonical telemetry launcher rather than duplicate
  telemetry environment construction;
- support the existing launch modes where available;
- enable the normal local telemetry path;
- report telemetry readiness and the local dashboard URL when available;
- launch Claude in the current project;
- fail with a concrete recovery command such as `setup` or `doctor` when the
  project is not ready.

Verbose mode MAY expose collector port, OTEL endpoint, launch mode and other
advanced runtime facts.

## 4. status

`status` SHALL answer, in one compact human-readable view:

- detected project/repository;
- DEV FOUNDRY adoption state when observable;
- Claude integration state;
- installed/selected adapter release;
- telemetry readiness when observable;
- whether the user is ready to work;
- one recommended next action when attention is required.

Machine-readable JSON SHALL remain available for automation.

## 5. upgrade

`upgrade` SHALL provide one user-facing flow over SPC-005 mechanics.

It SHALL:

- identify current and target adapter releases;
- distinguish a pin-only compatible upgrade from a managed-surface migration;
- preserve exact target package integrity and plan-hash enforcement;
- show the user which DEV FOUNDRY-managed files will change;
- explicitly state the number of application/product files affected;
- never silently mutate consumer authority;
- handle known adapter-owned managed-surface migration as a first-class product
  flow instead of requiring the user to understand low-level blocker codes;
- retain fail-closed behavior when a migration exceeds the adapter-owned surface
  or current authority;
- expose technical blocker codes in verbose/advanced output.

A normal migration message SHOULD be equivalent to:
"Some DEV FOUNDRY-managed files need to be refreshed. Your application code will
not be changed."

Upgrade UX SHALL additionally classify SPC-008 lifecycle cases:

- a supported legacy consumer receives the one-time bridge to the 1.4.0
  self-update baseline;
- a self-update-capable consumer with only deterministic adapter-owned changes
  may continue through ordinary exact plan/apply mechanics;
- a self-update-capable consumer whose target requires semantic/configured
  authority migration is told to continue in the currently governed Claude
  session, which reviews the verified staged target under source authority;
- after governed cutover the old session reports completion only and directs the
  user to `dev-foundry-claude start`.

The CLI remains the safe front door and deterministic substrate; it SHALL NOT
pretend that a Node-only wizard can make project-specific semantic decisions on
the Operator's behalf.

## 6. doctor

`doctor` SHALL perform read-only diagnostics by default.

It SHALL check, as applicable:

- repository detection;
- DEV FOUNDRY configuration presence and consistency;
- adapter runtime availability and identity;
- MCP configuration/runtime pin;
- adapter-owned managed-file compatibility;
- telemetry-launch readiness;
- packaged-dashboard availability.

It SHALL summarize findings in human language and recommend one concrete next
command. Technical details SHALL be available without becoming the default UX.

Any repair mode, if later added, requires explicit user intent and SHALL reuse
governed write boundaries rather than performing broad hidden repair.

## 7. help and MCP resources

One versioned canonical help content source SHALL drive both CLI and MCP
presentation.

Minimum topics:

- getting-started;
- setup;
- start;
- status;
- upgrade;
- doctor;
- governance/concepts.

The CLI SHALL support at least:

- `dev-foundry-claude help`;
- `dev-foundry-claude help getting-started`;
- `dev-foundry-claude help <primary-command>`.

The governance MCP SHALL expose read-only resources using stable URIs equivalent
to:

- `dev-foundry://help/getting-started`;
- `dev-foundry://help/setup`;
- `dev-foundry://help/start`;
- `dev-foundry://help/status`;
- `dev-foundry://help/upgrade`;
- `dev-foundry://help/doctor`;
- `dev-foundry://help/concepts`.

The MCP resources are explanatory product content, not repository authority.

## 8. Output contract

Primary command output SHALL follow progressive disclosure:

1. outcome or current state;
2. user-impact explanation;
3. next action;
4. optional technical detail.

Raw governance vocabulary and internal error codes SHALL NOT be the sole
user-facing explanation.

JSON output MAY expose stable technical fields for automation and tests.

## 9. Acceptance UX

A developer unfamiliar with DEV FOUNDRY SHALL be able to:

1. install the public adapter;
2. run `dev-foundry-claude setup`;
3. understand whether application code is affected;
4. reach a state where `dev-foundry-claude start` launches Claude with telemetry;
5. discover `status`, `upgrade`, `doctor` and contextual help without reading
   the complete README or understanding governance artifact taxonomy;
6. bootstrap a normal Git repository with no DEV FOUNDRY configuration through
   explicit human confirmation rather than manual artifact construction;
7. understand when a legacy one-time bridge or a model-assisted upgrade/restart
   is required without learning internal migration artifact names.
