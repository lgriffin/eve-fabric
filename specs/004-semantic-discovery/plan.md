# Implementation Plan: Semantic Discovery & Assisted Composition

**Branch**: `004-semantic-discovery` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-semantic-discovery/spec.md`

## Summary

Extend Eve Fabric with a semantic discovery engine that builds a traversable capability graph from registry metadata, enabling port-based discovery, multi-hop bridging, goal-based search, context-aware suggestions, auto-completion, and assisted flow construction. The engine is deterministic (no AI dependency) and integrates into both the domain layer and Fabric Studio designer. An optional AI layer may translate natural-language goals into structured queries.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS  
**Primary Dependencies**: Vitest, Zustand, @xyflow/react (React Flow), Fastify, Zod  
**Storage**: In-memory (CapabilityCatalog + new indexed graph structures)  
**Testing**: Vitest (unit), Cucumber.js (BDD), fast-check (property), Stryker (mutation)  
**Target Platform**: Node.js 20 LTS (domain/compiler packages) + Browser (React 18 designer app)  
**Project Type**: Monorepo (pnpm workspaces) with domain packages, compiler, designer app, gateway  
**Performance Goals**: Port discovery < 2s (50 capabilities), path finding < 3s (500 capabilities), auto-completion < 5s  
**Constraints**: In-memory graph operations only; strict semantic type equality (no subtyping in v1); max 5-hop bridging depth  
**Scale/Scope**: Hundreds to low thousands of registered capabilities

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                   | Status | Notes                                                                                                  |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| I. Purpose                  | PASS   | Discovery composes EVE data capabilities at a higher order; does not replace ESI.ts                    |
| II. Core Architecture       | PASS   | Discovery operates over the Capability Graph layer, feeding into the Semantic Compiler                 |
| III. TypeScript-First       | PASS   | All discovery logic in TypeScript strict mode; Zod for runtime validation                              |
| IV. Clean Architecture      | PASS   | Discovery engine in domain layer; designer consumes via adapter pattern; no framework deps in domain   |
| V. Capability-First         | PASS   | Discovery operates on CapabilityDefinition metadata (inputs, outputs, semantic types)                  |
| VI. Semantic Type System    | PASS   | Leverages existing SemanticTypeId nominal types; strict equality preserved                             |
| VII. Pipeline Composition   | PASS   | Proposed flows validated through deterministic compiler; recursive composition supported               |
| XVI. Designer Independence  | PASS   | Designer consumes same discovery engine as non-visual clients; no duplicate composition rules          |
| XVII. AI Assistance         | PASS   | AI optional (FR-013); deterministic discovery (FR-012) is the authority; AI cannot invent capabilities |
| XVIII. Testing              | PASS   | TDD for domain discovery logic; BDD for observable capability behavior                                 |
| XIX. Specification Style    | PASS   | EARS-style requirements in spec (WHEN/SHALL/MUST)                                                      |
| XXI. Backward Compatibility | PASS   | New additive feature; existing catalog/compiler APIs unchanged                                         |
| XXVI. Definition of Done    | PASS   | Domain modeled, runtime validation, unit+BDD tests, capability metadata complete                       |

**Post-Phase 1 Re-check**: All principles remain satisfied. The discovery engine is placed in the domain layer (Principle IV), consumes the same catalog as the compiler and designer (Principle XVI), and the AI layer is strictly optional with all proposals validated through the deterministic compiler (Principle XVII). No violations or complexity justifications required.

## Project Structure

### Documentation (this feature)

```text
specs/004-semantic-discovery/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── discovery-api.md # Domain discovery engine contract
│   └── gateway-api.md   # Gateway REST discovery endpoints
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
packages/
  domain/
    src/
      discovery/                    # NEW: Discovery engine (domain layer)
        capability-graph.ts         # Graph construction from catalog
        path-finder.ts              # BFS multi-hop path finding with cycle detection
        satisfaction-analyzer.ts    # Flow input satisfaction analysis
        discovery-engine.ts         # Orchestrator: graph + path + satisfaction + ranking
        discovery-types.ts          # SemanticPath, DiscoverySuggestion, FlowProposal, SatisfactionResult
        index.ts                    # Public exports
    tests/
      discovery/                    # Unit + property tests for discovery
      bdd/
        features/
          semantic-discovery.feature  # BDD scenarios
        steps/
          semantic-discovery.steps.ts

  compiler/
    src/
      suggest-intermediates.ts      # MODIFIED: Delegate to discovery engine for multi-hop

apps/
  designer/
    src/
      stores/
        discovery-store.ts          # NEW: Zustand store for discovery state
        catalog-store.ts            # MODIFIED: Integrate discovery-aware filtering
      components/
        discovery/                  # NEW: Discovery UI components
          DiscoveryPanel.tsx         # Suggestions panel with explanations
          BridgingProposal.tsx       # Bridging path proposal dialog
          FlowProposalOverlay.tsx    # Auto-completion and assisted flow preview
          SuggestionCard.tsx         # Individual suggestion with explanation
          AssistInput.tsx            # Goal-based search / assist mode input
        palette/
          CapabilityPalette.tsx      # MODIFIED: Enhanced semantic filtering

  gateway/
    src/
      routes/
        discovery-routes.ts         # NEW: REST endpoints for discovery queries
```

**Structure Decision**: Discovery engine lives in `packages/domain/src/discovery/` following Clean Architecture (Principle IV). The domain layer owns the graph model and traversal algorithms. The compiler delegates to the discovery engine for multi-hop suggestions, replacing the current single-hop `suggestIntermediates`. The designer consumes the engine via a new Zustand store. The gateway exposes discovery queries via REST endpoints for non-visual clients.
