# Data Model: Designer DX Overhaul

**Branch**: `006-designer-dx-overhaul` | **Date**: 2026-08-20

## Entities

### CatalogCapability (existing, no changes)

Represents a capability loaded from the gateway registry into the designer's catalog store.

| Field       | Type               | Description                                      |
| ----------- | ------------------ | ------------------------------------------------ |
| id          | string             | Stable dotted identifier (e.g., `market.orders`) |
| version     | string             | Semantic version                                 |
| name        | string             | Human-readable name                              |
| description | string             | Capability description                           |
| source      | CapabilitySource   | ESI, SDE, DERIVED, CACHE, COMPOSITE              |
| inputs      | InputDefinition[]  | Typed input ports                                |
| outputs     | OutputDefinition[] | Typed output ports                               |
| category    | string             | UI grouping derived from id prefix               |
| isComposite | boolean            | Whether this is a published pipeline             |

### PipelineDefinition (existing, no changes)

Serialized pipeline representation used for YAML import/export and gateway communication.

| Field       | Type             | Description                                       |
| ----------- | ---------------- | ------------------------------------------------- |
| id          | string           | Pipeline identifier                               |
| version     | number           | Pipeline version                                  |
| name        | string           | Display name                                      |
| description | string           | Pipeline description                              |
| inputs      | PipelineInput[]  | Pipeline-level inputs with semantic types         |
| nodes       | PipelineNode[]   | Processing nodes with capability references       |
| edges       | PipelineEdge[]   | Directed connections (from/to in dotted notation) |
| outputs     | PipelineOutput[] | Pipeline-level outputs                            |

### Toast (new)

Transient notification displayed to the user.

| Field         | Type                                        | Description                                       |
| ------------- | ------------------------------------------- | ------------------------------------------------- |
| id            | string                                      | Unique identifier for deduplication and dismissal |
| severity      | 'error' \| 'warning' \| 'success' \| 'info' | Visual treatment and icon                         |
| title         | string                                      | Short summary of what happened                    |
| message       | string                                      | Detail text (what failed, error message)          |
| dismissible   | boolean                                     | Whether the user can manually dismiss             |
| autoDismissMs | number                                      | Auto-dismiss timeout (default 8000)               |
| createdAt     | number                                      | Timestamp for ordering and expiry                 |

### UndoEntry (new)

Snapshot of canvas state captured before a mutation.

| Field       | Type   | Description                                                                  |
| ----------- | ------ | ---------------------------------------------------------------------------- |
| nodes       | Node[] | React Flow nodes at time of snapshot                                         |
| edges       | Edge[] | React Flow edges at time of snapshot                                         |
| description | string | Human-readable description of the mutation (e.g., "Delete node fetchOrders") |
| timestamp   | number | When the snapshot was taken                                                  |

### ExecutionInputValue (new)

A user-provided value for a pipeline execution input.

| Field        | Type                        | Description                                             |
| ------------ | --------------------------- | ------------------------------------------------------- |
| name         | string                      | Input parameter name                                    |
| value        | string \| number \| boolean | User-provided value                                     |
| semanticType | string                      | Semantic type of the input (for display and validation) |

### KeyboardShortcut (new)

A registered keyboard shortcut definition.

| Field     | Type                           | Description                                                       |
| --------- | ------------------------------ | ----------------------------------------------------------------- |
| key       | string                         | Key code (e.g., 'z', 's', 'Delete')                               |
| modifiers | ('ctrl' \| 'shift' \| 'alt')[] | Required modifier keys                                            |
| action    | string                         | Action identifier                                                 |
| label     | string                         | Display label for help overlay                                    |
| category  | string                         | Grouping for help overlay (e.g., 'Editing', 'File', 'Navigation') |

### DesignToken (new)

Centralized visual styling value.

| Field            | Type   | Description                       |
| ---------------- | ------ | --------------------------------- |
| color.surface.*  | string | Surface/background colors         |
| color.source.*   | string | Capability source category colors |
| color.semantic.* | string | Semantic type indicator colors    |
| color.status.*   | string | Execution status colors           |
| color.accent     | string | Primary accent color              |
| spacing.*        | string | Spacing scale values              |
| fontSize.*       | string | Typography scale                  |
| borderRadius.*   | string | Corner radius scale               |
| fontFamily.mono  | string | Monospace font stack              |

## Relationships

```text
CatalogCapability 1──* PipelineNode (node references a capability by id)
PipelineDefinition 1──* PipelineNode
PipelineDefinition 1──* PipelineEdge
PipelineDefinition 1──* PipelineInput
PipelineInput 1──1 ExecutionInputValue (matched by name)
UndoEntry ──snapshot── (Node[], Edge[])
Toast ──triggered-by── any failed operation
DesignToken ──consumed-by── all components
```

## State Transitions

### Toast Lifecycle

```text
created → visible → auto-dismissed
                  → manually-dismissed
```

### Undo Stack

```text
[empty] → push(snapshot) on mutation → push(snapshot) on mutation → ...
                                     ← pop on undo
                                     → push to redo stack on undo
New mutation after undo → redo stack cleared
```

### Execution Input Dialog

```text
Execute clicked → check required inputs
  → no required inputs → execute immediately
  → has required inputs → show dialog (pre-fill from localStorage)
    → user fills values → Run clicked → execute with inputs
    → Cancel clicked → no execution
```
