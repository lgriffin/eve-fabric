# Feature Specification: Composite Capabilities & Flow Registry

**Feature Branch**: `003-composite-flow-registry`  
**Created**: 2026-08-19  
**Status**: Draft  
**Input**: User description: "Extend Eve Fabric so that any successfully validated Fabric Flow can be published as a new reusable capability, with a unified Fabric Registry, recursive composition, drill-down inspection, versioning, dependency tracking, and provenance lineage."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse Capabilities from a Unified Registry (Priority: P1)

A user opens Fabric Studio and sees a Capability Palette populated entirely from a central Fabric Registry. The palette organises capabilities by classification: ESI (live data operations), SDE (static reference data), DERIVED (calculations and transformations), and COMPOSITE (previously published Fabric Flows). Each capability displays its name, description, semantic inputs, outputs, and classification. The user can search and filter the palette to find capabilities relevant to their task.

**Why this priority**: The registry is the foundation that all other features depend on. Without a single, machine-readable source of truth for available capabilities, publishing, composition, and palette generation cannot function. This story delivers immediate value by replacing any hard-coded or manually maintained capability lists with a dynamic, self-describing registry.

**Independent Test**: Can be fully tested by opening Fabric Studio and verifying that the Capability Palette displays all registered capabilities with correct classifications, inputs, outputs, and metadata. Delivers value by giving users a discoverable, filterable catalog of everything available.

**Acceptance Scenarios**:

1. **Given** the Fabric Registry contains ESI, SDE, and DERIVED capabilities, **When** a user opens Fabric Studio, **Then** the Capability Palette displays all registered capabilities grouped by classification.
2. **Given** the registry contains a capability with defined inputs and outputs, **When** a user selects that capability in the palette, **Then** the palette displays its semantic inputs, outputs, version, description, and source requirements.
3. **Given** the registry contains capabilities across multiple classifications, **When** a user filters the palette by classification (e.g., "ESI"), **Then** only capabilities of that classification appear.
4. **Given** a new capability is added to the registry, **When** the user refreshes or reopens the palette, **Then** the new capability appears without manual configuration.

---

### User Story 2 - Publish a Fabric Flow as a Reusable Capability (Priority: P2)

A user has built and validated a Fabric Flow (e.g., a pipeline that resolves a type, fetches market orders, resolves locations, calculates route distances, filters, and sorts). The user triggers a "Publish as Capability" action. They are presented with the flow's internal inputs and outputs and select which ones form the public contract. For example, they expose "Item", "Origin", and "Maximum Jumps" as inputs and "Location", "Price", and "Distance" as outputs. They give the capability a name (e.g., "Nearby Market Search") and publish it. The system validates the complete internal flow, then registers the new capability as COMPOSITE in the Fabric Registry. The internal pipeline is encapsulated and hidden from consumers.

**Why this priority**: Publishing is the core value proposition of this feature. Without it, users cannot create reusable capabilities from their flows. This transforms Fabric Studio from a one-off pipeline builder into a platform for building progressively more powerful data capabilities.

**Independent Test**: Can be fully tested by building a multi-step Fabric Flow, publishing it with selected inputs and outputs, and then verifying the new capability appears in the registry with the correct public contract while the internal pipeline remains hidden.

**Acceptance Scenarios**:

1. **Given** a user has a validated Fabric Flow with multiple steps, **When** they select "Publish as Capability", **Then** the system presents all available inputs and outputs from the flow for selection.
2. **Given** a user has selected inputs, outputs, and a name for the capability, **When** they confirm publication, **Then** the system validates the complete internal flow before registering.
3. **Given** validation succeeds, **When** the capability is published, **Then** it appears in the Fabric Registry as a COMPOSITE capability with only the selected inputs and outputs visible.
4. **Given** a flow contains a validation error, **When** the user attempts to publish, **Then** the system rejects publication and reports the specific validation failure.
5. **Given** a published capability exists, **When** another user views it in the palette, **Then** they see only the published inputs and outputs, not the internal pipeline steps.

