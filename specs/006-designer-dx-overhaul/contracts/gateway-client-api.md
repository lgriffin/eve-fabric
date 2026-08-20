# Contract: Gateway Client API

**Branch**: `006-designer-dx-overhaul` | **Date**: 2026-08-20

The designer communicates with the gateway through a unified client module. All requests use relative paths routed through a Vite dev server proxy in development.

## Base Configuration

- **Development**: Vite proxy `/api` → `http://localhost:3456`
- **Production**: Environment variable or reverse proxy at the same origin

## Operations

### getCapabilities

Loads all registered capabilities from the catalog.

- **Request**: `GET /api/registry`
- **Query params**: `source?`, `search?`, `latest?` (default `true`)
- **Response (200)**:
  ```
  { capabilities: CatalogCapability[] }
  ```
- **Error**: Network failure or non-200 status → GatewayError

### getCapability

Loads a single capability with version history.

- **Request**: `GET /api/registry/:id`
- **Query params**: `version?`
- **Response (200)**:
  ```
  { id, version, name, ..., versions: string[], upgrades: UpgradeInfo[] }
  ```

### savePipeline

Persists a pipeline definition to the gateway.

- **Request**: `POST /api/pipelines`
- **Body**: `PipelineDefinition`
- **Response (200)**:
  ```
  { id: string, version: number, name: string, savedAt: string }
  ```

### executePipeline

Executes a compiled pipeline with user-provided inputs.

- **Request**: `POST /api/pipelines/execute`
- **Body**: `{ pipeline: PipelineDefinition, inputs: Record<string, unknown>, nodeConfiguredValues?: Record<string, Record<string, ConfiguredValue>> }`
- **Response (200)**:
  ```
  {
    outputs: Record<string, unknown>,
    steps?: StepResult[],
    metrics?: ExecutionMetrics,
    stepStatuses?: Record<string, string>,
    errors?: StepError[]
  }
  ```

### publishComposite

Publishes a saved pipeline as a reusable composite capability.

- **Request**: `POST /api/registry/publish`
- **Body**: `{ capabilityId, version, name, description, pipelineId, pipelineVersion, selectedInputs, selectedOutputs }`
- **Response (201)**:
  ```
  { success: boolean, capability: CatalogCapability, diagnostics: Diagnostic[] }
  ```

### searchReferenceData

Reference data lookups for execution input dialogs.

- **Items**: `GET /api/reference/items?q=&limit=`
- **Regions**: `GET /api/reference/regions`
- **Systems**: `GET /api/reference/systems?q=&limit=`

## Error Contract

All gateway errors return a consistent shape:

```
{
  error: {
    message: string,
    code?: string
  }
}
```

The client wraps all responses in a discriminated union:

```
type GatewayResult<T> =
  | { ok: true, data: T }
  | { ok: false, error: GatewayError }
```

Where `GatewayError` includes:

- `message`: Human-readable error description
- `operation`: Which operation failed (e.g., "save pipeline")
- `statusCode?`: HTTP status code if available
- `isNetworkError`: Whether the gateway was unreachable
