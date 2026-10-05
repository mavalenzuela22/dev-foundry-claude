# dev-foundry-claude

dev-foundry-claude connects Claude Code to your project's DEV FOUNDRY rules for
planning, implementation, review and evidence. It prepares project instructions,
two dedicated Claude subagents and a local governance connection. It also gives
you a read-only dashboard of local work records and Claude telemetry, and
launchers for your existing `direct`, `dial` or `codemie` setup.

The current adapter package is **1.2.0** (`@dev-foundry/claude-adapter`). You can
install a received package without cloning this repository or building the UI.

**This README is orientation, not authority.** Your project's approved rules and
authorizations determine what work may run; installation alone grants none.

## Prerequisites

- Node.js 20 or newer, npm and Git.
- An immutable adapter tarball and its expected SHA-256 from an authorized
  artifact handoff: someone authorized to deliver the package must provide both.
- For the adapter steps, a repository with completed DEV FOUNDRY **2.1.0** adoption
  and a clean Git working tree. Choose your starting point below if it is not ready.
- Your project's governed runner/process for framework adoption and the later
  switch to Claude. A runner is the tool or agent authorized to carry out that
  project's governed work.
- For Claude sessions: Claude Code and your existing authentication/provider
  setup. `dial` needs the `dial` launcher; `codemie` needs `codemie-claude` on
  `PATH`. The dashboard needs no Claude session or provider credentials.

## Which starting point are you?

