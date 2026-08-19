# Tasks: Composite Capabilities & Flow Registry

**Input**: Design documents from `/specs/003-composite-flow-registry/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and barrel exports for new modules

- [x] T001 Create packages/domain/src/registry/ directory with index.ts barrel export
- [x] T002 [P] Create apps/designer/src/components/publish/ directory with index.ts
- [x] T003 [P] Create apps/designer/src/components/drilldown/ directory with index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: SemVer migration and core registry domain types — MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### SemVer Migration

- [x] T004 Migrate CapabilityVersion from branded integer to branded semver string with Zod validation, createCapabilityVersion() factory, compareVersions(), isCompatibleUpgrade(), and isBreakingUpgrade() utilities in packages/domain/src/capability/value-objects.ts
- [x] T005 [P] Update CapabilityDefinition and CapabilityRef to use semver CapabilityVersion (version field becomes string-branded) in packages/domain/src/capability/capability-definition.ts
- [x] T006 [P] Update Zod schemas for semver version validation in packages/domain/src/capability/schemas.ts
- [x] T007 [P] Update all pre-built capability definitions (universe, market, routing, collection) to use semver version strings in packages/capability-sdk/src/capabilities/universe.ts, packages/capability-sdk/src/capabilities/market.ts, packages/capability-sdk/src/capabilities/routing.ts, packages/capability-sdk/src/capabilities/collection.ts
- [x] T008 Update CapabilityCatalog for semver-keyed lookups (key format id@major.minor.patch) and latest-version tracking in packages/domain/src/capability/catalog.ts
- [x] T009 [P] Update persistence schema capabilities table version column for semver strings in packages/persistence/src/schema.ts
- [x] T010 Update CapabilityRepository for semver-aware queries (get by version, get latest) in packages/persistence/src/repositories/capability-repository.ts

### Registry Domain Types

- [x] T011 [P] Create registry types: RegistryEntry, PublishRequest, PublishResult, UpgradeInfo, DependencyNode in packages/domain/src/registry/registry-types.ts
- [x] T012 [P] Create DependencyGraph data structure with addDependency(), hasCycle() (DFS), getDependencies() (transitive closure), getDependents() (reverse lookup), getImpact() in packages/domain/src/registry/dependency-graph.ts
- [x] T013 Create FabricRegistry domain port (interface) with register(), publish(), get(), list(), getVersions(), findUpgrades(), getDependencyGraph(), getDependents() in packages/domain/src/registry/fabric-registry.ts
- [x] T014 Update publishAsComposite() with cycle detection via DependencyGraph and semver version validation in packages/capability-sdk/src/publish-composite.ts
- [x] T015 Update packages/domain/src/registry/index.ts barrel export and packages/domain/src/capability/index.ts for new/modified exports

**Checkpoint**: Foundation ready — all domain types, semver migration, and interfaces in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Browse Capabilities from Unified Registry (Priority: P1) 🎯 MVP

**Goal**: Users see all capabilities (ESI, SDE, DERIVED, COMPOSITE) in a single searchable palette powered by the Fabric Registry

**Independent Test**: Open Fabric Studio → Capability Palette displays all registered capabilities with correct classifications, inputs, outputs, and metadata. Filter by source type works correctly.

### Implementation for User Story 1

- [x] T016 [US1] Implement InMemoryFabricRegistry (domain service implementing FabricRegistry port) with CapabilityCatalog composition, dependency graph maintenance, and publish validation in packages/domain/src/registry/in-memory-fabric-registry.ts
- [x] T017 [P] [US1] Create RegistryRepository persistence port and InMemoryRegistryRepository adapter in packages/persistence/src/repositories/registry-repository.ts
- [x] T018 [US1] Create registry API routes: GET /api/registry (list with source filter and search), GET /api/registry/:id (get with optional version query param) in apps/gateway/src/routes/registry-routes.ts
- [x] T019 [US1] Register registry routes in gateway server, initialise FabricRegistry with pre-built capabilities (universe, market, routing, collection) on startup in apps/gateway/src/server.ts
- [x] T020 [US1] Update catalog-store to fetch capabilities from GET /api/registry endpoint instead of GET /api/capabilities, add version display and COMPOSITE source support in apps/designer/src/stores/catalog-store.ts
- [x] T021 [US1] Update CapabilityPalette to show version badge on each capability and ensure COMPOSITE classification renders with existing colour scheme in apps/designer/src/components/palette/CapabilityPalette.tsx

**Checkpoint**: User Story 1 complete — Fabric Studio palette is registry-driven with all capability classifications visible and filterable.

---

## Phase 4: User Story 2 — Publish Flow as Capability (Priority: P2)

**Goal**: Users can publish any validated Fabric Flow as a reusable COMPOSITE capability with selected public inputs/outputs

**Independent Test**: Build a multi-step flow → click "Publish as Capability" → select inputs/outputs → name and version → verify new capability appears in registry and palette.

### Implementation for User Story 2

- [x] T022 [US2] Create publish API route: POST /api/registry/publish with request validation (Zod), pipeline lookup, compiler validation, version immutability enforcement (409 on duplicate), cycle detection, and error responses per contracts/registry-api.md in apps/gateway/src/routes/publish-routes.ts
- [x] T023 [US2] Register publish routes in gateway server in apps/gateway/src/server.ts
- [x] T024 [P] [US2] Create ContractEditor component: displays all pipeline inputs and outputs as checkboxes, allows user to select which form the public contract, validates at least one input and one output selected in apps/designer/src/components/publish/ContractEditor.tsx
- [x] T025 [US2] Create PublishDialog component: modal with capability name, ID (auto-generated from name), semver version input, description textarea, ContractEditor for I/O selection, and publish button that calls pipeline-store publish action in apps/designer/src/components/publish/PublishDialog.tsx
- [x] T026 [US2] Add publishAsCapability action to pipeline-store: validates current flow via compiler, opens PublishDialog, calls POST /api/registry/publish, refreshes catalog-store on success in apps/designer/src/stores/pipeline-store.ts
- [x] T027 [US2] Add "Publish as Capability" button to Toolbar (enabled only when pipeline is valid) and render PublishDialog in app layout in apps/designer/src/components/shared/Toolbar.tsx and apps/designer/src/App.tsx

**Checkpoint**: User Story 2 complete — users can build a flow, publish it as a composite capability, and see it appear in the palette.

---

## Phase 5: User Story 3 — Compose Capabilities Recursively (Priority: P3)

**Goal**: COMPOSITE capabilities behave identically to primitives on the canvas — drag, connect, compose, and re-publish without distinction

**Independent Test**: Publish composite A → drag A onto new canvas → connect to other nodes → publish as composite B → drag B onto another canvas → verify B works as a single node.

### Implementation for User Story 3

- [x] T028 [US3] Verify COMPOSITE capabilities from registry appear in palette with correct inputs/outputs, can be dragged to canvas via application/capability-id data transfer, and create CapabilityNode with semantic ports in apps/designer/src/components/palette/CapabilityPalette.tsx and apps/designer/src/components/canvas/PipelineCanvas.tsx
- [x] T029 [US3] Verify semantic wiring validation works for composite node ports: compiler validates connections to/from composite nodes identically to primitive nodes in packages/compiler/src/stages/ (existing resolve-composite.ts and validate-semantic-wiring.ts)
- [x] T030 [US3] Verify recursive publish flow: publish composite A, use A in a new flow alongside primitives, publish as composite B, verify B registers in registry with correct dependencies including A in packages/capability-sdk/src/publish-composite.ts

**Checkpoint**: User Story 3 complete — recursive composition works with no artificial distinction between primitive and composite capabilities.

---

## Phase 6: User Story 4 — Drill Down into Composite Internals (Priority: P4)

**Goal**: Users can open a composite node to inspect its internal pipeline, with breadcrumb navigation for nested composites

**Independent Test**: Place composite on canvas → click "Open" → see internal flow → navigate back → parent pipeline unchanged. Repeat for nested composites.

### Implementation for User Story 4

- [x] T031 [P] [US4] Create BreadcrumbNav component: renders navigation breadcrumb trail (e.g., "Parent Flow > Nearby Market Search > Resolve Type"), click any breadcrumb to navigate to that level in apps/designer/src/components/drilldown/BreadcrumbNav.tsx
- [x] T032 [US4] Create CompositeOverlay component: modal overlay with secondary React Flow canvas, loads composite's pipelineRef from registry API, renders internal pipeline as read-only, supports nested drill-down by clicking COMPOSITE nodes within the overlay in apps/designer/src/components/drilldown/CompositeOverlay.tsx
- [x] T033 [US4] Add drill-down state to pipeline-store: overlay navigation stack (array of {capabilityId, version, pipelineDef}), openComposite() and closeComposite() actions, current drill-down depth in apps/designer/src/stores/pipeline-store.ts
- [x] T034 [US4] Add "Open" button to CapabilityNode component for COMPOSITE source type nodes, triggering pipeline-store openComposite() action in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T035 [US4] Wire CompositeOverlay and BreadcrumbNav into designer App layout, rendered when drill-down stack is non-empty in apps/designer/src/App.tsx

**Checkpoint**: User Story 4 complete — composite nodes can be drilled into at any depth, with navigation back preserving parent state.

---

## Phase 7: User Story 5 — Version and Upgrade Capabilities (Priority: P5)

**Goal**: Published versions are immutable; Fabric Studio detects and offers compatible version upgrades

**Independent Test**: Publish v1.0.0 → build flow using v1.0.0 → publish v1.1.0 → reopen flow → see upgrade notification for v1.1.0 → upgrade → flow now references v1.1.0.

### Implementation for User Story 5

- [x] T036 [US5] Add version listing endpoint GET /api/registry/:id/versions (returns all published versions with timestamps) and upgrade detection endpoint GET /api/registry/:id/upgrades?from=version to registry routes in apps/gateway/src/routes/registry-routes.ts
- [x] T037 [US5] Implement findUpgrades() in InMemoryFabricRegistry: for a given CapabilityRef, find newer versions where isCompatibleUpgrade() returns true in packages/domain/src/registry/in-memory-fabric-registry.ts
- [x] T038 [US5] Add upgrade notification indicator to CapabilityNode: on mount/update, check for available upgrades via catalog-store, display subtle badge when upgrade available in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T039 [US5] Implement upgradeCapabilityVersion action in pipeline-store: updates node's capabilityVersion, refreshes node inputs/outputs from registry, revalidates pipeline in apps/designer/src/stores/pipeline-store.ts

**Checkpoint**: User Story 5 complete — versioning is immutable, upgrades are detected and offered in the designer.

---

## Phase 8: User Story 6 — Track Dependency Graph and Prevent Circular Composition (Priority: P6)

**Goal**: Dependency graph is maintained and visible; circular dependencies are rejected at publish time

**Independent Test**: Publish chain A→B→C → view dependency tree for C → attempt to publish C as dependency of A → receive clear circular dependency error.

### Implementation for User Story 6

- [x] T040 [US6] Add dependency graph endpoint GET /api/registry/:id/dependencies (returns DependencyNode tree) to registry routes in apps/gateway/src/routes/registry-routes.ts
- [x] T041 [US6] Verify cycle detection in publish route returns CIRCULAR_DEPENDENCY error with clear cycle path description (e.g., "A -> B -> C -> A") in apps/gateway/src/routes/publish-routes.ts
- [x] T042 [US6] Display dependency tree in NodeDetailPanel for COMPOSITE capabilities: fetch from dependencies endpoint, render as collapsible tree with version annotations in apps/designer/src/components/detail/NodeDetailPanel.tsx

**Checkpoint**: User Story 6 complete — dependency graph is visible and circular composition is rejected with clear messaging.

---

## Phase 9: User Story 7 — Execute Flows with Composite Capabilities (Priority: P7)

**Goal**: Composite execution expands and deduplicates sub-dependencies; provenance traces to original sources

**Independent Test**: Execute flow with two composites sharing a sub-dependency → verify sub-dependency runs once → verify provenance shows ESI/SDE/DERIVED (not COMPOSITE).

### Implementation for User Story 7

- [x] T043 [P] [US7] Create deduplicate module: scan expanded execution steps for identical (capabilityId, capabilityVersion, inputSources) tuples, merge duplicates by retaining one step and rewiring consumer edges in packages/planner/src/deduplicate.ts
- [x] T044 [US7] Integrate deduplication into planExecution(): call deduplicate() after composite expansion, before topological sort and parallel grouping in packages/planner/src/planner.ts
- [x] T045 [P] [US7] Create aggregate-provenance module: given a list of child step ProvenanceRecords from an expanded composite, aggregate them into the upstream[] array of the composite output's provenance, recursively for nested composites in packages/executor/src/aggregate-provenance.ts
- [x] T046 [US7] Update executor to populate ProvenanceRecord.upstream[] during composite execution: after child steps complete, call aggregate-provenance to build lineage chain in packages/executor/src/executor.ts

**Checkpoint**: User Story 7 complete — composite execution is optimised and provenance traces through to original sources.

---

## Phase 10: User Story 8 — End-to-End Recursive Composition Demo (Priority: P8)

**Goal**: Market Snapshot + Route Analysis + Hauling Cost → Trade Opportunity → appears in palette as first-class node

**Independent Test**: Follow the exact demo sequence: publish three composites, compose into Trade Opportunity, publish it, verify it appears in palette, drag to canvas, drill down, execute.

### Implementation for User Story 8

- [ ] T047 [US8] Create demo pipeline definitions for Market Snapshot (resolve type → market orders → filter → sort), Route Analysis (resolve location → route distance), and Hauling Cost (route distance → volume/collateral calculation) as composable flows in packages/capability-sdk/src/capabilities/demos/
- [ ] T048 [US8] Create Trade Opportunity pipeline definition composing Market Snapshot + Route Analysis + Hauling Cost and add demo seed function that registers all demo capabilities and publishes composites on gateway startup in dev mode in apps/gateway/src/seed-demo.ts
- [ ] T049 [US8] Verify end-to-end: Trade Opportunity appears in Capability Palette, can be placed on canvas, opened for drill-down (shows three sub-composites), and executed with provenance tracing to original ESI/SDE/DERIVED sources

**Checkpoint**: User Story 8 complete — the defining success criterion is met: recursive composition works end-to-end.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, exports, and final validation

- [ ] T050 [P] Update barrel exports for all new modules: packages/domain/src/index.ts, packages/persistence/src/index.ts, packages/persistence/src/repositories/index.ts, packages/planner/src/index.ts, packages/executor/src/index.ts
- [ ] T051 [P] Run pnpm run validate (lint + format:check + typecheck + coverage + knip) and fix all issues
- [ ] T052 Validate quickstart.md instructions: verify setup, dev server startup, and demo scenario match implementation
- [ ] T053 Run pnpm run validate final pass to confirm all quality gates pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP target
- **US2 (Phase 4)**: Depends on US1 (registry must exist to publish into)
- **US3 (Phase 5)**: Depends on US2 (needs published composites to verify composition)
- **US4 (Phase 6)**: Depends on US2 (needs composite nodes on canvas)
- **US5 (Phase 7)**: Depends on US2 (needs publish flow for version management)
- **US6 (Phase 8)**: Depends on US2 (needs published composites for dependency tracking)
- **US7 (Phase 9)**: Depends on US2 (needs composites for execution)
- **US8 (Phase 10)**: Depends on US2, US3, US4, US7 (end-to-end validation of all features)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

```text
Phase 1: Setup
    │
    v
