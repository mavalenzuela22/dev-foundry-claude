---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-029
  type: TSK
  title: Adopt DEV FOUNDRY 2.3.0 and Align Claude Governed Roles and Skill
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-029-framework-230-skill-claude-role-adoption
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-project-adoption-of-dev-foundry-2-3-0
    - claude-native-governed-operation-skill-alignment
    - effective-role-handoff-and-minimal-sot-delivery
  appliesTo:
    components:
      - producer-framework-integrity-and-adoption
      - project-pop-v3-authority-index-bootstrap-and-actor-binding
      - claude-adapter-mini-mcp-runtime-and-integration
      - claude-author-executor-auditor-guidance-and-evidence
      - targeted-product-and-adoption-regressions
  excludes:
    - mutation-of-upstream-dev-foundry-canonical-release
    - mutation-of-immutable-2-1-0-or-2-2-0-methodology
    - mutation-of-consumer-repositories-including-pagoelectronico
    - automatic-adapter-release-publication-or-consumer-repin
    - foundry-runner-product-mutation-or-alternate-repository-runner-dependency
    - retrospective-rewriting-of-tsk-028-execution-evidence
    - duplicate-audits-or-new-infrastructure-without-mandatory-cause
authority:
  governedBy:
    - ADR-001
    - ADR-003
    - ADR-004
    - ARC-001
    - SPC-001
    - SPC-003
    - SPC-008
    - DAT-001
    - DAT-002
    - OPS-001
    - OPS-003
    - OPS-004
    - OPS-005
    - OPS-006
    - OPS-007
    - OPS-008
  supersedes:
    - TSK-028
traceability:
  derivedFrom:
    - TSK-027
    - TSK-028
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-029] PROJECT - Adopt DEV FOUNDRY 2.3.0 and Align Claude Governed Roles and Skill

## 1. Operator direction and current authority

On 2026-10-17 the Operator explicitly superseded TSK-028's **unfinished**
DEV FOUNDRY 2.2.0 adoption in favor of one governed **2.3.0** adoption and
a focused review of the **currently installed ChatGPT `dev-foundry/governed-operation`
Skill** to adapt its useful behavior to `dev-foundry-claude`. Preserve TSK-028
as historical evidence: its A1 request failed before Codex invocation with
`EXECUTOR_UNAVAILABLE` (invalid process-bound model-selection profile
reference), changed zero product files, and established no implementation PASS.
No 2.2.0 adoption, valid executor result, audit PASS, or publication is inherited
by TSK-029.

This task is created under the **currently adopted DEV FOUNDRY 2.1.0** SoT,
which remains normative until an explicit governed 2.3.0 adoption. Do not
silently reinterpret the old POP v2 binding, evidence, contracts or task outcomes
as POP v3. TSK-028's target and any old A1 contract are historical only and
must not be reused as live execution authorization.

## 2. Confirmed source and impact

Read-only access to the separate process-bound **normal Runner** verified
the upstream repository `dev-foundry`, currently `main` at
`4b1d1ac210357585e3d4f4d098f417fb94387aca`, with clean worktree and
active POP adoption 2.3.0. The upstream release is canonical and includes:

- `.dev-foundry/releases/2.3.0/release-integrity-manifest.yaml`:
  SHA-256 `cd06bf6ac4f57462598b9fe63a61779ca8f712a88b210f6d1444bd12426d12e8`.
- `.dev-foundry/releases/2.3.0/authority-index.yaml`:
  SHA-256 `ae322e07ad4a7aba76b6c241d5238fd29034b083006cdd69f20d3d4c36f4d998`.
- Source candidate: `DF-CANDIDATE-005`; canonical parent 2.2.0.
- **24/24** manifest-listed source SHA-256 files independently re-read and
  matched using the upstream Runner (8+8+8); reuse that verified provenance
  rather than repeating the same proof without changed state.

Version 2.3.0 preserves POP v3 operation-scoped role/implementation selection
and DAT-022 INT-001..005 interoperability from 2.2.0. Its material distinction
includes **Governance Author v4**, OPS-007 necessity/no-change/reuse and
OPS-004 §6's **independent audit only on an actual mandatory external, project,
material-separation or explicit Operator trigger**; OPS-005 §8 does not
require an independent audit for canonical framework promotion by default.
No model/provider/tool/self-assessment label is independent audit evidence.

