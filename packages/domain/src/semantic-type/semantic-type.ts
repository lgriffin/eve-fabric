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

/**
 * What a semantic type is:
 *
 * - `value`: a scalar with a schema (an ISK amount, a jump count)
 * - `reference`: an id naming a record held elsewhere, with the capability
 *   that resolves it (an ESI `location_id` to the SDE station behind it)
 * - `record`: an object whose fields are themselves semantic types
 * - `list`: a list of another type
 */
export type SemanticTypeKind = 'value' | 'reference' | 'record' | 'list';

/** The capability that turns a reference into its record, and the ports it uses. */
export interface ReferenceResolver {
  readonly capability: string;
  /** The input port taking the reference. */
  readonly input: string;
  /** The output port giving the record. */
  readonly output: string;
}

export interface RecordField {
  readonly type: SemanticTypeId;
  readonly description?: string | undefined;
  /** An optional field may be absent or null. */
  readonly optional: boolean;
}

interface SemanticTypeBase {
  readonly id: SemanticTypeId;
  readonly description: string;
  readonly category: string;
}

export interface ValueTypeDefinition<T = unknown> extends SemanticTypeBase {
  readonly kind: 'value';
  readonly schema: z.ZodType<T>;
}

export interface ReferenceTypeDefinition extends SemanticTypeBase {
  readonly kind: 'reference';
  /** What a reference value looks like; a positive integer id unless stated. */
  readonly schema: z.ZodType<unknown>;
  /** The record type the reference resolves to. */
  readonly entity: SemanticTypeId;
  /**
   * Required for any reference a registered capability emits: the catalog
   * refuses a capability whose output carries a reference no one can follow.
   */
  readonly resolver?: ReferenceResolver | undefined;
}

export interface RecordTypeDefinition extends SemanticTypeBase {
  readonly kind: 'record';
  readonly fields: ReadonlyMap<string, RecordField>;
}

export interface ListTypeDefinition extends SemanticTypeBase {
  readonly kind: 'list';
  readonly item: SemanticTypeId;
}

export type SemanticTypeDefinition =
  ValueTypeDefinition | ReferenceTypeDefinition | RecordTypeDefinition | ListTypeDefinition;

/** A value type from a schema. */
export function createSemanticType<T>(config: {
  id: string;
  description: string;
  schema: z.ZodType<T>;
  category: string;
}): ValueTypeDefinition<T> {
  return {
    kind: 'value',
    id: semanticTypeId(config.id),
    description: config.description,
    schema: config.schema,
    category: config.category,
  };
}

/** The schema of an id: a positive integer. */
export const idSchema = z.number().int().positive();
