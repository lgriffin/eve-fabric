import type { CapabilityDefinition, SourceAdapterResult } from '@eve-fabric/domain';
import type { EsiAdapter } from './esi-adapter.js';

interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

interface Tracer {
  startSpan(name: string, options?: { attributes?: Record<string, string | number | boolean> }): Span;
}

interface TracerProvider {
  getTracer(name: string, version?: string): Tracer;
}

let tracerProvider: TracerProvider | undefined;

export function setEsiTracerProvider(provider: TracerProvider): void {
  tracerProvider = provider;
}

export function createTracedEsiAdapter(adapter: EsiAdapter): EsiAdapter {
  const tracer = tracerProvider?.getTracer('@eve-fabric/esi-adapter', '0.0.0');
  if (tracer === undefined) {
    return adapter;
  }

  const original = adapter.execute.bind(adapter);

  const traced = Object.create(adapter) as EsiAdapter;
  (traced as { execute: typeof original }).execute = async (
    capability: CapabilityDefinition,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> => {
    const span = tracer.startSpan('esi.call', {
      attributes: {
        'esi.capability': capability.id,
        'esi.source': 'ESI',
      },
    });

    try {
      const result = await original(capability, inputs);

      span.setAttribute('esi.cached', result.provenance.cached);
      span.setAttribute('esi.capability.version', capability.version);
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
