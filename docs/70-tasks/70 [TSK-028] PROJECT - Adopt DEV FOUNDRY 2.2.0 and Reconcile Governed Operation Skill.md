---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-028
  type: TSK
  title: Adopt DEV FOUNDRY 2.2.0 and Reconcile Governed Operation Skill
  status: SUPERSEDED
artifactVersion: "2"
authorityScope: tsk-028-framework-220-and-governed-operation-skill-adoption
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-project-adoption-of-dev-foundry-2-2-0
    - claude-adapter-compatibility-with-governed-operation-skill
  appliesTo:
    components:
      - producer-framework-adoption-and-integrity
      - producer-pop-authority-index-platform-bootstrap-and-actor-bindings
      - claude-adapter-governance-mcp-and-bootstrap
      - packaged-framework-and-governed-role-templates
  excludes:
    - mutation-of-dev-foundry-canonical-upstream-release
    - reinterpretation-or-mutation-of-completed-2-1-0-evidence
    - mutation-of-pagoelectronico-or-any-consumer-repository
    - automatic-adapter-version-bump-tag-publication-or-consumer-repin
    - foundry-runner-product-or-foreign-repository-mutation
    - migration-to-unverified-methodology
    - new-runner-dependency-inside-consumer-claude-code
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
  supersedes: []
traceability:
  derivedFrom:
    - TSK-027
lifecycle:
  phase: superseded
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-028] PROJECT - Adopt DEV FOUNDRY 2.2.0 and Reconcile Governed Operation Skill

**HISTORICAL — SUPERSEDED by TSK-029 (2026-10-17).** The Operator retired this unfinished 2.2.0 adoption in favor of a direct 2.3.0 adoption. No 2.2.0 adoption, A1 product implementation or audit PASS was achieved. The original request, decisions, diagnostic findings, terminal no-effect Codex dispatch failure and commits remain historical facts, not open gates or active work. TSK-029 is the only active successor for this objective.

## 1. Operator objective and current authority

On 2026-10-13 the Operator directed adoption of DEV FOUNDRY **2.2.0** into
`dev-foundry-claude` together with the fundamental changes in the installed
`dev-foundry/governed-operation` Skill. This task is created under the
currently adopted **DEV FOUNDRY 2.1.0** release and its OPS-005 compatibility
and explicit-adoption requirements. The target version and Skill are
**candidate inputs, not current normative authority**, until their verified
provenance, complete material delta, compatibility, and governed adoption are
established. Current producer `main` at task creation:
`6cc71ae0e719af2173a6944e5acea31ec855a1fb`, clean. TSK-027 is CLOSED.

## 2. Observed facts and provenance gap (initial read-only analysis)

- The active producer POP and Authority Index route exclusively to immutable
  `.dev-foundry/releases/2.1.0`. The producer's
  `.dev-foundry/releases` directory currently contains only `2.1.0`; the
  exact 2.2.0 canonical index and release-integrity manifest are **not yet
  present**. This is **not** evidence that an upstream 2.2.0 release is absent.
- The installed `dev-foundry/governed-operation` Skill available to this
  ChatGPT producer session expressly supports **2.1.0** and declares its
  bundled 2.1.0 operational map/kernel-rules as guidance, not higher
  methodology authority. Its current additions describe (a) safe treatment of
  resolver `TASK_NOT_FOUND` for an existing but unsupported operational task
  representation, and (b) auditor independence from actual material
  participation, not from a fresh session or new infrastructure alone.
  Review its **entire current content and bundled references**, not only those
  two observations.
- The Claude Code consumer does **not** have the producer's Foundry Runner.
  Its mini MCP has only `resolve_governed_operation` and
  `assess_predelegation_readiness`; `src/governance-mcp/resolver.js`
  currently requires a unique project-index task route. Its bootstrap,
  `CLAUDE.md` managed block and auditor subagent template have not yet been
  compared to verified 2.2.0 methodology.
- `framework/dev-foundry-2.1.0.bundle.json` and `package.json` currently
  bind the packaged framework to 2.1.0; published adapter 1.4.2 remains
  immutable and distinct from this producer methodology adoption.

