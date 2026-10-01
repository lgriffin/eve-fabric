import { describe, it, expect } from 'vitest';
import { GraphQLString, getNullableType } from 'graphql';
import { DataProvenanceType } from '../src/provenance-field.js';

describe('_provenance', () => {
  it('reports the capability version as text, as in "1.2.0"', () => {
    const version = DataProvenanceType.getFields()['version']!;
    expect(getNullableType(version.type)).toBe(GraphQLString);
  });
});
