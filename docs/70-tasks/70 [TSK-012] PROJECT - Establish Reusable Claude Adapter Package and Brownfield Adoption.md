---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-012
  type: TSK
  title: Establish Reusable Claude Adapter Package and Brownfield Adoption
  status: COMPLETE
artifactVersion: "4"
authorityScope: tsk-012-reusable-claude-adapter-package
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-adapter-package-distribution
    - claude-brownfield-adoption-plan-apply
    - claude-adapter-runtime-integrity-pin
    - claude-consumer-mode-activation-guard
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - consumer-repository-modification
    - mature-runner-modification
    - runner-wrapping-or-compatibility-layer
    - cross-surface-protocol
    - resolver-js-modification
    - authority-resolution-semantics-change
    - methodology-change
    - framework-version-change
    - model-selection
    - hooks
    - skills
    - agent-teams
    - new-subagents
    - public-or-remote-telemetry
    - public-or-private-registry-publication
    - provider-authentication
    - provider-routing
authority:
  governedBy:
    - ARC-001
    - ADR-002
    - ADR-003
    - SPC-001
    - DAT-001
    - SPC-002
    - SPC-003
    - SPC-004
    - OPS-003
    - OPS-005
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-009
    - TSK-010
    - TSK-011
lifecycle:
  phase: complete
  dependsOn:
    - TSK-009
    - TSK-010
    - TSK-011
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-012] dev-foundry-claude - Establish Reusable Claude Adapter Package and Brownfield Adoption

## 1. Purpose and necessity

`dev-foundry-claude` is a self-hosted reference implementation. A brownfield
repository that already governs itself with DEV FOUNDRY (for example
PagoElectronico) cannot adopt it today without copying `src/governance-mcp/**`,
`src/telemetry/**`, `scripts/telemetry/**`, and a `.mcp.json` that points at
`${CLAUDE_PROJECT_DIR}/src/governance-mcp/server.js`, and without hand-editing
subagent and Capability Profile files that hard-code `dev-foundry-claude`.

This task makes the reusable runtime installable from one versioned package, makes
all Claude configuration project-parameterized, and adds a deterministic,
non-mutating `plan` followed by a separately authorized `apply`. The adapter adapts
to the consumer; the consumer never becomes a clone of this repository.

Activated by Operator authorization at artifactVersion 4. Authorizes the Implementation
Executor surface of section 7 only. It does not authorize publishing, touching any consumer
repository, or installing or cutting over any real consumer.

## 2. Observed baseline (verified)

- Resolver identity is already project-derived: `resolver.js` requires
  `targetProject` to equal POP `repository.name` and Authority Index
  `subject.id`. It contains no `dev-foundry-claude` literal. It reads the POP and
  Authority Index only at the fixed paths `.dev-foundry/profiles/project-operating-profile.yaml`
  and `.dev-foundry/authority-index.yaml`, and supports only framework `2.1.0`.
- The resolver is caller-agnostic: it returns whatever the POP binds for the role,
  whether that is the runner or Claude. It does not know which platform is calling.
- `server.js` takes the project root only from `CLAUDE_PROJECT_DIR`; `launch.js`
  takes it from an argument (default `process.cwd()`); the telemetry sink is
  `<root>/.dev-foundry/telemetry/local`, collector bound to `127.0.0.1`.
- Literal `dev-foundry-claude` assumptions exist only in: both
  `.claude/agents/*.md`, both Claude Capability Profiles (`id`, `limits.repository`,
  `environment_constraints`), `CLAUDE.md`, the Platform Bootstrap
  (`repository.expected_name`), the POP, `README.md`, and tests. No runtime source
  file embeds it.
- Existing tests assert the exact `.mcp.json` args and exact `.claude` tree of this
  repository. They constrain the self-hosted setup and stay as-is.
- DAT-016: `actor_bindings` holds exactly one binding per role with status
  `active | transitional | deferred` (no `prepared`); `platform_bootstraps` is a map
  whose entries have status `prepared | active | stale | retired`. SPC-002 is the
  precedent: Claude configuration was prepared and unbound, then switched for all
  five roles and the Platform Bootstrap in one atomic cutover (TSK-009).
- A runner-governed brownfield POP binds roles to the runner. Because a role has one
  binding slot, a Claude binding can only replace the runner binding. That
  replacement is a consumer cutover and is never an adapter action.
- The mature runner is the compatibility baseline. Current authority does not show that it
  tolerates additional configured entries (an extra bootstrap entry, extra Index bindings),
  and an active profile that the Index does not route violates the Index rule
  `unindexed_active_authority_forbidden`. Every configured-authority change is therefore
  deferred to the consumer's atomic cutover; nothing is prepared in consumer authority.
- This repository's `.dev-foundry/.gitignore` already ignores `telemetry/`; a
  runner-initialized consumer plausibly has the same, which would make the adapter's
  ignore change a no-op. That is a plan-time fact for each consumer, not an assumption.

