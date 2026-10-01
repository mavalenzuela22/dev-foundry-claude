---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-001
  type: DAT
  title: Governed Operation Resolver Contract
  status: ACTIVE
artifactVersion: "1"
authorityScope: dev-foundry-claude-governed-operation-resolver-contract
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-operation-resolver-input
    - governed-operation-resolver-output
    - governed-operation-resolver-errors
    - governed-operation-context-fingerprint
  appliesTo:
    capabilities:
      - claude-governance-mcp
    tasks:
      - TSK-002
  excludes:
    - generic-mcp-runtime-contracts
    - execution-contract-schema
    - repository-transaction-schema
authority:
  governedBy:
    - SPC-001
    - ADR-002
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 60 [DAT-001] dev-foundry-claude - Governed Operation Resolver Contract

## 1. Purpose

Define the closed project contract for the Claude governance MCP tool
`resolve_governed_operation`.

This contract is product authority for TSK-002. It does not redefine MCP itself
or DEV FOUNDRY reusable methodology.

## 2. Tool name

Exact MCP tool name:

`resolve_governed_operation`

TSK-002 exposes no other MCP tool.

## 3. Input contract

The tool input is an object. Unknown fields are rejected.

Required:

- `requestedAction`: one of
  `inspect | author | implement | validate | audit | promote | close`;
- `targetProject`: non-empty string.

Optional:

- `taskId`: string matching
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`;
- `boundaryId`: string matching the same pattern;
- `requestedRole`: non-empty string;
- `expectedContextFingerprint`: lowercase 64-character hexadecimal SHA-256.

Cross-field rules:

- at least one of `taskId` or `boundaryId` is required;
- `requestedAction: implement` requires `taskId`.

## 4. Success payload

A successful result is JSON with exactly these top-level fields:

- `ok`: `true`;
- `message`: concise string;
- `resolution`: object.

`resolution` contains exactly:

- `targetProject`: string;
- `frameworkVersion`: string;
- `requestedAction`: requested action;
- `taskId`: string or omitted;
- `boundaryId`: string or omitted;
- `role`: object;
- `authority`: array;
- `requiredAssessments`: array of stable strings;
- `requiredGates`: array of stable strings;
- `contextFingerprint`: lowercase 64-character SHA-256.

`role` contains exactly:

- `id`: selected project role ID;
- `actorProfilePath`: repository-relative path;
- `capabilityProfilePaths`: array of repository-relative paths.

Each `authority` entry contains exactly:

- `id`: resolved artifact/configured authority identifier;
- `path`: repository-relative path;
- `authorityClass`: one of
  `methodology | product | configured | decision | task | profile`;
- `sha256`: lowercase 64-character SHA-256;
- `sectionId`: stable section ID or null.

The authority array is sorted lexicographically by `path`.

## 5. Failure payload

A failed result is JSON with exactly:

- `ok`: `false`;
- `errorCode`: stable code;
- `message`: concise string.

Allowed `errorCode` values:

- `INVALID_REQUEST`;
- `TARGET_MISMATCH`;
- `UNSUPPORTED_FRAMEWORK`;
- `AUTHORITY_INVALID`;
- `ROLE_INELIGIBLE`;
- `STALE_CONTEXT`;
- `READ_FAILED`.

A failure MUST NOT include a partial success resolution.

## 6. MCP result representation

The MCP tool result SHALL contain one text content item whose text is the exact
JSON serialization of the success or failure payload.

The server SHALL not emit repository document bodies in normal tool output.

## 7. Required assessment identifiers

TSK-002 supports these output identifiers:

- `boundary_state`;
- `validation_coverage`;
- `audit_trigger`;
- `audit_disposition`;
- `authorization_intent`;
- `failure_causality`;
- `closure_readiness`;
- `executor_fit`;
- `projection_reconciliation`.

The resolver returns only those applicable to the requested action.

## 8. Required gate identifiers

TSK-002 supports these output identifiers:

- `authority_resolved`;
- `executor_fit`;
- `implementation_self_verification`;
- `projection_reconciliation_if_needed`;
- `mechanical_validation`;
- `semantic_self_assessment`;
- `independent_audit_if_triggered`;
- `operator_authorization`;
- `promotion_state_revalidation`;
- `closure_evidence`.

These are routing identifiers for applicable adopted methodology. They do not
replace the referenced authority.

## 9. Context fingerprint contract

The selector prefix is the following seven lines in this exact order:

`requestedAction=<value>`
`targetProject=<value>`
`taskId=<value-or-empty>`
`boundaryId=<value-or-empty>`
`requestedRole=<value-or-empty>`
`frameworkVersion=<resolved-version>`
`role=<resolved-role-id>`

The prefix is followed by one line for each exact resolution source, sorted by
repository-relative path:

`source=<path><TAB><lowercase-sha256>`

Every line ends in LF, including the final line.

`contextFingerprint` is the lowercase hexadecimal SHA-256 of the resulting
UTF-8 byte sequence.

Changing any selector, selected role, framework version, or resolution source
bytes changes the fingerprint.

## 10. Compatibility

The initial contract version is `1`.

A backward-incompatible input, output, error, or fingerprint change requires a
new DAT artifact version or explicit successor contract before implementation.
