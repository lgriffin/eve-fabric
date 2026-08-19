import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { SemanticTypeRegistry } from '../../src/semantic-type/registry.js';
import { createSemanticType, semanticTypeId } from '../../src/semantic-type/semantic-type.js';

function makeType(id: string, category = 'test') {
  return createSemanticType({
    id,
    description: `Test type ${id}`,
    schema: z.number(),
    category,
  });
}

describe('SemanticTypeRegistry', () => {
  let registry: SemanticTypeRegistry;

  beforeEach(() => {
    registry = new SemanticTypeRegistry();
  });

  describe('register + get', () => {
    it('round-trips a registered type', () => {
      const type = makeType('test.alpha');
      registry.register(type);

      const retrieved = registry.get(semanticTypeId('test.alpha'));
      expect(retrieved).toBe(type);
    });

    it('throws on duplicate registration', () => {
      registry.register(makeType('test.alpha'));
      expect(() => registry.register(makeType('test.alpha'))).toThrow(
        'already registered',
      );
    });

    it('throws when getting a nonexistent type', () => {
      expect(() => registry.get(semanticTypeId('test.nonexistent'))).toThrow(
        'not registered',
      );
    });
  });

  describe('has', () => {
    it('returns true for registered types', () => {
      registry.register(makeType('test.alpha'));
      expect(registry.has(semanticTypeId('test.alpha'))).toBe(true);
    });

    it('returns false for unregistered types', () => {
      expect(registry.has(semanticTypeId('test.nonexistent'))).toBe(false);
    });
  });

  describe('listByCategory', () => {
    it('returns only types in the given category', () => {
      registry.register(makeType('test.alpha', 'universe'));
      registry.register(makeType('test.beta', 'market'));
      registry.register(makeType('test.gamma', 'universe'));

      const universe = registry.listByCategory('universe');
      expect(universe).toHaveLength(2);
      expect(universe.map((t) => t.id as string)).toContain('test.alpha');
      expect(universe.map((t) => t.id as string)).toContain('test.gamma');
    });

    it('returns empty array for unknown category', () => {
      registry.register(makeType('test.alpha', 'universe'));
      expect(registry.listByCategory('nonexistent')).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('returns all registered types', () => {
      registry.register(makeType('test.alpha'));
      registry.register(makeType('test.beta'));
      registry.register(makeType('test.gamma'));

      expect(registry.list()).toHaveLength(3);
    });

    it('returns empty array when no types registered', () => {
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('isCompatible', () => {
    it('returns true for same semantic type ID', () => {
      const id = semanticTypeId('eve.region.reference');
      expect(registry.isCompatible(id, id)).toBe(true);
    });

    it('returns false for different semantic type IDs', () => {
      const regionId = semanticTypeId('eve.region.reference');
      const systemId = semanticTypeId('eve.system.reference');
      expect(registry.isCompatible(regionId, systemId)).toBe(false);
    });

    it('returns false even for structurally similar types', () => {
      const typeRef = semanticTypeId('eve.type.reference');
      const regionRef = semanticTypeId('eve.region.reference');
      expect(registry.isCompatible(typeRef, regionRef)).toBe(false);
    });
  });
});
