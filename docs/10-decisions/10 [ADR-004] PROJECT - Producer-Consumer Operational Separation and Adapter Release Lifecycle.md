---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-004
  type: ADR
  title: Producer/Consumer Operational Separation and Adapter Release Lifecycle
  status: ACCEPTED
artifactVersion: "2"
authorityScope: dev-foundry-claude-producer-consumer-separation
ownerRole: governance-author
canonical: true
scope:
  owns:
    - producer-consumer-operational-separation
    - producer-maintenance-runtime-independence
    - adapter-release-and-consumer-pin-lifecycle
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
    tasks:
      - TSK-013
  excludes:
    - package-registry-selection-or-publication
    - consumer-repository-modification
    - mature-runner-modification
    - compatibility-layer
    - cross-surface-protocol
    - methodology-change
    - upgrade-command-implementation
    - hooks
    - skills
    - agent-teams
    - additional-subagents
authority:
  governedBy:
    - ADR-001
    - ADR-003
    - ARC-001
    - OVR-001
    - OPS-003
    - OPS-005
    - OPS-009
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-004] dev-foundry-claude - Producer/Consumer Operational Separation and Adapter Release Lifecycle

## 1. Context

`dev-foundry-claude` has two distinct relationships to Claude Code that the
TSK-009 cutover conflated:

- as a **product**, it produces the reusable Claude adapter that a consumer
  repository runs under Claude Code (ADR-003, TSK-012);
- as a **repository**, it is itself governed and developed by some runtime.

TSK-009 bound the repository's own development to Claude Code because the
product targets Claude Code. Those are independent facts. The adapter's target
runtime does not dictate the runtime used to develop it, and a consumer such as
PagoElectronico must not observe or depend on the producer's development
runtime. Adapter 1.1.0 (TSK-012) now exists as a private, tarball-distributed,
integrity-pinned build, so the producer must be able to evolve while consumers
stay fixed.

## 2. Decision

1. **Producer.** `dev-foundry-claude` is the producer of the Claude adapter. It
   is not a consumer of its own release lifecycle.
2. **Independent bindings.** Producer governance and runtime bindings (its POP,
   Platform Bootstrap, Actor and Capability Profiles) are independent of any
   consumer's bindings. Neither side's configured authority is derived from,
   copied to, or altered by the other.
3. **Producer runtime.** The producer MAY be developed by a ChatGPT project
   governance implementation with the process-bound runner and Codex executor
   while the product it produces targets Claude Code. The runtime that develops
   the adapter is independent of the runtime the adapter targets.
4. **Explicit releases.** A consumer adopts an explicit, immutable adapter
   release. It never follows producer `main`, a branch, or a working tree.
5. **Release identity.** A release is identified by the package version and the
   payload integrity root defined by ADR-003 and TSK-012
   (`<version>:sha256:<root>`). Version alone is not an identity.
6. **No implicit upgrade.** A change to producer `main` upgrades no consumer.
   A consumer stays on its pinned release until it explicitly adopts another.
7. **No implicit authority change.** Installing or replacing an adapter package
   changes no consumer authority (POP, Platform Bootstrap, Authority Index,
   Actor or Capability Profiles, selected framework release).
8. **Authority migration.** Installing or replacing package bytes is never authority
   migration. If a release requires configured-authority change, the project uses the
   explicit ADR-007/SPC-008 lifecycle: legacy consumers cross the bounded legacy bridge;
   self-update-capable consumers migrate from the currently active governed Claude
   session under source authority, with Operator authorization and applicable
   validation/audit before cutover.
9. **Upgrade properties.** An adapter upgrade is explicit (named current and target
   release), deterministic where mechanics are machine-provable, and fail-closed on
   stale pin, package mismatch, failed self-verification, unresolved project decisions
   or stale migration state. SPC-005 and SPC-008 own the normative upgrade/migration
   contracts.
10. **Source-session continuity.** A target release is staged and verified side-by-side.
    It does not replace the runtime serving the source session before cutover. After a
    governed cutover changes the active runtime/authority identity, that source session
    is stale and must stop governed work; a new `dev-foundry-claude start` session
    reobserves the target state.
11. **Legacy compatibility seam.** Adapter 1.4.0 is the first self-update-capable
    baseline. Supported pre-baseline consumers use one declared bridge to reach it;
    future releases are not required to retain direct migration from every legacy build.
10. **Registry.** Package-registry choice and publication remain out of scope
    unless separately governed.

## 3. Producer-maintenance cutover

TSK-013 applies this decision to `dev-foundry-claude` itself by reconfiguring
its own active bindings from Claude-native producer operation to ChatGPT-project
producer maintenance. This is a new forward transition, not a rollback of TSK-009
and not a rollback of the Claude adapter product.

After promotion of that cutover:

- governed development of this repository resolves against ChatGPT-project
  producer bindings;
- the root `CLAUDE.md`, `.mcp.json`, `.claude/**`, Claude Capability Profiles and
  package templates remain in the repository as product, distribution and test
  surface; their presence does not make Claude Code the active producer platform;
- Claude Code remains the target runtime of the adapter and of every consumer
  that explicitly adopts a release;
- historical Claude-native producer bindings are history, not active authority.

Capability does not grant authority. The existence of a Claude subagent
definition or a runner capability does not bind a role.

## 4. Lifecycle model

```text
producer main
      | explicit release
      v
adapter release N
      | explicit consumer adoption
      v
consumer pinned to N          producer evolves independently

adapter release N+1
      | target staged side-by-side
      v
current governed consumer session
      | reviewed/authorized migration + cutover
      v
consumer N -> N+1
      | mandatory restart
      v
new governed session on N+1
```

Adapter version 1.1.0, produced by TSK-012, is the initial consumer baseline.
A consumer MAY adopt it while producer work continues.

## 5. Alternatives not chosen

- Keep Claude Code as the producer runtime because the product targets it:
  couples development tooling to the product target and offers no way to evolve
  the producer without moving every consumer.
- Consumers track producer `main` or a git ref: no immutable identity, silent
  behavior change, and a violation of the ADR-003 runtime pin.
- Package installation that silently migrates consumer authority: violates consumer
  authority ownership. This is distinct from the explicit governed migration lifecycle
  in ADR-007/SPC-008, where source authority remains active through review and the
  Operator authorizes the bounded cutover.
- Dual producer binding (Claude and ChatGPT for one role) or a synchronization
  layer: excluded; one role has one binding.
- Reactivating historical runner profile V2: its constraints describe a
  pre-cutover hosting phase and are no longer truthful.

## 6. Consequences

- Producer and consumer evolve on separate cadences with an explicit seam.
- A consumer's authority never changes merely as a side effect of producer work or
  package acquisition; any authority migration is an explicit consumer operation.
- The producer needs its own truthful runner Capability Profile for
  maintenance; capability profile V3 provides it under TSK-013.
- Registry publication, signing and a release tag or record remain undecided and
  require separate governance.
- The runtime pin detects drift and differing builds; it does not defend against
  a hostile local actor who can alter both install and verifier (as in ADR-003).
