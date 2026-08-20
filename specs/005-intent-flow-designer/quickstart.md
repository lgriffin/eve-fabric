# Quickstart: Intent-Driven Interactive Flow Designer

**Branch**: `005-intent-flow-designer` | **Date**: 2026-08-20

## Prerequisites

- Node.js 20 LTS
- pnpm (workspace manager)
- All dependencies installed (`pnpm install`)

## Development Setup

```bash
# Start the gateway (serves capability registry, discovery, execution, and reference data)
cd apps/gateway
pnpm dev

# In a separate terminal, start the designer
cd apps/designer
pnpm dev
```

The gateway runs on `http://localhost:3456` and the designer on `http://localhost:5173` (Vite default).

## Key Development Paths

### Adding a new input editor type

1. Define the editor type in `packages/domain/src/capability/input-editor-mapping.ts`
2. Create the React component in `apps/designer/src/components/input-editors/`
3. Register it in `apps/designer/src/components/canvas/NodeInputEditor.tsx`
4. Add a unit test for the mapping in `packages/domain/src/__tests__/`
5. Add a component test for the editor in `apps/designer/src/__tests__/`

### Adding a new reference data type

1. Add the gateway endpoint in `apps/gateway/src/routes/reference-data-routes.ts`
2. Add the client method in `apps/designer/src/services/reference-data-service.ts`
3. Wire it into the `SearchableSelector` component

### Adding a new capability to the interactive scope

1. Define the capability in `packages/capability-sdk/src/capabilities/`
2. Ensure it's included in `allCapabilities` and seeded by the gateway
3. Add appropriate editor type mappings for its input semantic types
4. Add user-oriented action labels for the contextual palette suggestions

## Testing

```bash
# Run all unit tests
pnpm test

# Run BDD scenarios
pnpm run test:bdd

# Run with coverage
pnpm run coverage

# Type check
pnpm run typecheck

# Full quality gate
pnpm run validate
```

## Architecture Notes

- **Constitution XVI compliance**: The designer consumes the same capability catalog and compiler as non-visual clients. Interactive node configuration is a UI layer concern — it reads capability metadata but does not create a second set of composition rules.
- **Editor dispatch**: `SemanticTypeId` → `EditorType` mapping lives in the domain package. The designer renders the appropriate React component.
- **Palette modes**: Discover uses `POST /api/discovery/search`, Recommended uses `POST /api/discovery/suggest`, All uses `GET /api/registry`.
- **Node execution**: Test button calls `POST /api/capabilities/:id/execute`. Full flow execution calls `POST /api/pipelines/execute`.
