/**
 * GraphQL as a draft's saved form. A draft prints as a document, a document
 * parses back into the same draft by replaying its moves and fills, and the
 * schema a document is checked against is derived from the moves the draft
 * engine offers on each type. One rule set decides all three, so a document
 * valid against the schema always compiles (FAB-VAL-05, FAB-VAL-06).
 *
 * A document is a path. Each field is a move, named in camelCase; its
 * arguments fill the holes the move opened. A move onto a capability with
 * several outputs returns an object of those outputs, and the one selected
 * is where the path goes on: `prices { highestBuy }`.
 */
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
  OperationTypeNode,
  parse,
  print,
  valueFromASTUntyped,
  type FieldNode,
  type GraphQLFieldConfig,
  type GraphQLFieldConfigArgumentMap,
  type GraphQLInputType,
  type GraphQLOutputType,
  type SelectionSetNode,
} from 'graphql';
import type { CapabilityDefinition, SemanticTypeId } from '@eve-fabric/domain';
import { semanticTypeId } from '@eve-fabric/domain';
import { Draft, type DraftHost, type DraftSubject, type FabricIdentity } from './draft.js';

/** A document that is not a draft: more than one path, or a field no move matches. */
export class GraphQLDraftError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GraphQLDraftError';
  }
}

/** A move or subject name as a GraphQL field name: `biggest spend this week` → `biggestSpendThisWeek`. */
export function fieldName(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0);
  const joined = words
    .map((w, i) => (i === 0 ? w[0]!.toLowerCase() + w.slice(1) : w[0]!.toUpperCase() + w.slice(1)))
    .join('');
  return /^\d/.test(joined) ? `_${joined}` : joined;
}

/** A semantic type id as a GraphQL type name: `eve.market.order` → `EveMarketOrder`. */
function typeName(id: string): string {
  const field = fieldName(id);
  return field[0]!.toUpperCase() + field.slice(1);
}

function splitRef(ref: string): [string, string] {
  const dot = ref.indexOf('.');
  return [ref.slice(0, dot), ref.slice(dot + 1)];
}

function literal(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value).map(([k, v]) => `${k}: ${literal(v)}`);
    return `{${fields.join(', ')}}`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

/** The capabilities a draft can start from with nothing given: the latest of each. */
function roots(host: DraftHost): CapabilityDefinition[] {
  return host.catalog
    .list()
    .filter((c) => host.catalog.get(c.id) === c)
    .filter((c) => [...c.inputs.values()].every((port) => !port.required));
}

// ── Printing ──────────────────────────────────────────────────────────────

interface Level {
  readonly field: string;
  readonly added: readonly string[];
  readonly args: string[];
  /** The cursor after this level, as `node.port`; updated by output moves. */
  cursor: string;
}

/** The draft as a GraphQL document. */
export function printDraft(draft: Draft, host: DraftHost): string {
  const subject = draft.subject;
  const nodes = draft.pipeline().nodes;
  const root: Level =
    'start' in subject
      ? { field: fieldName(subject.start), added: [nodes[0]!.id], args: [], cursor: draft.origin }
      : {
          field: subject.kind,
          added: [],
          args: [`${typeof subject.value === 'number' ? 'id' : 'name'}: ${literal(subject.value)}`],
          cursor: draft.origin,
        };
  const levels: Level[] = [root];
  for (const step of draft.steps) {
    if (step.kind === 'fill') {
      const [node, port] = splitRef(step.hole);
      const level = levels.find((l) => l.added.includes(node));
      if (level === undefined) throw new Error(`Fill of "${step.hole}" belongs to no move`);
      level.args.push(`${port}: ${literal(step.value)}`);
    } else if (step.added.length === 0) {
      // Another output of the step the cursor is on.
      levels.at(-1)!.cursor = step.cursor;
    } else {
      levels.push({
        field: fieldName(step.move),
        added: step.added,
        args: [],
        cursor: step.cursor,
      });
    }
  }
  let inner = isObject(host, draft.cursor.type) ? '{ __typename }' : '';
  for (const level of [...levels].reverse()) {
    const [node, port] = splitRef(level.cursor);
    const capability = draft.capabilityAt(node);
    if (capability !== undefined && capability.outputs.size > 1) {
      inner = `{ ${port} ${inner} }`;
    }
    const args = level.args.length > 0 ? `(${level.args.join(', ')})` : '';
    inner = `{ ${level.field}${args} ${inner} }`;
  }
  return print(parse(`query ${inner}`));
}

