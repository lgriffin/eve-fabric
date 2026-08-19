# Domain Discovery Engine Contract

**Package**: `packages/domain/src/discovery/`

## Public API

### DiscoveryEngine

The primary entry point for all discovery operations. Constructed from a `CapabilityCatalog` instance.

```
DiscoveryEngine
  constructor(catalog: CapabilityCatalog)

  findConsumers(semanticType: SemanticTypeId): DiscoverySuggestion[]
  findProducers(semanticType: SemanticTypeId): DiscoverySuggestion[]
  findPaths(sourceType: SemanticTypeId, targetType: SemanticTypeId, options?: PathOptions): SemanticPath[]
  search(query: string, flowContext?: FlowContext): DiscoverySuggestion[]
  suggestNext(flowContext: FlowContext, options?: SuggestionOptions): DiscoverySuggestion[]
  autoComplete(flowContext: FlowContext, targetCapabilityId: CapabilityId): FlowProposal | null
  suggestConnections(flowContext: FlowContext, newCapabilityId: CapabilityId): ConnectionSuggestion[]
  rebuild(): void
```

### CapabilityGraph

Internal graph structure built from the catalog. Not directly exposed to consumers -- accessed through `DiscoveryEngine`.

```
CapabilityGraph
  static build(catalog: CapabilityCatalog): CapabilityGraph

  getConsumers(semanticType: SemanticTypeId): CapabilityDefinition[]
  getProducers(semanticType: SemanticTypeId): CapabilityDefinition[]
  getAllTypes(): ReadonlySet<SemanticTypeId>
  getCapability(id: CapabilityId): CapabilityDefinition | undefined
  size: number
```

### PathFinder

BFS-based multi-hop path finder operating on the capability graph.

```
PathFinder
  constructor(graph: CapabilityGraph)

  findPaths(sourceType: SemanticTypeId, targetType: SemanticTypeId, options?: PathOptions): SemanticPath[]
```

### SatisfactionAnalyzer

Analyzes which capability inputs are satisfiable from a given flow state.

```
SatisfactionAnalyzer
  constructor(graph: CapabilityGraph)

  analyze(capability: CapabilityDefinition, flowContext: FlowContext): SatisfactionResult
  analyzeAll(flowContext: FlowContext): Map<CapabilityId, SatisfactionResult>
```

## Input/Output Types

### PathOptions

```
PathOptions
  maxDepth: number          // Default: 5. Maximum intermediate capabilities.
  maxResults: number        // Default: 5. Maximum paths to return.
  preferShortest: boolean   // Default: true. Rank by hop count.
```

### SuggestionOptions

```
SuggestionOptions
  maxResults: number           // Default: 20
  includeUnreachable: boolean  // Default: false
```

### FlowContext

```
FlowContext
  availableOutputTypes: Set<SemanticTypeId>
  nodeOutputs: Map<string, SemanticTypeId[]>
  existingCapabilityIds: Set<CapabilityId>
```

### ConnectionSuggestion

```
ConnectionSuggestion
  sourceNodeId: string
  sourcePortName: string
  sourceType: SemanticTypeId
  targetPortName: string
  targetType: SemanticTypeId
  confidence: number        // 0-1 ranking
  explanation: ExplanationStep
```

## Behavioral Contracts

1. `findPaths` MUST return paths ordered by length (shortest first), with ties broken by total estimated cost.
2. `findPaths` MUST NOT return paths containing cycles (no capability appears twice in a path).
3. `findPaths` MUST NOT return paths longer than `maxDepth` intermediate capabilities.
4. `findPaths` MUST return an empty array (not throw) when no path exists.
5. `suggestNext` MUST rank suggestions by satisfaction ratio (most inputs satisfied first).
6. `suggestNext` MUST include an explanation for every suggestion.
7. `suggestNext` MUST NOT include capabilities already present in the flow context.
8. `search` MUST match against capability name, description, ID, and semantic type keywords.
9. `autoComplete` MUST return `null` (not throw) when no valid path exists.
10. `rebuild` MUST be called when the underlying catalog changes; stale graph results are not guaranteed.
11. All operations MUST be deterministic -- same inputs produce same outputs (FR-012).
12. No operation MAY depend on an AI/LLM service (FR-012).