Phase 2: Foundational (BLOCKS ALL)
    │
    v
Phase 3: US1 — Registry Palette (MVP)
    │
    v
Phase 4: US2 — Publish Flow
    │
    ├──────────────────────────────────────────┐
    │              │              │            │
    v              v              v            v
Phase 5: US3   Phase 6: US4   Phase 7: US5  Phase 8: US6
Recursive      Drill-Down     Versioning    Dependencies
Composition
    │              │                          │
    └──────────────┼──────────────────────────┘
                   │
                   v
             Phase 9: US7
             Execution & Provenance
                   │
                   v
             Phase 10: US8
             End-to-End Demo
                   │
                   v
             Phase 11: Polish
```

### Within Each User Story

- Domain types/services before API routes
- API routes before UI components
- Store updates before component updates
- Core implementation before integration wiring

### Parallel Opportunities

**Phase 2 (Foundational)**: After T004 (semver migration), tasks T005-T007 and T009 can run in parallel (different files). T011 and T012 can run in parallel (independent domain types).

**After US2 completion**: US3, US4, US5, US6, and US7 can all start in parallel — they share no file dependencies.

**Within US4**: T031 (BreadcrumbNav) can run in parallel with T033 (pipeline-store drill-down state).

**Within US7**: T043 (deduplicate) and T045 (aggregate-provenance) can run in parallel (different packages).

---

## Parallel Example: User Story 4

```text
# These can run in parallel (different files):
Task T031: "Create BreadcrumbNav component in apps/designer/src/components/drilldown/BreadcrumbNav.tsx"
Task T033: "Add drill-down state to pipeline-store in apps/designer/src/stores/pipeline-store.ts"

