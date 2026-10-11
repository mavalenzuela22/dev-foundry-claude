import { readFileSync } from 'node:fs';

export const helpVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
// The only product help source. CLI and MCP return renderHelp's exact text.
export const helpTopics = Object.freeze({
  'getting-started': `DEV FOUNDRY helps Claude follow your project's decisions, work limits and checks.
Install (Node.js 20+ and Git required):
  npm install -g https://github.com/mavalenzuela22/dev-foundry-claude/releases/latest/download/dev-foundry-claude-adapter.tgz
Then:
  cd <project>
  dev-foundry-claude setup
  dev-foundry-claude setup --yes
  dev-foundry-claude start
setup inspects first and tells you the next step. Use setup --yes only after reviewing its managed-file plan. Your application code is not changed.
Commands: setup, start, status, upgrade, doctor, cutover, help.
Next: dev-foundry-claude setup
Three paths: no DEV FOUNDRY -> setup preview -> setup --yes -> start. Legacy pre-1.4.0 -> one-time verified bridge -> 1.4.0 -> start. 1.4.0+ governance migration -> current governed Claude session -> target cutover -> mandatory fresh start.
For managed runtime upgrades, ask Claude in the current source-governed session; see help runtime. Unmanaged installed 1.4.2 needs a separately verified one-time host bootstrap (B4).
Advanced commands: runtime, adopt, upgrade status/plan/apply, migration, mcp, run, dashboard, --version.`,
  setup: `Usage: dev-foundry-claude setup [--yes|--apply] [--root <project>] [--project <name>] [--classification greenfield|brownfield] [--operator <human-name>] [--json|--verbose]
Inspect the project before preparing Claude integration. Without --yes or --apply, nothing is written.
Preparation adds only DEV FOUNDRY-managed agents, a marked CLAUDE.md block, an MCP runtime pin and a local telemetry ignore rule. Application code is not changed.
With no existing governance, preview the project name, greenfield/brownfield classification, human Operator, selected DEV FOUNDRY 2.1.0 and exact configured paths. Defaults come from repository files, the directory name and repository-local Git user.name. Supply explicit flags when a choice is missing. setup --yes (or --apply) confirms initial adoption and creates the minimum authority plus active Claude integration. The initial task observes a verified baseline; brownfield product work waits for that baseline. Existing incomplete authority is refused for review.
The immutable framework is carried by the installed package; no producer checkout or network lookup is needed. Replanning successful setup makes no further changes.
A prepared project still needs its owner to approve Claude activation through the project's existing decision process. Review dev-foundry-claude cutover plan, authorize its exact hash under consumer authority, then use cutover prepare and commit. setup never applies that proposal.
After activation: dev-foundry-claude status
When ready: dev-foundry-claude start
Advanced proposal export: dev-foundry-claude adopt plan --root <project> --out <file-outside-project>`,
  start: `Usage: dev-foundry-claude start [--runtime direct|dial|codemie] [--root <project>] [--verbose] [-- <Claude args>]
Launch Claude in this project with local telemetry using the packaged launcher. direct is the default; the selected executable must already be installed and authenticated by you.
The project must be prepared, approved for Claude and pinned to this adapter. If it is not ready, run the recovery command shown.
Telemetry binds only to 127.0.0.1 and lasts for the Claude session. Readiness before launch is a preflight; collection is confirmed after the collector starts.
In another terminal: dev-foundry-claude dashboard --port 4319
Open the URL printed by dashboard. If that port is occupied, select another local port.
Example: dev-foundry-claude start --runtime dial -- --resume
Next if launch fails: dev-foundry-claude doctor`,
  status: `Usage: dev-foundry-claude status [--root <project>] [--json|--verbose]
Read a compact view of the project, integration, installed and selected adapter, telemetry preflight, dashboard availability and readiness to work.
No files are changed. Telemetry preflight does not mean a collector is already running.
Next when ready: dev-foundry-claude start`,
  upgrade: `Usage: dev-foundry-claude upgrade [--root <project>] [--from-package <previous-package-directory>] [--yes|--apply] [--json|--verbose]
Keep the running source release available. Stage a target release side-by-side outside the project and outside the source installation, for example npm install --prefix <isolated-target> <release-tarball> --offline --ignore-scripts. Invoke the staged package bin/dev-foundry-claude.js with Node. Installing it does not change your project. The target migration command verifies and describes its integrity-bound migration material; upgrade inspects the current pin and plans the move to that exact installed target.
A compatible upgrade changes only the runtime pin. A managed refresh updates only DEV FOUNDRY-owned files, preserving your application code and project rules.
For a refresh, keep or unpack the previous released package outside the project and pass its directory with --from-package. It must verify against the exact current project pin and reproduce the current managed files. Modified or ambiguous files are refused.
The one-time legacy bridge into 1.4.0 supports only the declared exact 1.2.2 TSK-018, 1.3.0 validation-artifact and v1.3.0 public-tag builds. It always requires the exact previous package. Prepared projects retain their existing active governance runtime, authority and history. Unknown builds or modified owned bytes stop safely.
For 1.4.0+ targets requiring semantic or configured-authority reconciliation, continue in the currently governed Claude session under source authority. Node cannot decide project-specific governance choices. Keep the source runtime and project selection unchanged until an authorized validated cutover. After cutover the old MCP session refuses governed work; restart with dev-foundry-claude start.
Without --yes or --apply, the plan is read-only. With explicit intent, the exact generated plan and hash are rechecked before apply. Commit or restore pending managed-file changes before upgrading.
Advanced: upgrade status|plan|apply --root <project>; plan accepts --from-package and --out <file-outside-project>; apply requires --plan <file> --plan-sha256 <hash>.
Next after upgrade: dev-foundry-claude status`,
  doctor: `Usage: dev-foundry-claude doctor [--root <project>] [--runtime direct|dial|codemie] [--json|--verbose]
Run read-only checks of the repository, project configuration, package integrity, runtime pin, managed files, Claude activation, selected runtime executable, local telemetry and packaged dashboard.
No repair or listener is started. Technical details are available with --verbose or --json.
Follow the one recovery command printed. To understand setup: dev-foundry-claude help setup`,
  runtime: `Usage: dev-foundry-claude runtime status|doctor|stage|proposal|plan|prepare|commit|recover|verify [--root <project>] [--store-root <external-store>] [--input <agent-artifact-or->] [--json]
Normal managed-to-managed updates start on demand inside the current governed Claude session: ask Claude to upgrade the adapter. No user npm, hash-copying or JSON editing is needed. These advanced deterministic surfaces are operated by the source-governed agent and deliberate recovery tooling.
First inspect the current POP/index/task/profile authority from disk, the selected exact source pin, runtime status/doctor, trusted release provenance and the integrity-bound supported target recipe. Chat memory, package installation and a target manifest are not authorization. Unknown provenance or missing target recipe stops for governed review; never invent a release or recipe identity.
Stage a verified unpacked local candidate with runtime stage; B1 rejects archives, unknown provenance and installation scripts. No consumer adoption occurs. runtime proposal is read-only target recipe/identity/source-authority review. Claude proposes semantic deltas under source authority, obtains actual Operator choices for reserved decisions, runs applicable validation and audit, then runtime plan binds exact candidate bytes, source branch/HEAD, authority, paths and gates. --out may export plan bytes only outside the consumer/store. Never silently adopt another framework or change other consumers.
The agent supplies strictly validated evidence over --input - (stdin) or an external artifact. Stage format: dev-foundry.runtime-stage-request.v1 with root/sourcePin/expect/candidateRoot/permittedCandidateRoots/attestation. Proposal format: dev-foundry.runtime-proposal-request.v1 with root/sourcePin/targetPin. Plan format: dev-foundry.runtime-candidate.v1 with the B2 candidate. Transaction format: dev-foundry.runtime-request.v1 with root/plan/planSha256/approval/evidence. Approval is the existing dev-foundry.runtime-approval.v1 bound to the plan, Operator, source authority/pin, target, branch/HEAD, choices, paths and source session, with expiry and prepare/commit phases. These are actual caller attestations: the CLI never manufactures consent. --yes is forbidden across this transaction.
Use runtime prepare, then runtime commit with that same approved request; both call B2. Consumer-local /.dfc-runtime-upgrade/ must already be ignored under source authority. Keep source bytes available. Cutover is recoverable, not a filesystem-wide atomic rename. On interruption, inspect runtime doctor; runtime recover requires the same plan/approval/evidence plus explicit recovery {operatorApproved,planSha256,outcome:source|target,reason}. Unknown bytes, stale HEAD, missing ownership and changed gates stop. Never edit/delete the journal or terminate arbitrary processes.
After commit, the old MCP session rejects governed work. Start a fresh target session for independent verification; runtime verify accepts session {format:dev-foundry.runtime-session-request.v1,evidence} and launches an actual fresh target MCP process over stdio to prove target pin/package/authority/journal before B2 completes. Caller-supplied independent:true cannot substitute. This mechanical proof does not certify the real Claude model or native host acceptance (B4). A no-op or failed verification is never a completed upgrade.
A pre-existing dashboard is restart-required: runtime doctor --port <port> observes ownership; stop only your identified dashboard through its owning terminal and start the selected runtime again. CLI/MCP/dashboard/telemetry share one selected pin. Telemetry remains loopback-only; historical records retain their schemas.
Stable host invocation: dev-foundry-claude-launcher --manager-expect <exact-authorized-manager-pin> --store-root <external-store> [--root <canonical-project>] -- <command>. The launcher/resolver are copied independently of active runtime code by the separately authorized B4 bootstrap. Missing/unmanaged installed 1.4.2 requires that one-time bootstrap; no live global npm replacement occurs. Public provenance, real fresh Claude semantic migration and complete Windows/macOS installed-release E2E remain B4 gates.
Next: dev-foundry-claude runtime status`,
  concepts: `DEV FOUNDRY keeps project decisions and work limits durable. The adapter connects those rules to Claude; it does not approve changes.
Prepared means integration files exist. Active means the project owner has approved Claude's roles. Ready means activation, package pin, managed files and launch preflight all pass.
Your project's approved rules are authority. This help is explanatory product content, never authority.
Advanced vocabulary: POP = Project Operating Profile; Authority Index = routes to approved documents; Actor Profile = role responsibilities; Capability Profile = implementation limits; TSK = task; MTP = bounded material plan. These records are managed through the project's decision process, not required as manual steps for routine adapter commands.
Next: dev-foundry-claude setup`,
});
// CLI and MCP share every canonical help topic, including runtime orchestration.
const cutoverHelp = `Usage: dev-foundry-claude cutover plan|status|prepare|commit|recover [--root <project>] [--json]
Switch an existing governed project from its current runner to Claude. Application files affected: 0.
First prepare ordinary adapter integration with setup and record those changes through the project's decision process. Keep the current runner active.
1. cutover plan --out <file-outside-project> produces a read-only exact source/target plan and SHA-256. Review every authority diff, branch/HEAD, current bootstrap, profiles and runtime identity.
2. The consumer's governed process must approve this exact candidate, close or hand off source work, resolve choices and establish validation/audit disposition. Package installation, MCP selection, setup --yes and upgrade --yes do not authorize this switch.
3. cutover prepare --plan <file> --plan-sha256 <hash> --authorization <approval-json> stages inert bytes in .dfc-cutover outside configured authority.
4. cutover commit --plan-sha256 <hash> --authorization <approval-json> rechecks the full set, blocks startup and promotes independent paths with the POP activated last.
5. Start a fresh session: dev-foundry-claude start. Old Claude/MCP sessions cannot continue governed work.
Approval JSON format: dev-foundry.cutover-authorization.v1. Required fields: project, operator (exact POP human identity), planSha256, sourceHead, sourceBranch, targetExpect, actorBindings, bootstrap and allowedPaths (exact plan target/manifest); operatorApproved, governedApproval and decisionsResolved must be true; sourceWorkDisposition is closed or handed-off. task is {path, sha256} for the routed IN_PROGRESS consumer TSK; validation is {status: PASS, path, sha256}; audit is {status: PASS, path, sha256} or {status: not-required, reason}. These are explicit consumer attestations and hash-bound evidence, not approvals created by the adapter.
Interrupted operation: cutover status is read-only JSON. Use cutover recover --outcome source|target --plan-sha256 <hash> --authorization <approval-json>. Recovery verifies journal, package, branch/HEAD, authority and evidence; its selected direction is durable and repeatable. Unknown or modified data stays blocked. A failed recovery is never readiness.
This is a recoverable logical transition, not filesystem-wide atomicity. The inactive POP protects gaps between renames. Runtime journal, staged bytes and backups are retained; do not edit/delete them or commit them as authority. Directory durability depends on filesystem support, particularly on Windows. An external Windows runner may observe read-only and has no active ChatGPT role after success.
The exact installed payload must equal the existing consumer MCP pin; cutover never repins or hides differing builds. After rollback, the foreign runner is complete and Claude remains prepared; fresh Claude startup waits for a successful authorized cutover.
Next: dev-foundry-claude cutover plan`;

export const helpUri = (topic) => `dev-foundry://help/${topic}`;
export function renderHelp(topic = 'getting-started') {
  const key = topic === 'governance' ? 'concepts' : topic;
  if (key !== 'cutover' && !Object.hasOwn(helpTopics, key)) throw new Error(`Unknown help topic. Choose: ${[...Object.keys(helpTopics), 'cutover'].join(', ')}. Next: dev-foundry-claude help`);
  return `dev-foundry-claude ${helpVersion} — ${key}\n\n${key === 'cutover' ? cutoverHelp : helpTopics[key]}\n`;
}
