import type {
  ListTypeDefinition,
  RecordField,
  RecordTypeDefinition,
  ReferenceResolver,
  ReferenceTypeDefinition,
  SemanticTypeDefinition,
  SemanticTypeId,
  ValueTypeDefinition,
} from '@eve-fabric/domain';
import { idSchema, semanticTypeId } from '@eve-fabric/domain';
import type { z } from 'zod';

/** A type named by its id, or the definition itself. */
export type TypeRef = string | SemanticTypeDefinition;

export function typeIdOf(type: TypeRef): SemanticTypeId {
  return typeof type === 'string' ? semanticTypeId(type) : type.id;
}

interface TypeConfigBase {
  readonly id: string;
  readonly description: string;
  /** For grouping in a palette. Defaults to the id's second segment. */
  readonly category?: string | undefined;
}

export interface ValueTypeConfig<T> extends TypeConfigBase {
  readonly kind: 'value';
  readonly schema: z.ZodType<T>;
}

export interface ReferenceTypeConfig extends TypeConfigBase {
  readonly kind: 'reference';
  /** The record type the reference resolves to, by id (the record usually names this reference back). */
  readonly entity: string;
  /** The capability that resolves it. A capability that emits a reference without one will not register. */
  readonly resolver?: ReferenceResolver | undefined;
  /** What a reference looks like. Defaults to a positive integer id. */
  readonly schema?: z.ZodType<unknown> | undefined;
}

export type FieldConfig =
  | TypeRef
  | {
      readonly type: TypeRef;
      readonly description?: string | undefined;
      readonly optional?: boolean | undefined;
    };

export interface RecordTypeConfig extends TypeConfigBase {
  readonly kind: 'record';
  /** Each field is a semantic type, so a record can be followed field by field. */
  readonly fields: Readonly<Record<string, FieldConfig>>;
}

export type TypeConfig<T = unknown> = ValueTypeConfig<T> | ReferenceTypeConfig | RecordTypeConfig;

/** Definitions a type mentions as objects, so a pack can collect them. */
const mentioned = new WeakMap<SemanticTypeDefinition, readonly SemanticTypeDefinition[]>();

/** The definitions this one mentions by object (record fields, list items). */
export function typesMentionedBy(type: SemanticTypeDefinition): readonly SemanticTypeDefinition[] {
  return mentioned.get(type) ?? [];
}

function categoryOf(config: TypeConfigBase): string {
  return config.category ?? config.id.split('.')[1] ?? 'general';
}

function toField(config: FieldConfig): RecordField {
  if (typeof config === 'string' || 'kind' in config) {
    return { type: typeIdOf(config), optional: false };
  }
  return {
    type: typeIdOf(config.type),
    description: config.description,
    optional: config.optional ?? false,
  };
}

function fieldDefinitions(fields: Readonly<Record<string, FieldConfig>>): SemanticTypeDefinition[] {
  const found: SemanticTypeDefinition[] = [];
  for (const config of Object.values(fields)) {
    const ref = typeof config === 'string' || 'kind' in config ? config : config.type;
    if (typeof ref !== 'string') found.push(ref);
  }
  return found;
}

/**
 * A semantic type: a value with a schema, a reference that names its
 * resolver, or a record whose fields are semantic types.
 */
export function defineType<T>(config: ValueTypeConfig<T>): ValueTypeDefinition<T>;
export function defineType(config: ReferenceTypeConfig): ReferenceTypeDefinition;
export function defineType(config: RecordTypeConfig): RecordTypeDefinition;
export function defineType<T>(config: TypeConfig<T>): SemanticTypeDefinition {
  const base = {
    id: semanticTypeId(config.id),
    description: config.description,
    category: categoryOf(config),
  };
  switch (config.kind) {
    case 'value':
      return { ...base, kind: 'value', schema: config.schema };
    case 'reference':
      return {
        ...base,
        kind: 'reference',
        entity: semanticTypeId(config.entity),
        resolver: config.resolver,
        schema: config.schema ?? idSchema,
      };
    case 'record': {
      const fields = new Map<string, RecordField>();
      for (const [name, field] of Object.entries(config.fields)) fields.set(name, toField(field));
      const record: RecordTypeDefinition = { ...base, kind: 'record', fields };
      mentioned.set(record, fieldDefinitions(config.fields));
      return record;
    }
  }
}

const lists = new Map<string, ListTypeDefinition>();

/** A list of a type. Its id is the item's id with `.collection` appended. */
export function listOf(item: TypeRef): ListTypeDefinition {
  const itemId = typeIdOf(item);
  const known = lists.get(itemId);
  if (known !== undefined) {
    // Called first with the id, then with the definition: record it now.
    if (typeof item !== 'string' && typesMentionedBy(known).length === 0)
      mentioned.set(known, [item]);
    return known;
  }
  const list: ListTypeDefinition = {
    kind: 'list',
    id: semanticTypeId(`${itemId as string}.collection`),
    description: `A list of ${itemId as string}`,
    category: itemId.split('.')[1] ?? 'general',
    item: itemId,
  };
  lists.set(itemId, list);
  if (typeof item !== 'string') mentioned.set(list, [item]);
  return list;
}
