# Quickstart: Semantic Discovery & Assisted Composition

**Branch**: `004-semantic-discovery` | **Date**: 2026-08-19

## Overview

This feature adds a semantic discovery engine to Eve Fabric that builds a capability graph from registry metadata and enables intelligent flow construction assistance. The engine is deterministic (no AI dependency) and is consumed by the designer, compiler, and gateway.

## Architecture at a Glance

```text
                        Consumers
  +--------------+  +----------+  +-------------------+
  | Designer     |  | Compiler |  | Gateway REST API  |
  | (discovery-  |  | (suggest |  | (/api/discovery/) |
  |  store.ts)   |  |  inter.) |  |                   |
  +------+-------+  +----+-----+  +--------+----------+
         |               |                 |
         +---------------+-----------------+
                         |
              +----------v----------+
              |  DiscoveryEngine    |  <-- domain layer
              |  (orchestrator)     |
              +----------+----------+
         +---------------+---------------+
         v               v               v
  +--------------+ +-----------+ +------------------+
  |CapabilityGraph| |PathFinder | |SatisfactionAnalyzer|
  |(indexed maps) | |(BFS)      | |(set membership)    |
  +------+-------+ +-----------+ +------------------+
         |
         v
  +--------------+
  |CapabilityCatalog|  <-- existing domain class
  +--------------+
```

## Key Concepts

### Capability Graph

Built from the catalog's registered capabilities. Indexes capabilities by their input and output semantic types for O(1) lookup. Rebuilt when the catalog changes.

### Path Finding

BFS traversal over the capability graph. Finds shortest paths between semantic types through intermediate capabilities. Depth-limited to 5 hops. Cycle-aware.

### Satisfaction Analysis

Given a flow's available output types, determines which of a candidate capability's required inputs are satisfiable. Used to rank suggestions by readiness.

### Flow Proposals

Structured proposals (bridging paths, auto-completions) presented to the user for acceptance. All proposals are validated through the existing compiler before application.

## Implementation Priorities

### Phase 1: Foundation (P1 stories)

1. `CapabilityGraph` -- indexed graph construction from catalog
2. `PathFinder` -- BFS multi-hop path finding
3. `DiscoveryEngine` -- orchestrator with `findConsumers`, `findPaths`
4. Domain types (`SemanticPath`, `DiscoverySuggestion`, `ExplanationStep`)
5. Compiler integration -- `suggestIntermediates` delegates to discovery engine
6. Designer: port-based discovery in palette
7. Designer: bridging proposal dialog on incompatible connection attempt

### Phase 2: Intelligence (P2 stories)

8. `SatisfactionAnalyzer` -- flow context satisfaction
9. Goal-based search enhancement (search by output type keywords)
10. Context-aware suggestions panel in designer
11. Gateway discovery REST endpoints

### Phase 3: Assistance (P3 stories)

12. Auto-completion flow proposals
13. Smart node addition (connection highlighting on drag)
14. Flow proposal overlay with Accept/Modify/Cancel
15. Assisted flow construction (natural-language goal to structured query)

## Key Files to Understand Before Starting

| File                                                         | Why                                                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/capability/catalog.ts`                  | The `CapabilityCatalog` class with `findBySemanticInput/Output`, `search`, `list` -- the discovery engine's data source |
| `packages/domain/src/capability/capability-definition.ts`    | `CapabilityDefinition` with `inputs`/`outputs` as `Map<string, SemanticPort>`                                           |
| `packages/domain/src/semantic-type/eve-types.ts`             | The 10 pre-built EVE semantic types -- test data for discovery                                                          |
| `packages/compiler/src/suggest-intermediates.ts`             | Current single-hop suggestion; to be replaced with discovery engine delegation                                          |
| `packages/compiler/src/validate-semantic-wiring.ts`          | How semantic type mismatches are detected (triggers bridging suggestions)                                               |
| `apps/designer/src/stores/pipeline-store.ts`                 | `BridgingSuggestion` interface; discovery store will replace this                                                       |
| `apps/designer/src/components/palette/CapabilityPalette.tsx` | Current compatibility filtering (exact type match); to be enhanced                                                      |

## Testing Strategy

- **Unit tests**: Each discovery module (`CapabilityGraph`, `PathFinder`, `SatisfactionAnalyzer`, `DiscoveryEngine`) tested with synthetic capability fixtures
- **Property tests**: Path finding invariants (cycle-free, type-consecutive, within depth limit) via fast-check
- **BDD scenarios**: End-to-end discovery behavior (given capabilities X/Y/Z, when user selects port, then suggestions include...)
- **Integration tests**: Gateway discovery endpoints with real catalog + discovery engine
- **Designer tests**: React component tests for discovery UI interactions
