# Research: Semantic Discovery & Assisted Composition

**Branch**: `004-semantic-discovery` | **Date**: 2026-08-19

## R1: Graph Traversal Algorithm for Multi-Hop Path Finding

**Decision**: BFS (Breadth-First Search) with visited-set cycle detection and configurable depth limit.

**Rationale**: BFS naturally finds shortest paths first, which aligns with the requirement to present the shortest valid capability path (FR-004). The capability graph is small (hundreds to low thousands of nodes), so BFS performance is more than adequate. BFS with a depth limit (max 5 hops) inherently prevents runaway traversal. Visited-set tracking prevents infinite loops from graph cycles (FR-006).

**Alternatives considered**:

- **Dijkstra's algorithm**: Adds weighted shortest-path capability (e.g., by estimated cost), but adds implementation complexity. BFS finds shortest-by-hops first; tie-breaking by cost can be applied as a post-sort on BFS results without Dijkstra overhead. Rejected for v1; can be introduced later if cost-weighted routing becomes a priority.
- **DFS (Depth-First Search)**: Finds a path but not necessarily the shortest. Would require iterative deepening to match BFS's shortest-path property. No advantage over BFS for this graph scale.
- **A\* search**: Requires a meaningful heuristic function. Semantic type distances have no natural heuristic metric (unlike spatial graphs). Rejected as inapplicable.

## R2: Graph Indexing Strategy for Catalog Lookups

**Decision**: Build indexed maps (`Map<SemanticTypeId, CapabilityDefinition[]>`) for both input-type and output-type lookups, constructed eagerly when the graph is built from the catalog.

**Rationale**: The existing `CapabilityCatalog.findBySemanticInput/Output` methods perform full linear scans on every call. For multi-hop path finding, each BFS step requires a lookup ("which capabilities consume type X?"), so linear scans compound multiplicatively. Pre-indexed maps reduce each lookup to O(1) amortized. The graph is rebuilt when the catalog changes (capability registered/removed), which is infrequent compared to query frequency.

**Alternatives considered**:

- **Maintain indexes inside CapabilityCatalog**: Would improve all consumers but requires modifying the existing catalog class. Rejected to avoid coupling the discovery concern into the catalog's responsibility. The discovery engine builds its own indexes from the catalog's `list()` method.
- **Lazy indexing on first query**: Saves memory if discovery is never used, but adds latency to the first query and complicates invalidation. Rejected for simplicity; eager build on graph construction is straightforward.

## R3: Satisfaction Analysis Approach

**Decision**: Collect all semantic types produced by output ports of nodes in the current flow into a `Set<SemanticTypeId>`, then for each candidate capability, check which required inputs are satisfied by set membership.

**Rationale**: Satisfaction analysis must answer "which of this capability's required inputs are already available in the flow?" The set of available types is computed once per flow state change (O(n) where n is total output ports). Each candidate check is O(k) where k is the candidate's input count. This is efficient for ranking suggestions across the entire catalog.

**Alternatives considered**:

- **Per-port matching (which specific node provides the type)**: Richer information (can suggest specific wiring), but adds complexity. The v1 approach identifies whether a type is available; specific wiring recommendations can be added in v2 by tracking which node+port produces each type.
- **Graph reachability analysis**: Check not just direct outputs but also types reachable through further composition. Rejected for v1 as overly complex; direct output availability is the meaningful signal for "ready to connect."

## R4: Discovery Engine Placement in Architecture

**Decision**: Place the discovery engine in `packages/domain/src/discovery/` as a pure domain service with no framework dependencies.

**Rationale**: Following Constitution Principle IV (Clean Architecture), the capability graph and path finding are domain concepts -- they describe relationships between capabilities, not UI behavior or infrastructure concerns. The discovery engine depends only on `CapabilityCatalog` and domain types (`CapabilityDefinition`, `SemanticPort`, `SemanticTypeId`), all of which are in the domain layer. This allows the compiler, designer, gateway, and any future consumer to use the same discovery logic without duplication (Principle XVI -- Designer Independence).

**Alternatives considered**:

- **Place in `packages/compiler/`**: The compiler already has `suggestIntermediates`, so there's precedent. However, the compiler's responsibility is pipeline compilation and validation, not capability discovery. Discovery is a broader concern used by the designer palette, gateway API, and potentially CLI tools -- not just during compilation. Rejected to avoid widening the compiler's responsibility.
- **New `packages/discovery/` package**: Follows the existing package-per-concern pattern. However, creating a new package adds monorepo overhead (package.json, tsconfig, vitest config, exports). The discovery module is tightly coupled to domain types and the catalog. A subdirectory within `packages/domain/` is sufficient and avoids package proliferation.

