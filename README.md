# dev-foundry-claude

A user guide to **DEV FOUNDRY 2.1.0**, followed by instructions for its
**Claude Code adapter 1.2.1** (`@dev-foundry/claude-adapter`).

If you know Git and normal software development but are new to structured AI
work, start here. You do not need to choose between Claude, Codex, Cursor or a
provider before understanding the methodology. The first part explains how a
project keeps decisions, responsibilities and proof durable. Installation comes
after that foundation. If the dashboard and token visibility brought you here,
this foundation explains what those work records and measurements mean.

**This README is orientation, not authority.** It explains the already-adopted
methodology; the selected official methodology release (the **canonical release**)
and your project's approved documents and configuration govern actual work. Examples below are fictional, not project
requirements or authorization.

## 1. What is DEV FOUNDRY?

DEV FOUNDRY is a provider-neutral software-delivery methodology. It describes how
to turn a human's desired outcome into a reviewable change with explicit scope
and limits (a **bounded change**): establish
what is required, record decisions, assign responsibilities, implement within
scope, validate the result, keep evidence, and control promotion and closure.

It is not an AI model, IDE, CLI, Git workflow or agent product. Those are possible
tools used to carry out the work. Claude, Codex, a human, a service or another
agent can participate when the project assigns an appropriate responsibility to
that implementation.

The project repository holds the durable knowledge needed to resume work later:
what the project has decided, what a change must do, who may act, what was
observed and what remains unfinished. Chat history and model memory are not the
source of truth. A new session retrieves the relevant repository knowledge
rather than depending on yesterday's conversation.

This structure makes boundaries and claims inspectable. It does not make a model
infallible or guarantee safety automatically; the required decisions, checks and
authorizations still have to be performed.

## 2. The problem it solves

Unstructured AI work can leave useful decisions and uncertain claims mixed into
a conversation. DEV FOUNDRY gives each kind of information a place and an owner.

| Familiar situation | How the methodology addresses it |
| --- | --- |
| “I told the AI something yesterday and today it forgot.” | Approved decisions and requirements live in repository documents that the next session can retrieve. |
| “The AI changed more than I asked.” | Work has an explicit outcome, scope, exclusions and stop conditions. A broader capability needs authority; access to files is not permission to change them. |
| “I don't know whether tests actually passed or the assistant just said they did.” | Implementation claims are separated from validation results tied to an identified, observable project state, with evidence and limitations. Missing proof cannot become PASS. |
| “I changed from Claude to another tool and lost context.” | Responsibilities and authoritative project knowledge are independent of the provider. A tool change requires compatible project bindings, rather than making the old chat the new tool's authority. |
| “I spent tokens rediscovering decisions.” | Each decision has an authoritative home and a route to find it, so work can retrieve the needed context. This is a structural response to repeated discovery, not a promise of token savings. |
| “I don't know what is done, what is only proposed, or what was actually merged.” | Documents have explicit lifecycle state, and implementation, validation, review, integration and closure are recorded as separate facts. |

The methodology does not require every change to produce a large stack of new
files. It requires enough explicit authority and proof for the actual boundary.

## 3. The mental model

### Start with human intent

Someone states an outcome and its limits: “Let invoice users download a CSV of
the invoices they can already see; do not change billing calculations.” This is
intent. Before implementation, the project determines why it is needed, which
existing decisions apply and whether anything remains unresolved.

### Keep project knowledge durable

The project records accepted decisions, architecture, required behavior,
information contracts, work boundaries and operating rules in repository files.
By **authority**, this guide means the applicable approved definitions and
permissions that determine what work may do. A convenient summary or an observed
code path does not silently replace an approved definition.

### Give each concept one authoritative home: Source of Truth (SoT)

For any bounded concept, one selected document or stable section owns its
normative definition: what must be true. DEV FOUNDRY calls that home the
**Source of Truth (SoT)**. For example, a CSV contract might own column order,
while a behavior specification owns who may export invoices.

