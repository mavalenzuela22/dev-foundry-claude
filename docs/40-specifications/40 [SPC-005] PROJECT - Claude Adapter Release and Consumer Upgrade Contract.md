---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-005
  type: SPC
  title: Claude Adapter Release and Consumer Upgrade Contract
  status: ACTIVE
artifactVersion: "3"
authorityScope: claude-adapter-release-and-consumer-upgrade-contract
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-adapter-release-identity
    - claude-consumer-release-pin-lifecycle
    - claude-consumer-upgrade-contract
  appliesTo:
    components:
      - claude-adapter-package
    operations:
      - adapter-release
      - consumer-adoption
      - consumer-upgrade
  excludes:
    - package-registry-selection-or-publication
    - consumer-authority-mutation
    - mature-runner-modification
    - compatibility-layer
    - methodology-change
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - OPS-005
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-005] dev-foundry-claude - Claude Adapter Release and Consumer Upgrade Contract

## 1. Status and necessity

This contract is ACTIVE as normative authority for the release and upgrade work
performed by TSK-020. Implementation remains task-governed until that task is
validated, promoted and closed.

ADR-004 fixes producer/consumer separation. ADR-005 selects the distribution
channel. This specification owns the invariants that keep release acquisition
and consumer upgrade explicit, immutable and fail-closed.

## 2. Release model

- A release is an immutable adapter build identified by
  `<version>:sha256:<payload-root>` as defined by ADR-003 and TSK-012.
- Producer `main`, a branch, or a working tree is not a release.
- A GitHub Release asset is a transport for an immutable release, not the release
  identity itself.
- A convenience `latest` download URL may select an acquisition target, but the
  installed package self-pin and the consumer runtime pin SHALL bind the exact
  version and payload root.
- The 1.3.0 baseline GitHub Release acquisition flow is anonymous and therefore
  requires the producer repository/release assets to be publicly readable.
- Authenticated acquisition from a private producer repository is a different
  transport profile and is outside the 1.3.0 baseline; it does not alter release
  identity or consumer pin semantics.
- Adapter 1.2.3 is the pre-TSK-020 producer baseline. TSK-020 targets 1.3.0 as
  the first release with governed compatible-upgrade support.

## 3. Consumer states

- **Pinned:** the consumer `.mcp.json` carries `--expect <version>:sha256:<root>`
  for exactly one release N. It remains pinned while the producer evolves.
- **Adopting:** a consumer with no adapter pin is explicitly prepared from a
  selected target release.
- **Upgrading:** an already pinned consumer is explicitly moved from release N
  to release N+1 by a reviewed upgrade plan.
- Merely installing a newer package changes no repository state and upgrades no
  consumer.

## 4. Upgrade invariants

An upgrade capability SHALL:

1. produce a read-only deterministic plan before any mutation;
2. bind an explicit expected current release and explicit target release in that
   plan;
3. verify the consumer's current pin matches the expected current release and
   fail closed if it is stale;
4. verify the target package against its own payload integrity before use;
5. mutate only adapter-owned consumer surface (ADR-003 write boundary);
6. never mutate consumer authority, including POP, Platform Bootstrap,
   Authority Index, Actor or Capability Profiles, or the framework release;
7. emit any required authority migration separately as a proposal for the
   consumer's own governed operation;
8. fail closed on package or pin mismatch;
9. never read or follow producer `main` implicitly;
10. require exact plan bytes and plan SHA-256 at apply time.

### 4.1 Compatible-upgrade baseline

TSK-020 implements a deliberately narrow compatible-upgrade profile.

The target installed package MAY produce an upgrade plan when:

- the existing `.mcp.json` entry is adapter-shaped and carries a valid current
  release pin;
- every existing adapter-owned generated file other than the runtime pin is
  byte-identical to the target release's rendered output;
- managed consumer content outside the adapter-owned block is preserved;
- the consumer state is otherwise valid and clean on the paths the plan would
  touch.

For this compatible profile:

- the plan records the exact current pin observed in the repository and the exact
  target self-pin from the installed package;
- the only repository mutation is the adapter runtime pin update in `.mcp.json`;
- apply rejects stale plan bytes, stale current pin, dirty touched paths or changed
  target package identity;
- after apply, the target release must observe the consumer without
  `adapter-runtime-mismatch`;
- if any other adapter-owned byte would need migration, planning fails closed with
  `upgrade-migration-required` and produces zero writes.

This profile is sufficient for the proven 1.2.2 -> 1.3.0 Pago Electronico
transition because the TSK-019 product correction changes planner behavior, not
the already materialized consumer templates.

## 5. Out of scope

Public npm/GitHub Package registry publication, signing infrastructure, silent
automatic updates, background update checks, consumer authority migration, and
automatic migration of changed adapter-owned templates remain out of scope unless
separately governed.
