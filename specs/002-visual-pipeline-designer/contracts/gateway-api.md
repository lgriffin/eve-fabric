# Gateway API Contract: Visual Pipeline Designer

**Feature**: 002-visual-pipeline-designer  
**Date**: 2026-08-19

## Overview

The designer communicates with the EVE Fabric gateway via a REST API. Existing endpoints for capability catalog access are already in use. This contract defines additional endpoints required for pipeline execution, persistence, and schema generation.

## Existing Endpoints (no changes)

### GET /api/capabilities

Returns all registered capabilities from the catalog.

**Response**: Array of capability definitions with id, name, description, source, inputs, outputs, auth, cache, and cost.

## New Endpoints

### POST /api/pipelines/compile

Compiles a pipeline definition and returns diagnostics, execution plan, and generated GraphQL SDL.

**Request body**: Pipeline definition in YAML format (Content-Type: text/yaml) or JSON format (Content-Type: application/json).

**Response** (200):

```
{
  "success": boolean,
  "diagnostics": CompilerDiagnostic[],
  "plan": ExecutionPlan | null,
  "graphqlSdl": string | null
}
```

**Error responses**:

- 400: Malformed pipeline definition (parse error)

**Notes**: This endpoint is optional — the designer can compile client-side using the bundled compiler. It exists for consistency and for clients that cannot bundle the compiler.

### POST /api/pipelines/execute

Executes a compiled pipeline against configured data sources.

**Request body**:

```
{
  "pipeline": PipelineDefinition,
  "inputs": Record<string, unknown>
}
```

**Response** (200):

```
{
  "outputs": Record<string, unknown>,
  "provenance": Record<string, ProvenanceRecord>,
  "metrics": {
    "totalDurationMs": number,
    "stepDurations": Record<string, number>,
    "cacheHits": number,
    "cacheMisses": number
  },
  "stepStatuses": Record<string, "completed" | "failed" | "skipped">,
  "errors": Array<{ stepId: string, message: string, code: string }>
}
```

**Error responses**:

- 400: Invalid pipeline (compilation fails)
- 401: Missing required authentication scopes
- 502: Data source unavailable

### GET /api/pipelines/execute/stream

Same as POST /api/pipelines/execute but streams execution progress via Server-Sent Events (SSE).

**Query parameters**: Pipeline and inputs provided as query parameters or via initial POST handshake.

**SSE Event types**:

- `step:queued` — `{ stepId, capability }`
- `step:executing` — `{ stepId, capability }`
- `step:completed` — `{ stepId, durationMs, cached, provenance }`
- `step:failed` — `{ stepId, error }`
- `step:skipped` — `{ stepId, reason }`
- `execution:completed` — `{ outputs, metrics }`
- `execution:failed` — `{ error }`

### POST /api/pipelines

Saves a pipeline definition with metadata.

**Request body**: Pipeline definition in YAML format with optional layout metadata.

**Response** (201):

```
{
  "id": string,
  "version": number,
  "name": string,
  "savedAt": string
}
```

### GET /api/pipelines

Lists saved pipelines.

**Response** (200):

```
[
  {
    "id": string,
    "version": number,
    "name": string,
    "description": string,
    "savedAt": string
  }
]
```

### GET /api/pipelines/:id

Loads a specific saved pipeline by ID.

**Response** (200): Full pipeline definition in YAML or JSON (based on Accept header), including layout metadata.

**Error responses**:

- 404: Pipeline not found

### DELETE /api/pipelines/:id

Deletes a saved pipeline.

**Response** (204): No content.

**Error responses**:

- 404: Pipeline not found

### POST /api/pipelines/:id/export

Exports a pipeline as a downloadable schema package.

**Response** (200): Pipeline YAML file (Content-Disposition: attachment).

## Error Response Format

All error responses follow a consistent format:

```
{
  "error": {
    "code": string,
    "message": string,
    "details": unknown | null
  }
}
```

Error codes align with Constitution Principle XXIII (Error Model):

- `PARSE_ERROR` — malformed input
- `COMPILATION_ERROR` — semantic composition error
- `CAPABILITY_NOT_FOUND` — referenced capability missing from catalog
- `AUTH_REQUIRED` — missing authentication scope
- `SOURCE_UNAVAILABLE` — ESI/SDE source unreachable
- `SOURCE_RATE_LIMITED` — ESI rate limit exceeded
- `EXECUTION_FAILED` — runtime execution failure
- `NOT_FOUND` — requested resource does not exist