---

### User Story 3 - Compose Capabilities Recursively (Priority: P3)

A user drags a previously published COMPOSITE capability (e.g., "Nearby Market Search") onto the Fabric Studio canvas alongside other capabilities (ESI, SDE, DERIVED, or other COMPOSITE). The composite capability behaves identically to any primitive capability: it exposes its published inputs and outputs, can be connected to other nodes, and participates in the flow without any special treatment. The user builds a larger pipeline (e.g., combining "Nearby Market Search", "Hauling Cost", "Character Skills", and "Market History" into "Trade Opportunity") and publishes that as another COMPOSITE capability. "Trade Opportunity" can then itself be used in yet another Fabric Flow.

**Why this priority**: Recursive composition is what makes the system scale. Users can build increasingly complex data capabilities by standing on prior work. Without this, composite capabilities would be dead ends rather than building blocks. The specification explicitly identifies this as the defining success criterion.

**Independent Test**: Can be fully tested by publishing two or more simple capabilities, composing them into a larger pipeline, publishing that pipeline as a new capability, and then verifying the new capability can itself be placed on the canvas and connected to other nodes.

**Acceptance Scenarios**:

1. **Given** a COMPOSITE capability exists in the registry, **When** a user drags it onto the canvas, **Then** it appears as a single node with its published inputs and outputs, identical in behaviour to primitive capabilities.
2. **Given** a user has composed multiple COMPOSITE capabilities into a new flow, **When** they publish it, **Then** the resulting capability is registered and usable in subsequent flows.
3. **Given** a multi-level composite (e.g., "Trade Opportunity" containing "Nearby Market Search" which itself contains primitives), **When** a user places "Trade Opportunity" on the canvas, **Then** it behaves as a single capability node with no visible distinction from primitives.

---

### User Story 4 - Drill Down into Composite Internals (Priority: P4)

A user sees a composite capability on the canvas (e.g., "Nearby Market Search"). The node displays an "Open" action. When the user triggers it, the system reveals the internal Fabric Flow that defines the capability, without destroying the parent pipeline context. The user can inspect each internal step, understand how the composite works, and navigate back to the parent flow. For multi-level composites, the user can drill down further into nested composites.

**Why this priority**: Transparency builds trust. Users need to understand what a composite capability does internally before relying on it. Without drill-down, composites become opaque black boxes. This also supports debugging and auditing.

**Independent Test**: Can be fully tested by placing a composite capability on the canvas, opening it, verifying the internal flow is displayed correctly, and navigating back to the parent pipeline.

**Acceptance Scenarios**:

1. **Given** a composite capability is on the canvas, **When** the user selects "Open", **Then** the internal Fabric Flow is displayed showing all internal steps and connections.
2. **Given** the user is viewing a composite's internals, **When** they navigate back, **Then** the parent pipeline is restored in its original state.
3. **Given** a composite contains another composite internally, **When** the user opens the outer composite and then opens the inner composite, **Then** each level displays its internal flow correctly.

---

### User Story 5 - Version and Upgrade Capabilities (Priority: P5)

When a user publishes a capability, they assign it a version number. Published versions are immutable: once "Nearby Market Search 1.0.0" is published, it cannot be modified. To make changes, the user publishes a new version (e.g., 1.1.0 or 2.0.0). Existing Fabric Flows that depend on version 1.0.0 continue using that version. When the user opens a flow that depends on an older version, Fabric Studio identifies that a newer compatible version is available and offers the option to upgrade.

**Why this priority**: Immutable versioning prevents breaking changes from cascading through dependent flows. Without it, modifying a composite capability could silently break every flow that uses it. Upgrade awareness keeps users informed without forcing changes.

**Independent Test**: Can be fully tested by publishing a capability at version 1.0.0, creating a flow that depends on it, publishing version 1.1.0, and verifying that the original flow still uses 1.0.0 while Fabric Studio signals the availability of 1.1.0.

**Acceptance Scenarios**:

