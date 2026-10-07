---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-021
  type: TSK
  title: Implement Self-Explaining Consumer UX and Guided Claude Start
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-021-self-explaining-consumer-ux
ownerRole: governance-author
canonical: true
scope:
  owns:
    - guided-consumer-cli-implementation
    - canonical-consumer-help-content
    - mcp-help-resources
    - guided-telemetry-start
    - managed-surface-upgrade-ux
    - adapter-minor-release-1.4.0
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-cli
      - claude-governance-mcp
      - telemetry-launcher
      - local-operations-dashboard
      - README
  excludes:
    - reusable-dev-foundry-methodology-change
    - consumer-product-code
    - provider-authentication
    - silent-consumer-authority-mutation
    - PagoElectronico-real-repository-mutation
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-006
    - SPC-005
    - SPC-006
    - SPC-007
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-020
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-021] PROJECT - Implement Self-Explaining Consumer UX and Guided Claude Start

## 1. Purpose

Turn `dev-foundry-claude` from a mechanically correct adapter into a product a
developer new to AI-assisted governance can install and use without first
learning DEV FOUNDRY internals.

The target first-time question is:

"I installed this. What do I do now?"

The product SHALL answer that question itself.

## 2. Required outcome

Release adapter 1.4.0 with the smallest complete implementation of SPC-007:

1. add primary CLI commands:
   `setup`, `start`, `status`, `upgrade`, `doctor`, `help`;
2. preserve existing low-level commands for advanced/backward-compatible use;
3. implement human-first output with JSON/verbose technical detail where useful;
4. make `start` delegate to the canonical packaged telemetry launcher and make
   the local dashboard discoverable;
5. establish one canonical help-content source consumed by CLI and MCP resources;
6. expose the required read-only MCP help resources;
7. make `upgrade` treat adapter-owned managed-surface refresh as a supported
   user flow while retaining SPC-005 integrity, exact planning and fail-closed
   boundaries;
8. ensure normal upgrade output says what managed files change and whether
   application code changes;
9. make `doctor` read-only by default and able to diagnose setup, runtime pin,
   managed-surface and telemetry readiness;
10. rewrite the README entry path around install -> setup -> start, moving deep
    governance mechanics behind progressive disclosure;
11. package all required runtime/help/launcher assets in the release;
12. prove the packaged experience in isolated fresh and brownfield fixtures;
13. prove the known Pago 1.2.2-shaped fixture can be guided through the managed
    adapter-surface migration without touching application code;
14. do not mutate the real Pago Electronico repository during producer work.

## 3. User-facing baseline

The README above-the-fold path SHALL reduce to the equivalent of:

```text
Install dev-foundry-claude
cd <project>
dev-foundry-claude setup
dev-foundry-claude start
```

After setup, the product SHALL explicitly tell the user what to do next.

A healthy status SHALL answer that the user is ready to work.

A recoverable problem SHALL recommend one concrete command such as `doctor`,
`setup` or `upgrade`.

## 4. Upgrade migration boundary

TSK-020 deliberately shipped only a pin-compatible upgrade profile.

TSK-021 MAY extend product behavior to refresh adapter-owned managed surface when
the target release renders different adapter-owned bytes, provided that:

- current and target adapter identities are verified;
- a deterministic migration plan exists before mutation;
- exact plan bytes/hash are enforced at apply time;
- every changed repository path is adapter-owned;
- consumer application/product code is excluded;
- consumer authority is not silently mutated;
- non-adapter collisions or ambiguous ownership fail closed;
- user-facing output explains the refresh without requiring governance jargon.

The real Pago Electronico blocker observed during dogfooding is product input,
not producer implementation authority. Producer proof SHALL use fixtures or
temporary clones only.

## 5. Help architecture

Help text SHALL have a single canonical source inside the package.

CLI and MCP SHALL render from that source so installed-version help cannot drift
from the runtime.

MCP help resources are explanatory and SHALL NOT be treated as methodology or
repository authority.

## 6. Acceptance

At minimum PASS:

- focused unit tests for all six primary commands;
- setup state classification and next-action tests;
- start launcher delegation tests including telemetry/dashboard messaging;
- status human and JSON modes;
- doctor healthy and recoverable-problem diagnostics;
- compatible pin-only upgrade regression;
- managed adapter-surface migration plan/apply with exact SHA enforcement;
- migration refuses any non-adapter/product path;
- help topic parity between CLI and MCP resources;
- package dry-run and isolated install;
- packaged launcher/start smoke without public/LAN exposure;
- README beginner path verified against packaged commands;
- Windows and macOS package/CLI smoke where available;
- full existing root regression suite;
- dashboard regression suite;
- `git diff --check`;
- exact release candidate remains consumer-independent;
- no real Pago Electronico mutation.

## 7. Product success criterion

A user with no prior DEV FOUNDRY vocabulary can install the adapter and determine
the next action entirely from the installed product.

Time-to-first-governed-Claude-launch SHOULD be measured in minutes and require no
manual creation of TSK/MTP artifacts for installation or normal adapter use.

## 8. Hard constraints

Do not weaken existing runtime integrity, plan-hash enforcement, role separation,
consumer authority ownership or loopback-only telemetry/dashboard safety.

Do not expose internal governance vocabulary as the only explanation for a normal
consumer action.

Do not create a second telemetry launcher, second help source or second upgrade
integrity model when existing mechanisms can be reused.
