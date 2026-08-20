# Implementation Plan: Intent-Driven Interactive Flow Designer

**Branch**: `005-intent-flow-designer` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-intent-flow-designer/spec.md`

## Summary

Transform Fabric Studio from a component showcase into an intent-driven, interactive flow-building experience. Users describe what they want to accomplish, discover capabilities through guided search, drag interactive configurable nodes onto the canvas, test individual nodes, connect compatible components with smart type-aware wiring, and execute complete flows with per-node result inspection. The initial scope is a polished Market vertical slice using the existing discovery engine, capability catalog, compiler, and React Flow canvas.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS
**Primary Dependencies**: React 18, @xyflow/react (React Flow), Zustand, Vite, Fastify, Zod
**Storage**: In-memory capability registry (gateway), YAML pipeline serialization
**Testing**: Vitest, Cucumber.js (BDD), Stryker (mutation)
**Target Platform**: Web browser (desktop)
**Project Type**: Web application (monorepo: apps/designer + apps/gateway + shared packages)
**Performance Goals**: <3s workspace load, <5s node test response (excluding network), <300ms palette update on canvas change
**Constraints**: Must consume the same capability catalog and compiler as non-visual clients (Constitution XVI). Must not invent capabilities that don't exist in the catalog (Constitution XVII). Semantic type system must drive input editor selection (Constitution VI).
**Scale/Scope**: Initial scope: Market vertical slice — 6 interactive capabilities (market.orders, collection.filter, collection.sort, collection.limit, universe.resolve.location, universe.resolve.region)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                  | Status | Notes                                                                                                                  |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| II. Core Architecture      | PASS   | Designer consumes capability graph through existing discovery engine and compiler                                      |
| IV. Clean Architecture     | PASS   | All new UI components are adapters over the existing domain model; no domain logic in components                       |
| V. Capability-First        | PASS   | Interactive nodes are driven by CapabilityDefinition metadata (inputs, outputs, semantic types)                        |
| VI. Semantic Type System   | PASS   | Input editor selection is determined by SemanticTypeId, enforcing semantic over structural compatibility               |
| VII. Pipeline Composition  | PASS   | Flow construction produces standard PipelineDefinition; no parallel composition model                                  |
| XVI. Designer Independence | PASS   | Designer continues to consume the same catalog and compiler; no second set of composition rules                        |
| XVII. AI Assistance        | PASS   | Natural-language intent search suggests only existing catalog capabilities; compiler remains the authority on validity |
| XVIII. Testing             | PASS   | TDD for new hooks/services; BDD for observable flow-building behavior                                                  |
| XIX. Specification Style   | PASS   | Acceptance scenarios use Given/When/Then structure                                                                     |
| XXIII. Error Model         | PASS   | Node execution errors and validation errors use existing diagnostic model                                              |
| XXVI. Definition of Done   | PASS   | All criteria addressable within scope                                                                                  |

No constitution violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-intent-flow-designer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── gateway-api.md   # New and modified gateway endpoints
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/
  designer/src/
    components/
      canvas/
        CapabilityNode.tsx          # MODIFY: add interactive inputs, Test button, + continuation
        PipelineCanvas.tsx          # MODIFY: add drop-on-empty-canvas contextual palette
        SemanticHandle.tsx          # MODIFY: add connection-source indicator for connected inputs
        NodeInputEditor.tsx         # NEW: semantic-type-driven input editor dispatcher
        ConnectedInputIndicator.tsx # NEW: shows upstream data source for connected inputs
        ContextualPalette.tsx       # NEW: popup palette for drop-on-canvas and + continuation
      palette/
        CapabilityPalette.tsx       # MODIFY: add three modes (Discover/Recommended/All)
        IntentSearch.tsx            # NEW: search-first entry point with example queries
        RecommendedPanel.tsx        # NEW: context-aware capability suggestions
        CapabilityCard.tsx          # NEW: extracted card component with category indicators and Add button
      detail/
        NodeDetailPanel.tsx         # MODIFY: add execution result inspection tabs
        ResultInspector.tsx         # NEW: per-node execution result display
      input-editors/
        SearchableSelector.tsx      # NEW: searchable dropdown for items/regions/systems
        EnumSelector.tsx            # NEW: radio/dropdown for enumeration types
        NumericInput.tsx            # NEW: number input for numeric semantic types
        BooleanToggle.tsx           # NEW: toggle for boolean inputs
        CollectionInput.tsx         # NEW: indicator for collection-type inputs (connection-only)
    hooks/
      useNodeExecution.ts           # NEW: single-node test execution
      useDiscovery.ts               # NEW: wraps gateway discovery API for palette modes
      useFlowContext.ts             # NEW: derives FlowContext from current canvas state
      useInputEditorType.ts         # NEW: maps SemanticTypeId to editor component
    stores/
      pipeline-store.ts             # MODIFY: add per-node execution results, node input values
      catalog-store.ts              # MODIFY: add palette mode state, recommended capabilities
    services/
      discovery-service.ts          # NEW: client for gateway discovery endpoints
      reference-data-service.ts     # NEW: client for EVE item/region/system lookups

  gateway/src/
    routes/
      execution-routes.ts           # MODIFY: implement real single-node execution endpoint
      reference-data-routes.ts      # NEW: endpoints for item/region/system search

packages/
  domain/src/
    capability/
      input-editor-mapping.ts       # NEW: semantic type to editor type mapping

tests/
  bdd/
    features/
      intent-search.feature         # NEW: BDD scenarios for capability discovery
      node-configuration.feature    # NEW: BDD scenarios for interactive node configuration
      node-execution.feature        # NEW: BDD scenarios for single-node test
      smart-connections.feature     # NEW: BDD scenarios for type-aware connections
      flow-execution.feature        # NEW: BDD scenarios for end-to-end flow execution
```

