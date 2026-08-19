# Research: Composite Capabilities & Flow Registry

**Branch**: `003-composite-flow-registry` | **Date**: 2026-08-19

## R1: Capability Versioning — Integer to SemVer Migration

**Decision**: Migrate `CapabilityVersion` from branded positive integer to branded semver string.

**Rationale**: Constitution Principle XXI mandates semantic versioning for published capabilities. The spec requires version numbers like `1.0.0`, `1.1.0`, `2.0.0` with compatible upgrade detection. Integer versions cannot express minor/patch distinctions, making it impossible to determine whether an upgrade is compatible (minor/patch) or breaking (major).

**Alternatives considered**:

- **Keep integers, add semver only for composites**: Rejected — creates two versioning systems for the same entity type, violating the architectural constraint of a single unified model.
- **Map integers to semver at the boundary**: Rejected — leaky abstraction; existing `CapabilityCatalog` queries and `CapabilityRef` comparisons would need version translation everywhere.
- **Use integer major + separate minor/patch fields**: Rejected — over-complex; semver libraries handle parsing, comparison, and compatibility checks already.

**Migration path**: Existing integer versions (e.g., `1`) become `"1.0.0"`. The `CapabilityVersion` branded type changes from `number & { __brand: 'CapabilityVersion' }` to `string & { __brand: 'CapabilityVersion' }`. A `createCapabilityVersion()` factory validates the semver format via Zod. The `CapabilityCatalog` key format changes from `id@1` to `id@1.0.0`. A `isCompatibleUpgrade()` utility determines whether a version change is minor/patch (compatible) or major (breaking).

## R2: Fabric Registry Architecture

**Decision**: Implement FabricRegistry as a domain service that wraps CapabilityCatalog with additional concerns: persistence, dependency graph, version-aware queries, and publish validation.

**Rationale**: The existing `CapabilityCatalog` is a simple in-memory map with register/get/list operations. The registry needs additional responsibilities: persisting capabilities across restarts, maintaining a dependency graph, detecting circular dependencies during publication, and surfacing upgrade availability. Rather than bloating CapabilityCatalog, a FabricRegistry composes it with these concerns.

**Alternatives considered**:

- **Extend CapabilityCatalog directly**: Rejected — violates single responsibility; the catalog is a simple lookup structure, and adding persistence/dependency logic would couple domain and infrastructure.
- **Separate microservice**: Rejected — over-architecture for a single-instance deployment; the registry is a domain service within the same process.

**Design**: FabricRegistry is a domain port (interface) with methods: `register()`, `publish()`, `get()`, `list()`, `getDependencyGraph()`, `findUpgrades()`. The `InMemoryFabricRegistry` and `PersistentFabricRegistry` (using `RegistryRepository`) are infrastructure adapters. The registry populates the CapabilityCatalog on startup from persisted state.

## R3: Dependency Graph Implementation

**Decision**: Implement DependencyGraph as a directed acyclic graph (DAG) data structure in the domain layer, separate from the compiler's cycle detection.

**Rationale**: The compiler's `detect-cycles.ts` operates on pipeline edges (node-to-node connections within a single pipeline). The dependency graph operates at a higher level: capability-to-capability relationships across published composites. These are distinct concerns. The dependency graph tracks "Capability A depends on Capability B@version", enabling impact analysis ("what breaks if I retire B?"), upgrade detection ("B has a newer compatible version"), and circular composition prevention at publish time.

**Alternatives considered**:

- **Reuse compiler cycle detection**: Rejected — wrong abstraction level; the compiler detects cycles within a pipeline's edges, not across published capabilities.
- **Store as adjacency list in persistence only**: Rejected — dependency graph queries (transitive closure, cycle detection, impact analysis) need efficient in-memory operations.

