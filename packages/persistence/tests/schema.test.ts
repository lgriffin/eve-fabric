import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { capabilities, pipelines, schemaPackages, versions } from '../src/schema.js';

describe('persistence schema', () => {
  describe('capabilities table', () => {
    it('has the correct table name', () => {
      expect(getTableName(capabilities)).toBe('capabilities');
    });

    it('has all expected columns', () => {
      expect(capabilities.id).toBeDefined();
      expect(capabilities.version).toBeDefined();
      expect(capabilities.name).toBeDefined();
      expect(capabilities.description).toBeDefined();
      expect(capabilities.source).toBeDefined();
      expect(capabilities.inputs).toBeDefined();
      expect(capabilities.outputs).toBeDefined();
      expect(capabilities.auth).toBeDefined();
      expect(capabilities.cache).toBeDefined();
      expect(capabilities.cost).toBeDefined();
      expect(capabilities.dependencies).toBeDefined();
      expect(capabilities.createdAt).toBeDefined();
    });
  });

  describe('pipelines table', () => {
    it('has the correct table name', () => {
      expect(getTableName(pipelines)).toBe('pipelines');
    });

    it('has all expected columns', () => {
      expect(pipelines.id).toBeDefined();
      expect(pipelines.version).toBeDefined();
      expect(pipelines.name).toBeDefined();
      expect(pipelines.description).toBeDefined();
      expect(pipelines.inputs).toBeDefined();
      expect(pipelines.nodes).toBeDefined();
      expect(pipelines.edges).toBeDefined();
      expect(pipelines.outputs).toBeDefined();
      expect(pipelines.createdAt).toBeDefined();
    });
  });

  describe('schemaPackages table', () => {
    it('has the correct table name', () => {
      expect(getTableName(schemaPackages)).toBe('schema_packages');
    });

    it('has all expected columns', () => {
      expect(schemaPackages.id).toBeDefined();
      expect(schemaPackages.name).toBeDefined();
      expect(schemaPackages.version).toBeDefined();
      expect(schemaPackages.description).toBeDefined();
      expect(schemaPackages.pipelineDefinition).toBeDefined();
      expect(schemaPackages.graphqlSdl).toBeDefined();
      expect(schemaPackages.mappings).toBeDefined();
      expect(schemaPackages.policies).toBeDefined();
      expect(schemaPackages.metadata).toBeDefined();
      expect(schemaPackages.createdAt).toBeDefined();
    });
  });

  describe('versions table', () => {
    it('has the correct table name', () => {
      expect(getTableName(versions)).toBe('versions');
    });

    it('has all expected columns', () => {
      expect(versions.id).toBeDefined();
      expect(versions.entityType).toBeDefined();
      expect(versions.entityId).toBeDefined();
      expect(versions.version).toBeDefined();
      expect(versions.snapshot).toBeDefined();
      expect(versions.createdAt).toBeDefined();
    });
  });
});
