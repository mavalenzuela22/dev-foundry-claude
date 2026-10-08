---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-025
  type: TSK
  title: Publish Verified Claude Adapter 1.4.2 Resolver Release
  status: CLOSED
artifactVersion: "4"
authorityScope: tsk-025-verified-adapter-1.4.2-resolver-release
ownerRole: governance-author
canonical: true
scope:
  owns:
    - adapter-patch-release-1.4.2
    - verified-resolver-hotfix-in-release-payload
    - adapter-142-deterministic-package-identity-proof
    - main-only-github-release-1.4.2
    - adapter-142-published-release-assets-verification
  appliesTo:
    components:
      - claude-adapter-package
      - package-release-automation
      - github-release-distribution
      - consumer-upgrade-release-identity
  excludes:
    - real-pagoelectronico-repository-mutation
    - consumer-authority-reconciliation
    - any_consumer_rollout
    - new_feature_implementation
    - immutable-framework-version-change
    - existing-tag-or-release-replacement
    - public-npm-or-github-packages-publication
    - unrelated-dashboard-or-telemetry-change
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
    - OPS-002
    - OPS-004
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-024
    - TSK-023
lifecycle:
  phase: closed
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-025] PROJECT - Publish Verified Claude Adapter 1.4.2 Resolver Release

## 1. Operator authorization and singular objective

On 2026-10-08 the Operator directed publication of adapter 1.4.2 after producer
TSK-024 resolver compatibility hotfix. A newly bounded producer release task,
temporary Governance Author and Implementation Executor Capability Profiles,
mechanical validation, repository promotion, and publication are authorized
only insofar as required to deliver that exact new release safely.

Create and verify an **immutable** v1.4.2 release containing the TSK-024
brownfield governance MCP resolver compatibility correction, based on
TSK-024 merged clean `main` at
`28a8f6bf11c93875f6991c20c15be50809612e24`.

## 2. Current observed baseline and prior release precedent

- Clean producer `dev-foundry-claude` `main` at
  `28a8f6bf11c93875f6991c20c15be50809612e24`.
- Version is `1.4.1` in root `package.json`, `package-lock.json` and
  `migrations/release.json` `targetVersion`.
- Active `.github/workflows/release.yml` uses manual
  `workflow_dispatch` only from `main`, builds verified assets, and
  creates a fresh exact-commit tag `v<version>` and Github Release.
- Historical TSK-023 release v1.4.1 has successfully run the same main-only
  workflow, producing immutable versioned and alias tarballs and `SHA256SUMS`.
  TSK-023 is a precedent, not authority to overwrite 1.4.1.
- TSK-024 V002 terminal PASS: focused 52/52; full 323/323;
  `npm pack --dry-run --json` PASS; `git diff --check` PASS.
  The resolver code has been merged via PR #48, but no new package version
  or consumer adoption has happened.

## 3. Exact implementation and proof boundary

One cohesive patch release: bump the selected adapter to **1.4.2** in
`package.json`, `package-lock.json`, and `migrations/release.json`
`targetVersion`, with only directly necessary version-facing changes to
`README.md` and existing impacted release/packaged-install tests.

**Seven maximum code/test paths:**

- `package.json`
- `package-lock.json`
- `migrations/release.json`
- `README.md`
- `test/adopt/package.test.js`
- `test/adopt/release-assets.test.js`
- `test/adopt/cutover.test.js`

No changes to resolver source, migration runtime, self-pin enforcement, release
workflow, dashboard, dependency versions, immutable framework, old releases,
consumer repository or product application files.

The bound runner Implementation Executor must author the versioned product
delta under a validated contract. Governance Author MUST NOT implement it.

Required proof before promotion:
1. Focused version-dependent bootstrap, package, cutover and asset tests.
2. Full `npm test`, `npm pack --dry-run --json`, and `git diff --check`.
3. Build release assets using `scripts/release/build-assets.mjs` in a
   non-published location; prove reproducible package bytes, canonical
   alias/version tarball identity, SHA256SUMS and exact versioned selfPin
   from an isolated installed/unpacked target.
4. Validate exact changed files and no unauthorized side effects.
5. Governance Author semantic self-assessment and triggered independent
   audit when required by OPS-004.
6. The produced source tarball and any future published asset must be built
   from the exact verified candidate, with no stale SHA or misleading PASS.

## 4. Promotion, publication and hard stops

Only after verified candidate validation and applicable audit disposition:
commit, push, PR to `main`, merge/integrate/reconcile/cleanup via governed
repository transaction, reobserve clean promoted `main` and exact version
`1.4.2`. Confirm that no `v1.4.2` tag or Release exists.

Then dispatch the existing `.github/workflows/release.yml` on `main`
using authenticated, explicitly permitted capability; verify its actual
terminal SUCCESS, exact tag-to-main-commit link, release assets:
`dev-foundry-claude-adapter-1.4.2.tgz`,
`dev-foundry-claude-adapter.tgz`, and `SHA256SUMS`. Verify byte-identical
archives, declared SHA and installed `selfPin` from published archive.
No manual git tag, release replacement, undocumented asset generation,
or publication from a candidate branch.

