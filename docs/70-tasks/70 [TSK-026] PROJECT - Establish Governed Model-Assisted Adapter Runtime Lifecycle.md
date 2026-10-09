---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-026
  type: TSK
  title: Establish Governed Model-Assisted Adapter Runtime Lifecycle
  status: IN_PROGRESS
artifactVersion: "3"
authorityScope: tsk-026-governed-model-assisted-adapter-runtime-lifecycle
ownerRole: governance-author
canonical: true
scope:
  owns:
    - version-resolved-adapter-runtime-lifecycle
    - project-pinned-multi-version-installation
    - source-governed-model-assisted-self-update
    - recoverable-runtime-and-authority-cutover
    - adapter-142-to-managed-runtime-transition
    - cli-mcp-dashboard-telemetry-version-consistency
    - packaged-cross-platform-consumer-acceptance
  appliesTo:
    components:
      - claude-adapter-package
      - adapter-cli
      - governance-mcp
      - local-operations-dashboard
      - telemetry-launcher
      - consumer-migration-runtime
  excludes:
    - real-consumer-mutation-during-producer-development
    - consumer-product-code
    - reusable-methodology-change
    - silent-consumer-framework-adoption
    - silent-background-updates
    - producer-release-publication-without-separate-gates
    - implementation-before-explicit-executor-authorization
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-007
    - ADR-008
    - ARC-001
    - SPC-005
    - SPC-007
    - SPC-008
    - OPS-001
    - OPS-002
    - OPS-004
    - OPS-005
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  derivedFrom:
    - TSK-021
    - TSK-025
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-026] PROJECT - Establish Governed Model-Assisted Adapter Runtime Lifecycle

## 1. Operator intent and authority boundary

The Operator initially authorized only governed design; on 2026-10-09 the Operator **additionally authorized TSK-026 product implementation, focused in-scope corrections, and mechanical validation**, with explicit instruction to close material design/compatibility holes before execution. Release publication, global installation on the Operator host, consumer migration and final terminal claims remain excluded. Implementation requires a separately activated eligible Implementation Executor profile and an exact validated execution contract. This task is IN_PROGRESS, not implemented or released.

Baseline observed on 2026-10-09: producer `dev-foundry-claude` at clean main `588fd87fc0eb7ec1bfa0b512b929e17dbf02d391`; adopted immutable DEV FOUNDRY 2.1.0; shipped adapter 1.4.2. Prior TSK-025 and its implementation bindings are history and grant no new implementation authority. This task does not authorize any consumer operation.

## 2. Single capability and user-visible outcome

For an already-governed Claude consumer pinned to an exact self-update-capable adapter release, a normal request equivalent to “update DEV FOUNDRY Claude” SHALL result in a source-governed model workflow that discovers an explicit target, acquires and verifies the whole adapter side-by-side, reconciles any configured-authority delta with reserved Operator decisions, applies a recoverable cutover, and requests a fresh session that verifies the new CLI, MCP, dashboard, telemetry and authority. No user-run npm choreography or manual pin/hash/JSON editing is part of the normal upgrade path.

First-time greenfield/brownfield bootstrap remains CLI-first and requires explicit confirmation; a pre-1.4.0 consumer continues to use only a supported legacy bridge. Releases are not silently installed or adopted.

## 3. Architectural boundary and necessary code review

The target design in ADR-008 and ARC-001 separates (a) a small durable project-pin-aware launcher, (b) immutable version-addressed runtime installations, (c) deterministic package and migration tools, and (d) a Claude-orchestrated source-governed workflow. CLI, MCP, dashboard frontend/backend, telemetry launcher, shipped Skills/agents/templates, migration material, and bundled framework bytes share one verified adapter release identity; configured consumer authority is a distinct versioned state.

