# Quickstart: EVE Schema Gateway MVP

**Branch**: `001-schema-gateway-mvp`
**Date**: 2026-08-19

## Prerequisites

- Node.js 20 LTS or later
- pnpm 9.x or later
- Git

## Setup

```bash
# Clone and install
git clone https://github.com/lgriffin/eve-fabric.git
cd eve-fabric
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Project Layout

```text
apps/gateway/         → Fastify server serving GraphQL
apps/designer/        → React visual pipeline designer
packages/domain/      → Core domain model (no external deps)
packages/compiler/    → Semantic pipeline compiler
packages/planner/     → Execution plan optimizer
packages/executor/    → Plan execution engine
packages/graphql/     → GraphQL schema generation (Pothos)
packages/esi-adapter/ → ESI.ts infrastructure adapter
packages/sde-adapter/ → SDE infrastructure adapter
packages/cache/       → Cache abstraction
packages/persistence/ → SQLite + Drizzle ORM
packages/schema-package/ → Schema export/import
packages/test-support/   → Shared test utilities
examples/             → Reference schemas
```

## Define a Capability

```typescript
import { defineCapability } from '@eve-fabric/capability-sdk';

const marketOrders = defineCapability({
  id: 'market.orders',
  version: 1,
  name: 'Market Orders',
  description: 'Fetch market orders for an item in a region',
  inputs: {
    region: { type: 'eve.region.reference', required: true },
    item: { type: 'eve.type.reference', required: true },
  },
  outputs: {
    orders: { type: 'eve.market.order.collection' },
  },
  source: 'ESI',
  dependencies: ['universe.resolveRegion', 'universe.resolveType'],
  auth: { required: true, scopes: ['esi-markets.structure_markets.v1'] },
  cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true },
  cost: { estimatedLatencyMs: 500, esiCallCount: 1 },
});
```

## Compose a Pipeline

```yaml
# trade-opportunity.pipeline.yaml
id: trade-opportunity
version: 1
name: Trade Opportunity

inputs:
  item:
    type: eve.type.reference
  region:
    type: eve.region.reference
  origin:
    type: eve.system.reference
  maxJumps:
    type: eve.route.distance

nodes:
  - id: resolve-item
    capability: universe.resolveType
  - id: orders
    capability: market.orders
  - id: aggregate
    capability: market.aggregate
  - id: resolve-location
    capability: universe.resolveLocation
  - id: route
    capability: route.distance
  - id: filter-distance
    capability: collection.filter
  - id: sort-price
    capability: collection.sort

edges:
  - from: input.item
    to: resolve-item.item
  - from: resolve-item.type
    to: orders.item
  - from: input.region
    to: orders.region
  - from: orders.orders
    to: aggregate.orders
  - from: orders.orders
    to: resolve-location.location
  - from: resolve-location.system
    to: route.destination
  - from: input.origin
    to: route.origin
  - from: route.distance
    to: filter-distance.value
  - from: input.maxJumps
    to: filter-distance.threshold
  - from: filter-distance.result
    to: sort-price.collection

outputs:
  opportunities: sort-price.result
```

## Compile and Run

```bash
# Start the gateway
pnpm --filter gateway dev

# The gateway starts on http://localhost:3000/graphql
```

## Query via GraphQL

```graphql
query {
  tradeOpportunity(item: "Tritanium", region: "The Forge", origin: "Jita", maxJumps: 5) {
    item {
      name
    }
    location {
      name
    }
    price
    jumps
  }
}
```

## Run the Visual Designer

```bash
pnpm --filter designer dev

# Opens on http://localhost:5173
```

The designer provides:

- Searchable capability palette (left panel)
- Drag-and-drop canvas with typed ports
- Real-time semantic validation
- GraphQL preview, execution plan preview, and diagnostics
  (bottom panels)

## Run Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @eve-fabric/compiler test

# BDD scenarios
pnpm --filter @eve-fabric/domain test:bdd

# Mutation testing (compiler + planner)
pnpm --filter @eve-fabric/compiler test:mutation
```

## Export a Schema Package

```bash
pnpm --filter gateway schema:export --name trade-opportunity --output ./exports/
```

Produces a directory:

```text
exports/trade-opportunity/
├── schema.graphql
├── pipeline.yaml
├── mappings.yaml
├── policies.yaml
├── metadata.yaml
└── README.md
```

## Import a Schema Package

```bash
pnpm --filter gateway schema:import ./exports/trade-opportunity/
```

The gateway validates capability availability and version
compatibility before activating the imported schema.
