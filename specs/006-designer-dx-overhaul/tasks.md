# Tasks: Designer DX Overhaul

**Input**: Design documents from `/specs/006-designer-dx-overhaul/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — the constitution (XVIII) requires TDD for domain behavior and the plan explicitly lists tests per phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Resolve merge conflicts and prepare dependencies before any feature work.

- [x] T001 [P] Resolve merge conflict in `apps/gateway/src/server.ts` — keep the real compiler/executor implementation for `POST /api/pipelines/execute`, discard mock data version
- [x] T002 [P] Resolve merge conflict in `apps/designer/src/services/pipeline-serializer.ts` — trivial blank-line difference, keep either side
- [x] T003 [P] Resolve merge conflict in `apps/designer/src/stores/pipeline-store.ts` — formatting difference around `compiledPlan`, keep either side
- [x] T004 Add `@dagrejs/dagre` and `@types/dagre` to `apps/designer/package.json` and run `pnpm install`
- [x] T005 Add Vite dev server proxy in `apps/designer/vite.config.ts` — configure `server.proxy: { '/api': { target: 'http://localhost:3456', changeOrigin: true } }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Create unified gateway client in `apps/designer/src/services/gateway-client.ts` — typed methods `getCapabilities()`, `savePipeline()`, `executePipeline()`, `publishComposite()` using relative `/api/` paths. Return `GatewayResult<T>` discriminated union per `contracts/gateway-client-api.md`. Remove all `gatewayUrl()` function copies from `useGatewayApi.ts`, `useExecutor.ts`, `discovery-service.ts`, `reference-data-service.ts`
- [x] T007 [P] Write unit tests for gateway client in `apps/designer/tests/services/gateway-client.test.ts` — test each method with mocked fetch (success + network error + non-200 responses)
- [x] T008 [P] Add Toast and UndoEntry types to `apps/designer/src/stores/types.ts` per data-model.md entity definitions

**Checkpoint**: Foundation ready — gateway client available, all merge conflicts resolved, dependencies installed.

---

## Phase 3: User Story 1 — Capabilities Load From Gateway (Priority: P0) MVP

**Goal**: The capability palette populates with all registered capabilities grouped by source on startup. Error banner with retry when gateway is unreachable.

**Independent Test**: Launch the designer with the gateway running → palette shows capabilities grouped by ESI/SDE/DERIVED/COMPOSITE with correct counts. Stop the gateway → error banner appears with retry button.

### Tests for User Story 1

- [x] T009 [P] [US1] Write test for catalog loading in `apps/designer/tests/stores/catalog-store.test.ts` — verify `fetchCapabilities` calls gateway client, unwraps `{ capabilities }` response, enriches with categories, sets error state on failure

### Implementation for User Story 1

- [x] T010 [US1] Update `apps/designer/src/stores/catalog-store.ts` to use gateway client — replace direct fetch with `gatewayClient.getCapabilities()`, add `error: string | null` and `isLoading: boolean` state fields, set error state on `GatewayResult.ok === false`
- [x] T011 [US1] Add error banner and retry button to `apps/designer/src/components/palette/CapabilityPalette.tsx` — when `error` is set in catalog store, show banner with error message, guidance to start gateway (`pnpm --filter @eve-fabric/gateway dev`), and a retry button that re-calls `fetchCapabilities()`
- [x] T012 [US1] Update `apps/designer/src/hooks/useGatewayApi.ts` to use gateway client — replace `gatewayUrl()` calls with gateway client methods, or remove the hook entirely if catalog-store now handles loading directly

**Checkpoint**: Palette loads from gateway. Error states visible. User Story 1 independently testable.

---

## Phase 4: User Story 2 — YAML Import With Auto-Layout (Priority: P0)

**Goal**: Example pipeline YAML files import correctly with directed graph layout (not flat grid). Malformed YAML shows parse error.

**Independent Test**: Import `examples/market-schema/pipeline.yaml` → 2 nodes with 3 edges in LR layout. Import `examples/trade-opportunity/pipeline.yaml` → 3 nodes with 5 edges. Import malformed YAML → error notification, canvas unchanged.