## 3. Smallest necessary governed boundary

1. **Acquire and authenticate the exact immutable 2.2.0 upstream release.**
   Verify its canonical authority index, manifest, identity/integrity and
   availability of required Actor Profiles and contracts. Stage/reconcile a
   distinct release tree without changing immutable 2.1.0. Until this is
   possible, **do not modify the POP adoption pointer or implement predicted
   2.2.0 behavior**.
2. **Classify the complete 2.1.0 → 2.2.0 semantic delta**, using the actual
   canonical sources, not release naming or the installed Skill alone. Identify
   mandatory versus optional impacts to task models, authority resolution,
   role eligibility, audit independence, evidence, lifecycle, SoT metadata,
   security and historical compatibility.
3. **Review all updated Skill instructions/references** and translate only
   transferable behavior to the actual Claude Code runtime. Distinguish
   runner-specific `TASK_NOT_FOUND`, typed resolver assessments and
   asynchronous Runner orchestration from consumer mini MCP behavior.
   An unsupported operational task MUST NOT become an unrestricted filesystem
   search, fabricated authorization, bypass of an applicable supported gate or
   new mandatory runner dependency. Assess material auditor participation using
   verifiable actual work, applicable independence rules and eligible
   corroboration; neither a new session nor a new identity registry alone
   determines independence.
4. **Reconcile only affected project bindings**: POP, Authority Index,
   Platform Bootstrap, Actor/Capability Profiles, relevant product authority,
   packaged framework identity, mini MCP tool descriptions/errors, native
   Claude Code role/auditor templates, and targeted regressions. Preserve
   source-bound authority, activation and permission guards, existing
   DAT-001/DAT-002 wire semantics unless the verified 2.2.0 delta actually
   requires changes, and historical 2.1.0 evidence.
5. **Prove the exact resulting candidate** with focused regressions and
   required independent mechanical validation, semantic sufficiency assessment,
   applicable audit-trigger evaluation, explicit adoption/promotional decisions,
   and one governed source promotion. No benchmark, repeated audit, new task,
   provider change, attestation machinery, or repeated validation is required
   without a concrete mandatory need.

## 4. Acceptance and stop conditions

Acceptance requires:
- verified 2.2.0 canonical release identity, manifest/integrity, adopted
  version and valid authority routes;
- a traceable complete semantic delta and explicit decisions for every
  materially applicable change;
- consumer Claude Code guidance that remains truthful, actionable and
  Runner-independent, preserving role separation and actual independence;
- existing consumers/pins, 1.4.2 published assets, closed tasks, evidence and
  immutable 2.1.0 bytes remain unchanged;
- minimal actual changed-path manifest, focused product/authority regression
  proof, independently verified applicable mechanical results, and a clean
  governed promotion to `main` when authorized.

Stop on missing or unverified 2.2.0 source/integrity, contradictory current
authority, incompatible binding or schema, unapproved consumer mutation,
unresolved required Operator decision, or a material feature beyond this
coherent adoption objective. Do not reclassify candidate methodology or Skill
guidance as currently adopted authority merely to make a tool return READY.

## 5. Delivery and exclusions

This TSK authorizes investigation and the smallest coherent adopted-producer
compatibility change only after the source and applicable authority are
verified. It does **not** authorize publishing a new adapter release, updating
PagoElectronico, touching a consumer repository, modifying Foundry Runner,
or modifying the canonical upstream methodology. Those are separately governed
boundaries. An MTP or extra artifact is required only if a demonstrated
independent material boundary cannot be managed within this TSK.

## 6. Canonical 2.2.0 source verification and initial impact review

The Operator identified the separate, process-bound **normal Foundry Runner**
connected to the upstream `dev-foundry` repository as the canonical source
access path. Read-only observation confirmed upstream `dev-foundry`,
`main` at `ce4f34c966228317dd6a7b0eac5f0b388526f13e`, clean.
The upstream active POP remains adopted at 2.1.0, but its immutable canonical
`.dev-foundry/releases/2.2.0` release is present, distinct and independently
verifiable. Upstream was **not modified**.

