# Feature Specification: Designer DX Overhaul

**Feature Branch**: `006-designer-dx-overhaul`
**Created**: 2026-08-20
**Status**: Draft
**Input**: User description: "Fix broken gateway integration, YAML import, silent errors; add execution inputs, undo/redo, keyboard shortcuts; refactor code quality in the visual pipeline designer"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Capabilities Load From the Gateway (Priority: P0)

A user starts the designer with the gateway running. The capability palette populates with all available capabilities grouped by source (ESI, SDE, DERIVED, COMPOSITE). They can search by name, filter by source, and drag any capability onto the canvas. If the gateway is unreachable, a clear error message appears in the palette explaining what's wrong and how to start the gateway.

**Why this priority**: Nothing else in the designer works without a populated catalog. The palette is currently empty due to three independent bugs: the wrong endpoint is called, the response shape is misinterpreted, and the URL routing strategy is broken. This is the root cause of the primary usability issue.

**Independent Test**: Can be fully tested by launching the designer with the gateway running and verifying the palette populates. Delivers immediate value by unblocking all downstream workflows (drag-to-canvas, pipeline building).

**Acceptance Scenarios**:

1. **Given** the gateway is running, **When** the designer loads, **Then** the capability palette shows all registered capabilities grouped by source category (ESI, SDE, DERIVED, COMPOSITE) with correct counts.
2. **Given** a populated palette, **When** the user types "market" in the search box, **Then** only capabilities containing "market" in their name or ID are shown.
3. **Given** a populated palette, **When** the user clicks the "ESI" filter, **Then** only ESI-sourced capabilities are shown.
4. **Given** the gateway is not running, **When** the designer loads, **Then** the palette shows an error banner explaining the connection failure and providing guidance on how to start the gateway, along with a retry button.
5. **Given** the gateway was unreachable and is now started, **When** the user clicks "Retry", **Then** the palette loads successfully.

---

### User Story 2 - YAML Import Works With All Example Pipelines (Priority: P0)

A user clicks "Import YAML" and selects one of the example pipeline files. The pipeline loads onto the canvas with all nodes correctly identified, edges properly connected, and nodes laid out in a readable directed graph (not a flat grid). If the YAML is malformed, a clear error message appears explaining what went wrong.

**Why this priority**: Import is the fastest path to a populated canvas and the primary way to demonstrate EVE Fabric to stakeholders. The current parser cannot handle the nested format used by all example pipelines, meaning every import silently fails.

**Independent Test**: Can be tested by importing each of the example pipeline YAML files and verifying correct node count, edge count, and graph layout. Delivers value by enabling pipeline demos and rapid prototyping.

**Acceptance Scenarios**:

1. **Given** a loaded catalog and the `market-schema/pipeline.yaml` file, **When** the user imports it, **Then** 2 nodes appear (fetchOrders, aggregate) with 3 edges and zero diagnostics errors.
2. **Given** a loaded catalog and the `trade-opportunity/pipeline.yaml` file, **When** the user imports it, **Then** 3 nodes appear (fetchOrders, aggregateMarket, routeCalc) with 5 edges and zero diagnostics errors.
3. **Given** imported nodes, **When** the canvas renders, **Then** nodes are laid out as a directed graph where upstream nodes appear to the left of downstream nodes, with no overlapping.
4. **Given** a malformed YAML file (e.g., missing `nodes:` key), **When** the user imports it, **Then** a notification shows the parse error and the canvas is unchanged.
5. **Given** a valid YAML referencing a capability not in the catalog, **When** the user imports it, **Then** the node renders with a warning badge and the diagnostics panel explains which capability was not found.

---

### User Story 3 - Errors Are Visible and Actionable (Priority: P1)

When any operation fails -- gateway unreachable, save failed, execution error, invalid pipeline -- the user sees a clear notification explaining what happened and what they can do about it. Currently, every error is silently swallowed, leaving users staring at empty state with no explanation.

**Why this priority**: Silent failures destroy user trust and make debugging impossible. Even when Story 1 and Story 2 are fixed, transient errors (network issues, malformed input) will still occur and must be communicated.

**Independent Test**: Can be tested by deliberately triggering failure conditions (stopping the gateway mid-session, importing malformed YAML, connecting incompatible ports) and verifying notifications appear.

**Acceptance Scenarios**:

1. **Given** the gateway becomes unreachable mid-session, **When** the user clicks Save, **Then** a notification appears explaining the save failed due to connectivity and providing a dismiss action.
2. **Given** the gateway becomes unreachable, **When** the user clicks Execute, **Then** a notification appears explaining the execution failed due to connectivity.
3. **Given** a pipeline with a semantic type mismatch, **When** the user connects incompatible ports, **Then** the connection is rejected with an explanation of the type mismatch.
4. **Given** any operation that fails, **When** the error occurs, **Then** a notification appears with: (a) what operation failed, (b) the error message, (c) a dismiss action. Auto-dismisses after 8 seconds.
5. **Given** a pipeline with compiler diagnostics, **When** the user views the diagnostics panel, **Then** each diagnostic shows severity, affected node, and message. Clicking a diagnostic selects the relevant node on the canvas.

