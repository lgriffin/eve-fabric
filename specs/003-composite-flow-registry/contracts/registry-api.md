# API Contracts: Fabric Registry & Publish

**Branch**: `003-composite-flow-registry` | **Date**: 2026-08-19

## Registry API

### GET /api/registry

List all capabilities in the Fabric Registry. The designer's Capability Palette consumes this endpoint.

**Query parameters**:

| Parameter | Type    | Default | Description                                                    |
| --------- | ------- | ------- | -------------------------------------------------------------- |
| source    | string  | (all)   | Filter by classification: `ESI`, `SDE`, `DERIVED`, `COMPOSITE` |
| search    | string  | (none)  | Full-text search across name and description                   |
| latest    | boolean | true    | When true, return only the latest version of each capability   |

**Response** (200):

```json
{
  "capabilities": [
    {
      "id": "market.orders",
      "version": "1.0.0",
      "name": "Market Orders",
      "description": "Fetch market orders for an item in a region",
      "source": "ESI",
      "inputs": [
        { "name": "region", "semanticType": "eve.region.reference", "required": true },
        { "name": "item", "semanticType": "eve.type.reference", "required": true }
      ],
      "outputs": [{ "name": "orders", "semanticType": "eve.market.order.collection" }],
      "auth": { "requiredScopes": [] },
      "cache": { "cacheable": true, "ttlSeconds": 300 },
      "isComposite": false
    },
    {
      "id": "custom.nearby-market-search",
      "version": "1.0.0",
      "name": "Nearby Market Search",
      "description": "Find nearby market listings within a jump range",
      "source": "COMPOSITE",
      "inputs": [
        { "name": "item", "semanticType": "eve.type.reference", "required": true },
        { "name": "origin", "semanticType": "eve.solarsystem.reference", "required": true },
        { "name": "maxJumps", "semanticType": "eve.distance", "required": true }
      ],
      "outputs": [
        { "name": "location", "semanticType": "eve.location.reference" },
        { "name": "price", "semanticType": "eve.isk" },
        { "name": "distance", "semanticType": "eve.distance" }
      ],
      "auth": { "requiredScopes": ["esi-markets.structure_markets.v1"] },
      "cache": { "cacheable": true, "ttlSeconds": 300 },
      "isComposite": true
    }
  ]
}
```

---

### GET /api/registry/:id

Get a specific capability, optionally at a specific version.

**Path parameters**:

| Parameter | Type   | Description                                        |
| --------- | ------ | -------------------------------------------------- |
| id        | string | Capability ID (dot-notation, e.g. `market.orders`) |

**Query parameters**:

| Parameter | Type   | Default  | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| version   | string | (latest) | Specific semver version to retrieve |

**Response** (200):

```json
{
  "id": "custom.nearby-market-search",
  "version": "1.0.0",
  "name": "Nearby Market Search",
  "source": "COMPOSITE",
  "inputs": [ ... ],
  "outputs": [ ... ],
  "dependencies": [
    { "id": "universe.resolveType", "version": "1.0.0" },
    { "id": "market.orders", "version": "1.0.0" },
    { "id": "universe.resolveLocation", "version": "1.0.0" },
    { "id": "navigation.routeDistance", "version": "1.0.0" }
  ],
  "versions": ["1.0.0"],
  "upgrades": []
}
```

**Response** (404):

```json
{
  "error": "CAPABILITY_NOT_FOUND",
  "message": "Capability 'custom.nearby-market-search' not found"
}
```

---

### GET /api/registry/:id/versions

List all published versions of a capability.

**Response** (200):

```json
{
  "id": "custom.nearby-market-search",
  "versions": [
    { "version": "1.0.0", "publishedAt": "2026-08-19T10:00:00Z" },
    { "version": "1.1.0", "publishedAt": "2026-08-20T14:30:00Z" }
  ]
}
```

---

### GET /api/registry/:id/dependencies

Get the dependency tree for a capability.

**Response** (200):

```json
{
  "id": "custom.trade-opportunity",
  "version": "1.0.0",
  "source": "COMPOSITE",
  "children": [
    {
      "id": "custom.market-snapshot",
      "version": "1.0.0",
      "source": "COMPOSITE",
      "children": [
        { "id": "universe.resolveType", "version": "1.0.0", "source": "ESI", "children": [] },
        { "id": "market.orders", "version": "1.0.0", "source": "ESI", "children": [] }
      ]
    },
    {
      "id": "custom.route-analysis",
      "version": "1.0.0",
      "source": "COMPOSITE",
      "children": [ ... ]
    },
    {
      "id": "custom.hauling-cost",
      "version": "1.0.0",
      "source": "COMPOSITE",
      "children": [ ... ]
    }
  ]
}
```

---

## Publish API

### POST /api/registry/publish

Publish a validated Fabric Flow as a new composite capability.

**Request body**:

```json
{
  "capabilityId": "custom.nearby-market-search",
  "version": "1.0.0",
  "name": "Nearby Market Search",
  "description": "Find nearby market listings within a jump range",
  "pipelineId": "pipeline-abc-123",
  "pipelineVersion": 1,
  "selectedInputs": ["item", "origin", "maxJumps"],
  "selectedOutputs": ["location", "price", "distance"]
}
```

**Response** (201 — success):

```json
{
  "success": true,
  "capability": {
    "id": "custom.nearby-market-search",
    "version": "1.0.0",
    "name": "Nearby Market Search",
    "source": "COMPOSITE",
    "inputs": [ ... ],
    "outputs": [ ... ]
  },
  "diagnostics": []
}
```

**Response** (400 — validation failure):

```json
{
  "success": false,
  "diagnostics": [
    {
      "severity": "error",
      "code": "PIPELINE_INVALID",
      "message": "Pipeline validation failed: semantic type mismatch between 'resolveType.output' and 'marketOrders.region'"
    }
  ]
}
```

**Response** (409 — version conflict):

```json
{
  "success": false,
  "diagnostics": [
    {
      "severity": "error",
      "code": "VERSION_EXISTS",
      "message": "Version 1.0.0 of 'custom.nearby-market-search' already exists. Published versions are immutable."
    }
  ]
}
```

**Response** (400 — circular dependency):

```json
{
  "success": false,
  "diagnostics": [
    {
      "severity": "error",
      "code": "CIRCULAR_DEPENDENCY",
      "message": "Publishing would create a circular dependency: custom.nearby-market-search -> custom.trade-opportunity -> custom.nearby-market-search"
    }
  ]
}
```

---

## Error Codes

| Code                 | HTTP Status | Description                                     |
| -------------------- | ----------- | ----------------------------------------------- |
| CAPABILITY_NOT_FOUND | 404         | Requested capability does not exist in registry |
| VERSION_NOT_FOUND    | 404         | Requested version does not exist                |
| PIPELINE_NOT_FOUND   | 400         | Referenced pipeline does not exist              |
| PIPELINE_INVALID     | 400         | Pipeline fails compiler validation              |
| VERSION_EXISTS       | 409         | Immutable version already published             |
| CIRCULAR_DEPENDENCY  | 400         | Publication would create a dependency cycle     |
| INVALID_INPUTS       | 400         | Selected inputs not found in pipeline           |
| INVALID_OUTPUTS      | 400         | Selected outputs not found in pipeline          |
| INVALID_VERSION      | 400         | Version string is not valid semver              |
