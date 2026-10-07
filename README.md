# dev-foundry-claude

AI-assisted coding can lose track of decisions between sessions, expand a small
request into unrelated changes, or call work finished before it has been checked.
DEV FOUNDRY keeps project decisions, work limits and required checks in the
repository so each session can pick up from the same agreed starting point.

The **Claude Code adapter 1.4.0**, `dev-foundry-claude`, connects those project
rules to Claude and provides guided setup, launch, diagnostics and upgrades.

## 60-second Quick Start

You need **Node.js 20+**, **Git**, and your Claude runtime installed and signed in.
Install the public package, then open your project:

```sh
npm install -g https://github.com/mavalenzuela22/dev-foundry-claude/releases/latest/download/dev-foundry-claude-adapter.tgz
cd <project>
dev-foundry-claude setup
dev-foundry-claude start
```

Replace `<project>` with your Git project directory. `setup` inspects first and
prints the next action. If it offers a managed-file plan, review it and run
`dev-foundry-claude setup --yes` to prepare the integration.

For a project with no DEV FOUNDRY authority, `setup --yes` explicitly confirms
adoption of the packaged DEV FOUNDRY 2.1.0 release and establishes the first
active Claude integration. `start` launches once runtime preflight passes. For an explanation at any
point, run `dev-foundry-claude help setup`.

## What setup and start do

### setup: inspect, then prepare

By default, `setup` is read-only. It checks the current project, lists the
managed files it proposes to change, and tells you what to do next.

After reviewing that plan:

```sh
dev-foundry-claude setup --yes
```

Preparation supplies Claude integration files: managed agents, a marked block
in `CLAUDE.md`, a local connection between Claude and the installed adapter,
DEV FOUNDRY integration files, and an ignore rule for local telemetry.

Setup and upgrade refreshes **do not change your application code**. Setup
preserves existing project rules and responsibility assignments; it does not
approve or silently rewrite approved project rules. Upgrade stays within verified
DEV FOUNDRY-owned integration files. Local edits or unclear ownership can prevent
these operations from proceeding.

If the project has no DEV FOUNDRY configuration, setup previews the project
identity, classification, human Operator, framework and exact paths. It derives
defaults from repository facts. Supply missing choices with `--project <name>`,
`--classification greenfield|brownfield` and `--operator "Your name"`.
`setup --yes` (or `--apply`) is explicit human confirmation to create minimum
project authority and active Claude bindings. The installed package carries the
byte-exact immutable framework; no producer checkout or network lookup is needed.
The first task establishes a verified baseline. For a brownfield project,
ordinary product implementation waits until the existing system is observed.
Existing incomplete governance is refused for review, never overwritten.

If files are prepared but Claude is not active, the owner must review and
approve Claude's project responsibilities through that same process.
`setup --json` includes a technical activation proposal for that review;
setup never applies it. Once activation is complete:

```sh
dev-foundry-claude status
dev-foundry-claude start
```

“Prepared” means the integration files exist. “Active” means Claude's project
responsibilities have been approved. “Ready” means the integration and launch
checks also pass. Follow the next action printed for your project's state.

### start: launch Claude in this project

`start` checks readiness and delegates to the packaged telemetry launcher. It
starts Claude in the current project using your existing runtime and credentials.
The default runtime is Claude Code directly.

You manage runtime installation, provider authentication and access yourself.
The adapter does not provision accounts or configure provider credentials.
Runtime options and passing arguments to Claude are covered by
`dev-foundry-claude help start`.

The installed package payload is integrity-checked. The project selects an exact
adapter version and payload checksum, so another build with the same version
label is not automatically interchangeable.

## The six primary commands

Run these from your project directory:

| Command | Use it to… |
| --- | --- |
| `dev-foundry-claude setup` | Inspect the project and see how to prepare Claude integration. |
| `dev-foundry-claude start` | Launch Claude when the project is ready. |
| `dev-foundry-claude status` | See readiness, the selected adapter and the next action. |
| `dev-foundry-claude upgrade` | Preview moving the project to the installed adapter release. |
| `dev-foundry-claude doctor` | Diagnose integration problems without changing files. |
| `dev-foundry-claude help` | Get getting-started guidance and discover contextual help. |

For flags and current behavior, use the help shipped with your installed release:

