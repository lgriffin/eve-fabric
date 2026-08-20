# Gateway API Contracts: Intent-Driven Interactive Flow Designer

**Branch**: `005-intent-flow-designer` | **Date**: 2026-08-20

## New Endpoints

### POST /api/capabilities/:id/execute

Execute a single capability with provided input values. Used by the designer's "Test" button for individual node execution.

**Request**:

```json
{
  "inputs": {
    "region": { "value": 10000002, "semanticType": "eve.region.reference" },
    "item": { "value": 34, "semanticType": "eve.type.reference" },
    "order_type": { "value": "sell", "semanticType": "string" }
  }
}
```

**Response (success)**:

```json
{
  "status": "success",
  "capabilityId": "market.orders",
  "durationMs": 342,
  "source": "ESI",
  "cached": false,
  "resultCount": 1284,
  "preview": [
    { "order_id": 6204861264, "price": 4.5, "volume_remain": 50000, "location_id": 60003760 },
    { "order_id": 6204861265, "price": 4.52, "volume_remain": 30000, "location_id": 60003760 }
  ],
  "provenance": {
    "source": "ESI",
    "retrievedAt": "2026-08-20T10:30:00Z",
    "cached": false
  }
}
```

**Response (error)**:

```json
{
  "status": "error",
  "capabilityId": "market.orders",
  "error": "Missing required input: region",
  "code": "MISSING_INPUT"
}
```

**Notes**:

- The endpoint resolves the capability from the registry, builds a single-step ExecutionPlan, and runs it through the existing Executor
- Input values are validated against the capability's declared semantic port types
- The `preview` field contains a limited sample (first 10 items for collections)
- `resultCount` represents the total count, not the preview sample size

---

### GET /api/reference/items

Search EVE items by name for the searchable selector input editor.

**Query parameters**:

- `q` (string, required): Search substring (minimum 2 characters)
- `limit` (number, optional, default 20): Maximum results

**Response**:

```json
{
  "items": [
    { "id": 34, "name": "Tritanium" },
    { "id": 35, "name": "Pyerite" },
    { "id": 36, "name": "Mexallon" }
  ]
}
```

**Notes**:

- Case-insensitive substring match on item name
- SDE-sourced, aggressively cacheable (Constitution XIV)
- Returns published items only (no unpublished market groups)

---

### GET /api/reference/regions

List all EVE regions for the searchable selector. Full list (~100 entries), no pagination.

**Response**:

```json
{
  "regions": [
    { "id": 10000002, "name": "The Forge" },
    { "id": 10000043, "name": "Domain" },
    { "id": 10000032, "name": "Sinq Laison" }
  ]
}
```

**Notes**:

- Returns all known-space regions sorted alphabetically
- SDE-sourced, aggressively cacheable

---

### GET /api/reference/systems

Search EVE solar systems by name.

**Query parameters**:

- `q` (string, required): Search substring (minimum 2 characters)
- `limit` (number, optional, default 20): Maximum results

**Response**:

```json
{
  "systems": [
    { "id": 30000142, "name": "Jita" },
    { "id": 30000144, "name": "Perimeter" }
  ]
}
```

**Notes**:

- Case-insensitive substring match on system name
- SDE-sourced, aggressively cacheable

---

## Modified Endpoints

### POST /api/pipelines/execute (existing — must be implemented)

The existing endpoint is currently a stub that returns mock data. For feature 005, this must be implemented to perform real execution through the Executor.

**Current behavior**: Returns inputs as outputs with simulated step completion.

**Required behavior**: Resolves the pipeline's capabilities, compiles via the Compiler, creates an ExecutionPlan, executes via the Executor with real source adapters, and returns per-step statuses, metrics, outputs, and provenance.

**Response contract** (unchanged from current stub shape, but with real data):

```json
{
  "status": "completed",
  "steps": [
    {
      "stepId": "market-orders",
      "capabilityId": "market.orders",
      "status": "completed",
      "durationMs": 342,
      "cached": false
    }
  ],
  "outputs": { ... },
  "metrics": {
    "totalDurationMs": 1250,
    "parallelDurationMs": 890,
    "cacheHits": 1,
    "cacheMisses": 4
  }
}
```

---

## Existing Endpoints Used (no changes)

These existing endpoints are consumed by the new designer features but require no modifications:

- `GET /api/registry` — Catalog listing for All Capabilities palette mode
- `POST /api/discovery/search` — Keyword search for Discover palette mode
- `POST /api/discovery/suggest` — Context-aware suggestions for Recommended mode and contextual palette
- `GET /api/discovery/consumers/:semanticType` — Compatible port highlighting during connection drag
- `POST /api/discovery/auto-complete` — May be used for future flow-completion suggestions
