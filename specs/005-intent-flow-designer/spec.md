# Feature Specification: Intent-Driven Interactive Flow Designer

**Feature Branch**: `005-intent-flow-designer`
**Created**: 2026-08-20
**Status**: Superseded by 007 and 008
**Input**: User description: "Transform Fabric Studio from standalone visual components into an intent-driven, interactive flow-building experience where users describe goals, discover capabilities, drag-configure-connect components, and progressively build executable Fabric Flows."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Search and Discover Capabilities (Priority: P1)

A user opens Fabric Studio and sees a clean workspace with a search prompt asking "What are you trying to do?" They type a concept like "market" and the palette displays matching capabilities with user-friendly names and descriptions, such as "Market Orders — Retrieve current buy and sell orders for an EVE item." The user does not need to know endpoint names, technical identifiers, or implementation details. Results include both primitive and composite capabilities.

**Why this priority**: Discovery is the entry point to the entire experience. Without the ability to search and find relevant capabilities, the user cannot begin building a flow. This story also addresses the "empty canvas problem" — users are guided by intent rather than confronted with a wall of components.

**Independent Test**: Can be fully tested by opening the workspace, typing a search term, and verifying that relevant capabilities appear with user-oriented names and descriptions. Delivers value as a standalone capability browser.

**Acceptance Scenarios**:

1. **Given** the user opens Fabric Studio for the first time, **When** the workspace loads, **Then** the user sees a clean canvas with a search prompt and suggested example queries (e.g., "Market prices", "Find an item", "Route between systems").
2. **Given** the user types "market" into the search field, **When** results are returned, **Then** the palette displays capabilities matching the concept with user-friendly names, descriptions, and category indicators (e.g., LIVE, STATIC, DERIVED).
3. **Given** the user types a natural-language goal such as "I want to find where Tritanium is cheapest near Jita", **When** results are returned, **Then** the palette displays capabilities relevant to the goal, grouped into "Suggested" and "Related" sections.
4. **Given** the user searches for a term with no matching capabilities, **When** results are returned, **Then** the palette displays a helpful empty state with alternative search suggestions.

---

### User Story 2 - Add and Configure a Capability Node (Priority: P1)

A user selects a capability from the palette and adds it to the Fabric Canvas, either by dragging it or clicking an "Add to Flow" button. The resulting node displays configurable inputs using appropriate controls — searchable selectors for EVE items and regions, radio buttons for order type, numeric fields for quantities. The user configures inputs using EVE domain terminology (e.g., "Item", "Region") rather than technical identifiers.

**Why this priority**: Placing and configuring nodes is the fundamental building block of any flow. Users must be able to interact with individual capabilities before connecting them. This story also validates that semantic types drive appropriate input editors.

**Independent Test**: Can be fully tested by adding a Market Orders node to the canvas, configuring its Item, Region, and Order Type inputs using the provided controls, and verifying that the node reflects the configured values. Delivers value as an interactive capability explorer.

**Acceptance Scenarios**:

1. **Given** a capability card is visible in the palette, **When** the user drags it onto the canvas, **Then** an interactive node appears at the drop position with configurable input fields.
2. **Given** a capability card is visible in the palette, **When** the user clicks the "Add to Flow" button on the card, **Then** an interactive node is placed on the canvas at a default position (accessibility path).
3. **Given** a Market Orders node is on the canvas, **When** the user interacts with the Item field, **Then** a searchable selector appears allowing the user to find and select EVE items by name.
4. **Given** a node input has a semantic type of "Region", **When** the node renders, **Then** the input displays a searchable region selector rather than a generic text field.
5. **Given** a node input has a semantic type of "Enumeration", **When** the node renders, **Then** the input displays radio buttons or a dropdown for the available options.

---

### User Story 3 - Test a Single Node (Priority: P2)

A user who has configured a node presses a "Test" button on that node. The system executes the node with its configured inputs and displays a result preview showing the outcome count, execution time, and data source. The user can inspect a sample of the returned data. This encourages incremental exploration — users validate one step before building further.

**Why this priority**: Node-level execution enables progressive experimentation. Users can verify each step works before committing to a full flow. This is a key differentiator from the "build everything then hope it works" pattern.

**Independent Test**: Can be fully tested by configuring a Market Orders node with specific Item and Region values, pressing Test, and verifying that a result summary and data preview appear. Delivers value as an interactive capability tester.

**Acceptance Scenarios**:

