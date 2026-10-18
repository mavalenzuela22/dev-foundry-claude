---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-029
  type: TSK
  title: Adopt DEV FOUNDRY 2.3.0 and Align Claude Governed Roles and Skill
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-029-framework-230-skill-claude-role-adoption
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-project-adoption-of-dev-foundry-2-3-0
    - claude-native-governed-operation-skill-alignment
    - effective-role-handoff-and-minimal-sot-delivery
  appliesTo:
    components:
      - producer-framework-integrity-and-adoption
      - project-pop-v3-authority-index-bootstrap-and-actor-binding
      - claude-adapter-mini-mcp-runtime-and-integration
      - claude-author-executor-auditor-guidance-and-evidence
      - targeted-product-and-adoption-regressions
  excludes:
    - mutation-of-upstream-dev-foundry-canonical-release
    - mutation-of-immutable-2-1-0-or-2-2-0-methodology
    - mutation-of-consumer-repositories-including-pagoelectronico
    - automatic-adapter-release-publication-or-consumer-repin
    - foundry-runner-product-mutation-or-alternate-repository-runner-dependency
    - retrospective-rewriting-of-tsk-028-execution-evidence
    - duplicate-audits-or-new-infrastructure-without-mandatory-cause
authority:
  governedBy:
    - ADR-001
    - ADR-003
    - ADR-004
    - ARC-001
    - SPC-001
    - SPC-003
    - SPC-008
    - DAT-001
    - DAT-002
    - OPS-001
    - OPS-003
    - OPS-004
    - OPS-005
    - OPS-006
    - OPS-007
    - OPS-008
  supersedes:
    - TSK-028
traceability:
  derivedFrom:
    - TSK-027
    - TSK-028
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-029] PROJECT - Adopt DEV FOUNDRY 2.3.0 and Align Claude Governed Roles and Skill

## 1. Operator direction and current authority

On 2026-10-17 the Operator explicitly superseded TSK-028's **unfinished**
DEV FOUNDRY 2.2.0 adoption in favor of one governed **2.3.0** adoption and
a focused review of the **currently installed ChatGPT `dev-foundry/governed-operation`
Skill** to adapt its useful behavior to `dev-foundry-claude`. Preserve TSK-028
as historical evidence: its A1 request failed before Codex invocation with
`EXECUTOR_UNAVAILABLE` (invalid process-bound model-selection profile
reference), changed zero product files, and established no implementation PASS.
No 2.2.0 adoption, valid executor result, audit PASS, or publication is inherited
by TSK-029.

This task is created under the **currently adopted DEV FOUNDRY 2.1.0** SoT,
which remains normative until an explicit governed 2.3.0 adoption. Do not
silently reinterpret the old POP v2 binding, evidence, contracts or task outcomes
as POP v3. TSK-028's target and any old A1 contract are historical only and
must not be reused as live execution authorization.

## 2. Confirmed source and impact

Read-only access to the separate process-bound **normal Runner** verified
the upstream repository `dev-foundry`, currently `main` at
`4b1d1ac210357585e3d4f4d098f417fb94387aca`, with clean worktree and
active POP adoption 2.3.0. The upstream release is canonical and includes:

- `.dev-foundry/releases/2.3.0/release-integrity-manifest.yaml`:
  SHA-256 `cd06bf6ac4f57462598b9fe63a61779ca8f712a88b210f6d1444bd12426d12e8`.
- `.dev-foundry/releases/2.3.0/authority-index.yaml`:
  SHA-256 `ae322e07ad4a7aba76b6c241d5238fd29034b083006cdd69f20d3d4c36f4d998`.
- Source candidate: `DF-CANDIDATE-005`; canonical parent 2.2.0.
- **24/24** manifest-listed source SHA-256 files independently re-read and
  matched using the upstream Runner (8+8+8); reuse that verified provenance
  rather than repeating the same proof without changed state.

Version 2.3.0 preserves POP v3 operation-scoped role/implementation selection
and DAT-022 INT-001..005 interoperability from 2.2.0. Its material distinction
includes **Governance Author v4**, OPS-007 necessity/no-change/reuse and
OPS-004 §6's **independent audit only on an actual mandatory external, project,
material-separation or explicit Operator trigger**; OPS-005 §8 does not
require an independent audit for canonical framework promotion by default.
No model/provider/tool/self-assessment label is independent audit evidence.

