# EVE Fabric — End-to-End Walkthrough

This guide demonstrates the full EVE Fabric lifecycle: browsing capabilities,
building pipelines, executing them, and publishing composites — both
programmatically and via curl.

## Prerequisites

```bash
node --version   # v20+
pnpm --version   # v9+
pnpm install
pnpm run build
```

## Quick Start (automated demo)

Run the full lifecycle in one command:

```bash
pnpm run demo
```

This starts a gateway server, walks through every API endpoint, and prints
annotated output. No external dependencies required — all data is in-memory.

## Manual Walkthrough (curl)

### 1. Start the gateway

```bash
pnpm --filter @eve-fabric/gateway dev
```

The server starts on `http://localhost:3456`.

### 2. Health check

```bash
curl http://localhost:3456/health
```

```json
{ "status": "ok" }
```

### 3. Browse the capability registry

List all capabilities:

```bash
curl http://localhost:3456/api/registry | jq '.capabilities[] | {id, version, source, name}'
```

Filter by data source:

```bash
# ESI capabilities (live EVE API)
curl "http://localhost:3456/api/registry?source=ESI"

# SDE capabilities (static data)
curl "http://localhost:3456/api/registry?source=SDE"

# Derived capabilities (computed)
curl "http://localhost:3456/api/registry?source=DERIVED"

# Composite capabilities (user-created pipelines)
curl "http://localhost:3456/api/registry?source=COMPOSITE"
```

Search by keyword:

```bash
curl "http://localhost:3456/api/registry?search=market"
```

### 4. Inspect a capability

```bash
curl http://localhost:3456/api/registry/market.orders | jq
```

Response includes inputs, outputs, auth requirements, cache policy, and
available versions.

### 5. Check version history and upgrades

```bash
# All versions of a capability
curl http://localhost:3456/api/registry/market.orders/versions

# Available upgrades from a specific version
curl "http://localhost:3456/api/registry/market.orders/upgrades?from=1.0.0"
```

### 6. View dependency trees

```bash
curl http://localhost:3456/api/registry/composite.trade.opportunity/dependencies | jq
```

Shows the full tree of capabilities a composite depends on — useful for
understanding blast radius of upgrades.

### 7. Save a pipeline

```bash
curl -X POST http://localhost:3456/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "id": "market.snapshot",
    "version": 1,
    "name": "Market Snapshot",
    "description": "Fetches and aggregates market data for an item in a region",
    "inputs": [
      {"name": "typeId", "semanticType": "eve.type.reference", "required": true},
      {"name": "regionId", "semanticType": "eve.region.reference", "required": true}
    ],
    "nodes": [
      {"id": "fetchOrders", "capability": {"id": "market.orders", "version": "1.0.0"}},
      {"id": "aggregate", "capability": {"id": "market.aggregate", "version": "1.0.0"}}
    ],
    "edges": [
      {"from": "input.typeId", "to": "fetchOrders.typeId"},
      {"from": "input.regionId", "to": "fetchOrders.regionId"},
      {"from": "fetchOrders.orders", "to": "aggregate.orders"}
    ],
    "outputs": [
      {"name": "orders", "source": "fetchOrders.orders"},
      {"name": "summary", "source": "aggregate.summary"}
    ]
  }'
```

Response:

```json
{ "id": "pipeline-1724025600000", "version": 1, "savedAt": "2026-08-19T..." }
```

Save the returned `id` — you'll need it for publishing.

### 8. List and retrieve saved pipelines

```bash
# List all
curl http://localhost:3456/api/pipelines

# Get a specific pipeline
curl http://localhost:3456/api/pipelines/<pipeline-id>
```

### 9. Execute a pipeline

```bash
curl -X POST http://localhost:3456/api/pipelines/execute \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "nodes": [
        {"id": "fetchOrders"},
        {"id": "aggregate"}
      ]
    },
    "inputs": {
      "typeId": 34,
      "regionId": 10000002
    }
  }'
```