**Design**: `DependencyGraph` maintains an adjacency map of `CapabilityRef → Set<CapabilityRef>`. Methods: `addDependency()`, `removeDependency()`, `hasCycle()`, `getDependencies()` (transitive), `getDependents()` (reverse lookup), `getImpact()` (what would break). Cycle detection uses DFS with a visited set. The graph is reconstructed from persisted capability `dependencies` fields on registry startup.

## R4: Provenance Through Composite Boundaries

**Decision**: The executor populates `ProvenanceRecord.upstream[]` by aggregating child step provenance records when executing an expanded composite.

**Rationale**: `ProvenanceRecord` already has the `upstream: ProvenanceRecord[]` field and `DataSource` already excludes `COMPOSITE`. The gap is that the executor doesn't currently populate `upstream[]` — adapters return provenance in their `SourceAdapterResult` but the chain isn't threaded through composite expansion. After composite expansion, child steps are prefixed (e.g., `parentId/childId`). The executor needs to collect provenance from all child steps of a composite and attach them as the `upstream` array of the composite's output provenance.

**Alternatives considered**:

- **Post-process provenance after execution**: Rejected — loses the step-by-step provenance ordering; better to build it during execution.
- **Separate provenance service**: Rejected — over-architecture; provenance aggregation is a natural part of the execution flow.

**Design**: After composite expansion, the executor tracks which steps originated from which composite. When a composite's output steps complete, their provenance records are aggregated into the composite's output provenance as `upstream[]` entries. This happens recursively for nested composites, producing a tree of provenance that traces to original ESI/SDE/DERIVED sources.

## R5: Sub-Dependency Deduplication

**Decision**: Add a deduplication pass in the planner that identifies duplicate sub-dependencies across expanded composites and merges them into single execution steps.

**Rationale**: When two composites both require `Resolve Type("Tritanium")`, the expanded execution graph contains two identical steps. The planner should recognise these as duplicates (same capability ID, same version, same input values) and merge them, routing both consumers to the single step's output. This is an optimisation, not a correctness requirement — the spec explicitly states "The abstraction exists for design and reuse, not as an optimization barrier."

**Alternatives considered**:

- **Deduplicate at expansion time in the compiler**: Rejected — the compiler doesn't know runtime input values; deduplication based on capability+version alone is necessary but input-value deduplication requires planner/runtime context.
- **Cache-based deduplication only**: Partially viable — the existing cache handles repeated calls, but planning-level deduplication avoids even the cache lookup overhead and enables better parallelisation.

**Design**: A new `deduplicate.ts` module in the planner. After composite expansion, it scans for steps with identical `(capabilityId, capabilityVersion, inputSources)` tuples. Duplicates are merged: one step is retained, and edges from consumers of the duplicate are rewired to the retained step. The planner's existing topological sort and parallel grouping then operate on the deduplicated graph.

## R6: Drill-Down UX Pattern

**Decision**: Implement drill-down as a modal overlay that displays the composite's internal pipeline in a separate React Flow canvas, with breadcrumb navigation for nested composites.

**Rationale**: The spec requires that opening a composite "displays its internal pipeline without destroying the parent pipeline context." A modal overlay preserves the parent canvas state in the background while showing the child pipeline. Breadcrumb navigation (e.g., "Parent Flow > Nearby Market Search > Resolve Type") supports multi-level drill-down. This mirrors the "Jenkins-like hierarchy" described in the spec.

**Alternatives considered**:

- **In-place expansion (expand node to show internals on same canvas)**: Rejected — clutters the parent canvas, hard to navigate back, doesn't scale for deeply nested composites.
- **Separate tab/page**: Rejected — loses visual connection to parent context; harder to navigate quickly.

**Design**: `CompositeOverlay` component renders a secondary React Flow canvas in an overlay. `BreadcrumbNav` tracks the navigation stack. The overlay loads the composite's `pipelineRef` from the registry and renders it as a read-only pipeline view. Clicking another composite within the overlay pushes to the breadcrumb stack and renders its internals. Clicking a breadcrumb navigates back.
