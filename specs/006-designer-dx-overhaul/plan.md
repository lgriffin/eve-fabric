# Implementation Plan: Designer DX Overhaul

**Branch**: `006-designer-dx-overhaul` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-designer-dx-overhaul/spec.md`

## Summary

Fix the designer's broken gateway integration, YAML import, and silent error handling (P0/P1), then add execution input collection, undo/redo, and keyboard shortcuts (P1/P2), and finally refactor for maintainability with design tokens and store splitting (P3). The gateway already serves the correct endpoints — the designer just calls them wrong and lacks a Vite proxy. The YAML library is already integrated but the code has three unresolved merge conflicts to clear first.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 18, @xyflow/react (React Flow), Vite, Zustand, yaml 2.x, @dagrejs/dagre (new)
**Storage**: N/A (gateway provides persistence; localStorage for execution input history)
**Testing**: Vitest, Cucumber.js (BDD), Stryker (mutation)
**Target Platform**: Modern desktop browsers (Chrome, Firefox, Edge)
**Project Type**: Web application (React SPA consuming Fastify gateway API)
**Performance Goals**: Palette loads within 3 seconds; undo/redo completes within 100ms
**Constraints**: Zero test regressions; no new external dependencies beyond @dagrejs/dagre
**Scale/Scope**: ~5,700 lines across 41 source files in the designer app; 27 component files need design token migration

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                  | Status | Notes                                                                     |
| -------------------------- | ------ | ------------------------------------------------------------------------- |
| III. TypeScript-First      | PASS   | All code is TypeScript strict; no `any` at trust boundaries               |
| IV. Clean Architecture     | PASS   | Gateway client is an infrastructure adapter; domain types unchanged       |
| V. Capability-First        | PASS   | No new capabilities; fixing consumption of existing catalog               |
| VI. Semantic Type System   | PASS   | Type mismatch rejection in error handling aligns                          |
| XVI. Designer Independence | PASS   | Designer consumes the same catalog/compiler; no second composition rules  |
| XVIII. Testing             | PASS   | Tests for all new modules; existing tests must pass unmodified            |
| XXIII. Error Model         | PASS   | Error visibility (US3) aligns — errors now surfaced with category/context |
| XXVI. Definition of Done   | PASS   | All DoD items addressed: domain modeled, validation exists, tests pass    |

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-designer-dx-overhaul/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
├── contracts/
│   └── gateway-client-api.md  # Gateway client contract
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/
  designer/
    vite.config.ts                          # ADD proxy config
    src/
      tokens.ts                             # NEW: design tokens
      App.tsx                               # MODIFY: extract logic, use tokens
      services/
        gateway-client.ts                   # NEW: unified gateway client
        layout-engine.ts                    # NEW: dagre auto-layout
        pipeline-serializer.ts              # MODIFY: resolve merge conflict
      stores/
        catalog-store.ts                    # MODIFY: use gateway client, error state
        pipeline-store.ts                   # MODIFY: resolve conflict, add undo
        toast-store.ts                      # NEW: notification state
        history-middleware.ts               # NEW: undo/redo ring buffer
        types.ts                            # MODIFY: add toast/undo types
      hooks/
        useKeyboardShortcuts.ts             # NEW: keyboard shortcut handler
        useYamlImportExport.ts              # NEW: extracted from App.tsx
        usePipelineActions.ts               # NEW: extracted from App.tsx
        useExecutor.ts                      # MODIFY: use gateway client, input dialog
        useGatewayApi.ts                    # MODIFY: use gateway client (or remove)
      components/
        shared/
          Toolbar.tsx                       # MODIFY: undo/redo buttons, re-layout
          ToastContainer.tsx                # NEW: notification portal
          ExecutionInputDialog.tsx           # NEW: execution input form
          ShortcutsOverlay.tsx              # NEW: keyboard help modal
        palette/
          CapabilityPalette.tsx             # MODIFY: error banner, use tokens
          CapabilityCard.tsx                # MODIFY: use shared SOURCE_COLORS
        canvas/
          CapabilityNode.tsx                # MODIFY: use shared SOURCE_BADGES
          PipelineCanvas.tsx                # MODIFY: use tokens for edge colors
        detail/
          NodeDetailPanel.tsx               # MODIFY: use gateway client, tokens
    tests/
      services/
        gateway-client.test.ts              # NEW
        layout-engine.test.ts               # NEW
        pipeline-serializer.test.ts         # MODIFY: add import tests
      stores/
        toast-store.test.ts                 # NEW
        history-middleware.test.ts           # NEW
      hooks/
        useKeyboardShortcuts.test.ts        # NEW
      components/
        ExecutionInputDialog.test.ts        # NEW
  gateway/
    src/
      server.ts                             # MODIFY: resolve merge conflict
```

**Structure Decision**: The designer follows the existing monorepo layout under `apps/designer/`. New modules are organized by concern within the established `services/`, `stores/`, `hooks/`, `components/` directories. No new packages or structural changes.

## Phase Plan

### Phase 0: Prerequisites (merge conflict resolution)

Resolve all three merge conflicts before any feature work:

1. `apps/gateway/src/server.ts` — keep the real compiler/executor implementation for `POST /api/pipelines/execute`, discard the mock data version
2. `apps/designer/src/services/pipeline-serializer.ts` — trivial blank-line difference, keep either side
3. `apps/designer/src/stores/pipeline-store.ts` — formatting difference around `compiledPlan`, keep either side