### 2.1 Separation

| Reusable runtime (shipped in the package) | Never distributed |
| --- | --- |
| `src/governance-mcp/{server,resolver}.js` | this repo's `CLAUDE.md`, POP, Authority Index, Platform Bootstrap |
| `src/telemetry/{launch,telemetry}.js`, `scripts/telemetry/{claude,collector}.mjs` logic | `docs/**` (OVR/ADR/ARC/SPC/DAT/TSK-001..012) and all task history |
| new parameterized templates: 2 subagents, 2 Capability Profiles, Claude Platform Bootstrap, CLAUDE.md block, MCP entry | `.dev-foundry/releases/**` (the consumer selects its own immutable release) |
| `yaml`, `zod`, `@modelcontextprotocol/server` (bundled) | runner Capability Profiles, runtime records, `.dev-foundry/telemetry/**`, `.claude/settings.local.json`, `.env`, README |

## 3. Decision summary (minimal viable architecture)

1. One package, provisionally `@dev-foundry/claude-adapter` (bin `dev-foundry-claude`),
   built from this repository, distributed as an `npm pack` tarball with
   `bundleDependencies` so installation needs no registry. `private: true` stays,
   preventing accidental publish. No registry decision is made.
2. `.mcp.json` in a consumer becomes
   `{"type":"stdio","command":"dev-foundry-claude","args":["mcp","--expect","<version>:sha256:<integrity>"]}`.
   The `mcp` subcommand verifies the expectation (section 5.6), then loads the packaged
   `server.js`; the project root is still the Claude-injected `CLAUDE_PROJECT_DIR`.
3. Two classes of consumer surface:
   - **Adapter-owned surface (apply may write):** `.claude/agents/dev-foundry-executor.md`,
     `.claude/agents/dev-foundry-auditor.md`, a marker-delimited block in `CLAUDE.md`,
     the `dev-foundry-governance` entry in `.mcp.json`, and, only when missing, the
     telemetry ignore line in `.dev-foundry/.gitignore` (section 5.7).
   - **Cutover proposal (reviewable text only; the consumer authors and separately authorizes
     it; apply never writes it):** every configured-authority change as one atomic unit: the
     two Claude Capability Profiles, the Claude Platform Bootstrap, the five role-binding
     replacements, bootstrap status changes, and Authority Index entries (section 5.8).
     Before the cutover, consumer authority stays byte-identical.
4. `.claude/settings*.json`, hooks, skills, and MCP approval are never written.
   Workspace trust and project-MCP approval remain Operator actions.
5. Parameterization is derived, not typed: project identity, actor-profile paths,
   framework version, and profile ids come from the consumer's POP/Authority Index.
   The resolver's `targetProject` check is unchanged; generation adds an earlier gate
   (section 5.1) and the adapter adds an activation gate (section 5.9).
6. Self-hosted setup is unchanged. Self-hosted `.claude/agents/*` and the
   `claude-code-v2`/`claude-code-v1` profiles must be reproduced byte-for-byte by the
   templates (golden test), proving one source and no drift.
7. No dual-binding, no compatibility layer, no runner change. Until the consumer's own
   governed cutover, the adapter is prepared and not active.

## 4. CLI contract (proposal; names are not fixed)

```
dev-foundry-claude adopt plan   [--root <dir>] [--project <id>] [--id-prefix <P>] [--remove] [--out <file>]
dev-foundry-claude adopt apply  --plan <file> --plan-sha256 <hash>
dev-foundry-claude adopt status [--root <dir>]            # read-only
dev-foundry-claude mcp --expect <version>:sha256:<integrity>
dev-foundry-claude run <direct|dial|codemie> -- <claude args>
dev-foundry-claude --version
```

`mcp` and `run` are thin entry points over the existing modules. `run` resolves the
root via `git rev-parse --show-toplevel`, requires the POP there, reads the pin from the
project's `.mcp.json` entry, verifies it, and passes the root to
`runLauncher({projectRoot})`. `scripts/telemetry/*` in this repository stay and keep
working. `--project`, when given, is an assertion that must equal POP
`repository.name`; it never selects identity. `--id-prefix` is needed only when the POP id is
not of the form `<PREFIX>-PROJECT-OPERATING-PROFILE`; it names new artifacts and never
selects identity. `adopt status` and the plan use one
shared activation evaluator (section 5.9).

## 5. Adoption contract

### 5.1 Preflight (read-only, zero writes)

Determine and record: repository root and git state; POP and Authority Index presence,
schema and status; `repository.name`, Authority Index `subject.id`, Platform Bootstrap
`expected_name` (all three must agree); selected framework version and release path
(must be supported by the installed adapter and routed per resolver rules); whether
the repo is **governed** (valid POP + Index + selected release) or **ungoverned**
(otherwise). Ungoverned repositories are a terminal `not-governed` result: adoption
does not bootstrap governance and writes nothing.

