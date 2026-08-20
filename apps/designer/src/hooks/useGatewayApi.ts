import { useEffect } from 'react';
import { useCatalogStore } from '../stores/catalog-store.js';

export function useLoadCatalog() {
  const fetchCapabilities = useCatalogStore((s) => s.fetchCapabilities);

  useEffect(() => {
    void fetchCapabilities();
  }, [fetchCapabilities]);
}
