---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-013
  type: TSK
  title: Establish Producer Maintenance Mode and Adapter Release Lifecycle
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-013-producer-maintenance-and-release-lifecycle
ownerRole: governance-author
canonical: true
scope:
  owns:
    - producer-maintenance-cutover
    - producer-runner-capability-profile-v3
    - adapter-release-lifecycle-baseline
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - consumer-repository-read-or-modification
    - adapter-installation
    - adapter-runtime-behavior-change
    - upgrade-plan-and-apply-implementation
    - dashboard
    - adapter-version-change
    - package-publication-or-registry-selection
    - methodology-change
    - framework-version-change
    - mature-runner-modification
    - compatibility-or-synchronization-layer
    - removal-of-claude-targeting-package-surface
    - reactivation-of-historical-pre-cutover-configuration
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - SPC-002
    - OPS-002
    - OPS-003
    - OPS-005
    - OPS-007
    - OPS-008
    - OPS-009
    - DAT-016
  supersedes: []
traceability:
  dependsOn:
    - TSK-009
    - TSK-012
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-009
    - TSK-012
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-013] dev-foundry-claude - Establish Producer Maintenance Mode and Adapter Release Lifecycle

## 1. Purpose

Apply ADR-004: separate the runtime that develops `dev-foundry-claude` (the
producer) from the runtime the adapter targets (Claude Code, for consumers), and
record the release lifecycle that lets consumers stay pinned while the producer
evolves.

This is a forward producer-maintenance cutover. It is not a rollback of TSK-009
and not a rollback of the Claude adapter product. The reusable adapter continues
to target Claude Code.

## 2. Preconditions (observed)

- repository is `dev-foundry-claude`, branch
  `task/tsk-013-producer-consumer-release-lifecycle`, base
  `b85886372a7d54d6706b0dc6ccfb7b85311aa88a`, tree clean at start;
- TSK-009 and TSK-012 are COMPLETE; adapter version is `1.1.0`;
- the active POP binds all five roles to `claude-code`; Governance Author is
  `claude-main-agent`, so this transition is authored and completed through the
  currently active Claude-native Governance Author boundary;
- `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2` is historical and carries
  `hosting_phase: chatgpt-governed-pre-cutover`; it is not reactivated;
- POP audit triggers are empty; the Operator nevertheless requires a final
  independent Governance Audit of the stable candidate (section 11).

If any fact changes before the applicable phase, stop and reconcile.

## 3. Necessity and reuse assessment

- ADR-004 is necessary: the separation is a durable architectural decision with
  no existing home (ADR-003 owns the package and consumer boundary only).
- SPC-005 is necessary as a PLANNED contract: the future upgrade needs one
  normative home for release identity and upgrade invariants; it is kept to
  invariants and implements nothing.
- Capability Profile `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3` is necessary: V2
  states a pre-cutover hosting phase and a prohibition tied to it, so it cannot
  truthfully bind the producer Executor. V1 is TSK-002-scoped. Claude profiles
  are target-runtime artifacts and do not apply.
- No new Mechanical Validator or Auditor Capability Profile is created: the
  historical bindings carried none and DAT-016 does not require one.
- No new runtime, template, or package code is necessary.
- SPC-002 is reconciled rather than replaced (section 8).

## 4. Hard exclusions

TSK-013 SHALL NOT: read or modify PagoElectronico or any real consumer; install
the adapter anywhere; change `@dev-foundry/claude-adapter` runtime behavior,
`src/**`, `bin/**`, `templates/**`, `scripts/**`, `package.json`,
`package-lock.json` or version `1.1.0`; implement `upgrade plan` or
`upgrade apply`; implement a dashboard; publish a package or choose a registry;
change DEV FOUNDRY 2.1.0 or the mature runner; create a compatibility layer
between ChatGPT and Claude; remove `CLAUDE.md`, `.mcp.json`, `.claude/**`,
Claude Capability Profiles or package templates; or reuse historical
configuration whose constraints are no longer truthful.

Naming a follow-on upgrade-implementation task does not reserve its authority.

## 5. Recovered historical bindings (semantics reused, constraints not)

The pre-TSK-009 POP (commit `ce0fe3f^`) bound, on platform `chatgpt-project`:

