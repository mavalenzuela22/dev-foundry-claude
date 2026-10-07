---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-021
  type: TSK
  title: Implement Self-Explaining Consumer UX and Guided Claude Start
  status: IN_PROGRESS
artifactVersion: "4"
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
    - initial-consumer-bootstrap-implementation
    - legacy-bridge-to-self-update-baseline
    - governed-self-update-foundation
    - stale-session-enforcement
    - candidate-branch-publication-for-pago-dogfood
    - adapter-minor-release-1.4.0
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-cli
      - claude-governance-mcp
      - telemetry-launcher
      - local-operations-dashboard
      - consumer-project-bootstrap
      - migration-runtime
      - README
  excludes:
    - reusable-dev-foundry-methodology-change
    - consumer-product-code
    - provider-authentication
    - silent-consumer-authority-mutation
    - PagoElectronico-real-repository-mutation-before-producer-candidate-validation
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-006
    - ADR-007
    - SPC-005
    - SPC-006
    - SPC-007
    - SPC-008
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
14. implement the SPC-008 initial bootstrap so an ordinary Git repository with
    no DEV FOUNDRY configuration can preview and explicitly establish the
    minimum 2.1.0 project authority/integration required for first governed
    Claude launch without manual POP/Authority Index/TSK authoring;
15. package the immutable DEV FOUNDRY 2.1.0 release bytes required by that
    bootstrap under the adapter payload integrity model;
16. make 1.4.0 the first self-update-capable baseline and implement the declared
    legacy bridge from supported exact pre-baseline consumer builds into that
    baseline;
17. preserve foreign active governance runtime bindings during legacy bridge
    planning/apply unless a separately authorized cutover explicitly replaces
    them;
18. package integrity-bound migration material needed by future source sessions
    to evaluate target releases without consulting producer main;
19. establish side-by-side target staging semantics so a future upgrade cannot
    replace the runtime serving its own source governance session before cutover;
20. establish a mechanically checkable source-session startup
    runtime/authority fingerprint and fail-closed stale-session behavior after
    a migration cutover;
21. update help/README/status/doctor/upgrade output for the three product paths:
    initial bootstrap, legacy bridge, and governed model-assisted self-update;
22. do not mutate the real PagoElectronico repository during producer
    implementation or isolated validation; after the producer candidate passes,
    perform the real legacy migration as a separate governed PagoElectronico
    dogfood operation before TSK-021 closure.

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

## 4. Bootstrap and migration boundary

TSK-020 deliberately shipped only a pin-compatible upgrade profile. Later
dogfooding proved that profile insufficient for the real PagoElectronico legacy
surface. TSK-021 therefore implements ADR-007/SPC-008 rather than treating the
failure as a fixture to erase.

### 4.1 Initial bootstrap

For an unconfigured Git repository, setup SHALL preview and, only after explicit
Operator confirmation, materialize the minimum DEV FOUNDRY 2.1.0 project
authority and Claude integration required for the first governed session.

Bootstrap output is deterministic from integrity-bound release bytes, repository
facts and explicit Operator choices. Application/product code remains outside
the write boundary. Brownfield bootstrap creates an initial baseline task whose
purpose is to verify the existing system before ordinary implementation.

### 4.2 Adapter-owned managed refresh

TSK-021 continues to support deterministic refresh of adapter-owned managed
surface when target templates differ, with exact current/target identities,
plan/precondition/hash enforcement, preserved outside-block content and
fail-closed ownership checks.

### 4.3 Legacy bridge

Supported exact pre-1.4.0 consumers SHALL have one bridge to the 1.4.0
self-update baseline. Unknown builds, ambiguous configured authority, modified
owned bytes whose provenance cannot be proved, unresolved Operator choices, or
unsafe paths stop the bridge.

The bridge preserves historical evidence, completed-work meaning and product
code. Reset/reinstall does not satisfy legacy acceptance.

A prepared consumer whose active governance runtime is not Claude SHALL keep
that active runtime until separately authorized cutover.