- Canonical index:
  `.dev-foundry/releases/2.2.0/authority-index.yaml`,
  SHA-256 `8eaa89531c87ed5572d346a32a7229edf56a0905df2da212e42cf1426d13716f`.
- Canonical release manifest:
  `.dev-foundry/releases/2.2.0/release-integrity-manifest.yaml`,
  SHA-256 `9e79fc7bdf883d2d1cd2e53cf3787ba4350bf2681e6cd6d1fbd2c284fadded46`.
  Source candidate `DF-CANDIDATE-004`; immediately preceding release 2.1.0.
- The upstream Runner independently read **all 24/24 manifest-listed release
  artifacts** and confirmed every file's full SHA-256 matches the manifest.
  The immediately previous 2.1.0 manifest lists 21 artifacts. Compared by
  equivalent version-neutral path, **16 are modified, 3 newly added and 5
  unchanged**. The five unchanged bytes are exactly the existing Actor Profiles
  (Author v3, Executor v2, Mechanical Validator v2, Auditor v2 and
  Evidence Custodian v1).
- Three additions: `DAT-022` cross-platform interoperability semantics,
  `DF-INTEROP-001.yaml` provider-neutral machine contract, and
  `CT-001-015.yaml` containing **15 fixtures**, explicitly
  `fixtures_only_not_executed`. The fixtures are **not** proof of executed
  conformance or independent real-world audit.

**Observed central normative impact:** `DAT-016` 2.2.0 defines
`project-operating-profile.v3` role bindings as `profile`,
`selection: {mode: operation-scoped, required_capabilities, eligibility_policy}`,
and `status`, with **no** fixed implementation/provider/model/platform in the
role binding. `platform-bootstrap.v3` permits secure bootstrap discovery without
treating a platform as an exclusive role grant. `DAT-022` and OPS-009 require
operation-scoped selection, capability and authorization proof; POP v2's concrete
implementation becomes an initial selection candidate, not a permanent allowlist.
The adoption **must migrate the active POP role-binding shape to v3** while
preserving predecessor semantics and historical evidence. Reconcile repository
bootstrap v3 where needed; do not assume all bootstrap records need replacing.

**Other verified normative effects:** `OPS-004` 2.2.0 permits objective
closure of frozen documentary audit findings through verifiable state-bound
proof without automatically demanding a second independent auditor, while
preserving the original independent audit FAIL and requiring a bounded independent
semantic review when new judgment is genuinely needed. Independence is assessed
from actual participation, not session freshness or platform labels.
`DF-INTEROP-001` distinguishes structured failure diagnosis, READY/BLOCKED/
INDETERMINATE pre-dispatch assessment, separated transport/implementation/
acceptance/validation/audit outcomes, and cross-platform continuation. Never
mistake these field/fixture contracts for authorization or automatic execution.

**Skill/Claude Code impact:** the installed `dev-foundry/governed-operation`
skill still explicitly names 2.1.0 and uses a producer Runner-bound resolver.
Its verified operational recovery of out-of-inventory task representations and
material-participation independence review are design inputs, **not a license**
to teach consumer Claude Code to call a missing Runner or bypass its local
resolver's existing supported gates. Adapt documented behavior through existing
Claude-native tools and the local mini MCP only insofar as verified 2.2.0
authority and consumer product contracts permit.

**Pending work:** stage the exact authenticated 2.2.0 release bytes in the
producer without altering 2.1.0; complete the file-by-file semantic compatibility
mapping for all 16 changed artifacts; prepare a source-bound implementation
handoff for POP v3, actual affected project bindings, distribution templates and
mini MCP, then validate the resulting real implementation. The 2.2.0 release
is **available and verified upstream, but not adopted locally yet**.

## 7. Operator's overriding product outcome: useful governed work at minimal cost

The Operator clarified that the **primary product objective** of
`dev-foundry-claude` is successful, economical, bounded delivery: Governance
Author resolves the right operation without opaque mini-MCP dead ends;
Implementation Executor performs the permitted mutation instead of consuming
its budget on unnecessary repository reading, invented ceremony, or unrelated
changes; Governance Auditor supplies eligible, proportional independent
judgment **only when triggered**; and each role consumes only the smallest
applicable Source of Truth and evidence slice. This is an **acceptance
interpretation of TSK-028's existing scope**, not authorization to bypass
security, audit independence, mechanical validation, or release boundaries.