Also inspected: existing `CLAUDE.md`, `.mcp.json`, `.claude/**`, the current binding of
each of the five roles, platform bootstraps and their statuses, the installed adapter
runtime versus any existing pin, and telemetry ignore state.

### 5.2 Blockers (plan status `blocked`; apply refuses)

Authority or identity mismatch or ambiguity; POP/Index at nonstandard paths or
unsupported framework version; invalid JSON in `.mcp.json`; an existing
`dev-foundry-governance` server entry or either agent file that is not byte-identical
to the rendered output; an existing `CLAUDE.md` that carries `resolve_governed_operation`
or conflicting governance instructions outside the managed block; any generated path
or parent that is a symlink or outside the root; a Capability Profile, bootstrap, or
binding id, or a proposed new path, that collides with an existing different artifact; an
unrecognized POP id convention without `--id-prefix`; a **partial** Claude
binding state (some but not all five roles Claude-active, which is ambiguous authority);
an existing pin that does not match the installed adapter (`adapter-runtime-mismatch`);
an existing ignore rule that re-includes `.dev-foundry/telemetry/local/`; a dirty
working tree in a touched path. Nothing is ever overwritten.

A runner-bound consumer (all five roles bound to the runner) is **not** a blocker. It is
the normal `prepared` input state.

### 5.3 Plan output

Canonical JSON (sorted keys, LF, no timestamps, no absolute host paths) plus its
SHA-256: target project; **expected adapter runtime** (version and integrity that
`--expect` will pin); selected framework; governance state; **activation state**
(section 5.9, per role); `create`; `merge` (exact before/after hunks); and
`cutover_proposal` (one atomic unified-diff set carrying the base sha256 of every authority
file it edits and the full text of every file it adds);
`blockers`; `warnings`; `preconditions` (sha256 of every inspected existing file); and
`guaranteed_untouched` (explicit paths and classes: POP, Authority Index, every
existing Platform Bootstrap, every existing role binding, releases, `docs/**`, product
source, `.claude/settings*.json`, runner files). Identical inputs produce an identical
plan hash. Warnings state that the cutover proposal has not been verified against the mature runner and
that the cutover retires the runner's binding for this repository.

### 5.4 Apply

Requires `--plan` and its `--plan-sha256`, re-verifies all preconditions, and fails
closed on any drift, blocker, or mismatch. It writes only `create`/`merge` entries
(never a proposal), via staging and rename with rollback on failure; no network, no
git commit, no installation, no MCP approval. It leaves every existing active binding,
bootstrap, and authority file byte-identical.

### 5.5 Idempotency, reapply, remove

- Reapply: `plan` after `apply` yields only no-ops and apply changes nothing. A
  byte-different adapter-owned file is a blocker, never an overwrite.
- Version change: a different installed adapter than the pinned one is
  `adapter-runtime-mismatch`. Adapter upgrades are out of scope; the defined resolution
  is to install the pinned build or perform a future governed re-adoption.
- `plan --remove` is the inverse and runs only when the installed adapter matches the
  pin: it deletes only byte-identical rendered files, strips the managed `CLAUDE.md`
  block and the `.mcp.json` entry, removes `.claude/agents` only if then empty, and
  leaves the telemetry ignore line. Modified artifacts are blockers. Reversal of any
  consumer-applied proposal is reported, never applied.

### 5.6 Runtime pin (version and full-payload integrity)

Mechanism (approved): `--expect <version>:sha256:<root>` in the adapter-owned `.mcp.json`
entry; no lock artifact and no registry or network lookup.

**Payload manifest.** The tarball carries `payload-manifest.json`, generated at pack time
(`prepack`). Its entries are exactly the regular files npm will actually ship in the adapter
package, taken from npm's own pack file list and not from a conceptual directory list. That
list therefore includes files npm adds independently of the `files` setting (such as
`package.json`, and README or LICENSE when present) and every file of each bundled runtime
dependency under the package's `node_modules/`. The generator uses a mechanism that yields
npm's list without a new dependency (for example `npm pack --dry-run --json --ignore-scripts`
read before the real pack). Entries are sorted `{path, sha256, size}` in canonical JSON
(sorted keys, LF, no timestamps, modes, or host paths) plus the manifest format and adapter
version. The root digest is the SHA-256 of the manifest's exact bytes, and the pin is
`<version>:sha256:<root>`. The manifest cannot list or hash itself; it is the single
explicit exception, and its bytes are bound by the externally committed expected root. One
implementation (`src/adopt/pin.js`) does canonicalization for generation and verification.

