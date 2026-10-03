import type { CatalogCapability } from '../stores/catalog-store.js';

interface GatewayError {
  message: string;
  operation: string;
  statusCode?: number;
  isNetworkError: boolean;
}

type GatewayResult<T> = { ok: true; data: T } | { ok: false; error: GatewayError };

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

/** The catalog: what the fabric's capabilities look like, for the canvas's node labels and ports. */
export async function getCapabilities(): Promise<
  GatewayResult<{ capabilities: Omit<CatalogCapability, 'category'>[] }>
> {
  return request('/api/registry', 'load capabilities');
}
