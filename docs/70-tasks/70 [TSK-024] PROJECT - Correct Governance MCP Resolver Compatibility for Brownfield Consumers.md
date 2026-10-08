---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-024
  type: TSK
  title: Correct Governance MCP Resolver Compatibility for Brownfield Consumers
  status: IN_PROGRESS
artifactVersion: "3"
authorityScope: tsk-024-producer-governance-mcp-resolver-compatibility
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governance-mcp-brownfield-authority-index-compatibility
    - governed-resolution-historical-route-isolation
    - on-touch-v1-document-read-compatibility
    - closed-dependency-fail-closed-regression-proof
  appliesTo:
    components:
      - claude-governance-mcp-resolver
      - consumer-authority-routing
      - resolver-regression-tests
  excludes:
    - consumer-repository-modification
    - real-pagoelectronico-consumer-work
    - consumer-cutover-redesign
    - new-feature-work
    - framework-release-mutation
    - package-version-bump
    - release-or-tag-publication
    - dashboard-or-telemetry-modification
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ADR-003
    - ADR-004
    - SPC-001
    - DAT-001
    - OPS-001
    - OPS-002
    - OPS-004
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-012
    - TSK-023
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-024] PROJECT - Correct Governance MCP Resolver Compatibility for Brownfield Consumers

## 1. Operator authority and objective

On 2026-10-08 the Operator explicitly authorized creation of TSK-024 in
`dev-foundry-claude`, temporarily binding compatible Governance Author and
Implementation Executor Capability Profiles, and implementing and validating a
strictly bounded Governance MCP resolver compatibility hotfix. Consumer
repositories SHALL NOT be modified and no new version SHALL be published
before the distinct release gates have been verified.

**Single objective:** Correct `resolve_governed_operation` when a valid
DEV FOUNDRY 2.1.0 brownfield consumer Authority Index includes historical
routes and a project retains on-touch, older v1 SoT documents, without treating
history as authority or weakening the resolver's closed fail-safe controls.

## 2. Verified producer baseline and motivating evidence

- Process-bound producer `dev-foundry-claude`, clean `main`
  `f51d528a0ca7dccf2a6cf5fae42cc25e2536df80`.
- Public consumer adapter 1.4.1 reports `readyToWork: true` in the
  separate PagoElectronico consumer after a separately governed cutover,
  but a live Claude MCP `resolve_governed_operation` returned
  `AUTHORITY_INVALID` on the first `governance-author` inspection.
- Consumer reports are **diagnostic input only**, not producer test
  results, access authorization, or permission to mutate that repository.
- Current `src/governance-mcp/resolver.js` hardcodes route
  `authorityClasses` without `historical`; canonical DEV FOUNDRY 2.1.0
  DAT-020 authorizes `historical` routes, which cannot satisfy active
  authority. The resolver scans project routes and insists all Markdown SoT
  inputs use v2, while on-touch migrated brownfield projects preserve
  historical v1 documents. The consumer's TSK-041 also has an active
  `governedBy` reference to closed TSK-040; canonical DAT-008 says this
  reference must be reconciled as history by consumer governance, NOT
  silently accepted as active authority by this producer hotfix.

## 3. Exact behavior

1. Parse a conforming project index with `historical` routes without
   globally rejecting it. Preserve closed-world validation of malformed
   route metadata, duplicate route ids, unknown authority class, and
   project/framework identity mismatch.
2. Historical routes SHALL NOT satisfy selection of an active task,
   authority identity, governing reference, or taskless root. Reject a
   referenced closed/historical artifact as an active `governedBy` target.
3. A project whose POP declares `metadata_migration_mode: on-touch` may
   retain historical SoT-v1 documents. The resolver SHALL NOT require
   active v2 structure from unrelated historical or unused project routes.
   Do not silently reinterpret v1 metadata as valid v2 active authority.
   Directly applicable v1 authority requires separately reasoned contract
   semantics and fail-closed treatment unless already proven compatible.
