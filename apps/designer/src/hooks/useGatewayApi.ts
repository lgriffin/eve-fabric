import { useCallback, useEffect } from 'react';
import { useCatalogStore, enrichWithCategory } from '../stores/catalog-store.js';
import type { CatalogCapability } from '../stores/catalog-store.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3456';

function gatewayUrl(): string {
  if (typeof window !== 'undefined') {
    const url = (window as unknown as Record<string, unknown>)['__GATEWAY_URL__'];
    if (typeof url === 'string') return url;
  }
  return DEFAULT_GATEWAY_URL;
}

export function useLoadCatalog() {
  const setCapabilities = useCatalogStore((s) => s.setCapabilities);
  const setLoading = useCatalogStore((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${gatewayUrl()}/api/capabilities`);
        if (!res.ok) return;
        const data = (await res.json()) as Omit<CatalogCapability, 'category'>[];
        if (!cancelled) {
          setCapabilities(data.map(enrichWithCategory));
        }
      } catch {
        // Gateway not available — use empty catalog
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [setCapabilities, setLoading]);
}

export interface SavedPipelineInfo {
  id: string;
  name: string;
  version: number;
  description?: string;
  savedAt: string;
}

export function useGatewayPipelines() {
  const savePipeline = useCallback(async (yaml: string): Promise<SavedPipelineInfo> => {
    const res = await fetch(`${gatewayUrl()}/api/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/yaml' },
      body: yaml,
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    return (await res.json()) as SavedPipelineInfo;
  }, []);

  const listPipelines = useCallback(async (): Promise<SavedPipelineInfo[]> => {
    const res = await fetch(`${gatewayUrl()}/api/pipelines`);
    if (!res.ok) throw new Error(`List failed: ${res.status}`);
    return (await res.json()) as SavedPipelineInfo[];
  }, []);

  const loadPipeline = useCallback(async (id: string): Promise<string> => {
    const res = await fetch(`${gatewayUrl()}/api/pipelines/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Load failed: ${res.status}`);
    return await res.text();
  }, []);

  const deletePipeline = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`${gatewayUrl()}/api/pipelines/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  }, []);

  return { savePipeline, listPipelines, loadPipeline, deletePipeline };
}

export function useExportSchema() {
  return useCallback(async (pipelineId: string) => {
    const res = await fetch(`${gatewayUrl()}/api/schemas/${encodeURIComponent(pipelineId)}/export`);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return (await res.json()) as unknown;
  }, []);
}