| Your situation | First action | Then |
| --- | --- | --- |
| **Greenfield:** new repository, no DEV FOUNDRY yet | Ask your governed runner to establish the minimum DEV FOUNDRY 2.1.0 governance needed for your first capability. | Follow the adapter walkthrough below. |
| **Brownfield:** existing repository/product, no DEV FOUNDRY yet | Ask your governed runner to inventory current behavior and adopt DEV FOUNDRY 2.1.0 while preserving the product and its history. | Follow the adapter walkthrough below. |
| Existing repository already governed by **DEV FOUNDRY 2.1.0** | Confirm framework adoption is complete and current project configuration agrees. | Go directly to the adapter walkthrough. |
| Existing repository governed by **1.x, 2.0 or another earlier version** | Use your governed runner to review compatibility and explicitly adopt/migrate to 2.1.0. | Follow the adapter walkthrough after reconciliation is complete. |
| Repository **partway through framework adoption** | Finish the existing adoption under your project's process; resolve incomplete or contradictory configuration. | Follow the adapter walkthrough once 2.1.0 adoption is active. |
| Existing consumer **pinned to an older adapter release** | Keep using that exact release. There is no supported automatic adapter upgrade command yet. | Arrange a separately governed adapter upgrade; see [reinstall and upgrades](#integrity-reinstall-and-upgrades). Installing 1.2.0 alone does not migrate the pin. |

DEV FOUNDRY 2.1.0 supports greenfield, brownfield and explicit version adoption
under **OPS-005**, its project adoption and versioning rules. The journey has two
stages: establish the framework in your repository, then prepare and activate the
Claude adapter. **The adapter CLI does not bootstrap or migrate the framework.**

An adapter **pin** records the exact package build a consumer is configured to
use, including its version and payload hash. A framework version change and an
adapter release change are separate journeys.

### Stage 1: make the framework ready

The following are copy/paste **requests to your governed runner**, not shell
commands. Replace the repository path and describe your first capability where
needed. Your runner must use your project's own authorization and review process.

**Greenfield request:**

```text
For /absolute/path/to/my-new-repo, establish DEV FOUNDRY 2.1.0 under OPS-005
as a greenfield adoption. Create only the minimum governance required for
our first capability: [describe it]. Do not import another project's history
or evidence. Complete required review/acceptance and report framework readiness
before we use the Claude adapter CLI.
```

**Brownfield request:**

```text
For /absolute/path/to/my-existing-product, adopt DEV FOUNDRY 2.1.0 under
OPS-005 as a brownfield project. Inventory verified behavior, architecture,
interfaces, delivery process, governance and dependencies; separate facts
from assumptions. Preserve current product behavior and historical evidence.
Reconcile only the governance needed, select an appropriate metadata migration
policy, and complete required review/acceptance before adapter adoption.
```

**Earlier framework version request:**

```text
For /absolute/path/to/my-governed-repo, review and explicitly adopt DEV FOUNDRY
2.1.0 from the currently recorded version under OPS-005. Assess active authority
and work, metadata/schema compatibility, role/capability profiles, project
configuration and platform startup bindings. Preserve historical evidence under
the version that produced it. Propose bounded reconciliation and any required
migration/deviation records; apply only with project authorization and complete
required review/acceptance before adapter adoption.
```

When ready, your project should have an active **Project Operating Profile**
(POP), which records repository identity, framework version and role assignments;
an **Authority Index**, which routes to the project's governing documents; and
the selected immutable 2.1.0 framework release. Roles and platform startup
configuration must be consistent. A partial adoption should finish this stage
rather than start another adoption alongside it.

## Stage 2: install, prepare and activate the adapter

### Worked example: acme-billing

This complete walkthrough uses a fictional existing product at
`$HOME/Development/acme-billing`. Its team has completed brownfield framework
adoption to DEV FOUNDRY 2.1.0 using the request above and still uses its current
runner. Substitute your own repository and received artifact paths. Run the shell
blocks in the same terminal; requests in `text` blocks go to your governed runner.

### 1. Receive and verify the package

Obtain `dev-foundry-claude-adapter-1.2.0.tgz` and the expected SHA-256 through an
authorized artifact handoff. **No public registry or download channel has been
selected by this project.** Someone must deliver the artifact today; there is no
public install URL to use. You do not need to clone dev-foundry-claude once you
have the immutable tarball.

Set the received path and paste the handoff's actual 64-character hash:

```sh
ADAPTER_TARBALL="$HOME/Downloads/dev-foundry-claude-adapter-1.2.0.tgz"
EXPECTED_SHA256='paste-the-SHA-256-from-the-authorized-handoff-here'
printf '%s  %s\n' "$EXPECTED_SHA256" "$ADAPTER_TARBALL" | shasum -a 256 -c -
```

Continue only if verification reports `OK`. If it fails, resolve the discrepancy
with the artifact provider before installing. A hash calculated only from the
received file is not a comparison against the handoff.

### 2. Install outside the consumer repository

Use a fresh dedicated prefix for this build. The received tarball includes the
runtime dependencies and prebuilt dashboard; consumers need no UI build tools.

```sh
ADAPTER_PREFIX="$HOME/.local/share/dev-foundry/claude-adapter-1.2.0"
mkdir -p "$ADAPTER_PREFIX"
npm install --prefix "$ADAPTER_PREFIX" --offline --ignore-scripts --no-audit --no-fund "$ADAPTER_TARBALL"
export PATH="$ADAPTER_PREFIX/node_modules/.bin:$PATH"
dev-foundry-claude --version
```

Expected version: `1.2.0`. Persist the prefix and `PATH` settings in the shell or
environment that launches Claude Code and its local tools. Use a separate fresh
prefix if a different build already occupies this one. Installation does not
change the consumer's configuration, authority or adapter pin.

### 3. Plan the consumer changes

From the consumer's Git top-level, create the plan **outside the repository**.
This prevents the plan file itself from dirtying the repository being checked.

```sh
CONSUMER_ROOT="$HOME/Development/acme-billing"
cd "$CONSUMER_ROOT"
git status --short --untracked-files=all
ADOPTION_WORKDIR="$(mktemp -d /tmp/dev-foundry-claude-plan.XXXXXX)"
ADOPTION_PLAN="$ADOPTION_WORKDIR/adoption-plan.json"
dev-foundry-claude adopt plan --root "$PWD" --out "$ADOPTION_PLAN"
cat "$ADOPTION_PLAN"
```

Before planning, resolve uncommitted work through your normal workflow. The plan
checks repository identity, active framework selection and authority routing,
role/startup configuration, existing adapter files and pins, file collisions and
uncommitted changes on affected paths. It inspects consumer files without changing
them; `--out` writes only the external plan. It is not a full framework acceptance
audit and does not complete framework adoption for you.

The printed result contains `planSha256`, a hash of the exact plan bytes:

| Plan result | Meaning and next action |
| --- | --- |
| `ready` | Adapter changes can be prepared. Review the proposed files/diffs and obtain authorization under your project's process before applying. |
| `not-governed` | The CLI could not recognize a complete active framework setup. Finish or reconcile Stage 1, then plan again. |
| `blocked` | A version, identity, configuration or file conflict prevents preparation. Read `blockers` in the plan, resolve them, then create a fresh plan. |
| `noop` | No adapter-owned file changes are needed. Check activation with `adopt status`; this does not itself mean Claude roles are active. |

The plan also contains a separate `cutover_proposal`: a proposed switch of your
project's role assignments and platform startup configuration to Claude.
Review it now, but its application is a later consumer-governed step.

### 4. Apply the reviewed adapter plan

Proceed only with a `ready` plan authorized by your project's process. Paste the
`planSha256` printed in step 3; do not edit the reviewed plan file.

```sh
PLAN_SHA256='paste-the-printed-planSha256-here'
dev-foundry-claude adopt apply --root "$PWD" --plan "$ADOPTION_PLAN" --plan-sha256 "$PLAN_SHA256"
dev-foundry-claude adopt status --root "$PWD"
```

`apply` verifies the plan hash, installed package identity and current repository
preconditions. If they changed, create and review a new plan. It writes the two
subagent definitions, an adapter-owned block in `CLAUDE.md`, the local governance
entry in `.mcp.json` and telemetry Git-ignore rules when needed.

For this first adoption, expect `"overall": "prepared"` from `status`.
**Apply intentionally does not change consumer authority**: it leaves your
Authority Index, POP role bindings, existing platform startup configuration and
framework release untouched. The `cutover_proposal` stays in the external plan;
apply does not execute it. Status derives activation from current consumer
authority, not from the presence of the generated files.

**You can use the dashboard in prepared state because it is read-only. Governed
Claude role execution requires an active consumer cutover.** A Claude launcher
may start before cutover, but governed role resolution will return
`BINDING_INACTIVE`.

### 5. Review and activate under the consumer's governance

Give your current governed runner the actual plan path printed by
`printf '%s\n' "$ADOPTION_PLAN"`. The following is a **runner request, not a
shell command**:

```text
For acme-billing at [absolute consumer path], review cutover_proposal in
[absolute adoption-plan.json path] under this consumer's own governance.
Verify its base hashes, close or hand off work tied to the current runner,
and review the proposed profiles and authority changes. Obtain required
authorization and review before applying the proposal atomically across all
five role bindings, the Authority Index and platform startup configuration.
Preserve historical evidence and verify activation after the approved cutover.
```

The switch covers authoring, implementation, independent audit, mechanical
validation and evidence custody together. It retires the previous active runner
startup binding for this repository. The proposal includes a warning that it has
not been verified against the mature runner; your consumer review must establish
compatibility. Handle generated file review/commits through the same project
process. Do not apply just part of the authority switch.

After the consumer process completes the cutover:

```sh
dev-foundry-claude adopt status --root "$PWD"
```

Expect `"overall": "active"`, all five roles reported as `claude-active`, and
`bootstrap.claudeActive` set to `true`. `partial` means role/startup configuration
is incomplete or mixed; return to your consumer's governed process to reconcile
it before governed Claude work. Active bindings still require authorization for
each task under your project's rules.

### 6. Open the dashboard

This command works after preparation as well as after activation:

```sh
dev-foundry-claude dashboard --port 43127
```

Open **http://127.0.0.1:43127**. It displays this consumer's execution, validation,
transaction and available Claude telemetry records. Empty or unavailable evidence
is expected when the project has not produced those records. It does not start
Claude, collect new telemetry or authorize work. Ctrl-C stops the server.

From another directory, select the consumer explicitly:

```sh
dev-foundry-claude dashboard --port 43127 --root "$CONSUMER_ROOT"
```

### 7. Start Claude using your existing provider setup

After activation, run from the consumer repository or one of its subdirectories.
Choose one mode:

```sh
# Installed Claude Code directly:
dev-foundry-claude run direct --

# Existing DIAL launcher:
dev-foundry-claude run dial --

# Existing CodeMie launcher:
dev-foundry-claude run codemie --
```

Any Claude arguments go after `--` and are passed through unchanged. The adapter
checks the installed package against the consumer's pin, starts a local telemetry
collector and launches `claude`, `dial` or `codemie-claude` with interactive input
and output. Authentication, model choice and provider routing use your existing
setup. Sanitized records go to the ignored `.dev-foundry/telemetry/local/` directory.

**MCP** (Model Context Protocol) is the local tool connection Claude uses to resolve
your project's governing rules. Adoption adds the project-scoped
`dev-foundry-governance` server entry in `.mcp.json`. Open the correct consumer
workspace, review and approve its workspace trust/MCP prompts when the Claude host
asks, and restart the session after configuration changes so it reloads the entry.
The launching environment must have the adapter on `PATH`; the Claude host must
provide `CLAUDE_PROJECT_DIR` pointing to this consumer.

Before governed work, confirm project instructions are loaded and the governance
MCP is connected with `resolve_governed_operation` available. Trust and MCP
approval allow the local connection; they do not replace consumer cutover or task
authorization. The adapter does not silently grant trust or pre-approve MCP.

## If you see this, do this

| Symptom | Action |
| --- | --- |
| `not-governed` | Confirm `--root` is the consumer Git top-level. Ask your governed runner to complete/reconcile active framework adoption, including the POP, Authority Index and selected release. Recreate the plan. |
| `unsupported-framework` | Have your runner explicitly adopt DEV FOUNDRY 2.1.0, or reconcile contradictory recorded versions through the consumer's process. The adapter does not migrate the framework. |
| `dirty-working-tree` | Preserve the work. Review and commit or otherwise resolve affected changes through your normal workflow; keep the plan outside the repository, then create/review a fresh plan. |
| `adapter-runtime-mismatch` or `Adapter runtime verification failed.` | Check that `PATH` selects the exact build pinned by this consumer. Restore that immutable tarball into a fresh prefix if necessary. A different 1.2.0 build can also mismatch. Do not edit the pin to bypass verification; an older adapter consumer needs a governed upgrade. |
| `BINDING_INACTIVE` | Run `adopt status`. In `prepared`, complete the reviewed consumer cutover; in `partial`, reconcile mixed role/startup authority through the consumer process. Installing or approving MCP cannot activate bindings. |
| Dashboard requires a consumer Git repository or project operating profile | Run inside the intended consumer or pass `--root /absolute/path/to/consumer`. Complete framework adoption and adapter preparation. Never select the package prefix as the evidence root. |
| Requested dashboard port is occupied | Choose another explicit port, for example `dev-foundry-claude dashboard --port 43128`, then open `http://127.0.0.1:43128`. There is no automatic fallback port. |
| Dashboard command prints usage | Supply exactly one `--port` in 1024–65535 and, optionally, one `--root`. Unknown, duplicate or malformed arguments are rejected. |

## Technical reference

### Producer, package and consumer

The **producer** is this source repository: it owns adapter code, build dependencies
and package creation. The **immutable package** contains the verified runtime,
dashboard assets and templates. The **consumer** is your repository: it owns its
authority, configuration and operational evidence. Producer state never becomes
consumer authority, and producer changes never update consumers automatically.

Producer authority is routed through `.dev-foundry/authority-index.yaml` and the
project source of truth in `docs/`. Each consumer retains its own authority.
README, templates, runtime records and installation do not authorize governed work.

### Create a package in the producer

These commands are for maintainers with a producer checkout, not consumers with
a received tarball. Vite 7 requires Node 20.19+ or 22.12+ (or a later supported
Node version). Consumers need neither Vite, TypeScript nor a nested dashboard
dependency install.

```sh
npm ci
npm --prefix tools/dashboard ci
npm --prefix tools/dashboard run typecheck
npm --prefix tools/dashboard run build
npm --prefix tools/dashboard test
npm test
npm pack --dry-run --json
npm pack --pack-destination /absolute/path/to/artifacts
```

The artifact directory must already exist. `prepack` always rebuilds the UI from
`tools/dashboard`, then generates `payload-manifest.json` from npm's actual file
list and verifies bundled runtime dependency versions against the root lockfile.
The tarball is `dev-foundry-claude-adapter-1.2.0.tgz`. Identical inputs and locked
build dependencies produce identical payload and tarball bytes. There is no
consumer install/build lifecycle script.

Check the tarball/manifest relationship and record its identity for the governed
artifact handoff:

```sh
node scripts/package/payload-manifest.mjs --check /absolute/path/to/artifacts/dev-foundry-claude-adapter-1.2.0.tgz
shasum -a 256 /absolute/path/to/artifacts/dev-foundry-claude-adapter-1.2.0.tgz
node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; const b=fs.readFileSync("payload-manifest.json"); console.log(JSON.parse(b).version+":sha256:"+crypto.createHash("sha256").update(b).digest("hex"));'
```

Retain the tarball SHA-256 and the printed `<version>:sha256:<payload-root>`.
Keep that tarball immutable. Version alone cannot identify a build. Packing does
not publish to a registry or create a tag/release. Any future hosted/signed release
channel requires separate governance and must preserve immutable version/payload
identity. The offline tarball/prefix install mechanism has been tested with
registry access disabled and the temporary producer build tree deleted.

### Package contents and exclusions

The package ships the CLI, governance MCP resolver, adoption code/templates,
telemetry collector/launcher, dashboard server and compiled assets, README/package
metadata, a complete payload manifest and allowlisted bundled MCP/YAML/Zod runtime
dependencies. Dashboard `node_modules`, UI source/build tooling, producer docs/task
history, `.dev-foundry` state/evidence, `.claude` state, `.env` and secrets are
excluded. Root runtime dependency bundles remain part of the offline installation
and integrity model; the producer's development dependency tree is not distributed.

### MCP launch entry

The adoption plan renders this consumer `.mcp.json` entry:

```json
{
  "mcpServers": {
    "dev-foundry-governance": {
      "type": "stdio",
      "command": "dev-foundry-claude",
      "args": ["mcp", "--expect", "<version>:sha256:<payload-root>"]
    }
  }
}
```

Use the exact pin generated by adoption, not the placeholder above.
`dev-foundry-claude mcp --expect <pin>` verifies the installed payload before
serving MCP over stdio. Its project root comes from the host's
`CLAUDE_PROJECT_DIR`. Governed resolution is refused until the consumer's Claude
bindings are active. `run` resolves the consumer Git top-level, verifies its pin,
retains interactive stdio and returns the selected launcher's exit code.

### Dashboard data and security

The dashboard CLI resolves the selected directory's Git top-level and checks the
consumer profile and matching adapter pin. Prepared adoption suffices for this
read-only view. It never falls back to the installation or producer checkout for
evidence; UI assets always come from the verified installed package.

The listener binds only `127.0.0.1`. Only GET/HEAD are accepted; Host must be the
numeric loopback host with a port. There is no CORS API, LAN/public listener,
tunnel, mutation, execution, validation or promotion operation. Reads reject
unsafe paths and symlinks and enforce fixed file/scan bounds. Missing, malformed
and truncated evidence stays visibly unavailable or degraded. CSP keeps scripts
and API connections local; the UI styles allow fonts from the fixed EPAM CDN
origin.

The dashboard reads these **consumer-local** evidence sources:

- durable `.dev-foundry/executions/**` and execution-request registry metadata,
  with minimum related execution-contract metadata for executor identity;
- governed `.dev-foundry/validation-requests/requests/**`;
- `.dev-foundry/repository-transactions/**`;
- matching `otel-YYYY-MM-DD.ndjson` and `operations-YYYY-MM-DD.ndjson` files
  under `.dev-foundry/telemetry/local/`.

The CLI additionally reads the consumer profile and `.mcp.json` for launch checks.
APIs read fixed evidence roots, never arbitrary filesystem contents or source
files. Durable record details retain bounded JSON excerpts of status/request/
transaction records (up to 32 KiB); those records must themselves contain
appropriate operational metadata. Claude OTEL has a separate presentation
allowlist: it excludes credentials, prompts, assistant responses, tool inputs/
outputs, full commands, host paths, account identifiers and raw OTLP payloads.
OTEL run/session IDs are hashed for display. CodeMie analytics and producer
evidence are not read.

Live Activity and runner Throughput remain unavailable. Claude OTEL reports
measured values only, with missing values distinct from zero. Task/role/launch-mode
correlations are context, not attributed cost/token measurements. The dashboard
never starts a collector or generates telemetry.

The health endpoint is `/api/dashboard/v1/health`; evidence endpoints include
`executions`, `validations`, `transactions` and `claude-otel` under the same prefix.
The producer convenience command `node scripts/dashboard.mjs --port 43127` remains
available after a producer UI build, using that checkout's evidence and the same
server implementation.

### Integrity, reinstall and upgrades

The adapter **pin** binds the package version and SHA-256 of canonical manifest
bytes. Every shipped regular file, including compiled dashboard assets, templates,
README and bundled dependencies, has its own size/hash entry. The manifest itself
is bound by the pin. Unexpected, missing or modified files or a different installed
build stop `mcp`, `run` and `dashboard` before serving/launching. Verification is
local and performs no network lookup. It detects drift; it does not defend against
a hostile local actor who can replace the verifier, Node or the OS.

Reinstalling the **exact same tarball** into a fresh prefix and updating `PATH`
preserves the consumer's existing pin. Replacing it with another version/build
does not update `.mcp.json`; runtime verification fails. `adopt plan` reports
`adapter-runtime-mismatch` against a different existing adapter pin.

There is currently **no supported automatic adapter upgrade command or in-place
pin migration**. Keep the existing pinned release available. Moving an adopted
consumer to a new release requires a separately governed upgrade capability under
the project's adapter release/consumer upgrade contract (SPC-005). Do not manually
bypass the pin to make a new installation run. Framework version adoption under
OPS-005 and an adapter release upgrade are separate operations.