// ── Parsing ───────────────────────────────────────────────────────────────

function fieldsOf(selection: SelectionSetNode | undefined): FieldNode[] {
  if (selection === undefined) return [];
  return selection.selections.filter((s): s is FieldNode => {
    if (s.kind !== Kind.FIELD) {
      throw new GraphQLDraftError('Fragments are not part of a draft; write the fields out');
    }
    return s.name.value !== '__typename';
  });
}

function argumentsOf(field: FieldNode): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const arg of field.arguments ?? []) {
    if (arg.value.kind === Kind.VARIABLE) {
      throw new GraphQLDraftError(`"${arg.name.value}" is a variable; a draft takes values`);
    }
    args[arg.name.value] = valueFromASTUntyped(arg.value);
  }
  return args;
}

/** The draft a document describes, rebuilt through the moves and fills it names. */
export function parseDraft(host: DraftHost, source: string, identity?: FabricIdentity): Draft {
  const document = parse(source);
  const operations = document.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (operations.length !== 1 || operations[0]!.operation !== OperationTypeNode.QUERY) {
    throw new GraphQLDraftError('A draft is one query');
  }
  const [top, ...more] = fieldsOf(operations[0]!.selectionSet);
  if (top === undefined || more.length > 0) {
    throw new GraphQLDraftError('A draft starts from one subject');
  }
  const subject = subjectOf(host, top);
  let draft = Draft.start(
    host,
    'start' in subject ? subject.start : { [subject.kind]: subject.value },
    identity,
  );
  let field = top;
  for (;;) {
    const chosen = choosePort(draft, field);
    if (chosen.output !== undefined) draft = draft.apply(chosen.output);
    const next = nextMove(host, draft, chosen.selection);
    if (next === undefined) return draft;
    const name = next.name.value;
    const move = draft.moves().find((m) => fieldName(m.name) === name)!;
    const before = new Set(draft.pipeline().nodes.map((n) => n.id));
    draft = draft.apply(move.name);
    const added = draft
      .pipeline()
      .nodes.map((n) => n.id)
      .filter((id) => !before.has(id));
    for (const [port, value] of Object.entries(argumentsOf(next))) {
      const hole = draft.holes.find((h) => h.port === port && added.includes(h.node));
      if (hole === undefined) throw new GraphQLDraftError(`"${name}" has no argument "${port}"`);
      draft = draft.fill(`${hole.node}.${hole.port}`, value);
    }
    field = next;
  }
}

function subjectOf(host: DraftHost, field: FieldNode): DraftSubject {
  const args = argumentsOf(field);
  const name = field.name.value;
  const given = Object.entries(args);
  if (given.length === 1 && (given[0]![0] === 'name' || given[0]![0] === 'id')) {
    const value = given[0]![1];
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new GraphQLDraftError(`"${name}" takes a name or an id`);
    }
    return { kind: name, value };
  }
  if (given.length > 0) throw new GraphQLDraftError(`"${name}" takes one argument, name or id`);
  const root = roots(host).find((c) => fieldName(c.name) === name);
  if (root === undefined)
    throw new GraphQLDraftError(`Nothing in this fabric starts from "${name}"`);
  return { start: root.name };
}

/**
 * Where a field's selection continues. A step with several outputs selects
 * one of them; picking another than the cursor's is an output move.
 */