The following use-cases are **outcomes to prove with the existing targeted
test/role harness wherever possible**, not a mandate to add infrastructure,
identity registries, hard-coded token limits, new agents, a third mini MCP tool,
or repeated tests:

1. **Author can decide and act.** The local `resolve_governed_operation`
   provides the exact selected project identity, role/Actor Profile, routed
   authority and actionable diagnosis. It distinguishes absent/invalid
   authority, wrong caller input, unsupported task representation, inactive
   binding, and a truly closed lifecycle gate. Recoverable cases direct one
   bounded native source check or corrected input; genuine mandatory conflicts
   fail closed with the violated prerequisite and permitted next action. It
   does not force repeat re-resolution, broad repository discovery, or a
   non-existent external Foundry Runner service.
2. **Minimal SoT, not minimal truth.** For each Author/Executor/Auditor operation,
   determine the exact needed TSK/MT, governing sections, role profile, hard
   exclusions and required evidence. Supply IDs, paths, sections and hashes
   rather than copying the complete methodology, task history, sibling MTs or
   unrelated source files into subagent prompts. Expand directed reads only
   for a demonstrated unresolved dependency. Bootstrap and skill guidance
   never become a duplicate Source of Truth or a reason to preload everything.
3. **Executor makes the authorized change.** A bounded delegation identifies
   material objective, scoped paths/effects, immutable prohibitions, applicable
   selected operation and accepted proof. The Executor uses existing Claude
   native read/edit/test tools only within that scope, performs the smallest
   sufficient focused self-check and returns changed paths, real behavior
   evidence, observed state and stop reasons. An empty/unverified implementation
   is **not** a delivery PASS. A directly necessary regression correction may
   stay in the authorized material boundary when OPS-007/OPS-008 permit and
   the causal variance is reconciled; it must not become a new TSK by habit.
4. **Auditor is independent when required, not ceremonially repetitive.**
   Keep Claude's distinct author/executor/auditor subagent roles, with the
   actual participation and eligibility assessment required by OPS-003/004.
   Separate subagents/models help role separation but **do not automatically
   prove material independence**. Initial triggered audits review the
   declared material boundary. Corrective review reuses the original verified
   audit lineage and frozen findings: objectively decidable documentary fixes
   receive attributable proof-based closure, not another fresh audit or
   implementation dispatch; a genuinely new semantic judgment gets only a
   bounded eligible independent review. A new fresh audit needs its actual
   trigger. Never convert the original `AUDIT FAIL` to `PASS` by fiat.
5. **Readiness and results are truthful.** Predelegation assessment is
   one-shot, non-authorizing, and distinguishes READY/BLOCKED/INDETERMINATE
   from semantic Operator approval. Mechanism/transport success is not
   implementation success; focused self-check is not independent Mechanical
   Validation; environmental validator failures are not product failures.
   Use `DAT-022`/INT-001..005 as the versioned contract after adoption,
   while preserving existing supported consumer wire contracts until a
   necessary compatible change is verified.
6. **Token economy is an actual product quality attribute.** Prefer one
   targeted resolution, one minimal direction/handoff, one implementation,
   reused valid mechanical evidence, one applicable audit disposition and
   one governed promotion. Use existing telemetry/test observations, when
   available, to identify repeated resolution, broad SoT reads, excessive
   subagent handoffs, empty delivery and duplicate audits. Do not invent a
   benchmark PASS or an arbitrary numeric budget; where comparative runtime
   proof is not yet available, state that limitation without blocking proven
   functional acceptance.

**Sufficiency rule:** Success is a real, nontrivial governed operation whose
Author, Executor and—when actually triggered—Auditor finish their respective
bounded work with minimum necessary context, correct artifacts and truthful
evidence. It is **not** measured by how many YAML files, contracts, policies,
checks or agents were added. Maintain the existing two-tool mini MCP unless a
specific verified contract gap makes a change strictly necessary. Preserve
source/consumer separation, protected authorization, immutable release bytes
and historical state.