Before implementation, the Implementation Executor SHALL inventory and explicitly disposition current `src/adopt/{pin,upgrade,apply,migration,cutover,common}.js`, `src/governance-mcp/session.js`, `src/dashboard/command.js`, `src/telemetry/launch.js`, `bin/dev-foundry-claude.js`, template/Skill surfaces, packaging/release workflows and tests. Reuse deterministic integrity and recoverable-cutover primitives where correct. Refactor, consolidate or remove redundant paths when causally necessary. Do not grow a second conflicting verification, upgrade, evidence or authority engine.

No package version, exact next release number or publication authorization is inferred from this design.

## 4. Mandatory behavior and safety

The implementation SHALL satisfy SPC-008 sections 4–10 and 11 onward, ADR-008 and existing ADR-003/004/005/007 constraints. In particular:
- resolve an exact trusted target release and declared supported transition; never use mutable producer main or `latest` as migration authority;
- stage and verify without executing untrusted target install scripts, replacing source packages, writing project authority or changing the consumer pin;
- select runtime per consumer exact `<version>:sha256:<root>` pin; one project may upgrade while another retains an older version;
- keep source governance active through candidate review, exact plan/hash, reserved authorization, applicable validation/audit and cutover;
- cut over the adapter pin and authorized configured-authority delta as one recoverable logical transition, with durable journal, explicit intermediate states and documented recovery;
- invalidate stale source sessions and verify the new session independently before claiming complete;
- preserve historical records, code, evidence and unrelated project files, and preserve runtime versions still pinned or used by any consumer;
- distinguish rollback eligibility from forward recovery; unknown or ambiguous state blocks activation rather than guessing;
- require separate explicit framework-adoption authorization when a target requires a different DEV FOUNDRY release.

## 5. Acceptance matrix (all required for terminal PASS)

**A. Bootstrap boundaries.** Package installed from release asset without producer checkout on Windows/macOS; greenfield and brownfield initial CLI setup remain explicit, idempotent and preserve product files. Unsupported pre-baseline consumers fail closed.

**B. Initial 1.4.2 transition.** Exercise an **actual installed 1.4.2** consumer to the first new managed-runtime release using the declared one-time transition: package global/launcher reparenting, old self-pin preservation, bounded cutover, fresh start and recoverability. Do not assume the source release already implements the launcher.

**C. Multi-consumer isolation.** Two isolated consumers pinned to different immutable adapter identities launch their respective CLI/MCP/dashboard; upgrade A and prove B's files, pin, running session and active runtime unchanged. Package GC must not evict in-use or pinned versions.

**D. Runtime parity.** From an installed package verify CLI identity/version, MCP self-pin/startup fingerprint, dashboard frontend/server identity, telemetry collector/launcher, owned templates/Skills/agents and matching consumer pin. An already-running old dashboard must be detected; no arbitrary port/process termination.

**E. Semantic migration.** Synthetic release genuinely changes configured POP, index, bootstrap or profiles. The source-governed Claude workflow prepares semantically valid candidate under source authority, requests real reserved Operator choices, records audit disposition when triggered, refuses altered hash/authority, and only then cuts over. A deterministic-only fixture does not satisfy this case.

**F. Fault injection.** Inject crashes/restarts or power-loss-equivalent interruptions at download, verification, staging, preflight, authorization, plan writing, file writes, pin switch, journal commit, CLI/MCP/dashboard restart and final verification. Each case must end in intact source state, verified target state or documented recoverable blocked state; never an unobserved silent mixed authority.

**G. Negative and security tests.** Refuse unknown target/build, unsupported transition, ambiguous/dirty touched paths, symlinks/escape, tampered payload/manifest, wrong trusted source, executed package lifecycle scripts, stale plan, expired authorization, changed framework requirement, unresolved Operator choice, concurrent upgrades, unsafe cleanup and stale-session further governed work.

**H. Persistence and schemas.** Historical evidence retains original framework/schema meaning; dashboard serves compatible records or explicitly reports bounded degradation without data loss; old telemetry remains available. Release and upgrade state survive process exit.

