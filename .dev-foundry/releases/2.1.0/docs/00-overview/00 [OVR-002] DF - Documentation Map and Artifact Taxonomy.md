---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-002
  type: OVR
  title: Documentation Map and Artifact Taxonomy
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - documentation-map
    - artifact-taxonomy
    - artifact-authority-map
    - artifact-reference-direction
    - portability-model
    - operational-artifact-classification
  appliesTo:
    artifactTypes:
      - OVR
      - ADR
      - ARC
      - SPC
      - DAT
      - TSK
      - MTP
      - OPS
      - CLOSURE
      - AUDIT
    profiles:
      - project-operating-profile
      - actor-profile
      - capability-profile
      - platform-bootstrap
  excludes:
    - product-specific-document-inventory
    - runtime-record-layout
    - consumer-specific-filenames
authority:
  governedBy:
    - OVR-001
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 00 [OVR-002] DF - Documentation Map and Artifact Taxonomy

## 1. Purpose

Define the canonical DEV FOUNDRY artifact vocabulary so that an adopting project
can determine what kind of authority belongs where without relying on tribal
knowledge.

Artifact type describes responsibility. A prefix or directory never grants
authority by itself; authority also depends on active status, scope, routing,
version, and applicable higher authority.

## 2. Governed Source of Truth document types

| Type | Declares | Must not declare | Default responsible role(s) | Default portability |
| --- | --- | --- | --- | --- |
| `OVR` | Vision, context, scope summary, documentation map, capability map | Detailed implementation decisions owned elsewhere | Governance Author | `adapt` |
| `ADR` | Material decisions, considered alternatives, consequences, boundaries | Implementation steps presented as higher authority | Governance Author; Operator at reserved decision boundaries | `project-specific` |
| `ARC` | Components, interactions, trust boundaries, structural architecture | New product requirements or task scheduling | Governance Author | `adapt` |
| `SPC` | Required behavior, constraints, acceptance criteria | Architecture not authorized by ADR/ARC | Governance Author | `adapt` |
| `DAT` | Schemas, fields, states, invariants, errors, interchange contracts | Human workflow or implementation sequencing | Governance Author | `adapt`, or `reusable` for framework contracts |
| `TSK` | One necessary coherent deliverable capability, scope, acceptance, dependencies, completion policy | Unresolved architecture, unrelated capabilities, speculative epics | Governance Author; Operator where approval is reserved | `project-specific` |
| `MTP` | Optional bounded decomposition of one TSK into MTs | New product authority or capability scope | Governance Author | `project-specific` |
| `OPS` | Reusable or project operating policy for lifecycle, roles, validation, audit, evidence, metadata, sufficiency, authorization, adoption, and handoff | Product implementation design owned by ADR/ARC/SPC/DAT | Governance Author; Operator for reserved policy decisions | `reusable` or `configure` |
| `CLOSURE` | Verified terminal disposition, delivered scope, evidence, known limits, deferred work | Future work presented as delivered authority | Evidence Custodian and Operator as applicable | `project-specific` |
| `AUDIT` | Audit boundary, observed evidence, findings, verdict, limitations, closure predicates | Product authority, implementation changes, or automatic correction | Governance Auditor; Evidence Custodian for durable record | `project-specific` |

These ten identifiers are the canonical governed-document taxonomy. A project
MUST NOT invent another governed SoT document type merely to avoid the
responsibility of an existing type. A new type requires framework evolution or
an explicit project deviation justified by a responsibility not representable
by the taxonomy.

Default portability describes the normal project-owned use of the type. A
framework-owned instance MAY declare a different permitted value when its
ownership boundary justifies it. In particular, this framework's OVR-001 and
OVR-002 are reusable framework authority, while an adopting project's product
overview/documentation map normally remains `adapt`.

### 2.1 Minimum semantic content

The taxonomy defines responsibility, not a mandatory prose template. A document
MUST nevertheless contain enough human-readable content to discharge its type:

- `OVR`: purpose/context plus the map, scope summary, or capability view it owns;
- `ADR`: decision context, accepted decision, materially considered alternatives,
  consequences, and explicit boundaries;
- `ARC`: relevant components, interactions, trust/ownership boundaries, and the
  accepted decisions/requirements it realizes;
- `SPC`: required behavior, constraints, acceptance criteria, and material
  non-requirements/exclusions;
- `DAT`: exact contract/schema/state/error/invariant semantics plus compatibility
  or versioning rules when evolution is possible;
- `TSK`: purpose/necessity, authority, scope, exclusions, acceptance,
  dependencies, evidence expectations, and completion policy;
