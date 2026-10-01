import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  type GraphQLFieldConfig,
  type GraphQLFieldConfigMap,
} from 'graphql';
import type {
  PipelineDefinition,
  CapabilityCatalog,
  ExecutionPlan,
  ProvenanceRecord,
} from '@eve-fabric/domain';
import { buildOutputType } from './type-builder.js';
import { buildInputType } from './input-builder.js';
import { DataProvenanceType } from './provenance-field.js';
import { analyzeSelectionSet } from './selection-analyzer.js';
import { mapErrorToGraphQL } from './error-mapper.js';

export interface ExecutorLike {
  execute(
    plan: ExecutionPlan,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<{
    readonly outputs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
    readonly provenance: ReadonlyMap<string, ProvenanceRecord>;
  }>;
}

export type PlanPruner = (
  plan: ExecutionPlan,
  pipeline: PipelineDefinition,
  requestedOutputs: ReadonlySet<string>,
) => ExecutionPlan;

export interface PipelineRegistration {
  readonly pipeline: PipelineDefinition;
  readonly catalog: CapabilityCatalog;
  readonly plan?: ExecutionPlan;
  readonly executor?: ExecutorLike;
  readonly pruner?: PlanPruner;
  readonly includeProvenance?: boolean;
}

function pipelineToFieldName(name: string): string {
  const words = name.split(/[-_.\s]+/);
  if (words.length === 0) return 'query';
  const first = words[0]!.toLowerCase();
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return first + rest.join('');
}

function buildResolve(
  reg: PipelineRegistration,
):
  | ((
      _source: unknown,
      args: Record<string, unknown>,
      _ctx: unknown,
      info: unknown,
    ) => Promise<unknown>)
  | undefined {
  const { pipeline, plan, executor, pruner, includeProvenance } = reg;
  if (plan === undefined || executor === undefined) return undefined;

  return async (_source, args, _ctx, info) => {
    try {
      const inputValues = (args['input'] ?? {}) as Record<string, unknown>;
      const inputMap = new Map<string, unknown>();
      for (const [key, value] of Object.entries(inputValues)) {
        inputMap.set(key, value);
      }

      let effectivePlan = plan;
      if (pruner !== undefined && info !== undefined) {
        const requestedFields = analyzeSelectionSet(info as never);
        effectivePlan = pruner(plan, pipeline, requestedFields);
      }

      const result = await executor.execute(effectivePlan, inputMap);

      const output: Record<string, unknown> = {};
      for (const pipelineOutput of pipeline.outputs) {
        // A pipeline output names a node and the port it reads: "nodeId.port".
        const dotIndex = pipelineOutput.source.indexOf('.');
        const nodeId =
          dotIndex >= 0 ? pipelineOutput.source.slice(0, dotIndex) : pipelineOutput.source;
        const step = result.outputs.get(nodeId);
        output[pipelineOutput.name] =
          dotIndex >= 0 ? step?.[pipelineOutput.source.slice(dotIndex + 1)] : step;
      }

      if (includeProvenance === true) {
        const entries: Record<string, unknown>[] = [];
        for (const [, prov] of result.provenance) {
          entries.push({
            source: prov.source,
            capability: prov.capability.id,
            version: prov.capabilityVersion,
            retrievedAt: prov.retrievedAt?.toISOString(),
            calculatedAt: prov.calculatedAt?.toISOString(),
            cached: prov.cached,
          });
        }
        output['_provenance'] = entries;
      }

      return output;
    } catch (error) {
      throw mapErrorToGraphQL(error);
    }
  };
}

export function buildQueryField(reg: PipelineRegistration): GraphQLFieldConfig<unknown, unknown> {
  const { pipeline, catalog, includeProvenance } = reg;
  const outputType = buildOutputType({ pipeline, catalog });
  const inputType = buildInputType({ pipeline, catalog });

  if (includeProvenance === true) {
    const fields = outputType.getFields();
    if (fields['_provenance'] === undefined) {
      (outputType as unknown as { _fields: Record<string, unknown> })._fields['_provenance'] = {
        type: new GraphQLList(DataProvenanceType),
        description: 'Data provenance for this result',
        isDeprecated: false,
        deprecationReason: null,
        extensions: {},
        astNode: undefined,
      };
    }
  }

  const hasRealInputs = pipeline.inputs.length > 0;
  const resolve = buildResolve(reg);

  return {
    type: new GraphQLNonNull(outputType),
    description: pipeline.description,
    args: hasRealInputs ? { input: { type: new GraphQLNonNull(inputType) } } : {},
    resolve: resolve ?? (() => ({})),
  };
}

export function buildSchema(pipelines: readonly PipelineRegistration[]): GraphQLSchema {
  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {};

  for (const reg of pipelines) {
    const fieldName = pipelineToFieldName(reg.pipeline.name);
    queryFields[fieldName] = buildQueryField(reg);
  }

  if (Object.keys(queryFields).length === 0) {
    queryFields['_empty'] = {
      type: new GraphQLObjectType({
        name: 'Empty',
        fields: { _: { type: GraphQLString } },
      }),
      resolve: () => ({}),
    };
  }

  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: queryFields,
  });

  return new GraphQLSchema({ query: queryType });
}
