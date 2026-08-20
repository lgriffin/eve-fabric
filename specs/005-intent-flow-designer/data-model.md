# Data Model: Intent-Driven Interactive Flow Designer

**Branch**: `005-intent-flow-designer` | **Date**: 2026-08-20

## Extended Entities

### CapabilityNodeData (extension of existing)

The existing `CapabilityNodeData` in the pipeline store is extended with input configuration and per-node execution state.

**Existing fields** (unchanged):

- `capabilityId: string`
- `capabilityVersion: string`
- `label: string`
- `source: CapabilitySource`
- `inputs: PortInfo[]`
- `outputs: PortInfo[]`

**New fields**:

- `configuredValues: Record<string, ConfiguredValue>` — Maps port name to configured input value. Only populated for inputs that the user has directly configured (not connected to upstream).
- `nodeExecutionState: NodeExecutionState | null` — Per-node test execution state. Null when not yet tested.

### ConfiguredValue

Represents a user-configured value for a node input port.

- `value: unknown` — The configured value (type depends on semantic type: string for references, number for numerics, boolean for toggles, string for enum selections)
- `displayLabel: string` — Human-readable label for the value (e.g., "Tritanium" rather than a type ID)

### NodeExecutionState

Per-node execution result from the Test button.

- `status: 'idle' | 'running' | 'success' | 'error'`
- `resultCount: number | null` — Count of items in the result (if collection)
- `durationMs: number | null` — Execution duration
- `source: string | null` — Data source used (e.g., "ESI", "SDE", "DERIVED")
- `cached: boolean`
- `error: string | null` — Error message if status is 'error'
- `preview: unknown | null` — Sample of result data for inspection

### PaletteMode

Enumeration for palette display mode.

- `'discover'` — Intent search with example queries
- `'recommended'` — Context-aware suggestions from discovery engine
- `'all'` — Full capability registry browse

### EditorType

Enumeration mapping semantic types to input editor components.

- `'searchable-selector'` — Searchable dropdown backed by reference data
- `'enum'` — Radio buttons or dropdown for constrained value sets
- `'numeric'` — Number input field
- `'boolean'` — Toggle switch
- `'text'` — Plain text input (fallback)
- `'collection'` — Connection-only indicator (no direct configuration)

### ReferenceDataItem

Represents an item returned by reference data search endpoints.

- `id: number` — EVE type/region/system ID
- `name: string` — Display name

### ContextualSuggestion

Represents a user-oriented suggestion in the contextual palette (+ button or drop-on-canvas).

- `capabilityId: string` — The suggested capability
- `actionLabel: string` — User-oriented description (e.g., "Sort them", "Filter them")
- `description: string` — Capability description
- `readiness: 'ready' | 'partial' | 'unreachable'` — How satisfiable the capability's inputs are

## State Changes

### Pipeline Store Extensions

The pipeline store (`pipeline-store.ts`) gains:

- `nodeConfiguredValues: Record<string, Record<string, ConfiguredValue>>` — Maps node ID → port name → configured value
- `nodeExecutionStates: Record<string, NodeExecutionState>` — Maps node ID → execution state
- `setNodeInputValue(nodeId, portName, value)` — Action to configure an input value
- `clearNodeInputValue(nodeId, portName)` — Action to clear a configured value
- `setNodeExecutionState(nodeId, state)` — Action to update per-node execution state

### Catalog Store Extensions

The catalog store (`catalog-store.ts`) gains:

- `paletteMode: PaletteMode` — Current palette display mode
- `recommendedCapabilities: DiscoverySuggestion[]` — Context-aware suggestions
- `setPaletteMode(mode)` — Action to switch palette mode
- `fetchRecommendations(flowContext)` — Action to fetch recommendations from discovery API

## Relationships

```text
CapabilityNodeData
  ├── has many → ConfiguredValue (one per directly configured input)
  ├── has one → NodeExecutionState (after Test execution)
  └── references → CapabilityDefinition (from catalog)

PaletteMode
  └── determines → which palette child component renders

EditorType
  └── determined by → SemanticTypeId (via domain mapping)
  └── determines → which input editor component renders

ContextualSuggestion
  └── produced by → DiscoveryEngine.suggestNext()
  └── creates → new CapabilityNodeData + Edge (on selection)
```
