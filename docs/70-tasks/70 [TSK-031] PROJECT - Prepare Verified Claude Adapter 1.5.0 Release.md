---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-031
  type: TSK
  title: Prepare Verified Claude Adapter 1.5.0 Release
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-031-prepare-verified-adapter-150-release
ownerRole: governance-author
canonical: true
scope:
  owns:
    - adapter-150-candidate-version-and-migration-identity
    - integrated-tsk-029-and-tsk-030-release-candidate
    - nonpublished-verified-release-package-proof
    - governed-main-only-adapter-release-publication-handoff
  appliesTo:
    components:
      - claude-adapter-package
      - release-version-metadata
      - release-asset-builder-and-existing-workflow
      - packaged-framework-and-consumer-upgrade-compatibility
  excludes:
    - mutation-of-pagoelectronico-or-other-consumer-repositories
    - silent-consumer-runtime-repin-or-framework-adoption
    - implementation-of-planned-tsk-026-managed-runtime-updater
    - replacing-tag-or-assets-of-v1.4.2
    - changing-upstream-immutable-framework-content
    - changing-github-release-workflow-without-defect-evidence
    - public-npm-or-github-packages-publishing
    - automatic-promotion-or-release-publication-without-applicable-gates
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
    - OPS-003
    - OPS-004
    - OPS-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn:
    - TSK-029
    - TSK-030
  derivedFrom:
    - TSK-025
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# TSK-031 — Prepare Verified Claude Adapter 1.5.0 Release

## 1. Operator objective and actual baseline

On 2026-10-18, after confirming that the existing PagoElectronico
consumer runs immutable adapter `1.4.2` on DEV FOUNDRY `2.1.0`,
the Operator directed preparation of a **new** producer release and
then a subsequent governed consumer upgrade. This task authorizes producer
**preparation only**; it does not authorize publishing immediately,
changing PagoElectronico, or performing an implicit consumer migration.

Process-bound producer repository `dev-foundry-claude`, clean branch
`task/tsk-030-runtime-cli-argument-forwarding` at
`e691b6070c954a5af67ac1aaf87c9a61d639c19d`
was the observed parent of this task's branch
`task/tsk-031-adapter-150-release-preparation`. Its ancestry contains
the **committed** TSK-029 candidate (framework 2.3.0 bundle, POP v3
product support, template updates; focused C002 45/45 PASS) and TSK-030
launcher fix (CodeMie `--` pass-through removed; 23/23 PASS; Operator
confirmed live `claude.mjs --runtime dial -- -p "hola"` response).

Producer's **active** POP/index/bootstrap still select immutable
DEV FOUNDRY `2.1.0`, so TSK-029's *producer adoption and authorized
integration* remain unfinished. Both TSK-029 and TSK-030 are still
`IN_PROGRESS`. This task does not falsely declare either closed.
The root `package.json` and lockfile still describe adapter `1.4.2`;
`migrations/release.json` still records `targetVersion: 1.4.2`
and legacy framework data. No 1.5.0 tarball exists yet.

## 2. Version and minimum deliverable

Proposed next stable adapter release: **1.5.0**, a MINOR increment
from immutable 1.4.2, because of additional packaged framework/adoption
features and launcher correction. No 1.4.2 overwrite or same-SemVer
rebuild is permitted. Before authorizing a 1.5.0 tag/asset, verify
against actual remote tags/releases and commit identity to rule out
a version collision.

The delivered candidate must contain **only** already-governed
TSK-029 and TSK-030 product changes plus the version/packaging
consistency directly necessary to distribute them. Source framework
2.3.0 and retained 2.1.0 canonical bundles must remain immutable.
The packaged product must truthfully declare the supported framework
versions and all migration metadata; a target's bundled 2.3.0
does **not** grant automatic adoption of 2.3.0 to an existing
2.1.0 consumer.