### Phase 1: Fix Broken Functionality (P0) — Stories 1 & 2

**Goal**: Make the designer load capabilities and import pipelines correctly.

1. **Vite proxy** — Add `server.proxy` to `vite.config.ts`: `/api` → `http://localhost:3456`
2. **Gateway client** — Create `gateway-client.ts` with typed methods (`getCapabilities`, `savePipeline`, `executePipeline`, `publishComposite`). All use relative `/api/` paths. Return `GatewayResult<T>` discriminated union. Delete all `gatewayUrl()` copies.
3. **Fix catalog loading** — Update `catalog-store.ts` to use gateway client, correctly unwrap `{ capabilities }` response, set `error` and `isLoading` state for the palette error banner.
4. **Palette error banner** — Add error banner + retry button to `CapabilityPalette.tsx` when catalog loading fails.
5. **Auto-layout** — Add `@dagrejs/dagre` dependency. Create `layout-engine.ts` with left-to-right dagre layout function. Wire into YAML import path and add "Re-layout" toolbar button.
6. **Tests** — Unit tests for gateway-client (mocked fetch), layout-engine (node positioning), pipeline-serializer (all example YAML files).

### Phase 2: Error Visibility and Execution Inputs (P1) — Stories 3 & 4

**Goal**: Surface all errors and enable pipeline execution with inputs.

1. **Toast store** — Create `toast-store.ts` with Zustand: `addToast`, `dismissToast`, `toasts` array. Auto-dismiss via `setTimeout`.
2. **Toast container** — Create `ToastContainer.tsx` rendered via React portal. Severities: error (red), warning (yellow), success (green), info (blue). Stack from bottom-right.
3. **Wire error handling** — All gateway client consumers show toasts on failure. Success toasts for save/publish operations.
4. **Execution input dialog** — Create `ExecutionInputDialog.tsx` modal listing pipeline inputs with name, semantic type, description. Pre-fill from localStorage. Skip dialog if no required inputs.
5. **Save vs Export** — Save → POST to gateway + success toast. Export YAML → file download. Two distinct toolbar actions.
6. **Tests** — Toast store (add/dismiss/auto-dismiss), ExecutionInputDialog (render inputs, pre-fill, submit, cancel).

### Phase 3: DX Features (P2) — Stories 5 & 6

**Goal**: Add undo/redo and keyboard shortcuts for power users.

1. **History middleware** — Create `history-middleware.ts`: Zustand middleware wrapping canvas-mutating actions. Ring buffer of 50 `UndoEntry` snapshots. `undo()` and `redo()` actions. New action after undo clears redo stack.
2. **Wire undo/redo** — Add undo/redo buttons to toolbar with count indicators. Wire into pipeline store.
3. **Keyboard shortcuts** — Create `useKeyboardShortcuts.ts`: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Delete/Backspace (remove selected), Ctrl+S (save), Escape (clear selection/close dialogs), `?` (help overlay). Focus-aware (no trigger in text inputs).
4. **Shortcuts overlay** — Create `ShortcutsOverlay.tsx` modal with grouped two-column table.
5. **Unsaved changes warning** — Add `beforeunload` listener when `isDirty` is true. Save clears dirty flag.
6. **Tests** — History middleware (push/undo/redo/overflow/clear-redo), keyboard shortcuts (each shortcut, focus-awareness).

### Phase 4: Code Quality (P3) — Story 7

**Goal**: Refactor for maintainability without changing user-visible behavior.

1. **Design tokens** — Create `tokens.ts` centralizing all colors (surface, source, semantic, status, accent), spacing, typography, border radii. Export as a typed constant object.
2. **Centralize duplicates** — Create shared `SOURCE_COLORS` and `SOURCE_BADGES` in tokens. Replace all 4 definitions + 55 bare hex references.
3. **Decompose App.tsx** — Extract YAML import/export logic to `useYamlImportExport.ts`. Extract validate/compile/execute orchestration to `usePipelineActions.ts`. App.tsx becomes pure layout composition.
4. **Replace inline styles** — Replace all 341 inline `style={}` blocks with token references. Consider CSS modules for complex layouts.
5. **Split pipeline store** — Decompose the monolithic 353-line store into focused slices: canvas (nodes/edges/selection), compilation (diagnostics/plan/SDL), execution (session/states/outputs), persistence (save/load/dirty). Shared through a combined store or Zustand slice pattern.
6. **Verify** — Run full test suite (`pnpm run validate`). All existing tests must pass with zero modifications. Manual smoke test of all features.

## Post-Phase 1 Constitution Re-Check

| Principle                  | Status | Notes                                                       |
| -------------------------- | ------ | ----------------------------------------------------------- |
| IV. Clean Architecture     | PASS   | Gateway client is infrastructure adapter; domain untouched  |
| XVI. Designer Independence | PASS   | Same catalog/compiler consumed; no second composition rules |
| XIX. Specification Style   | PASS   | All acceptance scenarios use Given/When/Then EARS-style     |
| XXVI. Definition of Done   | PASS   | All DoD criteria will be met per phase                      |

No violations introduced by the design.

## Complexity Tracking

No constitution violations requiring justification. The feature adds one new dependency (`@dagrejs/dagre`) and creates ~10 new files, all within the existing project structure.
