# dev-foundry-claude

DEV FOUNDRY's reusable Claude Code adapter. The private
`@dev-foundry/claude-adapter` package (currently **1.2.0**) includes:

- the `dev-foundry-claude` CLI and governance MCP resolver;
- adoption planning/apply/status and templates for two governed subagents,
  an adapter-owned `CLAUDE.md` block, and the MCP launch entry;
- a local telemetry collector and launcher for `direct`, `dial`, or `codemie`;
- the Local Operations Dashboard: the accepted TSK-015 UI, prebuilt static
  assets, and a Node server for executions, validations, transactions and Claude OTEL;
- bundled MCP/YAML/Zod runtime dependencies and a complete payload manifest.

This README is orientation only and is not authority. Producer authority is
routed through `.dev-foundry/authority-index.yaml` and the project SoT in `docs/`.
Each consumer retains its own authority. README, adapter templates, runtime
records, and installation do not authorize governed work.

## Prerequisites

Consumers need Node.js 20 or newer, npm, Git, and an existing DEV FOUNDRY 2.1.0
repository with its own project operating profile, Authority Index, selected
framework release and configured role bindings. Adoption requires the consumer's
own governed review and a clean Git working tree. Claude Code and existing
provider/authentication setup are needed for actual Claude sessions; `dial` and
`codemie` also require their respective launchers on `PATH`. Viewing the dashboard
does not invoke Claude or require provider credentials.

Producers also need the dashboard's build dependencies. Vite 7 requires Node
20.19+ or 22.12+ (or a later supported Node version). Consumers need neither Vite,
TypeScript nor a nested dashboard dependency install.

## Create a package in the producer

From this producer checkout:

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
not publish to a registry or create a tag/release.

The package ships only adapter code/templates, dashboard server and compiled
assets, README/package metadata, and the existing allowlisted bundled runtime
dependencies. Dashboard `node_modules`, UI source/build tooling, producer docs/task
history, `.dev-foundry` state/evidence, `.claude` state, `.env` and secrets are
excluded. Root runtime dependency bundles remain part of the TSK-012 offline
installation and integrity model; the producer's development dependency tree is
not distributed.

## Install a received tarball without cloning the producer

A consumer can receive the immutable tarball through an already authorized
artifact handoff. No producer checkout is needed. Check its SHA-256 against the
handoff's expected value before installing. There is currently no public download
or registry channel selected by this project; obtaining an artifact still requires
a producer handoff. Any future hosted/signed release channel needs separate
governance and must preserve explicit immutable version/payload identity.

Install into a dedicated local prefix outside the consumer repository, then put
its CLI on `PATH`:

```sh
ADAPTER_PREFIX="$HOME/.local/share/dev-foundry/claude-adapter-1.2.0"
mkdir -p "$ADAPTER_PREFIX"
npm install --prefix "$ADAPTER_PREFIX" --offline --ignore-scripts --no-audit --no-fund /absolute/path/to/dev-foundry-claude-adapter-1.2.0.tgz
export PATH="$ADAPTER_PREFIX/node_modules/.bin:$PATH"
dev-foundry-claude --version
```

Use a fresh dedicated prefix for each distinct build. This offline tarball/prefix
mechanism is tested with registry access disabled and with the temporary producer
build tree deleted. Persist the `PATH` setting in the environment that launches
Claude Code/MCP. Installing the package changes no consumer authority or pin.

## Prepare adoption in the consumer

Run from the consumer Git top-level. Store the plan outside the repository so
creating it does not dirty the inspected tree:

```sh
dev-foundry-claude adopt plan --root "$PWD" --out /absolute/path/outside-consumer/adoption-plan.json
```

Review the plan, blockers, proposed adapter-owned changes and separate
`cutover_proposal`. The command prints `planSha256`. Once the consumer's own
process authorizes these adapter-owned changes, apply the exact reviewed bytes:

```sh
dev-foundry-claude adopt apply --root "$PWD" --plan /absolute/path/outside-consumer/adoption-plan.json --plan-sha256 <planSha256>
dev-foundry-claude adopt status --root "$PWD"
```

`plan` inspects without modifying consumer files; `--out` writes only the chosen
plan file. `apply` checks plan hash, package identity and consumer preconditions.
It writes only the two subagent definitions, marker-delimited `CLAUDE.md` block,
MCP entry and, when needed, telemetry Git-ignore rules. It never applies authority
changes. `status` reports activation from the consumer's current authority.

Adoption prepares the adapter. Activation requires the consumer's separately
governed atomic cutover of all five roles and Platform Bootstrap. The packaged
MCP rejects governed role resolution with `BINDING_INACTIVE` until that cutover
is complete. Installing or opening the dashboard does not activate roles.

## Operate the installed adapter

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