**TSK-026 is PLANNED, design/preparation only.** Managed runtime store,
stable launcher, automatic cross-version runtime manager,
model-assisted self-updater and installed-1.4.2 bootstrap are
**NOT implemented or promised as working in 1.5.0** by this release.
Use only supported 1.4.2-era isolated stage and governed cutover
mechanics where they actually exist. Document a separate first-hop
limitation rather than invent implementation, requiring consumer
upgrade as another project's bounded operation.

## 3. Exact producer implementation boundary

After reconciling the already-observed TSK-029/TSK-030 acceptance
under their own current authority, the separately bound Runner
Implementation Executor may prepare only:
- `package.json`, `package-lock.json`, and
  `migrations/release.json` to set version 1.5.0 consistently;
- `README.md` and existing version/packed-install/release-asset
  tests strictly where directly necessary.

Do not silently alter dependency versions, executable launcher
contracts, `src/` logic, publishing workflow, source framework
artifacts, current or historical POP, templates, telemetry/privacy,
or previously verified TSK-029/030 implementation code.
If version-gated migration material cannot be made consistent under
the existing release mechanism without such changes, stop and return
one exact causal finding for Governance Author reconciliation, rather
than guessing or expanding the executor scope.

The release-preparation contract shall use an exact allowlist and
focused tests from existing package/bootstrap/upgrade/release coverage,
then run the *existing* full `npm test`,
`npm pack --dry-run --json`, `git diff --check`, and the existing
`scripts/release/build-assets.mjs` to an isolated **nonpublished**
location, where required to validate a final release build. Verify
self-pin from exact packaged bytes and that the versioned/alias tarball
and `SHA256SUMS` agree; do not mistake a source-tree CLI integrity
refusal for a real installed-package failure.

## 4. Adoption/integration and release safety

Sequence the real gates, without circular prerequisites:
1. Preserve C001/C002 state-bound proof from TSK-029 and TSK-030,
   reconcile material 2.3.0 adoption in producer project POP v3,
   Authority Index, Platform Bootstrap v3, and applicable role
   selection/actor profile. Governance Author controls those SoT
   files; the executor does **not** mutate them. Resolve their
   separate promotion and any actually triggered audit under the
   authority active when each operation occurs.
2. Build and mechanically validate the standalone 1.5.0 release
   candidate from the **exact integrated source**. Keep failed
   evidence and limitations truthful; no audit is routine without a
   real applicable authority trigger. Do not weaken existing 1.4.2
   or 2.1.0 consumer compatibility.
3. Promote accepted producer work through authorized commit,
   push, PR, merge/integration and verification of a clean
   `main`. Reconfirm exact target package/version and that the
   candidate release still corresponds to the promoted commit.
4. **Only after separately authorized publication** from clean
   `main`, invoke unchanged `.github/workflows/release.yml`
   via an authenticated permitted tool. Confirm actual workflow
   success, exact `v1.5.0` tag-to-commit, the versioned and alias
   archives and SHA256SUMS, and byte-identical verified assets.
   Do not claim publication when only a candidate was prepared.

PayElectronico is not mutated by this producer task. The user-observed
consumer `agent-file-collision` comes from its locally modified
`.claude/agents/dev-foundry-executor.md`; do not overwrite its legitimate
canonical `requestedRole: implementation-executor` clarification.
The actual 1.5.0 staged upgrade plan must explicitly reconcile any
target template drift and avoid touching consumer product/Kafka changes.
A dirty consumer worktree alone is not permission to reset/clean it.

## 5. Governance Author necessity and acceptance assessment

OPS-007: no custom release pipeline, GitHub integration, dependency,
code-generation utility, updater implementation, new role profile or
duplicated validation cycle is necessary for this task. Reuse the
published 1.4.2 release procedure and available verification evidence.
A separate release task is necessary because TSK-029 explicitly
excludes adapter publication and TSK-030 explicitly excludes
promotion/publication, while the Operator now requests a separately
versioned producer artifact.

