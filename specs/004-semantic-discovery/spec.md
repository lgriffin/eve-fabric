# Feature Specification: Semantic Discovery & Assisted Composition

**Feature Branch**: `004-semantic-discovery`  
**Created**: 2026-08-19  
**Status**: Implemented
**Input**: User description: "Extend Eve Fabric with a semantic discovery engine that understands the inputs, outputs, relationships, requirements, and compatibility of capabilities registered within the Fabric Registry. The objective is to allow Fabric Studio to actively guide users while constructing Fabric Flows rather than requiring them to already understand every available ESI, SDE, derived, or composite capability."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Port-Based Capability Discovery (Priority: P1)

A user is building a Fabric Flow and has placed a capability (e.g., Market Orders) on the canvas. They select an output port (e.g., LocationReference) and want to know what they can do next. Fabric Studio presents a list of all registered capabilities that can consume that semantic type, derived entirely from registry metadata.

**Why this priority**: This is the foundational interaction that makes the entire semantic discovery system useful. Without port-based discovery, users must already know every available capability and its input types. This single feature transforms Fabric Studio from a manual wiring tool into an actively guiding assistant.

**Independent Test**: Can be fully tested by placing any capability on the canvas, selecting an output port, and verifying that the system presents all compatible capabilities from the registry. Delivers immediate value by eliminating guesswork when building flows.

**Acceptance Scenarios**:

1. **Given** a capability node with an output port of type LocationReference on the canvas, **When** the user selects that output port, **Then** the system displays all registered capabilities whose inputs accept LocationReference, ordered by relevance.
2. **Given** a capability node with an output port of type LocationReference on the canvas, **When** the user selects that output port and no registered capabilities accept LocationReference, **Then** the system displays a clear message indicating no compatible capabilities are available.
3. **Given** multiple capabilities on the canvas with different output types, **When** the user selects different output ports in sequence, **Then** the suggestion list updates to reflect the selected port's semantic type each time.

---

### User Story 2 - Semantic Bridging & Path Finding (Priority: P1)

A user attempts to connect two capabilities whose ports are not directly compatible (e.g., LocationReference to SolarSystemReference). Instead of simply rejecting the connection, Fabric Studio searches the capability graph and proposes a valid path of intermediate capabilities that bridge the type gap. The system supports multi-step bridging where more than one intermediate capability may be required.

**Why this priority**: Direct type compatibility will frequently fail in practice because EVE's data model has many reference types that require resolution (locations to systems, characters to locations, types to items). Without bridging, users must manually discover and insert every resolver, which requires deep domain knowledge that most users lack.

**Independent Test**: Can be fully tested by attempting to connect two incompatible ports and verifying the system proposes a valid intermediate path. Delivers value by eliminating the need to know which resolvers exist between any two EVE concepts.

**Acceptance Scenarios**:

1. **Given** two capabilities on the canvas where the source output type (LocationReference) differs from the target input type (SolarSystemReference), **When** the user attempts to connect them, **Then** the system identifies and presents at least one valid capability path bridging the type gap (e.g., via Resolve Location).
2. **Given** two capabilities requiring multiple intermediate steps (e.g., CharacterReference to SolarSystemReference requiring Character Location then Resolve Location), **When** the user attempts to connect them, **Then** the system discovers and presents the multi-step path.
3. **Given** a proposed bridging path, **When** the path is presented to the user, **Then** the user can choose to Accept (insert all intermediate capabilities), Modify (select which intermediates to insert), or Cancel (take no action).
4. **Given** two capabilities with no valid path between their types, **When** the user attempts to connect them, **Then** the system clearly states that no compatible path exists.

---

### User Story 3 - Goal-Based Discovery (Priority: P2)

A user searches for capabilities by desired outcome rather than by name. For example, searching for "distance" returns Route Distance along with an explanation of what inputs it requires. The system also indicates whether the current Fabric Flow already contains enough information to satisfy those requirements.

