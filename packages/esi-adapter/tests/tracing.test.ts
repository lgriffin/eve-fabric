import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EsiAdapter } from '../src/esi-adapter.js';
import { setEsiTracerProvider, createTracedEsiAdapter } from '../src/tracing.js';

function createMockSpan() {
  return { setAttribute: vi.fn(), setStatus: vi.fn(), end: vi.fn() };
}

function createMockTracer() {
  const span = createMockSpan();
  return { tracer: { startSpan: vi.fn().mockReturnValue(span) }, span };
}

function createMockProvider(tracer: unknown) {
  return { getTracer: vi.fn().mockReturnValue(tracer) };
}

function createMockAdapter(
  overrides: Partial<{
    execute: ReturnType<typeof vi.fn>;
  }> = {},
): EsiAdapter {
  return {
    name: 'ESI',
    supports: vi.fn().mockReturnValue(true),
    execute:
      overrides.execute ??
      vi.fn().mockResolvedValue({
        data: { price: 100 },
        provenance: {
          source: 'ESI',
          capability: { id: 'market.orders', version: 1 },
          capabilityVersion: 1,
          cached: false,
          upstream: [],
        },
      }),
  } as unknown as EsiAdapter;
}

describe('esi-adapter tracing', () => {
  afterEach(() => {
    setEsiTracerProvider(undefined as never);
  });

  describe('createTracedEsiAdapter', () => {
    it('returns the original adapter when no provider is set', () => {
      const adapter = createMockAdapter();
      const result = createTracedEsiAdapter(adapter);
      expect(result).toBe(adapter);
    });

    it('wraps the adapter when a provider is set', () => {
      const { tracer } = createMockTracer();
      const provider = createMockProvider(tracer);
      setEsiTracerProvider(provider);

      const adapter = createMockAdapter();
      const result = createTracedEsiAdapter(adapter);
      expect(result).not.toBe(adapter);
    });
  });

  describe('traced execute', () => {
    it('creates a span named esi.call with capability and source attributes', async () => {
      const { tracer, span } = createMockTracer();
      const provider = createMockProvider(tracer);
      setEsiTracerProvider(provider);

      const adapter = createMockAdapter();
      const traced = createTracedEsiAdapter(adapter);

      const capability = { id: 'market.orders', version: 1 } as never;
      const inputs = new Map<string, unknown>();
      await traced.execute(capability, inputs);

      expect(tracer.startSpan).toHaveBeenCalledWith('esi.call', {
        attributes: {
          'esi.capability': 'market.orders',
          'esi.source': 'ESI',
        },
      });
      expect(span.end).toHaveBeenCalled();
    });

    it('sets cached and version attributes on success and ends span with code 0', async () => {
      const { tracer, span } = createMockTracer();
      const provider = createMockProvider(tracer);
      setEsiTracerProvider(provider);

      const adapter = createMockAdapter();
      const traced = createTracedEsiAdapter(adapter);

      const capability = { id: 'market.orders', version: 3 } as never;
      await traced.execute(capability, new Map());

      expect(span.setAttribute).toHaveBeenCalledWith('esi.cached', false);
      expect(span.setAttribute).toHaveBeenCalledWith('esi.capability.version', 3);
      expect(span.setStatus).toHaveBeenCalledWith({ code: 0 });
      expect(span.end).toHaveBeenCalled();
    });

    it('sets error status on failure and re-throws', async () => {
      const { tracer, span } = createMockTracer();
      const provider = createMockProvider(tracer);
      setEsiTracerProvider(provider);

      const error = new Error('ESI unavailable');
      const adapter = createMockAdapter({
        execute: vi.fn().mockRejectedValue(error),
      });
      const traced = createTracedEsiAdapter(adapter);

      const capability = { id: 'market.orders', version: 1 } as never;
      await expect(traced.execute(capability, new Map())).rejects.toThrow('ESI unavailable');

      expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: 'ESI unavailable' });
      expect(span.end).toHaveBeenCalled();
    });
  });
});