# Then sequentially:
Task T032: "Create CompositeOverlay (depends on BreadcrumbNav and pipeline-store state)"
Task T034: "Add Open button to CapabilityNode (depends on pipeline-store openComposite action)"
Task T035: "Wire overlay into App layout (depends on CompositeOverlay)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — Registry-Driven Palette
4. **STOP and VALIDATE**: Open Fabric Studio, verify palette shows all capabilities from registry
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1: Registry Palette → Test independently → **MVP!**
3. US2: Publish Flow → Test independently → Users can create reusable capabilities
4. US3: Recursive Composition → Verify composites compose with composites
5. US4: Drill-Down → Users can inspect composite internals
6. US5: Versioning → Immutable versions with upgrade awareness
7. US6: Dependencies → Dependency graph visible, circular deps rejected
8. US7: Execution → Composite execution with provenance
9. US8: End-to-End Demo → Full lifecycle validation
10. Polish → Quality gates pass

### Parallel Team Strategy

With multiple developers after US2 is complete:

1. Developer A: US3 (Recursive Composition) + US7 (Execution)
2. Developer B: US4 (Drill-Down) + US5 (Versioning)
3. Developer C: US6 (Dependencies) + US8 (Demo)
4. All converge for Polish phase

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in this phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its checkpoint
- Commit after each task or logical group
- US1 is the MVP — delivers immediate value by making the palette registry-driven
- US2 is the critical path — all subsequent stories depend on it
- US3-US7 can proceed in parallel after US2
- US8 is the integration test that validates the full feature
