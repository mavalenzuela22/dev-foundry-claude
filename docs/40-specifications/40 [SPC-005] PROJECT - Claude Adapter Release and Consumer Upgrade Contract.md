---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-005
  type: SPC
  title: Claude Adapter Release and Consumer Upgrade Contract
  status: ACTIVE
artifactVersion: "4"
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
    - arbitrary-consumer-authority-mutation
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
- Adapter 1.2.3 is the pre-TSK-020 producer baseline. TSK-020 established 1.3.0
  as the first release with governed compatible-upgrade support.
- Adapter 1.4.0 is the first self-update-capable baseline under ADR-007/SPC-008.
  Supported older consumers cross the bounded legacy bridge once; later releases
  use the governed model-assisted migration lifecycle when semantic or configured
  authority changes are required.
- Migration material shipped for a target release is part of that immutable
  payload identity and is verified by the same package-integrity model.

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
5. direct ordinary upgrade/apply mechanics mutate only adapter-owned consumer
   surface under the ADR-003 ordinary write boundary;
6. configured consumer authority may change only through the explicit
   ADR-007/SPC-008 initial-bootstrap, declared legacy-bridge, or governed
   self-update lifecycle, never as an implicit package-install side effect;
7. a self-update target that requires authority/semantic migration is staged
   side-by-side and reviewed from the currently active source session before
   cutover;
8. target framework or migration bytes are input, not active project authority,
   until explicit project adoption/cutover;
9. fail closed on package or pin mismatch, unsupported source, unresolved
   Operator choice, stale migration candidate, or failed required validation;
10. never read or follow producer `main` implicitly;
11. require exact plan bytes and plan SHA-256 wherever a deterministic apply
    boundary is used;
12. invalidate the source governed session after a cutover that changes its
    starting runtime/authority identity and require a fresh session.

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

The original TSK-020 assumption that the compatible profile was sufficient for
PagoElectronico 1.2.2 -> 1.3.0 was disproved by later dogfooding: the real
consumer exposed managed-agent/block drift and a migration-required boundary.
That evidence is preserved. TSK-021/ADR-007/SPC-008 replace reset/reinstall as
the acceptance strategy with a real legacy bridge into the 1.4.0 baseline.

## 5. Out of scope

Public npm/GitHub Package registry publication, signing infrastructure, silent
background updates, and arbitrary consumer-authority authoring remain out of
scope. Initial bootstrap, changed adapter-owned template migration, the
pre-baseline legacy bridge, and governed model-assisted self-update are governed
by ADR-007/SPC-008 and TSK-021 rather than being implicit extensions of this
release contract.
