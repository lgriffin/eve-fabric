import { describe, expect, it } from 'vitest';
import { fileKind } from '../../src/services/file-kind.js';

describe('fileKind', () => {
  it('reads a .graphql or .gql file as a saved question', () => {
    expect(fileKind('q.graphql', 'anything')).toBe('question');
    expect(fileKind('Q.GQL', 'anything')).toBe('question');
  });

  it('reads a GraphQL document by its opening, whatever the name', () => {
    expect(fileKind('q.txt', '  { type(name: "Tritanium") { orders } }')).toBe('question');
    expect(fileKind('q.txt', 'query Q { type(name: "Tritanium") { orders } }')).toBe('question');
  });

  it('reads package format v2 YAML as a weave', () => {
    expect(fileKind('x.weave.yaml', 'format: 2\nid: me.prices\n')).toBe('weave');
  });

  it('does not know other YAML: pipelines are not written by hand any more', () => {
    expect(fileKind('p.yaml', 'id: trade.opportunity\nversion: 1\n')).toBe('unknown');
  });
});
