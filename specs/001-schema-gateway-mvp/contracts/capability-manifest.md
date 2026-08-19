# Contract: Capability Manifest Format

**Version**: 1.0.0

## Overview

A capability manifest defines one independently executable data
operation. It is the unit of composition in the gateway.

## Format

Manifests are authored in YAML and validated at registration time
using Zod schemas.

```yaml
id: market.orders                    # Required. Dot-notation unique ID.
version: 1                           # Required. Positive integer.
name: Market Orders                  # Required. Human-readable.
description: >                       # Required.
  Fetch current market orders for a given
  item type in a specific region.

inputs:                              # Required. May be empty for source-only.
  region:
    type: eve.region.reference       # Required. Registered semantic type ID.
    description: Target region       # Optional.
    required: true                   # Optional. Default: true.
  item:
    type: eve.type.reference
    required: true

outputs:                             # Required. At least one.
  orders:
    type: eve.market.order.collection
    description: List of market orders

source: ESI                          # Required. ESI | SDE | DERIVED | CACHE | COMPOSITE

dependencies:                        # Optional.
  - universe.resolveRegion
  - universe.resolveType

auth:                                # Required.
  required: true
  scopes:
    - esi-markets.structure_markets.v1

cache:                               # Required.
  cacheable: true
  defaultTtlSeconds: 300
  stalePermitted: true
  identityInKey: false

cost:                                # Required.
  estimatedLatencyMs: 500
  esiCallCount: 1
```

## Validation Rules

1. `id` + `version` MUST be unique across the catalog.
2. All `type` references MUST resolve to registered semantic types.
3. All `dependencies` MUST resolve to registered capabilities.
4. `source: COMPOSITE` MUST have a linked pipeline definition.
5. `auth.scopes` MUST be non-empty when `auth.required` is true.
6. `cost.esiCallCount` MUST be 0 for non-ESI sources.

## Registration

Capabilities are registered via the `CapabilityCatalog.register()`
method. Registration validates the manifest and rejects invalid
definitions with structured diagnostics.