## R5: Compiler Integration Strategy

**Decision**: Modify `suggestIntermediates` to delegate to the discovery engine's `findPaths` for multi-hop results, replacing the current single-hop brute-force search. The compiler's `compile` function continues to call `suggestIntermediates` -- the change is internal to that module.

**Rationale**: The existing `suggestIntermediates` is called from `compile.ts` step 10 (suggestion appendage). Its single-hop limitation is the primary gap. Rather than duplicating graph traversal in the compiler, the compiler should consume the domain's discovery engine. The `CompilerDiagnostic` output format (with `SEMANTIC_SUGGESTION` code) is preserved -- only the internal search becomes multi-hop.

**Alternatives considered**:

- **Leave compiler unchanged, add discovery as a separate API**: Keeps the compiler stable but means two suggestion systems coexist -- the compiler's single-hop and the discovery engine's multi-hop. Confusing for consumers. Rejected.
- **Replace the entire suggestion step in the compiler**: Removes `suggestIntermediates` entirely and replaces step 10 with a direct call to the discovery engine. Technically cleaner but a larger diff. The delegation approach (modify internals, preserve signature) is lower-risk.

## R6: Designer Store Architecture

**Decision**: Create a new `discovery-store.ts` Zustand store rather than extending `catalog-store.ts` or `pipeline-store.ts`.

**Rationale**: Discovery state (suggestions, bridging proposals, flow proposals, assist mode input) is distinct from catalog browsing state (search query, source filter) and pipeline editing state (nodes, edges, diagnostics). A separate store follows the single-responsibility principle and avoids bloating the existing stores. The discovery store subscribes to relevant state from both catalog and pipeline stores to compute suggestions reactively.

**Alternatives considered**:

- **Extend catalog-store**: The catalog store already handles capability filtering, so adding discovery filtering there has proximity benefits. However, discovery suggestions depend on pipeline state (current flow), not just catalog contents. Mixing catalog browsing with flow-aware suggestions creates a confusing dependency. Rejected.
- **Extend pipeline-store**: The pipeline store already has `BridgingSuggestion[]` state and `setBridgingSuggestions()`. However, the pipeline store is already the largest store in the designer. Adding discovery logic would make it unwieldy. Rejected; the existing `bridgingSuggestions` field can be deprecated in favor of the discovery store.

## R7: Gateway Discovery API Design

**Decision**: Add REST endpoints under `/api/discovery/` in the gateway for programmatic access to discovery queries. These endpoints wrap the domain discovery engine.

**Rationale**: The gateway already exposes catalog endpoints (`/api/capabilities`) and pipeline endpoints (`/api/pipelines`). Discovery is a natural extension. Non-visual clients (CLI tools, scripts, agents) need discovery access without running the designer. REST endpoints are consistent with the existing gateway pattern (Fastify + Zod validation).

**Alternatives considered**:

- **GraphQL-only discovery**: Aligns with the constitution's GraphQL-as-public-contract principle. However, the gateway's current API is REST (no GraphQL server is implemented yet), and discovery queries are simple request/response patterns that don't benefit from GraphQL's selection-set flexibility. REST is pragmatic for v1; GraphQL can be added when the gateway's GraphQL layer is built.
- **No gateway endpoints (designer-only)**: Simpler, but violates the principle that the designer should not be the only way to access capability composition features. Rejected.

## R8: Explanation Generation Strategy

**Decision**: Generate explanations as structured data (`ExplanationStep[]`) at the domain layer, rendered to human-readable strings at the presentation layer (designer or gateway).

**Rationale**: Every suggestion must include an explanation (FR-008). Generating structured explanation data (source type, target type, bridging capability, transformation description) in the domain layer allows different consumers to render explanations appropriately -- the designer can use rich UI formatting while the gateway can return plain text or structured JSON. This follows Clean Architecture: the domain describes what happened, the interface layer decides how to present it.

**Alternatives considered**:

- **Generate human-readable strings in the domain**: Simpler, but couples presentation format to the domain layer. Different consumers (designer, gateway, CLI) may want different formats. Rejected.
- **No structured data, just capability IDs**: Minimal, but forces every consumer to reconstruct the explanation from capability metadata. Duplicates logic. Rejected.