Response includes outputs, per-step status, and execution metrics:

```json
{
  "outputs": { "typeId": 34, "regionId": 10000002 },
  "metrics": {
    "totalDurationMs": 200,
    "stepDurations": { "fetchOrders": 100, "aggregate": 100 },
    "cacheHits": 0,
    "cacheMisses": 2
  },
  "stepStatuses": { "fetchOrders": "completed", "aggregate": "completed" },
  "errors": []
}
```

> **Note:** The gateway currently uses a mock executor that echoes inputs.
> Real ESI integration returns live EVE Online market data.

### 10. Publish a pipeline as a composite capability

This is the key feature — turning a pipeline into a reusable building block:

```bash
curl -X POST http://localhost:3456/api/registry/publish \
  -H "Content-Type: application/json" \
  -d '{
    "capabilityId": "custom.market.snapshot",
    "version": "1.0.0",
    "name": "Custom Market Snapshot",
    "description": "Custom market data aggregation",
    "pipelineId": "<pipeline-id>",
    "pipelineVersion": 1,
    "selectedInputs": ["typeId", "regionId"],
    "selectedOutputs": ["orders", "summary"]
  }'
```

Replace `<pipeline-id>` with the id from step 7.

### 11. Verify the composite exists

```bash
curl http://localhost:3456/api/registry/custom.market.snapshot | jq
```

Your published composite now appears alongside built-in capabilities. Other
pipelines can reference it by id, enabling layered composition.

### 12. GraphQL

The gateway also exposes a GraphQL endpoint:

```bash
curl -X POST http://localhost:3456/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health }"}'
```

### 13. Clean up

```bash
curl -X DELETE http://localhost:3456/api/pipelines/<pipeline-id>
```

## Visual Designer

For a GUI experience, run both the gateway and designer:

```bash
# Terminal 1: Gateway API
pnpm --filter @eve-fabric/gateway dev

# Terminal 2: React designer
pnpm --filter @eve-fabric/designer dev
```

Open http://localhost:5173. The designer provides:

- **Capability palette** — drag capabilities onto the canvas
- **Visual wiring** — connect outputs to inputs with semantic type checking
- **Live diagnostics** — cycle detection, type mismatches, version conflicts
- **Execution** — run pipelines and see results
- **YAML import/export** — load the example pipelines from `examples/`
- **Publish** — promote a pipeline to a composite capability in the registry
- **Composite drilldown** — click into composites to see their internal wiring

### Designer demo flow

1. Drag `market.orders` and `market.aggregate` onto the canvas
2. Wire `fetchOrders.orders` → `aggregate.orders`
3. Click **Validate** — diagnostics panel shows green
4. Click **Execute** with inputs `typeId: 34`, `regionId: 10000002`
5. View results in the **Results** tab
6. Click **Export YAML** to save the pipeline definition
7. Click **Publish** to register it as a composite capability

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Designer (React)                │
│  Canvas → Compiler → Planner → Executor → UI    │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│                 Gateway (Fastify)                 │
│  /api/registry   /api/pipelines   /graphql       │
│     │                │                │          │
│  Registry      Pipeline CRUD      GraphQL Yoga   │
│  (in-memory)   (in-memory)        (schema gen)   │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌──────▼─────┐ ┌─────▼─────┐
   │   ESI   │  │    SDE     │ │  DERIVED   │
   │ Adapter │  │  Adapter   │ │ Functions  │
   └─────────┘  └────────────┘ └───────────┘
```

## Example Pipelines

| Example              | Nodes | Description               |
| -------------------- | ----- | ------------------------- |
| `market-schema/`     | 2     | Market orders → aggregate |
| `route-schema/`      | 3     | Route distance calculator |
| `trade-opportunity/` | 4     | Multi-region trade finder |

Import any of these via the designer's **Import YAML** button or load them
programmatically through the pipeline API.