1. **Given** a user publishes "Nearby Market Search" at version 1.0.0, **When** they attempt to modify version 1.0.0, **Then** the system prevents modification and requires publishing a new version.
2. **Given** a flow depends on "Nearby Market Search@1.0.0" and version 1.1.0 exists, **When** the user opens the flow, **Then** Fabric Studio indicates a newer compatible version is available.
3. **Given** multiple versions of a capability exist, **When** the user views the capability in the registry, **Then** all published versions are listed with their version numbers.
4. **Given** a user chooses to upgrade a dependency, **When** the upgrade completes, **Then** the flow references the new version and the previous version reference is removed.

---

### User Story 6 - Track Dependency Graph and Prevent Circular Composition (Priority: P6)

The system maintains a dependency graph showing how composite capabilities relate to one another. For example, "Trade Recommendation" depends on "Trade Opportunity@2" which depends on "Nearby Market Search@1" and "Hauling Cost@2". Users can view this dependency tree. If a user attempts to create a circular dependency (e.g., capability A depends on B which depends on A), the system detects and rejects it before publication.

**Why this priority**: Without dependency tracking, users cannot understand the impact of changing or retiring a capability. Without circular dependency detection, the system could enter infinite expansion loops during compilation or execution. Both are essential for system integrity at scale.

**Independent Test**: Can be fully tested by publishing a chain of composite capabilities (A uses B, B uses C), viewing the dependency graph, and then attempting to add C as a dependency of A to verify circular detection.

**Acceptance Scenarios**:

1. **Given** a composite capability depends on other composites, **When** the user views its dependency information, **Then** the complete dependency tree is displayed with version annotations.
2. **Given** a user builds a flow that would create a circular dependency, **When** they attempt to publish, **Then** the system rejects publication with a clear explanation of the cycle.
3. **Given** a user builds a flow that would create a circular dependency at validation time (before publication), **When** the system validates the flow, **Then** the cycle is detected and reported.

---

### User Story 7 - Execute Flows with Composite Capabilities (Priority: P7)

A user executes a Fabric Flow that contains composite capabilities. The system expands all composites into the complete execution graph, recognising common sub-dependencies across composites and executing them only once where possible. For example, if two composites both require "Resolve Type('Tritanium')", the system executes that operation once and shares the result. The user sees results that include full provenance lineage: a result derived from SDE data fed into an ESI call and then a derived calculation reports its lineage as SDE, ESI, and DERIVED rather than simply "COMPOSITE".

**Why this priority**: Execution with optimisation and provenance proves the entire system works end-to-end. Without this, composites would be a visual convenience only. Provenance transparency is critical for users who need to know the freshness, reliability, and source of their data.

**Independent Test**: Can be fully tested by executing a flow containing nested composite capabilities and verifying that results are correct, common sub-dependencies are deduplicated, and provenance lineage traces through to the original sources.

**Acceptance Scenarios**:

1. **Given** a flow contains composite capabilities, **When** it is executed, **Then** the system expands composites into the complete execution graph and produces correct results.
2. **Given** two composites in a flow share a common sub-dependency with identical parameters, **When** the flow is executed, **Then** the common operation is executed only once.
3. **Given** a composite capability internally uses ESI, SDE, and DERIVED sources, **When** the flow is executed and results are returned, **Then** provenance traces through to the original ESI, SDE, and DERIVED sources rather than reporting "COMPOSITE".
4. **Given** a deeply nested composite (composite within composite within composite), **When** the flow is executed, **Then** provenance correctly represents the full lineage through all layers.

---

### User Story 8 - Demonstrate End-to-End Recursive Composition (Priority: P8)

A user creates three flows: "Market Snapshot", "Route Analysis", and "Hauling Cost". Each is published as a composite capability. The user then builds a new flow combining these three into "Trade Opportunity" and publishes it. "Trade Opportunity" appears in the Capability Palette as a single reusable node, indistinguishable from any primitive capability. The user can drag "Trade Opportunity" onto a new canvas, connect it to other capabilities, and build further compositions.

