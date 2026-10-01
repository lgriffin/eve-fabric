import { z } from 'zod';
import type {
  ListTypeDefinition,
  ReferenceTypeDefinition,
  SemanticTypeDefinition,
  SemanticTypeId,
} from './semantic-type.js';

const LIST_SUFFIX = '.collection';

/** A port or field names a semantic type the registry does not hold. */
export class UnknownSemanticTypeError extends Error {
  readonly typeId: string;

  constructor(typeId: string, where?: string) {
    const suffix = where === undefined ? '' : ` (${where})`;
    super(`Semantic type "${typeId}" is not registered${suffix}`);
    this.name = 'UnknownSemanticTypeError';
    this.typeId = typeId;
  }
}

/** A passing check carries the parsed value: an id sent as text arrives as a number. */
export type TypeCheck =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string };

/** A name a lookup port takes in place of a reference: non-empty text, trimmed. */
export const lookupNameSchema = z.string().trim().min(1);

/** The parts of a port a value is checked against. */
export interface CheckedPort {
  readonly semanticType: string;
  readonly acceptsName?: boolean | undefined;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ` : '') + issue.message)
    .join('; ');
}

/**
 * The semantic types a fabric knows. A record's schema is built from its
 * fields' types, so record and list schemas are derived here rather than
 * written by hand.
 */
export class SemanticTypeRegistry {
  private readonly types = new Map<string, SemanticTypeDefinition>();
  private readonly schemas = new Map<string, z.ZodType<unknown>>();

  register(type: SemanticTypeDefinition): void {
    const key = type.id as string;
    if (this.types.has(key)) {
      throw new Error(`Semantic type "${key}" is already registered`);
    }
    this.types.set(key, type);
  }

  get(id: SemanticTypeId | string): SemanticTypeDefinition {
    const type = this.types.get(id) ?? this.implicitList(id);
    if (!type) throw new UnknownSemanticTypeError(id);
    return type;
  }

  /** Whether the type was registered, not merely implied as a list of one that was. */
  hasRegistered(id: SemanticTypeId | string): boolean {
    return this.types.has(id);
  }

  has(id: SemanticTypeId | string): boolean {
    return this.types.has(id) || this.implicitList(id) !== undefined;
  }

  /**
   * `x.collection` is a list of `x` for every registered `x`, registered or
   * not: a per-item step's outputs are lists of whatever it gives.
   */
  private implicitList(id: string): ListTypeDefinition | undefined {
    if (!id.endsWith(LIST_SUFFIX)) return undefined;
    const item = id.slice(0, -LIST_SUFFIX.length);
    if (!this.has(item)) return undefined;
    return {
      kind: 'list',
      id: id as SemanticTypeId,
      description: `A list of ${item}`,
      category: item.split('.')[1] ?? 'general',
      item: item as SemanticTypeId,
    };
  }

  listByCategory(category: string): ReadonlyArray<SemanticTypeDefinition> {
    return [...this.types.values()].filter((t) => t.category === category);
  }

  list(): ReadonlyArray<SemanticTypeDefinition> {
    return [...this.types.values()];
  }

  isCompatible(sourceTypeId: SemanticTypeId, targetTypeId: SemanticTypeId): boolean {
    return (sourceTypeId as string) === (targetTypeId as string);
  }

  /** The schema values of this type must satisfy. */
  schemaOf(id: SemanticTypeId | string): z.ZodType<unknown> {
    const known = this.schemas.get(id);
    if (known !== undefined) return known;
    const type = this.get(id);
    let schema: z.ZodType<unknown>;
    switch (type.kind) {
      case 'value':
      case 'reference':
        schema = type.schema;
        break;
      case 'list':
        schema = z.array(z.lazy(() => this.schemaOf(type.item)));
        break;
      case 'record': {
        // Lazy fields: a record may name itself, or a type registered later.
        const shape: Record<string, z.ZodType<unknown>> = {};
        for (const [name, field] of type.fields) {
          const fieldSchema = z.lazy(() => this.schemaOf(field.type));
          shape[name] = field.optional ? fieldSchema.nullish() : fieldSchema;
        }
        schema = z.object(shape).passthrough();
        break;
      }
    }
    this.schemas.set(id, schema);
    return schema;
  }

  /** Checks a value against a type. */
  check(id: SemanticTypeId | string, value: unknown): TypeCheck {
    const result = this.schemaOf(id).safeParse(value);
    return result.success
      ? { ok: true, value: result.data }
      : { ok: false, message: describeIssues(result.error) };
  }

  /**
   * Checks a value for a port: a value of the port's type, or, for a port
   * that takes a name, a name. Unknown types are taken on trust.
   */
  checkPort(port: CheckedPort, value: unknown): TypeCheck {
    if (!this.has(port.semanticType)) return { ok: true, value };
    const typed = this.check(port.semanticType, value);
    if (typed.ok || port.acceptsName !== true) return typed;
    const named = lookupNameSchema.safeParse(value);
    return named.success ? { ok: true, value: named.data } : typed;
  }

  /**
   * Every reference type a value of this type carries: itself, its record
   * fields' and its list items', transitively.
   */
  referencesIn(id: SemanticTypeId | string): ReferenceTypeDefinition[] {
    const found = new Map<string, ReferenceTypeDefinition>();
    const seen = new Set<string>();
    const visit = (typeId: string): void => {
      if (seen.has(typeId)) return;
      seen.add(typeId);
      const type = this.get(typeId);
      if (type.kind === 'reference') found.set(typeId, type);
      else if (type.kind === 'list') visit(type.item);
      else if (type.kind === 'record') for (const field of type.fields.values()) visit(field.type);
    };
    visit(id);
    return [...found.values()];
  }

  /**
   * Throws {@link UnknownSemanticTypeError} unless the type, and every type
   * its record fields and list items name, is registered.
   */
  assertKnown(id: SemanticTypeId | string, where: string): void {
    const seen = new Set<string>();
    const visit = (typeId: string, path: string): void => {
      if (seen.has(typeId)) return;
      seen.add(typeId);
      const type = this.types.get(typeId) ?? this.implicitList(typeId);
      if (type === undefined) {
        throw new UnknownSemanticTypeError(typeId, path === '' ? where : `${where}, at ${path}`);
      }
      if (type.kind === 'list') visit(type.item, `${path}[]`);
      else if (type.kind === 'record') {
        for (const [name, field] of type.fields) {
          visit(field.type, path === '' ? name : `${path}.${name}`);
        }
      }
    };
    visit(id, '');
  }

  /** Removes a type; used to undo a pack install that was refused. */
  unregister(id: SemanticTypeId | string): void {
    this.types.delete(id);
    // Record and list schemas are built lazily over other types; rebuild them.
    this.schemas.clear();
  }

  /** The record type a reference resolves to, or the type itself. */
  entityOf(id: SemanticTypeId | string): SemanticTypeId {
    const type = this.get(id);
    return type.kind === 'reference' ? type.entity : type.id;
  }
}