SoT is scoped to the concept and version it owns. It is not one magical file
containing every rule. Within that scope, the authoritative home prevails over
summaries, copies, historical material, chat, evidence and implementation
behavior. If code disagrees with a requirement, the code's existence does not
make it the new requirement.

### Route to those homes: Authority Index

The project keeps a table of contents that points each concern to its
corresponding authoritative home. DEV FOUNDRY calls this the **Authority Index**.
“Invoice export format” can route to the CSV contract; “who may export” can route
to the behavior specification.

The index is a router. It does not own all the rules it points to. Routes must
resolve, and one concern must have one active authoritative home within the same
scope. A filename alone does not establish authority: status, scope, version and
applicable higher authority also matter.

### Bound one coherent outcome: a Task (TSK)

One necessary, coherent, independently demonstrable outcome is a **capability**.
The governed work document for delivering one such capability is a **Task**, whose
canonical document token is **TSK**. “Add invoice CSV export” can be one TSK;
“improve the whole billing system” is not a suitably bounded task.

A TSK states its purpose, applicable authority, scope, exclusions, acceptance,
dependencies, evidence expectations and completion policy. It delivers behavior
already governed by applicable authority; it cannot leave an unresolved product
decision for the implementer to invent.

### Separate responsibilities from tools: roles

Defining what should happen, implementing it, checking deterministic facts,
evaluating governance and preserving records are different responsibilities.
DEV FOUNDRY calls them **roles**. The role describes responsibility and its
boundary; the implementation is the human, tool, model or service assigned to it.
The next sections explain the assignments and their limits.

### Keep proof separate from requirements: evidence

A test result, observed file state or recorded decision can establish what
happened. That verifiable information is **evidence**. A sentence saying “done”
is a claim until observable proof supports it.

Evidence does not create requirements. A passing test proves its declared facts
about the tested state; it cannot authorize a new feature or a merge.

### Keep lifecycle stages distinct

Work moves through separate stages, with the applicable checks and authorization
at each boundary. A simple view is:

```text
human intent -> project authority -> task -> implementation -> proof
             -> review when needed -> promotion -> closure
```

**Promotion** means moving eligible work through an authorized boundary, such as
integration into the main branch. **Closure** records its accepted terminal
disposition: what was delivered, what evidence supports it, and any limits or
deferrals. Neither implies the other.

Not every task uses every stage. A documentation-only operation need not
manufacture code implementation; a validation-only operation need not reopen
implementation; independent audit is required only when triggered. Where a stage
applies, completing the previous stage does not automatically complete or
authorize it.

## The Ponytail philosophy: do the smallest safe complete thing

**Ponytail** is the human/project shorthand we use to explain the discipline
already defined in DEV FOUNDRY 2.1.0's **OPS-007, “Minimal Sufficient Change and
Sufficiency Review.”** The canonical release does not define the word
“Ponytail.” This name adds no normative rule and does not replace OPS-007 or
change the immutable 2.1.0 release.

Ponytail does not mean “do less at all costs.” It means implement the **smallest
safe complete change** that fully satisfies the governed intent: the approved
outcome and its limits. **Safe** means preserving required safety, security,
integrity and compatibility. **Complete** means meeting the whole authorized
outcome, including required validation, evidence and acceptance. Those two words
are as important as **smallest**. Cutting a required check or leaving part of
the outcome unfinished is not Ponytail.

### Reuse before creating

Before adding anything, ask in this order, with investigation proportional to
the change:

1. Can **no change** satisfy the outcome?
2. Can we **reuse existing authority or behavior**?
3. Can we **compose existing pieces**?
4. Can the **standard platform capability** solve it?
5. Can an **already-approved dependency** solve it?
6. Can **one bounded local change** solve it?
7. Only then, is a **new abstraction, dependency, component, document or
   lifecycle concept** necessary?

