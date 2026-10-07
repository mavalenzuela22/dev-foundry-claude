---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-006
  type: ADR
  title: Beginner-First Self-Explaining Consumer Experience
  status: ACCEPTED
artifactVersion: "2"
authorityScope: beginner-first-self-explaining-consumer-experience
ownerRole: governance-author
canonical: true
scope:
  owns:
    - beginner-first-consumer-experience
    - progressive-disclosure-of-governance
    - human-first-cli-language
    - next-action-guidance
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-cli
      - claude-governance-mcp
      - consumer-documentation
  excludes:
    - reusable-dev-foundry-methodology
    - consumer-product-code
    - consumer-authority-semantics
    - provider-authentication
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - OPS-007
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-006] PROJECT - Beginner-First Self-Explaining Consumer Experience

## 1. Context

The adapter is mechanically rigorous but dogfooding showed that a new consumer can
encounter methodology vocabulary, lifecycle mechanics and low-level diagnostic
codes before receiving the first practical benefit.

That is the wrong product boundary for a developer who is escaping unstructured
AI-assisted development and has only just learned what DEV FOUNDRY is.

The internal governance model may remain sophisticated. The normal consumer
experience must not require the user to understand that sophistication before the
adapter can be installed, configured, started, checked, upgraded or repaired.

## 2. Decision

1. The normal consumer experience SHALL be organized around human goals rather
   than governance artifact types.
2. The primary CLI verbs are:
   - `setup` — prepare or guide preparation of the current project;
   - `start` — launch Claude through the supported DEV FOUNDRY telemetry path;
   - `status` — answer whether the project is ready to work and what needs attention;
   - `upgrade` — safely move the integration to a newer adapter release;
   - `doctor` — diagnose integration problems and recommend a concrete next action;
   - `help` — explain product usage and concepts on demand.
3. A normal user SHALL NOT need to create or understand TSK/MTP artifacts,
   Project Operating Profiles, Authority Indexes, Actor Profiles, Capability
   Profiles, evidence envelopes or promotion boundaries merely to install or
   begin using the adapter.
4. Governance internals remain enforceable and inspectable but SHALL use
   progressive disclosure:
   - human explanation first;
   - technical term or diagnostic code second;
   - full internal detail only in verbose/advanced output.
5. User-facing failures SHALL explain:
   - what happened;
   - whether application code was or may be affected;
   - what the user should do next.
6. Successful commands SHALL also provide a useful next action when one exists.
7. The adapter SHALL maintain one canonical help content source that may be
   surfaced through both CLI help and read-only MCP resources.
8. The recommended post-installation path SHALL answer the question
   "I installed it; what do I do now?" without requiring external documentation.
9. For a repository with no DEV FOUNDRY configuration, that answer SHALL not stop
   at "adopt DEV FOUNDRY first." Guided setup SHALL preview the minimum initial
   bootstrap, request only non-derivable human choices, require explicit Operator
   confirmation, and lead to the first governed Claude launch without requiring
   manual POP/Authority Index/TSK construction.
10. A supported pre-self-update consumer SHALL receive a human-guided one-time
    legacy bridge to the self-update baseline rather than requiring reinstall from
    scratch.
11. From the self-update baseline forward, a migration that requires semantic or
    configured-authority reconciliation SHALL be guided by the currently governed
    Claude session under source authority. After cutover, that source session SHALL
    stop and the product SHALL direct the user to start a fresh session.
12. `start` is the recommended way to start Claude for a configured consumer
    because it owns the packaged telemetry-launch experience and makes local
    observability discoverable.

## 3. Product language

User-facing output SHALL prefer project-level language.

Examples:

- prefer "This project needs setup" over "binding inactive";
- prefer "Some DEV FOUNDRY-managed files need to be refreshed" over exposing
  `upgrade-migration-required` as the primary message;
- prefer "Your application code will not be changed" over requiring the user to
  infer write boundaries from manifests.

Technical codes remain available for support and advanced users.

## 4. Consequences

- README becomes an entry point, not the complete operating manual.
- CLI/MCP help becomes version-aligned with the installed adapter.
- Product commands may orchestrate low-level plan/status/apply, initial bootstrap,
  legacy bridge and governed self-update mechanics but SHALL NOT weaken their
  fail-closed behavior.
- Beginner-first does not mean hiding authorization: the product asks the human
  for the decisions and approvals that cannot be derived safely, while keeping
  internal artifact mechanics behind progressive disclosure.
- Internal governance terminology remains documented for advanced users without
  blocking first value.