### Tests for User Story 2

- [x] T013 [P] [US2] Write tests for layout engine in `apps/designer/tests/services/layout-engine.test.ts` — test dagre LR layout positions nodes left-to-right, no overlapping, handles single node and disconnected nodes
- [x] T014 [P] [US2] Write tests for YAML import in `apps/designer/tests/services/pipeline-serializer.test.ts` — test all three example pipelines (`market-schema`, `route-schema`, `trade-opportunity`) produce correct node count, edge count, and handle malformed YAML gracefully

### Implementation for User Story 2

- [x] T015 [US2] Create layout engine in `apps/designer/src/services/layout-engine.ts` — dagre-based function accepting React Flow nodes/edges, returning repositioned nodes in left-to-right directed graph layout with configurable spacing
- [x] T016 [US2] Wire auto-layout into YAML import flow — update the import path in `apps/designer/src/App.tsx` (or extracted hook) to call layout engine after `pipelineToFlow()` conversion, before `loadPipeline()`
- [x] T017 [US2] Add "Re-layout" button to `apps/designer/src/components/shared/Toolbar.tsx` — triggers layout engine on current nodes/edges and updates pipeline store

**Checkpoint**: All example pipelines import with correct topology and readable graph layout. User Story 2 independently testable.

---

## Phase 5: User Story 3 — Errors Are Visible and Actionable (Priority: P1)

**Goal**: Every failed operation shows a toast notification. Zero silent failures.

**Independent Test**: Stop gateway mid-session → click Save → toast appears. Click Execute → toast appears. Connect incompatible ports → rejection tooltip.

### Tests for User Story 3

- [x] T018 [P] [US3] Write tests for toast store in `apps/designer/tests/stores/toast-store.test.ts` — test addToast, dismissToast, auto-dismiss after 8s (fake timers), toast queue limit, severity levels

### Implementation for User Story 3

- [x] T019 [US3] Create toast store in `apps/designer/src/stores/toast-store.ts` — Zustand store with `toasts` array, `addToast(severity, title, message)`, `dismissToast(id)`. Auto-dismiss via `setTimeout(8000)`. Generate unique IDs. Cap queue at 5 visible toasts.
- [x] T020 [US3] Create toast container in `apps/designer/src/components/shared/ToastContainer.tsx` — React portal rendering toasts from store. Severity-based styling (error=red, warning=yellow, success=green, info=blue). Dismiss button. Stack from bottom-right.
- [x] T021 [US3] Mount ToastContainer in `apps/designer/src/App.tsx` — render as last child in the root component
- [x] T022 [US3] Wire error handling into all gateway consumers — update `apps/designer/src/stores/catalog-store.ts`, `apps/designer/src/hooks/useExecutor.ts`, `apps/designer/src/stores/pipeline-store.ts` (save/publish), `apps/designer/src/components/detail/NodeDetailPanel.tsx` to call `addToast('error', ...)` on gateway client failures. Add success toasts for save and publish operations.

**Checkpoint**: All API failures produce visible notifications. Zero catch blocks silently swallow errors. User Story 3 independently testable.

---

## Phase 6: User Story 4 — Execute With Inputs (Priority: P1)

**Goal**: Clicking Execute shows an input dialog for pipelines with required inputs. Pre-fills last-used values. Skips dialog for pipelines with no inputs.

**Independent Test**: Build pipeline with typeId/regionId inputs → click Execute → dialog shows both inputs → fill and Run → results appear. Click Execute again → values pre-filled.

### Tests for User Story 4

- [x] T023 [P] [US4] Write tests for execution input dialog in `apps/designer/tests/components/ExecutionInputDialog.test.ts` — test renders input fields from pipeline inputs, pre-fills from localStorage, calls onSubmit with values, Cancel closes without executing, skips dialog when no required inputs

### Implementation for User Story 4