Moving past an earlier option needs a concrete reason. A current requirement,
risk or observed evidence must justify the addition. Without that justification,
Ponytail rejects speculative abstractions, generic infrastructure, broad
repository archaeology (exploring unrelated files and history), unrelated
cleanup, premature extensibility, unnecessary documents, arbitrary test
expansion, repeated proof that is still valid, and future capability implemented
“just in case.”

Valid proof can be reused only while it still applies to the state and boundary
being checked. Repeat or broaden it when the change could invalidate it, a new
risk requires it, or applicable authority requires fresh evidence. Minimality
never excuses skipping required validation or audit.

### Apply it to the whole work, not just the code

Ponytail applies to documentation, prompts and execution packs, authority
retrieval and model context, the number of steps, validation depth, audits,
artifacts, dependencies and architecture. Ask what each addition contributes to
the current authorized outcome. Use enough context, steps and proof to preserve
the required boundaries; do not add them merely to make the process look bigger.

For AI-assisted work, this discipline aims to give the model less irrelevant
context and leave fewer ambiguous decisions to the executor. It reduces the need
to spend tokens rediscovering decisions or exploring unrelated surfaces, favors
shorter and more deterministic execution paths, and leaves less opportunity for
scope creep. A small, explicit delta is also easier to review. These are reasons
for the discipline, not guarantees of token savings or correctness.

### Give the executor a resolved, bounded change

The executor implements an already-resolved change with clear limits. Resolve
ambiguous product decisions before implementation. When the relevant authority
can be compressed into focused instructions and direct references, do not send
the executor to “figure out the whole system.” A summary helps it find and apply
authority; it does not replace that authority.

Focused checks may uncover a regression or consistency fix directly caused by
the change. The executor may handle it only when it is necessary for the approved
outcome, remains inside the already-authorized capability, is the smallest
sufficient correction, and needs no new decision. It must introduce no new
capability, public behavior or dependency, cross no hard exclusion or protected
surface, and have observable evidence of the affected relationship. If it needs
new authority or a new decision, stop and return it for governance resolution.

### Tiny example: invoice CSV export

| Approach | What the change does |
| --- | --- |
| **Bad: build for imagined future needs** | Create a generic reporting framework, plugin architecture, abstraction layers and future export formats for a request that only needs invoice CSV. |
| **Ponytail** | Reuse the existing invoice query and authorization rules. Add only the CSV behavior and contract required now, test the affected boundary, and record what observed requirement or evidence would justify evolution later. |

For example, record that scheduled exports remain outside this change and that
an observed, approved need for scheduling would justify reconsidering the design.
Record the trigger without implementing scheduling now.

In everyday language: **Don't build more than the current governed problem
needs, but don't cut required safety or proof either. Reuse before creating,
keep execution bounded, and evolve later when evidence justifies it.**

## 4. What are all these files?

### Ten document types, ten responsibilities

A governed document is a durable record with a defined responsibility, explicit
identity, scope, version and lifecycle state. The prefix tells you its kind, not
whether its contents are currently authoritative. These are the ten canonical
governed document types:

