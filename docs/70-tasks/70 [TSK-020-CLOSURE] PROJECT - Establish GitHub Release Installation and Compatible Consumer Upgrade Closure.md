---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-020-CLOSURE
  type: CLOSURE
  title: Establish GitHub Release Installation and Compatible Consumer Upgrade Closure
  status: CLOSED
artifactVersion: "1"
authorityScope: tsk-020-github-release-install-upgrade-terminal-disposition
ownerRole: evidence-custodian
canonical: true
scope:
  owns:
    - tsk-020-terminal-disposition
    - adapter-1.3.0-github-release-distribution-closure
    - compatible-consumer-upgrade-closure
  appliesTo:
    tasks:
      - TSK-020
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - adapter-cli
      - release-automation
  excludes:
    - public-npm-registry-publication
    - github-packages-publication
    - authenticated-private-repository-acquisition
    - silent-automatic-update
    - consumer-authority-mutation
    - reusable-methodology-change
    - PagoElectronico-product-code
    - database-or-iis-runtime-change
authority:
  governedBy:
    - TSK-020
    - ADR-005
    - SPC-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn:
    - TSK-020
lifecycle:
  phase: closed
  dependsOn:
    - TSK-020
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-020-CLOSURE] PROJECT - Establish GitHub Release Installation and Compatible Consumer Upgrade Closure

## 1. Purpose

Record terminal disposition for TSK-020 after adapter 1.3.0 established the
GitHub Release distribution channel, compatible consumer upgrade behavior,
post-publication installation proof, and the corrective that made public
repository readability an explicit acquisition precondition.

## 2. Final disposition

`CLOSED — ADAPTER 1.3.0 GITHUB RELEASE DISTRIBUTION AND COMPATIBLE CONSUMER UPGRADE DELIVERED, VALIDATED, PUBLISHED, PROVEN ON WINDOWS AND MACOS, RECONCILED, CLEANED UP, AND FORMALLY CLOSED`

Verified lineage:

- exact producer candidate before first promotion:
  `00d125a77e404038f3873948b700746fc81107aa`;
- terminal producer validation request:
  `valreq_ff4707e759eed74330e7afaa28d87bf3` -> PASS / evidence complete;
- exact Windows pre-publication compatible-upgrade proof:
  `TSK-041/windows-upgrade-smoke-v041` /
  `execution_58ff0ed18cdaf9083a73f25b72ea73159cea0a1d2de4fe9e9a0b46df591de42c` -> PASS;
- first promotion pull request: #40;
- first promoted/default-branch head:
  `730680744aca480ba576221f492e81d892a0358f`;
- GitHub Release: `v1.3.0`;
- versioned `dev-foundry-claude-adapter-1.3.0.tgz` and stable
  `dev-foundry-claude-adapter.tgz` observed with SHA-256
  `16e4b228184a65b2c4624e98c45c01eb6fa089d19bbcecfec5bc83ba7ace0631`;
- anonymous public-release installation on macOS returned adapter version
  `1.3.0`;
- anonymous public-release installation on Windows created the expected npm
  shims and returned adapter version `1.3.0`;
- Windows bare-command availability required the active CodeMie npm global
  prefix to be present on that PowerShell process `PATH`; the package/shim
  itself was valid;
- the Operator changed the producer repository from private to public before
  final anonymous-install proof, exposing a previously implicit distribution
  precondition;
- ADR-005/SPC-005/TSK-020 and README were corrected to state that the 1.3.0
  anonymous baseline requires public readability and that authenticated private
  acquisition is outside this baseline;
- bounded current-tree public-exposure sanity validation:
  `valreq_52c3f05c6e03a411639f1becf82d5eb9` -> PASS / evidence complete;
- README corrective execution:
  `execution_0f6e87f591a09eee9067e7046c02bb140434995898e1e37a2f9929b19ff4f262` -> PASS;
- corrective promotion evidence envelope:
  `TSK-020-public-release-precondition-corrective-promotion-20261006`;
- corrective promotion pull request: #41;
- corrective merge/default-branch head:
  `6c95fef0f441282cd5fc105519e03c90a1749901`;
- corrective integration digest:
  `96ff1f9c380d58ab3e1805d19c1e4f4d47ec7f08177a9a615fbeff732f812223`;
- corrective reconciliation digest:
  `dce4f5ef5eb04f7c026f68ee66c1020a6a5aa99b3922ae9d419b7753aa161fb9`;
- corrective cleanup digest:
  `e5aa435e50a8bf6863da4d538928c9bbbb4aa135706bd22b2cb772e6a92695ba`;
- independent Governance Audit: not required by current project audit triggers.

## 3. Delivered scope

TSK-020 delivered:

- GitHub Releases as the official downloadable adapter channel for this baseline;
- immutable versioned tarball, stable alias and SHA256SUMS release assets;
- public no-checkout installation UX on macOS and Windows;
- adapter 1.3.0 exact package/runtime identity and payload verification;
- explicit `upgrade status`, `upgrade plan` and exact-plan `upgrade apply`;
- compatible 1.2.2 -> 1.3.0 runtime-pin transition while preserving consumer
  authority and product code;
- fail-closed `upgrade-migration-required` behavior for broader migrations;
- exact Windows Pago temporary-clone proof while preserving the real Pago
  repository unchanged;
- explicit documentation that anonymous GitHub acquisition depends on producer
  repository/release assets remaining publicly readable.

## 4. Known limits and follow-on

TSK-020 does not provide authenticated acquisition from a private producer
repository, npm/GitHub Packages publication, silent automatic updates, arbitrary
template migration, or the separately governed real Pago Electronico upgrade and
cutover.

The public-exposure sanity validation was intentionally bounded to current
Git-tracked content. It is not a full historical Git object secret scan; any
history-wide security review is a separate security-hardening operation rather
than a TSK-020 release-distribution acceptance gate.

## 5. Final decision

The Operator authorized the public-readability corrective and continuation
through validation, promotion, reconciliation, cleanup and formal closure while
gates remained PASS. Those conditions are satisfied.

TSK-020 is formally closed when this closure record, CLOSED TSK-020 metadata and
Authority Index routing are integrated to clean `main`.
