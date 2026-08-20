# Quickstart: Designer DX Overhaul

**Branch**: `006-designer-dx-overhaul` | **Date**: 2026-08-20

## Prerequisites

- Node.js 20 LTS
- pnpm
- The gateway running on port 3456: `pnpm --filter @eve-fabric/gateway dev`

## Development Setup

```bash
# Install dependencies (adds @dagrejs/dagre to designer)
pnpm install

# Start the gateway
pnpm --filter @eve-fabric/gateway dev

# Start the designer (separate terminal)
pnpm --filter @eve-fabric/designer dev
```

The designer runs on `http://localhost:5173`. The Vite proxy forwards `/api/*` requests to the gateway at `http://localhost:3456`.

## Verify the Fix

1. Open `http://localhost:5173` — the capability palette should populate with ESI, SDE, DERIVED, and COMPOSITE capabilities
2. Click "Import YAML" and select `examples/market-schema/pipeline.yaml` — 2 nodes should appear in a directed graph layout
3. Stop the gateway, click Save — a toast notification should appear explaining the connection failure
4. Click Execute on a pipeline with inputs — an input dialog should appear

## Key Files

### New files to create

- `apps/designer/src/services/gateway-client.ts` — unified gateway communication
- `apps/designer/src/services/layout-engine.ts` — dagre graph layout
- `apps/designer/src/stores/toast-store.ts` — notification state
- `apps/designer/src/stores/history-middleware.ts` — undo/redo
- `apps/designer/src/components/shared/ToastContainer.tsx` — notification UI
- `apps/designer/src/components/shared/ExecutionInputDialog.tsx` — execution inputs
- `apps/designer/src/components/shared/ShortcutsOverlay.tsx` — keyboard help
- `apps/designer/src/hooks/useKeyboardShortcuts.ts` — shortcut handling
- `apps/designer/src/tokens.ts` — design tokens

### Files to modify

- `apps/designer/vite.config.ts` — add proxy configuration
- `apps/designer/src/stores/catalog-store.ts` — use gateway client, add error state
- `apps/designer/src/hooks/useExecutor.ts` — use gateway client, add input dialog
- `apps/designer/src/stores/pipeline-store.ts` — use gateway client, add undo middleware
- `apps/designer/src/App.tsx` — extract business logic, use design tokens
- `apps/designer/src/components/palette/CapabilityPalette.tsx` — add error banner, use shared tokens
- `apps/designer/src/components/shared/Toolbar.tsx` — add undo/redo buttons, re-layout button

### Files with merge conflicts to resolve first

- `apps/gateway/src/server.ts` — execute endpoint
- `apps/designer/src/services/pipeline-serializer.ts` — trivial formatting
- `apps/designer/src/stores/pipeline-store.ts` — compiledPlan field

## Running Tests

```bash
# All tests
pnpm test

# Designer tests only
pnpm --filter @eve-fabric/designer test

# With coverage
pnpm run coverage

# Full quality gate
pnpm run validate
```

## Implementation Order

1. Resolve merge conflicts (prerequisite)
2. Phase 1: Gateway client + Vite proxy + catalog fix + auto-layout (P0)
3. Phase 2: Toast system + error wiring + execution input dialog (P1)
4. Phase 3: Undo/redo + keyboard shortcuts (P2)
5. Phase 4: Design tokens + App.tsx decomposition + store splitting (P3)
