export interface ReferenceDataItem {
  id: number;
  name: string;
}

let cachedRegions: ReferenceDataItem[] | null = null;

export async function searchItems(query: string, limit = 20): Promise<ReferenceDataItem[]> {
  if (query.length < 2) return [];
  try {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await fetch(`/api/reference/items?${params}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { items: ReferenceDataItem[] };
    return json.items;
  } catch {
    return [];
  }
}

export async function listRegions(): Promise<ReferenceDataItem[]> {
  if (cachedRegions) return cachedRegions;
  try {
    const res = await fetch(`/api/reference/regions`);
    if (!res.ok) return [];
    const json = (await res.json()) as { regions: ReferenceDataItem[] };
    cachedRegions = json.regions;
    return cachedRegions;
  } catch {
    return [];
  }
}

export async function searchSystems(query: string, limit = 20): Promise<ReferenceDataItem[]> {
  if (query.length < 2) return [];
  try {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await fetch(`/api/reference/systems?${params}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { systems: ReferenceDataItem[] };
    return json.systems;
  } catch {
    return [];
  }
}
