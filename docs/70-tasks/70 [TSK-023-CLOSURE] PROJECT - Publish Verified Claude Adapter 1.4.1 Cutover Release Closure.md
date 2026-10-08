---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-023-CLOSURE
  type: CLOSURE
  title: Publish Verified Claude Adapter 1.4.1 Cutover Release Closure
  status: CLOSED
artifactVersion: "1"
authorityScope: tsk-023-verified-adapter-141-release-terminal-disposition
ownerRole: evidence-custodian
canonical: true
scope:
  owns:
    - tsk-023-release-141-terminal-disposition
    - published-immutable-adapter-141-distribution-identity
  appliesTo:
    tasks:
      - TSK-023
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - github-release-distribution
  excludes:
    - real-pagoelectronico-repository-mutation
    - tsk041-consumer-acceptance-or-authority-cutover
    - published-v141-tag-or-asset-replacement
    - public-npm-or-github-packages-publication
    - product-or-test-code-modification
    - immutable-framework-change
    - unrelated-otel-or-dashboard-change
authority:
  governedBy:
    - TSK-023
    - ADR-004
    - ADR-005
    - ADR-007
    - SPC-005
    - SPC-008
    - OPS-001
    - OPS-004
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn:
    - TSK-023
lifecycle:
  phase: closed
  dependsOn:
    - TSK-023
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-023-CLOSURE] PROJECT - Publish Verified Claude Adapter 1.4.1 Cutover Release Closure

## 1. Purpose and exact boundary

Record the release-producer terminal disposition for TSK-023 following validated patch-version preparation, governed promotion, and published GitHub Release v1.4.1 integrity verification. The Operator authorized completion of the release lifecycle on 2026-10-07 and explicitly authorized this **documental-only** closure on 2026-10-08. This document must not alter or rebuild any released bytes. PagoElectronico TSK-041 remains a separate consumer-governed operation.

## 2. Terminal disposition and provenance

`CLOSED — CLAUDE ADAPTER 1.4.1 RELEASE CANDIDATE VALIDATED, PROMOTED TO MAIN, GITHUB RELEASE PUBLISHED FROM EXACT MAIN COMMIT, ASSETS VERIFIED AND PAYLOAD SELF-PIN CONFIRMED. CONSUMER TSK-041 REMAINS SEPARATELY OPEN.`

Observed producer and promotion facts:

- TSK-022 producer closure baseline/main `0b363425aa5431521ded544574cc45123b403c47` was established before TSK-023 began.
- TSK-023 V001 execution `execution_ec0f174fd6ceb9835f4015f81cd1231bc2a6e8972344ea5872c245f003258a27` FAILED because of a missing executor-profile prohibition; the governance profile was corrected separately.
- TSK-023 V002 execution `execution_d2326551611c6a02907b90a9fdc8ee39b2eee682c10f886b0601c2470b54be40` FAILED full regression (305/309 PASS), exposing version-sensitive test fixtures; not represented as a terminal PASS.
- V003 `execution_355742095b7890325c058edd37b5b0e2b209fd01b182cc0d8be70e0bfc884a9a` PASSED: focused tests 162/162; full `npm test` 309/309; `npm pack --dry-run --json` PASS (1,221 manifest files); `git diff --check` PASS; exact executor path policy PASS. Duration 27m 53s.
- Canonical validation evidence `tsk023-release-candidate-v003`, promotion evidence `tsk023-promotion-readiness-v001` and closure evidence `tsk023-release-publication-closure-v001` preserve V001/V002 failures and V003 PASS without conflation.
- `change_set` and `promotion_ready` repository validation both PASS; independent Governance Audit was not triggered under the active project operating profile.
- Release candidate commit `7c88347a295e04adb171ea5da3ac2b4322861482`; producer [PR #46](https://github.com/mavalenzuela22/dev-foundry-claude/pull/46) merged to main.
- Promoted and published main HEAD `47f2af1971b05db68ded89c87a02f3cc1675321a`. Transaction `TSK-023-RELEASE-CANDIDATE-PROMOTION-20261008-V001` completed commit, push, PR, merge, integration, reconciliation and cleanup; source branch deleted and clean main reobserved.

## 3. Released identity and observed verification

The Operator supplied authenticated GitHub CLI observations on 2026-10-08:

- `release.yml` workflow run `37806253109`: `completed / success`, `headSha=47f2af1971b05db68ded89c87a02f3cc1675321a`.
- [GitHub Release v1.4.1](https://github.com/mavalenzuela22/dev-foundry-claude/releases/tag/v1.4.1), published at `2026-10-08T16:07:25Z`; assets `dev-foundry-claude-adapter-1.4.1.tgz`, `dev-foundry-claude-adapter.tgz`, and `SHA256SUMS`.
- The Operator's non-mutating terminal verification checked the tag's exact commit, downloaded all three published assets, verified both SHA-256 entries with `shasum -a 256 -c SHA256SUMS` (both `OK`), checked both tarballs byte-identical, and unpacked the published package for `selfPin()`.
- Operator output: `SELF_PIN: 1.4.1:sha256:f914b60cb3e5bb2fe61e1c8bc22043a6eee73c54f5de0fa1680d219821fabfce`, `RELEASE_INTEGRITY=PASS`. The payload root agrees with the pre-promotion package dry-run manifest.
- **Evidence classification:** workflow/release publication and downloaded-asset verification results above are explicit Operator-provided authenticated CLI/terminal observations, not independently reproduced by the runner or an assertion of cryptographic publisher signatures. Producer/transaction statuses and repository state were read independently through the process-bound runner.

## 4. Immutable release, known limits and follow-on

This closure modifies documentation only. It SHALL NOT move, rewrite or delete tag `v1.4.1`, regenerate or replace released tarballs or `SHA256SUMS`, adjust version/manifest/pin, or dispatch the release workflow again. Later closure-document promotion may advance `main` beyond `47f2af1` without changing the immutable versioned tag or release identity.

Historical publicly installed versus staged v1.4.0 payload roots were different; these remain distinguishable historical identities, not evidence of v1.4.1 failure. No silent repin or arbitrary historical-upgrade guarantee is implied.

Real PagoElectronico TSK-041 global installation, selected exact v1.4.1 consumer pin, migration plan, reviewed authorization, governed cutover and fresh runtime acceptance are **not** completed or authorized by this producer release closure. A future defect discovered in the released bytes requires a separately authorized bounded corrective and a new release identity, not mutation of published v1.4.1.

## 5. Closure condition

The terminal decision becomes formally integrated when this CLOSURE record, the `CLOSED` TSK-023 metadata and the indexed authority route are promoted through a governed documentary-only PR, merged, reconciled and cleaned up on `main`. The v1.4.1 release tag and GitHub assets remain untouched by that transaction.
