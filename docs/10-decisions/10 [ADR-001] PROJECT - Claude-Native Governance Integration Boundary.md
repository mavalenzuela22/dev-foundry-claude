---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-001
  type: ADR
  title: Claude-Native Governance Integration Boundary
  status: ACCEPTED
artifactVersion: "1"
authorityScope: dev-foundry-claude-native-governance-integration
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-native-repository-operation-boundary
    - claude-governance-mcp-boundary
    - token-economy-architecture-principle
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - governance-mcp-implementation
    - hook-implementation
    - skill-implementation
    - subagent-implementation
    - provider-authentication
    - provider-routing
authority:
  governedBy:
    - OVR-001
    - OPS-007
    - OPS-009
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-001] dev-foundry-claude - Claude-Native Governance Integration Boundary

## 1. Context

`dev-foundry-claude` exists to make DEV FOUNDRY usable natively from Claude
Code without reconstructing repository authority in every conversation.

Claude Code already reads and edits the working repository, runs shell commands,
works directly with Git, and can create branches, commits, and pull requests.
The process-bound runner used by other integrations exists partly because those
surfaces do not have equivalent direct repository access.

The adapter must therefore avoid paying model-context, tool-discovery, and
implementation complexity for a second repository-control layer that Claude
Code does not need.

## 2. Decision

The project SHALL separate the Claude Code adapter into two responsibility
planes.

### 2.1 Native repository plane

Claude Code native capabilities own ordinary repository work, including:

- repository inspection and search;
- file creation and editing;
- shell/build/test execution;
- Git branch, diff, commit, and reconciliation work;
- provider CLI operations such as pull-request creation and promotion when
  separately authorized.

The project SHALL NOT recreate generic repository read/write/Git/provider
operations behind a Claude-specific MCP merely to mirror the process-bound
runner.

### 2.2 Governance resolution plane

A dedicated Claude governance MCP SHALL provide deterministic DEV FOUNDRY
governance capabilities that are not equivalent to generic repository access.

Its initial mandatory capability is operation-scoped governance resolution
equivalent in responsibility to `resolve_governed_operation`: resolve exactly
one role/profile, applicable authority, bounded lifecycle requirements, required
assessments/gates, and a context fingerprint for one governed operation.

Additional MCP tools MAY be added only when a concrete task demonstrates that
they provide deterministic governance value that Claude Code native mechanisms
cannot provide more simply.

The initial design intent is governance-first and read-oriented. Repository
mutation, Git transport, provider promotion, and generic command execution are
not MCP responsibilities.

## 3. Token-economy invariant

The adapter SHALL treat model-context consumption as a constrained resource.

It SHALL prefer:

- minimal always-loaded bootstrap instructions;
- directed authority retrieval instead of broad methodology reconstruction;
- on-demand behavior packages instead of permanent prompt expansion;
- isolated contexts for bounded specialist work when isolation produces a net
  context or cost benefit;
- deferred MCP tool definitions when the Claude Code host supports tool search.

The project SHALL NOT duplicate the adopted DEV FOUNDRY release into
`CLAUDE.md`, Skills, subagent prompts, MCP descriptions, or generated summaries
as a second methodology source.

## 4. Bootstrap-resolution requirement

A legitimate governance operation can exist before a product TSK exists, for
example the authoring of the first TSK or a project-adoption reconciliation.

The Claude governance resolver SHALL support that class of operation without
requiring a fabricated TSK identifier or forcing broad repository archaeology.
This may be represented by a taskless governance boundary or another explicit
bootstrap-resolution form, but the caller must not manufacture product
authority merely to satisfy the resolver.

## 5. Alternatives considered

### Reuse the complete process-bound runner surface

Rejected for the Claude adapter. It duplicates repository capabilities Claude
Code already has and increases tool/context surface without corresponding
governance value.

### Use prompts only and no governance MCP

Rejected. Prompt instructions are behavioral context, not deterministic
resolution or enforcement, and would push repeated authority reconstruction
back onto the model.

### Put all DEV FOUNDRY methodology in permanent Claude instructions

Rejected. It duplicates authority and creates recurring token cost while making
staleness more likely.

## 6. Consequences

- Claude Code remains the direct repository worker.
- The Claude governance MCP can remain small and purpose-specific.
- Governance resolution becomes the primary entry point for governed work.
- Hooks, Skills, subagents, and bootstrap instructions remain available for
  separate project-specific responsibilities without becoming methodology
  authority.
- Implementation details and exact MCP schemas require later governed work.