```sh
dev-foundry-claude help getting-started
dev-foundry-claude help <topic>
```

Replace `<topic>` with `setup`, `start`, `status`, `upgrade`, `doctor` or
`concepts`. CLI help and read-only MCP help resources use the same content.

## Optional local telemetry and dashboard

You can use the integration without opening a dashboard. `start` enables local
telemetry for the Claude session; viewing that data is optional.

In a second terminal, from the same project directory:

```sh
dev-foundry-claude dashboard --port 4319
```

Open the URL it prints, normally **http://127.0.0.1:4319**. The dashboard reads
local work records and available Claude measurements. It needs a prepared
project and matching adapter package, but no running Claude session or provider
credentials just to view records. It does not approve work or modify project
rules.

Telemetry and dashboard listeners bind only to **127.0.0.1**, accessible on this
computer. They are not public or LAN services. Local telemetry is stored under
`.dev-foundry/telemetry/local` and is excluded from Git by the setup ignore rule.
This local boundary does not change your Claude provider's own data handling.

A telemetry-ready status is a preflight result. Collection begins when the
collector starts with Claude and ends with that session. The dashboard can show
only measurements actually emitted and recorded; missing measurements are not
proof of zero usage or cost.

Opening the dashboard does not invoke Claude or spend Claude tokens. If port
4319 is occupied, choose another local port, such as 4320, and use the newly
printed URL.

## Choose your setup or upgrade path

- **No DEV FOUNDRY:** `setup` preview → `setup --yes` → `start`.
- **Legacy pre-1.4.0:** stage 1.4.0 alongside the exact previous package,
  preview the one-time bridge with `upgrade --from-package <previous-package>`,
  apply with the same arguments plus `--yes`, then `start`. Exact supported
  builds are the 1.2.2 TSK-018 artifact, 1.3.0 validation artifact and reproduced
  v1.3.0 public-tag package, identified by
  payload checksum in packaged migration material. Product files, historical
  evidence and foreign active governance bindings are preserved.
- **1.4.0+ governance changes:** continue in the current governed Claude session,
  review the staged target under current project authority, obtain reserved human
  decisions and validation/audit, cross the authorized cutover, then run a fresh
  `dev-foundry-claude start`. The old session cannot resolve further governed work.

For upgrades, preserve the source installation and stage targets outside the
project in an isolated directory. For example, with an acquired tarball:

```sh
npm install --prefix /path/to/isolated-target /path/to/release.tgz --offline --ignore-scripts
node /path/to/isolated-target/node_modules/@dev-foundry/claude-adapter/bin/dev-foundry-claude.js migration
```

`migration` verifies the staged package and exposes its migration contract and
exact identity without changing project files. A target requiring semantic
reconciliation routes `upgrade` to your currently governed Claude session;
CLI code cannot make those project decisions. There are no background updates.

## Upgrading to adapter 1.4.0

Installing a release changes the tool on your machine. `upgrade` separately
moves a configured project's selection to that installed tool. Review its
preview before applying changes.

Keep the older installation available outside the project and acquire the target
side-by-side without replacing the source runtime. A refresh may need it to prove which existing files the adapter owns.
Commit or restore pending changes to files the upgrade would touch.

```sh
npm install --prefix /path/to/isolated-target /path/to/release.tgz --offline --ignore-scripts
cd <project>
node /path/to/isolated-target/node_modules/@dev-foundry/claude-adapter/bin/dev-foundry-claude.js upgrade
```

`latest` is an acquisition alias: it downloads the current public release. It
does not automatically change a project's exact adapter selection. The behavior
described here is the 1.4.0 implementation; use installed help for your version.

### Read the preview

A **compatible upgrade** updates only the project's adapter runtime selection in
`.mcp.json` when existing managed files already match the target templates.

A **managed refresh** in 1.4.0 also deterministically updates verified
DEV FOUNDRY-owned agent files and the marked `CLAUDE.md` block when their target
bytes differ. The preview names the managed paths and reports application files
affected. It preserves content outside the managed block and other MCP entries.

For a managed refresh, supply the previous package directory:

```sh
dev-foundry-claude upgrade --from-package /absolute/path/to/previous-package
```

