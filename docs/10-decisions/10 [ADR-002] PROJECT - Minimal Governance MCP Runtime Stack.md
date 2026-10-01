---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-002
  type: ADR
  title: Minimal Governance MCP Runtime Stack
  status: ACCEPTED
artifactVersion: "2"
authorityScope: dev-foundry-claude-governance-mcp-runtime
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governance-mcp-transport
    - governance-mcp-runtime-stack
    - governance-mcp-dependency-boundary
  appliesTo:
    components:
      - claude-governance-mcp
  excludes:
    - generic-repository-control
    - remote-mcp-service
    - authentication
    - hooks
    - skills
    - subagents
authority:
  governedBy:
    - ADR-001
    - OVR-001
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-002] dev-foundry-claude - Minimal Governance MCP Runtime Stack

## 1. Context

ADR-001 requires a dedicated Claude governance MCP while keeping ordinary
repository inspection, editing, shell, Git, and provider work native to Claude
Code. ARC-001 requires the MCP surface to remain small and context-efficient.

Claude Code currently supports project-scoped local stdio MCP servers and sets
`CLAUDE_PROJECT_DIR` for spawned stdio servers to the stable project root.
Current Claude Code also defers MCP tool schemas through tool search in supported
deployments, reducing always-loaded context.

The official MCP TypeScript SDK v2 is the stable SDK line for the MCP
2026-07-28 specification.

## 2. Decision

The initial Claude governance MCP SHALL be a project-scoped local stdio server.

The TSK-002 implementation stack is:

- Node.js 20 or newer;
- ECMAScript modules;
- `@modelcontextprotocol/server` version `2.2.0`;
- `zod` version `4.6.5` for tool input validation;
- `yaml` version `2.9.1` for parsing project/configured authority and
  DAT-008 frontmatter without a project-local parser;
- Node's built-in test runner for focused tests;
- `@modelcontextprotocol/client` version `2.2.0` as a development-only
  dependency when needed for the stdio MCP smoke test;
- a committed `package-lock.json` for deterministic dependency resolution.

The project-scoped Claude Code connection SHALL be declared in `.mcp.json`.
The server SHALL use `CLAUDE_PROJECT_DIR` as its project-root input and SHALL
not depend on Claude Code's current shell working directory.

## 3. Runtime boundary

The server is a read-oriented governance control plane.

It MAY read the configured project authority and the selected immutable
framework release needed to resolve one operation.

It SHALL NOT:

- expose generic file-read, file-write, shell, Git, or provider tools;
- mutate repository files;
- create commits, branches, pull requests, or merges;
- listen on a network socket;
- expose HTTP, SSE, or WebSocket transport in TSK-002;
- read or manage credentials;
- copy DEV FOUNDRY methodology into MCP descriptions or generated prompts.

## 4. Tool loading and context

The server initially exposes exactly one tool: `resolve_governed_operation`.

The project SHALL rely on Claude Code's normal MCP tool-search/deferred-definition
behavior rather than setting `alwaysLoad: true` in TSK-002.

Server instructions and tool descriptions SHALL remain concise and explain when
Claude should search for the resolver. Detailed methodology remains in repository
SoT and is returned only as directed authority references.

A later task may change loading behavior only from observed host behavior or a
concrete usability need.

## 5. Dependency policy

TSK-002 authorizes only the runtime and development dependencies named in this
ADR. `yaml@2.9.1` is directly necessary because the resolver must parse the
project POP, Authority Index, framework/configured YAML, and Markdown
frontmatter; a bespoke YAML parser is outside the minimal safe boundary. Adding
another production or development dependency requires a directly necessary
in-boundary justification that preserves OPS-007/OPS-008 semantics or new
authority when it constitutes a material dependency decision.

## 6. Consequences

- The MCP can run locally without creating another network service.
- Claude Code supplies stable project-root context.
- The runtime dependency surface stays small.
- The server remains independently testable outside a full Claude session.
- Generic repository operations remain native to Claude Code as required by
  ADR-001.
