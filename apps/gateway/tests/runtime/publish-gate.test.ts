import { describe, it, expect } from 'vitest';
import type { PipelineDefinition, SemanticTypeId } from '@eve-fabric/domain';
import { GatewayRuntime } from '../../src/runtime.js';

function lookup(id: string, wired: boolean): PipelineDefinition {
  return {
    id,
    version: 1,
    name: id,
    inputs: [
      { name: 'query', semanticType: 'eve.type.reference' as SemanticTypeId, required: true },
    ],
    nodes: [{ id: 'resolve', capability: { id: 'universe.resolve.type' as never } }],
    edges: wired ? [{ from: 'input.query', to: 'resolve.query' }] : [],
    outputs: [{ name: 'type', source: 'resolve.type' }],
  };
}

describe('GatewayRuntime publishing', () => {
  it('publishes only saved pipelines that compile', async () => {
    const runtime = new GatewayRuntime();
    await runtime.pipelineRepository.save(lookup('works', true));
    await runtime.pipelineRepository.save(lookup('unwired', false));
    await runtime.rebuildRegistrations();

    const fields = Object.keys(runtime.graphqlSchema.getQueryType()?.getFields() ?? {});
    expect(fields.some((f) => f.toLowerCase().includes('works'))).toBe(true);
    expect(fields.some((f) => f.toLowerCase().includes('unwired'))).toBe(false);
    // The draft that does not compile stays saved.
    expect((await runtime.pipelineRepository.list()).map((p) => p.id)).toContain('unwired');
  });
});