4. Preserve DAT-001 success/failure envelope, source set ordering,
   `contextFingerprint`, role selection, activation guard,
   task-bound and taskless behavior for conforming existing consumers.
5. Keep strict `BINDING_INACTIVE`, `AUTHORITY_INVALID`,
   `ROLE_INELIGIBLE`, `STALE_CONTEXT` and other existing failure
   distinctions. No fake PASS, hidden fallback, or broad permissive parse.

## 4. Implementer boundary, workload fit and exclusions

The approved Implementation Executor is
`process-bound-runner-code-executor`, temporarily bound to
`.dev-foundry/profiles/capability-profiles/implementation-executor-tsk024-resolver-hotfix-v1.yaml`.
The objective is one coherent resolver subsystem, no open architecture
decision, no external integration, and no consumer writes: **fit PASS**
for a single atomic task, conditional on exact contract/path validation.

The exact allowed product and proof surface is:

- `src/governance-mcp/resolver.js`
- `test/governance-mcp/resolver.test.js`
- `test/governance-mcp/fixture.js`
- `test/governance-mcp/server.test.js`

Only directly needed changes from that list are allowed. The executor
MUST NOT modify `.dev-foundry/`, `docs/`, `package.json`,
`package-lock.json`, `src/adopt/`, immutable framework files,
`bin/`, `templates/`, GitHub workflows, release tooling, any external
consumer repository, or unrelated product code.

## 5. Evidence and gates

- Write focused tests for a mix of active v2 task + valid historical route
  + unrelated v1 document, proving successful role resolution with exact
  authority references and no privilege leak.
- Negative tests: historically routed task cannot authorize implementation,
  direct governing reference to CLOSED task is refused, malformed route
  and active authority cannot be reclassified as history to bypass guards,
  and existing valid fixtures remain stable.
- Run focused governance-MCP tests and complete producer `npm test`,
  then `git diff --check`; preserve all failures honestly. Optional
  package dry-run remains read-only and is not a release.
- Governance Author reconciles exact changed-path projection and semantic
  self-assessment. Independent Governance Audit occurs only if triggered
  under OPS-004 and OPS-003; an author cannot self-issue that verdict.
- No push, PR, merge, release, consumer update, or 1.4.2 claim in the
  current implementation/validation authorization. All require separate
  verified gates and authorization.

## 6. Terminal boundary for this operation

A validated, task-scoped producer code candidate with truthful mechanical
evidence and cleanly separated governance and executor work is the maximal
outcome of this authorization. Live PagoElectronico role-resolution PASS
requires its separately authorized consumer reconciliation and exact verified
release installation; do not claim it as achieved by synthetic tests.

## 7. V001 terminal failure and proportionate V002 corrective (2026-10-08)

The V001 execution `execution_2bf63eb4a46d6aa19aec2e425746b69e799e98db415fb57d9fa419221a8f0383`
has terminal `VALIDATION_FAILED`; the executor exited 0, its four
authorized source/test paths passed path policy, targeted resolver/server
tests were 32/32 PASS, full `npm test` was 320/323 PASS, and
`git diff --check` was PASS. The full suite's three failures are:

- `test/adopt/state.test.js` asserts that `resolver.js` is byte-identical
  to HEAD, a TSK-012-style no-resolver-mutation guard no longer valid for
  this authorized resolver corrective. Preserve the guard-on/off behavior
  proof and fail-closed behavior instead of suppressing the test.
- `test/bootstrap/claude-cutover-readiness.test.js` rejects the temporary
  TSK-024 executor profile because its required producer-maintenance
  `hosting_purpose` and `execution_provider` facts are missing. Correct
  the new profile version; retain both assertions and separation controls.
- The same bootstrap test hardcodes the retired V3 capability ID in the
  bootstrap text. Assert the actual active POP-bound, routed executor
  identity instead of a retired particular version; do not substitute a
  false legacy profile into active authority.

