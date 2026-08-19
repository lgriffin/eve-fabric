import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  type GraphQLOutputType,
  type GraphQLFieldConfigMap,
} from 'graphql';
import type { PipelineDefinition, CapabilityCatalog, SemanticPort } from '@eve-fabric/domain';
import { getScalarForSemanticType } from './scalars.js';

function toPascalCase(s: string): string {
  return s
    .split(/[-_.\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function resolveOutputType(port: SemanticPort): GraphQLOutputType {
  const scalar = getScalarForSemanticType(port.semanticType);
  if (scalar !== undefined) return scalar;

  if (port.semanticType.endsWith('.collection')) {
    const elementTypeId = port.semanticType.replace(/\.collection$/, '');
    const elementScalar = getScalarForSemanticType(elementTypeId);
    const elementType = elementScalar ?? GraphQLString;
    return new GraphQLList(new GraphQLNonNull(elementType));
  }

  return GraphQLString;
}

export interface TypeBuilderConfig {
  readonly pipeline: PipelineDefinition;
  readonly catalog: CapabilityCatalog;
}

export function buildOutputType(config: TypeBuilderConfig): GraphQLObjectType {
  const { pipeline, catalog } = config;
  const typeName = toPascalCase(pipeline.name);

  const fields: GraphQLFieldConfigMap<unknown, unknown> = {};

  for (const output of pipeline.outputs) {
    const dotIndex = output.source.indexOf('.');
    if (dotIndex < 0) continue;

    const nodeId = output.source.slice(0, dotIndex);
    const portName = output.source.slice(dotIndex + 1);

    const node = pipeline.nodes.find((n) => n.id === nodeId);
    if (node === undefined) continue;

    let capability;
    try {
      capability = catalog.get(node.capability.id, node.capability.version);
    } catch {
      continue;
    }

    const port = capability.outputs.get(portName);
    if (port === undefined) {
      fields[output.name] = { type: GraphQLString };
      continue;
    }

    const gqlType = resolveOutputType(port);
    fields[output.name] = {
      type: port.required ? new GraphQLNonNull(gqlType) : gqlType,
      description: port.description,
    };
  }

  if (Object.keys(fields).length === 0) {
    fields['_empty'] = { type: GraphQLString };
  }

  return new GraphQLObjectType({
    name: typeName,
    fields,
  });
}