| Type and name | Plain-language purpose | Question it answers | Tiny fictional example |
| --- | --- | --- | --- |
| **OVR — Overview** | Maps the project, context and scope; summarizes authority owned elsewhere. | “What is this project, and where do I find things?” | A billing overview links to invoice behavior and export contracts. |
| **ADR — Architecture Decision Record** | Records a material accepted decision, alternatives, consequences and boundaries. | “What did we decide, and why?” | Use the existing authorization model for exports rather than create a second one. |
| **ARC — Architecture** | Describes components, interactions and trust or ownership boundaries within accepted decisions. | “How is the system structured?” | The invoice endpoint calls the existing invoice query service and a CSV serializer. |
| **SPC — Specification** | Defines required behavior, constraints and acceptance criteria. | “What must the product do?” | Export only invoices the current user is permitted to read. |
| **DAT — Data Contract** | Defines exact schemas, fields, states, invariants, errors and interchange contracts. | “What exactly does this information mean?” | CSV columns are invoice number, date and total, with a defined date format. |
| **TSK — Task** | Bounds delivery of one necessary coherent capability and its acceptance. | “What change are we delivering?” | Add invoice CSV export; exclude billing calculation changes. |
| **MTP — Micro-Task Plan** | Optionally decomposes one TSK into materially useful bounded slices. | “Does this task need separate implementation boundaries?” | Separate export service and UI slices because they need distinct proof. |
| **OPS — Operations** | Defines how work is operated: roles, gates, validation, evidence, authorization, adoption and handoffs. | “How do we perform and control the work?” | State which checks and authorization are required before integration. |
| **AUDIT — Governance Audit** | Records read-only evaluation, evidence, findings, verdict and limitations. | “Does this observed boundary conform to its authority?” | Evaluate export scope and evidence; record a finding if it bypasses authorization. |
| **CLOSURE — Closure** | Records verified terminal disposition, delivered scope, evidence, known limits and deferrals. | “What was actually concluded?” | Export delivered and accepted; scheduled exports remain explicitly deferred. |

The normal direction of **product authority** is:

```text
ADR (decisions) -> ARC (structure) -> SPC (required behavior)
               -> DAT (exact contracts) -> TSK (bounded delivery)
```

An architecture realizes accepted decisions; behavior stays within that
architecture; information contracts support the accepted behavior; a task
delivers the authorized capability. Lower documents must not contradict, weaken
or silently reinterpret higher authority.

OVR maps and summarizes. OPS defines how work is operated across the chain. MTP
decomposes an already-authorized TSK. AUDIT evaluates. CLOSURE records terminal
disposition. Referencing a product rule does not let these documents replace it.

**Not every capability needs every artifact.** Reuse existing authority. Skip an
intermediate artifact when there is no material decision, structure, behavior or
contract for it to own. Skipping is invalid if the task, prompt or implementer
would have to invent the missing higher authority.

A slice inside an MTP is a **Micro-Task (MT)**. MT is a planning unit, not an
eleventh document type. A task that is already atomic does not need an MTP or
synthetic MTs just to produce more documents.

### Configuration and working records are a separate category

The project also needs assignments, startup instructions and working proof.
These are operational or configured artifacts, **not additional document-prefix
types**:

| Human concept first | Technical name | Purpose and small example |
| --- | --- | --- |
| The project's methodology configuration | **Project Operating Profile (POP)** | Says which immutable framework version is adopted, who holds final authority and who performs each role. Example: bind implementation to an eligible tool while keeping an independent auditor. |
| The reusable behavior contract for a responsibility | **Actor Profile** | Defines a role's responsibilities, allowed and prohibited actions, inputs, handoffs and stop conditions without choosing a provider. Example: an auditor evaluates read-only. |
| The abilities and limits of a particular implementation | **Capability Profile** | Records supported actions, environment limits and available proof. Example: an executor can run local tests but cannot deploy. The executor-specific form is also called an Executor Profile. |
| The minimum directions needed at session startup | **Platform Bootstrap** | Identifies the project, POP and Authority Index, and how to resolve a role. Example: direct a session to retrieve repository authority and stop if identity cannot be established. It does not duplicate the methodology. |
| Instructions for this one operation | **Prompt / bounded instruction** | Derives an objective, boundaries and checks from existing authority. Example: implement this export without changing invoice calculations. It cannot invent authority. |
| A mechanically checkable execution boundary, when a product uses one | **Execution Contract** | Represents bounded execution authorization using a product-specific format. Example: identify the target repository, allowed change and required proof. It cannot create authority. |
| Facts automatically observed during work | **Runtime Evidence** | Descriptive proof such as command outcomes or runtime status. Example: a test command exited successfully against a recorded state. |
| Verified facts curated for durable review | **Governed Evidence** | Separates claims, observations, validation results, audit judgments and decisions. Example: preserve the export acceptance results and their known limits. It does not define product requirements. |
| Temporary continuity notes | **Session handoff / scratchpad** | Helps the next session find unfinished work. Example: note the pending validation and link its task. It remains non-authoritative context. |

