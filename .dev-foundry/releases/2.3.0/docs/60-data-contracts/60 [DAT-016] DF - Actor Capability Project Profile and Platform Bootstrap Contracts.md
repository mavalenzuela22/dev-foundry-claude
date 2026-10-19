---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-016
  type: DAT
  title: Actor, Capability, Project Profile, and Platform Bootstrap Contracts
  status: ACTIVE
artifactVersion: "2.3.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - actor-profile-v2-contract
    - capability-profile-v1-contract
    - project-operating-profile-v2-contract
    - platform-bootstrap-v2-contract
    - project-actor-binding-contract
    - project-operating-profile-v3-contract
    - platform-bootstrap-v3-contract
    - operation-scoped-implementation-selection-contract
  appliesTo:
    profiles:
      - actor-profile
      - capability-profile
      - project-operating-profile
      - platform-bootstrap
  excludes:
    - product-runtime-schema
    - automatic-platform-configuration
authority:
  governedBy:
    - OPS-003
    - OPS-005
    - OPS-009
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 60 [DAT-016] DF - Actor, Capability, Project Profile, and Platform Bootstrap Contracts

## 1. Purpose

Define closed reusable/configured contracts that separate provider-neutral role
behavior from concrete implementations and startup platforms.

Canonical framework 1.0.0 used `dev-foundry.actor-profile.v1` with
a shape incompatible with the historical incubation contract. The canonical
predecessor 2.1.0 already defines `dev-foundry.actor-profile.v2`;
this candidate preserves its versioned behavior and fields. This candidate
introduces separate POP v3 and Bootstrap v3 identifiers instead of silently
reinterpreting their v2 counterparts.

## 2. Actor Profile v2

Schema identifier:

`dev-foundry.actor-profile.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `role`
- `authority_scope`
- `owner_role`
- `canonical`
- `portability`
- `purpose`
- `responsibilities`
- `allowed_actions`
- `prohibited_actions`
- `preconditions`
- `required_inputs`
- `required_outputs`
- `handoffs`
- `context_policy`
- `stop_conditions`
- `independence`

Optional:

- `modes`
- `capability_profile_refs`

No other top-level fields are valid.

Constraints:

- `schema_version` MUST equal `dev-foundry.actor-profile.v2`;
- `id`, `title`, `role`, `authority_scope`, and `owner_role` are
  non-empty strings;
- `artifact_version` is a non-empty string;
- `kind` MUST equal `actor-profile`;
- `status` is `candidate | active | deprecated | retired`;
- `canonical` is boolean;
- `portability` is `reusable | configure`;
- `purpose` is a non-empty string;
- action/responsibility/input/output/condition fields are arrays of unique
  non-empty stable strings;
- `modes` is a map whose values contain exactly `purpose`,
  `allowed_actions`, and `prohibited_actions`;
- `context_policy` contains exactly `authoritative`, `non_authoritative`,
  and optional `retrieval`;
- `handoffs` is an array; each entry contains exactly `to_role`, `when`,
  and `requires`, where `requires` is an array of stable strings;
- `independence` contains exactly `required_when`,
  `disallowed_prior_participation`, `distinct_implementation_required_when`,
  and `distinct_session_required_by_default`; the first three are arrays of
  stable strings and the last is boolean.

Actor Profile IDs are immutable once used by durable governed evidence. Material
behavior change requires a new profile artifact version or identifier according
to the adopted release policy.

## 3. Capability Profile v1

Schema identifier:

`dev-foundry.capability-profile.v1`

A Capability Profile is project-configured and implementation-specific.

Required fields:

- `schema_version`: MUST equal `dev-foundry.capability-profile.v1`;
- `id`: non-empty stable string;
- `status`: `active | transitional | deprecated | retired`;
- `implementation_class`: non-empty project-specific string;
- `supported_actions`: array of unique non-empty strings;
- `prohibited_actions`: array of unique non-empty strings;
- `limits`: object described below;
- `proof_capabilities`: array of unique non-empty strings;
- `environment_constraints`: array of unique non-empty strings;
- `stop_conditions`: array of unique non-empty strings;
- `portability`: MUST equal `configure`.

Unknown top-level fields are invalid.

`limits` is the one deliberate project-extension map in this contract. Each key
is a stable project-defined limit identifier and each value is a YAML scalar,
array, or object whose semantics are documented by the same Capability Profile.
A limit applies only to the bound implementation and cannot redefine framework
semantics.

A Capability Profile may name a provider, model, tool, service, human/team class,
or environment because it is configured project authority. It cannot redefine
Actor Profile or framework semantics.

An **Executor Profile** is the canonical specialization of a Capability Profile
bound to the `implementation-executor` role. The historical term remains valid;
the generalized Capability Profile contract exists so other roles may declare
implementation-specific limits without inventing unrelated profile schemas.

## 4. Project Operating Profile v2

Schema identifier:

`dev-foundry.project-operating-profile.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `canonical`
- `repository`
- `framework`
- `operator`
- `actor_bindings`
- `platform_bootstraps`
- `policies`
- `deviations`

