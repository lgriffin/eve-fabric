import type { SchemaPackage, SchemaPackageRepository } from '@eve-fabric/core';

export class InMemorySchemaPackageRepository implements SchemaPackageRepository {
  private readonly store = new Map<string, SchemaPackage>();

  async save(pkg: SchemaPackage): Promise<void> {
    this.store.set(pkg.id, pkg);
  }

  async getById(id: string): Promise<SchemaPackage | undefined> {
    return this.store.get(id);
  }

  async list(): Promise<SchemaPackage[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
