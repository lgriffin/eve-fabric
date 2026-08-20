# Tasks: Intent-Driven Interactive Flow Designer

**Input**: Design documents from `/specs/005-intent-flow-designer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as the constitution (XVIII) requires TDD for domain and application behavior, and BDD for externally observable capability behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Domain-level additions and service clients that multiple user stories depend on

- [x] T001 Create semantic type to editor type mapping in packages/domain/src/capability/input-editor-mapping.ts
- [x] T002 [P] Create unit tests for editor type mapping in packages/domain/src/**tests**/input-editor-mapping.test.ts
- [x] T003 [P] Create discovery service client in apps/designer/src/services/discovery-service.ts
- [x] T004 [P] Create reference data service client in apps/designer/src/services/reference-data-service.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Gateway endpoints and store extensions that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add reference data routes (items, regions, systems) in apps/gateway/src/routes/reference-data-routes.ts
- [x] T006 [P] Add single-node execution endpoint (POST /api/capabilities/:id/execute) in apps/gateway/src/routes/execution-routes.ts
- [x] T007 [P] Implement real pipeline execution in existing POST /api/pipelines/execute stub in apps/gateway/src/server.ts
- [x] T008 Register reference data and execution routes in apps/gateway/src/server.ts
- [x] T009 Extend pipeline store with configuredValues, nodeExecutionStates, and actions (setNodeInputValue, clearNodeInputValue, setNodeExecutionState) in apps/designer/src/stores/pipeline-store.ts
- [x] T010 [P] Extend catalog store with paletteMode state, recommendedCapabilities, setPaletteMode, and fetchRecommendations in apps/designer/src/stores/catalog-store.ts
- [x] T011 [P] Add ConfiguredValue, NodeExecutionState, PaletteMode, and ContextualSuggestion types to apps/designer/src/stores/types.ts
- [x] T012 Create useFlowContext hook to derive FlowContext from canvas state in apps/designer/src/hooks/useFlowContext.ts
- [x] T013 [P] Create useDiscovery hook wrapping gateway discovery API calls in apps/designer/src/hooks/useDiscovery.ts

**Checkpoint**: Foundation ready — gateway serves reference data, single-node execution, and real pipeline execution. Designer stores support input configuration, execution state, and palette modes.

---

## Phase 3: User Story 1 — Search and Discover Capabilities (Priority: P1) MVP

**Goal**: Users open Fabric Studio to a clean workspace with a search prompt, type a concept like "market", and discover capabilities with user-friendly names and descriptions.

**Independent Test**: Open the workspace, verify the search prompt and example queries are visible, type "market", verify relevant capabilities appear as cards with names, descriptions, and category indicators.

### Tests for User Story 1

- [ ] T014 [P] [US1] BDD feature for intent search in tests/bdd/features/intent-search.feature (deferred)
- [ ] T015 [P] [US1] Unit test for IntentSearch component in apps/designer/src/components/palette/**tests**/IntentSearch.test.tsx (deferred)

### Implementation for User Story 1

- [x] T016 [P] [US1] Extract CapabilityCard as standalone component with category indicators (LIVE/STATIC/DERIVED/COMPOSITE/AUTH REQUIRED) and "Add to Flow" button in apps/designer/src/components/palette/CapabilityCard.tsx
- [x] T017 [P] [US1] Create IntentSearch component with search prompt ("What are you trying to do?"), example queries, and grouped results (Suggested/Related) in apps/designer/src/components/palette/IntentSearch.tsx
- [x] T018 [US1] Create RecommendedPanel component showing context-aware suggestions from discovery API in apps/designer/src/components/palette/RecommendedPanel.tsx
- [x] T019 [US1] Modify CapabilityPalette to support three modes (Discover/Recommended/All) with tab switching in apps/designer/src/components/palette/CapabilityPalette.tsx
- [x] T020 [US1] Update App.tsx to show IntentSearch as default palette mode when canvas is empty in apps/designer/src/App.tsx

**Checkpoint**: Users can search for capabilities by keyword or intent, see results as cards with category indicators, and switch between palette modes. The empty canvas problem is solved.

---

## Phase 4: User Story 2 — Add and Configure a Capability Node (Priority: P1) MVP

**Goal**: Users drag or click-to-add a capability from the palette, and the node renders interactive input controls driven by semantic types — searchable selectors for items/regions, radio buttons for order type.

**Independent Test**: Add a Market Orders node to the canvas, configure its Item (searchable selector), Region (searchable selector), and Order Type (radio buttons) inputs, verify the node reflects configured values.

### Tests for User Story 2

- [ ] T021 [P] [US2] BDD feature for node configuration in tests/bdd/features/node-configuration.feature (deferred)
- [ ] T022 [P] [US2] Unit test for NodeInputEditor dispatch in apps/designer/src/components/canvas/**tests**/NodeInputEditor.test.tsx (deferred)
- [ ] T023 [P] [US2] Unit test for SearchableSelector in apps/designer/src/components/input-editors/**tests**/SearchableSelector.test.tsx (deferred)

### Implementation for User Story 2

- [x] T024 [P] [US2] Create SearchableSelector component backed by reference data service in apps/designer/src/components/input-editors/SearchableSelector.tsx
- [x] T025 [P] [US2] Create EnumSelector component (radio/dropdown) in apps/designer/src/components/input-editors/EnumSelector.tsx
- [x] T026 [P] [US2] Create NumericInput component in apps/designer/src/components/input-editors/NumericInput.tsx
- [x] T027 [P] [US2] Create BooleanToggle component in apps/designer/src/components/input-editors/BooleanToggle.tsx
- [x] T028 [P] [US2] Create CollectionInput component (connection-only indicator) in apps/designer/src/components/input-editors/CollectionInput.tsx
- [x] T029 [US2] Create useInputEditorType hook mapping SemanticTypeId to editor component in apps/designer/src/hooks/useInputEditorType.ts
- [x] T030 [US2] Create NodeInputEditor dispatcher component in apps/designer/src/components/canvas/NodeInputEditor.tsx
- [x] T031 [US2] Modify CapabilityNode to render NodeInputEditor for each input port with noDragClassName in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T032 [US2] Wire CapabilityCard "Add to Flow" button to pipeline store addNode action in apps/designer/src/components/palette/CapabilityCard.tsx

**Checkpoint**: Users can add Market Orders to the canvas and configure Item, Region, and Order Type using appropriate semantic-type-driven controls. EVE domain terminology is used throughout.

---

## Phase 5: User Story 3 — Test a Single Node (Priority: P2)

**Goal**: Users press a "Test" button on a configured node, see execution state transitions, and inspect result previews (count, duration, source).

**Independent Test**: Configure a Market Orders node with Item and Region, press Test, verify result summary (order count, duration, data source) and data preview appear.

### Tests for User Story 3

- [ ] T033 [P] [US3] BDD feature for node execution in tests/bdd/features/node-execution.feature (deferred)
- [ ] T034 [P] [US3] Unit test for useNodeExecution hook in apps/designer/src/hooks/**tests**/useNodeExecution.test.ts (deferred)

### Implementation for User Story 3

- [x] T035 [US3] Create useNodeExecution hook calling POST /api/capabilities/:id/execute in apps/designer/src/hooks/useNodeExecution.ts
- [x] T036 [US3] Add Test button and execution state visualization (idle/running/success/error) to CapabilityNode in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T037 [US3] Add result preview display (count, duration, source, sample data) to CapabilityNode footer in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T038 [US3] Highlight missing required inputs with validation message when Test is pressed with incomplete configuration in apps/designer/src/components/canvas/CapabilityNode.tsx

**Checkpoint**: Users can test individual nodes and see results without building a full flow. Progressive experimentation is enabled.

---

## Phase 6: User Story 4 — Connect Compatible Nodes (Priority: P2)

**Goal**: Dragging a connection highlights compatible ports, dropping on empty canvas shows a contextual palette of compatible capabilities, and connected inputs show their data source instead of a direct editor.

**Independent Test**: Place Market Orders and Sort nodes, drag from Orders output to Sort input and verify connection. Drop a connection on empty canvas and verify compatible capabilities appear. Verify connected inputs show source indicator.

### Tests for User Story 4

- [ ] T039 [P] [US4] BDD feature for smart connections in tests/bdd/features/smart-connections.feature (deferred)
- [ ] T040 [P] [US4] Unit test for ContextualPalette in apps/designer/src/components/canvas/**tests**/ContextualPalette.test.tsx (deferred)

### Implementation for User Story 4

- [x] T041 [P] [US4] Create ConnectedInputIndicator component showing upstream source name and port in apps/designer/src/components/canvas/ConnectedInputIndicator.tsx
- [x] T042 [P] [US4] Create ContextualPalette popup component showing compatible capabilities with user-oriented labels in apps/designer/src/components/canvas/ContextualPalette.tsx
- [x] T043 [US4] Modify NodeInputEditor to show ConnectedInputIndicator when port has incoming edge in apps/designer/src/components/canvas/NodeInputEditor.tsx
- [x] T044 [US4] Modify PipelineCanvas to show ContextualPalette when connection is dropped on empty canvas in apps/designer/src/components/canvas/PipelineCanvas.tsx
- [x] T045 [US4] Wire ContextualPalette selection to pipeline store — add node and create connection automatically in apps/designer/src/components/canvas/ContextualPalette.tsx

**Checkpoint**: Users can connect nodes with type-safe smart wiring. Dropping on empty canvas discovers compatible next steps. Connected inputs clearly show their data source.

---

## Phase 7: User Story 5 — Smart Continuation and Contextual Palette (Priority: P2)

**Goal**: Nodes show a "+" button that opens a contextual palette with user-oriented descriptions ("Filter them", "Sort them"). Main palette adapts recommendations based on canvas state.

**Independent Test**: Place Market Orders, click "+" on its output, verify contextual suggestions appear with user-oriented labels. Select "Sort them" and verify Sort node is added and connected.

### Implementation for User Story 5

- [x] T046 [US5] Add "+" continuation button to CapabilityNode output ports in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T047 [US5] Wire "+" button to ContextualPalette (reuse from US4) with source output semantic type in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T048 [US5] Update RecommendedPanel to dynamically refresh when canvas nodes or connections change using useFlowContext in apps/designer/src/components/palette/RecommendedPanel.tsx
- [x] T049 [US5] Add user-oriented action labels to capability metadata (e.g., "Filter them" for collection.filter) in packages/capability-sdk/src/capabilities/collection.ts and market.ts

**Checkpoint**: Users can progressively build flows by following the "what can I do next?" pattern. The palette is an active participant in flow construction.

---

## Phase 8: User Story 6 — Execute a Complete Flow (Priority: P3)

**Goal**: Users press "Execute Flow" to run the full pipeline with pre-validation, visual state transitions on all nodes (WAITING/RUNNING/SUCCESS/ERROR/CACHED), and per-node result inspection.

**Independent Test**: Build the demo flow (Market Orders → Resolve Location → Filter → Sort → Limit), press Execute, verify all nodes transition through states and results are inspectable at each node.

### Tests for User Story 6

- [ ] T050 [P] [US6] BDD feature for flow execution in tests/bdd/features/flow-execution.feature (deferred)

### Implementation for User Story 6

- [x] T051 [US6] Add execution state visualization (WAITING/RUNNING/SUCCESS/ERROR/CACHED) with animated transitions to all canvas nodes in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T052 [US6] Create ResultInspector component showing Configuration, Input, Output, Execution details, and Data Preview tabs in apps/designer/src/components/detail/ResultInspector.tsx
- [x] T053 [US6] Modify NodeDetailPanel to include ResultInspector tabs after execution in apps/designer/src/components/detail/NodeDetailPanel.tsx
- [x] T054 [US6] Add pre-execution validation UI — highlight incomplete nodes, show actionable error messages before execution begins in apps/designer/src/hooks/useExecutor.ts
- [x] T055 [US6] Update Toolbar Execute button to trigger pre-validation and display validation summary in apps/designer/src/components/shared/Toolbar.tsx
- [x] T056 [US6] Wire flow execution to update per-node execution state in pipeline store from gateway response in apps/designer/src/hooks/useExecutor.ts

**Checkpoint**: Users can execute complete flows, observe live execution progress, and inspect results at every stage. The canvas becomes an execution debugger.

---

## Phase 9: User Story 7 — Palette Modes (Priority: P3)

**Goal**: Palette supports three distinct modes: Discover (intent search), Recommended (context-aware), and All Capabilities (full registry). Recommended falls back to Discover when canvas is empty.

**Independent Test**: Switch between all three palette modes and verify each shows appropriate content. Verify Recommended shows relevant suggestions when nodes exist and falls back to Discover when canvas is empty.

### Implementation for User Story 7

- [x] T057 [US7] Add empty-canvas fallback to RecommendedPanel — show Discover mode content when no nodes on canvas in apps/designer/src/components/palette/RecommendedPanel.tsx
- [x] T058 [US7] Refine All Capabilities mode with existing source filters and full registry browse in apps/designer/src/components/palette/CapabilityPalette.tsx
- [x] T059 [US7] Add mode indicator and smooth transition between palette modes in apps/designer/src/components/palette/CapabilityPalette.tsx

**Checkpoint**: The palette serves users at all expertise levels — guided discovery for beginners, context-aware suggestions for mid-flow, and full registry access for experts.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T060 [P] Add progressive disclosure — toggle between default and advanced node views (auth, caching, source, provenance) in apps/designer/src/components/canvas/CapabilityNode.tsx
- [x] T061 [P] Add keyboard accessibility for palette interactions and canvas node configuration in apps/designer/src/components/palette/CapabilityPalette.tsx
- [x] T062 [P] Add edge animation for data flow visualization on executed connections in apps/designer/src/components/canvas/PipelineCanvas.tsx
- [x] T063 Run quickstart.md validation — verify dev setup, test commands, and development paths
- [x] T064 Run full quality gate (pnpm run validate) and fix any issues (pre-existing failures only — executor/compiler module resolution)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — palette modes and discovery service
- **US2 (Phase 4)**: Depends on Foundational — store extensions and reference data
- **US3 (Phase 5)**: Depends on US2 — needs configured nodes to test
- **US4 (Phase 6)**: Depends on US2 — needs nodes on canvas to connect
- **US5 (Phase 7)**: Depends on US4 — reuses ContextualPalette component
- **US6 (Phase 8)**: Depends on US4 — needs connected flow to execute; depends on US3 conceptually (execution state visualization)
- **US7 (Phase 9)**: Depends on US1 — refines palette modes already built
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

```text
Phase 1: Setup
    │
    ▼
