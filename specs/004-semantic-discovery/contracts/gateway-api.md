# Gateway Discovery API Contract

**Package**: `apps/gateway/src/routes/discovery-routes.ts`

## Endpoints

All endpoints are prefixed with `/api/discovery`. Request/response bodies are JSON. All endpoints use Zod validation on inputs.

### GET /api/discovery/consumers/:semanticType

Find all capabilities that can consume the given semantic type.

**Parameters**: `semanticType` (path) -- SemanticTypeId string (e.g., `eve.location.reference`)

**Response 200**: `{ semanticType, consumers: [{ id, version, name, description, source, inputPort, explanation }], count }`

**Response 400**: Invalid semantic type format.

### GET /api/discovery/producers/:semanticType

Find all capabilities that produce the given semantic type.

**Parameters**: `semanticType` (path) -- SemanticTypeId string

**Response 200**: `{ semanticType, producers: [{ id, version, name, outputPort, explanation }], count }`

### POST /api/discovery/paths

Find valid capability paths between two semantic types.

**Request body**: `{ sourceType, targetType, maxDepth?: 5, maxResults?: 5 }`

**Response 200**: `{ sourceType, targetType, paths: [{ steps: [{ capabilityId, capabilityName, inputPort, inputType, outputPort, outputType }], length, totalEstimatedCost, requiresAuth, explanation }], count }`

### POST /api/discovery/suggest

Get context-aware suggestions based on current flow state.

**Request body**: `{ availableOutputTypes: string[], existingCapabilityIds: string[], maxResults?: 20 }`

**Response 200**: `{ suggestions: [{ capabilityId, capabilityName, readiness, satisfiedInputs, unsatisfiedInputs, relevance, matchReason, explanation }], count }`

### POST /api/discovery/search

Goal-based capability search with optional flow context.

**Request body**: `{ query: string, availableOutputTypes?: string[], maxResults?: 20 }`

**Response 200**: `{ query, results: [{ capabilityId, capabilityName, description, readiness, satisfiedInputs, unsatisfiedInputs, matchReason, explanation }], count }`

### POST /api/discovery/auto-complete

Find a complete path from the current flow to a target capability.

**Request body**: `{ targetCapabilityId, availableOutputTypes: string[], existingCapabilityIds: string[], maxDepth?: 5 }`

**Response 200**: `{ proposal: { proposalType, capabilitiesToInsert, path, explanation } | null }`

## Behavioral Contracts

1. All endpoints MUST return 200 even when no results are found (empty arrays, null proposals). HTTP errors are reserved for invalid requests (400) and server errors (500).
2. All SemanticTypeId parameters MUST be validated against the dot-notation format.
3. Response times MUST meet performance targets (2s discovery, 3s path finding, 5s auto-completion).
4. All operations MUST be deterministic -- same request produces same response given same registry state.
5. No endpoint MAY depend on an AI/LLM service.