These distinctions help a new session ask “where is the rule?” separately from
“where is the proof?” and “what was someone still working on?”

## 5. Who does what?

The project explicitly identifies its final decision authority, the **Operator**,
and binds the five methodology roles needed for its work. A **binding** is a
recorded assignment of a role to an implementation.

| Responsibility | One-sentence responsibility | Fictional example |
| --- | --- | --- |
| **Operator** | Holds final human or project authority at boundaries reserved to it, including applicable scope, exceptions, adoption and acceptance decisions. | Authorize invoice export and its permitted integration boundary. |
| **Governance Author** | Makes applicable authority and the smallest safe complete work boundary clear and coherent, and prepares the necessary documents and handoffs. | Resolve export requirements and author the bounded TSK. |
| **Implementation Executor** | Completes only the approved implementation boundary, performs focused self-verification and reports unexpected state or missing authority. | Implement the serializer and export button within approved scope. |
| **Mechanical Validator** | Checks deterministic facts against the declared resulting state without repairing it or deciding semantic authority. | Execute the required tests and record their outcomes and the exact state checked. |
| **Governance Auditor** | Evaluates the declared boundary read-only against authority and evidence, meeting independence requirements when applicable. | Check whether the delivered export preserves the required authorization boundary. |
| **Evidence Custodian** | Preserves verified facts and established verdicts while distinguishing claims, results, decisions, limits and deferrals. | Record which checks passed and which acceptance decision was made. |

**Role != tool.** Claude, Codex, a human, a service or another implementation may
perform a role if the project binds it and it fits the required capability. The
Operator is explicitly identified; an AI does not acquire Operator authority by
default.

One implementation can sometimes be bound to several roles. It must select
exactly one eligible role/profile for each bounded operation, keep that role
fixed until the operation ends, then re-establish authority and state before
switching. A continuing conversation does not combine permissions.

Independence concerns actual prior participation. Someone who materially
authored or mutated the audited boundary cannot satisfy its required independent
audit. A different provider, tool or session is not automatically required, and
merely opening a new session does not establish independence. Applicable project
or framework rules can impose further separation.

**Capability does not grant authority.** Being able to edit files, run tests,
access a repository or merge a branch does not mean that the current role and
operation permit those actions. Each side effect needs applicable authorization.

## 6. How one change moves through DEV FOUNDRY

Consider a fictional request: **“Add CSV export to invoices.”** The following is
one possible path; the actual project's authority determines the needed stages.

1. **Intent.** The Operator states the useful outcome and limits: export the
   currently visible invoice set, preserve existing access rules, and exclude
   billing changes and scheduled exports.
2. **Authority.** The Governance Author reads existing decisions, architecture,
   behavior and contracts. If those already cover export, reuse them. If a
   material decision is missing, resolve it in an ADR; update ARC only for needed
   structural authority, SPC for new required behavior, and DAT for an exact CSV
   contract where needed. Do not create all four by habit or leave open decisions
   for implementation.
3. **Task.** One TSK defines the export capability, its authorized scope,
   exclusions, dependencies and acceptance. For example, proof must demonstrate
   the permitted invoice set and the agreed CSV format.
4. **Optional decomposition.** Use an MTP only if materially distinct boundaries
   benefit from separate authorization, ownership, risk, reversibility or proof.
   A small export change may remain one atomic TSK.
5. **Bounded preparation.** Supply the current objective, preconditions,
   applicable authority, implementation boundary, hard exclusions, acceptance,
   required proof, implementation profile and stop conditions. Include expected
   change paths when useful, or explicitly state that no path projection is
   supplied. Missing authority, a broader capability or an unapproved side
   effect stops preparation.
