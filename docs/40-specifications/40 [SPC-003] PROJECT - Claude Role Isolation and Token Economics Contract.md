---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-003
  type: SPC
  title: Claude Role Isolation and Token Economics Contract
  status: ACTIVE
artifactVersion: "2"
authorityScope: claude-role-isolation-and-token-economics
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-main-agent-role-boundary
    - claude-subagent-isolation-topology
    - claude-static-context-budgets
    - claude-empirical-tokenomics-retention
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - reusable-role-semantics
    - provider-pricing
    - fixed-model-selection
    - provider-authentication
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - OPS-002
    - OPS-003
    - OPS-009
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-003] dev-foundry-claude - Claude Role Isolation and Token Economics Contract

## 1. Purpose

Define the smallest Claude-native role topology that preserves useful context,
isolates implementation and audit work, and prevents subagent fan-out from
becoming an uncontrolled token multiplier.

The project principle is:

> No agent without measured benefit.

A dedicated agent is justified only by material context isolation, required
independence, or measured cheaper-model routing. Role symmetry is not a reason
to create an agent.

## 2. Initial target topology

The first Claude-native topology SHALL be:

- main Claude agent -> Governance Author and operator-facing orchestration;
- main Claude agent -> Evidence Custodian only in a separate bounded operation;
- dedicated `dev-foundry-executor` subagent -> Implementation Executor;
- dedicated `dev-foundry-auditor` subagent -> Governance Auditor;
- Claude-native deterministic validation -> Mechanical Validator.

There is no dedicated Governance Author subagent in the initial topology.

The main agent MAY author and reconcile project SoT while selected as Governance
Author. It SHALL NOT implement product code while acting as Governance Author and
SHALL NOT issue a required independent Governance Audit verdict.

## 3. Durable-state rule

The main agent preserves decisions through repository SoT, not through
conversation reasoning.

After a governed authoring operation, later operations MUST re-establish
authority from repository state and the governed-operation resolver. Intermediate
reasoning, chat history, summaries, or memory are not durable authority.

A subagent returns disposition and evidence references, not its private working
context. The main agent consumes the resulting repository state and compact
disposition instead of replaying the subagent's exploration.

## 4. Explicit dispatch

Subagent selection SHALL be driven by the role returned by
`resolve_governed_operation`, not by heuristic auto-delegation.

- Governance Author -> main agent, direct.
- Evidence Custodian -> main agent, direct, after ending the prior operation.
- Implementation Executor -> exactly `dev-foundry-executor`.
- Governance Auditor -> exactly `dev-foundry-auditor` when audit is triggered.
- Mechanical Validator -> deterministic validation path, not a model subagent.

The initial topology SHALL NOT use parallel agent fan-out, agent teams, nested
subagents, or subagent-to-subagent delegation.

## 5. Static token-economics budgets

The following project-specific ceilings apply before empirical runtime review:

- root `CLAUDE.md` remains at or below 40 non-empty lines;
- exactly two project subagent definitions are permitted by the initial
  implementation task;
- each subagent description SHALL be at most 240 UTF-8 bytes;
- each complete subagent definition SHALL be at most 8192 UTF-8 bytes and at
  most 100 non-empty lines;
- subagents SHALL NOT preload project Skills;
- subagents SHALL NOT expose the Agent/subagent spawning tool;
- delegation depth is exactly one: main agent -> one selected subagent;
- a normal bounded role operation launches at most one subagent instance;
- automatic retries or hidden recursive delegation are forbidden;
- a main-to-subagent handoff SHALL be at most 8192 UTF-8 bytes;
- a subagent-to-main disposition SHALL be at most 4096 UTF-8 bytes, excluding
  repository evidence referenced by path/hash;
- authority bodies SHALL NOT be copied into handoffs when the receiving agent can
  read the directed repository references itself.