**Why this priority**: Users think in terms of goals ("I want to calculate distance") rather than capability names or identifiers. Goal-based search bridges the gap between user intent and system capability, making the registry accessible to users who don't know the exact capability names.

**Independent Test**: Can be fully tested by entering a search term and verifying the system returns relevant capabilities with their requirements and current flow satisfaction status. Delivers value as a standalone search improvement to the existing palette.

**Acceptance Scenarios**:

1. **Given** a user searching for "distance" in the capability palette, **When** results are returned, **Then** the system shows Route Distance (and any other capabilities whose name, description, or output types relate to distance) along with each capability's required inputs.
2. **Given** a search result showing Route Distance requires Origin (SolarSystemReference) and Destination (SolarSystemReference), **When** the current flow already produces a SolarSystemReference, **Then** the system indicates which requirements are already satisfiable from the current flow and which remain unmet.
3. **Given** a search term that matches no capabilities, **When** results are returned, **Then** the system displays a clear "no results" message.

---

### User Story 4 - Context-Aware Suggestions (Priority: P2)

As a user builds a Fabric Flow, the system continuously evaluates which capabilities could logically follow from the current flow state. Suggestions consider all semantic types currently available in the flow and rank capabilities by how many of their required inputs are already satisfied. Each suggestion includes an explanation of why it is relevant.

**Why this priority**: Context-aware suggestions transform the discovery system from reactive (user must ask) to proactive (system guides). This is where the capability graph becomes a true assistant rather than a search index, but it builds on the foundational port-based discovery.

**Independent Test**: Can be fully tested by building a multi-step flow and verifying the system suggests relevant next capabilities with accurate satisfaction analysis. Delivers value by proactively guiding flow construction.

**Acceptance Scenarios**:

1. **Given** a flow containing Resolve Type, Market Orders, and Resolve Location, **When** the user views suggestions, **Then** the system displays capabilities ranked by readiness (e.g., "Security Filter - Ready to connect", "Route Distance - All required inputs except Origin are available", "Hauling Cost - Requires Route Distance").
2. **Given** a flow that produces multiple semantic types, **When** a suggested capability's inputs are fully satisfiable from the flow's available outputs, **Then** the suggestion is marked as "Ready to connect."
3. **Given** any suggestion displayed to the user, **When** the user inspects the suggestion, **Then** the system provides an explanation of why it was suggested (e.g., "Route Distance.destination requires SolarSystemReference; Resolve Location.system provides SolarSystemReference").

---

### User Story 5 - Auto-Completion & Smart Node Addition (Priority: P3)

A user selects a desired target capability and asks Fabric Studio to construct the missing capability path from the current flow. The system determines the shortest valid sequence of intermediate capabilities and presents the proposed path for user approval. Additionally, when a user drags a new capability onto the canvas, Fabric Studio inspects the existing flow and highlights the most likely connection points.

**Why this priority**: Auto-completion is the natural progression from bridging (US2) -- instead of connecting two existing nodes, the user specifies a destination and the system builds the full route. Smart node addition reduces manual wiring for common operations. Both are high-value UX improvements but depend on the graph infrastructure from P1 stories.

**Independent Test**: Can be fully tested by selecting a target capability from the palette and verifying the system proposes and can insert the correct intermediate path. Smart node addition can be tested by dragging a capability and verifying connection highlights appear.

**Acceptance Scenarios**:

1. **Given** a flow containing only Market Orders and a user-selected target of Route Distance, **When** the user requests auto-completion, **Then** the system proposes the path Market Orders -> Resolve Location -> Route Distance.
2. **Given** a proposed auto-completion path, **When** the user reviews the proposal, **Then** they can Accept All (insert entire path), Accept Selected (choose specific capabilities), Modify, or Cancel.
3. **Given** a flow containing Market Orders -> Resolve Location, **When** the user drags Route Distance onto the canvas, **Then** the system highlights the recommended connection (Resolve Location.system -> Route Distance.destination).
4. **Given** multiple valid auto-completion paths, **When** the system presents options, **Then** paths are ranked by length (shortest first) with ties broken by total estimated cost.

