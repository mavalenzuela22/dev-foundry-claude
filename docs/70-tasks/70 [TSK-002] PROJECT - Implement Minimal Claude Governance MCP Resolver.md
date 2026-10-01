---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-002
  type: TSK
  title: Implement Minimal Claude Governance MCP Resolver
  status: IN_PROGRESS
artifactVersion: "2"
authorityScope: tsk-002-minimal-claude-governance-mcp-resolver
ownerRole: governance-author
canonical: true
scope:
  owns:
    - minimal-claude-governance-mcp-resolver
  appliesTo:
    components:
      - claude-governance-mcp
  excludes:
    - hooks
    - skills
    - subagents
    - agent-teams
    - product-CLAUDE-md
    - remote-mcp-transport
    - authentication
    - generic-repository-tools
    - automatic-promotion
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ARC-001
    - SPC-001
    - DAT-001
    - OPS-001
  supersedes: []
traceability:
  dependsOn:
    - TSK-001
  implements:
    - ADR-002
    - SPC-001
    - DAT-001
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-001
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-002] dev-foundry-claude - Implement Minimal Claude Governance MCP Resolver

## 1. Purpose and necessity

Deliver the smallest usable Claude Code governance MCP so a governed operation
can begin from one deterministic resolver call instead of broad repository
archaeology.

TSK-001 established the architecture. TSK-002 implements only its first mandatory
MCP capability.

## 2. Applicable authority

Implementation is directed by:

- ADR-001 for the native-repository versus governance-MCP boundary;
- ADR-002 for local stdio transport and runtime/dependency decisions;
- ARC-001 for Claude Code primitive placement and token-economy constraints;
- SPC-001 for required resolver behavior;
- DAT-001 for exact tool input/output/error/fingerprint contract;
- canonical DEV FOUNDRY 2.1.0 implementation, sufficiency, validation, and
  side-effect rules.

## 3. In scope

TSK-002 delivers one atomic implementation capability:

- one project-scoped local stdio MCP server;
- exactly one MCP tool, `resolve_governed_operation`;
- deterministic task-bound and taskless governance resolution;
- deterministic role/profile selection;
- directed minimal authority references with SHA-256;
- required-assessment and required-gate routing identifiers;
- deterministic context fingerprint and stale-context rejection;
- project `.mcp.json` wiring;
- focused unit and stdio MCP smoke tests.

No MTP is required because the server, resolver core, configuration, and focused
proof form one coherent implementation boundary with one acceptance result.

## 4. Authorized implementation surface

The material implementation boundary is the minimal resolver capability.

The initial mutation-surface projection is:

- `package.json`;
- `package-lock.json`;
- `.mcp.json`;
- `src/governance-mcp/**`;
- `test/governance-mcp/**`.

The projection is not permission to mutate governance documents. Governance
artifacts, POP, bootstrap, framework release files, and task authority are hard
exclusions for the Implementation Executor.

Directly necessary projection variance is governed by OPS-007/OPS-008 and must
be reported with causal justification.

## 5. Dependencies

The task authorizes only the dependencies and versions accepted by ADR-002:

Runtime:

- `@modelcontextprotocol/server@2.2.0`;
- `zod@4.6.5`;
- `yaml@2.9.1`.

Development-only:

- `@modelcontextprotocol/client@2.2.0`.

The package lock is part of the accepted implementation surface.

## 6. Acceptance criteria

TSK-002 is implementation-complete when all of the following hold:

1. `npm test` passes from a clean dependency restore;
2. a stdio MCP smoke test lists exactly `resolve_governed_operation` and can
   call it through an MCP client;
3. the tool accepts DAT-001-valid input and rejects unknown/invalid input;
4. task-bound resolution can resolve TSK-002 by routed artifact identity without
   requiring the Authority Index route ID to equal `TSK-002`;
5. a taskless `author` boundary resolves without a synthetic task ID;
6. `implement` without `taskId` returns `INVALID_REQUEST`;
7. target mismatch returns `TARGET_MISMATCH`;
8. a deferred/incompatible requested role returns `ROLE_INELIGIBLE`;
9. a changed resolution source causes a prior
   `expectedContextFingerprint` to return `STALE_CONTEXT`;
10. missing, duplicate, malformed, or contradictory required authority fails
    closed as `AUTHORITY_INVALID` or `READ_FAILED` as DAT-001 defines;
11. success output contains references/hashes and does not dump authority
    document bodies;
12. the server performs no repository mutation, Git/provider action, credential
    operation, or network listen;
13. the project MCP configuration launches the server through local stdio using
    Node;
14. executor self-verification reports the exact changed surface and any
    projection variance;
15. post-execution governed mechanical validation passes against the resulting
    bound state.

## 7. Executor fit

The selected Implementation Executor is the separately bound
`process-bound-runner-code-executor` constrained by
`DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V1`.

Fit is PASS for this atomic boundary because:

- all product and architecture decisions are closed by ADR/SPC/DAT authority;
- one implementation subsystem and one transport are involved;
- dependencies are explicitly fixed;
- the mutation projection is narrow;
- proof is executable through Node/npm and stdio;
- promotion remains outside executor authority.

If the required Node/npm environment is unavailable, fit becomes BLOCKED rather
than authorizing a different implementation by assumption.

## 8. Hard exclusions

TSK-002 does not authorize:

- another MCP tool;
- generic file, shell, Git, provider, validation, promotion, or execution MCP
  wrappers;
- Hooks, Skills, subagents, agent teams, or `CLAUDE.md`;
- HTTP/SSE/WebSocket transport;
- auth, secrets, telemetry, cloud deployment, or persistent daemon behavior;
- framework or governance methodology changes;
- unrelated refactoring or repository cleanup.

## 9. Evidence expectations

Completion evidence includes:

- executor changed-surface report;
- focused self-verification including `npm test`;
- stdio MCP client/server smoke result;
- dependency lock state;
- post-execution repository state and diff;
- Governance Author projection reconciliation;
- governed mechanical validation;
- semantic self-assessment;
- independent Governance Audit only if an applicable trigger exists;
- promotion/integration state under the Operator's standing bounded
  authorization.

## 10. Completion policy

TSK-002 may become COMPLETE only after implementation, required reconciliation,
governed validation, and Governance Author self-assessment satisfy the acceptance
boundary.

Completion does not activate Hooks, Skills, subagents, or a Claude-native
Implementation Executor binding. Those remain separate future governed work.
