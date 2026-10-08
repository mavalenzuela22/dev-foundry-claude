---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-023
  type: TSK
  title: Publish Verified Claude Adapter 1.4.1 Cutover Release
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-023-verified-adapter-1.4.1-cutover-release
ownerRole: governance-author
canonical: true
scope:
  owns:
    - adapter-patch-release-1.4.1
    - deterministic-package-identity-proof
    - promoted-main-only-github-release
    - verified-published-release-assets
  appliesTo:
    components:
      - claude-adapter-package
      - package-release-automation
      - github-release-distribution
      - consumer-installation-guidance
  excludes:
    - real-pagoelectronico-repository-mutation
    - consumer-authority-cutover
    - app-or-product-feature-implementation
    - existing-release-or-tag-replacement
    - immutable-framework-version-change
    - public-npm-or-github-packages-publication
    - unrelated-telemetry-or-dashboard-change
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-007
    - SPC-005
    - SPC-007
    - SPC-008
    - OPS-001
    - OPS-004
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-022
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-023] PROJECT - Publish Verified Claude Adapter 1.4.1 Cutover Release

## 1. Purpose and Operator authorization

The Operator on 2026-10-07 explicitly authorized finishing producer TSK-022 CLOSURE **before** preparing a new adapter release, then carrying out the patch release to unblock PagoElectronico. TSK-022 and its CLOSURE are already integrated in clean main at `0b363425aa5431521ded544574cc45123b403c47`. Release v1.4.1 must contain the proven recoverable cutover implementation promoted via PR #44. This separate task owns release identity and publication, not consumer authority mutation.

## 2. Required outcome

1. Bump package, lockfile and packaged migration `targetVersion` from 1.4.0 to exactly 1.4.1 and update minimally necessary version-facing README/help guidance only; do not change feature code or weaken strict self-pin verification.
2. Run full producer mechanical tests, package dry-run, verified build-assets script and isolated unpack/install/self-pin before promotion. The target package must be built from exact candidate code and include the TSK-022 cutover. The source tarball alias must byte-equal versioned tarball and SHA256SUMS.
3. Reconcile Windows staging/public 1.4.0 manifest root mismatch as a **distinct identity finding**; do not assume npm modified the package or overwrite immutable v1.4.0. The new release is accepted only on its own exact version/payload SHA and fresh installed-runtime identity; diagnose preexisting differences if they affect the 1.4.1 release.
4. Validate exact changed paths and scope, evaluate independent audit triggers, record evidence, commit, push, PR, merge/integrate/reconcile/cleanup via governed repository transaction.
5. Only after verified clean promoted main has package version 1.4.1 and no `v1.4.1` collision, dispatch the existing `.github/workflows/release.yml` on main using an authenticated permitted release capability. Do not tag manually, rewrite tags or publish from a branch.
6. Observe the actual GitHub Release v1.4.1 assets including versioned `dev-foundry-claude-adapter-1.4.1.tgz`, stable `dev-foundry-claude-adapter.tgz` and `SHA256SUMS`, verify both tarballs exact SHA match and installed payload self-pin, and record final release identity and commit.
7. Do not modify real PagoElectronico from producer. Its TSK-041 separately governs installation, migration plan/authorization/commit and live Claude startup. Do not claim its acceptance.

## 3. Bound candidate and strict gates

- Product baseline: clean producer main `0b363425aa5431521ded544574cc45123b403c47`; TSK-022 implemented and producer-closed before release.
- Existing root `package.json`, `package-lock.json` version 1.4.0; release workflow is main-only manual `workflow_dispatch`.
- Minimal implementation path projection: `package.json`, `package-lock.json`, `migrations/release.json`, `README.md`, `test/adopt/package.test.js` and `test/adopt/release-assets.test.js` for directly affected version assertions; preserve historical 1.4.0 fixture/baseline expectations; another path requires directly necessary and separately reconciled scope under OPS-007/008.
- Dedicated TSK-023 Implementation Executor requires an exact contract and eligible bound Capability Profile. Author/Custodian cannot implement product changes. No consumer repository access, global npm mutation or release side effects during code implementation.
- Publication requires observed proof after promotion; repo runner transaction supports Git promotion, not necessarily GitHub Actions dispatch. If the release dispatch capability is unavailable, fail closed with full verified handoff, not an invented published status.
- All validation evidence, audit disposition and scope authorizations must remain truthful. Do not close TSK-023 merely because versioned files are in main.

## 4. Deployment risks and explicit deferrals

The prior producer staged candidate reported `1.4.0:sha256:da37df3d9a26328b6ad1de37f6100a8aae736d219e786e65fc63b6de79bdde98`; Windows globally installed public v1.4.0 reported `1.4.0:sha256:0bf9949b0f45c1b37dc0037bd48d23db0bcee5b6dcd6970592a912643d936b0c`. These distinct identities are not evidence that v1.4.1 fails; only exact verification of the new published payload and consumer-selected pin is acceptable. No silent repin.

Real consumer PagoElectronico TSK-041 acceptance occurs later. This release operation MUST NOT claim completed end-to-end consumer cutover or modify Pago's two original worktree changes.