The installed ChatGPT Skill now explicitly supports 2.1.0, 2.2.0 and 2.3.0
and supplies version-specific operational maps/kernel rules and contextual
routing. Its useful operational additions must be reviewed against the
adopted repository's actual authority and Claude Code runtime, including:
exact source-directed SoT and typed-assessment minimality; `TASK_NOT_FOUND`
versus unsupported task-schema recovery; specific diagnostics; operation-scoped
capability/role authorization; audit independence by actual participation;
frozen findings and objective documentary closure; validation/evidence reuse;
asynchronous no-poll behavior; and OPS-007 proportionality. ChatGPT's
process-bound Runner APIs, events and session state are **not** installed in
consumer Claude Code and must **not** be copied as dependencies.

## 3. Acceptance is useful product delivery, not paperwork

**Governance Author** resolves exactly the material authority needed; handles
valid caller mistakes with one actionable correction, genuinely unsupported
task representations through verifiable bounded source recovery without
bypassing supported closed gates; distinguishes missing authority from
unsupported tool surfaces; decides scope, authorization and role before
delegating; never re-reads every SoT document or loops on the mini MCP.

**Implementation Executor** receives one approved objective, limited paths,
hard exclusions, direct SoT references and focused tests, **actually changes
the authorized product**, performs minimal self-verification, and returns
changed paths, state and causal proof. A Runner transport PASS or empty patch
is not a product implementation PASS. No broad repository reading, re-governance,
foreign Runner calls or automatic scope expansion.

**Governance Auditor**, only when actually triggered, independently examines
the exact material subject and trustworthy prior participation; no new
attestation service, no assumption that a different session/model automatically
proves eligibility, no fresh audit for a merely objective documentary correction
when frozen closure predicates can be verified against original durable lineage.
Unresolved independent semantic judgment receives only an eligible bounded
review. Preserve original audit history and findings.

**Shared acceptance**: preserve existing two-tool stdio mini MCP, supported
DAT-001/DAT-002 response semantics, read-only diagnostics and host-authorization
boundary; keep consumer Claude independent of Foundry Runner; minimize prompt
and SoT volume using source paths/section IDs/hashes, not replicated methodology;
use existing role templates, tests and telemetry wherever adequate rather
than adding new services/profiles/permanent ceremonies. Existing consumer
2.1.0 pins, published adapter 1.4.2, immutable 2.1.0 files and historical
TSK-028 evidence must not be reinterpreted or mutated.

## 4. Minimal delivery sequence

1. Establish the full **2.1.0 → 2.3.0** normative delta, especially the
   2.2.0 interoperability changes and the 2.3.0 audit/Author changes.
   Verify source provenance; copy the exact canonical 2.3.0 release artifacts,
   not 2.2.0, into a separate immutable producer tree. Never flip adoption
   pointers until required manifest/bytes are complete and verified.
2. Reconcile the affected project POP to `dev-foundry.project-operating-profile.v3`,
   the index to adopted 2.3.0, and the needed bootstrap to v3. Bind
   `governance-author-v4.yaml`; retain other unchanged Actor Profiles at
   their canonical 2.3.0 paths. Carry historical concrete v2 implementation
   facts as separate scoped selection evidence, not permanent POP allowlists.
   Preserve process-bound executor/mechanical-validator eligibility.
3. Use a **minimal governed implementation handoff** for the exact consumer
   product impact: v3 schema support in `src/governance-mcp/resolver.js`,
   startup/activation/session projections, product-facing role templates and
   local mini MCP descriptions, focused regressions, and packaged framework
   identity as actually required. Preserve 2.1.0 compatibility where existing
   consumers require it; never let an incomplete v3 migration return false
   `READY` or authorize execution.
4. Verify substantive product changes with focused tests and independently
   valid mechanical evidence. Complete Governance Author semantic
   self-assessment and evaluate **actual** audit triggers; do not demand a
   fresh auditor without a mandatory source. Reconcile actual resulting paths.
