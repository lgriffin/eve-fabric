# Data Model: Semantic Discovery & Assisted Composition

**Branch**: `004-semantic-discovery` | **Date**: 2026-08-19

## Entities

### CapabilityGraph

The traversable graph built from all registered capabilities. Edges represent semantic type compatibility between output ports and input ports.

**Fields**:

- `capabilities`: All capability definitions indexed by ID (from catalog)
- `inputIndex`: Map from SemanticTypeId to capabilities that accept that type as input
- `outputIndex`: Map from SemanticTypeId to capabilities that produce that type as output
- `allSemanticTypes`: Set of all semantic type IDs present in the graph

**Relationships**:

- Built from `CapabilityCatalog.list()` -- one graph per catalog state
- Queried by `PathFinder`, `SatisfactionAnalyzer`, and `DiscoveryEngine`

**Validation**:

- Graph must contain at least one capability to be queryable
- All capability definitions must have valid SemanticTypeId values on ports

**State transitions**:

- `Empty` -> `Built` (on construction from catalog)
- `Built` -> `Stale` (when catalog changes -- registry/deregister)
- `Stale` -> `Built` (on rebuild)

---

### SemanticPath

An ordered sequence of capabilities connecting a source semantic type to a target semantic type.

**Fields**:

- `sourceType`: SemanticTypeId -- the starting output type
- `targetType`: SemanticTypeId -- the desired input type
- `steps`: Array of PathStep, each containing:
  - `capability`: CapabilityDefinition reference (id, version, name)
  - `inputPort`: Port name consuming the type from the previous step
  - `inputType`: SemanticTypeId consumed
  - `outputPort`: Port name producing the type for the next step
  - `outputType`: SemanticTypeId produced
- `length`: Number of intermediate capabilities (steps count)
- `totalEstimatedCost`: Sum of estimated latency across all steps
- `requiresAuth`: Whether any step requires authentication
- `authScopes`: Union of all required auth scopes across steps

**Relationships**:

- Each step references a `CapabilityDefinition` from the graph
- Ordered: step[n].outputType === step[n+1].inputType
- First step's inputType === sourceType
- Last step's outputType === targetType

**Validation**:

- Path must have at least one step
- Consecutive steps must have compatible types (step[n].outputType === step[n+1].inputType)
- No duplicate capabilities in a single path (cycle-free)
- Path length must not exceed the configured maximum depth

---

### DiscoverySuggestion

A recommended capability with contextual relevance information and explanation.

**Fields**:

- `capability`: Capability reference (id, version, name, description, source)
- `relevance`: Ranking score (higher = more relevant)
- `readiness`: Enum -- `ready` (all required inputs satisfied), `partial` (some inputs satisfied), `unreachable` (no inputs satisfied)
- `satisfiedInputs`: Array of input port names whose types are available in the current flow
- `unsatisfiedInputs`: Array of input port names whose types are not available
- `explanation`: Array of ExplanationStep describing why this capability is suggested
- `matchReason`: Enum -- `port_compatible` (direct type match), `bridging` (reachable via path), `search_match` (matched search query), `context_aware` (proactively suggested from flow state)

**Relationships**:

- References a `CapabilityDefinition`
- `satisfiedInputs` / `unsatisfiedInputs` derived from `SatisfactionResult`
- `explanation` contains structured reasoning steps

**Validation**:

- Must have at least one explanation step
- `satisfiedInputs` + `unsatisfiedInputs` must cover all required inputs
- `readiness` must be consistent with satisfaction counts

---

### SatisfactionResult

Assessment of which capability inputs are satisfiable from the current flow state.

**Fields**:

- `capabilityId`: The capability being assessed
- `availableTypes`: Set of SemanticTypeId values available in the current flow
- `satisfiedPorts`: Map from port name to the SemanticTypeId that satisfies it
- `unsatisfiedPorts`: Map from port name to the required SemanticTypeId that is missing
- `satisfactionRatio`: Number between 0 and 1 (satisfied / total required)
- `isFullySatisfied`: Boolean -- all required inputs are available

**Relationships**:

- Derived from a `CapabilityDefinition`'s required inputs cross-referenced with available flow output types
- Used by `DiscoverySuggestion` to determine readiness

---

### FlowProposal

A proposed modification to the current Fabric Flow for user review.

**Fields**:

- `proposalType`: Enum -- `bridging` (insert intermediates between two nodes), `auto_complete` (build path to target), `assisted` (full flow from goal), `smart_connect` (suggest connections for new node)
- `capabilitiesToInsert`: Array of capability references to add to the flow
- `connectionsToMake`: Array of proposed edges (source node+port -> target node+port)
- `connectionsToHighlight`: Array of existing edges to visually highlight as recommendations
- `path`: The SemanticPath that justifies this proposal (if applicable)
- `explanation`: Array of ExplanationStep describing why this proposal was generated
- `estimatedCost`: Total estimated latency for the proposed additions
- `authRequirements`: Authentication scopes needed for the proposed capabilities

**Relationships**:

- Contains one or more `SemanticPath` segments
- References `CapabilityDefinition` entries from the graph
- Validated through the deterministic compiler before presentation

**State transitions**:

- `Proposed` -> `Accepted` (user accepts all)
- `Proposed` -> `PartiallyAccepted` (user selects specific capabilities)
- `Proposed` -> `Modified` (user edits the proposal)
- `Proposed` -> `Cancelled` (user rejects)

---

### ExplanationStep

A single step in a human-readable explanation chain.

**Fields**:

- `fromType`: SemanticTypeId -- the type being transformed from
- `toType`: SemanticTypeId -- the type being transformed to
- `viaCapability`: Capability reference (id, name) that performs the transformation
- `inputPortName`: Name of the port consuming fromType
- `outputPortName`: Name of the port producing toType
- `description`: Auto-generated text (e.g., "Resolve Location converts LocationReference to SolarSystemReference")

**Relationships**:

- One per step in a SemanticPath
- Aggregated into DiscoverySuggestion and FlowProposal explanations

---

### DiscoveryQuery

A structured query representing a user's discovery intent, used to bridge between UI interactions and the discovery engine.

**Fields**:

- `queryType`: Enum -- `port_discovery` (from output port), `bridging` (between two types), `goal_search` (text search), `context_suggestions` (proactive), `auto_complete` (path to target), `assisted` (natural language goal)
- `sourceType`: SemanticTypeId (for port_discovery, bridging)
- `targetType`: SemanticTypeId (for bridging, auto_complete)
- `searchTerm`: String (for goal_search)
- `naturalLanguageGoal`: String (for assisted -- optional AI processing)
- `flowContext`: Current flow state -- available output types, existing nodes and edges
- `maxDepth`: Maximum path-finding depth (default 5)
- `maxResults`: Maximum number of suggestions to return (default 20)

**Validation**:

- `port_discovery` requires `sourceType`
- `bridging` requires both `sourceType` and `targetType`
- `goal_search` requires non-empty `searchTerm`
- `auto_complete` requires `targetType` and `flowContext`
- `assisted` requires `naturalLanguageGoal`
