import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { pipelineDefinitionSchema, type PipelineDefinition } from '@eve-fabric/core';
import { scanForSecrets } from '@eve-fabric/schema-package';
import { isRange } from './range.js';

/** The package format this module reads and writes. */
export const WEAVE_FORMAT = 2;

const attachSchema = z.object({
  on: z.string().min(1),
  as: z.string().min(1),
  subject: z.string(),
});

const weaveBodySchema = z.object({
  format: z.literal(WEAVE_FORMAT),
  id: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/, 'Must be dot-notation'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be x.y.z'),
  name: z.string().min(1),
  description: z.string(),
  /** What it gives once added: where it hangs, what it takes, what it gives. */
  provides: z.object({
    attach: attachSchema.optional(),
    in: z.record(z.string(), z.string()),
    out: z.record(z.string(), z.string()),
  }),
  /** Each capability the pipeline runs, and the versions of it that will do. */
  requires: z.record(
    z.string(),
    z.string().refine(isRange, 'Must be a version range such as ^2.0.0'),
  ),
  /** The scopes the compiler computed for it, sorted. */
  scopes: z.array(z.string()),
  /** What it was compiled and checked against when it was exported. */
  verifiedAgainst: z.object({
    esiCompatibilityDate: z.string().optional(),
    sdeBuild: z.string().optional(),
  }),
  pipeline: pipelineDefinitionSchema,
});

const weaveFileSchema = weaveBodySchema.extend({
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/, 'Must be sha256:<hex>'),
});

/** A weave's content, everything the digest covers. */
export type WeaveBody = Omit<z.infer<typeof weaveBodySchema>, 'pipeline'> & {
  readonly pipeline: PipelineDefinition;
};

/** Package format v2: a pipeline as data, what it needs, and a digest over all of it. */
export type WeaveFile = WeaveBody & { readonly digest: string };

/** The file could not be read as a weave. */
export class WeaveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeaveFormatError';
  }
}

/** The content does not match its digest: changed after it was exported. */
export class WeaveDigestError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`The weave's digest is ${expected} but its content hashes to ${actual}`);
    this.name = 'WeaveDigestError';
  }
}

/** Something in the weave looks like a credential. A weave is shared, so it never carries one. */
export class WeaveSecretError extends Error {
  constructor(readonly paths: readonly string[]) {
    super(`The weave looks like it carries a secret at ${paths.join(', ')}`);
    this.name = 'WeaveSecretError';
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      const field = (value as Record<string, unknown>)[key];
      if (field !== undefined) sorted[key] = canonical(field);
    }
    return sorted;
  }
  return value;
}

/** The canonical form: keys sorted, nothing undefined. The digest is over this. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function digestOf(body: WeaveBody): string {
  // Everything but the digest itself.
  const content: Record<string, unknown> = { ...body };
  delete content['digest'];
  return `sha256:${createHash('sha256').update(canonicalJson(content)).digest('hex')}`;
}

function checkSecrets(body: WeaveBody): void {
  const findings = scanForSecrets(body);
  if (findings.length > 0) throw new WeaveSecretError(findings.map((f) => f.fieldPath));
}

function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

/** Seals a weave: normalises it, refuses one that carries a secret, and adds its digest. */
export function sealWeave(body: WeaveBody): WeaveFile {
  const parsed = weaveBodySchema.safeParse(body);
  if (!parsed.success) throw new WeaveFormatError(describeIssues(parsed.error));
  const normal = parsed.data as unknown as WeaveBody;
  checkSecrets(normal);
  return { ...normal, digest: digestOf(normal) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Paths in `given` that reading it dropped: fields the format does not have. */
function extraFields(given: unknown, read: unknown, path = ''): string[] {
  const at = (key: string | number) => (path === '' ? String(key) : `${path}.${key}`);
  if (Array.isArray(given) && Array.isArray(read)) {
    return given.flatMap((item, i) => extraFields(item, read[i], at(i)));
  }
  if (!isRecord(given) || !isRecord(read)) return [];
  return Object.keys(given).flatMap((key) =>
    key in read ? extraFields(given[key], read[key], at(key)) : [at(key)],
  );
}

/**
 * Reads a weave from parsed data, and checks its shape, its digest and that
 * it holds no secret. A field the format does not have is refused rather
 * than dropped, so nothing in the file escapes the digest or the scan.
 */
export function readWeave(data: unknown): WeaveFile {
  const parsed = weaveFileSchema.safeParse(data);
  if (!parsed.success) throw new WeaveFormatError(describeIssues(parsed.error));
  const extra = extraFields(data, parsed.data);
  if (extra.length > 0) {
    throw new WeaveFormatError(`${extra.join(', ')}: not a field of a weave`);
  }
  const file = parsed.data as unknown as WeaveFile;
  const actual = digestOf(file);
  if (actual !== file.digest) throw new WeaveDigestError(file.digest, actual);
  checkSecrets(file);
  return file;
}

const ORDER = [
  'format',
  'id',
  'version',
  'name',
  'description',
  'provides',
  'requires',
  'scopes',
  'verifiedAgainst',
  'pipeline',
  'digest',
] as const;

/** The weave as YAML, the same bytes for the same weave wherever it is written. */
export function weaveToYaml(file: WeaveFile): string {
  const ordered: Record<string, unknown> = {};
  for (const key of ORDER) ordered[key] = canonical(file[key]);
  return stringifyYaml(ordered, { lineWidth: 0 });
}

export function weaveFromYaml(text: string): WeaveFile {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    throw new WeaveFormatError(`Not YAML: ${(error as Error).message}`);
  }
  return readWeave(data);
}
