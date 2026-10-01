---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-008
  type: DAT
  title: Source of Truth Frontmatter Contract
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
canonical: true
scope:
  owns:
    - sot-frontmatter-schema
    - governance-metadata-field-contract
    - section-registry-contract
    - lifecycle-field-contract
    - portability-field-contract
    - frontmatter-validation-findings
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
  excludes:
    - runtime-artifact-schemas
    - project-product-data-schemas
ownerRole: governance-author
authority:
  governedBy:
    - OVR-002
    - OPS-006
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 60 [DAT-008] DF - Source of Truth Frontmatter Contract

## 1. Purpose and schema identity

Define the closed-world YAML frontmatter contract for governed DEV FOUNDRY
Source of Truth Markdown documents.

Schema identifier:

`dev-foundry.sot-document.v2`

The frontmatter MUST be the first content in the Markdown file and MUST be
delimited by YAML `---` markers.

Unknown top-level or nested fields are invalid unless this contract explicitly
permits an extension point. A project MUST NOT invent fields or reinterpret an
existing field while continuing to claim this schema identifier.

## 2. Allowed top-level fields

Required:

- `schemaVersion`
- `artifact`
- `artifactVersion`
- `authorityScope`
- `ownerRole`
- `canonical`
- `scope`
- `authority`

Optional:

- `traceability`
- `sections`
- `lifecycle`
- `portability`

No other top-level field is valid in v2.

## 3. schemaVersion

Shape: non-empty string.

For this contract the value MUST equal:

`dev-foundry.sot-document.v2`

## 4. artifact

Required object with exactly:

- `id`: non-empty stable string unique in the governed project corpus;
- `type`: one of
  `OVR | ADR | ARC | SPC | DAT | TSK | MTP | OPS | CLOSURE | AUDIT`;
- `title`: non-empty human-readable title;
- `status`: one of
  `DRAFT | CANDIDATE | PLANNED | ACTIVE | ACCEPTED | IN_PROGRESS | BLOCKED |
  COMPLETE | CLOSED | SUPERSEDED | DEPRECATED | RETIRED`.

Rules:

- the filename MUST contain the exact artifact ID;
- the first Markdown H1 after frontmatter MUST contain the exact artifact ID and
  the exact `artifact.title` text, allowing only project-defined structural
  prefixes/suffixes outside those exact values;
- `type` MUST match the semantic responsibility defined by OVR-002;
- `status` MUST agree with the body and lifecycle;
- IDs are immutable once referenced by active authority or durable evidence;
- renaming or replacing an ID requires explicit supersession or migration.

## 5. artifactVersion, authorityScope, ownerRole, and canonical

`artifactVersion` is a required non-empty string identifying the version of
this artifact. DEV FOUNDRY does not require one global versioning syntax for
project documents. Framework candidate/release artifacts follow the applicable
framework integrity/versioning contract.

`authorityScope` is a required non-empty stable string naming the bounded
authority domain in which this document may be authoritative. It does not
replace the structured `scope` object; it provides the stable routing-level
scope identity.

`canonical` is a required boolean. `true` means the document is the selected
canonical authoritative representation for its declared authority scope under
the applicable Authority Index and lifecycle. `false` means it is not the
selected canonical representation, such as a framework candidate, draft,
historical/derived copy, or other non-canonical artifact.

Canonical state does not by itself activate a framework version, authorize a
side effect, or override routing. The applicable Authority Index and lifecycle
must agree.

### 5.1 ownerRole

Required non-empty stable role identifier naming the role responsible for the
document's governed content.

`ownerRole` does not grant reserved Operator authority and does not mean that
the same implementation may satisfy an independent review of its own work.

The value SHOULD correspond to a role defined by OPS-003 and, in an adopting
project, to an applicable role binding in the Project Operating Profile when
that role is actively performed.

## 6. scope

Required object with exactly:

- `owns`: array of unique non-empty stable concern/capability identifiers;
- `appliesTo`: object described below;
- `excludes`: array of unique non-empty stable identifiers.