**`package-lock.json` is not payload.** npm does not ship the root `package-lock.json`, so it
is a repository and build input, not part of the installed runtime, and is not in the
manifest or the pin. It stays a governed build input of this repository (section 7). The
build fails unless every bundled dependency's installed `package.json` version matches the
lock's resolved version for that dependency, so bundled resolution is derived from the lock;
the lock's hash is recorded in build evidence only. The pin covers the bytes that actually
ship, which is what executes.

**Payload invariant.**

```text
installed regular files of the package
  minus  payload-manifest.json
  minus  npm-generated node_modules/.bin links
  ==     manifest entries exactly
```

Every manifest entry must exist and match size and sha256. No other regular file may exist
in the package tree, and no symlink may exist outside `node_modules/.bin/`. A build-time
check compares the produced tarball's regular-file entries, minus the manifest, to the
manifest entries and fails the build on any difference.

A manifest is used instead of hashing the installed tree afresh because installation can add
links and metadata, so a fresh tree hash is not stable across installs. The manifest is
produced from what ships and the installed tree is verified against it.

**Verification** (before serving or launching, no network): (1) the SHA-256 of the manifest
bytes equals the expected root; (2) every listed file exists with its recorded sha256 and
size; (3) the installed package tree holds no regular file other than the manifest entries
and `payload-manifest.json` itself, and no symlink outside `node_modules/.bin/`; (4) the
manifest version equals `package.json` and the expected version. Any failure, a missing or
malformed `--expect`, or a missing manifest produces a generic error and a non-zero exit.

**Required property:**

```text
same semantic version + any materially different distributed payload byte
  => different payload root
  => expected-pin mismatch
  => fail closed before MCP serving or launcher execution
```

`mcp` verifies before importing `server.js`; `run` verifies against the pin read from
`.mcp.json` before starting a collector or child. The plan reports the root of the producing
adapter after it self-verifies; an adapter that fails self-verification refuses to plan.

Stated limits: the pin does not cover the Node.js runtime, the OS, or files outside the
package root, and it cannot stop a local actor who can write the install and the verifier
together. It detects drift and differing builds, not a hostile host. Startup cost is one read
pass over the payload; the task measures and reports it.

### 5.7 Telemetry ignore

The adapter writes only to `.dev-foundry/telemetry/local/`, which lies within the
semantic target `.dev-foundry/telemetry/**`. To avoid broadening, the rendered rule is
the narrowest that covers that write path. Patterns in `.dev-foundry/.gitignore` are
relative to `.dev-foundry/`, so the rendered line is exactly `/telemetry/local/`, not
`.dev-foundry/telemetry/` and not an unanchored `telemetry/`.

Rules: need is decided from repository-local ignore rules only (`git check-ignore`
with global excludes disabled), so Operator-global ignores never suppress it; existing
content, order, comments, and line endings are preserved; the change is append-only with
a trailing-newline fix at most; a missing `.dev-foundry/.gitignore` is created containing
only the rendered block; negation rules that re-include the path block the plan.

### 5.8 Consumer binding transition model (all five roles)

Target Claude implementation per role. Each role's existing `profile` field is retained; only
`implementation` and `capability_profiles` change. A role with no existing binding gets one
only when the selected release holds exactly one Actor Profile for it, otherwise the plan is
blocked.

| Role | Target implementation | Capability Profiles |
| --- | --- | --- |
| Governance Author | `claude-main-agent`, platform `claude-code` | none |
| Implementation Executor | `dev-foundry-executor` | generated Claude Executor profile |
| Governance Auditor | `dev-foundry-auditor` | generated Claude Auditor profile |
| Mechanical Validator | `claude-code-native-validation` (tool) | none |
| Evidence Custodian | `claude-main-agent`, platform `claude-code` | none |

States:

1. **Pre-adoption**: the consumer POP binds roles to its current implementation (the runner).
2. **Adapter applied**: only adapter-owned files and the pin exist. Consumer authority is
   byte-identical to pre-adoption (the single permitted `.dev-foundry/` write is the ignore
   line of 5.7, when needed, which is a git ignore rule and not governed authority). The mature
   runner stays authoritative. Claude is prepared and not active, and Claude role work fails
   with `BINDING_INACTIVE`.
3. **Cutover** (the consumer applies the cutover proposal under its own TSK and Operator
   authorization): one atomic change introduces the two Claude Capability Profiles and the
   Claude Platform Bootstrap (`active`) with Authority Index routes; replaces all five role
   bindings; adds the Claude bootstrap to POP `platform_bootstraps` as `active`; sets the
   prior primary bootstrap entry and its file to `retired`; and marks runner Capability
   Profile routes as non-required history. All or none. No dual binding exists at any point.
   The consumer closes or hands off runner-bound in-flight work first; the adapter does not.

New artifacts use the consumer's id prefix (`<PREFIX>`) and distinct paths: Claude Platform
Bootstrap `.dev-foundry/platform-bootstrap-claude-code.yaml`, profiles under
`.dev-foundry/profiles/capability-profiles/`. The cutover proposal states its preconditions
(base hashes current, runner work closed) and is reported as requiring consumer-governed
cutover authorization.