The installed ChatGPT Skill now explicitly supports 2.1.0, 2.2.0 and 2.3.0
and supplies version-specific operational maps/kernel rules and contextual
routing. Its useful operational additions must be reviewed against the
adopted repository's actual authority and Claude Code runtime, including:
exact source-directed SoT and typed-assessment minimality; `TASK_NOT_FOUND`
versus unsupported task-schema recovery; specific diagnostics; operation-scoped
capability/role authorization; audit independence by actual participation;
frozen findings and objective documentary closure; validation/evidence reuse;
asynchronous no-poll behavior; and OPS-007 proportionality. ChatGPT's
process-bound Runner APIs, events and session state are **not** installed in
consumer Claude Code and must **not** be copied as dependencies.

## 3. Acceptance is useful product delivery, not paperwork

**Governance Author** resolves exactly the material authority needed; handles
valid caller mistakes with one actionable correction, genuinely unsupported
task representations through verifiable bounded source recovery without
bypassing supported closed gates; distinguishes missing authority from
unsupported tool surfaces; decides scope, authorization and role before
delegating; never re-reads every SoT document or loops on the mini MCP.

**Implementation Executor** receives one approved objective, limited paths,
hard exclusions, direct SoT references and focused tests, **actually changes
the authorized product**, performs minimal self-verification, and returns
changed paths, state and causal proof. A Runner transport PASS or empty patch
is not a product implementation PASS. No broad repository reading, re-governance,
foreign Runner calls or automatic scope expansion.

**Governance Auditor**, only when actually triggered, independently examines
the exact material subject and trustworthy prior participation; no new
attestation service, no assumption that a different session/model automatically
proves eligibility, no fresh audit for a merely objective documentary correction
when frozen closure predicates can be verified against original durable lineage.
Unresolved independent semantic judgment receives only an eligible bounded
review. Preserve original audit history and findings.

**Shared acceptance**: preserve existing two-tool stdio mini MCP, supported
DAT-001/DAT-002 response semantics, read-only diagnostics and host-authorization
boundary; keep consumer Claude independent of Foundry Runner; minimize prompt
and SoT volume using source paths/section IDs/hashes, not replicated methodology;
use existing role templates, tests and telemetry wherever adequate rather
than adding new services/profiles/permanent ceremonies. Existing consumer
2.1.0 pins, published adapter 1.4.2, immutable 2.1.0 files and historical
TSK-028 evidence must not be reinterpreted or mutated.

## 4. Minimal delivery sequence

1. Establish the full **2.1.0 → 2.3.0** normative delta, especially the
   2.2.0 interoperability changes and the 2.3.0 audit/Author changes.
   Verify source provenance; copy the exact canonical 2.3.0 release artifacts,
   not 2.2.0, into a separate immutable producer tree. Never flip adoption
   pointers until required manifest/bytes are complete and verified.
2. Reconcile the affected project POP to `dev-foundry.project-operating-profile.v3`,
   the index to adopted 2.3.0, and the needed bootstrap to v3. Bind
   `governance-author-v4.yaml`; retain other unchanged Actor Profiles at
   their canonical 2.3.0 paths. Carry historical concrete v2 implementation
   facts as separate scoped selection evidence, not permanent POP allowlists.
   Preserve process-bound executor/mechanical-validator eligibility.
3. Use a **minimal governed implementation handoff** for the exact consumer
   product impact: v3 schema support in `src/governance-mcp/resolver.js`,
   startup/activation/session projections, product-facing role templates and
   local mini MCP descriptions, focused regressions, and packaged framework
   identity as actually required. Preserve 2.1.0 compatibility where existing
   consumers require it; never let an incomplete v3 migration return false
   `READY` or authorize execution.
4. Verify substantive product changes with focused tests and independently
   valid mechanical evidence. Complete Governance Author semantic
   self-assessment and evaluate **actual** audit triggers; do not demand a
   fresh auditor without a mandatory source. Reconcile actual resulting paths.
5. Govern a single authorized promotion to `main` and close TSK-029 on
   acceptance. Release publication/version bump and consumer adoption remain
   separate, non-automatic boundaries.

No MT or separate corrective is required merely because version 2.2.0 was
superseded, an old execution failed before dispatch, or a new Skill exists.
New prerequisites, checks, implementation phases or artifacts require
a concrete necessary source and material consequence.

## 5. Failure classification and stop boundaries

A tool/transport/model-selection failure is not a product FAIL. Recover
a prior terminal no-effect execution only after confirming immutable state and
actual available execution capability. Do not repeatedly launch a known
unavailable executor, bypass eligibility with another tool, reinterpret
required independent audits as self-review, adopt incomplete authority,
alter upstream/consumer repositories, or publish the adapter automatically.
Report the exact remaining prerequisite when one cannot be satisfied
with existing authorized capabilities.
