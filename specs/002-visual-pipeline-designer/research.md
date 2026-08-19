# Research: Visual Pipeline Designer

**Feature**: 002-visual-pipeline-designer  
**Date**: 2026-08-19

## R1: Compiler Integration Strategy (Client-Side vs Server-Side)

**Decision**: Hybrid approach — compile client-side where possible, execute server-side via gateway API.

**Rationale**: The `packages/compiler` package is pure TypeScript with no server dependencies. It can be bundled into the Vite-built designer app and invoked directly in the browser, providing instant compilation feedback without network round-trips. Execution, however, requires access to ESI/SDE data sources and authentication tokens, which must remain server-side (Constitution Principle XV: credentials must not be exposed to client). The gateway already has a Fastify server; execution endpoints are a natural addition.

**Alternatives considered**:

- **Fully server-side compilation**: Adds latency to every canvas change; unnecessary since the compiler is stateless and side-effect-free.
- **Fully client-side execution**: Would expose authentication tokens and ESI.ts internals to the browser; violates Constitution Principles IV and XV.

## R2: Bridging Capability Suggestion Mechanism

**Decision**: Use the compiler's existing `suggestIntermediates()` function, which already scans the catalog for capabilities whose output type matches the target's input type and whose input type matches the source's output type.

**Rationale**: The compiler already produces `SEMANTIC_SUGGESTION` diagnostics when a type mismatch has a known intermediary in the catalog. The designer can consume these diagnostics directly — no new logic needed.

**Alternatives considered**:

- **Custom graph traversal in the designer**: Would duplicate compiler logic, violating Constitution Principle XVI (Designer Independence).
- **Pre-computed compatibility matrix**: Over-engineers the problem; the catalog is small enough that real-time lookup is instant.

## R3: Execution Visualization Approach

**Decision**: Use a state-machine model for node execution status (idle → queued → executing → completed/failed/skipped) and update the Zustand store as execution progresses. The gateway API streams execution events via Server-Sent Events (SSE) or returns a completed result with per-step metrics.

**Rationale**: The `ExecutionResult` type already includes `stepDurations`, `cacheHits/cacheMisses`, and `ProvenanceRecord` per step. The designer maps step IDs back to canvas node IDs and updates visual state accordingly. SSE provides real-time updates without requiring WebSocket infrastructure.

**Alternatives considered**:

- **WebSocket-based streaming**: More complex infrastructure for bidirectional communication that isn't needed (execution is one-way).
- **Polling**: Adds latency and unnecessary requests; SSE is simpler and natively supported.
- **Post-hoc results only**: Loses the real-time animation requirement from the spec.

## R4: Pipeline Persistence Format

**Decision**: Use the existing YAML-based `PipelineDefinition` serialization via `pipelineToYaml()` / `flowToPipeline()` in the `pipeline-serializer.ts` service. Canvas layout metadata (node positions) is stored as an additional `layout` section in the YAML or as a companion metadata file.

**Rationale**: Constitution Principle IX requires that saved schemas contain enough metadata to reproduce behavior. The `PipelineDefinition` already satisfies this. Node positions are UI-only state and can be stored separately without affecting the domain model's integrity.

**Alternatives considered**:

- **JSON format**: YAML is already the established convention in the project (see `examples/` directory).
- **Embedding positions in PipelineNode.config**: Mixes UI concerns with domain data; violates Clean Architecture.

## R5: Smart Palette Filtering

**Decision**: Use the `CapabilityCatalog.findBySemanticInput()` and `findBySemanticOutput()` methods to filter the palette based on the selected node's port types.

**Rationale**: These catalog methods already exist and perform efficient lookups by semantic type. When a node is selected, the designer queries the catalog for capabilities whose inputs match the selected node's outputs (for "what comes next" suggestions) or whose outputs match unconnected inputs (for "what can feed this" suggestions).

**Alternatives considered**:

- **Static compatibility lookup table**: Would need updating whenever capabilities are added; the catalog methods are already dynamic.
- **Designer-side type matching**: Would duplicate the semantic type compatibility logic that belongs in the domain layer.

## R6: Initial Capability Set for MVP

**Decision**: The MVP ships with these registered capabilities:

1. `universe.resolveType` — input: type name (string), output: TypeReference
2. `market.orders` — input: RegionReference + TypeReference, output: MarketOrderCollection
3. `universe.resolveLocation` — input: LocationReference, output: location details
4. `navigation.routeDistance` — input: two SystemReferences, output: RouteDistance
5. `transform.filter` — input: collection + predicate config, output: filtered collection
6. `transform.sort` — input: collection + sort config, output: sorted collection
7. `pipeline.result` — input: any typed data, output: pipeline result

**Rationale**: This set demonstrates a complete end-to-end flow as specified in FR-025: Resolve Type → Market Orders → Resolve Location → Route Distance → Filter → Sort → Result. It exercises ESI sources, SDE sources, DERIVED capabilities, and transformation capabilities.

**Alternatives considered**:

- **Larger initial set**: Increases scope without adding design validation value.
- **Smaller set (just market orders)**: Insufficient to demonstrate the full composition model including transformations and multi-source pipelines.

## R7: Canvas Performance at Scale

**Decision**: Rely on @xyflow/react's built-in virtualization (only renders visible nodes) and limit initial scope to 50 nodes. Add performance guardrails: debounce compilation to 300ms after last canvas change, memoize expensive catalog lookups, and use React.memo on node components.

**Rationale**: React Flow handles viewport culling natively. The 50-node target from SC-004 is well within React Flow's documented capabilities (tested to hundreds of nodes). Debouncing compilation prevents re-compiling on every micro-interaction during drag operations.

**Alternatives considered**:

- **Canvas-based rendering (non-React)**: Would require reimplementing all interaction handling; React Flow already solves this well.
- **Web Workers for compilation**: Premature optimization; compilation of 30-node pipelines takes <100ms synchronously.
