import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collectUnconnectedInputs,
  loadSavedInputs,
  saveInputs,
} from '../../src/components/shared/ExecutionInputDialog.js';

const mockStorage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

describe('ExecutionInputDialog helpers', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('collectUnconnectedInputs', () => {
    it('returns required inputs that have no incoming edge', () => {
      const nodes = [
        {
          id: 'n1',
          data: {
            label: 'Market Orders',
            inputs: [
              { name: 'typeId', semanticType: 'eve.type.id', required: true },
              { name: 'regionId', semanticType: 'eve.region.id', required: true },
            ],
          },
        },
      ];
      const edges = [{ target: 'n1', targetHandle: 'typeId' }];

      const result = collectUnconnectedInputs(nodes, edges);

      expect(result).toHaveLength(1);
      expect(result[0]!.inputName).toBe('regionId');
      expect(result[0]!.nodeId).toBe('n1');
      expect(result[0]!.nodeName).toBe('Market Orders');
    });

    it('skips optional inputs', () => {
      const nodes = [
        {
          id: 'n1',
          data: {
            label: 'Orders',
            inputs: [
              { name: 'typeId', semanticType: 'eve.type.id', required: true },
              { name: 'limit', semanticType: 'integer', required: false },
            ],
          },
        },
      ];

      const result = collectUnconnectedInputs(nodes, []);

      expect(result).toHaveLength(1);
      expect(result[0]!.inputName).toBe('typeId');
    });

    it('returns empty array when all required inputs are connected', () => {
      const nodes = [
        {
          id: 'n1',
          data: {
            label: 'Orders',
            inputs: [{ name: 'typeId', semanticType: 'eve.type.id', required: true }],
          },
        },
      ];
      const edges = [{ target: 'n1', targetHandle: 'typeId' }];

      expect(collectUnconnectedInputs(nodes, edges)).toHaveLength(0);
    });

    it('collects from multiple nodes', () => {
      const nodes = [
        {
          id: 'n1',
          data: {
            label: 'Orders',
            inputs: [{ name: 'typeId', semanticType: 'eve.type.id', required: true }],
          },
        },
        {
          id: 'n2',
          data: {
            label: 'Routes',
            inputs: [{ name: 'origin', semanticType: 'eve.system.id', required: true }],
          },
        },
      ];

      const result = collectUnconnectedInputs(nodes, []);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.inputName)).toEqual(['typeId', 'origin']);
    });
  });

  describe('localStorage persistence', () => {
    it('saves and loads input values', () => {
      const values = { n1: { typeId: '34', regionId: '10000002' } };
      saveInputs('my-pipeline', values);

      const loaded = loadSavedInputs('my-pipeline');
      expect(loaded).toEqual(values);
    });

    it('returns empty object for unknown pipeline', () => {
      expect(loadSavedInputs('nonexistent')).toEqual({});
    });

    it('returns empty object for corrupt data', () => {
      mockStorage.set('eve-fabric:exec-inputs:bad', '{not valid json');
      expect(loadSavedInputs('bad')).toEqual({});
    });

    it('pre-fills values from prior execution', () => {
      const prior = { n1: { typeId: '100' } };
      saveInputs('pipeline-a', prior);

      const loaded = loadSavedInputs('pipeline-a');
      expect(loaded.n1!.typeId).toBe('100');
    });
  });
});