During the executor's own exploratory `npm pack --dry-run` work, a
`prepack` failure was reported without a proven root cause. The
`npm test` run nonetheless succeeded at several prepack/build/asset
subtests. V002 must explicitly run one `npm pack --dry-run --json`
diagnostic. A reproducible failure is a new finding to diagnose; neither
a package-build source change nor removal of a prepack safety check is
preauthorized by this corrective.

This is a directly causal **test/proof projection reconciliation within
the same TSK-024 objective**, not authorization of an independent
feature, consumer mutation, publication, or change to DEV FOUNDRY 2.1.0.
The minimal expanded executor projection adds only:

- `test/adopt/state.test.js`
- `test/bootstrap/claude-cutover-readiness.test.js`

to the original four source/test paths. The TSK-024 executor profile V2
corrects the two missing implementation facts and extends the allowed
six-path projection. The POP and Authority Index select/rout the V2
profile, while the V1 profile remains non-required history.

V002 MUST preserve the four V001 source/test changes, avoid redoing
discovery, target precisely the three regression causes, prove relevant
safety invariants, run focused tests, the full `npm test`, `npm pack
--dry-run --json` and `git diff --check`. No commit, push, PR, merge,
package/version bump, release, or consumer changes are authorized for
the executor. A remaining test failure must be attributed and reported
rather than masked to satisfy PASS.

## 8. V002 terminal PASS and authorized promotion (2026-10-08)

Following V002, the Operator separately authorized completing TSK-024's
validation, product commit and repository promotion, with any 1.4.2 package
release still conditional on distinct verified gates. That later grant
supersedes only the earlier phase prohibition on commit, push, PR and
merge/integration; it does not change the product boundary, release/package
version, target consumers, or immutable methodology.

The governed V002 execution
`execution_a0db0b093a7de7e4734b52d8b6a20dd68c090c17bc06034f21a45fa976c3d7b8`
terminated **PASS**. Executor exit 0; path policy PASS; focused tests
52/52 PASS; `npm test` 323/323 PASS; `npm pack --dry-run --json`
PASS; `git diff --check` PASS; post-execution governed validation PASS.
V002 changed only the two additional projected test paths, preserving
the V001 four-path resolver candidate.

Exact composite product/test delta for candidate commit:

- `src/governance-mcp/resolver.js`
- `test/adopt/state.test.js`
- `test/bootstrap/claude-cutover-readiness.test.js`
- `test/governance-mcp/fixture.js`
- `test/governance-mcp/resolver.test.js`
- `test/governance-mcp/server.test.js`

**Governance Author semantic self-assessment:** The delta reuses
existing resolver and test infrastructure; it accepts DAT-020
`historical` routes solely as index metadata, excludes them from
active authority resolution, discovers identities of unrelated on-touch
v1 artifacts without promoting their schema to v2, and retains refusal
for malformed, closed or active-but-inapplicable governing sources.
The diff adds focused negative tests and preserves exact legacy
fingerprint fixtures. The former HEAD-identity test is replaced with
stronger observed guard/resolver parity tests, and bootstrap assertions
remain bound to the active runner identity and security restrictions.
No new dependency, public API, consumer/product feature, framework
mutation or release version delta is introduced. The two V002 test
paths were explicitly reconciled in §7 before executor execution.
No material unresolved defect is currently observed.

**Audit trigger disposition:** Under adopted OPS-004 §6, POP
`audit_triggers: []`, and TSK-024's conditional audit clause, no
independent Governance Audit is currently triggered by this bounded
product correction. Author self-assessment does not claim an
independent audit verdict; any later material authority/security
expansion would require renewed trigger evaluation.

Promotion is limited to a verified task-branch commit, push,
pull request to `main`, merge/integration, and reconciliation/
cleanup after state and approval gates. No version bump, release/tag,
workflow dispatch, package publication, consumer repository
mutation or claimed live PagoElectronico resolver PASS is authorized.