- [x] T024 [US4] Create execution input dialog in `apps/designer/src/components/shared/ExecutionInputDialog.tsx` — modal listing pipeline inputs with name, semantic type, description. Each input gets a text field. Pre-fill from `localStorage` using pipeline ID as key. "Run" button submits values, "Cancel" closes. Save values to localStorage on submit.
- [x] T025 [US4] Wire ExecutionInputDialog into execute flow in `apps/designer/src/hooks/useExecutor.ts` — before executing, check if pipeline has required inputs. If yes, show dialog and wait for user values. If no required inputs, execute immediately. Pass collected inputs to `gatewayClient.executePipeline()`.
- [x] T026 [US4] Differentiate Save vs Export in `apps/designer/src/components/shared/Toolbar.tsx` — Save button calls `gatewayClient.savePipeline()` + success toast. Export YAML button triggers file download via Blob/anchor. Two distinct buttons with different icons/labels.

**Checkpoint**: Parameterized pipelines can be executed with user-provided inputs. Save and Export are separate actions. User Story 4 independently testable.

---

## Phase 7: User Story 5 — Undo and Redo (Priority: P2)

**Goal**: Canvas mutations (add/delete nodes, add/delete edges) can be undone and redone. Toolbar shows undo/redo buttons with availability.

**Independent Test**: Delete a node → Ctrl+Z → node and edges restored. Undo → Ctrl+Shift+Z → node deleted again. Add new node after undo → redo stack cleared.

### Tests for User Story 5

- [x] T027 [P] [US5] Write tests for history middleware in `apps/designer/tests/stores/history-middleware.test.ts` — test push/undo/redo, ring buffer overflow at 50 entries, clear redo on new action, empty history no-ops, snapshot captures nodes+edges only

### Implementation for User Story 5

- [x] T028 [US5] Create history middleware in `apps/designer/src/stores/history-middleware.ts` — Zustand middleware that intercepts canvas-mutating actions (`onNodesChange`, `onEdgesChange`, `onConnect`, `addNode`, `removeNode`). Pushes `{nodes, edges}` snapshot before mutation. Ring buffer of 50. Exposes `undo()`, `redo()`, `canUndo`, `canRedo`, `undoCount`, `redoCount`.
- [x] T029 [US5] Wire history middleware into pipeline store in `apps/designer/src/stores/pipeline-store.ts` — wrap store creation with history middleware. Export `undo`, `redo`, `canUndo`, `canRedo` from the store.
- [x] T030 [US5] Add undo/redo buttons to `apps/designer/src/components/shared/Toolbar.tsx` — undo button (disabled when `!canUndo`, shows count), redo button (disabled when `!canRedo`). Wire `beforeunload` listener when `isDirty` is true.

**Checkpoint**: All canvas operations are reversible. Toolbar reflects undo/redo state. User Story 5 independently testable.

---

## Phase 8: User Story 6 — Keyboard Shortcuts (Priority: P2)

**Goal**: Common operations accessible via keyboard. Help overlay shows all shortcuts.

**Independent Test**: Select a node → press Delete → node removed. Press Ctrl+S → save triggers. Press `?` → help overlay appears.

### Tests for User Story 6

- [x] T031 [P] [US6] Write tests for keyboard shortcuts in `apps/designer/tests/hooks/useKeyboardShortcuts.test.ts` — test each shortcut fires correct action, focus-awareness (no trigger in text inputs), modifier key combinations

### Implementation for User Story 6

- [x] T032 [US6] Create keyboard shortcut handler in `apps/designer/src/hooks/useKeyboardShortcuts.ts` — register shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Delete/Backspace (remove selected), Ctrl+S (save, prevent default), Escape (clear selection, close dialogs), `?` (toggle help overlay), Ctrl+A (select all). Focus-aware: ignore when `activeElement` is input/textarea/contenteditable.
- [x] T033 [US6] Create shortcuts overlay in `apps/designer/src/components/shared/ShortcutsOverlay.tsx` — modal with grouped two-column table (shortcut key | action description). Categories: File, Editing, Navigation. Close on Escape or clicking outside.
- [x] T034 [US6] Wire keyboard shortcuts into designer — call `useKeyboardShortcuts()` in `apps/designer/src/App.tsx` or `apps/designer/src/components/canvas/PipelineCanvas.tsx`. Pass action handlers for save, undo, redo, delete, select-all, help-toggle.

