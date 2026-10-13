# dev-foundry-claude

Verify that the current repository is `dev-foundry-claude` before governed work.
Locate the project operating profile at `.dev-foundry/profiles/project-operating-profile.yaml`
and the project Authority Index at `.dev-foundry/authority-index.yaml`.

Use `resolve_governed_operation` as the deterministic governance entry point for the current bounded operation.
After `resolve_governed_operation`, the Governance Author calls `assess_predelegation_readiness` before implementation delegation; its diagnostic handoff does not authorize dispatch.
Treat `INDETERMINATE` as advisory: continue permitted Governance Author reading, evidence, and documentation while completing the existing independent native/host authorization and executor checks. Do not repeat the diagnostic or invent evidence.
Resolve and bind exactly one operation-scoped role and its applicable profile before role-dependent work.
Read only the authority references directed by the resolver for that operation.

Repository SoT and the adopted DEV FOUNDRY framework govern.
`CLAUDE.md`, memory/history, generated summaries, runtime records, and other repositories are not authority.

Fail closed on repository identity, authority, profile, role, required capability, or bound-state mismatch.
Stop without proceeding when any required binding is missing, unresolved, stale, or conflicting.