This must be the retained installed package or the `package` directory unpacked
from the exact previous release tarball, outside your project. It must pass
payload verification, match the project's current version/checksum selection,
and reproduce the existing managed files. A similar version or a different
build with the same label is insufficient.

If current files have been edited or ownership cannot be established, the
adapter refuses the refresh. Have the project owner review the difference and
restore the verified managed bytes where appropriate before trying again.

### Apply after review

For a compatible upgrade:

```sh
dev-foundry-claude upgrade --yes
```

For a verified managed refresh, retain the same previous-package argument:

```sh
dev-foundry-claude upgrade --from-package /absolute/path/to/previous-package --yes
```

Without `--yes` or `--apply`, upgrade writes nothing. Applying recomputes a
deterministic plan and enforces its exact bytes and SHA-256 hash against the
current repository and target package. If that state drifts, apply is refused.
For separately saved plans and hashes, see the advanced contract linked below.

After an upgrade:

```sh
dev-foundry-claude status
dev-foundry-claude start
```

Framework version adoption remains a separate owner-approved operation; an
adapter upgrade does not upgrade your project's DEV FOUNDRY methodology.

## Troubleshooting

Start with the read-only diagnostic command:

```sh
dev-foundry-claude doctor
```

It checks the repository, project configuration, package integrity, runtime
selection, managed files, Claude activation, runtime executable, telemetry
preflight and packaged dashboard. It starts no listener and performs no repair.
Follow the recovery command it prints.

| What you see | What to do next |
| --- | --- |
| The project needs setup | Run `setup` in the intended Git repository and follow its next action. |
| DEV FOUNDRY project configuration is missing or incomplete | Ask the project owner to complete or review it; `help setup` explains the boundary. |
| Claude files are prepared, but launch is not ready | Have the owner review and authorize activation, then run `status`. |
| Installed adapter and project selection differ | Run `upgrade` to preview reconciliation; provide the previous package if requested. |
| Managed files differ or an upgrade cannot prove ownership | Review local edits and the exact previous package with the owner; use `help upgrade`. |
| The installed package cannot be verified | Reinstall the exact trusted release selected for the project, then run `doctor`. |
| Claude's executable is unavailable or sign-in fails | Install and authenticate your chosen runtime separately; consult `help start`. |
| Telemetry cannot start | Check the diagnostic guidance for local storage, ignore rules and port configuration. |
| The dashboard port is busy | Select another port and open its printed loopback URL. |

For support details without making technical codes the starting point:

```sh
dev-foundry-claude doctor --verbose
dev-foundry-claude doctor --json
```

Do not change recorded checksums to bypass a failed package check. If diagnostics
identify a runtime or configuration problem, resolve that cause before launching.

## How it works in two minutes

**Keep project rules durable.** Decisions live in repository documents instead
of only in a chat. A later session can find the agreed behavior and constraints.
The adapter helps Claude resolve the rules relevant to the current operation.

**Bound each piece of work.** Agree on one useful outcome, the files it may
change, what is excluded and how to check the result. For example, adding CSV
export need not turn into rebuilding the reporting system. These work records
belong to delivery planning; they are not manual installation steps.

**Separate implementation, checking and authorization.** Making a change,
checking it and deciding whether it may be integrated are different
responsibilities. A tool's ability to edit files is not approval to change the
requirements or release its own work. The project's assignments and approval
process determine who may do each job.

**Keep evidence of what happened.** Record checks against the actual work state,
their results and anything still unverified. Passing tests support a result;
they do not themselves authorize integration or deployment.

The adapter connects this approach to Claude. Your project's approved rules
remain the authority; CLI help, the dashboard and this README explain the tool.

## Learn more / Advanced

You can return here when you need to inspect the project's governance records or
automate a supported workflow. These terms are not prerequisites for trying
`setup` or reading installed help.

### Concise glossary

| Term | Meaning |
| --- | --- |
| Source of Truth (SoT) | The authoritative home for a project's approved rule or decision. |
| Authority Index | Routes each concern to its authoritative document and scope. |
| Project Operating Profile (POP) | Records project identity, selected framework, role assignments and local policies. |
| Task (TSK) / Micro-Task Plan (MTP) | A bounded outcome / a bounded implementation plan for that work. |
| Governance Author / Governance Auditor | Responsibilities for governing decisions / independently reviewing conformance when required. |
| Implementation Executor / Mechanical Validator / Evidence Custodian | Responsibilities for implementing bounded work / running checks / preserving its records. |
| Actor Profile / Capability Profile | A role's responsibilities and limits / a particular implementation's abilities and limits. |
| Lifecycle / promotion | Distinct work stages / an authorized move across an integration or release boundary. |

