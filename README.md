# dev-foundry-claude

## What this gives you

dev-foundry-claude is an adapter that helps Claude Code follow your repository's
DEV FOUNDRY rules. DEV FOUNDRY is a framework for organizing software work:
planning changes, deciding who may carry them out, reviewing results and keeping
records of what happened.

The adapter sets up Claude project instructions, two specialized Claude agents
for implementation and review, and a local tool connection to your project's
rules. It also includes a read-only dashboard for work records and available
Claude usage data, plus launch commands for your existing Claude provider setup.

The current package is **1.2.0** (`@dev-foundry/claude-adapter`). You can install
it from a supplied package file without cloning this source repository or building
the dashboard.

**This README is orientation, not authority.** Your project's approved rules and
permissions determine which tasks Claude may perform. Installing the adapter
alone does not give Claude permission to work on a task.

## Quick start

**Already using DEV FOUNDRY 2.1.0?**

- **Yes:** install adapter → plan → apply → activate → dashboard / Claude.
- **No:** complete DEV FOUNDRY 2.1.0 adoption or migration → return here.

You need:

- Node.js 20 or newer, npm and Git.
- The adapter package file `dev-foundry-claude-adapter-1.2.0.tgz` and its expected
  SHA-256 checksum from the person authorized to supply it. A checksum lets you
  check that you received the exact file they intended to send.
- A Git repository with DEV FOUNDRY **2.1.0** setup complete and active, and a clean
  working tree. Save or commit your existing changes through your normal workflow
  before preparing the repository.
- For starting Claude: Claude Code and your existing login/provider configuration.
  DIAL users also need `dial`; CodeMie users need `codemie-claude` on `PATH`.
  The dashboard needs no Claude session or provider credentials.

The adapter cannot set up DEV FOUNDRY itself or migrate its version. If your
repository is not ready, complete DEV FOUNDRY 2.1.0 setup using the project's
normal DEV FOUNDRY adoption process. Once the repository reports **2.1.0 active**,
return to **Step 1** below. There is no adapter shell command for that prerequisite.

## Choose your situation

