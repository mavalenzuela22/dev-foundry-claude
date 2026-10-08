---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-024
  type: TSK
  title: Correct Governance MCP Resolver Compatibility for Brownfield Consumers
  status: IN_PROGRESS
artifactVersion: "1"
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