---

### User Story 4 - Execute With Inputs (Priority: P1)

A user has built a valid pipeline and clicks "Execute". An input dialog appears listing all required pipeline inputs with their semantic types, descriptions, and placeholder values. The user fills in values and clicks "Run". Currently the Execute button sends empty inputs, making execution useless for any pipeline that requires parameters.

**Why this priority**: Execution is the core value proposition of a pipeline designer. Without input collection, users cannot run any parameterized pipeline, which is nearly all of them.

**Independent Test**: Can be tested by building a pipeline with required inputs (e.g., typeId, regionId), clicking Execute, filling in values, and verifying results appear.

**Acceptance Scenarios**:

1. **Given** a valid pipeline with 2 required inputs (typeId, regionId), **When** the user clicks Execute, **Then** an input dialog appears listing both inputs with names, semantic types, and descriptions.
2. **Given** the input dialog, **When** the user fills in values and clicks "Run", **Then** the pipeline executes and results appear in the Results panel.
3. **Given** the input dialog, **When** the user clicks "Cancel", **Then** no execution occurs and the dialog closes.
4. **Given** a previously executed pipeline, **When** the user clicks Execute again, **Then** the dialog pre-fills the last-used values.
5. **Given** a pipeline with no required inputs, **When** the user clicks Execute, **Then** execution proceeds immediately with no dialog.

---

### User Story 5 - Undo and Redo (Priority: P2)

A user accidentally deletes a node or connection. They press the standard undo shortcut and the deletion is reversed. They can redo to reapply the action. The toolbar shows undo/redo buttons with availability indicators.

**Why this priority**: Without undo, all canvas operations are destructive. This creates anxiety and slows users down. However, the designer is still usable (carefully) without undo, so it ranks below the P0/P1 fixes.

**Independent Test**: Can be tested by performing canvas operations (add/delete nodes and edges), undoing them, and verifying state is correctly restored.

**Acceptance Scenarios**:

1. **Given** a node was just deleted, **When** the user triggers undo, **Then** the node and its connections are restored.
2. **Given** an edge was just deleted, **When** the user triggers undo, **Then** the edge is restored.
3. **Given** a node was just added, **When** the user triggers undo, **Then** the node is removed.
4. **Given** an undone action, **When** the user triggers redo, **Then** the action is reapplied.
5. **Given** an undo history, **When** a new action is performed, **Then** the redo stack is cleared.
6. **Given** the toolbar, **When** there are undoable actions, **Then** the undo button is enabled with a count indicator.

---

### User Story 6 - Keyboard Shortcuts (Priority: P2)

Common operations are accessible via keyboard shortcuts: save, delete selected, undo/redo, help overlay, select all, escape to clear. A help overlay shows all available shortcuts.

**Why this priority**: Keyboard shortcuts significantly improve power-user productivity but are a convenience enhancement, not a functional gap.

**Independent Test**: Can be tested by pressing each shortcut key combination and verifying the expected action occurs.

**Acceptance Scenarios**:

1. **Given** a selected node, **When** Delete or Backspace is pressed, **Then** the node and its edges are removed.
2. **Given** any state, **When** the save shortcut is pressed, **Then** the save action triggers.
3. **Given** any state, **When** Escape is pressed, **Then** selections are cleared and open dialogs are closed.
4. **Given** any state, **When** the help shortcut is pressed, **Then** a shortcuts help overlay appears listing all available shortcuts.

---

### User Story 7 - Code Quality and Architecture (Priority: P3)

The designer codebase is refactored for maintainability without changing any user-visible behavior. The main application component contains only composition logic. All styling uses centralized design tokens. Shared concerns (gateway communication, color constants) are consolidated. The pipeline store is split into focused, single-responsibility slices.

**Why this priority**: Code quality improvements enable faster future development and reduce bug risk, but deliver no immediate user-facing value. They are best done after all functional changes are complete.

**Independent Test**: Can be verified by running the full test suite and performing a manual smoke test of all features. All existing tests must pass without modification.

**Acceptance Scenarios**:

1. **Given** the refactored codebase, **When** the full test suite runs, **Then** all existing tests pass with no modifications.
2. **Given** the main application component, **When** inspected, **Then** it contains no business logic -- only component composition and layout.
3. **Given** any component, **When** inspected for styling, **Then** no inline style objects are present -- all styling uses centralized tokens or style modules.
4. **Given** any component, **When** inspected for color values, **Then** no hardcoded color values exist -- all colors reference a single tokens source.
5. **Given** all gateway communication code, **When** inspected, **Then** all calls go through a single shared client module with no duplicated URL logic.
6. **Given** the pipeline store, **When** inspected, **Then** it is split into focused slices: canvas, compilation, execution, and persistence.

