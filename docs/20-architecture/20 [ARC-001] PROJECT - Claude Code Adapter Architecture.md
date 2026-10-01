---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ARC-001
  type: ARC
  title: Claude Code Adapter Architecture
  status: ACTIVE
artifactVersion: "1"
authorityScope: dev-foundry-claude-adapter-architecture
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-code-adapter-components
    - claude-code-primitive-responsibility-map
    - claude-code-context-loading-boundary
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
Anthropic documentation on 2026-09-30. Product mechanics may evolve; later
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
| Role/context isolation | Custom subagents | Candidate mechanism for Auditor and Executor roles when separately activated |
| Primary operator-facing governance | Main Claude agent | Governance Author is the default project role unless a bounded operation resolves another eligible role |

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

Custom subagents run in separate context windows and can have distinct system
prompts, models, tools, permissions, hooks, Skills, and scoped MCP access.

This makes them the preferred candidate mechanism for later concrete bindings
that need role isolation, especially Governance Auditor and Implementation
Executor. The main Claude agent remains the initial operator-facing Governance
Author.

No subagent is activated by this architecture baseline. Concrete bindings,
model selection, tool restrictions, independence requirements, and cost policy
require later governed tasks.

## 8. Context and token policy

The adapter SHALL optimize for useful authority per token rather than maximum
preloaded context.

The current baseline is:

- keep project startup instructions small and direct;
- do not import the complete DEV FOUNDRY release into startup context;
- keep Skill and subagent descriptions concise because listings consume
  context;
- keep MCP server instructions and tool descriptions concise;
- use MCP tool search/deferred tool definitions when supported by the selected
  Claude Code deployment;
- use subagents only when isolation, specialization, or cheaper-model routing
  offsets the cost of an additional model request;
- prefer one governance resolution result plus directed reads over repeated
  broad repository exploration.

## 9. Current host evidence

The architecture relied on current Anthropic documentation for:

- Claude Code overview and direct Git/repository capability;
- project memory/`CLAUDE.md` loading semantics;
- Skills and deferred skill-body loading;
- custom subagent context/tool/model/permission isolation;
- Hooks including `PreToolUse`, `PermissionRequest`, and `SubagentStart`;
- MCP project scoping and tool-search deferral.

These are observed provider mechanics, not DEV FOUNDRY methodology authority.
A later implementation task must revalidate any material version-sensitive
assumption before relying on it.
