import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCapabilities,
  savePipeline,
  executePipeline,
  publishComposite,
} from '../../src/services/gateway-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('gateway-client', () => {
  describe('getCapabilities', () => {
    it('returns capabilities on success', async () => {
      const caps = { capabilities: [{ id: 'market.orders', name: 'Market Orders' }] };
      mockFetch.mockReturnValue(jsonResponse(caps));

      const result = await getCapabilities();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.capabilities).toHaveLength(1);
        expect(result.data.capabilities[0]!.id).toBe('market.orders');
      }
      expect(mockFetch).toHaveBeenCalledWith('/api/registry', undefined);
    });

    it('returns error on non-200 response', async () => {
      mockFetch.mockReturnValue(jsonResponse({ error: { message: 'Not found' } }, 404));

      const result = await getCapabilities();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Not found');
        expect(result.error.operation).toBe('load capabilities');
        expect(result.error.statusCode).toBe(404);
        expect(result.error.isNetworkError).toBe(false);
      }
    });

    it('returns network error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await getCapabilities();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to fetch');
        expect(result.error.isNetworkError).toBe(true);
      }
    });
  });

  describe('savePipeline', () => {
    it('posts pipeline and returns save response', async () => {
      const saveResponse = { id: 'p1', version: 1, name: 'Test', savedAt: '2026-01-01' };
      mockFetch.mockReturnValue(jsonResponse(saveResponse));

      const result = await savePipeline({ id: 'p1', name: 'Test' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe('p1');
      }
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/pipelines',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });

  describe('executePipeline', () => {
    it('posts pipeline with inputs and returns execution response', async () => {
      const execResponse = { outputs: { result: [1, 2, 3] }, steps: [] };
      mockFetch.mockReturnValue(jsonResponse(execResponse));

      const result = await executePipeline({ id: 'p1' }, { typeId: '34', regionId: '10000002' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.outputs).toEqual({ result: [1, 2, 3] });
      }

      const callArgs = mockFetch.mock.calls[0]!;
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.inputs.typeId).toBe('34');
    });

    it('returns error on HTTP failure', async () => {
      mockFetch.mockReturnValue(jsonResponse({ error: { message: 'Internal error' } }, 500));

      const result = await executePipeline({ id: 'p1' }, {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.operation).toBe('execute pipeline');
        expect(result.error.statusCode).toBe(500);
      }
    });
  });

  describe('publishComposite', () => {
    it('posts publish request and returns capability', async () => {
      const pubResponse = {
        success: true,
        capability: { id: 'custom.pipe', version: '1.0.0', name: 'Custom' },
        diagnostics: [],
      };
      mockFetch.mockReturnValue(jsonResponse(pubResponse));

      const result = await publishComposite({
        capabilityId: 'custom.pipe',
        version: '1.0.0',
        name: 'Custom Pipeline',
        description: 'A custom pipeline',
        pipelineId: 'p1',
        pipelineVersion: 1,
        selectedInputs: ['typeId'],
        selectedOutputs: ['result'],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
      }
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/registry/publish',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });
});
