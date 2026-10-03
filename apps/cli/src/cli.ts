/**
 * `eve-fabric`: ask saved questions, explore moves, and move weaves in and
 * out of a fabric from the terminal. Every command takes the same fabric
 * options; nothing here holds state except the store named by --db.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { printSchema } from 'graphql';
import { z } from 'zod';
import { generate } from '@eve-fabric/codegen';
import type { Draft, Fabric } from '@eve-fabric/fabric';
import { weaveFromYaml, weaveToYaml } from '@eve-fabric/weave';
import { openFabric, type FabricSettings } from './fabric-for.js';

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Where --pack paths and package names resolve from; the process's by default. */
  readonly cwd?: string | undefined;
}

export const USAGE = `Usage: eve-fabric <command> [options]

Commands:
  ask <question>                 Run a saved question (a .graphql file, or the document itself)
  moves <kind>=<value> [step…]   Start a draft and show its moves and holes. A step is a move
                                 name, or hole=value to fill a hole; quote names with spaces
  weave export <question> --id <id> --version <x.y.z> [--as <move>] [--out <file>]
                                 Share a saved question as a weave (YAML on stdout, or --out)
  weave add <file>               Add a weave; keep it with --db
  weave list                     The weaves added (with --db, across runs)
  weave remove <id> <version>    Take one back
  codegen <weave> [--out <dir>] [--name <package>]
                                 A runnable package from a weave: a module that builds a
                                 fabric, adds the weave and asks (default dir: the weave's id)
  schema                         The GraphQL schema questions are written against

Options:
  --offline        Use the Tranquility fixture instead of live ESI (no network, no SDE)
  --pack <module>  Install the packs a module exports (repeatable): a path such as
                   ./my-pack.ts, or an installed package name
  --db <file>      Keep added weaves in this SQLite file (default: $FABRIC_DB)
  --json           Print answers as JSON on one line
  --name <package> The package name codegen emits (default: the weave's id with hyphens)
  -h, --help       Show this help

Live use reads names from the SDE export at $SDE_DATA_PATH.`;