### 5.9 Activation evaluator and gate

`evaluateActivation(root)` is a pure, read-only function used by `adopt plan`, `adopt status`,
and the MCP guard. It derives state only from consumer authority: the POP, Platform Bootstrap
files, Authority Index, and the profiles they reference. It never reads adapter-owned files,
so those confer no authority, and it reads with the resolver's root-containment rules
(no absolute paths, no escape through symlinks).

Per role it returns `foreign-active`, `claude-active`, or `unbound`. A role is `claude-active`
only if: its POP binding is `active`; its implementation identity and platform match 5.8;
its capability profiles are exactly the expected set, each routed by the Authority Index,
existing, `active`, and naming this project in `limits.repository`; and the POP holds exactly
one `active` bootstrap entry, which is a Claude Platform Bootstrap routed by the Index whose
`expected_name` equals the project and whose `platform.id` is `claude-code`. Overall state is
`prepared` (no Claude-active role), `active` (all five roles plus that bootstrap), or
`partial` (anything else, including a lingering active runner bootstrap).

**Guard (approved, D1).** When launched through `dev-foundry-claude mcp`, the server
evaluates activation on every `resolve_governed_operation` call, before the resolver is
invoked, and returns `ok:false, errorCode: BINDING_INACTIVE` with a concise message unless the
state is `active`. The guard sits at the packaged MCP entry/server boundary. `resolver.js` is
not modified and authority-resolution semantics are unchanged: the resolver is simply not
invoked while the guard denies. The tool stays listed, so the MCP runtime is available while
role-dependent work fails closed. A single in-process switch, set only by the `mcp`
subcommand, enables the guard; self-hosted source-run launch never sets it, so its behavior
is unchanged.

## 6. Roles and operation split

- Governance Author: this task and the authority actions in section 12.
- Implementation Executor (`dev-foundry-executor`): section 7 surface only, after
  `implement` resolution on an `IN_PROGRESS` TSK-012.
- Mechanical Validator (`claude-code-native-validation`): section 10 commands.
- Evidence Custodian: separate promotion and reconciliation operation.

One independent Governance Audit of the final candidate is required by Operator
direction, because this task introduces a new authority-adjacent distribution surface.

## 7. Implementation surface

The Executor may change exactly:

- `package.json`, `package-lock.json` (name, version, `bin`, `files`, `bundleDependencies`,
  test glob; no new dependency, `private: true` retained; the lock remains a governed build
  input and is not shipped);
- `bin/dev-foundry-claude.js` (new);
- `scripts/package/payload-manifest.mjs` (new, `prepack` generator; imports `src/adopt/pin.js`);
- `.gitignore` (add only the generated `/payload-manifest.json` line);
- `src/adopt/**` (new: inspect, plan, render, apply, remove, activation, pin, ignore);
- `src/governance-mcp/server.js` (one bounded addition: the opt-in consumer-mode activation
  guard of 5.9, default off; no other edit);
- `templates/**` (new: 2 subagents, 2 Capability Profiles, Claude Platform Bootstrap,
  CLAUDE.md block, MCP entry);
- `test/adopt/**` (new: fixture builder, golden, plan, state-machine, authority,
  pin, ignore, package, telemetry tests);
- `README.md` (orientation paragraph only).

### 7.1 Hard exclusions

No change to `src/governance-mcp/resolver.js` and no change to authority-resolution
semantics (role and authority selection, hashing, fingerprint, and every existing error
condition and code). The sole permitted behavior addition is the bounded opt-in consumer-mode
activation guard at the MCP boundary (5.9), inert unless the packaged `mcp` entry enables it.
No change to `src/telemetry/**`, `scripts/telemetry/**`, `.mcp.json`, `CLAUDE.md`, `.claude/**`, `.dev-foundry/**`, `docs/**`, existing tests, or
any consumer repository (PagoElectronico is not a fixture and is not read). No
Hooks, Skills, agent teams, extra subagents, model routing, settings files, remote
telemetry, new dependencies, registry publication, or `npm publish`. No runner change,
dual binding, or compatibility layer. No Claude, DIAL, CodeMie, or model process is
invoked. No commit, push, PR, or merge by the Executor.

## 8. Migration and backward compatibility

Self-hosted `dev-foundry-claude` is unchanged: same `.mcp.json` (source path, no gate,
no pin), agents, profiles, POP, bootstrap, launcher scripts, and `resolver.js`. The
only edits to existing files are the default-off guard in `server.js`, `package.json` and
its lock, one `.gitignore` line, and one README paragraph. All 62
existing tests pass unmodified. Self-hosting stays source-run. The authority-visible
changes are additive routing plus the SPC-001/DAT-001 error-code amendment (section 12).

## 9. Fixture