| Your situation | Where to start |
| --- | --- |
| New repository, nothing installed yet | Complete DEV FOUNDRY 2.1.0 setup using your project's normal adoption process, then return to Step 1 when 2.1.0 is active. |
| Existing repository that has never used DEV FOUNDRY | Complete DEV FOUNDRY 2.1.0 adoption using your project's normal process while preserving your product and history, then return to Step 1 when 2.1.0 is active. |
| Repository already on DEV FOUNDRY 2.1.0 | If setup is complete and active, start at Step 1. |
| Repository on an older DEV FOUNDRY release | Complete migration to DEV FOUNDRY 2.1.0 using your project's normal adoption process, then return to Step 1 when 2.1.0 is active. |
| Repository halfway through a DEV FOUNDRY adoption | Finish that adoption using your project's normal process, then return to Step 1 when 2.1.0 is active. |
| Existing dev-foundry-claude installation on an older adapter package | Start with [reinstall and upgrades](#package-integrity-reinstall-and-upgrades) and keep your current package available, because installing 1.2.0 does not upgrade an already configured repository. |

## Install dev-foundry-claude

### Step 1: verify and install the supplied package

Ask the package provider for both the `.tgz` file and its expected SHA-256.
**No public registry or download channel has been selected by this project.**
There is currently no public install URL.

Run the following blocks in the same terminal. Replace the package path if needed
and paste the actual 64-character checksum supplied with it:

```sh
ADAPTER_TARBALL="$HOME/Downloads/dev-foundry-claude-adapter-1.2.0.tgz"
EXPECTED_SHA256='paste-the-SHA-256-from-the-package-provider-here'
printf '%s  %s\n' "$EXPECTED_SHA256" "$ADAPTER_TARBALL" | shasum -a 256 -c -
```

Continue only when verification reports `OK`. If it fails, contact the package
provider to resolve the discrepancy. Calculating a hash from the file alone
cannot tell you whether it matches the file the provider intended to send.

Install into a dedicated directory outside your project. Use a fresh directory
if a different build already occupies this location:

```sh
ADAPTER_PREFIX="$HOME/.local/share/dev-foundry/claude-adapter-1.2.0"
mkdir -p "$ADAPTER_PREFIX"
npm install --prefix "$ADAPTER_PREFIX" --offline --ignore-scripts --no-audit --no-fund "$ADAPTER_TARBALL"
export PATH="$ADAPTER_PREFIX/node_modules/.bin:$PATH"
dev-foundry-claude --version
```

Expect `1.2.0`. The package includes its runtime dependencies and prebuilt dashboard;
you need no source checkout or dashboard build tools. Save the `ADAPTER_PREFIX`
and `PATH` settings in your shell configuration so new terminals and Claude's
local tools can find the installed command.

## Prepare the repository

### Step 2: create and review a plan

Set `PROJECT_ROOT` to your repository's absolute top-level path. The example path
below is fictional; replace it with yours. Check for uncommitted changes first:

```sh
PROJECT_ROOT="$HOME/Development/acme-billing"
cd "$PROJECT_ROOT"
git status --short --untracked-files=all
```

If Git lists changes, preserve and resolve them through your normal workflow
before continuing. Keep the plan outside the repository so creating it does not
add an untracked file to the project:

```sh
ADOPTION_WORKDIR="$(mktemp -d /tmp/dev-foundry-claude-plan.XXXXXX)"
ADOPTION_PLAN="$ADOPTION_WORKDIR/adoption-plan.json"
dev-foundry-claude adopt plan --root "$PROJECT_ROOT" --out "$ADOPTION_PLAN"
cat "$ADOPTION_PLAN"
```

This inspects the repository and writes the external plan without changing project
files. Review the proposed file changes. The printed summary includes `planSha256`,
the checksum of this exact plan; keep it for Step 3.

| Plan result | What to do next |
| --- | --- |
| `ready` | The adapter can prepare the proposed files; have the changes reviewed and approved through your project's normal process, then continue to Step 3. |
| `not-governed` | The repository's DEV FOUNDRY setup is missing or incomplete; complete DEV FOUNDRY 2.1.0 adoption, then repeat Step 2. |
| `blocked` | A version, configuration or file conflict prevents preparation; read the plan's `blockers`, resolve each issue, then create and review a fresh plan. |
| `noop` | No adapter file changes are needed; skip apply, run `dev-foundry-claude adopt status --root "$PROJECT_ROOT"` and check whether activation in Step 4 is still needed. |

A successful plan checks adapter prerequisites; it does not replace your project's
DEV FOUNDRY setup review.

### Step 3: apply the approved plan

Continue with an approved `ready` plan. Paste the `planSha256` printed in Step 2
and leave the reviewed plan file unchanged:

```sh
PLAN_SHA256='paste-the-printed-planSha256-here'
dev-foundry-claude adopt apply --root "$PROJECT_ROOT" --plan "$ADOPTION_PLAN" --plan-sha256 "$PLAN_SHA256"
dev-foundry-claude adopt status --root "$PROJECT_ROOT"
```

Apply checks that the plan, installed package and repository still match. If they
have changed, create and review a new plan. It sets up the two Claude agents,
project instructions in `CLAUDE.md`, the local tool connection in `.mcp.json`
and Git-ignore rules for local usage records when needed.

For a first-time setup, expect `"overall": "prepared"`. This means the adapter
files are ready, but the project has not yet switched its work responsibilities
to Claude. You can open the read-only dashboard at this point. To use Claude for
project tasks, complete activation next.

## Activate Claude

### Step 4: have the project review and apply the activation proposal

Activation switches the project's planning, implementation, review, validation
and record-keeping responsibilities to Claude. Installing and applying adapter
files does not make that switch.

The plan includes a separate activation proposal. That proposal must be reviewed
and applied by the project process that currently manages DEV FOUNDRY for this
repository. The adapter does not apply it automatically.

Give that process the plan's location:

```sh
printf '%s\n' "$ADOPTION_PLAN"
```

The project must review the proposal's compatibility, finish or hand off existing
work as needed, and approve and apply the complete switch together. Keep the plan
available until this review and activation are finished.

Then check again:

```sh
dev-foundry-claude adopt status --root "$PROJECT_ROOT"
```

Expect `"overall": "active"` with all five roles shown as `claude-active`.
`prepared` means the switch has not happened; `partial` means the configuration
is incomplete or mixed. Return to the project's setup process to finish or
resolve it before assigning Claude project work. Each task still needs whatever
approval your project normally requires.

## Open the dashboard

### Step 5: view local work records

Run this after preparation or activation:

```sh
dev-foundry-claude dashboard --port 43127 --root "$PROJECT_ROOT"
```

Open **http://127.0.0.1:43127**. Expect work execution, validation and transaction
records, plus available Claude usage measurements from this repository. Empty or
unavailable data is normal when the project has not produced those records.

The dashboard is read-only and accessible only on this computer. It does not
start Claude, collect new usage data or approve work. Stop it with Ctrl-C. When
running inside your repository, you can omit `--root`:

```sh
dev-foundry-claude dashboard --port 43127
```

## Start Claude

### Step 6: launch with your existing provider setup

After activation, open another terminal with the adapter on `PATH`, enter your
repository and choose one launch mode:

```sh
cd "$HOME/Development/acme-billing"  # Replace with your repository path.

# Claude Code directly:
dev-foundry-claude run direct --

# Your existing DIAL launcher:
dev-foundry-claude run dial --

# Your existing CodeMie launcher:
dev-foundry-claude run codemie --
```

Put additional Claude arguments after `--`. Expect an interactive Claude session
using your existing login, model and provider configuration. The adapter checks
that the installed package matches this repository's configuration and starts a
local usage-data collector for the session.

Open the correct project workspace and review the workspace trust and local tool
connection prompts when Claude asks. Restart Claude after configuration changes
so it reloads the connection. Before assigning work, confirm that Claude has
loaded the project instructions and connected the project tools. Trust approval
does not replace activation or task approval. Connection details are in the
[advanced reference](#mcp-launch-entry).

### Worked example: acme-billing

The team keeps an existing product at `$HOME/Development/acme-billing`. It first
completes DEV FOUNDRY 2.1.0 adoption while preserving its product and history.
Then it follows Step 1 with the supplied package and checksum, uses that project
path in Step 2, reviews the plan and applies it in Step 3.

Status reads `prepared`; the dashboard can now open. The team has its existing
project process review and apply the separate activation proposal. When status
reads `active`, it starts `dev-foundry-claude run direct --` from acme-billing.

## Troubleshooting

Start with the next action below. The final column explains the technical cause;
configuration terms are defined in the advanced reference.

| Message or symptom | Next action | Technical explanation |
| --- | --- | --- |
| `not-governed` | Point `--root` at your project's Git top-level, complete or repair DEV FOUNDRY 2.1.0 setup, then create a fresh plan. | The CLI cannot recognize the required active project configuration and selected framework release. |
| `unsupported-framework` | Complete migration to DEV FOUNDRY 2.1.0 through your project's normal adoption process; if it is already active, have that process reconcile conflicting version records. | The recorded framework versions are unsupported or disagree; the adapter cannot migrate them. |
| `dirty-working-tree` | Preserve and resolve affected uncommitted work through your normal workflow, keep the plan outside the repository, then create and review a fresh plan. | Changes on paths checked by adoption prevent applying a stable plan. |
| `adapter-runtime-mismatch` or `Adapter runtime verification failed.` | Make sure `PATH` selects the exact package build configured for this repository; reinstall that same supplied tarball into a fresh directory if necessary. For an older installation, follow the upgrade limitation below. | The installed files differ from the version and checksum recorded in the project; even two builds labeled 1.2.0 may differ. Do not change the recorded checksum to bypass verification. |
| `BINDING_INACTIVE` | Run `adopt status`; finish activation if it says `prepared`, or have the project process resolve incomplete configuration if it says `partial`. | The project has not fully assigned its DEV FOUNDRY responsibilities to Claude; installing files or approving the tool connection cannot activate those assignments. |
| Dashboard requires a Git repository or project operating profile | Run inside your intended project or pass `--root /absolute/path/to/project`, then complete DEV FOUNDRY setup and adapter preparation if needed. | The dashboard needs the project's Git root and valid profile. The package installation directory is not a project-data root. |
| Requested dashboard port is occupied | Use another port, such as `dev-foundry-claude dashboard --port 43128 --root "$PROJECT_ROOT"`, and open `http://127.0.0.1:43128`. | The server does not automatically choose a fallback port. |
| Dashboard command prints usage | Supply one `--port` between 1024 and 65535 and, optionally, one `--root`. | Unknown, duplicate or malformed dashboard arguments are rejected. |

## Advanced / technical reference

### Terms and project authority

These terms describe the configuration behind the steps above:

- **Runner / project process:** the tool, agent or workflow your project has
  authorized to manage DEV FOUNDRY work, including adoption and activation.
- **Project Operating Profile (POP):** the repository's configuration record for
  its identity, active framework version and who performs each role; normally
  `.dev-foundry/profiles/project-operating-profile.yaml`.
- **Authority Index:** the map to the project's approved rules and configuration;
  normally `.dev-foundry/authority-index.yaml`.
- **Binding:** a recorded assignment of a role to a particular implementation.
- **Source of truth (SoT):** the approved documents and configuration that decide
  project behavior. This README helps you navigate; it does not replace them.
- **Governed operation:** work performed under those rules, with the required
  authorization, review and evidence.
- **Adapter pin:** the exact package version and payload-manifest hash recorded
  in the repository's local tool configuration. Version alone cannot identify
  a package build.
- **Activation / cutover:** the approved switch to Claude for all five role
  bindings and platform startup configuration. The external plan calls its
  activation proposal `cutover_proposal`.

Framework adoption and version migration follow DEV FOUNDRY **OPS-005** through
that project's process. Adapter installation does not perform framework adoption,
accept it on the project's behalf or grant implementation authorization.

`adopt plan` inspects identity, active framework selection, Authority Index routes,
role/startup configuration, adapter files and pins, collisions and changes on
checked paths. `adopt apply` writes only adapter preparation files. It leaves the
Authority Index, POP bindings, existing startup configuration and framework
release untouched; it never executes `cutover_proposal`.

Activation requires current proposal base hashes and closure or handoff of work
tied to the previous runner. The proposal retires the previous active startup
binding and switches authoring, implementation, independent audit, mechanical
validation and evidence custody together. It warns that mature-runner
compatibility has not been verified; project review must establish it before
applying the complete proposal.

`adopt status` derives activation from project authority, not generated adapter
files. Fully active status has all five roles `claude-active` and
`bootstrap.claudeActive: true`. A launcher can start before activation, but the
project's governed role resolution will return `BINDING_INACTIVE`.

### Producer, package and consumer

The **producer** is this source repository: it owns adapter code, build dependencies
and package creation. The **immutable package** contains the verified runtime,
dashboard assets and templates. The **consumer** is your repository: it owns its
authority, configuration and operational evidence. Producer state never becomes
consumer authority, and producer changes never update consumers automatically.

Producer authority is routed through `.dev-foundry/authority-index.yaml` and the
project source of truth in `docs/`. Each consumer retains its own authority.
README, templates, runtime records and installation do not authorize governed work.

### Producer npm pack workflow

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

**MCP** (Model Context Protocol) is the local tool connection Claude uses to
resolve the project's governing rules. The Claude host must provide
`CLAUDE_PROJECT_DIR` pointing to the consumer repository, and its launching
environment must have the adapter on `PATH`. Review the host's workspace
trust/MCP prompts and confirm the `dev-foundry-governance` connection offers
`resolve_governed_operation` before governed work. The adapter does not grant
workspace trust or pre-approve MCP connections.

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

### Package integrity, reinstall and upgrades

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