/** A command line that is not one this takes. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** What a GraphQL document can open with: a selection, an operation, or a comment. */
const DOCUMENT_START = /^\s*(\{|#|query\b|fragment\b)/;

/** A file's text, or the argument itself when it is a document and no such file exists. */
function questionText(source: string): string {
  return !existsSync(source) && DOCUMENT_START.test(source) ? source : readFileSync(source, 'utf8');
}

/** The id and version a weave is shared under, as the gateway takes them. */
const weaveNameSchema = z.object({
  id: z
    .string({ required_error: 'needs --id' })
    .regex(
      /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/,
      'is two or more lowercase, dot-separated parts, such as me.forge.prices',
    ),
  version: z.string({ required_error: 'needs --version' }).regex(/^\d+\.\d+\.\d+$/, 'is x.y.z'),
});

/** The positionals a command takes, refusing any beyond them. */
function exactly(words: readonly string[], count: number, usage: string): (string | undefined)[] {
  if (words.length > count) {
    throw new UsageError(`${usage} (unexpected: ${words.slice(count).join(' ')})`);
  }
  return [...words];
}

function parseValue(text: string): string | number {
  return /^\d+$/.test(text) ? Number(text) : text;
}

/** `type=Tritanium orders region="The Forge"`: a subject, then moves and fills. */
function draftFrom(fabric: Fabric, words: readonly string[]): Draft {
  const [subject, ...steps] = words;
  const at = subject?.indexOf('=') ?? -1;
  if (subject === undefined || at <= 0) {
    throw new UsageError('moves needs a subject first, such as type=Tritanium');
  }
  let draft = fabric.draft({ [subject.slice(0, at)]: parseValue(subject.slice(at + 1)) });
  for (const step of steps) {
    const eq = step.indexOf('=');
    draft =
      eq > 0 ? draft.fill(step.slice(0, eq), parseValue(step.slice(eq + 1))) : draft.apply(step);
  }
  return draft;
}

function moveLabel(move: ReturnType<Draft['moves']>[number]): string {
  return move.unavailable === undefined
    ? move.name
    : `${move.name} (needs ${move.unavailable.scopes.join(', ')})`;
}

function holeLabel(name: string, type: string, examples: readonly string[]): string {
  const hint = examples.length > 0 ? ' (e.g. ' + examples.join(', ') + ')' : '';
  return `  ${name}: ${type}${hint}`;
}

async function describeDraft(draft: Draft, io: Io): Promise<void> {
  const moves = draft.moves();
  io.out(`at: ${draft.cursor.type}`);
  io.out(`moves: ${moves.map(moveLabel).join(', ') || 'none'}`);
  if (draft.holes.length > 0) {
    io.out('holes:');
    for (const hole of draft.holes) {
      const choices = await hole.choices();
      const some = choices.slice(0, 5).map((c) => c.name);
      io.out(holeLabel(hole.name, hole.type, some));
    }
    return;
  }
  const plan = draft.plan();
  io.out(
    `complete: ${String(plan.steps.length)} steps, ${String(plan.esiCalls)} ESI call(s), scopes: ${plan.scopes.join(', ') || 'none'}`,
  );
  io.out('saved form:');
  io.out(draft.toGraphQL().trimEnd());
}

async function weaveCommand(
  fabric: Fabric,
  args: readonly string[],
  options: Options,
  io: Io,
): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case 'export': {
      const usage = 'weave export needs <question> --id <id> --version <x.y.z>';
      const [question] = exactly(rest, 1, usage);
      if (question === undefined) throw new UsageError(usage);
      const name = weaveNameSchema.safeParse({ id: options.id, version: options.version });
      if (!name.success) {
        const issue = name.error.issues[0];
        throw new UsageError(`weave export: --${String(issue?.path[0])} ${String(issue?.message)}`);
      }
      const draft = fabric.fromGraphQL(questionText(question));
      const yaml = weaveToYaml(
        fabric.export(fabric.weave(draft, { ...name.data, as: options.as })),
      );
      if (options.out === undefined) io.out(yaml.trimEnd());
      else {
        writeFileSync(options.out, yaml);
        io.out(`wrote ${options.out}`);
      }
      return;
    }
    case 'add': {
      const [file] = exactly(rest, 1, 'weave add needs one weave file');
      if (file === undefined) throw new UsageError('weave add needs a weave file');
      const added = await fabric.add(readFileSync(file, 'utf8'));
      io.out(
        `added ${added.id as string}@${String(added.version)}${options.db === undefined ? ' (not kept: pass --db to keep it)' : ''}`,
      );
      return;
    }
    case 'list': {
      exactly(rest, 0, 'weave list takes no arguments');
      const weaves = fabric.weaves();
      if (weaves.length === 0) io.out('no weaves added');
      for (const w of weaves) io.out(`${w.id}@${w.version}  ${w.digest}`);
      return;
    }
    case 'remove': {
      const [id, version] = exactly(rest, 2, 'weave remove needs <id> <version>');
      if (id === undefined || version === undefined)
        throw new UsageError('weave remove needs <id> <version>');
      await fabric.remove(id, version);
      io.out(`removed ${id}@${version}`);
      return;
    }
    default:
      throw new UsageError(`weave takes export, add, list or remove, not "${String(action)}"`);
  }
}

/** The one positional `codegen` takes: a weave file. */
const codegenArgsSchema = z.tuple([z.string().min(1)]);

/** `codegen <weave>`: the weave is checked as `weave add` checks it, then the package is written. */
function codegenCommand(fabric: Fabric, args: readonly string[], options: Options, io: Io): void {
  const parsed = codegenArgsSchema.safeParse(args);
  if (!parsed.success) throw new UsageError('codegen takes one weave file');
  const [file] = parsed.data;
  const weave = weaveFromYaml(readFileSync(file, 'utf8'));
  const bundle = generate(weave, fabric, { packageName: options.name });
  const dir = resolve(options.cwd ?? '.', options.out ?? weave.id.replaceAll('.', '-'));
  mkdirSync(dir, { recursive: true });
  for (const generated of bundle.files) {
    writeFileSync(join(dir, generated.path), generated.content);
    io.out(`wrote ${join(dir, generated.path)}`);
  }
  io.out(
    `${weave.id}@${weave.version} as a package in ${dir}: install its dependencies and import index.ts`,
  );
}