Tests build, in a temp directory, an isolated brownfield consumer `acme-billing`: git
repo, product source and its own ADR/OVR, its own POP/Authority Index/Platform
Bootstrap, a copy of the canonical `2.1.0` release (its own selected release), all five
roles bound to a runner-style implementation, an active runner Platform Bootstrap, an
existing `CLAUDE.md`, an existing `.mcp.json` with another server, an existing
`.dev-foundry/.gitignore`, and an Operator-local `.claude/settings.local.json`. Variants:
ungoverned, identity mismatch, partial cutover, and one per collision.
"Fixture-simulated governed consumer cutover" is the test harness applying the cutover
proposal as a patch, standing in for the consumer's own authoring. The fixture also keeps a
runner read-set snapshot (hash of every authority and configuration file under `.dev-foundry/**`
except runtime directories, plus `docs/**`) used for byte-identity checks.

## 10. Mechanical validation

Using the fixture (never a real consumer), prove:

**Plan and apply**

1. Plan is non-mutating (tree hash before equals after); identical inputs give an identical
   plan hash; the plan reports the expected adapter version and payload root and per-role
   activation state, and the cutover proposal applies cleanly to a copy of the fixture.
2. Ungoverned and identity-mismatch repos return `not-governed`/`blocked` with zero writes.
3. Every blocker in 5.2 fails closed with zero writes; a runner-bound consumer is not blocked.
4. Apply writes exactly the planned paths (set equality via tree diff); product authority,
   other `.mcp.json` servers, existing `CLAUDE.md` text, `.gitignore` content, and
   `settings.local.json` are byte-identical or deep-equal; a stale plan hash is refused.
5. No `dev-foundry-claude` repository identity, SoT, TSK or history in the consumer (only the
   command token `dev-foundry-claude` is permitted); identity is `acme-billing` everywhere.
6. Golden: templates rendered with self-hosted parameters equal committed `.claude/agents/*`
   and the self-hosted Claude Capability Profiles byte-for-byte.

**Transition states (first-class)**

7. After adapter apply, before cutover: the runner read-set snapshot is identical to
   pre-apply (the only permitted `.dev-foundry/` difference is the ignore line, when it was
   needed); all five runner bindings and the runner bootstrap are unchanged; no Claude
   artifact exists in consumer authority; the installed `mcp` connects and lists
   `resolve_governed_operation`; generated Claude files exist; every role's resolution request
   returns `BINDING_INACTIVE`; `adopt status` reports `prepared` with five `foreign-active`.
8. Partial and mixed states fail closed: four-of-five Claude roles, Claude profile files with
   no POP bindings, POP bindings without profile files, profiles not routed by the Index, a
   profile with a wrong `limits.repository` or non-`active` status, a missing Claude active
   bootstrap, and a lingering active runner bootstrap each yield `partial` and
   `BINDING_INACTIVE`.
9. After the fixture-simulated cutover: `adopt status` is `active`; Governance Author,
   Executor, Auditor, Validator and Custodian each resolve successfully, and the resolved Actor
   Profile and Capability Profile paths equal what the fixture POP independently declares;
   every authority source belongs to the fixture; a request for `dev-foundry-claude` returns
   `TARGET_MISMATCH`; no dual binding exists; the prior primary bootstrap is `retired`.
10. Guard scope: with the guard off (self-hosted launch), `server.js` behaves exactly as
    before and the existing server tests pass unchanged; `resolver.js` is byte-identical to
    `HEAD`; resolver output for the same inputs is unchanged by the guard's presence.

**Capability grants no authority (first-class)**

11. For the matrix of every action and role, resolver output (including `contextFingerprint`)
    obtained directly from `resolver.js` is byte-identical before apply, after apply, and
    after remove: adapter-owned files are not authority inputs.
12. No resolution `authority` entry and no POP/Index/Bootstrap byte references an adapter-owned
    path; mutating or deleting generated agents, the CLAUDE.md block, or the MCP entry never
    changes `evaluateActivation`, while changing a POP binding does.
13. Generated agents and the CLAUDE.md block contain the stop rule that the active POP binding,
    not their own presence, authorizes role work, and satisfy the SPC-003 static limits
    (description <= 240 B, <= 8192 B, <= 100 lines, exact tools, `mcpServers`, no
    hooks/skills/agents).

**Runtime pin (full payload)**

14. With the pin generated from the installed build, `mcp` starts and serves. Each of these
    exits non-zero before serving and starts no governed work: mismatched version; a changed
    adapter file; a changed template; a changed `package.json`; a changed README or LICENSE
    file that npm ships; one byte changed in a bundled dependency file; a deleted payload
    file; an added unlisted regular file anywhere in the package tree; a symlink outside
    `node_modules/.bin/`; a changed `payload-manifest.json`; a missing manifest; a missing or
    malformed `--expect`. The only tolerated difference is an added, removed, or changed link
    under `node_modules/.bin/` (5.6). `run` rejects the same cases before any collector or
    child starts.
