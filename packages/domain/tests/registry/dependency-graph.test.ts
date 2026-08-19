import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../src/registry/dependency-graph.js';
import { capabilityId, capabilityVersion } from '../../src/capability/capability-id.js';
import type { CapabilityRef } from '../../src/capability/capability-id.js';

function ref(id: string, version?: string): CapabilityRef {
  return {
    id: capabilityId(id),
    version: version ? capabilityVersion(version) : undefined,
  };
}

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('addDependency', () => {
    it('adds a dependency edge', () => {
      graph.addDependency(ref('market.snapshot', '1.0.0'), ref('market.orders', '1.0.0'));
      const deps = graph.getDirectDependencies(ref('market.snapshot', '1.0.0'));
      expect(deps.size).toBe(1);
      expect(deps.has('market.orders@1.0.0')).toBe(true);
    });

    it('supports multiple dependencies', () => {
      graph.addDependency(ref('market.snapshot', '1.0.0'), ref('market.orders', '1.0.0'));
      graph.addDependency(ref('market.snapshot', '1.0.0'), ref('market.aggregate', '1.0.0'));
      const deps = graph.getDirectDependencies(ref('market.snapshot', '1.0.0'));
      expect(deps.size).toBe(2);
    });
  });

  describe('removeDependency', () => {
    it('removes a dependency edge', () => {
      graph.addDependency(ref('market.snapshot', '1.0.0'), ref('market.orders', '1.0.0'));
      graph.removeDependency(ref('market.snapshot', '1.0.0'), ref('market.orders', '1.0.0'));
      const deps = graph.getDirectDependencies(ref('market.snapshot', '1.0.0'));
      expect(deps.size).toBe(0);
    });
  });

  describe('hasCycle', () => {
    it('detects self-reference', () => {
      expect(graph.hasCycle(ref('market.orders', '1.0.0'), ref('market.orders', '1.0.0'))).toBe(
        true,
      );
    });

    it('detects indirect cycles', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      graph.addDependency(ref('cap.b', '1.0.0'), ref('cap.c', '1.0.0'));
      expect(graph.hasCycle(ref('cap.c', '1.0.0'), ref('cap.a', '1.0.0'))).toBe(true);
    });

    it('returns false for acyclic graph', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      expect(graph.hasCycle(ref('cap.a', '1.0.0'), ref('cap.c', '1.0.0'))).toBe(false);
    });
  });

  describe('findCyclePath', () => {
    it('returns path for self-reference', () => {
      const path = graph.findCyclePath(ref('cap.a', '1.0.0'), ref('cap.a', '1.0.0'));
      expect(path).toEqual(['cap.a@1.0.0']);
    });

    it('returns path for indirect cycle', () => {
      graph.addDependency(ref('cap.b', '1.0.0'), ref('cap.a', '1.0.0'));
      const path = graph.findCyclePath(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      expect(path).not.toBeNull();
      expect(path!.includes('cap.a@1.0.0')).toBe(true);
    });

    it('returns null for no cycle', () => {
      const path = graph.findCyclePath(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      expect(path).toBeNull();
    });
  });

  describe('getDependencies', () => {
    it('returns transitive dependencies', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      graph.addDependency(ref('cap.b', '1.0.0'), ref('cap.c', '1.0.0'));
      const deps = graph.getDependencies(ref('cap.a', '1.0.0'));
      expect(deps.has('cap.b@1.0.0')).toBe(true);
      expect(deps.has('cap.c@1.0.0')).toBe(true);
    });
  });

  describe('getDependents', () => {
    it('returns reverse transitive dependencies', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      graph.addDependency(ref('cap.b', '1.0.0'), ref('cap.c', '1.0.0'));
      const dependents = graph.getDependents(ref('cap.c', '1.0.0'));
      expect(dependents.has('cap.b@1.0.0')).toBe(true);
      expect(dependents.has('cap.a@1.0.0')).toBe(true);
    });
  });

  describe('getImpact', () => {
    it('returns all dependents of a capability', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      const impact = graph.getImpact(ref('cap.b', '1.0.0'));
      expect(impact.has('cap.a@1.0.0')).toBe(true);
    });
  });

  describe('buildDependencyTree', () => {
    it('builds tree from graph', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      const tree = graph.buildDependencyTree(ref('cap.a', '1.0.0'), (key) => {
        const parts = key.split('@');
        return {
          id: capabilityId(parts[0]!),
          version: capabilityVersion(parts[1]!),
          source: 'DERIVED' as const,
        };
      });
      expect(tree).not.toBeNull();
      expect(tree!.children).toHaveLength(1);
    });

    it('returns null for unknown ref', () => {
      const tree = graph.buildDependencyTree(ref('cap.a', '1.0.0'), () => undefined);
      expect(tree).toBeNull();
    });

    it('handles cycles in tree building', () => {
      graph.addDependency(ref('cap.a', '1.0.0'), ref('cap.b', '1.0.0'));
      graph.addDependency(ref('cap.b', '1.0.0'), ref('cap.a', '1.0.0'));
      const tree = graph.buildDependencyTree(ref('cap.a', '1.0.0'), (key) => {
        const parts = key.split('@');
        return {
          id: capabilityId(parts[0]!),
          version: capabilityVersion(parts[1]!),
          source: 'DERIVED' as const,
        };
      });
      expect(tree).not.toBeNull();
    });
  });
});
