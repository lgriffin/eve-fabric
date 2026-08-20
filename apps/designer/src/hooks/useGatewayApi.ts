import { useEffect } from 'react';
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
        const res = await fetch(`${gatewayUrl()}/api/registry`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          capabilities: Omit<CatalogCapability, 'category'>[];
        };
        if (!cancelled) {
          setCapabilities(json.capabilities.map(enrichWithCategory));
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
