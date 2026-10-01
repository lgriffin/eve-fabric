import type { SchemaPackage } from '../schema-package/schema-package.js';

export interface SchemaPackageRepository {
  save(pkg: SchemaPackage): Promise<void>;
  getById(id: string): Promise<SchemaPackage | undefined>;
  list(): Promise<SchemaPackage[]>;
  delete(id: string): Promise<boolean>;
}
