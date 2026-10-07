# dev-foundry-claude

An AI assistant can help you get a demo working quickly. After a few months of
using it on a real project, you may find that yesterday's decision has been
forgotten, a small request changes unrelated code, or a fix breaks something
that worked yesterday. A confident “done” can turn out to mean “I haven't
checked.” Starting a new session can feel like starting the project explanation
again.

DEV FOUNDRY gives those decisions, work limits and checks a durable place in the
project. This README first explains **DEV FOUNDRY 2.1.0**, then shows how to use
its **Claude Code adapter 1.3.0**, `dev-foundry-claude`
(`@dev-foundry/claude-adapter`). You can understand the approach before choosing
or installing a tool.

The invoice-export story and **acme-billing** project below are fictional teaching
examples. They define no real project's requirements or permissions. This README
explains the method; it does not approve real work or replace project rules. The
project's explicitly adopted methodology release and approved project documents
govern actual work.

## 1. What is DEV FOUNDRY?

DEV FOUNDRY is a way to organize software work so that someone can answer:
**What are we changing, why, what must stay unchanged, and how will we know it
worked?** It keeps those answers in project records that people and tools can
find, review and use again.

For example, “add invoice export” becomes a clear agreement: users can download
only invoices they already have permission to see; the file has an agreed format;
billing calculations stay unchanged; checks must demonstrate both the export
and the access restriction. The assistant gets a resolved change to implement,
and the next session can find the same agreement.

The formal description is a **software-delivery methodology**: a set of concepts
and rules for defining, carrying out, checking and accepting changes. It is
**provider-neutral**, meaning those responsibilities have the same meaning
whether a human, Claude, Codex or another eligible tool performs them. A project
explicitly chooses who does each part and which methodology version it follows.

DEV FOUNDRY is not an AI model, IDE, coding agent, CLI or Git workflow engine.
Those tools can help carry out its method. It also does not make AI infallible:
requirements can be wrong, checks can miss defects, and reviews still need
judgment. Its purpose is to make decisions and completion claims inspectable
and work easier to resume.

You will see the word **governance** in the full documents. Here it means keeping
clear rules about who may decide or act, within which limits, and what must be
checked before work moves forward.

## 2. The problem it solves

A conversation can mix a request, a proposed design, an accepted decision and an
untested claim into the same thread. Later, it can be hard to tell them apart.
DEV FOUNDRY gives each a place and a responsibility.

| Familiar situation | What changes in the way you work |
| --- | --- |
| “The assistant forgot what we decided.” | Accepted decisions live in project documents that a new session retrieves. |
| “It changed much more than I asked.” | Each change states its outcome, limits, exclusions and reasons to stop. File access alone is not permission to edit. |
| “The fix broke something that worked yesterday.” | Checks target the promised behavior and affected existing behavior; their results identify the state checked. |
| “It says done, but I don't know what ran.” | Keep the implementation claim separate from recorded checks, results and remaining gaps. |
| “I can't resume this with another tool.” | Project records explain the work independently of the old chat or provider. The new tool still needs a valid assignment and sufficient abilities. |
| “Was this tested, approved, merged or released?” | Record those as separate facts instead of one “done” label. |

The aim is enough structure for the change at hand. A small correction should
not require a stack of documents that own no useful decision or rule.

## 3. The mental model

Use this fictional request throughout: **“Let users download their visible
invoices as a CSV file, without changing billing calculations.”**

### Start with human intent

Begin with the useful outcome and its limits, rather than an open-ended “improve
billing.” This is **intent**. Before coding, resolve questions such as which
invoices “visible” includes and what columns the file needs. Existing project
rules may already answer them.

### Keep project knowledge durable

Write accepted decisions and requirements where the project can keep them and
later sessions can find them. In this guide, **authority** means the applicable
approved definitions and permissions that determine what the work must do and
may do. A proposal is not an accepted rule merely because it appears in a chat.

**Chat history and model memory are context, not project authority.** They can
help locate unfinished work, but a new session must retrieve the relevant
project records and observe the current state. If the code, a summary and an
approved requirement disagree, do not silently choose whichever is convenient.
Resolve the disagreement through the project's decision process.

### Give each concept one authoritative home: Source of Truth (SoT)

Put each rule in one selected place that owns its meaning. For invoice export,
one document might define who may export, while another defines the CSV columns.
DEV FOUNDRY calls the selected home for a particular concept its **Source of
Truth (SoT)**. It can be a document or a stable section of one.

SoT does not mean one enormous file containing everything. Each home has a
specified scope and version. Within that scope, its definition takes precedence
over copies, summaries, historical material, chat, test results and existing
code. A test passing does not rewrite the requirement it was meant to check.

### Route to those homes: Authority Index

Keep a directory of where the project's current rules live. “Who may export?”
should lead to the export behavior; “what columns?” should lead to the CSV
contract. This directory is the **Authority Index**.

The index points to rules; it does not replace them. A route must lead to the
right active document or section for that concern, scope and version. A familiar
filename alone does not prove that its contents govern today's work.

### Bound one coherent outcome: a Task (TSK)

Describe one useful change clearly enough to implement and demonstrate. DEV
FOUNDRY calls one coherent, independently demonstrable outcome a **capability**.
Its delivery record is a **Task**, abbreviated **TSK**.

The invoice-export task records why it is needed, which rules apply, what may
change, what is excluded, what it depends on, what checks must show, and how it
can be accepted and concluded. “Export visible invoices” is one outcome;
“improve billing” leaves too many decisions open. A task delivers approved
behavior; it does not ask the implementer to invent missing product decisions.