If a legitimate bounded operation cannot fit these ceilings, it stops for
Governance Author fit reassessment rather than silently expanding context.

## 6. Handoff minimum

A handoff contains only what the selected role needs:

- project and bounded-operation identity;
- selected role/profile identity;
- task/boundary id when applicable;
- directed authority references and hashes;
- material implementation or audit boundary;
- hard exclusions;
- proof/evidence boundary;
- stop conditions;
- Operator authorization state relevant to the bounded operation.

The handoff MUST NOT include full DEV FOUNDRY methodology, broad task history,
conversation transcript, or duplicated authority bodies.

## 7. Disposition minimum

A subagent disposition contains only:

- terminal status or stop reason;
- exact changed paths or exact audit findings;
- projection variance when applicable;
- validation/self-verification facts applicable to that role;
- evidence paths/hashes;
- explicitly unresolved blockers.

Narrative reconstruction of the agent's internal exploration is not required.

## 8. Empirical measurement policy

The initial two-subagent topology is a bounded probationary topology justified
before measurement by two concrete needs:

- Executor context isolation keeps implementation-local exploration out of the
  operator-facing Governance Author context;
- Auditor isolation provides a fresh read-only implementation for a real
  independence boundary.

The project SHALL NOT pay for synthetic Claude workloads solely to benchmark
that topology before cutover.

Instead, SPC-004 governs privacy-minimized operational telemetry collected from
real Claude-native work after cutover. A later empirical review evaluates, when
the runtime exposes them:

- model and effort/routing configuration;
- model invocation count;
- input tokens;
- output tokens;
- cache creation tokens;
- cache read tokens;
- reported cost;
- request duration;
- main versus subagent query source;
- compaction/subagent completion activity;
- handoff/disposition sizes where separately observable.

When a provider/runtime does not expose a metric or natural work has not
produced a sample, evidence records `unavailable`. The project SHALL NOT
fabricate token or dollar estimates and present them as runtime measurement.

## 9. Natural-work sampling

Empirical review uses naturally occurring governed work.

It does not create artificial Governance Author, Executor, Auditor, Validator,
or Evidence Custodian workloads merely to fill a benchmark matrix.

If representative implementation work occurs, Executor behavior is measured.
If an independent Governance Audit is actually triggered, Auditor behavior is
measured. If no such audit occurs, Auditor empirical cost remains
`unavailable` rather than forcing a paid audit simulation.

Direct measurement, time-window correlation, and inference MUST be identified
separately in the review.

## 10. Retention rule

The two initial subagents may enter cutover after static qualification and
SPC-004 telemetry readiness. Their long-term retention is then subject to
empirical review of real work.

The Executor should demonstrate material context-isolation value or a favorable
token/cost tradeoff for representative implementation work. The Auditor may
remain justified primarily by independence/context isolation even when its total
token cost is higher, but observed overhead must still be reported.

The project principle remains **no agent without measured benefit** as a
long-term retention rule. The initial two-agent topology is the explicitly
governed probationary exception needed to collect that measurement without
synthetic spend.

No additional Author, Custodian, Validator, research, planning, reviewer, or
helper subagent may be added before separate measurement and governance justify
it.

## 11. Model policy

TSK-006 does not select concrete Claude models.

Initial subagent implementation SHALL avoid provider/model specialization unless
a later governed task explicitly authorizes it. Empirical review may compare
observed model-routing alternatives only after real workload evidence exists.

## 12. Fail-closed conditions

Stop before cutover when:

- subagent topology exceeds the initial two-agent boundary;
- automatic or nested delegation is required;
- static budgets are exceeded without a governed fit reassessment;
- SPC-004 telemetry instrumentation required for empirical review is not ready
  at cutover;
- a claimed measured benefit is presented without observed evidence;
- role routing conflicts with POP/SPC-002;
- a required independent Auditor implementation cannot satisfy independence;
- the main agent would need to implement product code while acting as Governance
  Author.