---

### User Story 6 - Assisted Flow Construction (Priority: P3)

A user describes a high-level goal in natural language (e.g., "Find the cheapest location selling an item within five jumps of a given system"). Fabric Studio searches its capability graph and proposes a complete flow that achieves the goal. The proposed flow is rendered for review before any modifications are made to the canvas.

**Why this priority**: This is the highest-value, highest-complexity feature. It depends on all prior stories and introduces an optional AI layer for natural-language interpretation. The deterministic graph search must work independently; the AI layer translates natural language into structured goals that the deterministic system can process.

**Independent Test**: Can be fully tested by entering a goal description and verifying the system proposes a valid, compiler-accepted flow. Delivers value as the ultimate expression of the "I have this, I want that" paradigm.

**Acceptance Scenarios**:

1. **Given** a user describes "Find the cheapest location selling an item within five jumps of a given system," **When** the system processes this goal, **Then** it proposes a flow such as: Resolve Type -> Market Orders -> Resolve Location -> Route Distance -> Filter Distance -> Sort Price -> Limit 1.
2. **Given** a proposed assisted flow, **When** the flow is presented to the user, **Then** it is rendered visually on the canvas in a preview mode (not yet committed) with Accept All, Accept Selected, Modify, and Cancel options.
3. **Given** any proposed assisted flow, **When** the user accepts it, **Then** the resulting pipeline passes through the deterministic compiler for validation before being committed to the canvas.
4. **Given** a goal that cannot be fully satisfied by registered capabilities, **When** the system processes the goal, **Then** it indicates which parts of the goal can be addressed and which capabilities are missing.

---

### Edge Cases

- What happens when the capability graph contains cycles (e.g., capability A produces type X, capability B consumes X and produces Y, capability C consumes Y and produces X)? Path finding must detect and avoid infinite loops.
- How does the system handle capabilities with identical input/output type signatures? It should present all valid options and let the user choose.
- What happens when a capability requires authentication scopes the user has not granted? Suggestions should still appear but indicate the auth requirement.
- How does the system behave when the registry is empty or contains only one capability? It should degrade gracefully with appropriate messaging.
- What is the maximum path depth for bridging? Unbounded path finding could produce impractical suggestions. The system should limit path depth to a reasonable bound and indicate when no path was found within that bound.
- What happens when a capability has optional inputs? Suggestions should differentiate between capabilities that are fully connectable (all required inputs satisfied) vs. partially connectable (required inputs satisfied, optional inputs available).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST construct a traversable capability graph from all registered capabilities, where edges represent semantic type compatibility between output ports and input ports.
- **FR-002**: System MUST identify all capabilities that can consume a given semantic type when a user selects an output port.
- **FR-003**: System MUST identify all capabilities that can produce a given semantic type.
- **FR-004**: System MUST find the shortest valid capability path between any two semantic types in the registry.
- **FR-005**: System MUST support multi-step bridging with more than one intermediate capability in the path.
- **FR-006**: System MUST limit path-finding depth to prevent impractical suggestions and detect cycles during traversal.
- **FR-007**: System MUST rank suggestions by relevance, considering how many of a capability's required inputs are already satisfied by the current flow.
- **FR-008**: System MUST provide a human-readable explanation for every automated suggestion, describing which types are produced, consumed, and bridged.
- **FR-009**: System MUST support goal-based search where users search by desired outcome, capability name, description, or semantic type keywords.
- **FR-010**: System MUST determine whether the current Fabric Flow contains outputs that satisfy a capability's required inputs.
- **FR-011**: Users MUST be able to accept, selectively accept, modify, or reject any proposed flow modification (Accept All, Accept Selected, Modify, Cancel).
- **FR-012**: System MUST perform all capability discovery, path finding, bridging, and suggestion operations deterministically without any AI or LLM dependency.
- **FR-013**: System MAY use an AI layer to translate natural-language goals into structured queries that the deterministic discovery system can process. This layer is optional and the system MUST function fully without it.
- **FR-014**: System MUST highlight recommended connection points when a new capability is added to the canvas, based on semantic type compatibility with the existing flow.
- **FR-015**: System MUST render proposed flows visually for user review before committing any changes to the canvas.
- **FR-016**: All proposed flows MUST pass through the deterministic compiler for validation before being applied.
- **FR-017**: System MUST indicate authentication requirements on suggested capabilities so users understand access prerequisites.

