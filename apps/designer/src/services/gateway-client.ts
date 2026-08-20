import type { CatalogCapability } from '../stores/catalog-store.js';

interface GatewayError {
  message: string;
  operation: string;
  statusCode?: number;
  isNetworkError: boolean;
}

type GatewayResult<T> = { ok: true; data: T } | { ok: false; error: GatewayError };

interface SavePipelineResponse {
  id: string;
  version: number;
  name: string;
  savedAt: string;
}

interface ExecutePipelineResponse {
  outputs: Record<string, unknown>;
  steps?: Array<{
    stepId: string;
    capabilityId: string;
    status: string;
    durationMs: number;
    cached: boolean;
  }>;
  metrics?: {
    stepDurations?: Record<string, number>;
    totalDurationMs?: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
  stepStatuses?: Record<string, string>;
  errors?: Array<{ stepId: string; message: string; code: string }>;
}

interface PublishResponse {
  success: boolean;
  capability: {
    id: string;
    version: string;
    name: string;
    source: string;
    inputs: Array<{ name: string; semanticType: string; required: boolean }>;
    outputs: Array<{ name: string; semanticType: string }>;
  };
  diagnostics: Array<{ code: string; severity: string; message: string }>;
}

async function request<T>(
  path: string,
  operation: string,
  options?: RequestInit,
): Promise<GatewayResult<T>> {
  try {
    const res = await fetch(path, options);
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) message = body.error.message;
      } catch {
        // response body wasn't JSON
      }
      return {
        ok: false,
        error: { message, operation, statusCode: res.status, isNetworkError: false },
      };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        operation,
        isNetworkError: true,
      },
    };
  }
}

export async function getCapabilities(): Promise<
  GatewayResult<{ capabilities: Omit<CatalogCapability, 'category'>[] }>
> {
  return request('/api/registry', 'load capabilities');
}

export async function savePipeline(
  pipeline: unknown,
): Promise<GatewayResult<SavePipelineResponse>> {
  return request('/api/pipelines', 'save pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline),
  });
}

export async function executePipeline(
  pipeline: unknown,
  inputs: Record<string, unknown>,
  nodeConfiguredValues?: Record<string, Record<string, unknown>>,
): Promise<GatewayResult<ExecutePipelineResponse>> {
  return request('/api/pipelines/execute', 'execute pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipeline, inputs, nodeConfiguredValues }),
  });
}

export async function publishComposite(body: {
  capabilityId: string;
  version: string;
  name: string;
  description: string;
  pipelineId: string;
  pipelineVersion: number;
  selectedInputs: string[];
  selectedOutputs: string[];
}): Promise<GatewayResult<PublishResponse>> {
  return request('/api/registry/publish', 'publish composite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