5. Govern a single authorized promotion to `main` and close TSK-029 on
   acceptance. Release publication/version bump and consumer adoption remain
   separate, non-automatic boundaries.

No MT or separate corrective is required merely because version 2.2.0 was
superseded, an old execution failed before dispatch, or a new Skill exists.
New prerequisites, checks, implementation phases or artifacts require
a concrete necessary source and material consequence.

## 5. Failure classification and stop boundaries

A tool/transport/model-selection failure is not a product FAIL. Recover
a prior terminal no-effect execution only after confirming immutable state and
actual available execution capability. Do not repeatedly launch a known
unavailable executor, bypass eligibility with another tool, reinterpret
required independent audits as self-review, adopt incomplete authority,
alter upstream/consumer repositories, or publish the adapter automatically.
Report the exact remaining prerequisite when one cannot be satisfied
with existing authorized capabilities.


## 6. Operator acceptance priority — least tokens per correctly finished operation

The Operator authorizes the necessary bounded project and product implementation
under TSK-029, with **correctly completed governed work per token consumed** as
the primary operational objective. Token economy is a design/acceptance quality,
not permission to skip required security, authority, independent separation when
triggered, mechanical validation or acceptance. No arbitrary static token quota
or universal target number is imposed.

Governance Author MUST choose the smallest exact SoT slice, make required
decisions once, produce a precise handoff (objective, current scope/branch,
role/Actor Profile, relevant authority paths/sections/hashes, authorized effects,
hard exclusions, necessary proof) and route recoverable caller mistakes to
one correction instead of repeatedly calling the mini MCP. Absence or conflict
in mandatory live authority remains blocked. A host-specific Runner resolver
or handoff must never become a Claude Code consumer dependency.

Implementation Executor MUST consume the directed slice, apply **material
authorized edits** with the smallest focused regression tests, identify actual
changed paths and proof, and stop on genuine material scope expansion.
Successful transport, an empty patch, a test-only run or an unchanged worktree
does NOT establish implementation acceptance for work requiring code changes.
The Author owns change/projection reconciliation and any reserved decisions;
Executor MUST NOT reinvent governance or recursively scan unrelated SoT.

Governance Auditor is dispatched **only when current applicable methodology,
project policy, external control, material separation, or Operator intent
actually triggers independent review**. Different model/subagent by itself
does not establish independence; verify material participation if triggered.
Preserve frozen independent audit lineage and apply attributable objective
finding closure rather than routine fresh audits for documentation fixes.
No replacement audit ceremony may be created by renaming self-assessment.

**Practical acceptance proof:** demonstrate at least one nontrivial, targeted
Author→Executor handoff with bounded references and changed product behavior
against the actual consumer MCP/bootstrap/role guidance tests; assess Auditor
instructions with a triggered and a non-triggered fixture/behavioral case,
without manufacturing a real audit obligation. Reuse already installed test
harness and, when actually available, existing telemetry to observe SoT
read breadth, redundant tool calls, executor output and token consumption.
Report observed baseline/comparison only when comparable measurements exist;
otherwise disclose missing measurements rather than fabricating a cost PASS.
No permanent instrumentation, third MCP tool or telemetry dependency is
needed solely to satisfy this TSK.

**OPS-007 proportionality / decision:**
- No-change is insufficient for consumer v3 operation selection: the current
  `src/governance-mcp/resolver.js` hard-pins `2.1.0`, POP v2 fixed
  implementations and `src/adopt/activation.js` accepts only v2.
- Reuse existing stdio two-tool mini MCP, existing role agents, existing
  bootstrap/activation guard, existing focused tests and telemetry; do not
  introduce a replacement governance engine.
- Implement only the actually touched compatibility and role guidance
  components. Source packaging/adoption and producer POP migration remain
  distinct Author-owned governance steps; no executor may mutate active POP,
  Authority Index, versioned immutable releases, task SoT or a consumer repo.
- Preserve supported v2 consumer behavior; do not infer v3 `READY` merely
  from an active POP role. Concrete operation capability and attribution need
  trustworthy evidence, otherwise return an actionable bounded
  BLOCKED/INDETERMINATE consistent with the supported wire contract.
- Focused tests and preserved negative security cases precede any necessary
  independent product validation. Broader tests only when affected integration
  makes them material; independent Audit only when its real trigger is named.
