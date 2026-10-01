---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-004
  type: TSK
  title: Establish Claude Project MCP Launch Compatibility
  status: COMPLETE
artifactVersion: "2"
authorityScope: tsk-004-claude-project-mcp-launch-compatibility
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-project-mcp-launch-compatibility
  appliesTo:
    components:
      - claude-governance-mcp
  excludes:
    - claude-native-role-bindings
    - claude-code-cutover
    - skills
    - hooks
    - subagents
    - agent-teams
    - claude-code-settings
    - permission-policy
    - remote-mcp-transport
    - authentication
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ARC-001
    - OPS-001
    - OPS-002
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-002
    - TSK-003
lifecycle:
  phase: complete
  dependsOn:
    - TSK-002
    - TSK-003
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-004] dev-foundry-claude - Establish Claude Project MCP Launch Compatibility

## 1. Purpose and necessity

Make the existing project-scoped governance MCP configuration compatible with a future direct Claude Code session under current Claude Code configuration expansion semantics, without invoking Claude Code or performing the platform cutover.

Current provider documentation states that project-scoped MCP configuration is loaded from root `.mcp.json`, supports `${VAR:-default}` expansion, and that `CLAUDE_PROJECT_DIR` is supplied to the spawned MCP server rather than being available as a guaranteed host-side expansion value for `command` or `args`. The launch expression therefore needs a project-relative fallback while the server runtime continues to require the injected absolute project root.

This provider behavior is implementation evidence, not DEV FOUNDRY authority.

## 2. Applicable authority

- ADR-001: Claude-native repository versus governance-MCP boundary.
- ADR-002: local stdio runtime and project-root contract.
- ARC-001: dedicated minimal governance MCP architecture.
- TSK-002: delivered resolver.
- TSK-003: delivered minimal Claude startup bootstrap.

No new architecture decision is required. ADR-002 is reconciled in this task to state the host expansion/runtime-root distinction explicitly.

## 3. In scope

- `.mcp.json` launches the existing Node stdio server with `${CLAUDE_PROJECT_DIR:-.}/src/governance-mcp/server.js`.
- the existing MCP configuration test proves that exact launch expression;
- the server runtime continues to require `CLAUDE_PROJECT_DIR` as an absolute project root and does not infer governance authority from process cwd;
- all existing governance-MCP and bootstrap tests remain green.

The first interactive Claude Code session may still require Operator approval of the project-scoped MCP server. That is a future cutover precondition and is not automated by TSK-004.

## 4. Material implementation boundary

Initial mutation-surface projection:

- `.mcp.json`;
- `test/governance-mcp/server.test.js`.

No dependency, runtime-source, bootstrap, role-binding, or settings change is authorized.

## 5. Executor fit

While governance remains hosted from ChatGPT, implementation is performed by `codex-cli` through the runner under `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`. Claude Code is not invoked by this task.

## 6. Acceptance criteria

1. `.mcp.json` still defines exactly one local stdio server;
2. its command remains `node`;
3. its only server argument is exactly `${CLAUDE_PROJECT_DIR:-.}/src/governance-mcp/server.js`;
4. `alwaysLoad: true` is not introduced;
5. `src/governance-mcp/**`, `CLAUDE.md`, `package.json`, and `package-lock.json` remain unchanged;
6. the existing runtime still rejects an unavailable or non-absolute `CLAUDE_PROJECT_DIR` as `READ_FAILED`;
7. `npm ci`, `npm test`, and `git diff --check` pass;
8. executor changed-surface reporting is an exact projection match or reports a directly necessary variance;
9. governed post-execution mechanical validation passes;
10. no Claude Code execution is required for acceptance.

## 7. Hard exclusions

TSK-004 does not authorize Claude-native role bindings, direct Claude Code execution or cutover, runtime-source changes, Skills, Hooks, subagents, agent teams, settings, permissions, sandbox policy, dependencies, authentication, remote transport, automatic MCP approval, workspace trust manipulation, or unrelated cleanup.

## 8. Evidence expectations

Completion evidence includes the exact two-path changed surface, full test result, post-execution validation, regression proof, Governance Author reconciliation/self-assessment, audit only if triggered, and promotion/integration state.

## 9. Completion policy

TSK-004 may become COMPLETE only after exact-scope implementation, governed mechanical validation, and Governance Author self-assessment satisfy the acceptance boundary.

Completion establishes repository-side MCP launch compatibility. It does not establish Claude-native role bindings and does not perform the Claude Code cutover.

## 10. Completion result

TSK-004 completed with an exact projection match. Codex changed only:

- `.mcp.json`;
- `test/governance-mcp/server.test.js`.

Governed execution
`execution_6867caa5f8ccca8482d8ae49e59f51309041394e6b8bf4eb29400c214814d12a`
completed PASS with path policy PASS, zero violations, executor exit code 0, and
runner exit code 0. `npm ci`, `npm test`, and `git diff --check` passed.
The full suite reported 22/22 tests passing, including the existing bootstrap and
governance-MCP regression coverage.

Governance Author projection reconciliation is `projection match`. Semantic
self-assessment found the launch expression exactly aligned with ADR-002 and the
TSK-004 acceptance boundary, with no runtime-source, dependency, bootstrap,
binding, settings, permission, or Claude Code execution changes.

No independent Governance Audit is required for this completion boundary because
no framework, project, task, separation-of-duty, or Operator trigger applies.

Claude-native role bindings and direct Claude Code cutover remain separate future
governed work.