### Repository and framework documentation

The [repository documentation map](<docs/00-overview/00 [OVR-002] PROJECT - Documentation Map and Artifact Taxonomy.md>)
and [system overview](<docs/00-overview/00 [OVR-001] PROJECT - System Overview.md>)
cover the adapter's architecture and product documents.

The repository's selected **DEV FOUNDRY 2.1.0** release has the full methodology
reference. Your own project's selected release and Authority Index govern its
operation; these links are not a framework adoption instruction.

| Read more about… | Reference |
| --- | --- |
| Full 2.1.0 authority and routing | [Framework Authority Index](.dev-foundry/releases/2.1.0/authority-index.yaml) |
| SoT and methodology | [Framework Overview](<.dev-foundry/releases/2.1.0/docs/00-overview/00 [OVR-001] DF - Framework Overview.md>) |
| Document types and their responsibilities | [Framework Documentation Map](<.dev-foundry/releases/2.1.0/docs/00-overview/00 [OVR-002] DF - Documentation Map and Artifact Taxonomy.md>) |
| TSK/MTP and lifecycle | [Governed Planning and Delivery](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-001] DF - Governed Planning and Delivery Lifecycle.md>) |
| Roles and independence | [Roles and Separation of Duties](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-003] DF - Roles Responsibilities and Separation of Duties.md>) |
| Evidence and review | [Validation, Audit and Evidence](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-004] DF - Validation Audit Evidence and Corrective Model.md>) |
| Framework adoption and versioning | [Project Adoption](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-005] DF - Project Adoption Versioning and Framework Evolution.md>) |
| POP, profiles and bindings | [Actor Profiles and Project Bindings](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-009] DF - Actor Profiles Project Bindings and Platform Bootstrap.md>) |
| Promotion and side effects | [Side Effect Authorization](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-008] DF - Side Effect Authorization and Promotion Safety.md>) |
| Exact upgrade plans and hashes | [Adapter Release and Consumer Upgrade Contract](<docs/40-specifications/40 [SPC-005] PROJECT - Claude Adapter Release and Consumer Upgrade Contract.md>) |
| Guided CLI behavior | [Guided Consumer CLI and Help Contract](<docs/40-specifications/40 [SPC-007] PROJECT - Guided Consumer CLI and Help Contract.md>) |

### Advanced compatibility

Low-level `adopt plan/apply/status`, `upgrade status/plan/apply`, `mcp`, and
`run direct|dial|codemie` remain available for existing scripts and governed
workflows. Routine consumer use follows `setup`, `start`, `status`, `upgrade`
and `doctor`. Consult the product contracts before scripting direct plan/apply
operations or activation changes.

Read-only MCP help resources use `dev-foundry://help/<topic>` and carry the same
versioned explanation as CLI help. They are explanatory resources, not project
authority.

## Maintainers

This section is for building and releasing the adapter from the producer
repository. Consumers install the released tarball and use the CLI above; the
package already contains runtime dependencies and the built dashboard.

Producer prerequisites and release responsibilities are defined in
[Producer-Consumer Separation](<docs/10-decisions/10 [ADR-004] PROJECT - Producer-Consumer Operational Separation and Adapter Release Lifecycle.md>)
and the [release/upgrade contract](<docs/40-specifications/40 [SPC-005] PROJECT - Claude Adapter Release and Consumer Upgrade Contract.md>).
The [release workflow](.github/workflows/release.yml) and
[asset builder](scripts/release/build-assets.mjs) define the executable pipeline.

For local producer verification with dependencies restored:

```sh
npm test
npm pack --dry-run --json
git diff --check
```

Packing runs `scripts/package/prepack.mjs`: it builds the dashboard and generates
`payload-manifest.json` from the package file inventory. Producer dashboard build
dependencies must be installed separately; they are not consumer prerequisites.
Release assets include the adapter tarball, its SHA-256 sidecar and release
metadata. Checks alone do not authorize publication or promotion.