### 4.4 Governed self-update foundation

The 1.4.0 package SHALL establish the foundation required for future
model-assisted self-update:

- integrity-bound migration material in target releases;
- side-by-side target staging;
- source-session operation under source authority until cutover;
- deterministic tooling for exact transforms and proof;
- model-assisted semantic reconciliation for project-specific changes;
- reserved Operator decisions/authorization;
- atomic target cutover;
- stale-session fail-closed behavior;
- mandatory fresh dev-foundry-claude start after cutover.

Target release/framework bytes are migration input and do not become active
authority until the authorized cutover.

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
- unconfigured-repository bootstrap preview/apply/idempotence tests with zero
  application-file changes;
- packaged immutable 2.1.0 release integrity/bootstrap tests;
- start launcher delegation tests including telemetry/dashboard messaging;
- status human and JSON modes;
- doctor healthy and recoverable-problem diagnostics;
- compatible pin-only upgrade regression;
- managed adapter-surface migration plan/apply with exact SHA enforcement;
- migration refuses any undeclared product/application path;
- supported legacy exact-release bridge tests, including prepared and active
  states, authority/evidence preservation and unsupported-source refusal;
- side-by-side target staging tests proving source runtime/pin stays unchanged
  before cutover;
- source-session fingerprint/staleness tests proving governed work is rejected
  after cutover and a new session is required;
- help topic parity between CLI and MCP resources;
- package dry-run and isolated install;
- packaged launcher/start smoke without public/LAN exposure;
- README beginner path verified against packaged commands;
- Windows and macOS package/CLI smoke where available;
- full existing root regression suite;
- dashboard regression suite;
- `git diff --check`;
- exact release candidate remains consumer-independent;
- no real PagoElectronico mutation before producer candidate validation;
- after producer candidate validation, separate real PagoElectronico dogfood
  migration from its actual legacy state, preserving evidence/history/product
  code, is required before TSK-021 closure.

## 7. Product success criterion

A user with no prior DEV FOUNDRY vocabulary can move from a normal Git repository
to the first governed Claude launch entirely through the installed product, with
explicit human authorization but without manual construction of POP, Authority
Index, TSK or MTP artifacts.

A supported legacy consumer can reach the 1.4.0 self-update baseline without
reset/reinstall, product-code mutation, or loss/reinterpretation of historical
evidence.

A self-update-capable consumer can later migrate through its currently governed
Claude session, cross an authorized cutover, and be forced into a fresh session
before further governed work.

Time-to-first-governed-Claude-launch SHOULD be measured in minutes.

## 8. Hard constraints

Do not weaken existing runtime integrity, plan-hash enforcement, role separation,
consumer authority ownership or loopback-only telemetry/dashboard safety.

Do not expose internal governance vocabulary as the only explanation for a normal
consumer action.

Do not create a second telemetry launcher, second help source or second upgrade
integrity model when existing mechanisms can be reused.

Do not replace the runtime serving a governed source session before migration
cutover. Do not let target release/framework bytes govern their own adoption.
Do not let a post-cutover stale source session continue governed work.

Historical evidence and completed authority/work retain the semantics applicable
when they were produced.


## 9. Pago dogfood candidate publication boundary

The Operator explicitly authorizes one bounded remote-publication side effect
needed by the real PagoElectronico dogfood:

- publish the local `task/tsk-021-self-explaining-consumer-ux` branch to the
  same-named remote branch so the exact candidate commit
  `49b9269551aabcc7f0f39d88b253553ddab70208` becomes remotely reachable;
- the remote branch HEAD MAY include this later governance-only authorization
  checkpoint, but PagoElectronico MUST checkout and reconstruct the exact
  `49b9269551aabcc7f0f39d88b253553ddab70208` commit rather than treating the
  remote branch HEAD as the product candidate;
- the sole purpose is to let the Windows PagoElectronico environment independently
  clone, reconstruct and verify the exact 1.4.0 candidate used by the legacy bridge;
