# Feature Specification: Visual Pipeline Designer

**Feature Branch**: `002-visual-pipeline-designer`  
**Created**: 2026-08-19  
**Status**: Superseded by 007 and 008 (the designer builds drafts, not hand-wired pipelines)
**Input**: User description: "Create a UI-centric visual pipeline designer for EVE Forge, inspired by the interaction model of Jenkins Pipeline and node-based workflow tools."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build a Pipeline Visually (Priority: P1)

A data analyst opens the pipeline designer and sees an empty canvas with a searchable capability palette on the side. They want to build a market analysis pipeline by browsing available capabilities, dragging them onto the canvas, and connecting their typed ports together. They search for "market orders" in the palette, drag the capability onto the canvas, then drag a "Resolve Type" capability and connect its type output to the market orders input. The system validates the connection in real time, showing a green indicator when types are compatible and rejecting the connection with a red indicator when they are not. As they build, the designer highlights any required inputs that are not yet connected and suggests which capabilities could provide those inputs.

**Why this priority**: The core value of the designer is enabling users to compose data pipelines visually. Without this, nothing else matters.

**Independent Test**: Can be fully tested by dragging capabilities from the palette onto the canvas, connecting ports, and verifying that valid connections succeed while invalid ones are rejected.

**Acceptance Scenarios**:

1. **Given** an empty canvas and a populated capability palette, **When** the user drags a capability from the palette onto the canvas, **Then** it appears as a node with labeled input and output ports color-coded by semantic type.
2. **Given** two nodes on the canvas where one has an output port and another has an input port of the same semantic type, **When** the user drags a connection from the output to the input, **Then** the connection is accepted and rendered as an edge.
3. **Given** two nodes on the canvas where one has an output port and another has an input port of different semantic types, **When** the user drags a connection from the output to the input, **Then** the connection is rejected with a visual indicator explaining the type mismatch.
4. **Given** a node on the canvas with a required input port that is not connected, **When** the user views the canvas, **Then** the unmet input is visually highlighted as a warning.
5. **Given** two nodes with incompatible types where a known bridging capability exists, **When** the user attempts to connect them, **Then** the system suggests inserting the bridging capability to make the connection valid.

---

### User Story 2 - Inspect Node Details (Priority: P2)

A user has placed several capabilities on the canvas and wants to understand each one before connecting them. They click on a node to select it and a detail panel appears showing the capability's name, description, source (ESI, SDE, DERIVED, or COMPOSITE), all input and output ports with their semantic types, authentication requirements, caching characteristics, and estimated cost. This information helps them decide how to wire the pipeline and which capabilities to use.

**Why this priority**: Understanding what each capability does, what it needs, and what it produces is essential for making informed wiring decisions. Without inspection, users are connecting black boxes.

**Independent Test**: Can be tested by placing any capability on the canvas, selecting it, and verifying that all metadata is displayed accurately.

**Acceptance Scenarios**:

1. **Given** a node on the canvas, **When** the user selects it, **Then** a detail panel displays the capability's name, description, source, inputs, outputs, authentication requirements, caching policy, and cost estimate.
2. **Given** a selected node with authentication requirements, **When** the user views the detail panel, **Then** the required authentication scopes are listed clearly.
3. **Given** a selected node, **When** the user views its ports in the detail panel, **Then** each port shows its name, semantic type, whether it is required, and its description.

---

### User Story 3 - Compile and View Generated Artifacts (Priority: P2)

A user has built a pipeline on the canvas and wants to see what it compiles to before executing. They click "Validate" and the system compiles the visual pipeline into an execution plan. A bottom panel shows switchable views: the pipeline definition, the generated GraphQL contract, the execution plan with parallel groups and cost estimates, and any compiler diagnostics. As the user modifies the pipeline, these views update to reflect the current state.

**Why this priority**: Users need to verify their pipeline is valid and understand the generated artifacts before committing to execution. This closes the loop between visual design and the underlying compiler.

**Independent Test**: Can be tested by building a valid pipeline, triggering compilation, and verifying that the GraphQL schema, execution plan, and diagnostics all reflect the pipeline's current structure.

**Acceptance Scenarios**:

1. **Given** a valid pipeline on the canvas, **When** the user triggers compilation, **Then** the diagnostics panel shows no errors, the GraphQL view shows the generated schema definition, and the execution plan view shows the ordered steps with parallel groups.
2. **Given** a pipeline with a semantic type mismatch, **When** the user triggers compilation, **Then** the diagnostics panel shows the specific error with the node and edge involved, and suggests a bridging capability if one exists.
3. **Given** a pipeline with a cycle, **When** the user triggers compilation, **Then** the diagnostics panel reports the cycle with the involved nodes.
4. **Given** a compiled pipeline, **When** the user modifies the canvas (adds, removes, or reconnects nodes), **Then** the generated artifacts update to reflect the change.

---

### User Story 4 - Execute a Pipeline and View Results (Priority: P3)