function choosePort(
  draft: Draft,
  field: FieldNode,
): { readonly selection: SelectionSetNode | undefined; readonly output?: string } {
  const [node, port] = splitRef(draft.cursor.ref);
  const capability = draft.capabilityAt(node);
  if (capability === undefined || capability.outputs.size <= 1) {
    return { selection: field.selectionSet };
  }
  const picked = fieldsOf(field.selectionSet);
  if (picked.length !== 1 || !capability.outputs.has(picked[0]!.name.value)) {
    throw new GraphQLDraftError(
      `"${field.name.value}" gives ${[...capability.outputs.keys()].join(', ')}; select one`,
    );
  }
  const chosen = picked[0]!;
  return chosen.name.value === port
    ? { selection: chosen.selectionSet }
    : { selection: chosen.selectionSet, output: chosen.name.value };
}

/** The one move a selection makes next; the rest may only read the record at the cursor. */
function nextMove(
  host: DraftHost,
  draft: Draft,
  selection: SelectionSetNode | undefined,
): FieldNode | undefined {
  if (selection === undefined) return undefined;
  const offered = new Set(draft.moves().map((m) => fieldName(m.name)));
  const fields = fieldsOf(selection);
  const moves = fields.filter((f) => offered.has(f.name.value));
  if (moves.length > 1) {
    throw new GraphQLDraftError(
      `A draft follows one path; ${moves.map((f) => f.name.value).join(' and ')} branch`,
    );
  }
  for (const f of fields) {
    if (!offered.has(f.name.value) && f.selectionSet !== undefined) {
      throw new GraphQLDraftError(`"${f.name.value}" is not a move here`);
    }
  }
  if (moves.length === 0 && fields.length > 0 && !readsRecord(host, draft, fields)) {
    throw new GraphQLDraftError(
      `"${fields[0]!.name.value}" is not a move here; the moves are ${[...offered].join(', ')}`,
    );
  }
  return moves[0];
}

/** Whether every field is one the record at the cursor carries. */
function readsRecord(host: DraftHost, draft: Draft, fields: readonly FieldNode[]): boolean {
  const record = host.types.get(draft.cursor.type);
  return record.kind === 'record' && fields.every((f) => record.fields.has(f.name.value));
}

// ── The derived schema ────────────────────────────────────────────────────

/** Whether a semantic type is an object in the schema: anything but a value with no moves. */
function isObject(host: DraftHost, type: SemanticTypeId): boolean {
  return host.types.get(type).kind !== 'value' || Draft.at(host, type).moves().length > 0;
}

const Value = new GraphQLScalarType({
  name: 'Value',
  description: 'Any value, as JSON',
});

const NameOrId = new GraphQLScalarType({
  name: 'NameOrId',
  description: 'A name to look up, or an id',
});

/**
 * The GraphQL schema derived from the catalog. Each semantic type is a type;
 * each move the draft engine offers on it is a field whose arguments are the
 * holes the move opens (FAB-VAL-05). Root fields are the subjects a draft can
 * start from.
 */