1. **Given** a fully configured Market Orders node, **When** the user presses "Test", **Then** the node displays a result summary (e.g., "1,284 orders returned, 342ms, ESI").
2. **Given** a node has been successfully tested, **When** the user selects "Preview Data", **Then** a sample of the result data is displayed.
3. **Given** a node is missing required inputs, **When** the user presses "Test", **Then** the node highlights the missing inputs and displays a clear error message.
4. **Given** a node is currently executing, **When** the user observes the node, **Then** the node displays a "RUNNING" visual state.

---

### User Story 4 - Connect Compatible Nodes (Priority: P2)

A user drags a connection from a node's output port toward the canvas. Compatible input ports on existing nodes are visually highlighted, and incompatible ports become visually unavailable. If the user drops the connection on an empty canvas area, a contextual palette appears showing only compatible capabilities. Selecting one automatically adds and connects the new node. When a node input is satisfied by an upstream connection, the direct editor is replaced with an indicator showing the data source.

**Why this priority**: Connections transform isolated capabilities into a meaningful flow. Smart compatibility filtering prevents invalid configurations and guides the user toward useful next steps. This story enables the "follow the data" construction model.

**Independent Test**: Can be fully tested by placing two compatible nodes on the canvas, dragging a connection from one output to the other's input, and verifying the connection renders with a visual data-flow indicator. Also testable by dropping a connection on empty canvas and selecting from the compatibility palette.

**Acceptance Scenarios**:

1. **Given** a Market Orders node with an "Orders" output, **When** the user begins dragging from that output port, **Then** compatible input ports on other canvas nodes are visually highlighted and incompatible ports are dimmed.
2. **Given** the user is dragging a connection from an output port, **When** they release on empty canvas space, **Then** a contextual palette appears listing only capabilities whose inputs are compatible with the dragged output type.
3. **Given** the user selects a capability from the connection palette, **When** the selection is confirmed, **Then** the new node is placed on the canvas and automatically connected to the source output.
4. **Given** a node input is connected to an upstream node's output, **When** the connected node renders, **Then** the input field displays a connection indicator (e.g., "from Resolve Location.region") instead of a direct-edit control.

---

### User Story 5 - Smart Continuation and Contextual Palette (Priority: P2)

Each node offers a "+" continuation button next to its output. Pressing it opens a contextual palette showing user-oriented descriptions of what can be done next (e.g., "Filter them", "Sort them", "Resolve their locations") rather than technical capability names. The main palette also adapts to the current canvas state — when nodes are present, it recommends complementary capabilities based on available outputs, missing inputs, and semantic compatibility.

**Why this priority**: This story implements the "Discover Next" step in the exploration flow. The contextual palette makes flow construction feel like a guided conversation rather than manual graph assembly. It is the primary mechanism for progressive discovery.

**Independent Test**: Can be fully tested by placing a Market Orders node, clicking its "+" button, and verifying that a contextual palette shows user-oriented descriptions of compatible next steps. Selecting one should add and connect the node.

**Acceptance Scenarios**:

1. **Given** a Market Orders node is on the canvas, **When** the user clicks the "+" continuation button on the node's output, **Then** a contextual palette appears with user-oriented descriptions such as "Filter them", "Sort them", "Resolve their locations".
2. **Given** the user selects "Sort them" from the continuation palette, **When** the selection is confirmed, **Then** a Sort node is added and connected to the Market Orders output.
3. **Given** a Market Orders node is on the canvas, **When** the user views the main palette, **Then** it shows a "Recommended Next" section with capabilities that consume Market Orders output, above the general search.
4. **Given** the canvas contains Market Orders connected to Sort, **When** the palette updates, **Then** recommendations reflect what can consume Sort's output, not Market Orders' output.

---

### User Story 6 - Execute a Complete Flow (Priority: P3)

The user has assembled a multi-node flow (e.g., Market Orders, Resolve Location, Filter, Sort, Limit). They press "Execute Flow" in the workspace toolbar. Before execution, the system validates required inputs, semantic connections, and authentication requirements. During execution, each node transitions through visual states (WAITING, RUNNING, SUCCESS, ERROR, CACHED). After execution, selecting any node reveals its configuration, inputs, outputs, execution duration, data source, and a data preview.

**Why this priority**: End-to-end execution is the payoff for the entire flow-building experience. It validates that the progressive construction model produces working pipelines. This story also delivers the result-inspection capability that turns the canvas into an execution debugger.