A user has built and validated a pipeline. They click "Execute" and the system compiles the pipeline, runs it against the configured data sources, and displays the results. During execution, the canvas visually animates the flow of data through the pipeline: nodes light up as they execute, show timing information, and display whether results came from cache or a live data source. When execution completes, the results panel shows the output data alongside per-node provenance, timing, and cache usage. If a node fails, its error is shown both on the canvas and in the diagnostics panel.

**Why this priority**: Execution is the ultimate payoff of the designer, but depends on all prior stories being functional. Without the ability to build, inspect, and validate a pipeline, execution has no foundation.

**Independent Test**: Can be tested by building a known-valid pipeline (e.g., Resolve Type to Market Orders), executing it, and verifying that results appear with correct provenance and timing data.

**Acceptance Scenarios**:

1. **Given** a valid, compiled pipeline, **When** the user clicks Execute, **Then** the pipeline is executed and results are displayed in the results panel with output data.
2. **Given** a pipeline being executed, **When** a node begins processing, **Then** it is visually highlighted on the canvas to indicate active execution.
3. **Given** a completed execution, **When** the user views the results, **Then** each node shows its execution duration, whether its result was cached, and its data source provenance.
4. **Given** a pipeline where a node fails during execution, **When** the error occurs, **Then** the failed node is highlighted on the canvas, the error message is shown in the diagnostics panel, and subsequent dependent nodes are marked as skipped.

---

### User Story 5 - Save, Load, and Share Pipelines (Priority: P3)

A user has built a pipeline they want to keep. They save it with a name. Later, they load it back and the canvas, connections, and all node positions are restored. They can also export the pipeline as a file to share with colleagues, and import pipelines that others have shared. The exported format is the same serialized pipeline definition used by the EVE Fabric compiler, ensuring portability between the visual designer and other tools.

**Why this priority**: Persistence and sharing complete the designer's utility but are not needed for the core design-compile-execute loop.

**Independent Test**: Can be tested by building a pipeline, saving it, clearing the canvas, loading it back, and verifying the restored pipeline matches the original.

**Acceptance Scenarios**:

1. **Given** a pipeline on the canvas, **When** the user saves it with a name, **Then** the pipeline is persisted and can be retrieved later.
2. **Given** a saved pipeline, **When** the user loads it, **Then** the canvas is restored with all nodes, edges, positions, and metadata intact.
3. **Given** a pipeline on the canvas, **When** the user exports it, **Then** a file is produced in the standard pipeline definition format used by the EVE Fabric compiler.
4. **Given** an exported pipeline file, **When** the user imports it, **Then** the canvas is populated with the pipeline's nodes and edges.

---

### User Story 6 - Smart Pipeline Assistance (Priority: P3)