---

### Edge Cases

- What happens when the gateway returns an unexpected response format (e.g., schema change between versions)?
- What happens when a YAML file contains valid YAML but doesn't match the expected pipeline schema?
- What happens when a user imports a pipeline while another pipeline is already on the canvas?
- What happens when undo is triggered with an empty history?
- What happens when the user presses a keyboard shortcut while focused in a text input field?
- What happens when a notification queue exceeds reasonable display limits (e.g., rapid-fire errors)?
- What happens when execution inputs contain special characters or extremely long values?
- What happens when the browser tab loses focus during a long-running execution?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Designer MUST load all available capabilities from the gateway and display them in the palette grouped by source category on startup.
- **FR-002**: Designer MUST display a clear, actionable error message when the gateway is unreachable, including a retry mechanism.
- **FR-003**: Designer MUST correctly parse and import all example pipeline YAML files, producing the correct node count, edge count, and connection topology.
- **FR-004**: Designer MUST lay out imported pipelines as directed graphs with upstream nodes positioned before downstream nodes and no overlapping.
- **FR-005**: Designer MUST display a notification for every failed operation, including what failed, the error details, and a dismiss action.
- **FR-006**: Notifications MUST auto-dismiss after 8 seconds unless manually dismissed.
- **FR-007**: Designer MUST present an input collection dialog before executing any pipeline that has required inputs, showing the name, type, and description for each input.
- **FR-008**: Designer MUST remember last-used execution input values and pre-fill them on subsequent executions.
- **FR-009**: Designer MUST skip the input dialog and execute immediately when a pipeline has no required inputs.
- **FR-010**: Designer MUST support undo and redo for all canvas mutations (add/delete/move nodes, add/delete edges).
- **FR-011**: Undo history MUST maintain a rolling window of recent actions (performing a new action after undo clears the redo stack).
- **FR-012**: Designer MUST support keyboard shortcuts for save, delete selected, undo, redo, clear selection, and help overlay.
- **FR-013**: Keyboard shortcuts MUST be focus-aware and not trigger when the user is typing in a text input field.
- **FR-014**: Designer MUST display a help overlay listing all available keyboard shortcuts when the help shortcut is pressed.
- **FR-015**: Save action MUST persist the pipeline to the gateway. Export action MUST download the pipeline as a YAML file. These MUST be separate, distinct operations.
- **FR-016**: Designer MUST warn the user about unsaved changes before navigating away or closing the browser tab.
- **FR-017**: Main application component MUST contain only layout and composition logic, with no embedded business logic.
- **FR-018**: All visual styling MUST use centralized design tokens with no inline style objects or hardcoded color values.
- **FR-019**: All gateway communication MUST go through a single shared client module.

### Key Entities

- **Capability**: A registered data operation available in the catalog, belonging to a source category (ESI, SDE, DERIVED, COMPOSITE) with typed inputs and outputs.
- **Pipeline**: A directed graph of connected capability nodes with defined inputs, edges representing data flow, and metadata for persistence.
- **Notification**: A transient user-facing message with a severity level (error, warning, success, info), content, and auto-dismiss behavior.
- **Execution Input**: A named parameter required by a pipeline to execute, with a semantic type, description, and optionally a last-used value.
- **Undo Entry**: A snapshot of canvas state (nodes and edges) captured before a mutation, enabling reversal of that mutation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can open the designer and see a fully populated capability palette within 3 seconds of the page loading (given a running gateway).
- **SC-002**: All three example pipelines (market-schema, trade-opportunity, route-schema) import successfully with correct node counts, edge counts, and readable graph layout on first attempt.
- **SC-003**: 100% of error conditions produce a visible, user-facing notification -- zero silent failures remain.
- **SC-004**: Users can execute a parameterized pipeline from start to results in under 60 seconds, including providing input values.
- **SC-005**: Any accidental deletion can be reversed within 2 seconds via undo, with the canvas restored to its exact prior state.
- **SC-006**: Power users can perform all common operations (save, delete, undo, redo, help) without using the mouse.
- **SC-007**: The refactored codebase passes all existing tests with no test modifications, confirming zero behavioral regressions.
- **SC-008**: No component in the codebase contains duplicated constants, duplicated utility logic, or inline style objects.

## Assumptions

- Users have a local development environment with the gateway available on the same machine or local network.
- The gateway's capability registry endpoint and response format are stable and will not change during this feature's development.
- All example pipeline YAML files in the repository represent the canonical format that must be supported.
- The designer targets modern desktop browsers (Chrome, Firefox, Edge); mobile browser support is out of scope.
- The existing test suite is the correctness baseline -- refactoring must not require test modifications.
- Execution input values are simple scalar types (strings, numbers, booleans) -- complex nested input objects are out of scope for the input dialog.
- The undo history window of 50 entries is sufficient for typical editing sessions.
