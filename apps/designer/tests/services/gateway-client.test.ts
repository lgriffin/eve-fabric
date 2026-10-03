import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCapabilities } from '../../src/services/gateway-client.js';

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

    it('falls back to the status when the error body is not JSON', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('html')) }),
      );

      const result = await getCapabilities();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBe('HTTP 502');
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
});
