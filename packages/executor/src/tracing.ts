import type { ExecutionPlan, ProvenanceRecord } from '@eve-fabric/domain';
import type { ExecuteOptions, Executor, ExecutionResult } from './executor.js';

interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

interface Tracer {
  startSpan(
    name: string,
    options?: { attributes?: Record<string, string | number | boolean> },
  ): Span;
}

interface TracerProvider {
  getTracer(name: string, version?: string): Tracer;
}

let tracerProvider: TracerProvider | undefined;

export function setTracerProvider(provider: TracerProvider): void {
  tracerProvider = provider;
}

function getTracer(): Tracer | undefined {
  return tracerProvider?.getTracer('@eve-fabric/executor', '0.0.0');
}

export function createTracedExecutor(executor: Executor): Executor {
  const tracer = getTracer();
  if (tracer === undefined) {
    return executor;
  }

  const original = executor.execute.bind(executor);

  const traced = Object.create(executor) as Executor;
  (traced as { execute: typeof original }).execute = async (
    plan: ExecutionPlan,
    inputs: ReadonlyMap<string, unknown>,
    options?: ExecuteOptions,
  ): Promise<ExecutionResult> => {
    const span = tracer.startSpan('pipeline.execute', {
      attributes: {
        'pipeline.steps': plan.steps.length,
        'pipeline.sources': plan.sourceRequirements.length,
      },
    });

    try {
      const result = await original(plan, inputs, options);

      span.setAttribute('pipeline.cacheHits', result.metrics.cacheHits);
      span.setAttribute('pipeline.cacheMisses', result.metrics.cacheMisses);
      span.setAttribute('pipeline.durationMs', result.metrics.totalDurationMs);
      span.setStatus({ code: 0 });
      span.end();

      return result;
    } catch (err) {
      span.setStatus({ code: 2, message: err instanceof Error ? err.message : 'unknown' });
      span.end();
      throw err;
    }
  };

  return traced;
}

export function traceStep(
  tracer: Tracer,
  stepId: string,
  capabilityId: string,
  source: string,
): Span {
  return tracer.startSpan(`step.execute`, {
    attributes: {
      'step.id': stepId,
      'step.capability': capabilityId,
      'step.source': source,
    },
  });
}

export function traceParallelGroup(
  tracer: Tracer,
  groupIndex: number,
  stepIds: readonly string[],
): Span {
  return tracer.startSpan(`parallel.group`, {
    attributes: {
      'group.index': groupIndex,
      'group.size': stepIds.length,
      'group.steps': stepIds.join(','),
    },
  });
}

export function traceProvenance(span: Span, provenance: ProvenanceRecord): void {
  span.setAttribute('provenance.source', provenance.source);
  span.setAttribute('provenance.capability', provenance.capability.id);
  span.setAttribute('provenance.cached', provenance.cached);
}
