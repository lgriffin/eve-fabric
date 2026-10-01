import type { CapabilityId, CapabilityVersion, CapabilityRef } from '../capability/index.js';
import type { CapabilitySource } from '../capability/value-objects.js';

export interface DependencyTreeNode {
  readonly id: CapabilityId;
  readonly version: CapabilityVersion;
  readonly source: CapabilitySource;
  readonly children: DependencyTreeNode[];
}

function refKey(ref: CapabilityRef): string {
  return ref.version ? `${ref.id as string}@${ref.version as string}` : ref.id;
}

export class DependencyGraph {
  private readonly adjacency = new Map<string, Set<string>>();
  private readonly reverse = new Map<string, Set<string>>();

  addDependency(from: CapabilityRef, to: CapabilityRef): void {
    const fromKey = refKey(from);
    const toKey = refKey(to);

    let deps = this.adjacency.get(fromKey);
    if (!deps) {
      deps = new Set();
      this.adjacency.set(fromKey, deps);
    }
    deps.add(toKey);

    let revDeps = this.reverse.get(toKey);
    if (!revDeps) {
      revDeps = new Set();
      this.reverse.set(toKey, revDeps);
    }
    revDeps.add(fromKey);
  }

  removeDependency(from: CapabilityRef, to: CapabilityRef): void {
    const fromKey = refKey(from);
    const toKey = refKey(to);

    this.adjacency.get(fromKey)?.delete(toKey);
    this.reverse.get(toKey)?.delete(fromKey);
  }

  hasCycle(from: CapabilityRef, proposedTo: CapabilityRef): boolean {
    const fromKey = refKey(from);
    const toKey = refKey(proposedTo);

    if (fromKey === toKey) return true;

    const visited = new Set<string>();
    const stack = [toKey];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromKey) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = this.adjacency.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }
    return false;
  }

  findCyclePath(from: CapabilityRef, proposedTo: CapabilityRef): string[] | null {
    const fromKey = refKey(from);
    const toKey = refKey(proposedTo);

    if (fromKey === toKey) return [fromKey];

    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): boolean => {
      if (current === fromKey) {
        path.push(current);
        return true;
      }
      if (visited.has(current)) return false;
      visited.add(current);
      path.push(current);

      const deps = this.adjacency.get(current);
      if (deps) {
        for (const dep of deps) {
          if (dfs(dep)) return true;
        }
      }

      path.pop();
      return false;
    };

    if (dfs(toKey)) {
      return [fromKey, ...path];
    }
    return null;
  }

  getDependencies(ref: CapabilityRef): Set<string> {
    const result = new Set<string>();
    const stack = [refKey(ref)];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const deps = this.adjacency.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!result.has(dep)) {
            result.add(dep);
            stack.push(dep);
          }
        }
      }
    }
    return result;
  }

  getDependents(ref: CapabilityRef): Set<string> {
    const result = new Set<string>();
    const stack = [refKey(ref)];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const revDeps = this.reverse.get(current);
      if (revDeps) {
        for (const dep of revDeps) {
          if (!result.has(dep)) {
            result.add(dep);
            stack.push(dep);
          }
        }
      }
    }
    return result;
  }

  getDirectDependencies(ref: CapabilityRef): Set<string> {
    return new Set(this.adjacency.get(refKey(ref)) ?? []);
  }

  getImpact(ref: CapabilityRef): Set<string> {
    return this.getDependents(ref);
  }

  buildDependencyTree(
    ref: CapabilityRef,
    resolver: (
      key: string,
    ) => { id: CapabilityId; version: CapabilityVersion; source: CapabilitySource } | undefined,
    visited = new Set<string>(),
  ): DependencyTreeNode | null {
    const key = refKey(ref);
    const info = resolver(key);
    if (!info) return null;

    if (visited.has(key)) {
      return { ...info, children: [] };
    }
    visited.add(key);

    const deps = this.adjacency.get(key);
    const children: DependencyTreeNode[] = [];
    if (deps) {
      for (const depKey of deps) {
        const parts = depKey.split('@');
        const depRef: CapabilityRef = {
          id: parts[0]! as CapabilityId,
          version: parts[1] as CapabilityVersion | undefined,
        };
        const child = this.buildDependencyTree(depRef, resolver, visited);
        if (child) children.push(child);
      }
    }

    return { ...info, children };
  }
}