export function deriveSchema(host: DraftHost): GraphQLSchema {
  const objects = new Map<string, GraphQLObjectType>();
  const scalars = new Map<string, GraphQLScalarType>();

  const scalarFor = (type: SemanticTypeId): GraphQLScalarType => {
    const name = typeName(type);
    let scalar = scalars.get(name);
    if (scalar === undefined) {
      const definition = host.types.get(type);
      scalar = new GraphQLScalarType({ name, description: definition.description });
      scalars.set(name, scalar);
    }
    return scalar;
  };

  const inputFor = (type: SemanticTypeId): GraphQLInputType => {
    const kind = host.types.get(type).kind;
    if (kind === 'reference') return NameOrId;
    if (kind === 'value') return scalarFor(type);
    return Value;
  };

  const outputFor = (type: SemanticTypeId): GraphQLOutputType =>
    isObject(host, type) ? objectFor(type) : scalarFor(type);

  /** A move's field: its arguments are the holes it opens. */
  const fieldFor = (from: Draft, move: string): GraphQLFieldConfig<unknown, unknown> => {
    const before = new Set(from.pipeline().nodes.map((n) => n.id));
    const moved = from.explore(move);
    const args: GraphQLFieldConfigArgumentMap = {};
    for (const hole of moved.holes) {
      if (before.has(hole.node)) continue;
      args[hole.port] = {
        type: new GraphQLNonNull(inputFor(hole.type)),
        description: hole.description,
      };
    }
    return { type: resultOf(moved), args, description: moveDescription(from, move) };
  };

  /** What a move gives: the cursor's type, or an object of a step's outputs. */
  const resultOf = (moved: Draft): GraphQLOutputType => {
    const [node] = splitRef(moved.cursor.ref);
    const capability = moved.capabilityAt(node);
    if (capability === undefined || capability.outputs.size <= 1)
      return outputFor(moved.cursor.type);
    const each = moved.isPerItem(node);
    const name = `${typeName(capability.id)}${each ? 'Each' : ''}Outputs`;
    let object = objects.get(name);
    if (object === undefined) {
      object = new GraphQLObjectType({
        name,
        description: `What ${capability.name} gives${each ? ', for each item' : ''}`,
        fields: () =>
          Object.fromEntries(
            [...capability.outputs].map(([port, spec]) => {
              const type = each
                ? semanticTypeId(`${spec.semanticType as string}.collection`)
                : spec.semanticType;
              return [port, { type: outputFor(type), description: spec.description }];
            }),
          ),
      });
      objects.set(name, object);
    }
    return object;
  };

  const moveDescription = (from: Draft, move: string): string | undefined => {
    const found = from.moves().find((m) => m.name === move);
    if (found?.unavailable === undefined) return found?.description;
    return `${found.description} Needs ${found.unavailable.scopes.join(', ')}.`;
  };

  /** A record field read as it is: a value as its scalar, a reference as its id. */
  const readFor = (type: SemanticTypeId): GraphQLOutputType => {
    const kind = host.types.get(type).kind;
    if (kind === 'value') return scalarFor(type);
    if (kind === 'reference') return GraphQLInt;
    return Value;
  };

  function objectFor(type: SemanticTypeId): GraphQLObjectType {
    const name = typeName(type);
    let object = objects.get(name);
    if (object !== undefined) return object;
    const definition = host.types.get(type);
    object = new GraphQLObjectType({
      name,
      description: definition.description,
      fields: () => {
        const at = Draft.at(host, type);
        const fields: Record<string, GraphQLFieldConfig<unknown, unknown>> = {
          _value: { type: Value, description: 'The value here, as JSON' },
        };
        for (const move of at.moves()) fields[fieldName(move.name)] = fieldFor(at, move.name);
        // A record's own fields, readable where no move has the name.
        if (definition.kind === 'record') {
          for (const [field, spec] of definition.fields) {
            if (field in fields) continue;
            fields[field] = { type: readFor(spec.type), description: spec.description };
          }
        }
        return fields;
      },
    });
    objects.set(name, object);
    return object;
  }

  const query = new GraphQLObjectType({
    name: 'Query',
    fields: () => {
      const fields: Record<string, GraphQLFieldConfig<unknown, unknown>> = {};
      for (const { kind, type } of Draft.subjects(host)) {
        fields[kind] = {
          type: outputFor(type),
          args: { name: { type: GraphQLString }, id: { type: GraphQLInt } },
          description: `Start from a ${kind}, by name or id`,
        };
      }
      for (const root of roots(host)) {
        const field = fieldName(root.name);
        if (field in fields) continue;
        const start = Draft.start(host, root.name);
        fields[field] = { type: resultOf(start), description: root.description };
      }
      return fields;
    },
  });

  return new GraphQLSchema({ query, types: [GraphQLBoolean, GraphQLFloat] });
}
