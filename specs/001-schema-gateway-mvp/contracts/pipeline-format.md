# Contract: Pipeline Definition Format

**Version**: 1.0.0

## Overview

A pipeline definition describes a directed acyclic graph of
capability connections. It is the primary composition artifact.

## Format

```yaml
id: trade-opportunity               # Required. Unique identifier.
version: 1                          # Required. Positive integer.
name: Trade Opportunity              # Required. Human-readable.
description: >                      # Optional.
  Find cheapest market orders within
  a specified jump range.

inputs:                              # Required. Pipeline-level inputs.
  item:
    type: eve.type.reference
    description: Item to search for
    required: true
  region:
    type: eve.region.reference
    required: true
  origin:
    type: eve.system.reference
    required: true
  maxJumps:
    type: eve.route.distance
    required: false

nodes:                               # Required. At least one.
  - id: resolve-item                 # Required. Unique within pipeline.
    capability: universe.resolveType # Required. Registered capability ID.
    config: {}                       # Optional. Static configuration.

  - id: orders
    capability: market.orders

  - id: aggregate
    capability: market.aggregate

edges:                               # Required (may be empty for single-node).
  - from: input.item                 # Format: "input.{name}" or "{nodeId}.{portName}"
    to: resolve-item.item            # Format: "{nodeId}.{portName}"

  - from: resolve-item.type
    to: orders.item

  - from: input.region
    to: orders.region

  - from: orders.orders
    to: aggregate.orders

outputs:                             # Required. At least one.
  sellPrice: aggregate.lowestSell    # Format: "{nodeId}.{portName}"
  buyPrice: aggregate.highestBuy
```

## Port Reference Format

Port references use dot-notation: `{source}.{port}`.

| Source | Format | Example |
|--------|--------|---------|
| Pipeline input | `input.{name}` | `input.item` |
| Node output | `{nodeId}.{portName}` | `resolve-item.type` |

## Validation Rules

1. Graph MUST be acyclic.
2. All edges MUST connect semantically compatible ports.
3. All `capability` references MUST exist in the catalog.
4. All port references MUST exist on the referenced node/input.
5. All pipeline inputs MUST be consumed by at least one edge.
6. All required capability inputs MUST have an incoming edge.
7. `id` + `version` MUST be unique.

## Compilation

Pipelines are compiled via the schema compiler's 12-step process.
The compiler produces an immutable `ExecutionPlan` or a list of
`CompilerDiagnostic` errors.