6. **Implementation and self-verification.** The eligible executor implements
   only the authorized export and runs focused checks before handoff. These
   checks support its implementation claim; they are not governed mechanical
   validation. Unexpected changes are reported. A directly necessary change
   beyond predicted paths requires the methodology's boundary reconciliation;
   it cannot cross a hard exclusion or authorize unrelated cleanup.
7. **Mechanical validation.** After executor mutation authority closes, the
   validator independently executes or re-executes the required proof against
   the identified resulting project state, after any required reconciliation.
   Tying proof to that state is its **state binding**: checks of an earlier state
   cannot silently prove a changed one. It reports what the checks establish
   and their limitations. It does not repair the
   implementation as part of validation.
8. **Review when required.** The Governance Author performs applicable
   self-assessment. Independent audit occurs only if the adopted framework,
   project authority/task/risk policy, separation of duties or Operator triggers
   it. A self-assessment is not an independent audit. An auditor evaluates
   read-only and records its verdict and findings; required corrective work
   remains bounded to those findings and directly necessary effects.
9. **Evidence.** Preserve the observed state, implementation claim, validation
   results, any audit verdict, decisions, exclusions and limits. Evidence is
   produced along the way and curated for the next boundary; it is not a new
   requirement source.
10. **Promotion / merge.** Integrate the eligible change only under applicable
    authorization. Passing checks or audit does not authorize merge, publication
    or deployment. A valid standing authorization can cover several phases,
    provided its invariants are rechecked before each side effect.
11. **Closure.** Record the accepted terminal disposition under the task's
    completion policy and required Operator decision or other project authority:
    delivered export, supporting evidence, limits and explicit deferrals.
    Closure does not retroactively authorize earlier work or imply deployment.

### Read results without collapsing them into “done”

Mechanical validation distinguishes these outcomes:

| Result | What it means |
| --- | --- |
| **PASS** | Complete required deterministic proof holds for the declared boundary and state. |
| **FAIL** | Complete proof establishes that the delivered boundary does not conform. |
| **BLOCKED** | A required precondition prevents a valid verdict, such as unavailable required authority or a dependency. |
| **ERROR** | The validator, harness, command, cleanup or evidence mechanism malfunctioned. |
| **INCOMPLETE** | The available evidence cannot establish complete required proof. |

A broken harness is not automatically a product defect. Missing, contradictory
or unverifiable required evidence cannot be reported as PASS. Governance audit
has its own verdicts: **AUDIT PASS**, **AUDIT FAIL** and **AUDIT BLOCKED**; ERROR
and INCOMPLETE above are validation outcomes, not extra audit verdicts.

The export can be implemented while validation is still incomplete. It can have
validation PASS while required audit is pending. It can have audit PASS while
merge is unauthorized. It can be merged while closure is pending. **Implementation
completion, validation PASS, audit PASS, merge and closure are different states.**

## 7. How a project adopts DEV FOUNDRY

Adoption means explicitly selecting an immutable methodology release and setting
up truthful local authority and responsibility assignments. Installing an adapter
is a later tool integration; it cannot decide the project's requirements,
Operator, existing architecture or permissions for it.

### A new project: greenfield adoption

For a repository starting its governed work, establish only what its first
capability needs. This is **greenfield adoption**. Normally this includes the
project configuration (POP), Authority Index, profiles for roles in use, startup
configuration (Platform Bootstrap) when required, an overview/documentation map,
and valid metadata support for governed documents. Add only materially necessary
product decisions, structure, behavior and contracts, plus one TSK. Add an MTP
only when useful; bind an eligible executor and Capability Profile when
implementation is required.

Do not copy another project's old tasks, audits, closures or evidence as your
current authority. A new project needs its own purpose and decisions.

### An existing product: brownfield adoption

For a repository that already has software and history, first establish what it
actually does and how it is delivered. This is **brownfield adoption**. Inventory
verified behavior, architecture, interfaces, existing governance, authority
conflicts, document metadata and runtime dependencies. Separate observed facts
from assumptions, preserve product history, and reconcile the setup with the
selected methodology.

