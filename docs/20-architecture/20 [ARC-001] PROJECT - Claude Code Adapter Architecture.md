---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ARC-001
  type: ARC
  title: Claude Code Adapter Architecture
  status: ACTIVE
artifactVersion: "4"
authorityScope: dev-foundry-claude-adapter-architecture
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-code-adapter-components
    - claude-code-primitive-responsibility-map
    - claude-code-context-loading-boundary
    - claude-adapter-distribution-components
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - concrete-governance-mcp-schema
    - concrete-hook-rules
    - concrete-skill-content
    - concrete-subagent-prompts
    - implementation-executor-binding
authority:
  governedBy:
    - ADR-001
    - OVR-001
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 20 [ARC-001] dev-foundry-claude - Claude Code Adapter Architecture

## 1. Purpose

Define the first project-specific architecture baseline for mapping DEV FOUNDRY
responsibilities onto Claude Code primitives while minimizing repeated context
reconstruction and preserving repository-owned authority.

This architecture is based on the Claude Code product surface observed from
Anthropic documentation through 2026-10-01. Product mechanics may evolve; later
tasks must revalidate material host assumptions before implementation.

## 2. Responsibility map

| Responsibility | Preferred Claude Code primitive | Architectural rule |
| --- | --- | --- |
| Always-needed startup binding | Minimal project `CLAUDE.md` or equivalent project instruction entry point | Locate project identity, POP, Authority Index, and the governance resolver; do not embed full methodology |
| Repository read/search/edit | Native Claude Code file/search tools | Use directly; do not proxy through the governance MCP |
| Build/test/shell work | Native Bash/PowerShell | Use directly under applicable permissions and task authority |
| Git and provider workflow | Native shell/Git/provider CLI | Use directly when the governed side-effect boundary is authorized |
| Governed operation resolution | Dedicated Claude governance MCP | Primary deterministic governance entry point |
| Hard tool/action enforcement | Hooks and Claude Code permission settings | Enforce mechanically where a concrete rule benefits from deterministic blocking |
| Repeatable contextual workflows | Skills | Load workflow detail on demand instead of expanding permanent instructions |
| Role/context isolation | Dedicated custom subagents | Initial dedicated subagents are limited to Implementation Executor and Governance Auditor; no agent exists merely for role symmetry |
| Primary operator-facing governance | Main Claude agent | Governance Author remains direct on the main agent; orchestration is part of that operator-facing implementation, not a separate governed role |
| Evidence custody | Main Claude agent | Evidence Custodian may use the same main implementation only in a separate operation after role re-selection |
| Mechanical validation | Native deterministic validation | Do not spend a model/subagent call for deterministic proof when native validation satisfies the boundary |
| Operational tokenomics telemetry | Claude Code OTel + repo-local loopback collector/launcher | Capture privacy-minimized real-work usage without synthetic model spend or public telemetry services |

## 3. Minimal bootstrap layer

The project bootstrap delivered to Claude Code SHALL stay intentionally small.

Claude Code documentation states that project `CLAUDE.md` instructions load at
session start and recommends keeping them concise; large imported instruction
trees therefore have recurring context cost. The bootstrap should contain only
facts that are needed before repository authority can be resolved, consistent
with OPS-009.

Detailed DEV FOUNDRY policy stays in the adopted release and is retrieved only
for the current bounded operation.

## 4. Governance MCP

The dedicated MCP is a governance control-plane adapter, not a repository remote
control.

### 4.1 Initial mandatory surface

The first mandatory tool is a Claude-oriented governed-operation resolver.

It must be able to:

- verify the target project/repository identity relevant to governance;
- resolve exactly one eligible role/profile for the operation;
- identify the minimal applicable authority;
- state required lifecycle gates and bounded assessments;
- return or validate a context fingerprint so stale authority can be detected;
- resolve legitimate pre-TSK governance authoring without synthetic product
  authority.

### 4.2 Surface-growth rule

No second MCP tool is assumed by this architecture.

A later task may justify operations such as governance-context validation or
promotion-readiness evaluation only when their deterministic value is
demonstrated and their responsibility is not already satisfied by Claude Code
native capabilities, hooks, or ordinary repository validation.

### 4.3 Distribution and consumer activation