**Checkpoint**: All documented shortcuts work correctly. Help overlay displays all bindings. User Story 6 independently testable.

---

## Phase 9: User Story 7 — Code Quality and Architecture (Priority: P3)

**Goal**: Refactor for maintainability without changing user-visible behavior. Zero test regressions.

**Independent Test**: Run `pnpm run validate` — all tests pass, lint passes, typecheck passes. Manual smoke test: palette loads, import works, save works, execute works, undo works, shortcuts work.

### Implementation for User Story 7

- [x] T035 [P] [US7] Create design tokens in `apps/designer/src/tokens.ts` — centralize all colors: surface (`#13131d`, `#1e1e2e`, `#2a2a3e`, `#333`), accent (`#7c4dff`), source categories (ESI=`#4fc3f7`, SDE=`#81c784`, DERIVED=`#ba68c8`, CACHE=`#ffd54f`, COMPOSITE=`#ff8a65`), status colors, semantic type colors. Include spacing, fontSize, borderRadius, fontFamily scales. Export typed constant object.
- [x] T036 [P] [US7] Centralize `SOURCE_COLORS` and `SOURCE_BADGES` in `apps/designer/src/tokens.ts` — replace all 4 constant definitions in `CapabilityPalette.tsx`, `CapabilityCard.tsx`, `CapabilityNode.tsx`, `NodeDetailPanel.tsx` with imports from tokens
- [x] T037 [P] [US7] Extract YAML import/export logic from `apps/designer/src/App.tsx` to `apps/designer/src/hooks/useYamlImportExport.ts` — move `handleSave` (file download), `handleImport` (file read + parse + layout + load) into a custom hook
- [x] T038 [P] [US7] Extract pipeline action orchestration from `apps/designer/src/App.tsx` to `apps/designer/src/hooks/usePipelineActions.ts` — move `handleValidate`, `handleExecute`, drilldown navigation logic into a custom hook
- [x] T039 [US7] Replace inline styles with token references across palette components — update `apps/designer/src/components/palette/CapabilityPalette.tsx`, `apps/designer/src/components/palette/CapabilityCard.tsx`, `apps/designer/src/components/palette/IntentSearch.tsx`, `apps/designer/src/components/palette/RecommendedPanel.tsx`
- [x] T040 [US7] Replace inline styles with token references across canvas and detail components — update `apps/designer/src/components/canvas/CapabilityNode.tsx`, `apps/designer/src/components/canvas/PipelineCanvas.tsx`, `apps/designer/src/components/detail/NodeDetailPanel.tsx`, `apps/designer/src/components/detail/ResultInspector.tsx`
- [x] T041 [US7] Replace inline styles with token references in shared components and App.tsx — update `apps/designer/src/components/shared/Toolbar.tsx`, `apps/designer/src/App.tsx` (now slim after extractions). Remove all remaining inline `style={}` objects and bare hex color literals.
- [x] T042 [US7] Split pipeline store into focused slices — decompose `apps/designer/src/stores/pipeline-store.ts` (353 lines) into: `canvas-store.ts` (nodes/edges/selection), `compilation-store.ts` (diagnostics/plan/SDL), `execution-store.ts` (session/states/outputs), `persistence-store.ts` (save/load/dirty). Use Zustand slice pattern or combined store. Update all imports across the codebase.

**Checkpoint**: All existing tests pass with zero modifications. No inline styles remain. No duplicated constants. App.tsx contains only composition. Pipeline store is split into focused slices.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all user stories.

