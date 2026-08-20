# Research: Designer DX Overhaul

**Branch**: `006-designer-dx-overhaul` | **Date**: 2026-08-20

## R1: API Integration Strategy

**Decision**: Unified gateway client module + Vite dev server proxy.

**Rationale**: The designer has three independent API integration bugs:

1. `catalog-store.ts` calls `/api/registry` (relative) — correct endpoint, but no Vite proxy exists so it hits port 5173 and 404s
2. `useGatewayApi.ts` calls `http://localhost:3456/api/registry` (absolute) — correct endpoint and port, but triggers CORS because the page is served from port 5173
3. `gatewayUrl()` function is copy-pasted identically in 4 files (`useGatewayApi.ts`, `useExecutor.ts`, `discovery-service.ts`, `reference-data-service.ts`), each with `DEFAULT_GATEWAY_URL = 'http://localhost:3456'`
4. Additional inconsistency: `NodeDetailPanel.tsx` and `pipeline-store.ts:publishAsCapability` use relative URLs without `gatewayUrl()`

**Resolution**:

- Add Vite proxy: `/api` → `http://localhost:3456` in `vite.config.ts`
- Create single `gateway-client.ts` with typed methods using relative `/api/` paths
- All fetch calls go through the client; delete all `gatewayUrl()` copies
- Environment variable override for production deployments

**Alternatives considered**:

- CORS headers on gateway: Would work but couples designer config to gateway, doesn't solve inconsistency
- Direct absolute URLs everywhere: CORS issues persist, environment-specific config scattered

## R2: Gateway Endpoint Mapping

**Decision**: Map designer operations to verified gateway endpoints.

**Findings** — the gateway serves these endpoints (all verified in `apps/gateway/src/`):

| Designer Operation | Method | Gateway Endpoint                 | Response Shape                           |
| ------------------ | ------ | -------------------------------- | ---------------------------------------- |
| Load catalog       | GET    | `/api/registry`                  | `{ capabilities: [...] }`                |
| Get capability     | GET    | `/api/registry/:id`              | Single capability + versions + upgrades  |
| Save pipeline      | POST   | `/api/pipelines`                 | `{ id, version, name, savedAt }`         |
| Execute pipeline   | POST   | `/api/pipelines/execute`         | `{ outputs, steps?, metrics?, errors? }` |
| Execute capability | POST   | `/api/capabilities/:id/execute`  | `{ outputs, provenance }`                |
| Publish composite  | POST   | `/api/registry/publish`          | `{ success, capability, diagnostics }`   |
| Search items       | GET    | `/api/reference/items?q=&limit=` | Item list                                |
| List regions       | GET    | `/api/reference/regions`         | Region list                              |
| Discovery search   | POST   | `/api/discovery/search`          | Capability matches                       |
| Discovery suggest  | POST   | `/api/discovery/suggest`         | Suggested capabilities                   |

**Note**: `server.ts` has an unresolved merge conflict on `POST /api/pipelines/execute` with two implementations (real compiler/executor vs mock data). Must resolve before integration.

## R3: YAML Parser Status

**Decision**: The `yaml` npm package (v2.x) is already installed and in use — no parser replacement needed.

**Rationale**: The SDD stated a "hand-rolled line parser (~120 lines)" existed, but current code in `pipeline-serializer.ts` already imports `{ parse as parseYaml, stringify as stringifyYaml } from 'yaml'`. The `yaml` package is listed in `apps/designer/package.json` at `^2.5.0`.

The parser correctly handles the nested `capability: { id, version }` structure used by example pipelines. The `yamlToPipeline` function maps YAML to `PipelineDefinition` domain objects.

**Remaining issue**: `pipeline-serializer.ts` has a merge conflict (trivial blank-line difference around `return stringifyYaml(doc)`). Must resolve before any changes.

**Alternatives considered**: N/A — the library is already integrated.

## R4: Auto-Layout Engine

**Decision**: Add `@dagrejs/dagre` for directed graph layout.

**Rationale**: Standard layout engine for React Flow. ~30KB, well-maintained, supports left-to-right directed graph layout. Not yet installed in any package.json.

**Alternatives considered**:

- `elkjs`: More powerful (hierarchical, compound nodes) but ~400KB WASM binary, overkill for <50 node pipelines
- Manual positioning: Current flat grid layout is already proven inadequate

## R5: Notification System

**Decision**: Minimal Zustand toast store + React portal.

**Rationale**: The designer has zero user feedback infrastructure. Every `catch` block silently swallows errors. A Zustand store allows toasts to be triggered from store actions (not just React components), which is essential since most API calls originate in stores/hooks.

Key requirements:

- Severities: error, warning, success, info
- Auto-dismiss after 8 seconds
- Triggerable from Zustand store actions
- Dismiss action on each toast
- Queue management for rapid-fire errors

**Alternatives considered**:

- `react-hot-toast` (5KB): Viable but adds a dependency for ~50 lines of custom code
- `react-toastify`: Heavier, more opinionated styling

## R6: Undo/Redo Architecture

**Decision**: Zustand middleware that snapshots `{nodes, edges}` on each mutation.

**Rationale**: Ring buffer of 50 entries. Snapshots only canvas state (nodes, edges), excluding transient state (selection, viewport, panel state, execution results). Custom implementation (~40 lines) gives control over what's snapshotted.

The current `pipeline-store.ts` exposes ~22 actions. Only canvas-mutating actions need undo tracking: `onNodesChange`, `onEdgesChange`, `onConnect`, `addNode`, `removeNode`, `loadPipeline`.

**Alternatives considered**:

- `zundo` (Zustand undo middleware): 3rd party, less control over snapshot scope
- Command pattern: More complex, better for granular undo descriptions but overkill here

## R7: Code Quality Audit

**Findings**:

| Issue                      | Scope                                                                | Impact                                   |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| No design tokens           | 341 inline `style={}` blocks across 27/28 component files            | Theming impossible, inconsistent visuals |
| SOURCE_COLORS duplication  | 4 constant definitions + 55+ bare hex literals across 13+ files      | Change one color → hunt through 13 files |
| `gatewayUrl()` duplication | Identical function in 4 files                                        | URL change requires 4 edits              |
| App.tsx business logic     | 271 lines with YAML I/O, validation, execution, drilldown navigation | Untestable, hard to reason about         |
| Zero CSS files             | No CSS modules, no CSS-in-JS, no utility framework                   | All styling is inline objects            |
| pipeline-store.ts monolith | 353 lines, ~20 state fields, ~22 actions                             | Hard to test individual concerns         |

**Five most-used surface colors**: `#13131d`, `#1e1e2e`, `#2a2a3e`, `#333`, `#7c4dff` — found across 23 files, 92 occurrences.

**Five source-category colors**: `#4fc3f7` (ESI), `#81c784` (SDE), `#ba68c8` (DERIVED), `#ffd54f` (CACHE), `#ff8a65` (COMPOSITE) — duplicated 55+ times.

## R8: Merge Conflicts

**Decision**: Resolve all three merge conflicts before any feature work.

Three files have unresolved merge conflicts:

1. `apps/gateway/src/server.ts` — execute endpoint (two implementations)
2. `apps/designer/src/services/pipeline-serializer.ts` — trivial blank-line difference
3. `apps/designer/src/stores/pipeline-store.ts` — compiledPlan field formatting

These must be resolved as a prerequisite step (Phase 0) before any feature development begins.
