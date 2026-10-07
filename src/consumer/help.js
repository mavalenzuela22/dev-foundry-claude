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
Commands: setup, start, status, upgrade, doctor, help.
Next: dev-foundry-claude setup
Three paths: no DEV FOUNDRY -> setup preview -> setup --yes -> start. Legacy pre-1.4.0 -> one-time verified bridge -> 1.4.0 -> start. 1.4.0+ governance migration -> current governed Claude session -> target cutover -> mandatory fresh start.
Advanced commands: adopt, upgrade status/plan/apply, migration, mcp, run, dashboard, --version.`,
  setup: `Usage: dev-foundry-claude setup [--yes|--apply] [--root <project>] [--project <name>] [--classification greenfield|brownfield] [--operator <human-name>] [--json|--verbose]
Inspect the project before preparing Claude integration. Without --yes or --apply, nothing is written.
Preparation adds only DEV FOUNDRY-managed agents, a marked CLAUDE.md block, an MCP runtime pin and a local telemetry ignore rule. Application code is not changed.
With no existing governance, preview the project name, greenfield/brownfield classification, human Operator, selected DEV FOUNDRY 2.1.0 and exact configured paths. Defaults come from repository files, the directory name and repository-local Git user.name. Supply explicit flags when a choice is missing. setup --yes (or --apply) confirms initial adoption and creates the minimum authority plus active Claude integration. The initial task observes a verified baseline; brownfield product work waits for that baseline. Existing incomplete authority is refused for review.
The immutable framework is carried by the installed package; no producer checkout or network lookup is needed. Replanning successful setup makes no further changes.
A prepared project still needs its owner to approve Claude activation through the project's existing decision process. Ask the owner to review the activation proposal from setup --json, authorize the switch from the current assistant, and apply it through that process. setup never applies that proposal.
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
  concepts: `DEV FOUNDRY keeps project decisions and work limits durable. The adapter connects those rules to Claude; it does not approve changes.
Prepared means integration files exist. Active means the project owner has approved Claude's roles. Ready means activation, package pin, managed files and launch preflight all pass.
Your project's approved rules are authority. This help is explanatory product content, never authority.
Advanced vocabulary: POP = Project Operating Profile; Authority Index = routes to approved documents; Actor Profile = role responsibilities; Capability Profile = implementation limits; TSK = task; MTP = bounded material plan. These records are managed through the project's decision process, not required as manual steps for routine adapter commands.
Next: dev-foundry-claude setup`,
});
export const helpUri = (topic) => `dev-foundry://help/${topic}`;
export function renderHelp(topic = 'getting-started') {
  const key = topic === 'governance' ? 'concepts' : topic;
  if (!Object.hasOwn(helpTopics, key)) throw new Error(`Unknown help topic. Choose: ${Object.keys(helpTopics).join(', ')}. Next: dev-foundry-claude help`);
  return `dev-foundry-claude ${helpVersion} — ${key}\n\n${helpTopics[key]}\n`;
}
