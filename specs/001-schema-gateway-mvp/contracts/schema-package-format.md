# Contract: Schema Package Format

**Version**: 1.0.0

## Overview

A schema package is a portable, versioned bundle that contains
everything needed to reproduce a composed GraphQL schema on
another gateway instance.

## Directory Structure

```text
{package-name}/
├── schema.graphql       # Generated GraphQL SDL
├── pipeline.yaml        # Pipeline definition
├── mappings.yaml        # GraphQL field → pipeline output mappings
├── policies.yaml        # Cache, auth, rate-limit policies
├── metadata.yaml        # Package metadata and capability manifest
└── README.md            # Human-readable documentation
```

## metadata.yaml

```yaml
name: Trade Opportunity
id: trade-opportunity
version: 1.0.0
description: >
  Find cheapest market orders within a specified
  jump range from a given origin system.

gateway:
  minimumVersion: 0.1.0

capabilities: # All capabilities required.
  - id: market.orders
    version: 1
  - id: market.aggregate
    version: 1
  - id: universe.resolveType
    version: 1
  - id: universe.resolveRegion
    version: 1
  - id: universe.resolveLocation
    version: 1
  - id: route.distance
    version: 1
  - id: collection.filter
    version: 1
  - id: collection.sort
    version: 1

author: '' # Optional.
createdAt: '2026-08-19T12:00:00Z'
tags: # Optional.
  - market
  - trading
```

## mappings.yaml

```yaml
mappings:
  - graphqlField: tradeOpportunity.item
    pipelineOutput: resolve-item.type
  - graphqlField: tradeOpportunity.price
    pipelineOutput: sort-price.result.price
  - graphqlField: tradeOpportunity.location
    pipelineOutput: resolve-location.system
  - graphqlField: tradeOpportunity.jumps
    pipelineOutput: route.distance
```

## policies.yaml

```yaml
cache:
  defaultTtlSeconds: 300
  staleWhileRevalidate: true

auth:
  requiredScopes:
    - esi-markets.structure_markets.v1

rateLimiting:
  maxRequestsPerMinute: 60
```

## Validation Rules

### Export

1. Package MUST NOT contain user credentials or secrets.
2. All referenced capabilities MUST be resolvable.
3. `metadata.yaml` MUST be complete and valid.
4. `schema.graphql` MUST be valid SDL.
5. `pipeline.yaml` MUST be a valid pipeline definition.

### Import

1. Gateway version MUST satisfy `gateway.minimumVersion`.
2. All capabilities in the manifest MUST exist in target catalog.
3. Capability versions MUST be compatible.
4. If any validation fails, import MUST be rejected with a
   diagnostic listing all missing or incompatible requirements.