**I. Cross-platform and packaging.** Tests use exact packed release assets and installed/runtime-resolved trees (not only source imports) on Windows and macOS; test Node/npm minimum-version failures and Windows file-lock behavior; full focused and regression suites, diff check and deterministic payload/release identity checks PASS.

**J. User workflow.** Initiate from natural request inside a governed Claude session. No required manual npm, hash-copying, JSON editing or repeated approval when the original exact scoped authorization remains valid. Advanced CLI remains usable for deliberate recovery and first setup.

## 6. Preparation sequence and gates

1. Governance Author completes ADR-008 selection, ARC-001 and SPC-008 reconciliations, this TSK and binding; records exact changed-path list, self-assessment and audit-trigger disposition.
2. Resolve TSK-026 against the resulting indexed authority; validate the documentation candidate and promote documentation only through independently verified gates when authorized.
3. The Operator authorized implementation on 2026-10-09. Governance Author SHALL first activate an exact TSK-026 bound Implementation Executor Capability Profile and validate one bounded contract, while preserving explicit hard exclusions and required evidence gates.
4. Implement through the four material proof boundaries in section 10 under the same TSK-026 identity. No artificial new TSK for directly necessary regressions. Each execution must produce its exact path manifest and self-verification; each downstream boundary re-observes actual integrated predecessor state.
5. Producer release publication and consumer adoption remain separately authorized post-validation actions.

## 7. Hard exclusions and stop conditions

No mutation to PagoElectronico or another consumer, immutable framework release, prior release tags/assets, unrelated provider auth, product code or framework methodology. No arbitrary network-exposed services, silent updater, bypass of Operator decisions, claim of atomic multi-file filesystem rename, automatic downgrade, or false claim that new runtime functions already exist.

Stop on missing binding, unsupported capability or host assumption, stale repository HEAD, package provenance uncertainty, cross-project mutation, unavailable required audit, scope expansion, unverified transition or indeterminate side effect.

## 8. Definition of preparation complete

The documentation-only preparation was integrated in main by PR #51 at 02074d1ae7ffa258a7895c17bec0f989631398fe. Product implementation authorization is now present but remains a distinct new phase. **IN_PROGRESS is not IMPLEMENTED, validation PASS or released.** Final implementation acceptance requires all section 5 gates and section 10 integration proof, with their actual provenance; Windows/Claude-model gates must not be silently replaced by fixtures.

## 9. Governance Author design self-assessment and deferred proof

- **Necessity and reuse:** ADR-007/SPC-008 already own source-governed semantic
  migration and side-by-side staging. ADR-008 adds only the previously
  undecided stable launcher/version-store design. ARC-001 and SPC-008 retain
  their authoritative ownership; no parallel methodology or duplicate package
  integrity engine is introduced.
- **State truth:** current 1.4.2 implements a partial migration substrate, not
  the stable version-resolved launcher nor a proven end-to-end model-assisted
  runtime lifecycle. This document claims only a governed PLANNED capability.
- **Security:** a payload hash is byte integrity, not publisher authenticity;
  trusted GitHub Release provenance/transport and target execution policy must
  be implemented and shown in the release trust model. No silent upgrade,
  global overwrite, or unverified package execution is allowed.
- **Actor fit:** the initial documentary Capability Profile was historicalized when
  the separately authorized TSK-026 implementation preparation began. Governance
  Author must bind the TSK-026 runner executor profile before code execution.
  The TSK-025 executor remains historical and cannot implement TSK-026.
- **Audit disposition:** adopted OPS-004 defines triggered independent audit.
  POP audit_triggers are empty; neither this task nor ADR-008 requires an
  independent audit for this document-only preparation, and the Operator did
  not request one. This is an Author trigger assessment, **not** an independent
  audit verdict. If a newly observed mandatory trigger appears, stop and
  satisfy it before promoting the affected boundary.