| Role | Implementation | Kind |
| --- | --- | --- |
| Governance Author | `operator-assisted-dev-foundry-copilot` | agent |
| Governance Auditor | `operator-assisted-dev-foundry-copilot` | agent |
| Evidence Custodian | `operator-assisted-dev-foundry-copilot` | agent |
| Implementation Executor | `process-bound-runner-code-executor` | tool |
| Mechanical Validator | `process-bound-runner` | tool |

These identities are reused because they name the same concrete ChatGPT-side
governance implementation and process-bound runner mechanics that governed this
repository before TSK-009, and the Operator-side runner is the mechanism that
created this task branch. They are reused as identities only. The historical
Executor Capability Profile V2 is not reused; V3 replaces it for this purpose.

Governance Author and Governance Auditor sharing one identity is the historical
shape. Independence is operation-scoped and established from actual prior
participation (OPS-003); conversational continuity does not satisfy it.

## 6. Phase A - last Claude-native implementation preparation

Dispatched to the currently bound `dev-foundry-executor` after TSK-013
activation and before any configured authority mutation. The Executor MAY change
exactly:

- `test/bootstrap/claude-cutover-readiness.test.js`;
- `test/bootstrap/claude-subagents.test.js`.

It SHALL reconcile assertions from the Claude-native producer state to the
section 7 target state, and preserve proof that the Claude product surface
remains intact. Required test targets:

1. POP: exactly the section 7 bindings; every `platform` is `chatgpt-project`;
   primary bootstrap status `active`; default role `governance-author`.
2. Authority Index capability bindings (kind `capability-profile`, class
   `configured`, exactly one per path): runner V1 `required:false`, runner V2
   `required:false`, runner V3 `required:true`, Claude Executor V1
   `required:false`, Claude Executor V2 `required:false`, Claude Auditor V1
   `required:false`.
3. Runner V2 remains `status: active` text with
   `limits.hosting_phase: chatgpt-governed-pre-cutover` (history, unmodified).
4. Runner V3: id `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3`, class
   `process-bound-runner-code-executor`,
   `limits.hosting_purpose: chatgpt-governed-producer-maintenance`,
   `limits.execution_provider: codex-cli`, no `hosting_phase`, environment
   constraint `active_pop_must_bind_implementation_executor_to_this_profile`,
   stop condition `profile_is_not_the_active_pop_binding_for_implementation_executor`,
   prohibited actions include `invoke_claude_code_as_executor_for_producer_maintenance`
   and `mutate_any_consumer_repository`.
5. Claude Executor V2 and Auditor V1 profiles are unchanged and still describe
   Claude subagents that require an active POP binding (they remain consumer-target
   product surface and are not producer bindings).
6. Platform Bootstrap: `status: active`, `platform.id: chatgpt-project`, sources
   unchanged, eligible profiles exactly Governance Author v3, Governance Auditor
   v2, Evidence Custodian v1 (in that order), default role
   `governance-author`; rule/constraint text states that the Implementation
   Executor is separately bound to the process-bound runner code executor through
   `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3` and is not self-selected, that
   Mechanical Validator is separately bound to the process-bound runner, that
   Claude Code is the adapter's target runtime and not the active producer
   platform, and that capability does not grant authority.
7. Root `CLAUDE.md`, project `.mcp.json`, and exactly the two `.claude/agents`
   definitions remain present and unchanged in content expectations.
8. SPC-002: section `3. Claude-native binding target state` (renamed from
   `3. Cutover target state`) retains the five mappings with their existing text
   shape; section `7. Isolation and audit boundary` is unchanged; SPC-002
   section `2. Historical pre-cutover state` is replaced by
   `2. Historical Claude-native producer state` (section 8).
9. ADR-004 is routed and ACCEPTED, SPC-005 is routed and PLANNED, and
   `package.json` version is still `1.1.0`.
10. In `claude-subagents.test.js` the POP-binding test is replaced by a test that
    the Claude subagent definitions and profiles remain consistent with each
    other and are NOT active producer POP bindings.

Phase A self-check: `node --check` on both files and `git diff --check`. The full
suite is intentionally deferred until Phase B completes because the tests assert
the future configured state.

Hard exclusions for Phase A: no configured authority mutation; no POP, Platform
Bootstrap, Authority Index, Capability Profile or docs mutation; no product or
runtime mutation beyond the two tests; no commit, push, PR or merge by the
Executor; no unrelated product work. This is the final operation expected to run
under the Claude Executor binding.

