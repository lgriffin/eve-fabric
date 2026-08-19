import type { CapabilityDefinition } from '@eve-fabric/domain';

export interface CapabilityRepository {
  save(def: CapabilityDefinition): Promise<void>;
  getById(id: string, version?: number): Promise<CapabilityDefinition | undefined>;
  list(): Promise<CapabilityDefinition[]>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryCapabilityRepository implements CapabilityRepository {
  private readonly store = new Map<string, CapabilityDefinition>();

  private key(id: string, version: number): string {
    return `${id}@${version}`;
  }

  async save(def: CapabilityDefinition): Promise<void> {
    this.store.set(this.key(def.id as string, def.version as number), def);
  }

  async getById(id: string, version?: number): Promise<CapabilityDefinition | undefined> {
    if (version !== undefined) {
      return this.store.get(this.key(id, version));
    }
    let latest: CapabilityDefinition | undefined;
    for (const def of this.store.values()) {
      if ((def.id as string) === id) {
        if (!latest || (def.version as number) > (latest.version as number)) {
          latest = def;
        }
      }
    }
    return latest;
  }

  async list(): Promise<CapabilityDefinition[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<boolean> {
    let deleted = false;
    for (const key of this.store.keys()) {
      if (key.startsWith(`${id}@`)) {
        this.store.delete(key);
        deleted = true;
      }
    }
    return deleted;
  }
}