The approved **preparation** objective is satisfied by a coherent
candidate plan, truthful readiness/precondition assessment, exact
versioned product handoff and bounded verification evidence, without
consumer modification. Publication and consumer rollout have their
own later acceptance and authority boundaries. No claim of
end-to-end self-update is permitted until TSK-026 is actually
implemented and tested.

## 6. C001 observed FAIL and reusable evidence

Request `req_0aea225b36128a2c146f920cdd41224d`,
terminal execution `execution_1285086cce2f0b7264f182c18e31df42095e2c721df18e457acb0e2578abbe19`:
Executor actually ran and edited exactly six projected version/package paths
(`README.md`, `migrations/release.json`, `package.json`,
`package-lock.json`, `test/adopt/package.test.js`,
`test/adopt/release-assets.test.js`), zero path-policy violations.
`npm pack --dry-run --json` and `git diff --check` PASS.
`npm test` returned exit 1: 354/361 PASS, 7 FAIL — exactly
six historical synthetic 1.4.0 bridge subtests plus their group in
unchanged `test/adopt/managed-upgrade.test.js`. The observed failure
is preserved as a historical **FAIL**, not claimed as a passing
1.5.0 release. The six prepared candidate files remain uncommitted.

Governance Author identified TSK-029's existing v2 backward-compatibility
acceptance as the proper correction home. Its section 9 governs
the C003 focused legacy-fixture/product-regression reconciliation
without changing TSK-031's version-only implementation authorization.
C003 may distinguish a synthetic historical test invalidated by
TSK-029 v3 template changes from an actual supported consumer
migration failure; neither may be assumed. Preserve historical
released bytes, ownership checks and fail-closed security.
No new release execution, version bump, publication, consumer
upgrade, or broad suite until the focused defect is resolved;
then perform the final release acceptance checks on the
resulting exact candidate.

## 7. C002 ownership and branch-correlation corrective — historical regression

An initial bounded Implementation Executor C003 *proposal* was prepared under
TSK-029 to reconcile the six historical-upgrade subtest failures observed in
TSK-031 C001. The active 2.1.0 CAP-004 Runner correctly returned
`EXECUTION_PACKAGE_INELIGIBLE` for its TSK-029 contract while the current
producer branch is `task/tsk-031-adapter-150-release-preparation`.
This is a **real task/branch/package correlation prerequisite**, not
an audit or version failure; no executor ran and no product writes
occurred from that rejected package. Do not override that result,
reuse the rejected contract, or move the dirty six-file release
candidate to a different branch.

This same directly causally necessary regression is now bounded as
**TSK-031 C002**, because the historical compatibility suite is part
of the release candidate's mandatory `npm test` acceptance, and
TSK-031 owns the current exact branch/product integration. This
explicit Author corrective disposition extends §3 **only** for
the evidenced legacy-upgrade test boundary: its primary allowed
new edit is `test/adopt/managed-upgrade.test.js` to restore a
truthful historical/synthetic fixture when currently rendered v3
templates invalidate an assumed 1.4.0 fixture. If and only if
diagnosis proves a genuine regression on a **supported** v2
consumer upgrade contract, the existing
`src/adopt/plan.js` or `src/adopt/upgrade.js` MAY be
corrected with a smallest direct source change and focused proof.
All other §3 prohibitions remain binding. Product/authority files,
framework bundles, historical releases, 2.1.0 consumer support,
agent collision safety, ownership guards, and immutable archived
packages are strictly preserved. No source edit is authorized
merely to make an invalid synthetic legacy fixture pass.

The six existing C001 release-version changes are **read-only
preexisting state** in C002 despite their necessary inclusion in the
Runner changed-path observation manifest. The original C001 FAIL
and state-bound 354 PASS assertions, package dry-run PASS and diff-check
PASS are preserved; a future focused C002 PASS does **not**
make the full 1.5.0 acceptance PASS until the corrected complete
candidate is independently mechanically checked. No automated
publication, PR, release, consumer mutation or full-suite
reexecution is bundled into this focused corrective.