This does not require rewriting historical evidence for consistency. The project
can migrate metadata as documents are touched when incomplete historical coverage
does not block safe current work, or establish a complete baseline when an
approved concrete need requires it.

### An existing DEV FOUNDRY project: version adoption or migration

A project records one explicitly adopted immutable framework release. It does
not inherit newer versions automatically. Moving to 2.1.0 requires reviewing
impact on active authority and work, metadata/schema compatibility, role and
Capability Profiles, POP and Platform Bootstrap, with explicit project
authorization and migration or deviation records where required. Historical
evidence retains the versions under which it was produced.

### What must be ready before governed work?

For the capability being operated, the project needs:

- one adopted framework version and its authority entry point;
- an Authority Index and a truthful POP identifying the project and Operator;
- profiles and eligible bindings for roles actually required;
- valid metadata for the active authoritative documents needed by the capability;
- applicable product authority and one approved TSK;
- an MTP only when required;
- an eligible executor and Capability Profile when implementation is required;
- enough validation capability or procedure to prove the acceptance boundary.

The POP joins these pieces: selected version, adoption status, role assignments,
applicable profiles, startup bindings, metadata policy, additional audit triggers,
promotion rules and approved deviations. A role assignment says who performs a
responsibility; it does not grant unbounded task authority.

The Platform Bootstrap gives a session just enough information to locate that
configuration and its Authority Index and resolve an eligible role. If project
identity, authority, profile or required capability cannot be established, the
operation stops. A documentation-only governance operation does not need a code
executor just to satisfy a symmetrical role chain.

Without this setup, the Claude adapter has no authoritative project configuration
to resolve. It cannot know which rules apply or which responsibility Claude is
permitted to perform. **This adapter requires DEV FOUNDRY 2.1.0 adoption to be
complete and active.** There is no adapter CLI command to perform framework
adoption or version migration. Establish and review the project setup described
here under the methodology's adoption process before continuing to installation.

## 8. Where dev-foundry-claude fits

DEV FOUNDRY is the methodology. **dev-foundry-claude is one adapter for using
Claude Code with that methodology.** It does not define or change DEV FOUNDRY.

```text
DEV FOUNDRY methodology
  -> project adoption/configuration
    -> provider adapter (dev-foundry-claude)
      -> Claude runtime/session
```

This package prepares Claude-specific project instructions, a governance tool
connection, specialized implementation and audit agents, telemetry launch support
and a packaged local dashboard. Its local tool connection uses the **Model
Context Protocol (MCP)** to let Claude resolve the project's governing context.
That connection does not itself approve a task.

Because roles are provider-neutral, a project can conceptually bind another
eligible provider or implementation without changing the meaning of the roles.
This adapter supplies the Claude integration specifically; it does not install
Codex or Cursor integrations or choose your provider credentials.

There are two setup boundaries to keep separate. First, the project adopts DEV
FOUNDRY. Then the adapter prepares Claude files and proposes changing the
project's role bindings and startup configuration to Claude. The approved switch
is **activation**, also called **cutover** in technical records. Prepared files
are not active role assignments.

## 9. Install and use the Claude adapter

### Before you start

**Already using DEV FOUNDRY 2.1.0?**

- **Yes:** install adapter → plan → apply → activate → dashboard / Claude.
- **No:** complete DEV FOUNDRY 2.1.0 adoption or migration → return here.

You need:

- Node.js 20 or newer, npm and Git.
- The adapter package file `dev-foundry-claude-adapter-1.2.1.tgz` and its expected
  SHA-256 checksum from the person authorized to supply it. A checksum lets you
  check that you received the exact file they intended to send.
- A Git repository with DEV FOUNDRY **2.1.0** setup complete and active, and a clean
  working tree. Save or commit your existing changes through your normal workflow
  before preparing the repository.
