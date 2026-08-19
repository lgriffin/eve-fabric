import { z } from 'zod';

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type SemanticTypeId = Brand<string, 'SemanticTypeId'>;

const SEMANTIC_TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export function semanticTypeId(id: string): SemanticTypeId {
  if (!SEMANTIC_TYPE_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid semantic type ID "${id}": must be lowercase dot-notation (e.g. "eve.region.reference")`,
    );
  }
  return id as SemanticTypeId;
}

export interface SemanticTypeDefinition<T = unknown> {
  readonly id: SemanticTypeId;
  readonly description: string;
  readonly schema: z.ZodType<T>;
  readonly category: string;
}

export function createSemanticType<T>(config: {
  id: string;
  description: string;
  schema: z.ZodType<T>;
  category: string;
}): SemanticTypeDefinition<T> {
  return {
    id: semanticTypeId(config.id),
    description: config.description,
    schema: config.schema,
    category: config.category,
  };
}
