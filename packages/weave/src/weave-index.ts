import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { highestSatisfying } from './range.js';
import {
  WEAVE_FORMAT,
  WeaveFormatError,
  weaveFromYaml,
  weaveToYaml,
  type WeaveFile,
} from './weave-file.js';

const INDEX_FILE = 'index.json';
const WEAVE_FILE = 'weave.yaml';

const indexEntrySchema = z.object({
  /** Relative to the index, and inside it. */
  path: z
    .string()
    .min(1)
    .refine(
      (p) => !isAbsolute(p) && !p.split(/[\\/]/).includes('..'),
      'Must stay inside the index',
    ),
  digest: z.string(),
  name: z.string(),
  description: z.string(),
});

const indexDocumentSchema = z.object({
  format: z.literal(WEAVE_FORMAT),
  weaves: z.record(z.string(), z.record(z.string(), indexEntrySchema)),
});

/** One weave version, as the index lists it. */
export type IndexEntry = z.infer<typeof indexEntrySchema>;

/** The generated index.json: every weave id, every version of it. */
export type IndexDocument = z.infer<typeof indexDocumentSchema>;

/** Where weaves are found by id and version range. */
export interface WeaveIndex {
  /** `id@range`, or a bare id for the newest. */
  resolve(ref: string): Promise<WeaveFile>;
}

/** No weave in the index answers the reference. */
export class WeaveNotFoundError extends Error {
  constructor(readonly ref: string) {
    super(`No weave in the index matches "${ref}"`);
    this.name = 'WeaveNotFoundError';
  }
}

function splitRef(ref: string): { readonly id: string; readonly range: string } {
  const at = ref.indexOf('@');
  return at === -1 ? { id: ref, range: '*' } : { id: ref.slice(0, at), range: ref.slice(at + 1) };
}

async function readIndex(root: string): Promise<IndexDocument> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(join(root, INDEX_FILE), 'utf8'));
  } catch (error) {
    throw new WeaveFormatError(`${INDEX_FILE} is not JSON: ${(error as Error).message}`);
  }
  const parsed = indexDocumentSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new WeaveFormatError(`${INDEX_FILE} is not a weave index: ${issues.join('; ')}`);
  }
  return parsed.data;
}

/** The entry's file, refused if it (or a link on the way) leads out of the index. */
async function inside(root: string, path: string): Promise<string> {
  const base = await realpath(root);
  const file = await realpath(join(base, path));
  const rel = relative(base, file);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new WeaveFormatError(`${path} leads outside the index`);
  }
  return file;
}

/** A directory of weaves, such as a git checkout: one directory per weave, one index.json. */
export function directoryIndex(root: string): WeaveIndex {
  return {
    async resolve(ref) {
      const { id, range } = splitRef(ref);
      const versions = (await readIndex(root)).weaves[id] ?? {};
      const version = highestSatisfying(Object.keys(versions), range);
      if (version === undefined) throw new WeaveNotFoundError(ref);
      const entry = versions[version]!;
      const file = weaveFromYaml(await readFile(await inside(root, entry.path), 'utf8'));
      // The index and the file must agree on what was published.
      if (file.digest !== entry.digest || file.id !== id || file.version !== version) {
        throw new WeaveNotFoundError(`${ref} (the index and ${entry.path} disagree)`);
      }
      return file;
    },
  };
}

const run = promisify(execFile);

/** A git repository used as the index: cloned once, then read as a directory. */
export async function gitIndex(url: string, ref?: string): Promise<WeaveIndex> {
  const dir = await mkdtemp(join(tmpdir(), 'weaves-'));
  const branch = ref === undefined ? [] : ['--branch', ref];
  await run('git', ['clone', '--quiet', '--depth', '1', ...branch, url, dir]);
  return directoryIndex(dir);
}

/** Rebuilds index.json from the weave files under `root`. */
export async function buildIndex(root: string): Promise<IndexDocument> {
  const weaves: Record<string, Record<string, IndexEntry>> = {};
  const ids = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const id of ids.map((d) => d.name).sort((a, b) => a.localeCompare(b))) {
    const versions = await readdir(join(root, id), { withFileTypes: true });
    for (const version of versions.filter((d) => d.isDirectory()).map((d) => d.name)) {
      const path = `${id}/${version}/${WEAVE_FILE}`;
      const file = weaveFromYaml(await readFile(join(root, path), 'utf8'));
      weaves[id] ??= {};
      weaves[id][version] = {
        path,
        digest: file.digest,
        name: file.name,
        description: file.description,
      };
    }
  }
  const index: IndexDocument = { format: WEAVE_FORMAT, weaves };
  await writeFile(join(root, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

/** Writes a weave into a directory index and regenerates index.json. */
export async function publishWeave(root: string, file: WeaveFile): Promise<string> {
  const dir = join(root, file.id, file.version);
  await mkdir(dir, { recursive: true });
  const path = join(dir, WEAVE_FILE);
  await writeFile(path, weaveToYaml(file));
  await buildIndex(root);
  return path;
}
