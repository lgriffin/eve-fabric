import { describe, it, expect } from 'vitest';
import { parse, type DocumentNode, type FieldNode, Kind } from 'graphql';
import { analyzeSelectionSet } from '../src/selection-analyzer.js';
import type { GraphQLResolveInfo } from 'graphql';

/**
 * Helper to construct a minimal GraphQLResolveInfo-like object
 * from a GraphQL query string targeting a specific field.
 */
function makeResolveInfo(query: string, fieldName: string): GraphQLResolveInfo {
  const doc: DocumentNode = parse(query);
  const opDef = doc.definitions[0];
  if (opDef === undefined || opDef.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error('Expected an operation definition');
  }

  const targetField = opDef.selectionSet.selections.find(
    (sel): sel is FieldNode =>
      sel.kind === Kind.FIELD && sel.name.value === fieldName,
  );

  if (targetField === undefined) {
    throw new Error(`Field "${fieldName}" not found in query`);
  }

  // We only need fieldNodes for analyzeSelectionSet
  return { fieldNodes: [targetField] } as unknown as GraphQLResolveInfo;
}

describe('analyzeSelectionSet', () => {
  it('returns requested field names from a simple query', () => {
    const info = makeResolveInfo(
      `{ tradeOpportunity { bestPrice profit routeDistance } }`,
      'tradeOpportunity',
    );

    const requested = analyzeSelectionSet(info);

    expect(requested.size).toBe(3);
    expect(requested.has('bestPrice')).toBe(true);
    expect(requested.has('profit')).toBe(true);
    expect(requested.has('routeDistance')).toBe(true);
  });

  it('returns only requested fields, not all possible fields', () => {
    const info = makeResolveInfo(
      `{ tradeOpportunity { bestPrice } }`,
      'tradeOpportunity',
    );

    const requested = analyzeSelectionSet(info);

    expect(requested.size).toBe(1);
    expect(requested.has('bestPrice')).toBe(true);
    expect(requested.has('profit')).toBe(false);
  });

  it('returns an empty set for a field with no sub-selections', () => {
    // This constructs a fieldNode with no selectionSet
    const fieldNode: FieldNode = {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'scalar' },
    };

    const info = { fieldNodes: [fieldNode] } as unknown as GraphQLResolveInfo;

    const requested = analyzeSelectionSet(info);

    expect(requested.size).toBe(0);
  });

  it('handles multiple field nodes', () => {
    const info = makeResolveInfo(
      `{ tradeOpportunity { bestPrice profit } }`,
      'tradeOpportunity',
    );

    // Simulate multiple field nodes by duplicating
    const doubled = {
      fieldNodes: [...info.fieldNodes, ...info.fieldNodes],
    } as unknown as GraphQLResolveInfo;

    const requested = analyzeSelectionSet(doubled);

    // Same fields, deduplicated via Set
    expect(requested.size).toBe(2);
    expect(requested.has('bestPrice')).toBe(true);
    expect(requested.has('profit')).toBe(true);
  });

  it('includes _provenance when requested', () => {
    const info = makeResolveInfo(
      `{ tradeOpportunity { bestPrice _provenance } }`,
      'tradeOpportunity',
    );

    const requested = analyzeSelectionSet(info);

    expect(requested.has('_provenance')).toBe(true);
    expect(requested.has('bestPrice')).toBe(true);
    expect(requested.size).toBe(2);
  });
});