As a user builds a pipeline, the designer proactively helps them work more efficiently. When a node has unconnected required inputs, the palette highlights capabilities whose outputs could satisfy those inputs. The system detects reusable outputs (where one node's output feeds multiple downstream nodes) and visualizes shared data paths. When the user selects a node, the palette can filter to show only capabilities that accept that node's outputs as input, helping users discover what comes next.

**Why this priority**: Smart assistance makes the designer feel intelligent rather than just graphical, but it builds on top of the basic wiring and inspection stories.

**Independent Test**: Can be tested by placing a node with unconnected inputs and verifying that the palette highlights compatible capabilities.

**Acceptance Scenarios**:

1. **Given** a node with an unconnected required input of a specific semantic type, **When** the user views the palette, **Then** capabilities that produce that semantic type are highlighted or surfaced.
2. **Given** a selected node with outputs, **When** the user requests "what can connect next," **Then** the palette filters to show only capabilities whose inputs match the selected node's output types.
3. **Given** a pipeline where one node's output feeds multiple downstream nodes, **When** the user views the canvas, **Then** the shared data path is visually distinct.

---

### Edge Cases

- What happens when the user attempts to connect a node's output back to its own input (self-loop)?
- What happens when the user builds a pipeline with no output nodes defined?
- What happens when the capability catalog is empty or unavailable?
- How does the system handle very large pipelines (50+ nodes) without degrading canvas performance?
- What happens when a saved pipeline references capabilities that no longer exist in the catalog?
- What happens when execution is triggered but required data sources are unreachable?
- What happens when the user drags a capability that requires authentication but no credentials are configured?

## Requirements _(mandatory)_

### Functional Requirements

**Canvas & Node Composition**

- **FR-001**: System MUST provide a drag-and-drop canvas where users can place capability nodes from a palette.
- **FR-002**: System MUST render each capability node with clearly labeled input and output ports, color-coded by semantic type.
- **FR-003**: System MUST allow users to draw connections between an output port of one node and an input port of another node.
- **FR-004**: System MUST validate connections in real time based on semantic type compatibility, accepting compatible connections and rejecting incompatible ones with a visual explanation.
- **FR-005**: System MUST highlight required input ports that are not yet connected.
- **FR-006**: System MUST suggest inserting a bridging capability when an incompatible connection could be made valid through an intermediate node.

**Capability Palette**

- **FR-007**: System MUST provide a searchable palette of all available capabilities from the capability catalog.
- **FR-008**: Users MUST be able to filter palette capabilities by source type (ESI, SDE, DERIVED, COMPOSITE).
- **FR-009**: System MUST group palette capabilities by category for discoverability.

**Node Inspection**

- **FR-010**: System MUST display a detail panel when a node is selected, showing: name, description, source, all input ports, all output ports, authentication requirements, caching policy, and cost estimate.

**Compilation & Artifacts**

- **FR-011**: System MUST compile the visual pipeline using the same compilation pipeline as the EVE Fabric compiler, producing diagnostics, an execution plan, and a generated GraphQL schema.
- **FR-012**: System MUST display compiler diagnostics with severity levels, affected nodes/edges, and actionable suggestions.
- **FR-013**: System MUST display the generated GraphQL schema definition in a preview panel.
- **FR-014**: System MUST display the execution plan showing step ordering, parallel groups, and cost estimates.
- **FR-015**: System MUST update generated artifacts when the pipeline is modified.

**Execution**

- **FR-016**: System MUST allow users to execute a validated pipeline against configured data sources.
- **FR-017**: System MUST visually indicate which nodes are currently executing, completed, failed, or pending during execution.
- **FR-018**: System MUST display execution results including output data, per-node timing, cache hit/miss status, and data source provenance.
- **FR-019**: System MUST display errors inline on the canvas and in the diagnostics panel when a node fails during execution.

**Persistence**

- **FR-020**: Users MUST be able to save pipelines with a name and load them later with full state restoration.
- **FR-021**: Users MUST be able to export pipelines in the standard pipeline definition format and import pipelines from that format.

**Smart Assistance**

- **FR-022**: System MUST highlight palette capabilities that can satisfy unconnected required inputs on selected nodes.
- **FR-023**: System MUST allow users to filter the palette to show only capabilities compatible with a selected node's outputs.

**Domain Model Integrity**

- **FR-024**: The visual pipeline MUST serialize to and deserialize from the same pipeline definition format used by the EVE Fabric compiler. The designer MUST NOT introduce its own composition rules or formats.

**Initial Capability Set**

- **FR-025**: The initial release MUST support at minimum the following capability flow: Resolve Type, Market Orders, Resolve Location, Route Distance, Filter, Sort, and Result, demonstrating a complete end-to-end pipeline.

### Key Entities

- **Capability Node**: A visual representation of a capability definition placed on the canvas. Has a position, a reference to a capability in the catalog, and visual state (selected, executing, error, complete).
- **Port**: A typed connection point on a node. Each port has a name, a semantic type, a direction (input or output), and whether it is required. Ports are the units of connection.
- **Connection (Edge)**: A directed link from one node's output port to another node's input port. Represents data flow and must satisfy semantic type compatibility.
- **Pipeline**: The complete graph of nodes and connections on the canvas, along with metadata (name, version, description) and declared pipeline-level inputs and outputs.
- **Execution Result**: The outcome of running a pipeline, including output data per node, timing metrics, cache usage, provenance records, and any errors.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can build a complete pipeline (at least 5 nodes with valid connections) in under 5 minutes using only the visual designer.
- **SC-002**: 90% of users can successfully build and execute their first pipeline without needing external documentation or guidance.
- **SC-003**: Real-time connection validation provides feedback (accept or reject) within 200 milliseconds of the user completing a drag gesture.
- **SC-004**: The canvas remains responsive (no perceptible lag in panning, zooming, or dragging) with pipelines containing up to 50 nodes and 100 connections.
- **SC-005**: Pipeline compilation and artifact generation (GraphQL schema, execution plan, diagnostics) completes within 2 seconds for pipelines up to 30 nodes.
- **SC-006**: Exported pipelines can be imported by the EVE Fabric compiler without modification, and compiler-produced pipelines can be imported into the designer without loss of information.
- **SC-007**: Users can identify and fix a pipeline error (type mismatch, missing input, cycle) in under 1 minute using only the diagnostics and visual cues provided by the designer.
- **SC-008**: During execution, users can visually track which stage of the pipeline is currently processing, providing real-time understanding of data flow.

## Assumptions

- Users have a modern desktop browser with sufficient screen resolution for a canvas-based interface (minimum 1280x720). Mobile and tablet support is out of scope for the initial release.
- The capability catalog is pre-populated with registered capabilities available through the gateway. The designer does not create new capability definitions, only composes existing ones.
- Data source connectivity (ESI, SDE) is configured at the system level. The designer does not manage data source credentials or connection strings.
- The initial release targets the focused capability set described in FR-025. Additional capabilities will become available as they are registered in the catalog without requiring designer changes.
- Pipeline persistence uses the gateway's existing save/load mechanisms. Offline or local-only storage is not required.
- The designer runs as a companion to the EVE Fabric gateway and expects the gateway to be available for capability catalog access and pipeline execution.