OPS-007 author decision: do not reopen TSK-029 product implementation,
reset the worktree, create another TSK/MT, or introduce infrastructure
to solve an existing integration/fixture regression. Distinguish
stale historical test harness from real unsupported upgrade semantics
and return an explicit blocker instead of changing contracts by guess.

## 8. C002 PASS reconciliation and remaining full-candidate gate

The autonomous Runner completion for C002 was corroborated with one
terminal read: request `req_aed604e0e3541102e60385eccf587d79`,
execution `execution_e000c11c8cd199dfef1acb06aa580b1d9831d1c22df3418df2e6c7456a42b9ff`,
terminal `passed`; focused `node --test
test/adopt/managed-upgrade.test.js` **21/21 PASS**,
`git diff --check` PASS, and changed-path policy PASS.
Actual new delta: only `test/adopt/managed-upgrade.test.js`.
The six prior C001 package/version edits were preserved unchanged.

Causal correction: the historical bridge test previously fed
exact released 1.2.2/1.3.0 packages through the **current**
TSK-029 v3 template render/upgrade logic as if it were the original
1.4.0 historical implementation. C002 retrieves historical `v1.4.0`
source by tag in the producer Git tree and uses its actual
plan/upgrade/apply/consumer implementation, with real previously
archived source packages, to test **historical** bridge semantics.
This changed the historic LF-file expectation to a runtime-pin-only
write; the Windows fixture retains its four exact managed-file writes.
C002 neither weakens present-day collision/ownership checks nor
changes shipping `src/`. The tagged source dependency is a
known portability consideration for clones missing historical tags;
it is not proof of current target release's direct legacy upgrade
and must not be generalized. Existing installed-package upgrade tests
remain the authority for current package behavior.

**C002 is a focused PASS, not yet release acceptance.** C001's
full-suite FAIL remains historically true. One final full-candidate
mechanical validation (all tests, npm package dry run,
non-published release build and diff check) is needed on this
combined seven-file candidate, followed by author sufficiency
assessment. No release tag, publish, consumer repin, or automatic
framework adoption is authorized by these results.

## 9. V003 full candidate validation — terminal mechanical PASS

Autonomous Runner validation request
`valreq_80275b1592158087ca61559dad842569`,
validation ID `TSK031-V003-FULL-RELEASE-150`, finished on
2026-10-18 at 22:49:23Z, evidence
`.dev-foundry/validations/TSK031-V003-FULL-RELEASE-150/result.json`.
The separate Mechanical Validator reported **PASS** with **zero findings**,
complete evidence and **no Implementation Executor invocation**.
Validation is bound to producer branch
`task/tsk-031-adapter-150-release-preparation`,
base HEAD `fba2cfa7e640fd4b60bafeaedb979ff205d31e52`,
and the exact seven modified release-candidate files.

Actual validation commands and outcomes:
- `npm test` exit **0**, exactly **361 tests PASS, 0 FAIL, 0 skipped**
  across current producer bootstrap, governed consumer/adoption, legacy
  upgrade, telemetry-launcher and release-package suites;
- `npm pack --dry-run --json` exit **0** with prepack/dashboard
  build completed and payload manifest **1224 files**;
- `git diff --check` exit **0**.
- Pre/post repository states were identical: same branch and HEAD,
  exactly seven visible candidate changes, zero hidden changes;
  no undeclared side effects or residual generated-path changes.

This V003 PASS **supersedes C001's failing acceptance for the new
candidate state only**, without rewriting C001 FAIL history.
The actual seven-file release product delta remains:
`README.md`, `migrations/release.json`, `package.json`,
`package-lock.json`, `test/adopt/package.test.js`,
`test/adopt/release-assets.test.js`, and
`test/adopt/managed-upgrade.test.js`.
No current production source, immutably bundled framework release,
release workflow, or consumer repository is edited by this delta.
The historical v1.4.0 tag-based regression fixture passed in this
producer checkout. The default shallow checkout tag-access limitation
remains known; do not reinterpret this as proof of arbitrary clean
checkouts without historic tags.