- Stop if completion requires a new public capability, a new policy decision,
  a new service or crossing a hard exclusion; Author reconciles exact evidence
  and scope, rather than having Executor improvise.

**Sequencing:** The authenticated 2.3.0 release was imported and committed
unchanged at `1531506fd099bbdf2e0baa356ee58c5eaef4bda3` (25 files,
24/24 artifact hashes). It is a verified candidate, **not yet the active
project release**; active producer POP/Authority Index still select 2.1.0.
The next Executor change must keep producer governance source intact.
Author-owned explicit POP v3/Bootstrap v3/index switch only after the
interoperability and installation effects actually required by that migration
are verified.

## 7. Claude Code native token-economy review (official documentation)

The Operator explicitly required consulting Anthropic's current Claude Code
best practices and cost/context guidance **before** code implementation.
Official references reviewed on 2026-10-17 (documentation can evolve):
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/costs
- https://code.claude.com/docs/en/features-overview
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/memory

**Documented native facilities and material consequence for this adapter:**

1. `CLAUDE.md` content is loaded in ordinary sessions and subagents; Anthropic
   recommends concise always-applicable instructions (roughly under 200 lines),
   with task-specific reference material in on-demand Skills or path-scoped
   rules instead. Imports are eagerly expanded, so do not fake economy by
   importing entire SoT. Preserve a **small** managed governance block that
   tells Claude where/how to locate *exact* current authority, not the text
   of that authority.
2. Skills are invoked on demand; subagents have an **independent context and
   their own billed usage**. A role subagent does not automatically inherit
   parent's conversational facts, but it does ordinarily receive Claude.md
   and other startup configuration. Send an explicit concise handoff with
   source pointers and bounded proof rather than forcing it to rediscover
   the project. Do not introduce additional subagents, agent teams, preloaded
   Skills or new Skill files absent a demonstrated recurring product need.
3. Claude Code already supplies native file search/edit, CLI, commands,
   permission controls, sandbox, context inspection/compaction, model and
   effort selection, and subagent tool restrictions. Reuse them; the existing
   two-tool stdio mini MCP should focus narrowly on **source-governed role,
   authority, and predelegation diagnostics**, never duplicate native file
   access, shell, dispatch, permission enforcement, or monitoring.
4. Model/effort, compact/clear, focused test verification and structured
   outcomes are options of the host. Do not add forced model pins, model
   selection inside mini MCP, global token quotas, blanket context clears,
   automatic new sessions or a new billing/telemetry subsystem. Existing
   telemetry can provide comparative observation *if actually accessible*.
5. A handoff that supplies precise changed targets and runnable focused
   acceptance checks is preferable to vague repository exploration. Claude
   Code's documented verification pattern relies on observable behavior,
   tests/diffs and truthful result, not merely on a success statement.
6. Hooks are appropriate only for already-proven, absolutely necessary
   deterministic enforcement; skill/CLAUDE.md instructions do not enforce
   permissions. Keep existing native authorization/security boundaries and
   **do not add a hook** to this TSK without a concrete unmet requirement.

**OPS-007 outcome:** No new token-optimization mechanism is justified.
The necessary delta is to update existing bootstrap/managed guidance, v3
role/authority resolution and consumer adoption compatibility, and focused
regressions. Preserve current proven behavior in 2.1.0 consumers. Exclude
unrelated hooks, agents, Skills, prompt-cache tuning, command wrappers and
quantitative cost claims not supported by real measurements. The implementation
executor may use native focused search and tests inside its authorized product
boundary, with no read/retry loop or blanket preloading of SoT.

## 8. C001 terminal evidence, minimal corrective and certification research