`appliesTo` may contain only these keys:

- `capabilities`
- `tasks`
- `components`
- `artifactTypes`
- `profiles`
- `operations`
- `projects`
- `repositories`

Each value is an array of unique non-empty strings.

Empty arrays and an empty `appliesTo` object are valid only when truthful.

A document MUST NOT claim ownership of a concept already owned by another active
authoritative home without an explicit supersession/amendment relationship.

## 7. authority

Required object.

Required fields:

- `governedBy`: array of unique applicable authority artifact IDs;
- `supersedes`: array of unique artifact IDs.

Optional fields:

- `supersededBy`: array of unique artifact IDs;
- `amends`: array of unique artifact IDs;
- `historicalReferences`: array of unique artifact IDs or durable historical
  references.

No other fields are valid.

Rules:

- `governedBy` and `amends` references MUST resolve inside the applicable
  authority boundary: active adopted authority for an operating project, or the
  same declared framework/project candidate when candidate artifacts depend on
  one another during authoring and review;
- candidate-to-candidate references do not make the candidate active or
  canonical authority outside that candidate boundary;
- a document MUST NOT govern itself;
- duplicate references are invalid;
- historical references MUST NOT be mixed into active `governedBy`;
- a lower product-authority artifact MUST NOT claim governance over a higher
  artifact contrary to OVR-002;
- an Authority Index route does not become a governing source merely by
  pointing at the document.

## 8. traceability

Optional object. Allowed fields:

- `satisfies`: array of identifiers;
- `implements`: array of identifiers;
- `implementedBy`: array of identifiers;
- `dependsOn`: array of identifiers;
- `blocks`: array of identifiers;
- `successors`: array of identifiers;
- `derivedFrom`: array of identifiers;
- `closureArtifact`: one artifact ID string.

No other fields are valid.

Traceability describes relationships; it MUST NOT manufacture authority,
dependency, symmetry, or historical lineage that does not materially exist.

## 9. sections

Optional array. Each entry is an object with exactly:

- `id`: stable non-empty identifier unique within the document;
- `heading`: exact Markdown heading text;
- `kind`: one of
  `decision | component | requirement | invariant | operating-rule |
  acceptance-criterion | closure-condition | audit-criterion`;
- `governs`: array of unique non-empty concern identifiers.

Rules:

- each ID resolves to exactly one heading;
- another artifact references the section by stable ID, not ordinal position;
- heading and registry change together;
- not every heading needs registration;
- do not create a section ID without an active routing/reference need.

## 10. lifecycle

Optional object. Allowed fields:

- `phase`: one of
  `draft | candidate | planned | active | accepted | in-progress | blocked |
  complete | closed | superseded | deprecated | retired`;
- `dependsOn`: array of identifiers;
- `blockedBy`: array of identifiers;
- `effectiveAfter`: non-empty string identifying the effective condition or
  boundary;
- `closureArtifact`: artifact ID string;
- `promotionRequired`: boolean.

No other fields are valid.

Lifecycle metadata records state. It does not authorize execution, promotion,
adoption, or closure.

`artifact.status` and `lifecycle.phase` MUST use this exact mapping when both are
present:

| artifact.status | lifecycle.phase |
| --- | --- |
| `DRAFT` | `draft` |
| `CANDIDATE` | `candidate` |
| `PLANNED` | `planned` |
| `ACTIVE` | `active` |
| `ACCEPTED` | `accepted` |
| `IN_PROGRESS` | `in-progress` |
| `BLOCKED` | `blocked` |
| `COMPLETE` | `complete` |
| `CLOSED` | `closed` |
| `SUPERSEDED` | `superseded` |
| `DEPRECATED` | `deprecated` |
| `RETIRED` | `retired` |

If `authority.supersededBy` is present, the current artifact status/phase MUST be
`SUPERSEDED` / `superseded` and each active target MUST resolve. If a
`closureArtifact` field is present in traceability or lifecycle, its target MUST
resolve to a governed artifact with `artifact.type: CLOSURE`.

