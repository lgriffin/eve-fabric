import { describe, it, expect } from 'vitest';
import {
  semanticTypeMismatch,
  cycleDetected,
  capabilityNotFound,
  missingInput,
  semanticSuggestion,
  SEMANTIC_TYPE_MISMATCH,
  GRAPH_CYCLE_DETECTED,
  CAPABILITY_NOT_FOUND,
  MISSING_INPUT,
  SEMANTIC_SUGGESTION,
} from '../src/diagnostics.js';

describe('CompilerDiagnostic factory functions', () => {
  describe('semanticTypeMismatch', () => {
    it('produces an error diagnostic with correct code and types', () => {
      const diag = semanticTypeMismatch(
        'nodeA.output',
        'nodeB.input',
        'eve.market.order.collection',
        'eve.region.reference',
      );

      expect(diag.code).toBe(SEMANTIC_TYPE_MISMATCH);
      expect(diag.severity).toBe('error');
      expect(diag.message).toContain('nodeA.output');
      expect(diag.message).toContain('nodeB.input');
      expect(diag.location?.edgeFrom).toBe('nodeA.output');
      expect(diag.location?.edgeTo).toBe('nodeB.input');
      expect(diag.context?.actualType).toBe('eve.market.order.collection');
      expect(diag.context?.expectedType).toBe('eve.region.reference');
    });
  });

  describe('cycleDetected', () => {
    it('produces an error diagnostic with cycle path', () => {
      const diag = cycleDetected(['A', 'B', 'C', 'A']);

      expect(diag.code).toBe(GRAPH_CYCLE_DETECTED);
      expect(diag.severity).toBe('error');
      expect(diag.message).toContain('A -> B -> C -> A');
      expect(diag.context?.suggestion).toBeDefined();
    });
  });

  describe('capabilityNotFound', () => {
    it('produces an error diagnostic with capability id', () => {
      const diag = capabilityNotFound('market.orders');

      expect(diag.code).toBe(CAPABILITY_NOT_FOUND);
      expect(diag.severity).toBe('error');
      expect(diag.message).toContain('market.orders');
      expect(diag.context?.capability).toBe('market.orders');
    });
  });

  describe('missingInput', () => {
    it('produces an error diagnostic with port and capability info', () => {
      const diag = missingInput('market.orders', 'regionId');

      expect(diag.code).toBe(MISSING_INPUT);
      expect(diag.severity).toBe('error');
      expect(diag.message).toContain('regionId');
      expect(diag.message).toContain('market.orders');
      expect(diag.location?.field).toBe('regionId');
      expect(diag.context?.capability).toBe('market.orders');
    });
  });

  describe('semanticSuggestion', () => {
    it('produces an info diagnostic with suggestion', () => {
      const diag = semanticSuggestion(
        'eve.market.order.collection',
        'eve.region.reference',
        'transform.market.to.region',
      );

      expect(diag.code).toBe(SEMANTIC_SUGGESTION);
      expect(diag.severity).toBe('info');
      expect(diag.message).toContain('transform.market.to.region');
      expect(diag.location?.edgeFrom).toBe('eve.market.order.collection');
      expect(diag.location?.edgeTo).toBe('eve.region.reference');
      expect(diag.context?.capability).toBe('transform.market.to.region');
      expect(diag.context?.suggestion).toBeDefined();
    });
  });
});