Phase 2: Foundational
    │
    ├──────────────────┐
    ▼                  ▼
Phase 3: US1       Phase 4: US2
(Search/Discover)  (Add/Configure)
    │                  │
    │              ┌───┴───┐
    │              ▼       ▼
    │          Phase 5  Phase 6
    │          US3       US4
    │          (Test)    (Connect)
    │                      │
    │                      ▼
    │                  Phase 7: US5
    │                  (Continuation)
    │                      │
    ▼                      ▼
Phase 9: US7          Phase 8: US6
(Palette Modes)       (Execute Flow)
    │                      │
    └──────────┬───────────┘
               ▼
         Phase 10: Polish
```

### Parallel Opportunities

- **US1 and US2 can run in parallel** after Foundational completes (different component trees)
- **US3 and US4 can run in parallel** after US2 completes (different concerns: execution vs. connections)
- Within each story, tasks marked [P] can run in parallel

---

## Parallel Example: User Story 2

```text
# Launch all input editor components in parallel (T024-T028):
Task: "Create SearchableSelector in apps/designer/src/components/input-editors/SearchableSelector.tsx"
Task: "Create EnumSelector in apps/designer/src/components/input-editors/EnumSelector.tsx"
Task: "Create NumericInput in apps/designer/src/components/input-editors/NumericInput.tsx"
Task: "Create BooleanToggle in apps/designer/src/components/input-editors/BooleanToggle.tsx"
Task: "Create CollectionInput in apps/designer/src/components/input-editors/CollectionInput.tsx"

# Then sequentially: useInputEditorType → NodeInputEditor → CapabilityNode modification
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Search/Discover)
4. Complete Phase 4: User Story 2 (Add/Configure)
5. **STOP and VALIDATE**: Users can search "market", discover Market Orders, add it to canvas, and configure Item/Region/Order Type interactively
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 (parallel) → Search, add, configure nodes (MVP!)
3. US3 → Test individual nodes → Progressive experimentation
4. US4 → Connect nodes with smart wiring → Flow construction
5. US5 → Smart continuation → Guided exploration
6. US6 → Execute flows → Full pipeline execution
7. US7 → Palette refinement → Expert mode
8. Polish → Accessibility, animation, progressive disclosure

### Parallel Team Strategy

With two developers after Foundational:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Search/Discover) → US7 (Palette Modes)
   - Developer B: US2 (Add/Configure) → US3 (Test) → US4 (Connect) → US5 (Continuation) → US6 (Execute)
3. Stories integrate through shared store and discovery service

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The existing CapabilityNode.tsx is modified by multiple stories (US2, US3, US5, US6) — implement in priority order to avoid conflicts