15. Same-version builds differ: two tarballs built from trees that differ in exactly one byte
    of a bundled-dependency file (and, separately, one template byte, and separately one byte
    of a README or LICENSE that npm includes) have identical `version`, different
    `payload-manifest.json`, and different roots; the pin of one rejects the other.
16. The manifest is complete and exact. At build time the tarball's regular-file entries minus
    `payload-manifest.json` equal the manifest entries exactly, including files npm ships
    independently of `files`. After offline install into a temp prefix the installed regular
    files, minus `payload-manifest.json` and `node_modules/.bin/` links, equal the manifest
    entries exactly. `package-lock.json` is absent from both and from the manifest. The build
    check that bundled dependency versions match the lock fails when one is altered. Two
    builds of the same tree give identical manifest bytes and root. The measured verification
    time is recorded.
17. A pin-mismatched existing adoption makes the plan `adapter-runtime-mismatch`.

**Ignore**

18. The rendered line is exactly `/telemetry/local/`. Using real `git check-ignore` (global
    excludes disabled): `.dev-foundry/telemetry/local/x.ndjson` is ignored;
    `.dev-foundry/telemetry/x`, `.dev-foundry/releases/x`, `telemetry/local/x` at the root, and
    `src/telemetry/x` are not. A negative control proves a root-style `.dev-foundry/telemetry/`
    line inside `.dev-foundry/.gitignore` does not match. Existing content is preserved; an
    already-ignored path adds nothing; a re-including negation blocks.

**Package, telemetry, lifecycle**

19. The tarball installs into a temp prefix offline, with no registry access; `mcp` from that
    installed bin, with `CLAUDE_PROJECT_DIR` = fixture, runs from the temp prefix and not this
    repository's `src`.
20. Telemetry: `run` against the fixture binds the collector to `127.0.0.1`, writes only under
    the ignored `.dev-foundry/telemetry/local`, sets only loopback OTLP endpoints and SPC-004
    privacy flags; `src/adopt` and the pin code import no network module.
21. Idempotency and remove: plan after apply is all no-ops; reapply changes nothing;
    `plan --remove` then apply restores the adapter-owned surface byte-for-byte, leaves
    authority files untouched, and is refused when the installed build does not match the pin
    or an artifact was modified.
22. Existing 62 tests pass unmodified; then `npm ci`, `npm test`, `git diff --check`, and exact
    change-set validation against section 7.

## 11. Semantic completion criteria

PASS only if: no runtime code is copied into a consumer; `adopt apply` never writes or edits
consumer authority, and consumer authority is byte-identical until the consumer's own atomic
cutover; the cutover proposal covers all five roles and the Claude bootstrap together with no
dual binding; a prepared adapter fails closed with `BINDING_INACTIVE` for all role-dependent
work, and partial states fail closed; activation derives only from consumer authority and
adapter-owned files and capability grant none (tests 11-12 are mechanical); the runtime pin
covers the complete distributed payload including bundled dependencies and fails closed before
serving or launching; generation cannot weaken identity checks (`resolver.js` unchanged,
POP-derived identity, three-way agreement, `--project` only asserts); the runner and
methodology are untouched and no compatibility layer or sync service exists; the Operator
controls apply, MCP approval, cutover, and promotion; the ignore surface is no broader than
the adapter's write path; and the result is no larger than sections 3 and 7 require (OPS-007).

## 12. Authority actions (Governance Author; not Executor work)

Authored on the task branch and activated by Operator authorization; not yet promoted:

- ADR-003 (new, now ACCEPTED): package form, consumer MCP launch form and payload-integrity pin,
  adapter-owned versus configured-authority write boundary, prepared-versus-active model.
- SPC-001 amended (version 3): the consumer-mode activation guard as MCP-boundary behavior,
  explicitly not resolver behavior.
- DAT-001 amended (version 2): additive error code `BINDING_INACTIVE`, emitted only by the
  guard.
- ARC-001 amended (version 4): package, CLI, and guard in the component picture.
- OVR-001 and OVR-002 amended: boundary, non-goals, and map entries for the draft.

Activation performed on Operator authorization: TSK-012 and ADR-003 are routed in the Authority
Index, ADR-003 is `ACCEPTED`, and TSK-012 is `IN_PROGRESS`. No POP, Platform Bootstrap, or
binding change in this repository.

## 13. Operator decisions

Resolved by Operator direction; none remain open:

- Package: `@dev-foundry/claude-adapter`, bundled runtime dependencies, `private: true`,
  reproducible `npm pack` tarball only; npm scope ownership and registry publication are out
  of scope.
- Activation: the opt-in consumer-mode guard (`BINDING_INACTIVE`) at the MCP entry; resolver
  unchanged; exclusions restated accordingly.