## 11. portability

Optional scalar. When present, value MUST be one of:

- `reusable`
- `configure`
- `adapt`
- `project-specific`
- `runtime-only`

Meaning and adoption actions are defined by OVR-002 and OPS-005.

A project MAY require portability on every document in a declared corpus even
though v2 keeps the field schema-optional.

## 12. Minimum valid example

```yaml
---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-001
  type: TSK
  title: Deliver one bounded capability
  status: PLANNED
artifactVersion: "1"
authorityScope: example-project-capability
ownerRole: governance-author
canonical: true
scope:
  owns:
    - example-capability
  appliesTo: {}
  excludes:
    - unrelated-capability
authority:
  governedBy:
    - SPC-001
    - DAT-001
  supersedes: []
traceability:
  dependsOn: []
lifecycle:
  phase: planned
portability: project-specific
---
```

## 13. Stable validation findings

Mechanical validation SHOULD use stable findings where useful:

- `SOT_FRONTMATTER_MISSING`
- `SOT_FRONTMATTER_INVALID`
- `SOT_SCHEMA_UNSUPPORTED`
- `SOT_UNKNOWN_FIELD`
- `SOT_ARTIFACT_ID_MISMATCH`
- `SOT_ARTIFACT_TYPE_INVALID`
- `SOT_ARTIFACT_STATUS_INVALID`
- `SOT_ARTIFACT_VERSION_MISSING`
- `SOT_AUTHORITY_SCOPE_MISSING`
- `SOT_CANONICAL_STATE_INVALID`
- `SOT_OWNER_ROLE_MISSING`
- `SOT_OWNER_ROLE_INVALID`
- `SOT_METADATA_BODY_CONFLICT`
- `SOT_SCOPE_OWNERSHIP_CONFLICT`
- `SOT_AUTHORITY_REFERENCE_NOT_FOUND`
- `SOT_AUTHORITY_HIERARCHY_INVALID`
- `SOT_TRACEABILITY_INVALID`
- `SOT_SECTION_ID_DUPLICATE`
- `SOT_SECTION_HEADING_NOT_FOUND`
- `SOT_SECTION_HEADING_AMBIGUOUS`
- `SOT_LIFECYCLE_INCONSISTENT`
- `SOT_PORTABILITY_INVALID`
- `SOT_INVENTORY_METADATA_CONFLICT`

## 14. Validation boundary

Mechanical validation may prove schema and declared-reference consistency.

It MUST NOT infer:

- the correct product decision;
- whether declared scope is actually sufficient;
- semantic ownership from keywords;
- whether the body truthfully represents authority;
- whether the document is necessary.

Those remain governance-author/auditor responsibilities.

## 15. Schema evolution

The schema identifier remains v2 only for backward-compatible clarification or
optional constraints that do not invalidate an otherwise valid v2 document.

A new schema identifier is required when:

- a new field becomes universally required;
- an existing field changes meaning or incompatible shape;
- an allowed value set changes incompatibly;
- a previously valid v2 document becomes invalid solely because of the schema
  revision.

Project policy may require an already-defined optional field for a declared
corpus without changing the schema identifier.

### 15.1 v1 to v2

`dev-foundry.sot-document.v2` is an intentionally incompatible successor to
the historical `dev-foundry.sot-document.v1` contract.

v2:

- requires `artifactVersion`, `authorityScope`, `ownerRole`, and
  `canonical` to satisfy the artifact-version, authority-scope, owning-role,
  and canonical-state metadata requirements carried by canonical framework
  1.0.0;
- makes the allowed top-level and nested field sets explicitly closed-world;
- includes `AUDIT` in the governed document type set, reconciling the
  historical taxonomy with the earlier v1 type list;
- does not retain the generic v1 `metadata` extension object, because
  unconstrained arbitrary metadata defeats deterministic schema meaning.

Existing v1 documents remain historical v1 documents. Adoption of v2 requires
explicit project migration under OPS-005/OPS-006 rather than silent
reinterpretation.