- For starting Claude: Claude Code and your existing login/provider configuration.
  DIAL users also need `dial`; CodeMie users need `codemie-claude` on `PATH`.
  The dashboard needs no Claude session or provider credentials.

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
| Existing dev-foundry-claude installation on an older adapter package | Start with [reinstall and upgrades](#package-integrity-reinstall-and-upgrades) and keep your current package available, because installing 1.2.1 does not upgrade an already configured repository. |

### Install dev-foundry-claude

#### Step 1: verify and install the supplied package

Ask the package provider for both the `.tgz` file and its expected SHA-256.
That checksum verifies the concrete archive supplied to you; archives built on
different operating systems need not have identical bytes.
**No public registry or download channel has been selected by this project.**
There is currently no public install URL.

Run the following blocks in the same terminal. Replace the package path if needed
and paste the actual 64-character checksum supplied with it:

```sh
ADAPTER_TARBALL="$HOME/Downloads/dev-foundry-claude-adapter-1.2.1.tgz"
EXPECTED_SHA256='paste-the-SHA-256-from-the-package-provider-here'
printf '%s  %s\n' "$EXPECTED_SHA256" "$ADAPTER_TARBALL" | shasum -a 256 -c -
```

Continue only when verification reports `OK`. If it fails, contact the package
provider to resolve the discrepancy. Calculating a hash from the file alone
cannot tell you whether it matches the file the provider intended to send.

Install into a dedicated directory outside your project. Use a fresh directory
if a different build already occupies this location:

```sh
ADAPTER_PREFIX="$HOME/.local/share/dev-foundry/claude-adapter-1.2.1"
mkdir -p "$ADAPTER_PREFIX"
npm install --prefix "$ADAPTER_PREFIX" --offline --ignore-scripts --no-audit --no-fund "$ADAPTER_TARBALL"
export PATH="$ADAPTER_PREFIX/node_modules/.bin:$PATH"
dev-foundry-claude --version
```

Expect `1.2.1`. The package includes its runtime dependencies and prebuilt dashboard;
you need no source checkout or dashboard build tools. Save the `ADAPTER_PREFIX`
and `PATH` settings in your shell configuration so new terminals and Claude's
local tools can find the installed command.

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
Then it follows Step 1 with the supplied package and checksum, uses that project
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
| `adapter-runtime-mismatch` or `Adapter runtime verification failed.` | Make sure `PATH` selects the exact package build configured for this repository; reinstall that same supplied tarball into a fresh directory if necessary. For an older installation, follow the upgrade limitation below. | The installed files differ from the version and checksum recorded in the project; even two builds labeled 1.2.1 may differ. Do not change the recorded checksum to bypass verification. |
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
npm pack --pack-destination /absolute/path/to/artifacts
```

The artifact directory must already exist. `prepack` always rebuilds the UI from
`tools/dashboard`, then generates `payload-manifest.json` from npm's actual file
list and verifies bundled runtime dependency versions against the root lockfile.
The tarball is `dev-foundry-claude-adapter-1.2.1.tgz`. Its SHA-256 identifies that
concrete archive; tarballs built on different operating systems are not guaranteed
to be byte-identical. The SHA-256 of `payload-manifest.json` identifies the installed
runtime payload. There is no consumer install/build lifecycle script.

Check the tarball/manifest relationship and record its identity for the governed
artifact handoff:

```sh
node scripts/package/payload-manifest.mjs --check /absolute/path/to/artifacts/dev-foundry-claude-adapter-1.2.1.tgz
shasum -a 256 /absolute/path/to/artifacts/dev-foundry-claude-adapter-1.2.1.tgz
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

There is currently **no supported automatic adapter upgrade command or in-place
pin migration**. Keep the existing pinned release available. Moving an adopted
consumer to a new release requires a separately governed upgrade capability under
the project's adapter release/consumer upgrade contract (SPC-005). Do not manually
bypass the pin to make a new installation run. Framework version adoption under
OPS-005 and an adapter release upgrade are separate operations.

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