Operator supplied an explicit FAIL signal for the **first real TSK-029
product implementation**, accepted request
`req_bb127980a8fe0c1583940dd05edfcf5b`, execution
`execution_7c9c7a24e15cd4168fbb632d118323acb91a6b695a66944429747d78d5f4fffc`,
from clean HEAD `7495abf92a763326d7635a665066b51a993cc579`.
Terminal: `PATH_POLICY_FAILED` + `VALIDATION_FAILED`.
Codex actually executed (`exitCode: 0`) and produced 20 material changed
paths, **not** an empty implementation. Runner post-execution validation
reported **188 pass / 3 fail** out of 191 assertions; `git diff --check`
PASS. The failures are two onboarding subtests (greenfield, brownfield) and
their enclosing suite: rendered setup CLI text reports version 2.1.0 while
new adoption records describe 2.3.0. Root cause is exactly
`src/consumer/command.js` line 182, where the human setup summary uses a
literal 2.1.0; that **producer adapter CLI file** was omitted from C001's
projection. A change deriving the displayed version from the verified
`result.plan.framework.version` is necessary for the approved 2.3.0
onboarding and does not create new behavior or alter external consumers.

Two C001 paths were outside the allowed manifest:
`test/adopt/golden.test.js` and `test/adopt/package.test.js`.
The golden change was caused by changed v3 role templates; the package test
by the exact v3 release bundle. Both are existing corresponding tests with
direct causal fit, not new capability. Author allows them **for bounded
regression coverage only**, after reconciliation. Critically, Codex removed
the existing golden assertions enforcing whole subagent definition
`<=8192` UTF-8 bytes and `<=100` nonempty lines, while active
`SPC-003` §5 explicitly **SHALL** preserve these project limits.
The project rule is still active and applicable; generic advice against
arbitrary numeric budgets cannot abolish an existing authorized contract.
Corrective MUST restore these checks, preserve other applicable static
assertions and only adjust a golden byte-for-byte fixture if a versioned
rendering actually invalidated its source baseline. Never treat a
nondeterministic current-version mismatch as grounds to remove every
integrity check. No governance requirement here forces a new profile,
agent, hook or new separate task.

**Claude Certified Architect Foundations review (2026-10-18):** consulted
the user-provided third-party learning site
`https://claudecertificationguide.com/learn`, especially 1.3 context
passing/source metadata, 1.4 prompts versus deterministic gates,
2.2 structured error recovery and valid empty results, 3.4 plan versus
direct execution, and 5.4 context degradation. Cross-checked with
Anthropic's official `code.claude.com/docs/en/best-practices`,
`.../costs`, and `.../sub-agents`. These confirm useful **existing**
requirements: compact source-attributed handoffs and explicit changed
targets; reuse host-native tools, permission mechanisms, caching and
context isolation; once the Author supplies a resolved objective and
focused tests, Executor directly implements rather than repeating
architecture planning. Distinguish model-facing instructions from
mandatory deterministic external gates. Distinguish real source absence,
invalid caller parameters, host/tool transport failures and actual policy
denial, without changing the existing DAT-001/DAT-002 wire schemas solely
to imitate the tutorial's optional `errorCategory/isRetryable` examples.
An isolated subagent consumes its own tokens, so use one only for actual
role/risk or material context isolation; no new agents, scratchpad
services, mandatory workflow hooks, telemetry or token budgets.

**OPS-007 Author self-assessment:** C001 proves material v3 implementation
progress and a bounded failing regression. No-change is insufficient
because the setup CLI reports a contradictory adopted version and
mandatory SPC-003 static-budget proof was weakened. Reuse all 188
applicable passing assertions, existing tests, exact changed tree and
current contracts; do **not** rerun broad investigation, launch
a new product task, or fabricate an independent audit requirement.
The correcting operation may modify only
`src/consumer/command.js`, `test/adopt/bootstrap.test.js`,
`test/adopt/golden.test.js`, `test/adopt/package.test.js` within
the same approved TSK-029 behavior. The broader original 20 changed
paths remain present but MUST NOT be rewritten by a corrective without
a newly demonstrated direct regression. Mechanical evidence is needed
for the new final tree; original terminal FAIL cannot be promoted.
When a required externally independent audit trigger is absent under
current project authority, do not create one by habit; under v2.1.0
only its actually applicable gates are enforced pending 2.3 adoption.

**Correction acceptance:** CLI human/JSON framework version agrees with
the verified bootstrap plan; original greenfield and brownfield
subtests pass; SPC-003 static description/agent line/byte budgets
remain tested; package bundle's 2.3.0 bytes and preserved legacy
2.1.0 bundle remain consistent; required changed paths are
explicitly permitted, all other candidate paths untouched;
reuse existing relevant focused tests and return actual results.
No commit/push/promotion or POP adoption by Executor. Preserve the
first FAIL and its exact evidence unchanged.

