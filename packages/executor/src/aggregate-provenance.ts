import type { ProvenanceRecord } from '@eve-fabric/domain';

export function aggregateProvenance(
  childRecords: readonly ProvenanceRecord[],
): readonly ProvenanceRecord[] {
  const seen = new Set<string>();
  const result: ProvenanceRecord[] = [];

  function collect(record: ProvenanceRecord): void {
    const key = `${record.capability.id}@${record.capabilityVersion}:${record.source}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (record.source === 'CACHE' || record.upstream.length > 0) {
      for (const up of record.upstream) {
        collect(up);
      }
    } else {
      result.push(record);
    }
  }

  for (const record of childRecords) {
    collect(record);
  }

  return result;
}
