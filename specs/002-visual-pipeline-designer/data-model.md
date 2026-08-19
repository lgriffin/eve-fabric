# Data Model: Visual Pipeline Designer

**Feature**: 002-visual-pipeline-designer  
**Date**: 2026-08-19

## Overview

The designer introduces UI-specific state models that wrap existing domain entities. No new domain entities are created. All designer models either reference or serialize to/from the existing `PipelineDefinition`, `CapabilityDefinition`, and `ExecutionPlan` types defined in `packages/domain`.

## Entities

### CanvasNode

Represents a capability placed on the designer canvas. Wraps a `CapabilityDefinition` reference with visual and interaction state.

**Attributes**:

- `id` — unique identifier on the canvas (string, generated on drop)
- `capabilityId` — reference to `CapabilityId` in the catalog
- `capabilityVersion` — optional version pin (defaults to latest)
- `position` — x/y coordinates on the canvas
- `label` — display name (defaults to capability name)
- `source` — capability source classification (ESI, SDE, DERIVED, CACHE, COMPOSITE)
- `inputs` — list of input ports derived from the capability's `SemanticPort` definitions
- `outputs` — list of output ports derived from the capability's `SemanticPort` definitions
- `executionState` — current execution status (idle, queued, executing, completed, failed, skipped)
- `executionMetrics` — after execution: duration, cache hit/miss, provenance record
- `config` — user-supplied configuration for the node (e.g., filter predicates, sort keys)

**Relationships**:

- References one `CapabilityDefinition` from the catalog
- Has many `CanvasPort` instances (inputs and outputs)
- Participates in many `CanvasEdge` connections

**Validation rules**:

- `capabilityId` must exist in the current catalog
- `position` must have finite numeric coordinates
- `executionState` transitions must follow the state machine: idle → queued → executing → (completed | failed | skipped)

### CanvasPort

Represents a typed connection point on a canvas node. Derived from `SemanticPort`.

**Attributes**:

- `name` — port name (from `SemanticPort.name`)
- `semanticType` — the `SemanticTypeId` governing type compatibility
- `direction` — input or output
- `required` — whether an input connection is mandatory
- `description` — human-readable description of what the port carries
- `connected` — whether this port currently has at least one edge

**Relationships**:

- Belongs to one `CanvasNode`
- Input ports receive at most one incoming `CanvasEdge`
- Output ports may have many outgoing `CanvasEdge` connections

**Validation rules**:

- Required input ports that are not connected produce a warning diagnostic
- A port's semantic type determines which other ports it can connect to

### CanvasEdge

A directed connection between an output port on one node and an input port on another. Corresponds to a `PipelineEdge` in the domain model.

**Attributes**:

- `id` — unique edge identifier (string, generated on connect)
- `sourceNodeId` — the node providing the output
- `sourcePortName` — the output port name on the source node
- `targetNodeId` — the node receiving the input
- `targetPortName` — the input port name on the target node
- `valid` — whether this connection satisfies semantic type compatibility
- `animated` — whether this edge is currently animated (during execution)

**Relationships**:

- Connects exactly one output port to exactly one input port
- References two `CanvasNode` instances (source and target)

**Validation rules**:

- Source port's semantic type must be compatible with target port's semantic type
- Self-loops (source and target are the same node) are rejected
- Each input port may receive at most one incoming edge

**Serialization**: Maps to `PipelineEdge` as `{ from: "{sourceNodeId}.{sourcePortName}", to: "{targetNodeId}.{targetPortName}" }`

### PipelineMeta

Metadata about the pipeline being designed. Corresponds to the top-level fields of `PipelineDefinition`.

**Attributes**:

- `id` — pipeline identifier (kebab-case string)
- `version` — pipeline version number
- `name` — human-readable pipeline name
- `description` — optional description
- `isDirty` — whether unsaved changes exist

**Validation rules**:

- `id` must be a valid kebab-case string
- `version` must be a positive integer
- `name` is required and non-empty

### ExecutionSession

Represents one execution run of the current pipeline. Created when the user clicks Execute.

**Attributes**:

- `id` — execution session identifier
- `startedAt` — timestamp when execution began
- `completedAt` — timestamp when execution finished (or null if in progress)
- `status` — overall status (running, completed, failed, cancelled)
- `stepStatuses` — map of step ID to execution state (queued, executing, completed, failed, skipped)
- `stepResults` — map of step ID to output data
- `stepMetrics` — map of step ID to duration, cache status, provenance
- `outputs` — final pipeline output data
- `errors` — list of errors encountered during execution

**Relationships**:

- References the `PipelineMeta` that was executed
- Step IDs map back to `CanvasNode` IDs for visual state updates

**State transitions**: running → (completed | failed | cancelled)

### BridgingSuggestion

A suggestion to insert an intermediate capability to bridge a type mismatch between two ports.

**Attributes**:

- `sourceNodeId` — the node with the incompatible output
- `sourcePortName` — the output port name
- `targetNodeId` — the node with the incompatible input
- `targetPortName` — the input port name
- `suggestedCapabilityId` — the `CapabilityId` that bridges the type gap
- `suggestedCapabilityName` — human-readable name for display
- `sourceType` — the semantic type of the source port
- `targetType` — the semantic type of the target port

**Relationships**:

- References two `CanvasNode` instances and one `CapabilityDefinition`
- Generated from compiler `SEMANTIC_SUGGESTION` diagnostics

## State Machine: Node Execution

```text
     ┌──────┐
     │ idle │ ← initial state / reset
     └──┬───┘
        │ execution starts
        v
     ┌──────┐
     │queued│ ← waiting for dependencies
     └──┬───┘
        │ dependencies resolved
        v
  ┌───────────┐
  │ executing │ ← actively running
  └─────┬─────┘
        │
   ┌────┼────┐
   v    v    v
┌────┐┌────┐┌───────┐
│done││fail││skipped│
└────┘└────┘└───────┘
```

- `idle`: Default state, no execution in progress
- `queued`: Execution started, waiting for upstream dependencies
- `executing`: This node's capability is actively being invoked
- `completed`: Execution succeeded, results available
- `failed`: Execution encountered an error
- `skipped`: A dependency failed, this node was not executed