### Separate responsibilities from tools: roles

Deciding what should happen, implementing it, checking it and preserving its
records are different jobs. Those responsibilities and their limits are called
**roles**. A role is assigned to a concrete person, model, agent or service—the
**implementation** of that role. The assignment is a **binding**.

An assistant's ability to edit a file does not give it permission to approve a
requirement or merge its own work. [Who does what](#5-who-does-what) explains the
roles through the same export example.

### Keep proof separate from requirements: evidence

Keep verifiable information about what actually happened: which checks ran,
against which state, their results, and what was not checked. This is
**evidence**. “All tests passed” without observable support remains a claim.

For example, a recorded check showing that one user cannot export another user's
invoices supports that access rule. It does not authorize a new export feature,
prove every possible case or give permission to merge.

### Keep lifecycle stages distinct

Finishing the code, checking it, accepting it and releasing it are separate
steps. Their sequence is the work's **lifecycle**. A required checkpoint before
moving forward is a **gate**: for example, required access checks must be
complete before the project considers integration.

Moving eligible work through an authorized boundary, such as merging into the
main branch, is **promotion**. Recording how the work concluded, with delivered
scope, supporting proof and remaining limits, is **closure**. A closed task does
not by itself mean the product was deployed; a merge does not by itself close
the task.

**Tests and evidence do not themselves authorize promotion.** Required checks
and reviews establish readiness; the applicable project authorization permits
the next action. Not every change needs every possible stage or review.

### Connect the rules to a project and a working session

Rules also need a project setup that says where they apply and who carries them
out. Four names describe that setup:

| Everyday idea | Formal name | What it records |
| --- | --- | --- |
| This project's settings and responsibility assignments | **Project Operating Profile (POP)** | Project identity, adopted methodology version, final decision authority, role assignments, applicable profiles, startup configuration, local policies and approved deviations. |
| The job description for a responsibility | **Actor Profile** | A role's allowed and prohibited actions, required inputs, outputs, handoffs and reasons to stop. It is independent of the provider. |
| What a particular person or tool can actually do | **Capability Profile** | Supported actions, environment limits and proof abilities. For an implementer, its specialized form is also called an Executor Profile. It constrains work; it grants no permission. |
| Directions a session needs to find the project rules | **Platform Bootstrap** | Project identity, POP and Authority Index locations, role selection and essential startup constraints. It does not copy the full methodology. |

For example, the POP can assign export implementation to an eligible tool. The
Actor Profile describes the implementer's responsibility. The Capability
Profile records whether that tool can run the needed tests. The Platform
Bootstrap tells a new session how to find and verify those assignments.

## The Ponytail philosophy: do the smallest safe complete thing

For invoice export, first ask whether the existing invoice query and access
rules can be reused. Add the CSV behavior needed now. Do not build a reporting
framework, plugin system and future PDF exporter merely because they might be
useful someday.

This is **minimal sufficient change**: the **smallest safe complete change** that
meets the approved outcome. “Smallest” limits unrelated work. “Safe” preserves
required safety, security, integrity and compatibility. “Complete” includes the whole
outcome and its required checks and proof.

We use **Ponytail** as shorthand for that discipline. The adopted methodology
defines the discipline in **OPS-007, “Minimal Sufficient Change and Sufficiency
Review.”** The word “Ponytail” itself is this project's shorthand, rather than
a term or additional rule defined by the official 2.1.0 release.

### Reuse before creating

Consider these options in order, with investigation proportional to the change:

1. Make no change, if the outcome is already satisfied.
2. Reuse existing rules or behavior.
3. Combine existing pieces.
4. Use a standard ability of the platform.
5. Use an already-approved dependency.
6. Make one local change with clear limits.
7. Add a new abstraction, dependency, component, document or process concept
   only when the earlier options are insufficient for a concrete reason.

### Apply it to the whole work, not just the code

The same discipline applies to documents, model context, instructions, checks
and reviews. Retrieve the rules needed for this change; create a document only
when it has something meaningful to own; run checks that resolve uncertainty
about acceptance or a real risk.

Reuse proof only while it still applies to the current state and change. Repeat
or broaden it when a change invalidates it, a concrete risk calls for it, or the
project requires fresh proof. Saving steps never excuses skipping required
validation or audit. Focused work may reduce repeated discovery, but it promises
neither token savings nor correctness.

### Give the executor a resolved, bounded change

Tell the implementer the outcome, applicable rules, permitted changes,
exclusions, checks and conditions that require stopping. “Implement this export”
should not become permission to redesign billing.

A directly caused regression may be corrected within the same approved change
only when it is necessary, is the smallest sufficient correction, crosses no
hard exclusion, introduces no new capability, public behavior or dependency,
and requires no new security, integrity, infrastructure or other material
decision. Report the unexpected change and its causal proof for reconciliation.
If it needs new authority, stop and return it to the project's decision process.

### Tiny example: invoice CSV export

| Choice | What it means here |
| --- | --- |
| Add structure for imagined future needs | Build a generic reporting framework and several export formats for a CSV request. |
| Apply Ponytail | Reuse the authorized invoice query, add the agreed CSV output, check the affected behavior and record the limits. |

Scheduled exports can remain explicitly outside scope. Record an observed,
approved need for scheduling as a reason to reconsider later; do not implement
scheduling before that need exists.

## 4. What are all these files?

### Ten document types, ten responsibilities

Documents separate questions that otherwise get mixed together in a chat. You
will see the following prefixes in DEV FOUNDRY repositories. They name a
responsibility; a prefix alone does not make a document approved or current.

| Everyday question | Document type | Fictional export example |
| --- | --- | --- |
| What is this project, and where do I find things? | **OVR — Overview** | A billing overview links to its decisions and behavior. |
| What did we decide, and why? | **ADR — Architecture Decision Record** | Reuse the existing authorization model; record alternatives and consequences. |
| How are the parts organized? | **ARC — Architecture** | Show the invoice query, export endpoint and serializer, with their boundaries. |
| What must the product do? | **SPC — Specification** | Export only invoices the user may read; state acceptance criteria. |
| What exactly does this information mean? | **DAT — Data Contract** | Define CSV column order, date format and error information. |
| What change are we delivering now? | **TSK — Task** | Deliver CSV export; exclude billing calculations and scheduling. |
| Does this task need separately controlled pieces? | **MTP — Micro-Task Plan** | Split service and UI work only if distinct boundaries or proof justify it. |
| How do we operate and control the work? | **OPS — Operations** | Define applicable checks, role limits and integration permissions. |
| Does the observed work follow its rules? | **AUDIT — Governance Audit** | Record a read-only evaluation, findings, verdict and limits. |
| What was accepted as concluded? | **CLOSURE — Closure** | Record delivered export, supporting results and explicit deferrals. |

The usual direction of product rules is:

```text
ADR (decisions) -> ARC (structure) -> SPC (required behavior)
               -> DAT (exact contracts) -> TSK (bounded delivery)
```

A task delivers behavior within existing decisions and constraints; it cannot
overrule them. OVR maps the project, OPS controls how work is performed, MTP
splits a task, AUDIT evaluates, and CLOSURE records the conclusion. Referencing
a product rule does not make one of these documents its new owner.

**You do not create all ten types for every change.** Reuse existing documents
and add only what is materially needed. Skipping a document is appropriate when
there is no new decision, structure, behavior or contract for it to own. It is
not appropriate when the omission forces the assistant to guess a missing rule.

A piece of an MTP is a **Micro-Task (MT)**, not an eleventh document type. A task
that can be delivered as one clear change does not need an MTP.

Documents also identify their owner, scope, version and current status. A
proposal, an accepted rule, a retired decision and a completed work record
must be distinguishable. Those details are stored as **metadata**, often in a
small structured header called **frontmatter**. Its format is in the advanced
reference; you do not need to memorize it to understand the method.

### Configuration and working records are a separate category

The POP, Actor Profiles, Capability Profiles and Platform Bootstrap introduced
in the mental model connect the rules to this project and its working tools.

These are configured or operational records, rather than additional document
prefixes. So are an instruction for one operation (**prompt**), a product's
mechanically checkable execution boundary (**Execution Contract**), automatically
observed facts (**Runtime Evidence**), curated verified facts (**Governed
Evidence**) and temporary continuation notes (**session handoff / scratchpad**).
Instructions derive from authority; evidence describes facts; continuation notes
help the next session find the relevant authority. None can invent a new rule
or permission.

## 5. Who does what?

A project identifies who holds its final decision authority at reserved
boundaries: the **Operator**. Often that is the human responsible for the
project. The project explicitly records it; an AI does not become the Operator
because it controls a tool.

Five roles divide the work that supports those decisions:

| Responsibility | Role name | Fictional export example |
| --- | --- | --- |
| Make the rules and change limits clear | **Governance Author** | Resolve export requirements and prepare the TSK and focused instructions. |
| Carry out the approved change | **Implementation Executor** | Add the export within scope, check its own work and report unexpected changes. |
| Check observable facts without repairing the work | **Mechanical Validator** | Run the required checks against the identified resulting state and record results and limitations. |
| Evaluate conformity to rules, read-only | **Governance Auditor** | Examine the export and its proof against applicable authority; provide independent review when required. |
| Preserve established results and decisions accurately | **Evidence Custodian** | Keep implementation claims, check results, audit verdicts, acceptance decisions and gaps distinguishable. |

A role is a responsibility, not a tool or a requirement to hire five people.
An eligible implementation may hold several assignments when the POP and
separation rules allow it, but it selects exactly one role and profile for each
operation. Before switching, it ends that operation and re-establishes the new
role's rules, permissions and current project state.

Required independent review must come from an actor who did not materially
author or change the boundary being reviewed. Opening another chat alone does
not establish independence. A different provider is not automatically required;
applicable project or methodology rules determine any further separation.

Being able to edit, test or merge is different from being authorized to do so.
Role assignments and tool abilities do not grant permission for every task or
side effect.

## 6. How one change moves through DEV FOUNDRY

Return to the fictional invoice export. This is one possible path, with the
actual project's rules determining which stages apply:

1. **Agree on the outcome.** Export the user's visible invoices. Preserve access
   rules and calculations. Exclude scheduled exports.
2. **Find or resolve the rules.** Read the existing decisions, architecture,
   behavior and contracts through the Authority Index. Reuse them; resolve
   missing decisions before implementation. Create only the documents needed
   to own genuinely new rules.
3. **Define the task.** Record the approved change, dependencies, exclusions,
   acceptance and required proof in a TSK. Split it through an MTP only if
   separate work boundaries are useful.
4. **Prepare the implementer.** Supply the applicable rules, permitted changes,
   required checks, eligible role/profile and stop conditions. State expected
   paths or explicitly say that no path prediction is supplied. A prediction
   does not expand permission; an explicit file exclusion remains binding.
5. **Implement and self-check.** The executor changes only the approved scope,
   runs focused checks and hands off its claim, results and unexpected changes.
   Its self-checks support implementation; they do not count as governed
   mechanical validation. Required reconciliation resolves whether unexpected
   changes remain within the already-approved scope.
6. **Validate the resulting state.** After implementation mutation authority
   ends and any required reconciliation is complete, the validator executes or
   re-executes the required proof. Results identify exactly which state was
   checked—their **state binding**. Checks from before a later change cannot
   silently prove that changed state. Validation reports facts without fixing
   the implementation.
7. **Review where required.** The author performs applicable self-assessment.
   Independent audit is required when the methodology, project/task rules,
   separation of duties or Operator triggers it. The auditor records findings
   and a verdict without editing the work. Required corrections get their own
   bounded work and review; self-assessment is not independent audit.
8. **Preserve the proof and decisions.** Evidence is produced throughout the
   work. Keep results, verdicts, exclusions, gaps and decisions available for
   the next checkpoint.
9. **Promote only with authorization.** When required proof and review are
   complete, integrate only under applicable project permission. Passing tests
   or audit does not authorize merge, publication or deployment. An existing
   authorization may cover several steps while its conditions still hold;
   recheck those conditions before each covered action.
10. **Record the conclusion.** Close according to the task's completion policy
    and required acceptance decision. Record delivered scope, supporting proof,
    limits and deferrals. Closure does not imply deployment or retroactively
    authorize earlier work.

This is not a requirement to run every stage for every operation. Documentation
work need not manufacture a code executor, validation-only work need not reopen
implementation, and independent audit is triggered rather than universal.

### Read results without collapsing them into “done”

A check needs an honest result, including when it cannot prove enough:

| Validation result | What it means |
| --- | --- |
| **PASS** | Complete required deterministic proof holds for the declared scope and state. |
| **FAIL** | Complete proof shows that the delivered work does not conform. |
| **BLOCKED** | A required precondition is missing, preventing a valid verdict. |
| **ERROR** | The validator, harness, command, cleanup or evidence mechanism malfunctioned. |
| **INCOMPLETE** | Available evidence cannot establish the complete required proof. |

A broken test harness is not automatically a product defect. Missing or
unverifiable required evidence cannot become PASS. Audit has separate verdicts:
**AUDIT PASS**, **AUDIT FAIL** and **AUDIT BLOCKED**.

You might read: “Export is implemented; access checks pass; independent review
is pending; merge is not authorized.” That is more useful than “done.”
Implementation, validation, audit, integration and closure remain separate facts.

## 7. How a project adopts DEV FOUNDRY

Adoption means choosing a fixed methodology release and establishing the
project's own rules, settings and responsibility assignments. “Fixed,” or
**immutable**, means the selected release does not change underneath the project.
For this adapter, the required methodology version is **2.1.0**, with adoption
complete and active.

Installing a coding tool cannot decide your product requirements, choose your
Operator or approve those assignments for you. The adoption work uses the
methodology's process, defined in **OPS-005** and the profile contracts. Use the
[official 2.1.0 reading reference](#canonical-210-reading-reference) for the full
requirements when preparing actual project configuration.

### A new project: greenfield adoption

If the project is starting without existing software or project history, this
is **greenfield adoption**. Establish its purpose and only the rules needed for
the first useful change.

Normally that includes a POP, Authority Index, profiles for the roles in use,
Platform Bootstrap when the platform needs it, an overview/documentation map,
and valid document metadata. Add only necessary decisions, architecture,
behavior and contracts, then one TSK. Use an MTP only when needed; assign an
eligible executor with its Capability Profile when implementation is required.

For fictional acme-billing, start with its own invoice rules and first task.
Copying another project's old decisions, tasks or test results would not define
what acme-billing needs or prove its behavior.

### An existing product: brownfield adoption

If there is already software and history to preserve, this is **brownfield
adoption**. First establish what the product actually does: its behavior,
architecture, interfaces, delivery process, existing rules, conflicting authority,
document metadata and runtime dependencies. Separate verified facts from
assumptions, then reconcile the project setup with the selected methodology.

For an existing billing app, observe its real access rules before writing a
specification that claims to describe them. Resolve conflicts explicitly;
neither old code nor a newly generated document wins merely by existing.

Historical evidence need not be rewritten for consistency. Metadata can be
migrated as documents are touched when that is sufficient for safe current
work, or through a complete baseline when a concrete approved need requires it.

### An existing DEV FOUNDRY project: version adoption or migration

If the project already uses DEV FOUNDRY, verify its selected version and current
configuration. A complete, active 2.1.0 setup can proceed to adapter preparation.
An unfinished adoption needs reconciliation first.

An older methodology version does not become 2.1.0 by installing this package.
Review the impact on active rules and work, document formats, roles and
Capability Profiles, POP and Platform Bootstrap. Obtain the applicable project
authorization and record required migration or deviations. Historical evidence
retains the version under which it was produced.

A framework-version change and an adapter-package upgrade are separate actions.

### What must be ready before governed work?

For the current change, check that the project has:

- one explicitly adopted methodology version and its authority entry point;
- an Authority Index and a truthful POP identifying the project and Operator;
- profiles and eligible assignments for the roles actually needed;
- valid metadata for the active documents needed to govern the change;
- applicable product rules and one approved TSK, with an MTP only if required;
- an eligible executor and Capability Profile when implementation is required;
- enough validation capability or procedure to demonstrate acceptance.

The POP connects the configuration. The Platform Bootstrap lets a session find
it, retrieve the relevant authority and select a role. If project identity,
authority, profile or required capability cannot be established, work stops.
A documentation-only governance operation does not need a code executor.

**The adapter does not perform framework adoption or version migration.** There
is no adapter CLI command that creates or accepts this foundation. Establish
and review it through the project's methodology adoption process, then continue
when DEV FOUNDRY 2.1.0 is complete and active.

## 8. Where dev-foundry-claude fits

With that foundation in place, a tool can help Claude use it.
**dev-foundry-claude is the Claude adapter/product for DEV FOUNDRY.** It supplies
the Claude Code integration; it does not define or change the provider-neutral
methodology or install other providers' integrations.

```text
DEV FOUNDRY methodology
  -> project adoption/configuration
    -> provider adapter (dev-foundry-claude)
      -> Claude runtime/session
```

The package prepares Claude-specific project instructions, a local connection
to governance tools, specialized implementation and audit agents, a launcher
that supports usage measurements, and a local dashboard. The tool connection
uses the **Model Context Protocol (MCP)** so Claude can resolve the project's
applicable rules and role. Connecting those tools does not approve a task.

Keep the two setup steps distinct. First the project adopts DEV FOUNDRY. Then
the adapter prepares Claude files and proposes switching the project's role
assignments and startup configuration to Claude. The approved switch is
**activation**, also called **cutover** in technical records. Prepared files
are not active assignments.

The practical section below covers installation, preparation, activation,
upgrades, the dashboard and launch. Package installation acquires a tool;
project authorization determines what that tool may do.

## 9. Install and use the Claude adapter

### Before you start

**Already using DEV FOUNDRY 2.1.0?**

- **Yes:** install adapter → plan → apply → activate → dashboard / Claude.
- **No:** complete DEV FOUNDRY 2.1.0 adoption or migration → return here.

You need:

- Node.js 20 or newer, npm and Git.
- Access to the official public GitHub Release download. The documented 1.3.0
  install URL supports anonymous access; no producer checkout or GitHub
  credentials are required.
- A Git repository with DEV FOUNDRY **2.1.0** setup complete and active, and a clean
  working tree. Save or commit your existing changes through your normal workflow
  before preparing the repository.
- For starting Claude: Claude Code and your existing login/provider configuration.
  DIAL users also need `dial`; CodeMie users need `codemie-claude` on `PATH`.
  The dashboard needs no Claude session or provider credentials.

Authenticated acquisition from a private producer repository is outside the
1.3.0 baseline.

The adapter cannot set up DEV FOUNDRY itself or migrate its version. If your
repository is not ready, establish and review the project setup described in
[how a project adopts DEV FOUNDRY](#7-how-a-project-adopts-dev-foundry).
Once the project has established **2.1.0 active**, return to **Step 1** below. There is no adapter shell command for that prerequisite.

### Choose your situation

| Your situation | Where to start |
| --- | --- |
| New repository, nothing installed yet | Follow [greenfield adoption](#a-new-project-greenfield-adoption), establish active 2.1.0 project setup, then return to Step 1. |
| Existing repository that has never used DEV FOUNDRY | Follow [brownfield adoption](#an-existing-product-brownfield-adoption), preserve the product and history, and return to Step 1 when 2.1.0 is active. |
| Repository already on DEV FOUNDRY 2.1.0 | If setup is complete and active, start at Step 1. |
| Repository on an older DEV FOUNDRY release | Review and complete [version adoption or migration](#an-existing-dev-foundry-project-version-adoption-or-migration) to 2.1.0, then return to Step 1. |
| Repository halfway through a DEV FOUNDRY adoption | Reconcile the unfinished configuration and required decisions described in [project adoption](#7-how-a-project-adopts-dev-foundry); return when 2.1.0 is active. |
| Existing dev-foundry-claude installation on an older adapter package | Start with [reinstall and upgrades](#package-integrity-reinstall-and-upgrades) and keep your current package available, because installing 1.3.0 does not upgrade an already configured repository. |

### Install dev-foundry-claude

#### Step 1: install the released adapter

Install the latest released package without cloning or building the producer:

```sh
npm install -g https://github.com/mavalenzuela22/dev-foundry-claude/releases/latest/download/dev-foundry-claude-adapter.tgz
dev-foundry-claude --version
```

Adapter 1.3.0 introduces explicit compatible upgrades. The package includes its
runtime dependencies and prebuilt dashboard. GitHub Releases also provide a
versioned tarball and `SHA256SUMS` for exact-version or verified offline acquisition.
The stable alias selects a download; the installed payload identifies the exact
release. The release must have been published before its download URL is usable.

Installing a newer package changes no repository files. For first preparation,
continue to Step 2. For an already configured repository, use the explicit upgrade
flow below before launching it with the newer package.

### Upgrade an already prepared repository

Set `PROJECT_ROOT` to your repository's absolute path. Keep your previous pinned
package available until the upgrade is complete. Inspect status, then create and
review a plan outside the repository:

```sh
PROJECT_ROOT="$HOME/Development/acme-billing"
dev-foundry-claude upgrade status --root "$PROJECT_ROOT"
UPGRADE_WORKDIR="$(mktemp -d /tmp/dev-foundry-claude-upgrade.XXXXXX)"
UPGRADE_PLAN="$UPGRADE_WORKDIR/upgrade-plan.json"
dev-foundry-claude upgrade plan --root "$PROJECT_ROOT" --out "$UPGRADE_PLAN"
cat "$UPGRADE_PLAN"
```

Status reports `current`, `upgrade-needed` or `blocked`, with both exact pins.
A `ready` plan binds the current and target releases and changes only the runtime
pin in `.mcp.json`. Review it through your project's process, then apply the exact
plan using the printed `planSha256`:

```sh
PLAN_SHA256='paste-the-printed-planSha256-here'
dev-foundry-claude upgrade apply --root "$PROJECT_ROOT" --plan "$UPGRADE_PLAN" --plan-sha256 "$PLAN_SHA256"
dev-foundry-claude upgrade status --root "$PROJECT_ROOT"
dev-foundry-claude adopt status --root "$PROJECT_ROOT"
```

Record the change through your project's normal commit workflow. A subsequent
`adopt plan` against the target package should be `noop`. A current repository
produces a `noop` upgrade plan. Apply rejects repository drift, changed pins,
dirty touched paths, changed target identity and stale plan bytes. Create and
review a fresh plan after resolving drift.

`upgrade-migration-required` means other adapter-owned bytes differ from the target.
The compatible upgrader writes nothing in that state; broader migration requires
separate project governance. Upgrade never changes agents, managed instructions,
ignore rules, capability profiles, bootstraps, consumer authority or product code.

### Prepare the repository

#### Step 2: create and review a plan

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

#### Step 3: apply the approved plan

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

### Activate Claude

#### Step 4: have the project review and apply the activation proposal

Activation switches the project's planning, implementation, review, validation
and record-keeping responsibilities to Claude. Installing and applying adapter
files does not make that switch.

The plan includes a separate activation proposal. That proposal must be reviewed
and applied by the project process that currently manages DEV FOUNDRY for this
repository. The adapter does not apply it automatically. The currently bound Governance
Author prepares and reconciles this configuration change; the identified Operator
and any other required gates govern its authorization. Claude does not gain
those responsibilities simply because its project files have been generated.

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

### Open the dashboard

#### Step 5: view local work records

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

### Start Claude

#### Step 6: launch with your existing provider setup

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
does not replace activation or task approval. MCP exposes project tools to
Claude; workspace trust permits the host connection, while project bindings and
task authority determine allowed work. Connection details are in the
[advanced reference](#mcp-launch-entry).

#### Adapter example: acme-billing

The team keeps an existing product at `$HOME/Development/acme-billing`. It first
completes DEV FOUNDRY 2.1.0 adoption while preserving its product and history.
Then it follows Step 1 with the released package, uses that project
path in Step 2, reviews the plan and applies it in Step 3.

Status reads `prepared`; the dashboard can now open. The team has its existing
project process review and apply the separate activation proposal. When status
reads `active`, it starts `dev-foundry-claude run direct --` from acme-billing.

### Troubleshooting

Start with the next action below. The final column explains the technical cause;
the concepts are introduced above and configuration fields are in the advanced reference.

| Message or symptom | Next action | Technical explanation |
| --- | --- | --- |
| `not-governed` | Point `--root` at your project's Git top-level, complete or repair DEV FOUNDRY 2.1.0 setup, then create a fresh plan. | The CLI cannot recognize the required active project configuration and selected framework release. |
| `unsupported-framework` | Review [version adoption or migration](#an-existing-dev-foundry-project-version-adoption-or-migration) and complete the prerequisite; if 2.1.0 is already active, have the Governance Author reconcile conflicting version records. | The recorded framework versions are unsupported or disagree; the adapter cannot migrate them. |
| `dirty-working-tree` | Preserve and resolve affected uncommitted work through your normal workflow, keep the plan outside the repository, then create and review a fresh plan. | Changes on paths checked by adoption prevent applying a stable plan. |
| `adapter-runtime-mismatch` or `Adapter runtime verification failed.` | Make sure `PATH` selects the exact package build configured for this repository; reinstall that same supplied tarball into a fresh directory if necessary. For an older installation, follow the explicit upgrade flow above. | The installed files differ from the version and checksum recorded in the project; even two builds labeled 1.3.0 may differ. Do not change the recorded checksum to bypass verification. |
| `BINDING_INACTIVE` | Run `adopt status`; finish activation if it says `prepared`, or have the project process resolve incomplete configuration if it says `partial`. | The project has not fully assigned its DEV FOUNDRY responsibilities to Claude; installing files or approving the tool connection cannot activate those assignments. |
| Dashboard requires a Git repository or project operating profile | Run inside your intended project or pass `--root /absolute/path/to/project`, then complete DEV FOUNDRY setup and adapter preparation if needed. | The dashboard needs the project's Git root and valid profile. The package installation directory is not a project-data root. |
| Requested dashboard port is occupied | Use another port, such as `dev-foundry-claude dashboard --port 43128 --root "$PROJECT_ROOT"`, and open `http://127.0.0.1:43128`. | The server does not automatically choose a fallback port. |
| Dashboard command prints usage | Supply one `--port` between 1024 and 65535 and, optionally, one `--root`. | Unknown, duplicate or malformed dashboard arguments are rejected. |

## 10. Dashboard and tokens

The dashboard gives you a read-only view of records already produced by the
selected project. In the current package it displays:

| View | What is available now |
| --- | --- |
| Executions | Durable execution and request records, statuses and bounded detail views when those records exist. |
| Validations | Governed validation-request records and their observed states. |
| Transactions | Repository-transaction records, phases and recorded next actions. |
| Claude OTEL | Available local Claude usage measurements, latest and previous observed sessions, global observed totals, breakdowns and recent launcher-run context. |
| Throughput and Live Activity | These views remain unavailable; no live runner call source is configured. |

**OTEL** refers to OpenTelemetry, the telemetry format used for the available
Claude measurements. When emitted and present, the dashboard can show input,
output, cache-read and cache-creation tokens, reported USD cost, observed API
requests, durations, sessions and models. Coverage varies by measurement and
session. The token total reflects the measured subset, not a guarantee of all
usage. Task, role and launch-mode correlations provide context; they do not
allocate measured tokens or cost to individual tasks.

These values are **telemetry/evidence, not an automatic budgeting guarantee**.
They do not enforce a spending cap, promise savings or establish the complete
provider bill. Empty or unavailable values mean missing observation, not zero.
Malformed or truncated records remain visibly unavailable or degraded; the view
does not estimate missing measurements.

Opening or viewing the dashboard does not invoke Claude or spend Claude tokens.
It does not start a collector or generate new usage data. The separate `run`
launcher starts the local collector alongside your Claude session; available
measurements depend on what that session emits and records.

The server is **read-only and loopback-only**, listening on `127.0.0.1` for access
from this computer. It reads bounded evidence from your project, and provides no
execution, validation, mutation, approval or promotion operation. You can open
it after adapter preparation without provider credentials or an active Claude
session. Viewing a record does not advance its lifecycle.

## 11. Advanced technical reference

### Ponytail and canonical authority

The canonical DEV FOUNDRY 2.1.0 authority for the philosophy explained above is
[OPS-007 — Minimal Sufficient Change and Sufficiency Review](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-007] DF - Minimal Sufficient Change and Sufficiency Review.md>).
“Ponytail” is orientation shorthand in this README/project, not terminology
defined by the canonical release, a new canonical artifact or a new rule. Read
OPS-007 for the governing necessity, reuse, implementation, validation, audit and
evidence-triggered evolution discipline. This README does not amend the immutable
2.1.0 release.

### Project configuration and authority routing

The conceptual definitions above come from the selected 2.1.0 release. Concrete
paths are project choices; this adapter normally expects:

| Configuration | Consumer path or field | Technical meaning |
| --- | --- | --- |
| POP | `.dev-foundry/profiles/project-operating-profile.yaml` | `dev-foundry.project-operating-profile.v2`; project binding, not reusable methodology. |
| Authority Index | `.dev-foundry/authority-index.yaml` | `dev-foundry.authority-index.v2`; routes concepts to homes and binds required configuration. |
| Selected release | POP `framework.selected_authority_index` and `framework.selected_manifest` | Entry point and integrity manifest for the explicitly adopted immutable framework release. |
| Role bindings | POP `actor_bindings` | Each records `profile`, implementation kind/identity/platform, applicable `capability_profiles` and binding `status`. |
| Startup bindings | POP `platform_bootstraps` | Repository bootstrap paths with prepared, active, stale or retired status. |
| Local policies | POP `policies` and `deviations` | Metadata migration, additional audit triggers, promotion rules, default role and approved deviations; cannot silently redefine framework semantics. |
| Adapter pin | Generated `.mcp.json` launch arguments | Exact package version and SHA-256 of payload-manifest bytes; version alone cannot identify a build. |

The POP also records repository identity/classification, Operator identity,
framework version and adoption status. Actor Profiles define provider-neutral
behavior; Capability Profiles constrain concrete implementations. Bootstrap
schema `dev-foundry.platform-bootstrap.v2` is derived startup configuration with
`canonical: false` and `methodology_authority: false`.

Authority Index routes declare an ID, path, authority class, governed concerns
and optional registered section ID. Active concerns have one home within their
scope; historical routes cannot satisfy active authority. The index routes
rather than owns the rules. Its bindings connect required configuration without
making that configuration the owner of reusable rules.

Governed Markdown documents use the DAT-008 frontmatter contract
`dev-foundry.sot-document.v2`. Identity, type, title, status, version, owner,
scope and authority references must agree with the body and lifecycle. A schema
check can prove shape and references; it cannot prove semantic ownership or
necessity. README is orientation, not a governed document claiming product
authority.

For authority resolution, reserved Operator decisions precede the adopted
framework, then POP configuration and applicable project authority, then derived
bounded instructions, with evidence as descriptive proof. Product authority
retains the ADR → ARC → SPC → DAT → TSK direction. Lower layers cannot silently
override higher ones.

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
node scripts/release/build-assets.mjs --out /absolute/path/to/empty-release-assets
```

The release builder creates its output directory and requires it to be empty.
It runs normal `npm pack`, verifies the packed payload, writes the versioned
tarball and byte-identical `dev-foundry-claude-adapter.tgz`, and writes
`SHA256SUMS` covering both exact filenames. Repeating from identical package
inputs in a fresh output directory produces identical assets. `prepack` always
rebuilds the UI from
`tools/dashboard`, then generates `payload-manifest.json` from npm's actual file
list and verifies bundled runtime dependency versions against the root lockfile.
The tarball is `dev-foundry-claude-adapter-1.3.0.tgz`. Its SHA-256 identifies that
concrete archive; tarballs built on different operating systems are not guaranteed
to be byte-identical. The SHA-256 of `payload-manifest.json` identifies the installed
runtime payload. The launcher is packaged with canonical LF line endings so
supported npm installers do not rewrite a manifest-listed executable byte.
Managed-block replanning is idempotent with both Windows CRLF and LF line endings;
content edits inside the block still fail closed.
There is no consumer install/build lifecycle script.

Check the tarball/manifest relationship and record its identity for the governed
artifact handoff:

```sh
node scripts/package/payload-manifest.mjs --check /absolute/path/to/artifacts/dev-foundry-claude-adapter-1.3.0.tgz
shasum -a 256 /absolute/path/to/artifacts/dev-foundry-claude-adapter-1.3.0.tgz
node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; const b=fs.readFileSync("payload-manifest.json"); console.log(JSON.parse(b).version+":sha256:"+crypto.createHash("sha256").update(b).digest("hex"));'
```

Retain the tarball SHA-256 and the printed `<version>:sha256:<payload-root>`.
Keep that tarball immutable. Version alone cannot identify a build. Packing does
not publish to a registry or create a tag/release. After validation and promotion,
a maintainer may dispatch `.github/workflows/release.yml` from `main`. It restores
dependencies, builds these assets and creates `v<version>` at the exact workflow
commit using GitHub's token. It rejects existing tags/releases and non-main refs,
uploads only the two tarballs and `SHA256SUMS`, and publishes to neither npm nor
GitHub Packages. Publication is a separate authorized step. The offline
tarball/prefix install mechanism has been tested with
registry access disabled and the temporary producer build tree deleted.

The anonymous consumer download URL assumes the producer repository and release
assets remain publicly readable. Making the repository private requires an
authenticated acquisition flow outside the 1.3.0 baseline.

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

The adapter **pin** binds the package version and SHA-256 of canonical
`payload-manifest.json` bytes to verify installed runtime content. Every shipped
regular file, including compiled dashboard assets, templates,
README and bundled dependencies, has its own size/hash entry. The manifest itself
is bound by the pin. npm-generated launch artifacts directly inside the installed
package's `node_modules/.bin/` are installer-owned: symlinks and Windows regular
shims such as `yaml`, `yaml.cmd` and `yaml.ps1` are allowed. This exception covers
only direct children, never nested files or files elsewhere; any manifest-listed
file still requires its exact size and SHA-256, even inside `.bin`. Other unlisted
files, missing or modified payload files, or a different installed build stop
`mcp`, `run` and `dashboard` before serving/launching. Verification is
local and performs no network lookup. It detects drift; it does not defend against
a hostile local actor who can replace the verifier, Node or the OS.

Reinstalling the **exact same tarball** into a fresh prefix and updating `PATH`
preserves the consumer's existing pin. Replacing it with another version/build
does not update `.mcp.json`; runtime verification fails. `adopt plan` reports
`adapter-runtime-mismatch` against a different existing adapter pin.

Use the explicit `upgrade status`, `upgrade plan` and `upgrade apply` flow in
[installation](#upgrade-an-already-prepared-repository). Upgrades verify the installed
target payload and bind both exact release pins. They support only a byte-compatible
owned surface plus pin replacement; broader migrations fail closed. Installing a
package alone never upgrades a repository. Framework version adoption under
OPS-005 and an adapter release upgrade remain separate operations.

### Canonical 2.1.0 reading reference

The primer above derives its meanings from these documents in this repository's
selected immutable release. These links let you inspect the full authority;
your own project's selected release and Authority Index govern its operation.

| Authority | What to consult it for |
| --- | --- |
| [OVR-001 — Framework Overview](<.dev-foundry/releases/2.1.0/docs/00-overview/00 [OVR-001] DF - Framework Overview.md>) | Methodology purpose, scoped SoT, authority direction and self-containment. |
| [OVR-002 — Documentation Map and Artifact Taxonomy](<.dev-foundry/releases/2.1.0/docs/00-overview/00 [OVR-002] DF - Documentation Map and Artifact Taxonomy.md>) | Ten document types, operational classes and product authority direction. |
| [OPS-001 — Governed Planning and Delivery Lifecycle](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-001] DF - Governed Planning and Delivery Lifecycle.md>) | Intent, task boundaries, optional decomposition, preparation and lifecycle separation. |
| [OPS-003 — Roles, Responsibilities, and Separation of Duties](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-003] DF - Roles Responsibilities and Separation of Duties.md>) | Operator, five roles, operation-scoped selection and independence. |
| [OPS-004 — Validation, Audit, Evidence, and Corrective Model](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-004] DF - Validation Audit Evidence and Corrective Model.md>) | Self-verification versus validation, verdicts, audit triggers and evidence. |
| [OPS-005 — Project Adoption, Versioning, and Framework Evolution](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-005] DF - Project Adoption Versioning and Framework Evolution.md>) | Greenfield/brownfield adoption, readiness, POP and explicit version adoption. |
| [OPS-008 — Side Effect Authorization and Promotion Safety](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-008] DF - Side Effect Authorization and Promotion Safety.md>) | Side-effect authorization, standing authorization, promotion and boundary reconciliation. |
| [OPS-009 — Actor Profiles, Project Bindings, and Platform Bootstrap](<.dev-foundry/releases/2.1.0/docs/30-operations/30 [OPS-009] DF - Actor Profiles Project Bindings and Platform Bootstrap.md>) | Profile behavior, implementation assignments and minimum startup context. |
| [DAT-008 — Source of Truth Frontmatter Contract](<.dev-foundry/releases/2.1.0/docs/60-data-contracts/60 [DAT-008] DF - Source of Truth Frontmatter Contract.md>) | Governed document identity, scope, metadata and truthful lifecycle state. |
| [DAT-016 — Actor, Capability, Project Profile, and Platform Bootstrap Contracts](<.dev-foundry/releases/2.1.0/docs/60-data-contracts/60 [DAT-016] DF - Actor Capability Project Profile and Platform Bootstrap Contracts.md>) | Machine-readable profile, POP, binding and bootstrap shapes. |
| [DAT-020 — Authority Index Contract](<.dev-foundry/releases/2.1.0/docs/60-data-contracts/60 [DAT-020] DF - Authority Index Contract.md>) | Routing, configured bindings and single-authoritative-home invariants. |
