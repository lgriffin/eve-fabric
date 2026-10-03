import type { SemanticTypeRegistry } from '@eve-fabric/core';
import type { z } from 'zod';

/** The TypeScript type a value of a semantic type has at a weave's edge. */
export function tsTypeOf(typeId: string, types: SemanticTypeRegistry): string {
  if (!types.has(typeId)) return 'unknown';
  const type = types.get(typeId);
  switch (type.kind) {
    case 'reference':
      // A reference is an id; the generated module takes ids, not names.
      return 'number';
    case 'value':
      return scalarOf(type.schema);
    case 'record':
      return 'Record<string, unknown>';
    case 'list':
      return `${tsTypeOf(type.item, types)}[]`;
  }
}

/** The scalar a Zod schema accepts, where it is one; anything else is unknown. */
function scalarOf(schema: z.ZodTypeAny): string {
  const def = (schema as { _def?: { typeName?: string } })._def;
  switch (def?.typeName) {
    case 'ZodNumber':
      return 'number';
    case 'ZodString':
      return 'string';
    case 'ZodBoolean':
      return 'boolean';
    default:
      return 'unknown';
  }
}
