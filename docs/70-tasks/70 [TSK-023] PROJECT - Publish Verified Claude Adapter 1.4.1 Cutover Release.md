---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-023
  type: TSK
  title: Publish Verified Claude Adapter 1.4.1 Cutover Release
  status: CLOSED
artifactVersion: "3"
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
  phase: closed
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
- Minimal implementation path projection: `package.json`, `package-lock.json`, `migrations/release.json`, `README.md`, `test/adopt/package.test.js`, `test/adopt/release-assets.test.js`, and `test/adopt/cutover.test.js` for directly affected version assertions and installed-runtime synthetic manifest consistency; preserve historical 1.4.0 fixture/baseline expectations; another path requires directly necessary and separately reconciled scope under OPS-007/008.
- Dedicated TSK-023 Implementation Executor requires an exact contract and eligible bound Capability Profile. Author/Custodian cannot implement product changes. No consumer repository access, global npm mutation or release side effects during code implementation.
- Publication requires observed proof after promotion; repo runner transaction supports Git promotion, not necessarily GitHub Actions dispatch. If the release dispatch capability is unavailable, fail closed with full verified handoff, not an invented published status.
- All validation evidence, audit disposition and scope authorizations must remain truthful. Do not close TSK-023 merely because versioned files are in main.

## 4. V002 validation corrective and release upgrade-boundary preservation

V001's initial TSK-023 executor profile lacked an explicit Claude-as-producer-executor prohibition; a separately committed governance correction satisfied the 15/15 producer-binding/security tests before V002. V002 subsequently changed the six projected release/version/test paths only; package dry-run and git diff check passed, but full regression failed 305/309 with four version-dependent failures. Its installed-cutover synthetic fixture builds its manifest as 1.4.0 after copying the now-1.4.1 package.json, violating exact selfPin verification. The historical TSK-021 legacy-package test still assumes target 1.4.0, while this target is 1.4.1.

A bounded V003 consistency corrective MAY update the seventh test path `test/adopt/cutover.test.js` to obtain the synthetic payload-manifest version from the copied package metadata (without changing strict verification), and may align `test/adopt/package.test.js` with truthful release-specific semantics while retaining 1.4.0's legacy-bridge historical evidence and proving deterministic checks, exact selected source identity, unchanged authority and no product writes. SPC-008 §3 states the bridge from supported pre-1.4.0 releases is a one-time step into **1.4.0** and need not remain directly supported by later versions. No silent assertion that 1.4.1 is the original 1.4.0 bridge or that uncontrolled old-package upgrades are safe is permitted.

Hard bounds: only the seven projected release/version/test paths; no weakening `src/adopt/pin.js`, `src/adopt/upgrade.js`, `src/adopt/migration.js`, or other runtime source. If correct upgrade semantics require changing runtime/product logic, record that blocker and stop rather than adapting the assertions into a false PASS. V003 must preserve V002's valid package/release changes, run focused bootstrap/cutover/packaged-upgrade tests and the full suite, reverify package exact identity and `git diff --check`, and report failure/limitations truthfully.

## 5. Deployment risks and explicit deferrals

The prior producer staged candidate reported `1.4.0:sha256:da37df3d9a26328b6ad1de37f6100a8aae736d219e786e65fc63b6de79bdde98`; Windows globally installed public v1.4.0 reported `1.4.0:sha256:0bf9949b0f45c1b37dc0037bd48d23db0bcee5b6dcd6970592a912643d936b0c`. These distinct identities are not evidence that v1.4.1 fails; only exact verification of the new published payload and consumer-selected pin is acceptable. No silent repin.

Real consumer PagoElectronico TSK-041 acceptance occurs later. This release operation MUST NOT claim completed end-to-end consumer cutover or modify Pago's two original worktree changes.

## 6. Verified v1.4.1 publication and producer terminal disposition

The verified TSK-023 release candidate (V003 `execution_355742095b7890325c058edd37b5b0e2b209fd01b182cc0d8be70e0bfc884a9a`, 309/309 tests PASS) was promoted by [PR #46](https://github.com/mavalenzuela22/dev-foundry-claude/pull/46) to exact published `main` commit `47f2af1971b05db68ded89c87a02f3cc1675321a`. The governed promotion transaction `TSK-023-RELEASE-CANDIDATE-PROMOTION-20261008-V001` completed through reconciliation and cleanup. GitHub workflow run `37806253109` reported SUCCESS on that commit and published immutable release `v1.4.1` with versioned tarball, alias and `SHA256SUMS`.

Operator-provided authenticated terminal evidence confirmed both archive SHA-256 checks `OK`, byte-equal archives, tag/head match and installed unpacked `selfPin: 1.4.1:sha256:f914b60cb3e5bb2fe61e1c8bc22043a6eee73c54f5de0fa1680d219821fabfce`, ending `RELEASE_INTEGRITY=PASS`. That terminal output is explicitly Operator-observed, not an independent asset download by the runner. Failure histories V001/V002 are retained and not converted to PASS. Audit not triggered under the current POP.

**Producer TSK-023 status: CLOSED, subject to this documentary closure bundle being integrated on clean `main`.** Terminal source and explicit limitations are recorded by `TSK-023-CLOSURE`. Public `v1.4.1` tag and assets are immutable and outside this closure change; later `main` commits must not change the release identity. Real PagoElectronico TSK-041 consumer rollout and authority cutover are separate, not claimed complete.
