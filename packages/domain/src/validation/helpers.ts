import { z } from 'zod';

export const dotNotationId = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/,
    'Must be dot-notation format (e.g., "market.orders")',
  );

export const positiveInt = z.number().int().positive();

export const nonNegativeInt = z.number().int().nonnegative();

export const semver = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version format (e.g., "1.0.0")');

export const portReference = z.string().regex(
  // A port may be followed by record fields: "cheapest.cheapest.location_id".
  /^[a-zA-Z][a-zA-Z0-9-]*\.[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z_]\w*)*$/,
  'Must be port reference format (e.g., "nodeId.portName" or "nodeId.portName.field")',
);

export function parsePortReference(ref: string): { source: string; port: string } {
  const dotIndex = ref.indexOf('.');
  if (dotIndex === -1) throw new Error(`Invalid port reference: ${ref}`);
  return {
    source: ref.substring(0, dotIndex),
    port: ref.substring(dotIndex + 1),
  };
}

export type ValidationResult<T> =
  { success: true; data: T } | { success: false; errors: ValidationError[] };

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export function validate<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.map(String),
      message: issue.message,
      code: issue.code,
    })),
  };
}
