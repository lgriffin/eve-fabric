# Research: Intent-Driven Interactive Flow Designer

**Branch**: `005-intent-flow-designer` | **Date**: 2026-08-20

## R1: How to render interactive input controls inside React Flow nodes

**Decision**: Use standard React form components rendered inside custom React Flow node components. React Flow custom nodes are regular React components — they can contain any JSX including inputs, selects, and buttons. Use `noDragClassName` on interactive elements to prevent drag interference.

**Rationale**: React Flow's custom node API explicitly supports interactive content. The existing `CapabilityNode.tsx` already renders custom content (source badges, execution state). Adding form inputs follows the same pattern. The `noDragClassName` approach is documented by React Flow for exactly this use case.

**Alternatives considered**:

- External configuration panel only (current NodeDetailPanel approach) — rejected because inline configuration is a core spec requirement for the intent-driven experience
- HTML overlay positioned above nodes — rejected because it breaks React Flow's coordinate system and zoom behavior

## R2: How to map semantic types to appropriate input editors

**Decision**: Create a static mapping from `SemanticTypeId` to an `EditorType` enum in the domain package. The designer reads this mapping to dispatch to the correct React editor component. The mapping is extensible by adding entries.

**Rationale**: The semantic type system already carries enough information to determine appropriate editors. A static mapping keeps the logic in the domain layer (testable without React) while the React components handle rendering. This aligns with Constitution IV (Clean Architecture) — the domain defines what editor type is needed, the UI layer provides the implementation.

**Mapping**:

| Semantic Type                 | Editor Type           | Control                                     |
| ----------------------------- | --------------------- | ------------------------------------------- |
| `eve.type.reference`          | `searchable-selector` | Searchable dropdown with item name search   |
| `eve.region.reference`        | `searchable-selector` | Searchable dropdown (~100 regions)          |
| `eve.system.reference`        | `searchable-selector` | Searchable dropdown with system name search |
| `eve.location.reference`      | `searchable-selector` | Searchable dropdown                         |
| `eve.market.order.collection` | `collection`          | Connection-only indicator                   |
| `eve.currency.isk`            | `numeric`             | Number input                                |
| `eve.route.distance`          | `numeric`             | Number input                                |
| `eve.security.status`         | `numeric`             | Number input (0.0-1.0 range)                |
| `eve.timestamp`               | `text`                | Read-only display                           |

For ports with enumerated values (e.g., order_type: buy/sell/both), the editor type is `enum` and the options are derived from capability metadata.

**Alternatives considered**:

- Derive editor type from Zod schema at runtime — rejected because the Zod schemas define validation, not UI control type; a numeric Zod schema doesn't distinguish between a slider, a spinner, and a plain text input
- Store editor hints in the SemanticTypeDefinition itself — rejected because UI concerns don't belong in the domain type definition

## R3: How to implement single-node execution

**Decision**: Add a `POST /api/capabilities/:id/execute` gateway endpoint that accepts configured input values, resolves the capability from the registry, builds a minimal single-step ExecutionPlan, and runs it through the existing Executor infrastructure.

**Rationale**: Reusing the existing Executor ensures consistent behavior between node-level testing and full flow execution. The gateway already has the registry, capability resolution, and source adapters configured. A thin wrapper endpoint avoids duplicating execution logic.

**Alternatives considered**:

- Client-side execution (designer calls ESI directly) — rejected because it bypasses the capability abstraction, violates Clean Architecture, and would require ESI credentials in the browser
- Create a one-node pipeline and use the existing `/api/pipelines/execute` endpoint — viable but the current execution endpoint is a stub; a dedicated endpoint is cleaner and signals intent

## R4: How to serve EVE reference data for searchable selectors

**Decision**: Add gateway endpoints that query SDE data for items, regions, and solar systems. Since ESI.ts provides SDE access, the gateway can serve this reference data without a new dependency.

**Endpoints**:

- `GET /api/reference/items?q=<search>&limit=20` — search items by name substring
- `GET /api/reference/regions` — list all regions (~100, cacheable)
- `GET /api/reference/systems?q=<search>&limit=20` — search systems by name substring

**Rationale**: Reference data must come from the server to maintain the architectural boundary. The SDE data is static per release, so aggressive caching is appropriate (Constitution XIV). The designer's searchable selectors make HTTP requests as the user types, debounced at 300ms.

**Alternatives considered**:

- Bundle reference data in the designer client — rejected for items (~40k entries) and systems (~8k entries); acceptable for regions but inconsistent
- Use GraphQL for reference lookups — rejected because the designer currently uses REST for all gateway communication; adding GraphQL client for this alone adds unnecessary complexity

## R5: How to implement contextual palette (+ button and drop-on-canvas)

**Decision**: Both interactions use the same `ContextualPalette` popup component. It receives the source output's semantic type and calls the existing `POST /api/discovery/suggest` endpoint with a FlowContext. Results are displayed with user-oriented descriptions. Selecting an entry triggers node creation and auto-connection via the pipeline store.

**Rationale**: The discovery engine's `suggestNext()` already implements the core algorithm — it finds capabilities whose inputs match available output types and ranks them by satisfaction ratio. The popup just needs to present these results in user-friendly language and handle the add-and-connect action.

**Alternatives considered**:

- Client-side filtering of the full catalog — rejected because the discovery engine's satisfaction analysis, readiness scoring, and multi-hop awareness provide much richer suggestions than simple type matching
- A separate "quick-add" modal — rejected because it introduces a disruptive workflow break; an inline popup near the interaction point is more fluid

## R6: How to handle palette mode switching

**Decision**: The `CapabilityPalette` component maintains a `mode` state (`discover` | `recommended` | `all`) and renders the corresponding child component. The mode selector appears as tabs at the top of the palette. When the canvas is empty, Recommended mode automatically falls back to Discover behavior.

**Rationale**: Tab-based mode switching is a familiar pattern that doesn't require re-learning. The Recommended mode uses the existing `POST /api/discovery/suggest` endpoint, which already accepts a FlowContext. The All mode is essentially the current palette behavior with its existing search and source filters.

**Alternatives considered**:

- Auto-switching based on canvas state (no manual toggle) — rejected because it removes user control; an expert might want to stay in All Capabilities mode while building
- Dropdown instead of tabs — rejected because tabs make all modes visible and one-click accessible

## R7: Natural-language intent handling for initial scope

**Decision**: Use the existing keyword-based `DiscoveryEngine.search()` for the initial implementation. The search already matches against capability names, descriptions, IDs, and semantic types. For the Market vertical slice, queries like "market prices", "find cheap Tritanium", and "route between systems" produce relevant results through keyword matching.

**Rationale**: The spec uses SHOULD for natural-language intent (section 4), making it a recommendation rather than a hard requirement. The keyword search engine, combined with well-written capability descriptions and semantic type names, provides sufficient discovery for the initial scope. True NLP would require an LLM integration that adds complexity and latency without proportional value for 6 capabilities.

**Alternatives considered**:

- LLM-powered intent classification — deferred; adds external dependency, latency, and cost for a small initial capability set
- Client-side fuzzy matching (e.g., Fuse.js) — rejected because it duplicates the server-side discovery engine's functionality and wouldn't benefit from flow context awareness