`dev-foundry-claude mcp --expect <pin>` serves MCP over stdio after verification;
its project root comes from `CLAUDE_PROJECT_DIR`, which the Claude host must set.
Use the exact pin generated by adoption, not the placeholder above.

From anywhere inside the consumer repository, launch a real session with:

```sh
dev-foundry-claude run direct -- <claude arguments>
dev-foundry-claude run dial -- <claude arguments>
dev-foundry-claude run codemie -- <claude arguments>
```

`run` resolves the consumer Git top-level, verifies the installed package against
its `.mcp.json` pin, starts a loopback collector and passes arguments unchanged to
the selected existing launcher. It retains interactive stdio and returns the
launcher's exit code. Sanitized telemetry is written to the consumer's ignored
`.dev-foundry/telemetry/local/`. Authentication, model selection and provider
routing remain in the user's existing setup.

Launch the dashboard from the consumer (including a subdirectory):

```sh
dev-foundry-claude dashboard --port 43127
# Or from another directory:
dev-foundry-claude dashboard --port 43127 --root /absolute/path/to/consumer
```

Open **http://127.0.0.1:43127**. Port selection is mandatory, in 1024–65535;
unknown/duplicate/malformed arguments and occupied ports fail without a fallback
listener. Ctrl-C/SIGTERM shuts it down. `--root` resolves the selected directory's
Git top-level. The CLI requires the consumer's DEV FOUNDRY profile and matching
adapter pin; prepared adoption suffices for this read-only view. It never falls
back to the package installation or producer checkout for evidence. UI assets
always come from the verified installed package.

The health endpoint is `/api/dashboard/v1/health`; evidence endpoints include
`executions`, `validations`, `transactions`, and `claude-otel` under the same prefix.
The producer convenience command `node scripts/dashboard.mjs --port 43127` remains
available after a producer UI build, using that checkout's evidence and the same
server implementation.

## Dashboard data and security

The listener binds only `127.0.0.1`. Only GET/HEAD are accepted; Host must be the
numeric loopback host with a port. Use the numeric URL above. There is no CORS
API, LAN/public listener, tunnel, mutation, execution, validation or promotion
operation. Reads reject unsafe paths and symlinks and enforce fixed file/scan
bounds. Missing, malformed and truncated evidence stays visibly unavailable or
degraded. CSP keeps scripts and API connections local; the accepted UUI styles
allow fonts from the fixed EPAM CDN origin.

The dashboard reads these **consumer-local** evidence sources:

- durable `.dev-foundry/executions/**` and execution-request registry metadata,
  with the minimum related execution-contract metadata needed for executor identity;
- governed `.dev-foundry/validation-requests/requests/**`;
- `.dev-foundry/repository-transactions/**`;
- matching `otel-YYYY-MM-DD.ndjson` and `operations-YYYY-MM-DD.ndjson` files
  under `.dev-foundry/telemetry/local/`.

The CLI additionally reads the consumer profile and `.mcp.json` for launch checks.
The APIs read fixed evidence roots, never arbitrary filesystem contents or source
files. Durable record details retain the accepted bounded JSON excerpts of
status/request/transaction records (up to 32 KiB); those records must themselves
contain appropriate operational metadata. Claude OTEL has a separate presentation
allowlist: it excludes credentials, prompts, assistant responses, tool inputs/outputs,
full commands, host paths, account identifiers and raw OTLP payloads.
OTEL run/session IDs are hashed for display. CodeMie analytics and
producer evidence are not read. Live Activity and runner Throughput remain
unavailable; Claude OTEL reports measured values only, with missing values distinct
from zero. Task/role/launch-mode correlations are context, not attributed cost/token
measurements. The dashboard never starts a collector or generates telemetry.

## Integrity, reinstall and upgrades

The adapter pin binds the package version and SHA-256 of canonical manifest bytes.
Every shipped regular file, including compiled dashboard assets, templates, README
and bundled dependencies, has its own size/hash entry. The manifest itself is bound
by the pin. Unexpected, missing or modified files or a different installed build
stop `mcp`, `run`, and `dashboard` before serving/launching. Verification is local
and performs no network lookup. It detects drift; it does not defend against a
hostile local actor who can also replace the verifier, Node or the OS.

Producer changes never update a consumer automatically. Reinstalling the **exact
same tarball** into a fresh prefix and updating `PATH` preserves the existing pin.
Replacing it with another version/build does not update `.mcp.json`; runtime
verification fails. `adopt plan` reports `adapter-runtime-mismatch` against a
different existing adapter pin. There is currently no supported `upgrade` command
or in-place pin migration. Keep the existing pinned release available; moving an
adopted consumer to a new release requires a separately governed upgrade capability
under SPC-005. Do not manually bypass the pin to make a new installation run.

The producer owns source, build dependencies and package creation. The immutable
package owns runtime/assets and adapter templates. The consumer owns its authority,
configuration and operational evidence. No producer state becomes consumer authority.