- no force push, PR, merge, tag, GitHub Release, package-registry publication or
  other branch mutation is authorized by this boundary;
- publication is not promotion to main and does not satisfy TSK-021 closure;
- the capability expires once the same-named remote branch is verified to make
  the exact candidate commit reachable, or if that candidate is no longer an
  ancestor of the local branch.

OPS-008 direct Operator authorization is the authorization source for this
remote-publication boundary. Capability only makes the bounded side effect
executable; it does not grant broader promotion authority.


## 10. Operator-authorized release lifecycle continuation (2026-10-07)

This section begins a **new bounded release-completion authorization** and does not
reinterpret the earlier branch-only permission in section 9. The earlier
candidate-branch-publication capability has expired on successful remote
publication and is retained as history. The currently selected Governance Author
Capability Profile for this continuation is
`.dev-foundry/profiles/capability-profiles/governance-author-tsk021-release-lifecycle-v1.yaml`.

The Operator explicitly authorizes five **separately gated** outcomes:
1. reconcile the separately governed real PagoElectronico legacy-bridge dogfood;
2. complete proportionate final self-assessment and validation/audit disposition;
3. promote this exact bounded 1.4.0 product candidate through review and
   integration into producer `main`;
4. publish GitHub Release `v1.4.0` using the existing main-only release workflow,
   then verify the immutable package identity;
5. formally reconcile, close and clean up TSK-021 only after all prior gates hold.

**Identity boundary.** The already validated candidate is commit
`49b9269551aabcc7f0f39d88b253553ddab70208`. The later governance-only
branch checkpoint `33b8d4acc9ffcd04d161160bbbb508d452b2c0ee` is
not a different product candidate. Release assets must have package self-pin
`1.4.0:sha256:da37df3d9a26328b6ad1de37f6100a8aae736d219e786e65fc63b6de79bdde98`.
A mismatch stops publication/reconciliation; no alternate build is silently
substituted.

**Consumer evidence boundary.** The separate consumer-governance operation
reported real PagoElectronico V055 legacy-bridge apply PASS
(request `valreq_ad4efad0af95e6c43987cbd1732671c8`) and V057 read-only
stable post-bridge PASS (request
`valreq_0dcd40c9b8c5ee8f6d4edd3dac5a6ad6`), with exact 1.4.0 self-pin,
`upgrade status = current`, fresh `upgrade plan = noop`, zero product-code
changes, and original ChatGPT/runner governance bindings preserved. These
identifiers are **consumer evidence references**, not producer authority, and
must not be substituted for PagoElectronico's own evidence custody or used to
mutate/inspect that repository from the producer. Any required external proof
not available through a valid custody route remains a known limit; do not
fabricate an independent producer observation.

**Release gates.** Reuse the independently completed producer candidate V008
PASS (root regression `npm test`, `npm pack --dry-run --json`, and
`git diff --check`), the successful Windows source-recipe and exact-candidate
proof reported by consumer governance, and validated current branch state.
Re-run only checks invalidated by a material delta. The active project POP
declares no automatic independent-audit trigger; re-evaluate actual triggers
before promotion and do not self-issue an independent-audit verdict.
Before each side effect verify OPS-008 state bindings, provider capability,
and any required transaction authorization package. No force push, unrelated
repository change, consumer mutation, methodology change, product extension,
public npm publication, or unpromoted release.

**Publication mechanics.** ADR-005 requires an integrated `main` release
commit. Existing `.github/workflows/release.yml` supports explicit
`workflow_dispatch` from `main`, builds both tarball names and SHA256SUMS,
then tags/releases that exact commit. Release is not proven merely because the
workflow was requested: observed tag, release assets, checksums and exact
self-pin are required.

**Closure** remains deferred until review/merge/integration, public asset
verification, producer reconciliation, cleanup and the required CLOSURE artifact
are demonstrably complete. Each phase remains distinct despite this standing
Operator authorization.