**Why this priority**: This end-to-end demonstration validates the full lifecycle: build, publish, compose, re-publish. It is the defining acceptance criterion for the entire feature and proves that no artificial barrier exists between primitive and composite capabilities.

**Independent Test**: Can be fully tested by following the exact sequence: create three primitive flows, publish each, compose them into "Trade Opportunity", publish it, and verify it appears in the palette as a first-class reusable node.

**Acceptance Scenarios**:

1. **Given** three published composite capabilities ("Market Snapshot", "Route Analysis", "Hauling Cost") exist in the registry, **When** the user composes them into a new flow and publishes it as "Trade Opportunity", **Then** "Trade Opportunity" appears in the Capability Palette.
2. **Given** "Trade Opportunity" exists in the palette, **When** the user drags it onto a new canvas, **Then** it behaves as a single node with its published inputs and outputs.
3. **Given** "Trade Opportunity" is on a canvas, **When** the user opens it for drill-down, **Then** the internal flow showing "Market Snapshot", "Route Analysis", and "Hauling Cost" is displayed.

---

### Edge Cases

- What happens when a user tries to publish a flow that contains no steps?
- What happens when a user selects zero inputs or zero outputs when publishing?
- How does the system handle publishing a capability with a name that already exists at the same version?
- What happens when a capability version that a flow depends on is somehow corrupted or missing from the registry?
- What happens when a composite capability is many levels deep (e.g., 10+ levels of nesting)?
- How does the system handle a user attempting to delete or retire a capability version that other published capabilities depend on?
- What happens when two capabilities expose outputs with the same semantic name but different structures?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST maintain a Fabric Registry that serves as the single source of truth for all capabilities available to Fabric Studio.
- **FR-002**: Every registry entry MUST include machine-readable metadata: semantic inputs, semantic outputs, classification (ESI, SDE, DERIVED, COMPOSITE), version, dependencies, source requirements, authentication requirements, caching policy, description, and provenance characteristics.
- **FR-003**: The Fabric Studio Capability Palette MUST be generated directly and exclusively from the Fabric Registry.
- **FR-004**: Users MUST be able to publish any validated Fabric Flow as a new COMPOSITE capability.
- **FR-005**: During publication, users MUST be able to select which of the flow's inputs and outputs form the capability's public contract.
- **FR-006**: The system MUST validate the complete internal flow before allowing publication.
- **FR-007**: Published capabilities MUST encapsulate their internal pipeline; consumers see only the public contract.
- **FR-008**: COMPOSITE capabilities MUST behave identically to ESI, SDE, and DERIVED capabilities in the pipeline designer: they appear in the palette, can be dragged onto the canvas, connected to other nodes, and participate in flows without special treatment.
- **FR-009**: Users MUST be able to compose COMPOSITE capabilities with other COMPOSITE or primitive capabilities to create new flows, and publish those flows as further COMPOSITE capabilities (recursive composition).
- **FR-010**: Composite nodes MUST visually appear as single nodes by default on the canvas.
- **FR-011**: Users MUST be able to open (drill down into) a composite node to inspect its internal Fabric Flow without destroying the parent pipeline context.
- **FR-012**: Drill-down MUST support navigation back to the parent flow.
- **FR-013**: Published capability versions MUST be immutable; modifications require publishing a new version.
- **FR-014**: Existing Fabric Flows MUST retain their declared dependency version unless explicitly upgraded by the user.
- **FR-015**: Fabric Studio MUST identify when a newer compatible version of a dependency is available and notify the user.
- **FR-016**: The system MUST maintain a dependency graph between composite capabilities showing version-annotated relationships.
- **FR-017**: The system MUST detect circular composition and reject it before publication or execution.
- **FR-018**: Before execution, the system MUST expand composite capabilities into the complete execution graph.
- **FR-019**: The execution planner MUST be capable of recognising common sub-dependencies across composites and executing them only once.
- **FR-020**: Composite capability results MUST retain provenance from their internal sources (ESI, SDE, DERIVED) rather than reporting simply "COMPOSITE".
- **FR-021**: The provenance graph MUST preserve the full underlying source lineage through any depth of composite nesting.
- **FR-022**: There MUST be a single unified model for capabilities, flows, compilation, and execution. Composite capabilities MUST NOT introduce a separate execution or schema system.

