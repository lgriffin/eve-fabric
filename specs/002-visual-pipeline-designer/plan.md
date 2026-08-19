# Implementation Plan: Visual Pipeline Designer

**Branch**: `002-visual-pipeline-designer` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-visual-pipeline-designer/spec.md`

## Summary

Complete and enhance the existing EVE Fabric visual pipeline designer to deliver a full design-compile-execute workflow. The designer app (`apps/designer/`) already has a React + @xyflow/react canvas, capability palette, basic node rendering, and stub panels. This plan focuses on wiring the real compiler/planner/executor into the UI, adding execution visualization, smart pipeline assistance, bridging capability suggestions, and pipeline persistence — while maintaining strict adherence to Constitution Principle XVI (Designer Independence): the designer consumes the same capability catalog and compiler as non-visual clients and introduces no separate composition rules.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS  
**Primary Dependencies**: React 18, @xyflow/react (React Flow), Vite, Zustand (state management), Fastify (gateway), Zod (validation)  
**Storage**: Gateway API persistence (YAML pipeline definitions via POST/GET endpoints)  
**Testing**: Vitest (unit), Cucumber.js (BDD), Stryker (mutation testing)  
**Target Platform**: Desktop web browser (minimum 1280x720)  
**Project Type**: Web application (React SPA consuming a Fastify gateway API)  
**Performance Goals**: <200ms connection validation feedback, 60fps canvas interaction, <2s compilation for 30-node pipelines  
**Constraints**: Must use the same `PipelineDefinition`, `CapabilityCatalog`, and `compile()` function from `packages/compiler` — no designer-specific composition logic  
**Scale/Scope**: Supports pipelines up to 50 nodes / 100 edges; initial release ships with ~7 core EVE capabilities (Resolve Type, Market Orders, Resolve Location, Route Distance, Filter, Sort, Result)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                  | Status | Notes                                                                                                                                                                             |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Purpose                 | PASS   | Designer composes capabilities from ESI.ts/SDE sources; does not replace or duplicate ESI.ts                                                                                      |
| II. Core Architecture      | PASS   | Designer is an interface layer over the capability graph → compiler → execution pipeline                                                                                          |
| III. TypeScript-First      | PASS   | All code in TypeScript strict mode                                                                                                                                                |
| IV. Clean Architecture     | PASS   | UI is an adapter. Domain types imported from `packages/domain`, compilation from `packages/compiler`. No domain logic in UI components                                            |
| V. Capability-First        | PASS   | Every node on the canvas maps to a `CapabilityDefinition` from the catalog                                                                                                        |
| VI. Semantic Type System   | PASS   | Connection validation uses `SemanticTypeId` compatibility, not structural type matching                                                                                           |
| VII. Pipeline Composition  | PASS   | Visual pipelines serialize to `PipelineDefinition` which supports recursive composition via COMPOSITE capabilities                                                                |
| X. Schema Compiler         | PASS   | Designer invokes the same `compile()` function from `packages/compiler`; no second compiler                                                                                       |
| XI. Execution Planner      | PASS   | Execution uses `planExecution()` from `packages/planner` and `Executor` from `packages/executor`                                                                                  |
| XVI. Designer Independence | PASS   | **Critical principle.** Designer consumes the same catalog and compiler. `flowToPipeline()` serializer produces standard `PipelineDefinition`. No second set of composition rules |
| XVIII. Testing             | PASS   | Vitest for unit tests, BDD for observable behavior                                                                                                                                |
| XXVI. Definition of Done   | PASS   | Plan includes runtime validation, unit tests, BDD scenarios, provenance, error modeling                                                                                           |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-visual-pipeline-designer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/
  designer/
    src/
      components/
        canvas/
          PipelineCanvas.tsx      # Enhanced: execution animation, bridging suggestions
          CapabilityNode.tsx      # Enhanced: execution state visualization
          SemanticHandle.tsx      # Existing: port rendering
        palette/
          CapabilityPalette.tsx   # Enhanced: smart filtering, compatibility hints
        preview/
          DiagnosticsPanel.tsx    # Enhanced: wired to real compiler diagnostics
          GraphQLPreview.tsx      # Enhanced: wired to real GraphQL generation
          ExecutionPlanPreview.tsx # Enhanced: wired to real execution plan
          ResultsPanel.tsx        # New: execution results display
        detail/
          NodeDetailPanel.tsx     # New: selected node inspection panel
        shared/
          Toolbar.tsx             # Enhanced: Execute button, pipeline management
      hooks/
        useConnectionValidator.ts # Enhanced: bridging capability suggestions
        useGatewayApi.ts          # Enhanced: execution, save/load
        useCompiler.ts            # New: compile pipeline from canvas state
        useExecutor.ts            # New: execute pipeline with progress tracking
      stores/
        pipeline-store.ts         # Enhanced: execution state, results
        catalog-store.ts          # Existing: capability catalog
      services/
        pipeline-serializer.ts    # Enhanced: import from YAML, enrichment
    tests/
      components/                 # Component tests
      hooks/                      # Hook tests
      services/                   # Serializer tests
      integration/                # End-to-end compilation/execution tests

packages/
  domain/                         # Existing: no changes expected
  compiler/                       # Existing: consumed by designer
  planner/                        # Existing: consumed by designer
  executor/                       # Existing: consumed by designer
  graphql/                        # Existing: consumed for SDL generation

apps/
  gateway/
    src/
      server.ts                   # Enhanced: execution endpoint, pipeline CRUD
```

**Structure Decision**: Extends the existing `apps/designer/` application. New components are added within the existing directory structure. No new packages are created. The designer imports domain types and compiler/planner/executor packages directly (or via gateway API endpoints for server-side operations).