- **Acceptance/evidence:** repository path-set validation is distinct from
  metadata validation, semantic review, runtime E2E and eventual release
  acceptance. A documentation PASS never means CLI/MCP/dashboard update PASS.
- **Implementation-entry questions remain gated, not silently assumed:** exact
  trusted acquisition mechanism/host permission model, minimal supported
  Node/npm matrix, install-root ownership and launcher bootstrap on Windows,
  safe platform-dependent 1.4.2 handover, durable journal path/schema,
  package GC discovery across consumers, and full source/target host test matrix
  require validated concrete implementation choices **before** their relevant
  execution boundary. An unsupported assumption is a stop, not permission
  to broaden the task.

## 10. Bounded implementation sequence under one TSK

These are **proof boundaries within TSK-026**, not four new TSKs or four
independent release authorizations. A separate MTP artifact is unnecessary
unless a later concrete dependency/risk boundary requires one.

**B1 — Runtime foundation and identity resolution.** Review current pin,
package/prepack/release ownership and build the minimal per-user immutable
runtime store, project-scoped exact pinned dispatch, trust/provenance and
Windows/macOS portable verification primitives. Ship *no new release*. Focused
tests prove package N and N+1 coexist, neither can impersonate a different
pin, fail-closed untrusted archives, source-vs-target isolation, and no
unrelated consumer mutation. Implementation must present a specific
path projection (<=32 changed paths per bounded execution) before mutation.

**B2 — Governed migration and cutover.** Extend existing migration/upgrade/
cutover and session guards rather than building duplicates. Bind exact
candidate, Operator decisions, source authority and journaled transition;
cover crashes, lock concurrency, rollback eligibility, no post-stale work,
irreversible migration recovery, and the 1.4.2 one-time bridge.

**B3 — Model workflow and component parity.** Provide on-demand Claude
upgrade guidance/tool orchestration and stable CLI dispatch for runtime-aware
MCP, dashboard and telemetry; verify whole-package provenance, controlled
dashboard process lifecycle and user-facing status/doctor/recovery. Never add
an always-on governance agent for convenience.

**B4 — Integrated release-ready verification.** Build unreleased installed
package candidates and test real source 1.4.2 handover, two consumers, semantic
migration requiring actual source-governed model/Operator decisions, complete
fault/security matrix, historical telemetry/evidence, and host-native
Windows/macOS acceptance. Audit disposition, accurate limits and full tests
precede any implementation promotion. Publication/release/version adoption
require distinct later authorization.

A B1 implementation or test PASS cannot imply B2–B4 PASS; incomplete host,
model or provenance evidence is BLOCKED/INCOMPLETE, never a product defect by
default. Only directly necessary in-scope test corrections may be handled in
the same boundary.

## 11. Decisions fixed before B1 dispatch

**Distribution/trust.** The official GitHub Release repository identified in
ADR-005 is the initial allowlisted publisher/source for package acquisition.
Obtain through authenticated HTTPS/TLS GitHub origin (provider identity,
repository, immutable release/tag/asset identity, actual asset bytes, and
observed SHA-256). Also verify canonical payload self-pin and declared
supported source/target transition. A `SHA256SUMS` file downloaded from the
same release is a cross-check, **not an independent cryptographic signature**.
For a previously unknown version/build, show the operator exact target identity,
provenance and consequences before governed approval; do not silently treat
`latest` or an internal manifest as authentication. An offline package is
accepted only with independently selected exact trusted digest or explicit
bounded Operator approval of the origin and hash. Missing origin proof blocks
activation. No package lifecycle script executes before trust; unknown
provider implementation may not run as part of extraction.

