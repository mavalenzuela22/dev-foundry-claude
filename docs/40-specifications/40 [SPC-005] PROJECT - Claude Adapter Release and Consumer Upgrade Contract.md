---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-005
  type: SPC
  title: Claude Adapter Release and Consumer Upgrade Contract
  status: PLANNED
artifactVersion: "1"
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
    - OPS-005
  supersedes: []
lifecycle:
  phase: planned
portability: project-specific
---

# 40 [SPC-005] dev-foundry-claude - Claude Adapter Release and Consumer Upgrade Contract

## 1. Status and necessity

This contract is PLANNED. No release or upgrade mechanism beyond the ADR-003
adoption `plan`/`apply` and the runtime pin exists. Nothing here is implemented
or reserved by TSK-013, and naming a follow-on task does not grant it authority.

A separate contract is necessary because ADR-004 fixes the decision, but a
future implementation needs one normative home for release identity and upgrade
behavior that ADR-003 (first adoption) does not own. It is deliberately short
and states only invariants; mechanics are left to the governed task that
implements it.

## 2. Release model

- A release is an immutable adapter build identified by
  `<version>:sha256:<payload-root>` as defined by ADR-003 and TSK-012.
- Producer `main`, a branch, or a working tree is not a release.
- Adapter version 1.1.0 is the initial consumer baseline.

## 3. Consumer states

- **Pinned:** the consumer `.mcp.json` carries `--expect <version>:sha256:<root>`
  for exactly one release N. It remains pinned while the producer evolves.
- **Adopting / upgrading:** the consumer is explicitly moved from release N to
  release N+1 by a governed upgrade.

## 4. Upgrade invariants (for the implementing task)

A future upgrade capability SHALL:

1. produce a read-only deterministic plan before any mutation;
2. require an explicit expected current release and explicit target release;
3. verify the consumer's current pin matches the expected current release and
   fail closed if it is stale;
4. verify the target package against its own integrity pin before use;
5. mutate only adapter-owned consumer surface (ADR-003 write boundary);
6. never mutate consumer authority, including POP, Platform Bootstrap,
   Authority Index, Actor or Capability Profiles, or the framework release;
7. emit any required authority migration separately as a proposal for the
   consumer's own governed operation;
8. fail closed on package or pin mismatch;
9. never read or follow producer `main` implicitly.

## 5. Out of scope

Registry choice and publication, signing, release tags or records, automatic
update checks, and any consumer repository change are out of scope until
separately governed.