### Key Entities

- **Capability Graph**: A directed graph where nodes represent registered capabilities and edges represent semantic type compatibility between output ports (sources) and input ports (sinks). The graph enables traversal queries such as "what can follow X" and "how can I reach Y from X."
- **Semantic Path**: An ordered sequence of capabilities that connects a source semantic type to a target semantic type through one or more intermediate capabilities. Each step in the path represents a valid semantic type transformation.
- **Discovery Suggestion**: A recommended capability presented to the user, including the capability's identity, its readiness status relative to the current flow, and a human-readable explanation of why it was suggested.
- **Flow Proposal**: A proposed modification to the current Fabric Flow, consisting of one or more capabilities to be inserted along with their recommended connections. Proposals are previewed before application and require explicit user acceptance.
- **Satisfaction Analysis**: An assessment of which of a capability's required inputs are satisfiable from the semantic types currently available in the flow, and which remain unmet.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can discover compatible next capabilities within 2 seconds of selecting an output port on a flow containing up to 50 capabilities.
- **SC-002**: The system can find a valid bridging path between any two semantically connected types in the registry within 3 seconds, for registries containing up to 500 capabilities.
- **SC-003**: 90% of users can connect two capabilities that require intermediate resolvers without prior knowledge of which resolvers exist, on their first attempt using the discovery system.
- **SC-004**: Every suggestion and proposal presented to the user includes a human-readable explanation; no suggestion appears without an accompanying reason.
- **SC-005**: All deterministic discovery queries (compatible capabilities, path finding, satisfaction analysis) operate without any AI or external service dependency.
- **SC-006**: Users can express "I have X, I want Y" for any two semantically reachable types and receive a valid proposed path within 5 seconds.
- **SC-007**: Task completion time for building a 5-step flow decreases by at least 50% compared to manual capability selection and wiring.
- **SC-008**: Users accept proposed bridging paths without modification in at least 70% of cases, indicating the system's path selection matches user intent.

## Assumptions

- The Fabric Registry (from feature 003) is implemented and contains registered capabilities with well-defined semantic type annotations on all input and output ports.
- The existing semantic type system (SemanticTypeId, SemanticPort) provides sufficient type granularity to distinguish meaningfully between different EVE domain concepts.
- The capability graph is expected to remain at a manageable scale (hundreds to low thousands of registered capabilities, not millions), allowing in-memory graph operations without specialized infrastructure.
- Type compatibility for discovery purposes is based on strict semantic type equality; subtype hierarchies or coercion rules are out of scope for the initial implementation but the system should be designed to accommodate them in the future.
- Users are familiar with the Fabric Studio canvas interface and understand the concept of connecting capability nodes via ports.
- The AI/LLM layer for natural-language goal interpretation (FR-013) is an optional enhancement; the core discovery system must deliver full value without it.
- Path-finding depth will be bounded at a reasonable limit (assumed 5 intermediate capabilities) to prevent impractical suggestions; this bound may be adjusted based on user feedback.
- The deterministic compiler already validates pipeline semantic wiring; proposed flows reuse this existing validation rather than introducing parallel validation logic.