No other top-level fields are valid.

Top-level scalar constraints:

- `schema_version` MUST equal `dev-foundry.project-operating-profile.v2`;
- `id`, `title`, and `artifact_version` are non-empty strings;
- `kind` MUST equal `project-operating-profile`;
- `status` is `planned | partial | active | migrating | stale | retired`;
- `canonical` MUST be false.

### repository

Exactly:

- `name`;
- `classification`: `greenfield | brownfield`;
- `authority_index`: path or stable locator.

### framework

Exactly:

- `adopted_version`;
- `selected_authority_index`;
- `selected_manifest`;
- `adoption_status`: `planned | partial | active | migrating | retired`.

### operator

Exactly:

- `kind`: `human | team | service | other`;
- `identity`: project-specific identity/role reference.

The framework does not define a default AI Operator.

### actor_bindings

Map keyed by project role. Each binding contains exactly:

- `profile`: Actor Profile ID/path;
- `implementation` object with `kind`, `identity`, and optional `platform`;
- `capability_profiles`: array;
- `status`: `active | transitional | deferred`.

Implementation kind is one of:

`human | model | agent | service | team | tool | other`.

### platform_bootstraps

Map keyed by bootstrap ID. Each entry contains exactly:

- `path`;
- `status`: `prepared | active | stale | retired`.

An empty map is valid when no startup platform binding is required.

### policies

Exactly:

- `frontmatter_schema`;
- `metadata_migration_mode`: `none | on-touch | complete-baseline`;
- `audit_triggers`: array of project-added trigger identifiers;
- `promotion_rules`: array of project-specific rule identifiers;
- `default_role`: role ID or null.

`default_role`, when non-null, MUST name a key present in `actor_bindings`.
Project-added `audit_triggers` may only add triggers; they MUST NOT disable or
weaken triggers required by the adopted framework.

### deviations

Array. Each deviation contains exactly:

- `id`;
- `framework_rule`;
- `scope`;
- `rationale`;
- `risk`;
- `reconciliation_trigger`;
- `operator_approval`.

The POP binds methodology locally and MUST NOT redefine reusable framework
semantics through configuration values.

## 5. Platform Bootstrap v2

Schema identifier:

