import { useCallback, useEffect } from 'react';
import { useCatalogStore, enrichWithCategory } from '../stores/catalog-store.js';
import type { CatalogCapability } from '../stores/catalog-store.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3000';

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

    load();
    return () => { cancelled = true; };
  }, [setCapabilities, setLoading]);
}

export function useSavePipeline() {
  return useCallback(async (yaml: string) => {
    const res = await fetch(`${gatewayUrl()}/api/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/yaml' },
      body: yaml,
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    return res.json();
  }, []);
}

export function useExportSchema() {
  return useCallback(async (pipelineId: string) => {
    const res = await fetch(`${gatewayUrl()}/api/schemas/${pipelineId}/export`);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.json();
  }, []);
}