### Key Entities

- **Capability**: A reusable unit of data retrieval or transformation. Has a classification (ESI, SDE, DERIVED, COMPOSITE), version, semantic inputs, semantic outputs, metadata, and provenance characteristics. COMPOSITE capabilities additionally reference an encapsulated Fabric Flow.
- **Fabric Registry**: The centralised catalog of all capabilities. Serves as the single source of truth for the Capability Palette and for dependency resolution.
- **Fabric Flow**: An ordered graph of connected capabilities that defines a data pipeline. When published, a flow's selected inputs and outputs become a capability's public contract.
- **Capability Version**: An immutable snapshot of a capability at a point in time, identified by a version number. Once published, a version cannot be modified.
- **Dependency Graph**: A directed acyclic graph of relationships between composite capabilities, annotated with version numbers. Used for impact analysis, upgrade detection, and circular dependency prevention.
- **Public Contract**: The subset of a Fabric Flow's inputs and outputs that the author selects to expose when publishing. Defines what consumers of the capability see and interact with.
- **Provenance Record**: Metadata attached to execution results that traces the lineage of data through its original sources, preserving source types through composite boundaries.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can discover and browse all available capabilities (ESI, SDE, DERIVED, COMPOSITE) from a single searchable palette within Fabric Studio.
- **SC-002**: A user can publish a validated Fabric Flow as a reusable COMPOSITE capability in under 5 minutes, including input/output selection and naming.
- **SC-003**: A published COMPOSITE capability is usable on the canvas within 30 seconds of publication, with no manual configuration or palette refresh.
- **SC-004**: A user can build a pipeline containing at least 3 levels of composite nesting (composite of composites of composites) and execute it successfully.
- **SC-005**: When two composites in a flow share an identical sub-dependency, execution time is measurably reduced compared to executing the dependency twice.
- **SC-006**: 100% of provenance records for composite-derived results trace back to their original ESI, SDE, or DERIVED sources rather than reporting "COMPOSITE" as the source.
- **SC-007**: Circular dependency attempts are detected and rejected with a clear error message before any publication or execution occurs.
- **SC-008**: The end-to-end demonstration succeeds: "Market Snapshot", "Route Analysis", and "Hauling Cost" are published, composed into "Trade Opportunity", published, and "Trade Opportunity" appears in the Capability Palette as a first-class reusable node.
- **SC-009**: Users can drill down into any composite node and navigate back without losing their parent pipeline state.
- **SC-010**: Existing flows continue to function unchanged when a new version of a dependency is published, until the user explicitly upgrades.

## Assumptions

- Users are familiar with the existing Fabric Studio pipeline designer and have built at least basic flows before using the composition features.
- The existing capability model (ESI, SDE, DERIVED) and pipeline compilation/execution infrastructure from the prior feature (002-visual-pipeline-designer) are in place and functional.
- Semantic versioning (major.minor.patch) is the versioning scheme, following industry conventions.
- "Compatible version" for upgrade notifications follows semver conventions: patch and minor updates within the same major version are considered compatible.
- The Fabric Registry is local to the Eve Fabric instance; cross-instance registry federation is out of scope for this feature.
- There is no practical limit on nesting depth, but the system may reasonably impose a configurable maximum to prevent performance degradation (assumed default: 20 levels).
- Authentication requirements for ESI-backed capabilities are inherited through composite boundaries; composite capabilities do not introduce separate authentication models.
- The initial demonstration capabilities ("Market Snapshot", "Route Analysis", "Hauling Cost", "Trade Opportunity") use representative data structures from the EVE Online domain but do not require live ESI connectivity for the demonstration to succeed.
