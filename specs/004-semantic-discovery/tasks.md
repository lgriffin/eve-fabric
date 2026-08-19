# Tasks: Semantic Discovery & Assisted Composition

**Input**: Design documents from `/specs/004-semantic-discovery/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Included per Constitution Principle XVIII (TDD for domain, BDD for observable behavior).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create discovery module structure and define shared types

- [x] T001 Create discovery module directory structure at packages/domain/src/discovery/ with index.ts
- [x] T002 Define discovery domain types (SemanticPath, PathStep, DiscoverySuggestion, SatisfactionResult, FlowProposal, ExplanationStep, DiscoveryQuery, FlowContext, PathOptions, SuggestionOptions, ConnectionSuggestion, readiness/matchReason/proposalType enums) with Zod schemas in packages/domain/src/discovery/discovery-types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core graph infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement CapabilityGraph with indexed maps (inputIndex: Map<SemanticTypeId, CapabilityDefinition[]>, outputIndex: Map<SemanticTypeId, CapabilityDefinition[]>) and static build(catalog) factory in packages/domain/src/discovery/capability-graph.ts
- [x] T004 [P] Unit tests for CapabilityGraph (build from catalog, getConsumers, getProducers, getAllTypes, empty catalog, rebuild) in packages/domain/tests/discovery/capability-graph.test.ts
- [x] T005 Implement PathFinder with BFS, visited-set cycle detection, configurable maxDepth (default 5), and maxResults in packages/domain/src/discovery/path-finder.ts
- [x] T006 [P] Unit tests for PathFinder (single-hop path, multi-hop path, no path exists, cycle detection, depth limit, multiple valid paths ranked by length, cost tie-breaking) in packages/domain/tests/discovery/path-finder.test.ts
- [x] T007 [P] Property tests for PathFinder invariants (paths are cycle-free, consecutive types match, within depth limit, sourceType/targetType correct) using fast-check in packages/domain/tests/property/path-finder.property.test.ts
- [x] T008 Export discovery module types and classes from packages/domain/src/discovery/index.ts and packages/domain/src/index.ts

**Checkpoint**: Graph infrastructure ready -- user story implementation can begin

---

## Phase 3: User Story 1 - Port-Based Capability Discovery (Priority: P1) MVP

**Goal**: When a user selects an output port, Fabric Studio presents all registered capabilities that can consume that semantic type

**Independent Test**: Place a capability on the canvas, select an output port, verify system presents all compatible capabilities from registry

### Tests for User Story 1

- [x] T009 [P] [US1] Unit tests for DiscoveryEngine.findConsumers and findProducers (returns matching capabilities with explanations, returns empty for unknown types, explanations describe port and type) in packages/domain/tests/discovery/discovery-engine.test.ts
- [x] T010 [P] [US1] BDD feature and steps for port-based discovery (Given capability with LocationReference output, When user selects port, Then system shows all consumers) in packages/domain/tests/bdd/features/semantic-discovery.feature and packages/domain/tests/bdd/steps/semantic-discovery.steps.ts

### Implementation for User Story 1

- [x] T011 [US1] Implement DiscoveryEngine with constructor(catalog), findConsumers(semanticType), findProducers(semanticType), and rebuild() in packages/domain/src/discovery/discovery-engine.ts
- [x] T012 [US1] Implement ExplanationStep generation for consumer/producer suggestions in packages/domain/src/discovery/discovery-engine.ts
- [x] T013 [P] [US1] Modify suggestIntermediates to accept optional DiscoveryEngine parameter and delegate to findPaths for multi-hop results in packages/compiler/src/suggest-intermediates.ts
- [x] T014 [P] [US1] Update compiler suggest-intermediates tests to verify multi-hop delegation behavior in packages/compiler/tests/suggest-intermediates.test.ts

**Checkpoint**: Port-based discovery functional -- user can select an output port and see compatible capabilities

---

## Phase 4: User Story 2 - Semantic Bridging & Path Finding (Priority: P1)

**Goal**: When two capabilities cannot connect directly, system proposes valid intermediate capability paths including multi-step bridging

**Independent Test**: Attempt to connect two incompatible ports, verify system proposes valid intermediate path

### Tests for User Story 2

- [x] T015 [P] [US2] Unit tests for DiscoveryEngine.findPaths (single-hop bridging, multi-hop bridging, no path, explanation chain generation) in packages/domain/tests/discovery/discovery-engine.test.ts
- [x] T016 [P] [US2] BDD scenarios for semantic bridging (Given LocationReference->SolarSystemReference mismatch, When connection attempted, Then system proposes path via Resolve Location) in packages/domain/tests/bdd/features/semantic-discovery.feature

### Implementation for User Story 2

- [x] T017 [US2] Add findPaths(sourceType, targetType, options?) to DiscoveryEngine, delegating to PathFinder and generating ExplanationStep chains in packages/domain/src/discovery/discovery-engine.ts
- [x] T018 [US2] Implement FlowProposal generation for bridging paths (capabilitiesToInsert, connectionsToMake, explanation) in packages/domain/src/discovery/discovery-engine.ts

**Checkpoint**: Semantic bridging functional -- incompatible connections trigger path proposals

---

## Phase 5: User Story 3 - Goal-Based Discovery (Priority: P2)

**Goal**: Users search by desired outcome; system shows matching capabilities with requirements and current flow satisfaction status

### Tests for User Story 3

- [x] T019 [P] [US3] Unit tests for DiscoveryEngine.search (matches name, description, ID, semantic type keywords; includes satisfaction status when flowContext provided; returns empty for no matches) in packages/domain/tests/discovery/discovery-engine.test.ts

### Implementation for User Story 3

- [x] T020 [US3] Implement DiscoveryEngine.search(query, flowContext?) that matches against capability name, description, id, and semantic type IDs, returning DiscoverySuggestion with satisfaction info in packages/domain/src/discovery/discovery-engine.ts

**Checkpoint**: Goal-based search functional -- users can search by outcome and see requirement satisfaction

---

## Phase 6: User Story 4 - Context-Aware Suggestions (Priority: P2)

**Goal**: System proactively suggests capabilities ranked by how many inputs are satisfied by the current flow, with explanations

### Tests for User Story 4

- [x] T021 [P] [US4] Unit tests for SatisfactionAnalyzer (analyze single capability, analyzeAll, fully satisfied vs partial vs unreachable, optional inputs handled) in packages/domain/tests/discovery/satisfaction-analyzer.test.ts
- [x] T022 [P] [US4] Unit tests for DiscoveryEngine.suggestNext (ranked by satisfaction, excludes existing capabilities, includes explanations) in packages/domain/tests/discovery/discovery-engine.test.ts

### Implementation for User Story 4

- [x] T023 [US4] Implement SatisfactionAnalyzer with analyze(capability, flowContext) and analyzeAll(flowContext) in packages/domain/src/discovery/satisfaction-analyzer.ts
- [x] T024 [US4] Add suggestNext(flowContext, options?) to DiscoveryEngine, using SatisfactionAnalyzer to rank suggestions and generate explanations in packages/domain/src/discovery/discovery-engine.ts
- [x] T025 [US4] Implement gateway discovery REST endpoints (GET consumers/:type, GET producers/:type, POST paths, POST suggest, POST search) with Zod validation in apps/gateway/src/routes/discovery-routes.ts
- [x] T026 [P] [US4] Integration tests for gateway discovery endpoints in apps/gateway/tests/routes/discovery-routes.test.ts

**Checkpoint**: Context-aware suggestions functional -- system proactively recommends next capabilities with readiness and explanations

---

## Phase 7: User Story 5 - Auto-Completion & Smart Node Addition (Priority: P3)

**Goal**: User selects a target capability and system builds the missing path; dragging a capability highlights likely connections

### Tests for User Story 5

- [x] T027 [P] [US5] Unit tests for DiscoveryEngine.autoComplete and suggestConnections in packages/domain/tests/discovery/discovery-engine.test.ts

### Implementation for User Story 5

- [x] T028 [US5] Add autoComplete(flowContext, targetCapabilityId) to DiscoveryEngine in packages/domain/src/discovery/discovery-engine.ts
- [x] T029 [US5] Add suggestConnections(flowContext, newCapabilityId) to DiscoveryEngine in packages/domain/src/discovery/discovery-engine.ts
- [x] T030 [US5] Add POST /api/discovery/auto-complete endpoint to gateway in apps/gateway/src/routes/discovery-routes.ts

**Checkpoint**: Auto-completion and smart node addition functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality validation and cleanup

- [x] T031 [P] Run full quality gate: pnpm run validate (lint + format + typecheck + coverage + knip)
- [x] T032 [P] Verify all tests pass: pnpm test

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on DiscoveryEngine from US1
- **US3 (Phase 5)**: Depends on DiscoveryEngine from US1
- **US4 (Phase 6)**: Depends on Foundational
- **US5 (Phase 7)**: Depends on US2 + US4
- **Polish (Phase 8)**: Depends on all stories

## Notes

- TDD approach: write tests, verify they fail, then implement
- Each story independently testable
- Constitution Principle XVII: AI layer is optional; all stories work without it