`dev-foundry.platform-bootstrap.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `canonical`
- `methodology_authority`
- `repository`
- `sources`
- `actor_resolution`
- `platform`
- `constraints`

No other top-level fields are valid.

Constraints:

- `schema_version` MUST equal `dev-foundry.platform-bootstrap.v2`;
- `id`, `title`, and `artifact_version` are non-empty strings;
- `kind` MUST equal `platform-bootstrap`;
- `canonical` MUST be false;
- `methodology_authority` MUST be false;
- `status` is `prepared | active | stale | retired`.

### repository

Contains exactly:

- `expected_name`;
- optional `workspace_binding`.

### sources

Contains exactly:

- `project_operating_profile`;
- `authority_index`.

### actor_resolution

Contains exactly:

- `mode`: `fixed | governed-project-bindings`;
- `eligible_profiles`: non-empty array for governed-project-bindings, or empty
  for fixed mode;
- `fixed_profile`: profile ID/path for fixed mode, otherwise null;
- `default_role`: role ID or null;
- `rule`: human-readable bounded selection rule.

### platform

Contains exactly:

- `id`: generic or project platform ID;
- `startup_constraints`: array of indispensable constraints unavailable from
  repository SoT before retrieval.

### constraints

Array of startup/fail-closed rules.

A bootstrap MUST direct retrieval to repository SoT and MUST NOT reproduce broad
methodology, product authority, task history, or complete role behavior.

Binding invariants:

- every eligible or fixed profile MUST resolve through the POP;
- every eligible role/profile represented by one bootstrap MUST resolve to the
  same concrete implementation identity and compatible platform represented by
  that bootstrap;
- `fixed_profile` MUST be non-null only in `fixed` mode and MUST be null in
  `governed-project-bindings` mode;
- `eligible_profiles` MUST be empty in `fixed` mode and non-empty in
  `governed-project-bindings` mode;
- `default_role`, when non-null, MUST resolve to an active POP binding compatible
  with the bootstrap;
- an explicitly selected role MUST be eligible under the POP and current
  separation-of-duty rules before the bounded operation begins.

## 6. Contract relationship

The version-scoped legacy v2 relationship is:

`canonical framework -> POP v2 -> Actor Profile + concrete implementation
and applicable Capability Profile bindings -> Platform Bootstrap v2 ->
bounded operation`

The v3 relationship is:

`canonical framework -> POP v3 role/Actor Profile policy ->
operation-scoped implementation attribution and capability proof sufficient
for the authorized boundary (with a Capability Profile when applicable) ->
separately authorized bounded operation`

A v3 Platform Bootstrap is optional startup/discovery configuration, never a
mandatory implementation registry or independent authorization source.

A Platform Bootstrap is derived configuration. An Actor Profile is reusable role
behavior. A Capability Profile is implementation-specific constraint. The POP is
the project binding that joins them.

None of these artifacts acquires product authority merely by being machine
readable.

## 7. Compatibility and evolution

A material incompatible contract change requires a new schema identifier.

A project adopting a later framework version reconciles its POP, profiles, and
bootstrap explicitly. Existing durable evidence keeps the schema/profile
identifiers applicable when it was produced.

## 8. Project Operating Profile v3 — stable role policy

Schema identifier: `dev-foundry.project-operating-profile.v3`.

The v3 contract preserves all v2 top-level required keys and scalar/repository/
framework/operator/policies/deviations constraints except that its schema
identifier is v3 and its `actor_bindings` and `platform_bootstraps` entries
are governed by this section. Unknown top-level keys remain invalid.

Each v3 `actor_bindings` map entry contains exactly:

- `profile`: approved, versioned Actor Profile ID/path;
- `selection`: object described below;
- `status`: `active | transitional | deferred`.

Each `selection` contains exactly:
- `mode`: MUST equal `operation-scoped`;
- `required_capabilities`: array of distinct stable capability identifiers,
  allowed to be empty where the role imposes no additional project capability;
- `eligibility_policy`: one non-empty project-owned authority reference or
  stable policy identifier. `operator-and-actor-fit` is the default basic policy
  only where the adopting project explicitly declares it.

No concrete implementation identity, provider, platform, model, or
task-specific binding is stored inside a v3 role binding. New eligible
implementations can be chosen for later operations without changing this POP.
The POP does not become a mandatory exhaustive registry of providers.

A v3 `platform_bootstraps` map uses the same `path` and `status`
shape as v2 but enumerates only repository-managed bootstrap records.
It is NOT an exhaustive list of all permitted platforms; an implementation
that can securely discover and verify the project authority through a
platform-local bootstrap need not register in the POP.

Role selection, capability fit, operation-specific authorization and sufficient
implementation attribution MUST all be resolved before execution. None implies
the others. A POP v3 is not itself evidence that any concrete platform is
eligible for a particular operation.

## 9. Platform Bootstrap v3 — startup, not platform authorization

Schema identifier: `dev-foundry.platform-bootstrap.v3`.

The existing v2 top-level fields remain required and closed. Subobjects
`repository`, `sources`, `platform`, and `constraints` retain their v2
fields and constraints. `actor_resolution` in v3 contains exactly:

- `mode`: `fixed | governed-project-bindings`;
- `eligible_profiles`: array of approved Actor Profile references; MUST be
  empty in fixed mode, and MAY be empty in governed-project-bindings mode only
  when role-based discovery retrieves all eligible profiles from POP v3;
- `fixed_profile`: nonempty approved Actor Profile reference in fixed mode
  and null in governed-project-bindings mode;
- `default_role`: role ID or null; when non-null it MUST identify an active
  POP v3 role compatible with the selected bootstrap and fixed profile if any;
- `rule`: bounded human-readable selection rule.

A v3 bootstrap may identify the current platform as a startup/connection
description, but this is NOT an exclusive role/platform grant. It MUST retrieve
repository authority and establish current operation-specific eligibility. The
v2 invariant that all eligible roles must resolve to the same POP-stored
concrete implementation applies only to v2. For v3, every eligible role
resolves to an applicable POP v3 Actor Profile and policy; an eligible concrete
implementation is chosen for one operation, and operation-specific eligibility
must be reassessed on a different platform. Unknown platforms are not authorized merely
because the schema accepts them.

Bootstrap copies that exist only within a platform may be derived from stable
repository locators without POP mutation. They are not additional methodology
authority.

## 10. Operation selection record and compatibility

An operation-selection record is runtime/evidence state, NOT a new mandatory
POP field. Its interoperable content MUST be able to bind:

- project/repository/framework and current Authority Index identity;
- role, Actor Profile reference, task/boundary identity and scope;
- concrete implementation kind/identity or sufficient attribution/platform,
  with trustworthy supporting evidence appropriate to the actual role and
  authorization or independence boundary;
- capability proof and applicable Capability Profile reference (if any);
- authorization source, allowed effects and hard exclusions;
- observed branch/HEAD and visible/hidden workspace changes;
- actual prior and current participation for independence;
- continuation/evidence/side-effect provenance where relevant.

A v2 binding is valid only under its original v2 semantics. Migration to v3 is
explicit, one-time, project-owned and authorized during framework adoption:
preserve role and Actor Profile; derive project-level required capability and
eligibility policy from independently verified requirements; carry current
concrete implementation and v1 Capability Profile into operation-scoped
candidate/proof records; do not treat the old implementation identity as an
exhaustive v3 allowlist. Migrate repository-managed v2 bootstraps only where
needed. Preserve old evidence and original operation bindings without rewriting
their meaning. Refuse an ambiguous or unverified migration.

Capability Profile v1 remains valid where its described implementation class
and limits match the selected operation. It can be reused across tasks. A
new task by itself is not a profile-version trigger. A profile proves only fit
and constraint, never role, permission, authorization, or implementation
identity trust.

DAT-022 defines readiness, diagnostics, outcomes and continuation semantics.
