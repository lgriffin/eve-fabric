import { z } from 'zod';
import type {
  ReferenceTypeDefinition,
  SemanticTypeDefinition,
  SemanticTypeId,
} from './semantic-type.js';

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

export type TypeCheck = { readonly ok: true } | { readonly ok: false; readonly message: string };

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
    const type = this.types.get(id);
    if (!type) throw new UnknownSemanticTypeError(id);
    return type;
  }

  has(id: SemanticTypeId | string): boolean {
    return this.types.has(id);
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
    return result.success ? { ok: true } : { ok: false, message: describeIssues(result.error) };
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

  /** The record type a reference resolves to, or the type itself. */
  entityOf(id: SemanticTypeId | string): SemanticTypeId {
    const type = this.get(id);
    return type.kind === 'reference' ? type.entity : type.id;
  }
}