## 8. Implementable compatibility boundary and lean delegation

**Current project authority during implementation remains 2.1.0.**
A 2.2.0 target is an authorized verified candidate, not active until the
complete exact source and compatible bindings are reconciled and promoted.
Previously observed upstream release bytes and SHA-256 are valid source facts;
nothing here authorizes a rewrite of upstream or previously released 1.4.2.

**Source inputs (bounded):**
- Current candidate task TSK-028 §§3–8 and applicable current producer
  ADR-001/004, ARC-001, SPC-001, DAT-001/002/016, OPS-003/004/005/007/008.
- Verified upstream 2.2.0 manifest SHA-256
  `9e79fc7bdf883d2d1cd2e53cf3787ba4350bf2681e6cd6d1fbd2c284fadded46`,
  index SHA-256
  `8eaa89531c87ed5572d346a32a7229edf56a0905df2da212e42cf1426d13716f`,
  DAT-016 SHA-256
  `9a715c90edb14babe7ae2658161735f7350feeda6b98ceef18df2aed15c51f55`,
  DAT-022 SHA-256
  `27be0e9fcb4fc9c422305c45876403a1bf48b1095eadc88d10d0978e86b83840`,
  interoperability machine contract SHA-256
  `ccd8f5cf647f7823c1a4224ea0fe58cbd096ee02712dcd580c923eeefe7e05eb`.
  Those files are read-only through the upstream normal Runner; references
  alone are not equivalent to staged bytes in the producer.
- The existing `dev-foundry/governed-operation` installed Skill is 2.1.0-only,
  informative for the requested behavior; it is not 2.2.0 authority.

**Producer adoption:**
- Copy the 2.2.0 canonical release byte-for-byte into the distinct producer
  `.dev-foundry/releases/2.2.0` tree, verify every manifest path and SHA-256,
  and preserve `.dev-foundry/releases/2.1.0` untouched. Do not flip the
  active POP/Authority Index on the basis of an incomplete or unverified copy.
- Apply the DAT-016 v3 POP closed schema exactly: stable project role keys
  each with `profile`, `selection: { mode: operation-scoped,
  required_capabilities: [...], eligibility_policy: ... }`, `status`;
  no concrete implementation identity or platform allowlist in role bindings.
  Carry real present producer implementations/profiles forward as
  operation-selection candidates/evidence, not as v3 role metadata.
  Preserve applicable security and operator-fit policy, not necessarily
  new project Capability Profile versions.
- The project Platform Bootstrap may migrate to v3 as necessary, remaining
  startup guidance only; the ChatGPT producer still uses its own bound Runner
  while the Claude Code consumer has **no Runner**. Repo source and project
  bootstrap derivatives must remain consistent.

**Claude product compatibility:**
- Inspect only affected `src/governance-mcp/resolver.js`,
  `src/governance-mcp/readiness-mcp.js`,
  `src/governance-mcp/session.js`, `src/adopt/activation.js`,
  `src/governance-mcp/server.js`, the corresponding test fixtures/tests and
  consumer role/bootstrap templates. Avoid unrelated CLI, installer,
  dashboard, release and upstream files.
- Preserve existing 2.1.0 + POP v2 behavior and DAT-001/DAT-002 field/error
  compatibility. Support 2.2.0 + POP v3 through actual schema/role policy and
  operation-scoped capability/authorization checks, not by manufacturing an
  implementation identity in the POP or downgrading activation guards.
  Consumer activation and session freshness may not falsely mark unverified
  roles/runtime selections as authorized. If concrete selection evidence is
  not available to the mini MCP, give a bounded truthful native-host next
  step, not a fake READY; semantic authorization stays external.
- The Author gets source-directed actionable errors and minimal SoT
  references. Executor gets an authorized material boundary with hard
  exclusions, finishes an actual product change and focused self-verification.
  Auditor gets a named audit boundary; preserve independence by actual
  participation and use verified frozen predicates for objective corrective
  closure, with independent review only for material unresolved judgment.
- Use the existing two stdio mini MCP tools; neither sends work to a Runner,
  spawns an executor, manufactures independent evidence nor expands its public
  permissions. No generic filesystem tool, role registry, token-budget service,
  or new mandatory audit/retry loop.