- `MTP`: parent TSK, decomposition rationale, and each MT's objective, authority,
  mutation boundary, focused proof, and stop conditions;
- `OPS`: purpose, operating rules, applicable roles/gates, stop or exception
  semantics, and relationship to other authority;
- `AUDIT`: audited boundary, applicable authority, observed evidence, verdict,
  findings when any, closure predicates, and limitations;
- `CLOSURE`: closed subject, delivered scope, evidence/verdict basis, known
  limits, explicit deferrals, required final decision, and terminal state.

A project MAY format these elements differently. Omitting a material element is
valid only when the concept genuinely does not apply and the omission does not
force a lower artifact or actor to guess.

## 3. Operational and configured artifact classes

The following are governed artifacts but are not additional SoT document-type
prefixes:

| Class | Purpose | Authority character | Default portability |
| --- | --- | --- | --- |
| Project Profile / Project Operating Profile | Bind one adopted framework version to project identity, roles, implementations, local policies, and approved deviations | Configured project authority; the canonical configured form is the Project Operating Profile (POP) and cannot redefine reusable semantics | `configure` |
| Actor Profile | Provider-neutral reusable contract for one role | Reusable or configured according to profile contract | `reusable` or `configure` |
| Executor Profile | Specialized implementation capabilities, limits, fit, and prohibitions for the Implementation Executor | Configured specialization of Capability Profile; never grants product authority | `configure` |
| Capability Profile | General implementation-specific capabilities or limits for a concrete role/implementation | Configured constraint; Executor Profile is its canonical implementation-executor specialization | `configure` |
| Platform Bootstrap | Minimal startup binding used to locate project SoT and resolve one role/profile | Configured, derived, non-methodology authority | `configure` |
| Prompt / bounded instruction | Derived instructions for one operation | Cannot create new authority | `runtime-only` |
| Execution Contract | Mechanical authorization box for a bounded execution when a product uses one | Cannot create new authority; format is product-specific unless standardized | `runtime-only` |
| Runtime Evidence | Automatically observed facts from a runtime boundary | Descriptive proof only | `runtime-only` |
| Governed Evidence | Curated verified evidence, finding records, or decision support | Descriptive proof; not product or framework authority | `project-specific` |
| Session Handoff / Scratchpad | Temporary continuity material | Non-authoritative context | `runtime-only` |

Products may use different filenames, persistence mechanisms, or transport for
these classes. The semantics above are framework-level; their concrete runtime
representation is a consumer concern unless separately standardized.

## 4. Product authority hierarchy

For product semantics, the default authority direction is:

`ADR > ARC > SPC > DAT > TSK`

Meaning:

- ADR owns accepted material decisions and boundaries;
- ARC realizes those decisions as structure;
- SPC defines required behavior within that structure;
- DAT defines the exact information contracts required by accepted behavior;
- TSK delivers one capability already governed by the applicable authority.

A lower artifact MUST NOT contradict, weaken, or silently reinterpret higher
product authority.

OVR maps and summarizes. OPS governs how work is operated. MTP decomposes an
already-authorized TSK. AUDIT evaluates. CLOSURE records terminal disposition.
None of those categories silently replaces product authority merely because it
references it.

## 5. Reference direction

The preferred derivation/reference direction is:

`OVR -> ADR -> ARC -> SPC -> DAT -> TSK -> MTP -> Prompt -> Execution Contract -> Runtime Evidence -> validation -> AUDIT -> Governed Evidence -> CLOSURE`

OPS and profiles constrain the lifecycle across this chain. Prompt, Execution
Contract, Runtime Evidence, and Governed Evidence are operational classes rather
than additional SoT document types, and a product may omit a class when its
delivery mechanism does not require it.

Not every project needs every artifact type or operational class for every capability. Missing
intermediate artifacts are acceptable when the decision, structure, behavior,
or contract they would own does not materially exist. Skipping an artifact is
invalid when a lower artifact would otherwise have to invent the missing
authority.

## 6. TSK, MTP, and MT

`TSK` is the canonical artifact-type token for a **Task**. A TSK is a governed
Task artifact representing one necessary, coherent, independently demonstrable
capability. It states at least purpose, authority,
scope, acceptance, dependencies, evidence expectations, completion policy, and
deliberate exclusions.

An **MTP** is an optional Micro-Task Plan for one TSK. It exists only when the
TSK contains materially distinct implementation boundaries that benefit from
separate authorization, ownership, reversibility, side-effect, risk, evidence,
or validation control.