**Structure Decision**: Extends the existing monorepo structure. New components are added within the existing `apps/designer/src/components/` hierarchy. New input editors get their own subdirectory (`input-editors/`) since they form a cohesive module. Gateway receives new routes within the existing route structure. The domain package receives a small addition for editor type mapping.

## Phase 1 Design Decisions

### D1: Input Editor Architecture

Input editors are selected by mapping `SemanticTypeId` to editor component type. The mapping lives in the domain package (`input-editor-mapping.ts`) so it can be tested independently of React. The designer dispatches to the appropriate editor component via `NodeInputEditor.tsx`, which reads the mapping and renders the corresponding editor.

**Editor types**:

- `searchable-selector`: For `eve.type.reference`, `eve.region.reference`, `eve.system.reference`, `eve.location.reference` — backed by gateway reference data endpoints
- `enum`: For ports with a constrained set of values (order type: buy/sell/both)
- `numeric`: For `eve.currency.isk`, `eve.route.distance`, and numeric constraint inputs (limit count)
- `boolean`: For boolean flags
- `collection`: For `eve.market.order.collection` — display-only, satisfied by upstream connection

### D2: Node Input Value Storage

Node input values are stored in the existing `CapabilityNodeData` within the pipeline store, extending the current `inputs` array entries with an optional `configuredValue` field. This keeps configured values co-located with port metadata and flows naturally into pipeline serialization.

### D3: Palette Mode Architecture

The palette component switches between three child components based on active mode:

- **Discover** (`IntentSearch`): Text search using the existing `POST /api/discovery/search` endpoint. Shows example queries when empty. Groups results into Suggested (high readiness) and Related (lower readiness).
- **Recommended** (`RecommendedPanel`): Uses `POST /api/discovery/suggest` with a `FlowContext` derived from canvas state. Automatically activates when nodes exist on canvas. Falls back to Discover mode when canvas is empty.
- **All** (existing `CapabilityPalette` list view): Full registry browse with existing source filters.

### D4: Single-Node Execution

A new gateway endpoint (`POST /api/capabilities/:id/execute`) accepts a capability ID and configured input values, resolves the capability, creates a minimal single-step execution plan, and runs it through the existing Executor. The designer's `useNodeExecution` hook calls this endpoint and stores results in per-node execution state within the pipeline store.

### D5: Contextual Palette (+ Button and Drop-on-Canvas)

Both the "+" continuation button and the drop-on-empty-canvas interaction use the same `ContextualPalette` component. It receives a source semantic type and calls `POST /api/discovery/suggest` filtered to capabilities that consume that type. Results are displayed as user-oriented action descriptions (derived from capability descriptions). Selecting an entry creates and connects the node automatically.

### D6: Connected Input Visual State

When a node input port has an incoming edge, the `NodeInputEditor` for that port is replaced with a `ConnectedInputIndicator` showing the source node name and port name. Deleting the connection reverts to the direct editor with no value configured.

### D7: Reference Data for Searchable Selectors

EVE item, region, and solar system reference data is served by new gateway endpoints that query static data from the SDE adapter. The designer's `reference-data-service.ts` provides search-as-you-type functionality for the `SearchableSelector` component. Initial scope: items (by name substring), regions (full list, ~100 entries), solar systems (by name substring).

### D8: Natural-Language Intent Search

For the initial implementation, natural-language intent is handled by the existing keyword-based `DiscoveryEngine.search()` which already matches against capability names, descriptions, IDs, and semantic types. The spec's natural-language examples ("I want to find where Tritanium is cheapest near Jita") will match on keywords like "Tritanium", "cheapest", "Jita" against capability descriptions. True NLP interpretation is deferred to a future enhancement; the existing keyword search provides adequate discovery for the Market vertical slice.

## Complexity Tracking

No constitution violations to justify.