## 7. Phase B - Governance Author configured-state cutover

After Phase A is terminal and reconciled, Governance Author reconciles exactly:

- `.dev-foundry/profiles/project-operating-profile.yaml`;
- `.dev-foundry/authority-index.yaml`;
- `.dev-foundry/platform-bootstrap.yaml`;
- `.dev-foundry/bootstrap/project-system-prompt.md`;
- `docs/40-specifications/40 [SPC-002] PROJECT - Claude-Native Cutover Binding Contract.md`;
- `docs/00-overview/00 [OVR-001] PROJECT - System Overview.md`;
- `docs/00-overview/00 [OVR-002] PROJECT - Documentation Map and Artifact Taxonomy.md`;
- this TSK for closure evidence.

POP target (`active`, same Operator and DEV FOUNDRY 2.1.0 binding, default role
Governance Author, primary bootstrap `active`):

- governance-author -> `governance-author-v3`, agent,
  `operator-assisted-dev-foundry-copilot`, `chatgpt-project`, no capability;
- governance-auditor -> `governance-auditor-v2`, agent,
  `operator-assisted-dev-foundry-copilot`, `chatgpt-project`, no capability;
- evidence-custodian -> `evidence-custodian-v1`, agent,
  `operator-assisted-dev-foundry-copilot`, `chatgpt-project`, no capability;
- implementation-executor -> `implementation-executor-v2`, tool,
  `process-bound-runner-code-executor`, `chatgpt-project`, capability
  `.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v3.yaml`;
- mechanical-validator -> `mechanical-validator-v2`, tool,
  `process-bound-runner`, `chatgpt-project`, no capability.

Why each is truthful: the first three name the ChatGPT-project governance
implementation that governed this repository before TSK-009 and that the
Operator operates; Executor and Validator name the process-bound runner, which
provides Codex execution and governed mechanical validation, the same mature
runner contract that created this branch. The Executor additionally requires V3
because V2 is historical.

Authority Index: add routes for ADR-004, SPC-005, TSK-013; V3 `required:true`;
runner V1 and V2 `required:false`; Claude Executor V1/V2 and Auditor V1
`required:false` with ids renamed to consumer-target history semantics;
all other routes unchanged.

Platform Bootstrap: active, `chatgpt-project`, ChatGPT-project producer
maintenance bootstrap with startup constraints for the process-bound runner and
the constraints enumerated in Phase A item 6.

Project system prompt: replaces the retired notice with an active
non-authoritative ChatGPT-project producer-maintenance derivative aligned to the
Platform Bootstrap.

SPC-002: Purpose, section 2 and section 4 reconciled so the Claude-native
mappings are the Claude target binding model (historical producer state and
consumer-cutover model), no longer the active producer state; section 7 retained.

OVR-001/OVR-002: state that TSK-013 completed the producer-maintenance cutover,
that the active producer platform is `chatgpt-project`, that Claude Code is the
adapter's target runtime, that Claude product files remain, and that package
1.1.0 is the initial consumer baseline.

## 8. Release-lifecycle baseline

Recorded here and in ADR-004/SPC-005 (no code):

```text
PagoElectronico  adapter 1.1.0   (remains pinned while producer evolves)
        |
dev-foundry-claude  dashboard / hardening / other work
        |
explicit adapter release 1.2.0
        |
separate consumer-governed upgrade
        |-- adapter-owned changes may be planned/applied
        `-- authority changes, if required, are proposal-only
