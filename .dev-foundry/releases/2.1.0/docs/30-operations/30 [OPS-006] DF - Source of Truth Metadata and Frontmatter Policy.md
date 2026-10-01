---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-006
  type: OPS
  title: Source of Truth Metadata and Frontmatter Policy
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - source-of-truth-metadata-policy
    - metadata-body-consistency
    - metadata-adoption-modes
    - section-registry-policy
    - metadata-validation-responsibilities
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
    - runtime-artifact-schema
    - product-data-schema
authority:
  governedBy:
    - OVR-002
    - OPS-001
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-006] DF - Source of Truth Metadata and Frontmatter Policy

## 1. Purpose

Require human-readable Source of Truth documents to be both semantically useful
and deterministically identifiable/routable.

DAT-008 owns the exact frontmatter schema. OPS-006 owns when and how that
metadata is used.

## 2. Governing rule

Every new or materially modified active governed SoT document MUST carry
DAT-008-compatible frontmatter and MUST keep metadata, filename, body, lifecycle,
authority, and routing mutually truthful.

Metadata makes declared facts inspectable. It does not replace the human-readable
body and does not allow a validator to infer semantic truth from tags alone.

## 3. Applicability

DAT-008 applies to the ten governed document types:

`OVR ADR ARC SPC DAT TSK MTP OPS CLOSURE AUDIT`.

Project Operating Profiles, Actor Profiles, Capability Profiles, Platform
Bootstraps, manifests, runtime evidence, and other machine-readable/configured
artifacts use their own explicit contracts.

## 4. Metadata responsibilities

### Governance Author

The Governance Author:

- declares only truthful identity, scope, authority, lifecycle, traceability,
  portability, and section metadata;
- avoids speculative relationships;
- reconciles metadata and body together;
- preserves one authoritative home per concept;
- does not use frontmatter as a substitute for missing product authority.

### Mechanical Validator

The Mechanical Validator may check syntax, supported schema, required fields,
identifier/path conventions, declared references, value sets, section
resolution, lifecycle shape, portability values, and inventory equality.

It does not infer semantic correctness from prose.

### Governance Auditor

The Governance Auditor evaluates whether mechanically valid metadata truthfully
represents the body, authority, lifecycle, scope, and portability.

## 5. Stable section references

A section registry is required only when another active artifact or Authority
Index routes to a subsection as authority.

Section IDs:

- are stable within the document;
- resolve to exactly one heading;
- are referenced by ID rather than ordinal section number;
- are changed together with the corresponding heading;
- are not added for every heading merely for symmetry.

DAT-008 defines the section-entry shape and allowed section kinds.

## 6. Adoption modes

A brownfield project may use:

**On-touch** — metadata reconciliation becomes mandatory when an artifact is
materially modified, reactivated, routed as authority, or referenced at stable
section granularity.

**Complete baseline** — used only when an approved need requires complete corpus
coverage for inventory, authority routing, lifecycle, ownership, portability, or
deterministic validation.

A complete-baseline migration declares its exact corpus, required fields,
validation rule, excluded artifact classes, and completion condition.

Bulk metadata churn for aesthetics alone is prohibited.

## 7. Invalid conditions

Invalid conditions include:

- unsupported or missing schema where required;
- identity/type/title/status contradiction;
- metadata and body disagreement;
- active authority reference to a missing or superseded target without truthful
  historical classification;
- speculative traceability or applicability;
- duplicate ownership of one normative concept;
- unresolved section reference;
- invalid lifecycle or portability value;
- runtime-only material represented as permanent SoT;
- metadata that overstates current scope or authority.

## 8. Governance gates

A new or materially modified active SoT is persistence-ready only when:

- frontmatter parses;
- schema version is supported;
- required fields exist;
- declared references resolve to the degree required by the current boundary;
- body and metadata have no known contradiction;
- project-required compatible fields are present;
- no speculative relationship remains.

Promotion or closure verifies these conditions for the applicable changed corpus.

## 9. Schema evolution

DAT-008 owns schema compatibility rules.

A project may require a field that the active schema already defines as optional
without redefining the field.

A project MUST NOT invent incompatible field meaning under an existing schema
identifier.
