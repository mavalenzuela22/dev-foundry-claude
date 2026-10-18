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
