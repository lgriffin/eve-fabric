import {
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLNonNull,
  type GraphQLInputType,
  type GraphQLInputFieldConfigMap,
} from 'graphql';
import type { PipelineDefinition, CapabilityCatalog } from '@eve-fabric/domain';
import { getScalarForSemanticType } from './scalars.js';

function toPascalCase(s: string): string {
  return s
    .split(/[-_.\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function resolveInputType(semanticTypeId: string): GraphQLInputType {
  return getScalarForSemanticType(semanticTypeId) ?? GraphQLString;
}

export interface InputBuilderConfig {
  readonly pipeline: PipelineDefinition;
  readonly catalog: CapabilityCatalog;
}

export function buildInputType(config: InputBuilderConfig): GraphQLInputObjectType {
  const { pipeline } = config;
  const typeName = `${toPascalCase(pipeline.name)}Input`;

  const fields: GraphQLInputFieldConfigMap = {};

  for (const input of pipeline.inputs) {
    const gqlType = resolveInputType(input.semanticType);
    fields[input.name] = {
      type: input.required ? new GraphQLNonNull(gqlType) : gqlType,
      description: input.description,
    };
  }

  if (Object.keys(fields).length === 0) {
    fields['_empty'] = { type: GraphQLString };
  }

  return new GraphQLInputObjectType({
    name: typeName,
    fields,
  });
}