If dispatch or independent asset access is unavailable, stop with complete
validated handoff; never claim publication on mere workflow existence or
local verification.

All consumer upgrade, repin, active Authority Index fixes, task
reconciliation and PagoElectronico Claude/MCP smoke are explicitly outside
this producer release task and require their own authority.

## 5. Closure and acceptance

Producer acceptance requires exact immutable published identity, verified
source and consumer-installable runtime pin, truthful documentation of
evidence and limitations, and applicable operator/closure authority.
Producer TSK-024 implementation may remain separately marked
`IN_PROGRESS` until its own documentary closure; no false inference that
a green patch release closes a separate consumer task.

## 6. V001 governed candidate PASS and Author self-assessment (2026-10-08)

The exact bound V001 executor execution
`execution_c479910a0582eb430f67b8f77d7300777d20f82f901aafb15ec6dc28ecc0c97b`
terminated **PASS** in 1,667,159 ms. The executor exited zero,
path policy PASS, post-execution governed validation PASS. Focused
versioned bootstrap/package/cutover/release tests: 162/162 PASS.
Full `npm test`: 323/323 PASS. `npm pack --dry-run --json` and
`git diff --check`: PASS. The standalone exact changed-path
validation also returned PASS, with zero hidden changes.

Observed candidate mutation consists of **six** (of seven projected)
paths: `package.json`, `package-lock.json`,
`migrations/release.json`, `README.md`,
`test/adopt/package.test.js`,
`test/adopt/release-assets.test.js`. No change to
`test/adopt/cutover.test.js` was necessary.

**Governance Author semantic self-assessment:** Candidate package
version, lock root version and migration target are all exactly
1.4.2. `selfUpdateBaseline` is unchanged at 1.4.0. No dependency,
runtime resolver, upgrade/migration implementation, release workflow,
immutable framework or consumer file changed. Old 1.4.1 historical
synthetic semantic-migration fixture remains pinned to 1.4.1
rather than being rewritten; live target expectations now test
1.4.2. README and version assertions match the new candidate.
The existing asset-builder tests validate tarball alias equality,
checksums, and installed payload identity, but independent
**published** release identity remains future proof after main
promotion. The candidate has no known unresolved product
nonconformance within the authorized seven-path boundary.

The applicable adopted OPS-004 audit trigger check finds no
mandatory independent audit: POP `audit_triggers: []`,
TSK-025 contains no unconditional audit requirement, and the
release candidate changes no security boundary, dependency,
new capability or architecture. This is Author self-assessment
only, not an independent AUDIT PASS verdict.

The Operator authorized release of 1.4.2 subject to exact
validation and publication gates. Promotion may therefore
proceed via the governed repository transaction after the exact
candidate state and evidence are revalidated. Publication
requires a subsequent clean merged-main version check,
no existing v1.4.2 tag/release collision, authorized workflow
dispatch, observed workflow SUCCESS, verified three release
assets and exact installed self-pin. No consumer mutation,
manual tag or release claim is permitted before these facts.

## 7. Verified publication and terminal producer disposition (2026-10-08)

The governed release candidate was committed at
`3aa5fd4915c0932f79e30a79bc9a02721ac22e71`. Repository transaction
`TSK-025-RELEASE-CANDIDATE-20261008-V001` completed every authorized phase
through cleanup. [PR #49](https://github.com/mavalenzuela22/dev-foundry-claude/pull/49)
merged to `main` at `9b6340b051d32857e8b79589cd049fb81c0a196d`.
The runner independently confirmed that exact clean `main`.

The Operator's authenticated GitHub CLI verification recorded published
`v1.4.2` tag at the exact release commit; GitHub Actions
[run 37855084070](https://github.com/mavalenzuela22/dev-foundry-claude/actions/runs/37855084070)
`SUCCESS`; exactly three published distribution assets; both tarballs
byte-identical and SHA-256
`3aa7542c41ce613c9c152e21c8e2d95d835dc00be1cb8f2e46302daa54cadaf3`;
`SHA256SUMS` verified; and unpacked payload `selfPin`
`1.4.2:sha256:1780711cd5661b40f7f0e1220146e87ae12f88c3bc9ba37de06f17fe69cbe79f`.
These published-asset observations are Operator-supplied evidence, not
independently downloaded by the runner. The prior independent-audit trigger
disposition remains **not required**, not AUDIT PASS.

**TSK-025 status: CLOSED, subject to integration of the documentation-only
closure bundle.** `TSK-025-CLOSURE` holds the terminal release identity,
evidence classification, scope exclusions and known limits. Immutable
`v1.4.2` tag/assets remain unchanged. No consumer deployment, upgrade,
repin, or cutover is implied, and TSK-024's own lifecycle remains separate.