- Pin: `--expect` in the adapter-owned `.mcp.json` entry, covering the full distributed payload
  including bundled dependencies, without a lock artifact or network lookup.
- Transition: no prepared Claude Platform Bootstrap and no prepared configured authority; all
  Claude configured artifacts, the five-role replacement, and bootstrap activation are one
  consumer-governed atomic cutover, with no dual binding.
- Ignore: exactly `/telemetry/local/` in `.dev-foundry/.gitignore`.
- All earlier direction: no SoT/history copying, no authority mutation by `adopt apply`,
  deterministic non-mutating plan, isolated fixture, self-hosted compatibility, one final
  independent audit.

Points for the last review (not blocking decisions): the manifest generator and one
`.gitignore` line are added to the surface (7); the `--id-prefix` fallback (4, 5.2); the pin's
stated limits (5.6).

## 14. Completion

Complete when section 7 passes section 10, semantic self-assessment is PASS, the
independent Governance Audit is closed, evidence is recorded, the candidate is promoted
to `main`, `main` is clean, and the branch is cleaned up. Installing into PagoElectronico,
and any consumer cutover, are separate Operator-authorized operations outside
this task.

## 15. Completion result

The Implementation Executor operation (`dev-foundry-executor`, resolved as
`implementation-executor` with Capability Profile `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`)
changed exactly the section 7 surface and no other path: `package.json`, `package-lock.json`,
`.gitignore` (the `/payload-manifest.json` line only), `README.md` (one paragraph),
`src/governance-mcp/server.js` (the single default-off consumer-mode guard), and the new
`bin/dev-foundry-claude.js`, `scripts/package/payload-manifest.mjs`, `src/adopt/**`,
`templates/**`, and `test/adopt/**`. The package is `@dev-foundry/claude-adapter` version `1.1.0`,
`private: true`, with bundled runtime dependencies and no new dependency.

Native mechanical validation (`claude-code-native-validation`, run independently of the
Executor) PASSED on the frozen candidate (39 files, boundary root
`3a8500d47b60f493ad712ecdadddd8842bdde07d45f3de15e7b6ff29de3d66c8`):

- `npm ci` succeeded; `npm test` 102/102 (62 existing unmodified plus 40 new);
  `git diff --check` clean;
- `resolver.js`, `src/telemetry/**`, `scripts/telemetry/**`, `.mcp.json`, `CLAUDE.md`,
  `.claude/**`, and all existing tests are byte-identical to the pre-task `HEAD`;
- two `npm pack` builds are byte-identical (1205 entries) and the tarball contains no
  `package-lock.json`, docs, `.dev-foundry`, `CLAUDE.md`, `.claude`, tests, `.mcp.json`, or `.env`;
- offline install into a temporary prefix with an unreachable registry succeeds, and the
  installed `mcp` serves only with the exact pin; wrong version, wrong root, missing or malformed
  `--expect`, and one changed byte in a bundled dependency, adapter source, template, README, or
  `package.json`, an added unlisted file, a changed manifest, and a deleted payload file are each
  rejected before serving;
- the new code has no network imports.

Governance Author semantic self-assessment is PASS against section 11: no runtime code is copied
to a consumer; `adopt apply` writes only adapter-owned surface and never consumer authority; the
cutover proposal is reviewable text covering all five roles and the Claude bootstrap with no dual
binding; the guard denies with `BINDING_INACTIVE` for absent, partial, and mixed states and derives
state only from consumer authority; the pin covers every shipped regular file including bundled
dependencies, treats `package-lock.json` as a build input, and fails closed before serving or
launching; `resolver.js` and authority-resolution semantics are unchanged; the telemetry ignore line
is exactly `/telemetry/local/`.

Independent Governance Audit (`dev-foundry-auditor`, read-only) returned PASS with no blocking
finding. Non-blocking observations, recorded and not addressed in this task:

- O1: `bin/dev-foundry-claude.js` is matched by the inherited `**/[Bb]in/*` ignore rule. Operator
  decision: force-add it at promotion and leave `.gitignore` and section 7 unamended.
- O2: the pin verifier tolerates `.bin` links at any nested `node_modules/.bin/` path, not only the
  package root's.
- O3: one remove-path test compares a file with itself; later assertions carry the proof.
- O4: one partial-state test asserts the evaluator only, not through the guard.
- O5: a `CLAUDE.md` without a trailing newline is not byte-restorable on remove; ignore re-inclusion
  detection uses scratch git repositories; telemetry loopback is proven through the environment
  endpoint and the unchanged launcher.

Hardening for O2-O4 requires separate governed follow-on work.

Known limits, not fabricated: no real consumer repository was read or modified; the guard was
exercised through a test MCP client and fixtures only; no Claude, DIAL, CodeMie, or model process
was invoked; the pin does not cover Node.js, the OS, or a hostile local actor with write access to
the install; the cutover proposal has not been verified against the mature runner; no package was
published.