**Install store.** Choose a per-user runtime root, defaulting to a
platform-appropriate user application cache/data directory (Windows:
LOCALAPPDATA; macOS: user Library/Caches; Linux: XDG_CACHE_HOME or user cache).
The exact normalized root and access permissions are testable. Never allow
project-local arbitrary symlink targets or cross-user elevation. One
version-plus-payload-root directory is immutable after complete verification.
Staging, locks, journals and recovery reservations are separate from
installed runtime trees and project authority. No globally destructive cache
GC or unbounded project discovery.

**1.4.2 handover.** The existing 1.4.2 CLI cannot bootstrap a future
version-manager protocol merely by a changed `.mcp.json` pin. The first
managed-runtime release must supply an explicit **one-time** verified host
bootstrap that preserves running 1.4.2 source process/bytes and requires
Operator approval. Normal managed-runtime subsequent upgrades are entirely
model-assisted; document any one-time host action transparently. No silent
global npm replacement or consumer rollback/reinstall. Existing support for
`dev-foundry-claude upgrade plan/apply` is not proof of this transition.

**Host acceptance.** Root package requires Node >=20 and is published as a
GitHub Release tarball (`private: true` in package.json is not npm-registry
distribution). Mac runner tests alone cannot establish Windows PASS.
A Windows isolated host or CI job against the exact candidate archive is a
mandatory B4 acceptance source; if unavailable, mark B4 BLOCKED, do not invent
Windows evidence. Windows locked-file and npm bin-shim behavior must be tested
natively. No source checkout can stand in for installed-package proof.

**Durable journal location.** The runtime-upgrade journal resides in a bounded
consumer-local `.dfc-runtime-upgrade/` directory, deliberately distinct from
`.dfc-cutover/` foreign-governance migration and all canonical
`.dev-foundry/` authority. The project must establish and verify a
repository-local ignore rule for this exact runtime path before any journal
write; missing or negated ignore rules block mutation instead of dirtying the
worktree. Journal path safety, symlink checks, owner-scoped locks and sealed
checkpoint records are required. Active startup and old session guards must
read this state and block on in-flight, malformed or unknown transactions,
even if the target CLI cannot start. B2 verifies this in isolated fixtures;
B3 extends bootstrap/doctor UX for new/legacy consumers. Runtime journal
retention follows recovery needs, not telemetry GC.

**Surface discipline.** Bounded execution contracts block `docs/`,
`.dev-foundry/` authority, immutable framework, consumers, package
publication, release workflow dispatch and secrets; allow only predicted
implementation/test/package surfaces. Avoid updating root version,
`migrations/release.json` targetVersion or claiming new public release while
building the feature. New dependencies require explicit inventory, necessity,
lockfile handling and authorization before their introduction.

## 12. Verification and handoff discipline

Before every bounded execution, the Author checks repository HEAD/branch,
task status, active POP/index/profile, exact contract path manifest, runner
execution fit and no implementation-owned governance mutation. The Executor
performs focused self-verification, corrects causally necessary within-scope
regressions, and reports every projection variance. A separate mechanical
validation checks independently observable proof; Author reconciles evidence,
self-assesses, and triggers independent audit only where OPS-004 requires it.
Do not run the full package/host test matrix for every small corrective when
focused proof suffices; full regression and installed package proof are B4 gates.

No release publication, global user installation or real consumer mutation
is implied by any passing B boundary. The source-bound feature is considered
implemented only after B1–B4 accepted evidence and Author final reconciliation.

## 13. B1–B4B observed implementation state and exact B4C gates (2026-10-09)

The following is an **Author reconciliation of runner evidence**, not an
independent audit or native host verdict. Implementation remains `IN_PROGRESS`,
and the Operator has **not** authorized public release publication, real
consumer adoption or host-wide replacement.