**Independent Test**: Can be fully tested by building the demonstration flow (Market Orders, Resolve Location, Filter, Sort, Limit), pressing Execute, and verifying that all nodes reach SUCCESS state and results are inspectable at each stage.

**Acceptance Scenarios**:

1. **Given** a complete flow with all required inputs configured, **When** the user presses "Execute Flow", **Then** the flow compiles and begins execution.
2. **Given** a flow is executing, **When** the user observes the canvas, **Then** each node transitions through visual states (WAITING, RUNNING, SUCCESS) in execution order.
3. **Given** a flow has completed execution, **When** the user selects a node, **Then** they can view Configuration, Input, Output, Execution details (status, duration, source, cache status), and a Data Preview.
4. **Given** a flow has a node with missing required inputs, **When** the user presses "Execute Flow", **Then** the system highlights the incomplete node and displays an actionable validation error before execution begins.
5. **Given** a flow has a node that fails during execution, **When** the failure occurs, **Then** the failed node shows an ERROR state, downstream nodes show WAITING, and the error message is accessible through the node inspection panel.

---

### User Story 7 - Palette Modes (Priority: P3)

The palette supports three modes: "Discover" (search by intent with the prompt "What do you want to do?"), "Recommended" (context-aware suggestions based on the current flow state), and "All Capabilities" (expert view providing direct access to the complete Fabric Registry). This gives new users guidance while allowing experienced users direct access.

**Why this priority**: Multiple palette modes ensure the tool serves users at different expertise levels. The discover mode is critical for new users, recommended mode supports mid-flow construction, and the expert view prevents the tool from being limiting for power users.

**Independent Test**: Can be fully tested by switching between the three palette modes and verifying each displays appropriate content — search in Discover, context-aware suggestions in Recommended, and the full registry in All Capabilities.

**Acceptance Scenarios**:

1. **Given** the palette is in "Discover" mode, **When** the user views it, **Then** the palette displays a search prompt with example queries and returns intent-based results when searched.
2. **Given** the palette is in "Recommended" mode and nodes exist on the canvas, **When** the user views the palette, **Then** it displays capabilities recommended based on available outputs and missing inputs of canvas nodes.
3. **Given** the palette is in "All Capabilities" mode, **When** the user views it, **Then** the complete Fabric Registry is available for browsing and searching.
4. **Given** the user switches between palette modes, **When** the mode changes, **Then** the palette content updates immediately to reflect the selected mode.

---

### Edge Cases

- What happens when a user drags a connection to an incompatible input port? The connection is rejected with a visual indicator and the port remains unconnected.
- How does the system handle a node whose upstream connection is deleted? The input reverts to a direct-edit control with no configured value, and a validation warning appears.
- What happens when a user tests a node that depends on upstream data but is not yet connected? The node highlights the unconnected input and prompts the user to either configure a value directly or connect an upstream source.
- What happens when the canvas is empty and the palette is in "Recommended" mode? The palette falls back to "Discover" mode behavior, showing the search prompt and example queries.
- How does the system handle very long flows that exceed the visible canvas area? The canvas supports pan and zoom, and the flow layout adjusts to maintain readability.
- What happens when execution fails mid-flow? Successfully completed nodes retain their SUCCESS state and cached results; the failed node shows ERROR with details; downstream nodes remain in WAITING state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a search interface as the primary entry point, prompting users with "What are you trying to do?" and displaying example queries.
- **FR-002**: System MUST support keyword-based capability search that matches capabilities by name, description, and category using EVE domain terminology.
- **FR-003**: System MUST support natural-language intent search that interprets user goals and returns relevant capabilities grouped by relevance (Suggested vs. Related).
- **FR-004**: System MUST display capability search results as cards showing a user-friendly name, description, and category indicator (LIVE, STATIC, DERIVED, COMPOSITE, AUTH REQUIRED).
- **FR-005**: System MUST allow users to add capabilities to the canvas by dragging from the palette or by clicking an "Add to Flow" button on the capability card.
- **FR-006**: System MUST render interactive nodes with input controls appropriate to each input's semantic type (searchable selectors for items/regions/systems, toggles for booleans, radio buttons for enumerations, numeric fields for numbers).
- **FR-007**: System MUST use EVE domain terminology (Item, Region, Market Orders) in the user interface rather than technical identifiers (type_id, region_id, endpoint paths).
- **FR-008**: System MUST allow each node input to be satisfied either by direct configuration (user-entered value) or by an upstream connection from another node's output.
- **FR-009**: System MUST visually distinguish between directly configured inputs and inputs satisfied by upstream connections, showing the data source when connected.
- **FR-010**: System MUST highlight compatible input ports and dim incompatible ports when a user drags a connection from an output port.
- **FR-011**: System MUST display a contextual palette of compatible capabilities when a connection is dropped on empty canvas space, and automatically add and connect the selected capability.
- **FR-012**: System MUST provide a "+" continuation button on each node that opens a contextual palette showing user-oriented descriptions of compatible next capabilities.
- **FR-013**: System MUST support individual node execution via a "Test" button, displaying result count, execution time, data source, and a data preview.
- **FR-014**: System MUST support full flow execution with pre-execution validation of required inputs, semantic connections, and authentication requirements.
- **FR-015**: System MUST display visual execution state transitions on each node during flow execution (WAITING, RUNNING, SUCCESS, ERROR, CACHED).
- **FR-016**: System MUST provide a node inspection panel after execution showing Configuration, Input, Output, Execution details, and Data Preview.
- **FR-017**: System MUST provide three palette modes: Discover (intent search), Recommended (context-aware suggestions), and All Capabilities (full registry browse).
- **FR-018**: System MUST dynamically update the Recommended palette based on current canvas state, including available outputs, missing inputs, and semantic compatibility.
- **FR-019**: System MUST support progressive disclosure — default node views show user-facing configuration only, with advanced details (authentication, caching, source, provenance) accessible on demand.
- **FR-020**: System MUST provide Save and Execute Flow actions in the workspace toolbar.