interface Options {
  readonly offline: boolean;
  readonly packs: readonly string[];
  readonly db: string | undefined;
  readonly json: boolean;
  readonly id: string | undefined;
  readonly version: string | undefined;
  readonly as: string | undefined;
  readonly out: string | undefined;
  readonly name: string | undefined;
  readonly help: boolean;
  /** Where relative --out paths resolve from. */
  readonly cwd: string | undefined;
}

function parse(argv: readonly string[], io: Io): { command: string[]; options: Options } {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      offline: { type: 'boolean', default: false },
      pack: { type: 'string', multiple: true, default: [] },
      db: { type: 'string' },
      json: { type: 'boolean', default: false },
      id: { type: 'string' },
      version: { type: 'string' },
      as: { type: 'string' },
      out: { type: 'string' },
      name: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  return {
    command: positionals,
    options: {
      offline: values.offline,
      packs: values.pack,
      db: values.db ?? io.env['FABRIC_DB'],
      json: values.json,
      id: values.id,
      version: values.version,
      as: values.as,
      out: values.out,
      name: values.name,
      help: values.help,
      cwd: io.cwd,
    },
  };
}

/** Runs one command line; the exit code it returns is the process's. */
export async function runCli(argv: readonly string[], io: Io): Promise<number> {
  let command: string[];
  let options: Options;
  try {
    ({ command, options } = parse(argv, io));
  } catch (error) {
    io.err(`error: ${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const [name, ...args] = command;
  if (options.help || name === undefined || name === 'help') {
    io.out(USAGE);
    return name === undefined && !options.help ? 2 : 0;
  }
  const settings: FabricSettings = {
    offline: options.offline,
    packs: options.packs,
    db: options.db,
    sdeDataPath: io.env['SDE_DATA_PATH'],
    cwd: io.cwd,
  };
  let opened: Awaited<ReturnType<typeof openFabric>> | undefined;
  try {
    if (!['ask', 'moves', 'weave', 'codegen', 'schema'].includes(name)) {
      throw new UsageError(`"${name}" is not a command`);
    }
    opened = await openFabric(settings);
    for (const weave of opened.skipped)
      io.err(`warning: kept weave ${weave} no longer adds; skipped`);
    const { fabric } = opened;
    if (
      !settings.offline &&
      settings.sdeDataPath === undefined &&
      !['weave', 'codegen'].includes(name)
    ) {
      io.err('note: no SDE_DATA_PATH, so names will not resolve; use ids, or --offline');
    }
    switch (name) {
      case 'ask': {
        const [question] = exactly(args, 1, 'ask takes one question');
        if (question === undefined)
          throw new UsageError('ask needs a question: a .graphql file or the document');
        const { answer } = await fabric.query(fabric.fromGraphQL(questionText(question)));
        io.out(options.json ? JSON.stringify(answer) : JSON.stringify(answer, null, 2));
        break;
      }
      case 'moves':
        await describeDraft(draftFrom(fabric, args), io);
        break;
      case 'weave':
        await weaveCommand(fabric, args, options, io);
        break;
      case 'codegen':
        codegenCommand(fabric, args, options, io);
        break;
      default:
        exactly(args, 0, 'schema takes no arguments');
        io.out(printSchema(fabric.schema()));
    }
    return 0;
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    io.err(`error: ${e.name}: ${e.message}`);
    if (e instanceof UsageError) io.err(`\n${USAGE}`);
    else if (e.name === 'GraphQLDraftError' && e.message.startsWith('Cannot query field')) {
      io.err('If a pack provides that move, install it with --pack <module>');
    } else if (!settings.offline && (e.cause as { url?: unknown } | undefined)?.url !== undefined) {
      io.err('ESI did not answer; check the network, or try --offline');
    }
    return e instanceof UsageError ? 2 : 1;
  } finally {
    opened?.close();
  }
}
