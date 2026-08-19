# Contract: Compiler Diagnostics Format

**Version**: 1.0.0

## Overview

The semantic compiler produces diagnostics for all validation and
compilation errors. Diagnostics are both human-readable (for
developer consumption) and machine-readable (for tooling, designer,
and AI consumption).

## Diagnostic Structure

```typescript
interface CompilerDiagnostic {
  code: string;           // Machine-readable code
  severity: 'error' | 'warning' | 'info';
  message: string;        // Human-readable message
  location?: {
    nodeId?: string;       // Pipeline node involved
    edgeFrom?: string;     // Source port reference
    edgeTo?: string;       // Target port reference
    field?: string;        // Specific field
  };
  context?: {
    expectedType?: string; // Expected semantic type
    actualType?: string;   // Actual semantic type
    capability?: string;   // Capability ID
    suggestion?: string;   // Suggested fix or intermediate capability
  };
}
```

## Error Codes

### Schema Errors (SCHEMA_*)

| Code | Message Pattern |
|------|-----------------|
| `SCHEMA_INVALID_STRUCTURE` | Pipeline definition is structurally invalid: {details} |
| `SCHEMA_MISSING_FIELD` | Required field '{field}' is missing on {entity} |
| `SCHEMA_INVALID_FORMAT` | Field '{field}' has invalid format: expected {expected}, got {actual} |

### Semantic Errors (SEMANTIC_*)

| Code | Message Pattern |
|------|-----------------|
| `SEMANTIC_TYPE_MISMATCH` | Cannot connect {from} to {to}: {fromType} is not compatible with {toType} |
| `SEMANTIC_UNREGISTERED_TYPE` | Semantic type '{typeId}' is not registered |
| `SEMANTIC_SUGGESTION` | Suggested intermediate: {capability} converts {fromType} to {toType} |

### Capability Errors (CAPABILITY_*)

| Code | Message Pattern |
|------|-----------------|
| `CAPABILITY_NOT_FOUND` | Capability '{capabilityId}' is not registered in the catalog |
| `CAPABILITY_VERSION_MISMATCH` | Capability '{id}' version {requested} not found; available: {available} |
| `CAPABILITY_MISSING_INPUT` | Required input '{port}' on capability '{id}' has no incoming edge |

### Graph Errors (GRAPH_*)

| Code | Message Pattern |
|------|-----------------|
| `GRAPH_CYCLE_DETECTED` | Cyclic dependency detected: {cycle path} |
| `GRAPH_UNREACHABLE_NODE` | Node '{nodeId}' is unreachable from pipeline inputs |
| `GRAPH_UNUSED_INPUT` | Pipeline input '{name}' is not consumed by any edge |

### Auth Errors (AUTH_*)

| Code | Message Pattern |
|------|-----------------|
| `AUTH_MISSING_SCOPE` | Capability '{id}' requires scope '{scope}' which is not available |
| `AUTH_SCOPE_SUMMARY` | Pipeline requires scopes: {scopeList} |

## Severity Rules

- **error**: Pipeline cannot be compiled or executed. Blocks
  plan generation.
- **warning**: Pipeline is valid but may produce unexpected results
  (e.g., unused nodes, redundant edges).
- **info**: Informational (e.g., suggested optimizations, conversion
  suggestions).

## Suggestion System

When a `SEMANTIC_TYPE_MISMATCH` error is produced, the compiler
queries the catalog for capabilities that:
1. Accept the source port's semantic type as input.
2. Produce the target port's semantic type as output.

If one or more bridging capabilities are found, a `SEMANTIC_SUGGESTION`
info diagnostic is appended with the suggested capability ID.