```

A future upgrade preserves the TSK-012 principles listed in SPC-005 section 4.
Implementation is deferred to a separate task that requires its own authority.

## 9. Mechanical validation

After Phase B: `npm ci`, `npm test`, `git diff --check` pass; plus governed
checks that (1) POP bindings, bootstrap, and Authority Index match sections 6-7;
(2) `package.json`, `package-lock.json`, `src/**`, `bin/**`, `templates/**`,
`scripts/**`, `CLAUDE.md`, `.mcp.json`, `.claude/**`, Claude Capability Profiles
and the framework release are byte-identical to base; (3) the changed-path set
equals the projection below; (4) no consumer path was read or touched.

## 10. Projected changed-path set

Authoring: ADR-004, SPC-005, TSK-013, runner-v3 profile, Authority Index.
Phase A: the two test files. Phase B: POP, Authority Index, Platform Bootstrap,
project system prompt, SPC-002, OVR-001, OVR-002, TSK-013.

## 11. Audit and promotion

Because this changes the active producer platform and bindings, an independent
Governance Audit of the stable cutover candidate is required before promotion,
after full mechanical validation and Governance Author semantic self-assessment.
Until promotion, the promoted `main` POP remains the authority; the branch is a
candidate. The audit is dispatched to a Governance Auditor independent of every
authoring and implementation participant.

Promotion is NOT automatic after the audit. The Operator explicitly authorizes
promotion after receiving: the final boundary, exact changed paths, resulting POP
binding table, resulting Platform Bootstrap state, any new Capability Profile,
validation results, audit verdict and findings, known limitations, and
confirmation that package 1.1.0 behavior and all real consumers are untouched.

Promotion of the exact candidate is the producer-maintenance cutover boundary.

## 12. Completion

Complete only when Phase A is terminal, Phase B is reconciled, semantic
self-assessment and mechanical validation pass, the independent audit has no
blocking finding, the Operator authorizes promotion, the exact candidate is
promoted, and reconciliation confirms clean `main`.

## 13. Execution record (pre-audit candidate)

- Authoring (Governance Author, `claude-main-agent`): ADR-004, SPC-005 (PLANNED),
  TSK-013 activation, `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3` (indexed
  `required:false` until Phase B), Authority Index routes.
- Phase A (`dev-foundry-executor`, final Claude-native Executor operation,
  fingerprint `c5778be2...f8261`): exactly the two authorized test files changed;
  `node --check` and `git diff --check` PASS; no configured authority touched.
- Phase B (Governance Author): the eight section 7 paths reconciled; runner V3
  flipped to `required:true`; Claude profiles flipped to `required:false`.
- Mechanical validation: `npm ci` PASS; `npm test` PASS 105/105; `git diff --check`
  PASS. `package.json`, `package-lock.json`, `src/**`, `bin/**`, `templates/**`,
  `scripts/**`, `CLAUDE.md`, `.mcp.json`, `.claude/**`, the Claude and runner V1/V2
  Capability Profiles, and the framework release are unchanged from base.
  No consumer repository was read or modified.
- Candidate changed paths (13): the Authority Index, project system prompt,
  Platform Bootstrap, POP, OVR-001, OVR-002, SPC-002, the two test files, runner
  V3, ADR-004, SPC-005, TSK-013.
## 14. Independent audit record

Durable facts only; the raw audit files lived in an ephemeral Claude job directory
and are not repository evidence.

- **Execution context:** `dev-foundry-auditor` (`governance-auditor-v2`,
  `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`) run read-only in a separate Claude
  process from a clean clone of promoted `main` at base
  `b85886372a7d54d6706b0dc6ccfb7b85311aa88a` (zero local changes). The candidate
  POP was not applied to that checkout, so the candidate did not bootstrap its
  own audit. Resolution: `audit` with `taskId=TSK-013` returned
  `AUTHORITY_INVALID` (TSK-013 is not routed in promoted `main`); taskless
  resolution under boundary `tsk-013-candidate-audit` resolved the bound
  Governance Auditor from `main`'s POP.
- **Participation:** `claude-main-agent` authored the candidate and
  `dev-foundry-executor` performed Phase A; the ChatGPT session helped define the
  boundary. The auditor authored or mutated none of it.
- **Frozen candidate 1:** 13 paths against the base above; the manifest of
  per-file sha256 values had aggregate sha256
  `96ac891f34a233eb292257f127c62772685852a5050c3040a3a2b61efb8e6333`; patch vs base
  1426 lines. The corrective-review candidate is re-frozen with a new manifest
  that is carried in the promotion package (this file cannot embed its own hash).
- **Attempt 1: BLOCKED.** The headless session denied the auditor permission to
  call `resolve_governed_operation`; it stopped fail-closed, read nothing and
  mutated nothing. The audit was re-run with only the read-only tools and that
  resolver allowed for the child process.
- **Attempt 2: PASS**, no blocking findings, three non-blocking observations:
  - **O1** (OVR-001 said SPC-002 "owns the active Claude-native binding
    contract"): reproduced and corrected to describe SPC-002 as the
    Claude-native binding target and consumer-cutover model. The audit's second
    OVR-001 mention (the non-goal "any Claude subagent beyond
    `dev-foundry-executor` and `dev-foundry-auditor`") is truthful product
    scope and was deliberately not changed.
  - **O2** (SPC-002 sections 5-8 readable as producer rules): reproduced and
    corrected by scoping text in section 2 and a one-sentence scope line in
    sections 5-8; headings and Claude consumer behavior unchanged.
  - **O3** (stale Authority Index tag on the SPC-002 route): NOT REPRODUCED. The
    tag `claude-main-agent-role-boundary` is routed under SPC-003, which owns it;
    the SPC-002 route governs only `claude-native-cutover-binding-state`,
    `claude-native-cutover-transition` and
    `claude-native-role-implementation-map`. No mutation made.
- **Known limitations:** V3 is derived from V2 and framework authority (the runner
  contract is not in this repository); mature-runner availability is now verified
  (section 15) while Codex execution availability remains a separate, unobserved
  runtime fact; Author and Auditor share one ChatGPT identity
  (historical shape; independence is operation-scoped and rests on actual
  non-participation); no release tag, registry or 1.1.0 payload root is recorded;
  SPC-005 is contract-only.
- **Corrective review: PASS** (same `dev-foundry-auditor` mechanism from the clean
  promoted-`main` checkout, `corrective_review` scope: O1-O3, the direct
  regression boundary and this evidence). Boundary stable at the same 13 paths;
  only OVR-001, SPC-002 and TSK-013 differ from the first audited candidate. O1
  CLOSED, O2 CLOSED, O3 CLOSED (the auditor confirmed its original attribution
  was a misreading of the adjacent SPC-003 route); no regression finding.
  Revalidation after the corrections: `npm ci` PASS, `npm test` 105/105 PASS,
  `git diff --check` PASS. The auditor did not run tests and did not observe
  attempt 1.
- **Promotion:** requires explicit Operator authorization; not yet given.

## 15. Mature-runner compatibility record

- **Original blocker:** the mature runner failed every action/role resolution
  against this candidate with `GOVERNANCE_RESOLUTION_AUTHORITY_INVALID` while
  parsing the POP, so promotion was held.
- **Root cause:** the runner's authority reader required every POP actor-binding
  `profile` locator to be `<path>#<actor-profile-id>`, whereas canonical DAT-016
  permits an Actor Profile ID or path. The candidate's canonical bare-path
  locators were correct; the runner was over-strict.
- **Corrective:** made externally in `foundry-runner` under its own governance.
  No `dev-foundry-claude` or consumer mutation was used to work around it: POP
  Actor Profile locators and DEV FOUNDRY 2.1.0 are unchanged, and no consumer
  repository was read or modified.
- **Runtime:** the runner was rebuilt and its MCP/tunnel deliberately restarted.
- **Control probe:** `TSK-001`, `inspect` / `governance-author` resolves `READY`.
- **TSK-013 resolution matrix (corrected runner, candidate frozen at manifest
  `6bd466cf...98ef`):**

  | Action / requested role | Result | Selected role |
  | --- | --- | --- |
  | inspect / governance-author | `READY` | governance-author |
  | author / governance-author | `SEMANTIC_ASSESSMENT_REQUIRED` | governance-author |
  | implement / implementation-executor | `EXECUTION_PACKAGE_INELIGIBLE` (runner V3 authority loaded) | implementation-executor |
  | validate / mechanical-validator | `SEMANTIC_ASSESSMENT_REQUIRED` | mechanical-validator |
  | audit / governance-auditor | `SEMANTIC_ASSESSMENT_REQUIRED` | governance-auditor |
  | promote / governance-author | `AUTHORITY_MISSING` (validation required) | governance-author |

- **Interpretation:** these are expected governed gates, not authority-load
  failures. `implement` and `promote` now reach their normal downstream gates
  (no execution package yet; promotion needs validation and Operator
  authorization) instead of failing authority parsing. The prior
  `GOVERNANCE_RESOLUTION_AUTHORITY_INVALID` is no longer reproduced.
- **Availability:** mature-runner availability is verified by the probe and
  matrix above. Codex execution availability remains a separate runtime fact and
  is not asserted here unless independently observed.
- **Boundary:** this reconciliation changed only this evidence record; the
  changed-path set stays at the same 13 paths.
