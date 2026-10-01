import type { ExecutionPlan, PipelineDefinition, SemanticTypeId } from '@eve-fabric/domain';
import { compile } from '@eve-fabric/compiler';
import type { GatewayRuntime } from '../../src/runtime.js';

export const capabilityId = 'universe.resolve.type';

/** Compiles a one-node pipeline over `id` whose `query` port is a pipeline input. */
export function compileOrThrowFixture(runtime: GatewayRuntime, id: string): ExecutionPlan {
  const pipeline: PipelineDefinition = {
    id: 'sde-load-probe',
    version: 1,
    name: 'SDE load probe',
    inputs: [
      { name: 'query', semanticType: 'eve.type.reference' as SemanticTypeId, required: true },
    ],
    nodes: [{ id: 'resolve', capability: { id: id as never } }],
    edges: [{ from: 'input.query', to: 'resolve.query' }],
    outputs: [{ name: 'type', source: 'resolve.type' }],
  };
  const result = compile(pipeline, runtime.catalog);
  if (!result.success || result.plan === undefined) {
    throw new Error(`fixture failed to compile: ${JSON.stringify(result.diagnostics)}`);
  }
  return result.plan as unknown as ExecutionPlan;
}