### Key Entities

- **Capability**: A unit of functionality available in the Fabric Registry. Has a user-friendly name, description, category indicator (LIVE/STATIC/DERIVED/COMPOSITE), semantic input and output types, and may be primitive or composite.
- **Fabric Node**: An instance of a capability placed on the canvas. Contains configured input values, visual execution state, and after execution contains result data. Has input and output ports for connecting to other nodes.
- **Fabric Flow**: An ordered graph of connected Fabric Nodes representing a complete data processing pipeline. Can be validated, compiled, executed, saved, and inspected.
- **Connection**: A directed link between one node's output port and another node's input port. Carries semantic type information for compatibility validation and visually communicates data flow.
- **Palette**: The side panel that presents capabilities to the user in three modes (Discover, Recommended, All Capabilities). Dynamically adapts its content based on search terms, canvas state, and semantic compatibility.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user unfamiliar with Eve Fabric's architecture can discover a relevant capability within 30 seconds of opening the workspace by searching with a domain concept.
- **SC-002**: A user can place a capability on the canvas and fully configure its inputs within 60 seconds using the semantic-type-driven editors.
- **SC-003**: A user can test an individual node and see results within 5 seconds of pressing the Test button (excluding network latency for live data sources).
- **SC-004**: A user can build the demonstration flow (Market Orders, Resolve Location, Filter, Sort, Limit) from scratch in under 5 minutes using the guided discovery and connection workflow.
- **SC-005**: 90% of connection attempts produce valid connections on the first try, guided by the compatibility highlighting system.
- **SC-006**: A user can inspect execution results at any node in the flow within 2 clicks after flow execution completes.
- **SC-007**: The workspace loads to a usable state (search prompt visible, palette responsive) within 3 seconds.
- **SC-008**: A user who has never seen Eve Fabric can describe a goal, discover capabilities, build a flow, and execute it without consulting external documentation.

## Assumptions

- The existing Fabric Registry (from previous feature iterations 001-004) provides a queryable catalog of capabilities with semantic type information on inputs and outputs.
- The semantic discovery engine (feature 004) provides the foundation for keyword and intent-based capability search.
- The gateway API supports individual capability execution (for node-level Test) and compiled flow execution.
- EVE item, region, and solar system reference data is available for populating searchable selectors in node input controls.
- The initial implementation scope is limited to a "Market" vertical slice: Market Orders as the primary source, with Filter, Sort, Limit, and Resolve Location as downstream capabilities.
- The existing React Flow (@xyflow/react) integration from the visual pipeline designer (feature 002) provides the canvas foundation for node placement, connection, and layout.
- Users have network connectivity to reach live EVE data sources (ESI) for node testing and flow execution.
- Authentication requirements for ESI-backed capabilities are handled by an existing or concurrent auth mechanism; this feature surfaces auth requirements but does not implement the auth flow itself.