- [x] T043 Remove any remaining `gatewayUrl()` references and `DEFAULT_GATEWAY_URL` constants missed in earlier phases — grep `apps/designer/src/` for `gatewayUrl` and `localhost:3456`
- [x] T044 Run full quality gate: `pnpm run validate` (lint + format + typecheck + coverage + knip)
- [x] T045 Run quickstart.md validation — follow all steps in `specs/006-designer-dx-overhaul/quickstart.md` end-to-end to verify feature completeness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001/T002/T003 are parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 completion (merge conflicts resolved, deps installed).
- **US1 (Phase 3)**: Depends on Phase 2 (gateway client).
- **US2 (Phase 4)**: Depends on Phase 1 (dagre dependency). Can run in parallel with US1.
- **US3 (Phase 5)**: Depends on Phase 2 (gateway client). Can start after US1 (toast enhances error display).
- **US4 (Phase 6)**: Depends on Phase 2 (gateway client) and US3 (toast for success/error feedback).
- **US5 (Phase 7)**: Depends on Phase 1 only. Independent of US1-US4.
- **US6 (Phase 8)**: Depends on US5 (undo/redo actions to bind). Independent of US1-US4.
- **US7 (Phase 9)**: Depends on all US1-US6 being complete (refactoring must not break new features).
- **Polish (Phase 10)**: Depends on all phases complete.

### User Story Dependencies

```text
Phase 1 (Setup)
    ├── Phase 2 (Foundational)
    │   ├── Phase 3 (US1: Catalog) ──┐
    │   ├── Phase 5 (US3: Errors) ───┤── Phase 9 (US7: Code Quality)
    │   │   └── Phase 6 (US4: Inputs)┤       └── Phase 10 (Polish)
    │   └── Phase 4 (US2: Import) ───┤
    └── Phase 7 (US5: Undo) ─────────┤
        └── Phase 8 (US6: Shortcuts) ┘
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Services/stores before components
- Core implementation before wiring/integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 all parallel (different files)
- **Phase 2**: T007 and T008 parallel (different files), both after T006
- **Phase 3**: T009 parallel with T010-T012 implementation tasks (TDD)
- **Phase 4**: T013 and T014 parallel (different files). T015 and T016 after T015 layout engine created.
- **Phase 5**: T018 parallel with T019-T020 (TDD)
- **Phase 7**: T027 parallel with T028 (TDD)
- **Phase 9**: T035, T036, T037, T038 all parallel (different files)
- **US1 and US2 can run in parallel** after Phase 2
- **US5 can run in parallel with US1-US4** (no dependency on gateway client)

---

## Parallel Example: User Story 1

```text
# After Phase 2 completes, launch US1 tests and implementation in parallel:
Task T009: "Write test for catalog loading" (tests/stores/catalog-store.test.ts)
Task T010: "Update catalog-store.ts to use gateway client" (stores/catalog-store.ts)
Task T011: "Add error banner to CapabilityPalette.tsx" (components/palette/CapabilityPalette.tsx)

# T009 writes failing tests, T010 makes them pass, T011 adds UI — sequential within story
```

## Parallel Example: User Story 7

```text
# All four extraction tasks can run in parallel (different files):
Task T035: "Create tokens.ts" (src/tokens.ts)
Task T036: "Centralize SOURCE_COLORS" (src/tokens.ts — same file, combine with T035)
Task T037: "Extract useYamlImportExport.ts" (hooks/useYamlImportExport.ts)
Task T038: "Extract usePipelineActions.ts" (hooks/usePipelineActions.ts)
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (resolve conflicts, add deps)
2. Complete Phase 2: Foundational (gateway client)
3. Complete Phase 3: US1 — Capabilities Load
4. Complete Phase 4: US2 — YAML Import
5. **STOP and VALIDATE**: Palette loads, imports work, graph layout correct
6. Deploy/demo if ready — the designer is now functional

### Incremental Delivery

1. Setup + Foundational → Gateway client ready
2. Add US1 + US2 → Designer works (MVP!)
3. Add US3 → Errors visible → Deploy/Demo
4. Add US4 → Execution with inputs → Deploy/Demo
5. Add US5 + US6 → Power user features → Deploy/Demo
6. Add US7 → Clean codebase → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Catalog) + US3 (Errors) + US4 (Inputs)
   - Developer B: US2 (Import) + US5 (Undo) + US6 (Shortcuts)
3. Both complete → Developer A or B: US7 (Code Quality)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests MUST fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US7 (Code Quality) MUST be last — refactoring code that's still being written causes churn