## 9. C003 — inherited historical-upgrade regression discovered by release preparation

During governed TSK-031 1.5.0 release-candidate C001
(request `req_0aea225b36128a2c146f920cdd41224d`,
execution `execution_1285086cce2f0b7264f182c18e31df42095e2c721df18e457acb0e2578abbe19`)
the Runner recorded `VALIDATION_FAILED`: `npm test` 354/361 PASS,
7 FAIL (six subtests plus their group), while `npm pack --dry-run
--json` and `git diff --check` PASS, path policy PASS, executor
exit 0. The six version/packaging edits are preserved uncommitted on
`task/tsk-031-adapter-150-release-preparation` at base
`3a7f76d656c3cd95b5a5c0cf796616d7087845b1` and must not
be reset or rewritten by the 2.3.0 corrective.

All failures are in the **unchanged**
`test/adopt/managed-upgrade.test.js` historical 1.2.2/1.3.0 ->
synthetic 1.4.0 legacy bridge suite, **not** the new package's 1.5.0
metadata/assertions. Three prepared cases expected only `.mcp.json`
and `CLAUDE.md` but now also observe updates to auditor/executor
agents; three activated cases expected `ready` but get
`upgrade-ownership-unverified`. Historical Windows 1.2.2 prepared
case passes. The legacy fixture sets a synthetic 1.4.0 target but
uses current producer rendering/upgrade logic; TSK-029 changed
v3 agent templates and dual-framework behavior. The exact
regression is therefore **historical compatibility evidence
unreconciled after TSK-029**, not proof that bumping 1.4.2 to 1.5.0
caused the change. Neither a stale test fixture nor a real v2
upgrade regression may be dismissed without checking real
released source identity and correct supported migration boundaries.

Author directs one C003 **diagnose-then-correct** operation as a directly
necessary TSK-029 backward-compatibility regression, on the existing
clean-head/dirty-six-file TSK-031 branch. First distinguish
historical fixture misuse of current v3 templates from an actual
supported legacy path regression. Preserve exact released 1.2.2/1.3.0
archives, old evidence, self-pin and ownership validation; NEVER
change expected outcomes to simply bless failures, remove fail-closed
checks, relax agent collision rules, or silently enable direct
1.2.2 -> 1.5.0 upgrades. Where stale test setup causes the
contradiction, repair only
`test/adopt/managed-upgrade.test.js` using an existing truthful
version-bound fixture or explicit historical-context comparison;
do not fabricate old 1.4.0 package bytes/identity. Only if a
genuine supported v2 product regression is independently shown,
a narrowly targeted `src/adopt/{upgrade,plan}.js` corrective is
conditionally authorized under TSK-029's existing v2 compatibility
acceptance, with direct mechanical proof and no consumer mutation.
If such a correction requires unproven source mapping or a wider
material boundary, STOP and report it instead of guessing.

Reuse C001's versioned package changes unchanged, no new task,
subagent, test framework, provider dependency, workflow, remote
release, or consumer repository change. Focus post-execution Runner
validation on `node --test test/adopt/managed-upgrade.test.js`
and `git diff --check`, then reuse that proof and only later
run the full release suite as one final candidate gate.
The historical 354 PASS observations do not become a full-suite
PASS until remaining failures are corrected and objectively retested.

### C003 disposition — resolver did not dispatch; reconciled under TSK-031

The draft `TSK-029-C003.json` execution package was **ineligible** on
the current `task/tsk-031-adapter-150-release-preparation` branch
(`EXECUTION_PACKAGE_INELIGIBLE`, no executor effects). The active
branch-specific release acceptance task TSK-031 §7 became the
authoritative implementation home for the historical compatibility
reconciliation, as **TSK-031 C002**. Its real terminal PASS and precise
test/source delta are recorded in TSK-031 §8. Earlier C003 author
directions describe causal lineage only and authorize **no future
TSK-029 executor dispatch** on this branch. TSK-029's 2.3.0
adoption/promotion remains separately pending.