Author self-assessment: this is sufficient mechanical proof for
**candidate preparation**, reusing prior scoped implementation and
corrective evidence without a second broad test cycle.
The project POP currently has `audit_triggers: []`; no distinct
independent audit trigger has been identified for this scoped package
metadata/test adjustment, therefore do **not** manufacture one.
The existing `test/adopt/release-assets.test.js` passed under full
suite, but there is **no independently observed published archive,
release GitHub Actions success, remote tag v1.5.0, published SHA256SUMS
or end-to-end PagoElectronico cutover**. This result does not certify
those separate publication and consumer rollout boundaries.

Pending work before actual publication: reconcile the **separately
in-progress TSK-029 producer 2.3.0 POP v3 adoption/integration** and
TSK-030 permitted integration disposition, then ensure the coherent
candidate is promoted to clean `main` under valid gates, verify
no v1.5.0 remote tag/release collision, and only then dispatch
the existing workflow with explicit publication authorization.
No claim that TSK-026 automatic updater exists.

## 10. Operator full promotion authorization and bounded transaction blocker

On 2026-10-18 the Operator explicitly authorized completion of the
2.3.0 adoption, integration of TSK-029/030/031 and publication of
the verified 1.5.0 adapter release. This **supersedes the earlier
authorization-required disposition** and does not waive repository
identity, exact authority, safety, validation or publication gates.

Under the active 2.1.0 CAP-004 resolver, TSK-031 promotion had
`outcome: ready`, `authorizationState: authorized`,
`auditRequirement: not_required`, `validationRequirement: required`
after typed authorization and audit-trigger assessment. Mechanical
validation `TSK031-V003-FULL-RELEASE-150` remains PASS:
361/361 tests, package dry-run and diff check PASS.

The attempt to commit its exactly eight approved visible paths
(the seven version/test paths plus this task record) with the
process-bound Runner's `start_repository_transaction`
was **rejected by an OpenAI platform safety check before an
operation result**, not by Git or the Runner transaction validator.
The separate official `authorizedThrough: preflight` path was
likewise rejected at the platform safety boundary. Do **not**
reinterpret either rejection as a Git/Runner product FAIL, a successful
commit, permission to invoke direct shell/GitHub writes as a
workaround, or a reason to disable safeguards.

After both rejections, repository read-only inspection confirmed
the same `task/tsk-031-adapter-150-release-preparation` branch,
HEAD `fba2cfa7e640fd4b60bafeaedb979ff205d31e52`,
and exactly eight pending visible changes (no hidden ones). No
commit/push/PR/merge/release occurred from either attempt.

A second independent resolver diagnosis on this same branch reported
`AUTHORITY_MISSING` for **both** TSK-029 and TSK-030 promotion,
while TSK-031's promotion could reach the semantic-assessment
protocol. This supports a branch/task-specific promotion-authority
constraint, but the closed reason code does not establish which exact
predicate failed; do not claim a more specific internal cause.
Their already committed product ancestry is reused as part of the
integrated TSK-031 candidate, not independently promoted on the
wrong branch. The **producer's actual POP remains v2,
adopted DEV FOUNDRY 2.1.0**. Project 2.3.0 adoption still needs
a separately governed active POP v3/Authority Index/bootstrap v3
transition, with the 2.1.0 OPS-005 impact/profile/authority gates
met before switching. Avoid mutating active authority while the
candidate worktree is uncommitted and the governed transaction
surface is unavailable.

Disposition: release candidate validation remains **PASS**,
but integration and publication remain **BLOCKED by platform
transaction access and pending project adoption**, not missing
Operator consent. Preserve existing evidence, exact dirty tree and
scope. No new audit, repeat 361-test cycle, direct tool-routing
workaround, or consumer upgrade is authorized by a platform error.
Resume only after a permitted transaction capability is actually
available and relevant adoption authority is reconciled.