| Internal proof boundary | Local commit | Runner evidence | Boundary result |
| --- | --- | --- | --- |
| B1 immutable runtime/store | `02186b4` | focused 26/26, suite 349/349 | PASS for B1 only |
| B2 journaled governed transition | `5262d50` | focused 66/66, suite 419/419 | PASS for B2 only |
| B3 CLI/MCP/dashboard/telemetry | `76c48ef` | focused 12/12, suite 430/430 | PASS for B3 only |
| B4A offline acceptance harness | `ef9c7ba` | focused 21/21, suite 451/451 | PASS for harness only |
| B4B isolated one-time host bootstrap | `4f8216d` | focused 39/39, suite 483/483 | PASS for offline POSIX fixture boundary only |

The initial B4 broad run `req_aa9cc392a70025f99289666e53d66009`
was **FAIL** (`VALIDATION_FAILED`, zero product changes, missing focused
test files); this was resolved through the narrower B4A implementation
`req_7ecf307ebb5c4ab0b8ae4bdf142e0f01`, and its failure evidence
remains retained. B4B run
`req_9cbaeef9293f082cc77f1a1d86a5efd9` returned `passed` with four
bounded code/test changes, and its 483 tests passed. Neither result proves
published-source, Windows or real-Claude acceptance. `npm pack --dry-run`
and `git diff --check` passed in those internal runs.

### Required unresolved B4C proof — MUST NOT be inferred

1. **Windows implementation and host-native verification — BLOCKED.**
   A Windows path is intentionally rejected by
   `src/runtime/host-bootstrap.js` (`host-permissions-unsupported`),
   `src/runtime/store.js` (`store-permissions-unsupported`) and the
   `src/runtime/launcher.js` POSIX ownership checks. Merely adding a
   `windows-latest` job does not resolve these fail-closed gates. A bounded
   Windows security design must first provide and prove native ACL/owner
   validation, reparse/junction safety, hardlink and archive path policies,
   locked-file rename/recovery behavior, Windows Node 20/22 installer shims
   and durable journal/storage semantics. Do not replace OS-specific checks
   with unconditional bypasses or misleading `chmod` equivalence.
   The available connected Windows runner is bound to another consumer
   repository and is **not** authorized to mutate or execute this producer.
   Use a separately governed, isolated Windows job/runner for exact
   candidate evidence.
2. **Authentic published source 1.4.2 bridge — PENDING.** Verify official
   `mavalenzuela22/dev-foundry-claude` release tag `v1.4.2`, exact
   release asset and observed provenance, package-installed source and
   unchanged source bytes/session. B4A and B4B used isolated offline
   fixtures and cannot stand in for this. The source package must not
   acquire imaginary manager awareness.
3. **Same-commit, same-bytes native matrix — PENDING.** A separate
   non-publishing CI workflow may run macOS/Windows jobs only when
   their exact source commit, unreleased candidate digest, allowlisted
   asset provenance and raw machine evidence can be correlated. A
   workflow file alone or green Mac tests are not Windows PASS. Do not
   dispatch the release workflow, create a GitHub release or bump package
   version during this acceptance task.
4. **Actual source-governed Claude semantic/Operator gate — PENDING.**
   A real Claude session operating under current consumer source
   authority must generate and reconcile any semantic migration, and the
   human Operator must approve exact reserved decisions. Model mocks,
   fixture authorizations and this chat are not native acceptance. Verify
   fresh target session and independently evaluate any OPS-004 audit trigger.
5. **Final product boundary — NOT COMPLETE.** Obtain all preceding
   evidence, cross-check rollback/forward-recovery and source/consumer
   preservation, and only then reconcile implementation and consider
   governed promotion. Even an eventual implementation PASS does not
   authorize distribution, updating real users or a release workflow.

**Next valid execution** under this *same* TSK: prepare a narrowly projected,
native-Windows capability/security implementation and non-publishing
acceptance harness, with an isolated Windows execution route. Do not start
another costly producer implementation run that can only generate Mac
fixtures and would falsely be counted as B4C acceptance. A missing native
route remains an explicit BLOCKED gate, not a new TSK or a license to
reuse the Windows consumer runner.
