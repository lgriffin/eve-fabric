# Tasks: Visual Pipeline Designer

**Input**: Design documents from `/specs/002-visual-pipeline-designer/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add compiler and execution packages as designer dependencies and prepare shared type foundations.

- [x] T001 Add packages/compiler, packages/domain, packages/planner, packages/executor, and packages/graphql as workspace dependencies in apps/designer/package.json
- [x] T002 Define execution state types (ExecutionNodeState, ExecutionSession, BridgingSuggestion) in apps/designer/src/stores/pipeline-store.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hooks and store enhancements that MUST be complete before ANY user story can be implemented.

**Warning**: No user story work can begin until this phase is complete.

- [x] T003 Enhance pipeline-store with compilation result state (diagnostics, executionPlan, graphqlSdl) and execution session state (stepStatuses, stepResults, stepMetrics) in apps/designer/src/stores/pipeline-store.ts
- [x] T004 Complete pipeline import in pipeline-serializer: implement YAML-to-flow conversion using pipelineToFlow() and handle layout metadata restoration in apps/designer/src/services/pipeline-serializer.ts
- [x] T005 Create useCompiler hook that converts canvas state to PipelineDefinition via flowToPipeline(), invokes compile() from packages/compiler, and stores results (diagnostics, plan) in the pipeline store in apps/designer/src/hooks/useCompiler.ts

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Build a Pipeline Visually (Priority: P1) MVP

**Goal**: Users can drag capabilities from the palette onto a canvas, connect typed ports, get real-time validation feedback, see unconnected required inputs highlighted, and receive bridging capability suggestions for type mismatches.

**Independent Test**: Drag capabilities onto canvas, connect ports, verify compatible connections succeed, incompatible connections are rejected, unmet inputs are highlighted, and bridging suggestions appear.

### Implementation for User Story 1

- [x] T006 [P] [US1] Enhance CapabilityNode to visually highlight unconnected required input ports with a warning indicator (pulsing border or icon) in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T007 [P] [US1] Enhance useConnectionValidator to query the catalog for bridging capabilities when a connection fails semantic type validation, using CapabilityCatalog.findBySemanticOutput() and findBySemanticInput() in apps/designer/src/hooks/useConnectionValidator.ts
- [x] T008 [US1] Enhance PipelineCanvas to display bridging suggestion UI (tooltip or inline prompt) when an invalid connection is attempted, offering to auto-insert the suggested intermediate node in apps/designer/src/components/canvas/PipelineCanvas.tsx
- [x] T009 [US1] Add self-loop rejection to PipelineCanvas onConnect handler (reject edges where source node equals target node) in apps/designer/src/components/canvas/PipelineCanvas.tsx

**Checkpoint**: User Story 1 is fully functional — users can build pipelines visually with semantic validation and bridging suggestions.

---

## Phase 4: User Story 2 — Inspect Node Details (Priority: P2)

**Goal**: When a user selects a node on the canvas, a detail panel displays the capability's full metadata: name, description, source, ports, authentication requirements, caching policy, and cost estimate.

**Independent Test**: Place any capability on the canvas, select it, and verify all metadata fields are displayed accurately in the detail panel.

### Implementation for User Story 2

- [x] T010 [US2] Create NodeDetailPanel component that receives a selected node and renders capability metadata (name, description, source badge, input/output ports with semantic types and required flags, auth scopes, cache policy fields, cost estimate) in apps/designer/src/components/detail/NodeDetailPanel.tsx
- [x] T011 [US2] Integrate NodeDetailPanel into App.tsx layout as a right-side panel that appears when a node is selected (reads selectedNode from pipeline-store) in apps/designer/src/App.tsx

**Checkpoint**: User Story 2 is fully functional — users can inspect any node's complete metadata.

---

## Phase 5: User Story 3 — Compile and View Generated Artifacts (Priority: P2)

**Goal**: The Validate button triggers real compilation via packages/compiler. Bottom panel tabs show live diagnostics, generated GraphQL SDL, and the execution plan with parallel groups and cost estimates. Artifacts update automatically when the pipeline changes.

**Independent Test**: Build a valid pipeline, click Validate, verify diagnostics are clean, GraphQL tab shows SDL, and Execution Plan tab shows step ordering. Introduce a type mismatch and verify diagnostics show the error with suggestion.

### Implementation for User Story 3

- [x] T012 [US3] Wire Toolbar Validate button to the useCompiler hook so clicking it compiles the current canvas state and stores results in apps/designer/src/components/shared/Toolbar.tsx
- [x] T013 [P] [US3] Enhance DiagnosticsPanel to render real CompilerDiagnostic objects with severity icons, node/edge location links, and actionable suggestion display (including SEMANTIC_SUGGESTION bridging hints) in apps/designer/src/components/preview/DiagnosticsPanel.tsx
- [x] T014 [P] [US3] Enhance GraphQLPreview to generate real SDL from the compiled pipeline using buildSchema() from packages/graphql, displaying the formatted schema with syntax highlighting and copy button in apps/designer/src/components/preview/GraphQLPreview.tsx
- [x] T015 [P] [US3] Enhance ExecutionPlanPreview to render real ExecutionPlan data showing steps grouped by parallelGroups, dependency chains, per-step cache strategy, and CostEstimate (total/parallel latency, ESI call count) in apps/designer/src/components/preview/ExecutionPlanPreview.tsx
- [x] T016 [US3] Add debounced auto-recompilation (300ms after last canvas change) in useCompiler hook so artifacts update automatically when the pipeline is modified in apps/designer/src/hooks/useCompiler.ts

**Checkpoint**: User Story 3 is fully functional — users see real compiler output, GraphQL schemas, and execution plans that update live.

---

## Phase 6: User Story 4 — Execute a Pipeline and View Results (Priority: P3)

**Goal**: Users click Execute to run a validated pipeline against configured data sources. The canvas animates node execution state in real time. A results panel shows output data alongside per-node timing, cache usage, and provenance. Failed nodes show errors inline.

**Independent Test**: Build a valid pipeline (e.g., Resolve Type → Market Orders), execute it, verify results appear with provenance and timing, and node execution states animate on the canvas.

### Implementation for User Story 4

- [x] T017 [P] [US4] Add POST /api/pipelines/execute endpoint to gateway that accepts a pipeline definition and inputs, compiles, executes via Executor, and returns ExecutionResult with outputs, provenance, metrics, stepStatuses, and errors in apps/gateway/src/server.ts
- [x] T018 [P] [US4] Add GET /api/pipelines/execute/stream SSE endpoint to gateway that streams step:queued, step:executing, step:completed, step:failed, step:skipped, execution:completed, and execution:failed events during pipeline execution in apps/gateway/src/server.ts
- [x] T019 [US4] Create useExecutor hook that sends pipeline to the SSE execution endpoint, processes incoming events to update pipeline-store step statuses and metrics in real time, and handles completion/failure in apps/designer/src/hooks/useExecutor.ts
- [x] T020 [P] [US4] Create ResultsPanel component that displays execution output data in a formatted view with per-node timing breakdown, cache hit/miss indicators, and provenance records (source, capability, retrievedAt, cached) in apps/designer/src/components/preview/ResultsPanel.tsx
- [x] T021 [US4] Enhance CapabilityNode to render execution state (idle: default, queued: grey pulse, executing: blue pulse, completed: green border, failed: red border with error icon, skipped: dimmed) by reading executionState from the pipeline-store in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T022 [US4] Enhance PipelineCanvas to animate edges during execution (animated=true for edges connecting executing/completed nodes) and reset animation state on execution completion in apps/designer/src/components/canvas/PipelineCanvas.tsx
- [x] T023 [US4] Add Execute button to Toolbar (disabled when pipeline has compilation errors or execution is in progress), wire to useExecutor.execute() in apps/designer/src/components/shared/Toolbar.tsx
- [x] T024 [US4] Display execution errors inline: failed nodes show error tooltip on canvas, diagnostics panel adds execution errors alongside compilation diagnostics in apps/designer/src/components/canvas/CapabilityNode.tsx and apps/designer/src/components/preview/DiagnosticsPanel.tsx
- [x] T025 [US4] Add Results tab to bottom panel tab bar in App.tsx, rendering ResultsPanel when execution results exist in the pipeline-store in apps/designer/src/App.tsx

**Checkpoint**: User Story 4 is fully functional — users can execute pipelines with real-time visualization and detailed results.

---

## Phase 7: User Story 5 — Save, Load, and Share Pipelines (Priority: P3)

**Goal**: Users can save pipelines with a name, load them later with full canvas restoration, export as YAML files, and import YAML files from others. The exported format is the standard PipelineDefinition used by the compiler.

**Independent Test**: Build a pipeline, save it, clear the canvas, load it back, verify all nodes, edges, and positions are restored. Export, then import the file and verify equivalence.

### Implementation for User Story 5

- [x] T026 [P] [US5] Add pipeline CRUD endpoints to gateway: POST /api/pipelines (save), GET /api/pipelines (list), GET /api/pipelines/:id (load), DELETE /api/pipelines/:id (delete) with YAML body persistence in apps/gateway/src/server.ts
- [x] T027 [US5] Enhance useGatewayApi with savePipeline(), loadPipeline(), listPipelines(), and deletePipeline() methods that call the gateway CRUD endpoints in apps/designer/src/hooks/useGatewayApi.ts
- [x] T028 [P] [US5] Add save dialog to Toolbar: clicking Save opens a modal/popover for pipeline name input, calls useGatewayApi.savePipeline() with the current canvas state serialized via flowToPipeline() in apps/designer/src/components/shared/Toolbar.tsx
- [x] T029 [P] [US5] Add load dialog to Toolbar: clicking Load opens a modal listing saved pipelines via useGatewayApi.listPipelines(), selecting one calls loadPipeline() and restores canvas via pipelineToFlow() in apps/designer/src/components/shared/Toolbar.tsx
- [x] T030 [US5] Implement pipeline export: Toolbar Export button serializes current canvas to PipelineDefinition YAML via pipelineToYaml() and triggers browser file download in apps/designer/src/components/shared/Toolbar.tsx
- [x] T031 [US5] Implement pipeline import: Toolbar Import button opens a file picker, reads the selected YAML file, parses it via pipeline-serializer, and populates the canvas via pipelineToFlow() in apps/designer/src/components/shared/Toolbar.tsx

**Checkpoint**: User Story 5 is fully functional — pipelines can be saved, loaded, exported, and imported.

---

## Phase 8: User Story 6 — Smart Pipeline Assistance (Priority: P3)

**Goal**: The palette proactively highlights capabilities that can satisfy unconnected inputs on a selected node. Users can filter the palette to show only capabilities compatible with a selected node's outputs. Shared data paths (fan-out) are visually distinct.

**Independent Test**: Place a node with unconnected inputs, verify the palette highlights compatible capabilities. Select a node and use "show compatible" filter, verify only matching capabilities appear.

### Implementation for User Story 6

- [x] T032 [US6] Enhance CapabilityPalette to detect unconnected required inputs on the selected node and highlight palette capabilities whose outputs match those input semantic types using catalog.findBySemanticOutput() in apps/designer/src/components/palette/CapabilityPalette.tsx
- [x] T033 [US6] Add "show compatible next" toggle to CapabilityPalette that, when active, filters the palette to only show capabilities whose inputs match the selected node's output semantic types using catalog.findBySemanticInput() in apps/designer/src/components/palette/CapabilityPalette.tsx
- [x] T034 [US6] Add visual distinction for fan-out edges on the canvas: when one output port connects to multiple input ports, render those edges with a distinct style (thicker line or different color) in apps/designer/src/components/canvas/PipelineCanvas.tsx

**Checkpoint**: User Story 6 is fully functional — the designer provides intelligent composition assistance.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Performance, edge cases, and final quality pass.

- [x] T035 [P] Performance optimization: wrap CapabilityNode in React.memo, memoize catalog lookups in catalog-store, ensure compilation debounce is effective in apps/designer/src/components/canvas/CapabilityNode.tsx and apps/designer/src/stores/catalog-store.ts
- [x] T036 [P] Edge case handling: empty catalog state (show helpful message in palette), saved pipeline with missing capabilities (show warning on load, render nodes as unknown), unreachable gateway (show connection error banner) across apps/designer/src/components/
- [ ] T037 Run quickstart.md validation: start gateway and designer, walk through the Market Price Lookup example pipeline from quickstart.md, verify all steps work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — no other story dependencies
- **US2 (Phase 4)**: Depends on Foundational — no other story dependencies
- **US3 (Phase 5)**: Depends on Foundational (uses useCompiler from T005) — no other story dependencies
- **US4 (Phase 6)**: Depends on Foundational AND US3 (needs compilation before execution)
- **US5 (Phase 7)**: Depends on Foundational — no other story dependencies
- **US6 (Phase 8)**: Depends on Foundational AND US1 (builds on palette/canvas from US1)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational
- **US2 (P2)**: Independent after Foundational — can run in parallel with US1 and US3
- **US3 (P2)**: Independent after Foundational — can run in parallel with US1 and US2
- **US4 (P3)**: Depends on US3 (compilation must work before execution)
- **US5 (P3)**: Independent after Foundational — can run in parallel with US1-US3
- **US6 (P3)**: Depends on US1 (smart assistance enhances base pipeline building)

### Within Each User Story

- Core components before integration
- Store/hook changes before UI components that consume them
- Gateway endpoints before client hooks that call them

### Parallel Opportunities

- T006 and T007 can run in parallel (different files)
- T013, T014, and T015 can run in parallel (different preview components)
- T017 and T018 can run in parallel (separate gateway endpoints)
- T020 can run in parallel with T017/T018 (ResultsPanel is UI-only)
- T026, T028, and T029 can run in parallel (separate concerns)
- US1, US2, US3, and US5 can all start in parallel after Foundational phase

---

## Parallel Example: User Story 3

```text
# Launch parallel preview panel tasks (different files, no dependencies):
Task T013: "Enhance DiagnosticsPanel in apps/designer/src/components/preview/DiagnosticsPanel.tsx"
Task T014: "Enhance GraphQLPreview in apps/designer/src/components/preview/GraphQLPreview.tsx"
Task T015: "Enhance ExecutionPlanPreview in apps/designer/src/components/preview/ExecutionPlanPreview.tsx"
```

## Parallel Example: User Story 4

```text
# Launch parallel gateway + UI tasks:
Task T017: "Add execute endpoint in apps/gateway/src/server.ts"
Task T020: "Create ResultsPanel in apps/designer/src/components/preview/ResultsPanel.tsx"

# Then after T017/T018 complete:
Task T019: "Create useExecutor hook (depends on gateway endpoints)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. **STOP and VALIDATE**: Drag capabilities, connect ports, verify semantic validation and bridging suggestions
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test drag-drop and validation → MVP!
3. Add US2 + US3 in parallel → Test inspection and compilation → Design-time complete
4. Add US4 → Test execution with real data → Execute-time complete
5. Add US5 → Test save/load/import/export → Persistence complete
6. Add US6 → Test smart assistance → Full feature complete
7. Polish → Performance, edge cases, quickstart validation

### Parallel Team Strategy

With multiple developers after Foundational is complete:

- Developer A: US1 (canvas + validation) then US6 (smart assistance)
- Developer B: US2 (detail panel) + US3 (compilation + artifacts)
- Developer C: US5 (persistence) then US4 (execution — needs US3 done)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- The existing designer app already has canvas, palette, node rendering, and stub panels — tasks enhance these rather than creating from scratch
- All compilation uses packages/compiler directly (Constitution Principle XVI) — no designer-specific compilation logic
- Execution is server-side only via gateway API (Constitution Principle XV) — credentials never in browser
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