The reusable runtime is also a versioned package with one CLI (ADR-003). The CLI adds exactly
three responsibilities around the existing MCP and launcher: brownfield adoption planning and
apply for adapter-owned files only, a read-only activation status, and thin `mcp` and `run`
entry points that verify a runtime pin first.

A consumer receives configuration, not code. Until the consumer's own atomic cutover the adapter
is prepared and not active, and the packaged MCP fails closed with `BINDING_INACTIVE` for role
work. No component exists to coexist with, bridge, or modify the mature runner.

## 5. Hooks and permissions

Claude Code `PreToolUse` hooks can run before tool execution and can allow,
deny, ask, or defer a call. Permission settings can also deny tools, commands,
or file paths independently of model behavior.

These mechanisms are the preferred candidates for future deterministic
side-effect enforcement because they guard Claude's native tools rather than
requiring the MCP to perform the side effect itself.

Exact hook policies are deliberately deferred. The architecture does not yet
authorize blocking rules, command allowlists, or automatic promotion decisions.

## 6. Skills

Skills are the preferred candidate for repeatable, bounded operational guidance
that should not be permanently loaded.

Claude Code exposes skill descriptions in the available-skill listing while the
full skill body loads only when invoked. Supporting reference files can be
loaded only when needed.

Project Skills therefore must remain navigation/workflow packages and must not
copy canonical DEV FOUNDRY methodology into a parallel authority source.

## 7. Subagents

Custom subagents provide separate context and role-specific tool surfaces. The
initial project topology uses this mechanism only where the isolation benefit is
material.

The main Claude agent remains the operator-facing Governance Author. It authors
and reconciles project SoT directly while selected in that role; it is not
reduced to a write-disabled dispatcher. Repository SoT, not conversational
reasoning, is the durable record carried into later operations.

Exactly two dedicated role implementations are planned initially:

- `dev-foundry-executor` for Implementation Executor, to keep code exploration,
  mutation, debugging, and implementation-local context out of the main agent;
- `dev-foundry-auditor` for Governance Auditor, to provide fresh read-only
  semantic evaluation and satisfy independence when required.

Evidence Custodian remains on the main implementation in a separately selected
operation. Mechanical Validator remains deterministic/native.

No Author, Custodian, Validator, research, planning, helper, reviewer, or agent
team is created by default. No subagent may spawn another subagent in the
initial topology. SPC-003 owns the concrete isolation and token-economics
contract.

## 8. Context and token policy

The adapter SHALL optimize for useful authority per token rather than maximum
preloaded context.

The current baseline is:

- keep project startup instructions small and direct;
- do not import the complete DEV FOUNDRY release into startup context;
- preserve decisions through repository SoT rather than conversational
  reasoning;
- keep Skill and subagent descriptions concise because listings consume
  context;
- keep MCP server instructions and tool descriptions concise;
- use MCP tool search/deferred tool definitions when supported by the selected
  Claude Code deployment;
- dispatch subagents only from an explicitly resolved role, not heuristic
  auto-delegation;
- permit no nested delegation or parallel agent fan-out in the initial topology;
- use subagents only when measured context isolation, required independence, or
  cheaper-model routing offsets their additional request cost;
- prefer one governance resolution result plus directed reads over repeated
  broad repository exploration.

The project rule is: **no agent without measured benefit**. SPC-003 defines the
static context ceilings and empirical retention rule. SPC-004 defines the local
telemetry path used to obtain that measurement from real work rather than paid
synthetic benchmarks.

## 9. Current host evidence

The architecture relied on current Anthropic documentation for:

- Claude Code overview and direct Git/repository capability;
- project memory/`CLAUDE.md` loading semantics;
- Skills and deferred skill-body loading;
- custom subagent context/tool/model/permission isolation;
- Hooks including `PreToolUse`, `PermissionRequest`, and `SubagentStart`;
- MCP project scoping and tool-search deferral;
- OpenTelemetry metrics/logs export, OTLP `http/json`, privacy gates, and the
  fact that repository settings cannot select/route OTLP exporters.

These are observed provider mechanics, not DEV FOUNDRY methodology authority.
A later implementation task must revalidate any material version-sensitive
assumption before relying on it.