**Concrete focused proof and truthful completion:**
1. V2 regression: original valid consumer operations, activation/session
   guard, role errors, stale-context and closed authorization remain intact.
2. V3 regression: verified POP v3/Bootstrap v3 fixture resolves exact task,
   role policy and relevant authority without a fixed POP-stored platform;
   missing/contradictory identity or capability proof does not authorize
   execution, and stale sessions fail closed.
3. Model-facing role behavior: recoverable task representation diagnoses
   cannot bypass unsupported/absent task authority; Executor changes its
   material target rather than returning empty success; Auditor guidance
   distinguishes objective documentary closure from new semantic audit review.
4. Actual source verification and scoped test results—not fixture definitions,
   transport success, or a passing `git diff --check` alone—support any PASS.
   Reuse applicable mechanical evidence, independently validate actual changed
   code once, and evaluate only real audit triggers before promotion.

**Observed preparatory limitation:** During source tree materialization,
the producer repository connector created some directories but subsequently
stopped with a host safety check. Those empty directories are not a release,
Git-visible candidate, or verified copy. Do not bypass that host restriction by
silently re-routing the prohibited write through another capability. Continue
allowed semantic preparation; resume source materialization only through an
explicitly permitted mechanism. Code/product executor delegation is a
separate material gate and must never be used as a workaround for a rejected
source-write operation.

**Sufficiency:** No extra task, MTP, new validation cycle or new system
component without a specific material need. Before delegation, the Governance
Author reconciles this bounded contract and decides exactly which product
changes and tests are needed. After source and consumer-support prerequisites
are genuinely resolved, hand off only those paths; do not ask the Executor to
re-design governance, discover another repository or re-author the methodology.

## 9. A1 terminal executor-start failure — no implementation attempt

The Operator-authorized A1 bounded consumer-role delivery contract
`.dev-foundry/execution-contracts/TSK-028.json` was independently validated
`valid: true`, with exact SHA-256
`7a39a6672853d191a7b27bada69ca4f456ec4455098708fcd9caac00537ad121`.
The canonical basename `TSK-028.json` corrected a previously diagnosed
package-eligibility mismatch (TSK-027 §13) and the 2.1.0 governed resolver
returned `READY`, eligible implementation, source-bound authorized intent.

Accepted request `req_d195382af741daee0cc259126abf44e9`
produced execution
`execution_3f350fce9c9c4075f0df5e16813f13fbc9b49eadb4f1d5222d9585fbd7674df7`,
terminal `failed`, error `EXECUTOR_UNAVAILABLE`, with precise runner
failure `Codex model selection failed: The process-bound capability profile
reference is invalid.` Terminal `status.json` confirms
`executorInvoked: false`, `executor.available: false`, no executor exit code,
no changed files, no validation commands, and post-execution validation
`blocked` solely because executor dispatch failed. Repository branch
`task/tsk-028-framework-220-skill-adoption` stayed at
`6d2301b581d6215cc898977659e0a2ef1625ac98`, zero visible/hidden
changes. This is a **runner model-selection/dispatch mechanism failure**, NOT
a product implementation FAIL or product validation verdict.

Verified producer POP remains v2 and binds implementation-executor to the
existing active `implementation-executor-runner-v3.yaml` profile, whose
`limits.execution_provider` is `codex-cli`. The canonical execution contract
contains no model override. These observations do not establish which internal
Runner process-bound model capability-profile reference is invalid. Do not
modify the producer POP or profile, choose a substitute model, or start another
execution by guesswork.

**Minimal recovery condition:** diagnose/correct the exact invalid
process-bound model capability-profile reference in the authorized Runner
runtime/configuration boundary (without widening TSK-028 or altering a
consumer). Confirm the corrected reference/model selection using the existing
permitted runner checks; then reobserve exact task/branch/contract eligibility,
authorization and prior terminal effects before a **new distinctly identified**
A1 execution request. Reuse the unchanged scoped contract and focused tests
where still applicable. No new product task, comprehensive regression suite,
fresh Governance Audit, or repeat launch is justified by this failure alone.
