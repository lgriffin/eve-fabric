import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ExecutionPlan, ProvenanceRecord } from '@eve-fabric/domain';
import type { Executor } from '../src/executor.js';
import {
  setTracerProvider,
  createTracedExecutor,
  traceStep,
  traceParallelGroup,
  traceProvenance,
} from '../src/tracing.js';

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

function createMockExecutor(
  overrides: Partial<{ execute: ReturnType<typeof vi.fn> }> = {},
): Executor {
  return {
    execute:
      overrides.execute ??
      vi.fn().mockResolvedValue({
        outputs: new Map([['result', 42]]),
        provenance: new Map(),
        metrics: {
          totalDurationMs: 100,
          stepDurations: new Map(),
          cacheHits: 2,
          cacheMisses: 3,
        },
      }),
  } as unknown as Executor;
}

function createMockPlan(): ExecutionPlan {
  return {
    id: 'plan-1',
    pipelineRef: { id: 'pipe-1', version: 1 },
    steps: [
      { id: 's1', capability: { id: 'cap1' }, inputs: [], dependsOn: [], canParallelize: true },
      { id: 's2', capability: { id: 'cap2' }, inputs: [], dependsOn: [], canParallelize: true },
    ],
    parallelGroups: [],
    sourceRequirements: [{ source: 'ESI', capabilities: [] }],
    authRequirements: 'none',
    cacheStrategy: [],
    costEstimate: { totalLatencyMs: 50, esiCallCount: 2, parallelLatencyMs: 25 },
    createdAt: new Date(),
  } as unknown as ExecutionPlan;
}

describe('executor tracing', () => {
  afterEach(() => {
    setTracerProvider(undefined as never);
  });

  describe('createTracedExecutor', () => {
    it('returns the original executor when no provider is set', () => {
      const executor = createMockExecutor();
      const result = createTracedExecutor(executor);
      expect(result).toBe(executor);
    });

    it('wraps the executor when a provider is set', () => {
      const { tracer } = createMockTracer();
      const provider = createMockProvider(tracer);
      setTracerProvider(provider);

      const executor = createMockExecutor();
      const result = createTracedExecutor(executor);
      expect(result).not.toBe(executor);
    });
  });

  describe('traced execute', () => {
    it('creates a pipeline.execute span with step and source counts', async () => {
      const { tracer, span } = createMockTracer();
      const provider = createMockProvider(tracer);
      setTracerProvider(provider);

      const executor = createMockExecutor();
      const traced = createTracedExecutor(executor);
      const plan = createMockPlan();

      await traced.execute(plan, new Map());

      expect(tracer.startSpan).toHaveBeenCalledWith('pipeline.execute', {
        attributes: {
          'pipeline.steps': 2,
          'pipeline.sources': 1,
        },
      });
      expect(span.end).toHaveBeenCalled();
    });

    it('sets cache and duration attributes on success with status code 0', async () => {
      const { tracer, span } = createMockTracer();
      const provider = createMockProvider(tracer);
      setTracerProvider(provider);

      const executor = createMockExecutor();
      const traced = createTracedExecutor(executor);
      const plan = createMockPlan();

      await traced.execute(plan, new Map());

      expect(span.setAttribute).toHaveBeenCalledWith('pipeline.cacheHits', 2);
      expect(span.setAttribute).toHaveBeenCalledWith('pipeline.cacheMisses', 3);
      expect(span.setAttribute).toHaveBeenCalledWith('pipeline.durationMs', 100);
      expect(span.setStatus).toHaveBeenCalledWith({ code: 0 });
      expect(span.end).toHaveBeenCalled();
    });

    it('sets error status on failure and re-throws', async () => {
      const { tracer, span } = createMockTracer();
      const provider = createMockProvider(tracer);
      setTracerProvider(provider);

      const error = new Error('execution failed');
      const executor = createMockExecutor({
        execute: vi.fn().mockRejectedValue(error),
      });
      const traced = createTracedExecutor(executor);
      const plan = createMockPlan();

      await expect(traced.execute(plan, new Map())).rejects.toThrow('execution failed');

      expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: 'execution failed' });
      expect(span.end).toHaveBeenCalled();
    });
  });

  describe('traceStep', () => {
    it('creates a step.execute span with step attributes', () => {
      const { tracer, span } = createMockTracer();

      const result = traceStep(tracer, 'step-1', 'market.orders', 'ESI');

      expect(tracer.startSpan).toHaveBeenCalledWith('step.execute', {
        attributes: {
          'step.id': 'step-1',
          'step.capability': 'market.orders',
          'step.source': 'ESI',
        },
      });
      expect(result).toBe(span);
    });
  });

  describe('traceParallelGroup', () => {
    it('creates a parallel.group span with group attributes', () => {
      const { tracer, span } = createMockTracer();

      const result = traceParallelGroup(tracer, 0, ['s1', 's2', 's3']);

      expect(tracer.startSpan).toHaveBeenCalledWith('parallel.group', {
        attributes: {
          'group.index': 0,
          'group.size': 3,
          'group.steps': 's1,s2,s3',
        },
      });
      expect(result).toBe(span);
    });
  });

  describe('traceProvenance', () => {
    it('sets provenance attributes on the span', () => {
      const span = createMockSpan();
      const provenance: ProvenanceRecord = {
        source: 'ESI',
        capability: { id: 'market.orders' },
        capabilityVersion: 1,
        cached: true,
        upstream: [],
      } as unknown as ProvenanceRecord;

      traceProvenance(span as never, provenance);

      expect(span.setAttribute).toHaveBeenCalledWith('provenance.source', 'ESI');
      expect(span.setAttribute).toHaveBeenCalledWith('provenance.capability', 'market.orders');
      expect(span.setAttribute).toHaveBeenCalledWith('provenance.cached', true);
    });
  });
});