An **MT (Micro-Task)** is one bounded implementation slice inside an MTP. MT is a planning
unit, not a separate canonical Source of Truth document type. An MT has one
objective, closed authority, explicit boundaries, focused proof, and stop
conditions. A TSK that is already atomic does not need an MTP or synthetic MTs.

## 7. AUDIT and CLOSURE

An AUDIT artifact records a read-only evaluative boundary and verdict. It does
not mutate the audited subject or create product requirements.

A CLOSURE artifact records the accepted terminal state of a TSK or other
governed lifecycle boundary. Closure records what was actually completed,
evidence and decisions supporting that state, known limits, and explicit
deferrals. Closure does not retroactively authorize work that lacked authority.

## 8. Identifier conventions

Artifact identity and artifact type are different concepts.

The framework requires a stable artifact ID and a truthful `artifact.type`, but
does not require one universal numeric naming scheme. A project MAY use relational
IDs such as `TSK-024-MTP`, `TSK-024-AUDIT`, or `TSK-024-CLOSURE` when that
improves traceability, provided the frontmatter type remains `MTP`, `AUDIT`,
or `CLOSURE` respectively.

MT identifiers normally make the parent relationship obvious, but MT is not a
canonical SoT document type and no filename pattern is mandated.

The historical term **Executor Profile** remains part of the artifact vocabulary.
In the generalized contract model it is a Capability Profile whose bound role is
the Implementation Executor. Products MAY use Capability Profiles for other roles
when implementation-specific limits are materially necessary; doing so does not
change the historical Executor Profile responsibility.

Capability identifiers are also project-owned. A project MAY use a convention
such as `CAP-001`, but `CAP` is not an additional DEV FOUNDRY document type
or a framework-required global registry. The framework owns the meaning of
Capability; the adopting project owns its capability inventory and identifier
scheme.

Corrective, rebaseline, revalidation, evidence-attempt, or similar suffixes MAY
be used in project-specific artifacts when they preserve stable identity and
truthful type/lifecycle metadata. A suffix never creates a new artifact type.

## 9. Portability values

The canonical portability values are:

- `reusable` — framework semantics that may be explicitly adopted unchanged;
- `configure` — governed structure instantiated with project-specific values;
- `adapt` — a structural pattern that requires project-specific authorship;
- `project-specific` — authority belonging only to one project;
- `runtime-only` — ephemeral or durable runtime material that is not permanent SoT.

Portability never creates automatic inheritance. OPS-005 governs the action
associated with each value.

## 10. Authority lookup rule

Every authoritative concept MUST have one authoritative home and MUST be
reachable from the applicable Authority Index.

An index entry SHOULD identify:

- concept or concern;
- authoritative artifact;
- stable section when subsection-level routing is necessary;
- lifecycle/status where ambiguity is possible.

Summaries and indexes MUST be reconciled when the authoritative home changes,
but they MUST NOT redefine the routed rule.

## 11. Governed corpus inventory

Every adopting project MUST be able to enumerate the governed Source of Truth
corpus it claims to operate.

The adapted documentation map MAY contain the inventory directly or reference an
Authority Index/inventory artifact that provides it. The inventory boundary MUST
state what classes are included and excluded.

For each governed SoT document in the declared corpus, the inventory resolves at
least:

- artifact ID;
- title;
- path or stable locator;
- artifact type;
- lifecycle/status;
- portability when required by project policy.

The inventory MAY avoid duplicating document-owned metadata: an Authority Index
route may enumerate the stable path/locator while the routed DAT-008 frontmatter
supplies ID, title, type, status, and portability. The combined route plus
frontmatter MUST resolve deterministically and disagreement is invalid.

Active authoritative homes MUST also be reachable through the Authority Index.
Historical, superseded, evidence, runtime-only, and configured artifacts remain
classified rather than silently disappearing from navigation when they are
needed to interpret current state.

A complete-baseline claim requires exact inventory equality between the declared
corpus and observed governed documents. An on-touch project may have incomplete
historical coverage only to the extent explicitly permitted by OPS-006.

## 12. Consumer freedom and framework invariants

Consumers may choose directory layouts, file naming embellishments, tooling,
automation, storage, and runtime implementation appropriate to their product.

They MUST preserve:

- the semantic responsibilities of the ten governed document types;
- single-authoritative-home discipline;
- product authority direction;
- metadata contract for governed SoT;
- explicit lifecycle and role boundaries;
- evidence-versus-authority separation;
- explicit framework adoption and version binding.

A product implementation detail is not promoted into this taxonomy solely
because one consumer uses it.
