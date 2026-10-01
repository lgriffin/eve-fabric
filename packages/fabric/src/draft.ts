/**
 * The draft: a question as the fabric holds it while a person builds it.
 *
 * A draft is a pipeline plus the values filled into it, and a cursor: the
 * port the question currently points at. It changes only through moves the
 * engine offers (constitution XXVIII, the construction gate), and the
 * compiler is the oracle: a move is offered only when applying it gives a
 * pipeline that compiles or fails only for want of inputs, and those missing
 * inputs are the draft's holes. A draft is complete or has typed holes;
 * there is no third state. Every draft is immutable, so undo is keeping the
 * previous one.
 */
import type {
  CapabilityCatalog,
  CapabilityDefinition,
  ExecutionPlan,
  PipelineDefinition,
  PipelineEdge,
  PipelineInput,
  PipelineNode,
  ReferenceTypeDefinition,
  SemanticPort,
  SemanticTypeId,
  SemanticTypeRegistry,
} from '@eve-fabric/domain';
import { capabilityId, semanticTypeId } from '@eve-fabric/domain';
import type { CompileResult, CompilerDiagnostic } from '@eve-fabric/compiler';
import { z } from 'zod';

/** One subject, named by kind: a name (non-empty text) or a positive integer id. */
const subjectSchema = z
  .record(z.string(), z.union([z.string().trim().min(1), z.number().int().positive()]))
  .refine((subject) => Object.keys(subject).length === 1, {
    message: 'A draft starts from one subject, such as { type: "Tritanium" }',
  });

/** What a draft needs from the fabric that made it. */
export interface DraftHost {
  readonly catalog: CapabilityCatalog;
  readonly types: SemanticTypeRegistry;
  compile(pipeline: PipelineDefinition): CompileResult;
  /** Runs one capability on its own; used to list a hole's choices. */
  runOne(
    capability: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>>;
}

/** Where the question points: a step's output port, perhaps a field inside it. */
export interface Cursor {
  readonly ref: string;
  readonly type: SemanticTypeId;
}

/** A change the engine offers. Apply it by name. */
export interface Move {
  readonly name: string;
  /**
   * `attach`: a capability hung on the cursor's type. `follow`: a reference
   * field, resolved. `details`: a reference, resolved. `each`: a capability
   * run once per item of a list. `output`: another output of the step the
   * cursor is on; nothing is added.
   */
  readonly kind: 'attach' | 'follow' | 'details' | 'each' | 'output';
  /** The capability the move adds, as `id@version`. */
  readonly capability: string;
  readonly description: string;
  /** The cursor's type once the move is applied. */
  readonly yields: SemanticTypeId;
}

/** A value the person may pick for a hole. */
export interface Choice {
  readonly id: number;
  readonly name: string;
}

/** An input the draft still needs, typed. */
export interface Hole {
  /** The port's name, or `node.port` where two holes share a port name. */
  readonly name: string;
  readonly node: string;
  readonly port: string;
  readonly type: SemanticTypeId;
  readonly description?: string | undefined;
  /** Values to pick from, for a reference type that lists them; empty otherwise. */
  choices(text?: string): Promise<readonly Choice[]>;
}

/** One step of a draft's plan, in the order it runs. */
export interface PlannedStep {
  readonly id: string;
  readonly capability: string;
  readonly source: string;
  readonly waitsFor: readonly string[];
  /** Set when the step runs once per item of a list. */
  readonly each?: PerItemPlan | undefined;
}

/** What a per-item step may cost, known before it runs. */
export interface PerItemPlan {
  /** The input port the list arrives on. */
  readonly over: string;
  /** Distinct items it will run for at most; more fail the step unsent. */
  readonly cap: number;
  /** Calls to its source per item. */
  readonly callsPerItem: number;
  /** ESI calls per item. */
  readonly esiCallsPerItem: number;
}

/** What a complete draft would do, before anything is sent. */
export interface DraftPlan {
  readonly steps: readonly PlannedStep[];
  /** ESI calls the plan makes outside per-item steps. */
  readonly esiCalls: number;
  /** ESI calls at most, with every per-item step at its cap. */
  readonly maxEsiCalls: number;
  /** ESI scopes the caller needs. */
  readonly scopes: readonly string[];
  readonly plan: ExecutionPlan;
}

/** A move was applied that the engine did not offer for that draft (FAB-VAL-03). */
export class MoveNotOfferedError extends Error {
  readonly move: string;
  readonly offered: readonly string[];

  constructor(move: string, offered: readonly string[]) {
    super(
      `"${move}" is not a move this draft offers; it offers ${offered.length > 0 ? offered.join(', ') : 'none'}`,
    );
    this.name = 'MoveNotOfferedError';
    this.move = move;
    this.offered = offered;
  }
}

/** A draft with holes cannot be planned, run, published or exported (FAB-VAL-04). */
export class DraftIncompleteError extends Error {
  readonly holes: readonly string[];

  constructor(action: string, holes: readonly string[]) {
    super(`Cannot ${action} a draft with holes: fill ${holes.join(', ')} first`);
    this.name = 'DraftIncompleteError';
    this.holes = holes;
  }
}

/** A fill that is not a value of the hole's type, or not a hole at all. */
export class FillRejectedError extends Error {
  constructor(hole: string, reason: string) {
    super(`Cannot fill "${hole}": ${reason}`);
    this.name = 'FillRejectedError';
  }
}

/** A draft cannot start from this subject. */
export class UnknownSubjectError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'UnknownSubjectError';
  }
}

interface DraftState {
  readonly nodes: readonly PipelineNode[];
  readonly edges: readonly PipelineEdge[];
  readonly inputs: readonly PipelineInput[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly cursor: Cursor;
}

interface Candidate {
  readonly move: Move;
  readonly state: DraftState;
}

function keyOf(capability: CapabilityDefinition): string {
  return `${capability.id as string}@${capability.version as string}`;
}

/** The latest version of each capability. */
function latest(catalog: CapabilityCatalog): CapabilityDefinition[] {
  const byId = new Map<string, CapabilityDefinition>();
  for (const capability of catalog.list()) {
    const known = byId.get(capability.id);
    if (known === undefined || catalog.get(capability.id) === capability) {
      byId.set(capability.id, capability);
    }
  }
  return [...byId.values()];
}

function firstOutput(capability: CapabilityDefinition): [string, SemanticTypeId] {
  const [name, port] = [...capability.outputs][0]!;
  return [name, port.semanticType];
}

/** A node id from a name: letters and digits, unique in the draft. */
function freshNodeId(state: DraftState, name: string): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter((part) => part.length > 0);
  const base = parts.join('-').replace(/^[^a-zA-Z]+/, '') || 'step';
  const taken = new Set(state.nodes.map((n) => n.id));
  if (!taken.has(base) && base !== 'input' && base !== 'output') return base;
  for (let i = 2; ; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
}

/** A pipeline input name for a node's port: letters and digits only. */
function inputName(state: DraftState, node: string, port: string): string {
  const base = `${node}-${port}`
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part, i) => (i === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join('');
  const taken = new Set(state.inputs.map((i) => i.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

function nodeFor(capability: CapabilityDefinition, id: string): PipelineNode {
  return { id, capability: { id: capability.id, version: capability.version } };
}

/** The name a reference field is followed by: `location_id` is `location`. */
function followName(field: string): string {
  return field.replace(/_id$/, '');
}

function lastSegment(id: string): string {
  return id.slice(id.lastIndexOf('.') + 1);
}

/** Only missing inputs: the draft has holes but nothing is wrong with it. */
function holesOnly(diagnostics: readonly CompilerDiagnostic[]): boolean {
  return diagnostics.every((d) => d.severity !== 'error' || d.code === 'MISSING_INPUT');
}

export class Draft {
  private holesCache: readonly Hole[] | undefined;

  private constructor(
    private readonly host: DraftHost,
    private readonly state: DraftState,
  ) {}

  /**
   * A draft from a subject picked by name or id, `{ type: 'Tritanium' }`, or
   * from a capability that needs nothing, by its name: `'incursions'`.
   */
  static start(
    host: DraftHost,
    subject: string | Readonly<Record<string, string | number>>,
  ): Draft {
    if (typeof subject === 'string') return Draft.startFrom(host, subject);
    const parsed = subjectSchema.safeParse(subject);
    if (!parsed.success) {
      throw new UnknownSubjectError(
        `A draft starts from one subject named by text or a positive id, such as { type: "Tritanium" }: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    const [kind, value] = Object.entries(parsed.data)[0]!;
    const references = host.types
      .list()
      .filter((t): t is ReferenceTypeDefinition => t.kind === 'reference')
      .filter((t) => lastSegment(t.entity) === kind);
    if (references.length !== 1) {
      throw new UnknownSubjectError(
        references.length === 0
          ? `Nothing in this fabric is a "${kind}"`
          : `"${kind}" names more than one type: ${references.map((r) => r.id).join(', ')}`,
      );
    }
    const reference = references[0]!;
    const empty: DraftState = {
      nodes: [],
      edges: [],
      inputs: [],
      values: {},
      cursor: { ref: '', type: reference.id },
    };
    const lookup = Draft.lookupFor(host, reference.id);
    if (lookup === undefined) {
      throw new UnknownSubjectError(`No capability here looks up a ${reference.id} by name`);
    }
    const node = freshNodeId(empty, kind);
    const input = inputName(empty, node, lookup.input);
    const state: DraftState = {
      nodes: [nodeFor(lookup.capability, node)],
      edges: [{ from: `input.${input}`, to: `${node}.${lookup.input}` }],
      inputs: [{ name: input, semanticType: reference.id, required: true }],
      values: { [input]: value },
      cursor: { ref: `${node}.${lookup.output}`, type: reference.id },
    };
    const draft = new Draft(host, state);
    const compiled = host.compile(draft.pipeline());
    if (!compiled.success) {
      throw new UnknownSubjectError(
        `A draft from ${kind} "${String(value)}" does not compile: ${compiled.diagnostics
          .map((d) => d.message)
          .join('; ')}`,
      );
    }
    return draft;
  }

  /** A draft whose first step is a capability that takes no input, named by its name or id. */
  private static startFrom(host: DraftHost, name: string): Draft {
    const wanted = name.trim().toLowerCase();
    const roots = latest(host.catalog).filter(
      (c) =>
        [...c.inputs.values()].every((port) => !port.required) &&
        (c.name.toLowerCase() === wanted || (c.id as string) === wanted),
    );
    if (roots.length !== 1) {
      throw new UnknownSubjectError(
        roots.length === 0
          ? `Nothing in this fabric starts from "${name}"`
          : `"${name}" names more than one capability: ${roots.map((r) => r.id).join(', ')}`,
      );
    }
    const root = roots[0]!;
    const empty: DraftState = {
      nodes: [],
      edges: [],
      inputs: [],
      values: {},
      cursor: { ref: '', type: firstOutput(root)[1] },
    };
    const node = freshNodeId(empty, root.name);
    const [output, type] = firstOutput(root);
    return new Draft(host, {
      ...empty,
      nodes: [nodeFor(root, node)],
      cursor: { ref: `${node}.${output}`, type },
    });
  }

  /** The capability that turns a name into a reference of this type, if any. */
  private static lookupFor(
    host: DraftHost,
    type: SemanticTypeId,
  ): { capability: CapabilityDefinition; input: string; output: string } | undefined {
    for (const capability of latest(host.catalog)) {
      const input = [...capability.inputs].find(
        ([, port]) => port.acceptsName === true && port.semanticType === type,
      );
      const output = [...capability.outputs].find(([, port]) => port.semanticType === type);
      if (input !== undefined && output !== undefined) {
        return { capability, input: input[0], output: output[0] };
      }
    }
    return undefined;
  }

  /** Where the question points now. */
  get cursor(): Cursor {
    return this.state.cursor;
  }

  /** The draft as a pipeline whose one output is the cursor. */
  pipeline(): PipelineDefinition {
    // A copy: changing it never changes the draft.
    return copyOf({
      id: 'draft',
      version: 1,
      name: 'Draft',
      inputs: this.state.inputs,
      nodes: this.state.nodes,
      edges: this.state.edges,
      outputs: [{ name: 'answer', source: this.state.cursor.ref }],
    });
  }

  /** The values filled into the draft, by pipeline input name. A copy. */
  get values(): Readonly<Record<string, unknown>> {
    return copyOf(this.state.values);
  }

  /** The inputs the draft still needs. Empty when it is complete. */
  get holes(): readonly Hole[] {
    this.holesCache ??= this.findHoles();
    return this.holesCache;
  }

  get complete(): boolean {
    return this.holes.length === 0;
  }

  /** Every move the engine offers for this draft, by name. */
  moves(): readonly Move[] {
    return this.candidates().map((c) => c.move);
  }

  /** The draft with the named move applied. Throws if the move is not offered. */
  apply(name: string): Draft {
    const candidates = this.candidates();
    const chosen = candidates.find((c) => c.move.name === name);
    if (chosen === undefined) {
      throw new MoveNotOfferedError(
        name,
        candidates.map((c) => c.move.name),
      );
    }
    return new Draft(this.host, chosen.state);
  }

  /**
   * The draft with a hole filled. A reference hole takes an id, or a name
   * the fabric looks up; any other hole takes a value of its type.
   */
  fill(name: string, value: unknown): Draft {
    const hole = this.holes.find((h) => h.name === name || `${h.node}.${h.port}` === name);
    if (hole === undefined) {
      throw new FillRejectedError(
        name,
        `it is not a hole of this draft; the holes are ${this.holes.map((h) => h.name).join(', ') || 'none'}`,
      );
    }
    const target = `${hole.node}.${hole.port}`;
    // A value of the hole's type (an id, even sent as text) is used as it is;
    // only text that is not one is a name to look up.
    const check = this.host.types.check(hole.type, value);
    const lookup =
      !check.ok && typeof value === 'string' ? Draft.lookupFor(this.host, hole.type) : undefined;
    let next: DraftState;
    if (lookup !== undefined) {
      const node = freshNodeId(this.state, hole.port);
      const input = inputName(this.state, node, lookup.input);
      next = {
        ...this.state,
        nodes: [...this.state.nodes, nodeFor(lookup.capability, node)],
        edges: [
          ...this.state.edges,
          { from: `input.${input}`, to: `${node}.${lookup.input}` },
          { from: `${node}.${lookup.output}`, to: target },
        ],
        inputs: [...this.state.inputs, { name: input, semanticType: hole.type, required: true }],
        values: { ...this.state.values, [input]: value },
      };
    } else {
      if (!check.ok) throw new FillRejectedError(name, `not a ${hole.type}: ${check.message}`);
      const input = inputName(this.state, hole.node, hole.port);
      next = {
        ...this.state,
        edges: [...this.state.edges, { from: `input.${input}`, to: target }],
        inputs: [...this.state.inputs, { name: input, semanticType: hole.type, required: true }],
        values: { ...this.state.values, [input]: check.value },
      };
    }
    const filled = new Draft(this.host, next);
    const compiled = this.host.compile(filled.pipeline());
    if (!holesOnly(compiled.diagnostics)) {
      throw new FillRejectedError(
        name,
        compiled.diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => d.message)
          .join('; '),
      );
    }
    return filled;
  }

  /** What the draft would do: its steps in order, ESI calls and scopes. Throws while it has holes. */
  plan(): DraftPlan {
    this.requireComplete('plan');
    const compiled = this.host.compile(this.pipeline());
    if (!compiled.success || compiled.plan === undefined) {
      // A complete draft compiles by construction; this is a fabric bug.
      throw new Error(
        `A complete draft did not compile: ${compiled.diagnostics.map((d) => d.message).join('; ')}`,
      );
    }
    const plan = compiled.plan as unknown as ExecutionPlan;
    let esiCalls = 0;
    let maxEsiCalls = 0;
    const steps = plan.steps.map((step): PlannedStep => {
      const capability = this.host.catalog.get(step.capability.id, step.capability.version);
      const calls = capability.source === 'ESI' ? capability.cost.esiCallCount : 0;
      const planned = {
        id: step.id,
        capability: keyOf(capability),
        source: capability.source,
        waitsFor: [...step.dependsOn],
      };
      if (step.each === undefined) {
        esiCalls += calls;
        maxEsiCalls += calls;
        return planned;
      }
      maxEsiCalls += calls * step.each.cap;
      return {
        ...planned,
        each: {
          over: step.each.port,
          cap: step.each.cap,
          callsPerItem: capability.source === 'DERIVED' ? 0 : Math.max(calls, 1),
          esiCallsPerItem: calls,
        },
      };
    });
    return { steps, esiCalls, maxEsiCalls, scopes: [...plan.authRequirements.scopes], plan };
  }

  /** The complete draft as a pipeline and the values that go with it, for publishing or export. */
  toPipeline(): {
    readonly pipeline: PipelineDefinition;
    readonly values: Readonly<Record<string, unknown>>;
  } {
    this.requireComplete('export');
    return { pipeline: this.pipeline(), values: this.values };
  }

  /** Throws {@link DraftIncompleteError} while the draft has holes. */
  requireComplete(action: string): void {
    if (!this.complete) {
      throw new DraftIncompleteError(
        action,
        this.holes.map((h) => h.name),
      );
    }
  }

  // ── Moves ───────────────────────────────────────────────────────────────

  private candidates(): Candidate[] {
    const found = new Map<string, Candidate>();
    for (const candidate of [
      ...this.attachCandidates(),
      ...this.followCandidates(),
      ...this.eachCandidates(),
      ...this.outputCandidates(),
    ]) {
      if (found.has(candidate.move.name)) continue;
      // The oracle: offered only if the result compiles, holes aside (FAB-VAL-02).
      const compiled = this.host.compile(new Draft(this.host, candidate.state).pipeline());
      if (holesOnly(compiled.diagnostics)) found.set(candidate.move.name, candidate);
    }
    return [...found.values()];
  }

  /** The reference type that names this record, found among its fields. */
  private selfReference(recordType: SemanticTypeId): [string, SemanticTypeId] | undefined {
    const record = this.host.types.get(recordType);
    if (record.kind !== 'record') return undefined;
    for (const [name, field] of record.fields) {
      const type = this.host.types.get(field.type);
      if (type.kind === 'reference' && type.entity === recordType) return [name, field.type];
    }
    return undefined;
  }

  private attachCandidates(): Candidate[] {
    const { cursor } = this.state;
    const types = this.host.types;
    const entity = types.entityOf(cursor.type);
    const attached = [
      ...this.host.catalog.attachedTo(entity),
      ...(entity === cursor.type ? [] : this.host.catalog.attachedTo(cursor.type)),
    ];
    const candidates: Candidate[] = [];
    for (const capability of attached) {
      if (this.host.catalog.get(capability.id) !== capability) continue; // latest only
      const { as, subject } = capability.attach!;
      const subjectType = capability.inputs.get(subject)!.semanticType;
      let from: string | undefined;
      if (subjectType === cursor.type) {
        from = cursor.ref;
      } else {
        // A record feeds a port that wants its reference through its own id field.
        const self = this.selfReference(cursor.type);
        if (self !== undefined && self[1] === subjectType) from = `${cursor.ref}.${self[0]}`;
      }
      if (from === undefined) continue;
      const node = freshNodeId(this.state, as);
      const [output, yields] = firstOutput(capability);
      candidates.push({
        move: {
          name: as,
          kind: 'attach',
          capability: keyOf(capability),
          description: capability.description,
          yields,
        },
        state: {
          ...this.state,
          nodes: [...this.state.nodes, nodeFor(capability, node)],
          edges: [...this.state.edges, { from, to: `${node}.${subject}` }],
          cursor: { ref: `${node}.${output}`, type: yields },
        },
      });
    }
    return candidates;
  }

  private followCandidates(): Candidate[] {
    const { cursor } = this.state;
    const type = this.host.types.get(cursor.type);
    if (type.kind === 'reference') {
      const resolved = this.resolveCandidate(type, cursor.ref, 'details');
      return resolved === undefined ? [] : [resolved];
    }
    if (type.kind !== 'record') return [];
    const candidates: Candidate[] = [];
    for (const [field, spec] of type.fields) {
      const fieldType = this.host.types.get(spec.type);
      // A record's own id is where it came from, not somewhere to go.
      if (fieldType.kind !== 'reference' || fieldType.entity === cursor.type) continue;
      const candidate = this.resolveCandidate(
        fieldType,
        `${cursor.ref}.${field}`,
        followName(field),
      );
      if (candidate !== undefined) candidates.push(candidate);
    }
    return candidates;
  }

  /** The other outputs of the step the cursor is on: moving there adds no step. */
  private outputCandidates(): Candidate[] {
    const parts = this.state.cursor.ref.split('.');
    if (parts.length !== 2) return [];
    const [nodeId, port] = parts as [string, string];
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (node === undefined) return [];
    const capability = this.host.catalog.get(
      capabilityId(node.capability.id),
      node.capability.version,
    );
    const candidates: Candidate[] = [];
    for (const [name, spec] of capability.outputs) {
      if (name === port) continue;
      // A step run per item gives a list of each output.
      const yields =
        node.each === undefined
          ? spec.semanticType
          : semanticTypeId(`${spec.semanticType as string}.collection`);
      candidates.push({
        move: {
          name,
          kind: 'output',
          capability: keyOf(capability),
          description: spec.description ?? `The ${name} output of ${capability.name}`,
          yields,
        },
        state: { ...this.state, cursor: { ref: `${nodeId}.${name}`, type: yields } },
      });
    }
    return candidates;
  }

  /** A step that resolves a reference, read from `from`, to its record. */
  private resolveCandidate(
    reference: ReferenceTypeDefinition,
    from: string,
    name: string,
  ): Candidate | undefined {
    const resolver = reference.resolver;
    if (resolver === undefined || !this.host.catalog.has(capabilityId(resolver.capability))) {
      return undefined;
    }
    const capability = this.host.catalog.get(capabilityId(resolver.capability));
    const node = freshNodeId(this.state, name);
    return {
      move: {
        name,
        kind: name === 'details' ? 'details' : 'follow',
        capability: keyOf(capability),
        description: `Follow to the ${lastSegment(reference.entity)}: ${capability.description}`,
        yields: reference.entity,
      },
      state: {
        ...this.state,
        nodes: [...this.state.nodes, nodeFor(capability, node)],
        edges: [...this.state.edges, { from, to: `${node}.${resolver.input}` }],
        cursor: { ref: `${node}.${resolver.output}`, type: semanticTypeId(reference.entity) },
      },
    };
  }

  /**
   * Moves on a list. A capability that takes one item runs once per item
   * (`cheapest price each`); a capability that takes a list of records is
   * offered on a list of their references, each resolved first.
   */
  private eachCandidates(): Candidate[] {
    const { cursor } = this.state;
    const types = this.host.types;
    const list = types.get(cursor.type);
    if (list.kind !== 'list') return [];
    const item = types.get(list.item);
    const candidates: Candidate[] = [];
    const entity = types.entityOf(item.id);
    const perItem = [
      ...this.host.catalog.attachedTo(entity),
      ...(entity === item.id ? [] : this.host.catalog.attachedTo(item.id)),
    ];
    for (const capability of perItem) {
      if (this.host.catalog.get(capability.id) !== capability) continue; // latest only
      if (capability.source === 'COMPOSITE') continue; // runs as several steps, not per item
      const { as, subject } = capability.attach!;
      if (capability.inputs.get(subject)!.semanticType !== item.id) continue;
      const node = freshNodeId(this.state, `${as} each`);
      const [output, yields] = firstOutput(capability);
      const listed = semanticTypeId(`${yields as string}.collection`);
      candidates.push({
        move: {
          name: `${as} each`,
          kind: 'each',
          capability: keyOf(capability),
          description: `For each item: ${capability.description}`,
          yields: listed,
        },
        state: {
          ...this.state,
          nodes: [...this.state.nodes, { ...nodeFor(capability, node), each: { port: subject } }],
          edges: [...this.state.edges, { from: cursor.ref, to: `${node}.${subject}` }],
          cursor: { ref: `${node}.${output}`, type: listed },
        },
      });
    }
    if (item.kind === 'reference') {
      candidates.push(...this.resolveEach(item, cursor.ref));
    }
    return candidates;
  }

  /** Capabilities on a list of records, reached from a list of their references by resolving each. */
  private resolveEach(reference: ReferenceTypeDefinition, from: string): Candidate[] {
    const resolver = reference.resolver;
    if (resolver === undefined || !this.host.catalog.has(capabilityId(resolver.capability))) {
      return [];
    }
    const records = `${reference.entity as string}.collection`;
    const resolverCapability = this.host.catalog.get(capabilityId(resolver.capability));
    const candidates: Candidate[] = [];
    for (const capability of this.host.catalog.attachedTo(records)) {
      if (this.host.catalog.get(capability.id) !== capability) continue;
      const { as, subject } = capability.attach!;
      if (capability.inputs.get(subject)!.semanticType !== records) continue;
      const each = freshNodeId(this.state, lastSegment(reference.entity));
      const withResolver: DraftState = {
        ...this.state,
        nodes: [
          ...this.state.nodes,
          { ...nodeFor(resolverCapability, each), each: { port: resolver.input } },
        ],
      };
      const node = freshNodeId(withResolver, as);
      const [output, yields] = firstOutput(capability);
      candidates.push({
        move: {
          name: as,
          kind: 'attach',
          capability: keyOf(capability),
          description: capability.description,
          yields,
        },
        state: {
          ...withResolver,
          nodes: [...withResolver.nodes, nodeFor(capability, node)],
          edges: [
            ...this.state.edges,
            { from, to: `${each}.${resolver.input}` },
            { from: `${each}.${resolver.output}`, to: `${node}.${subject}` },
          ],
          cursor: { ref: `${node}.${output}`, type: yields },
        },
      });
    }
    return candidates;
  }

  // ── Holes ───────────────────────────────────────────────────────────────

  /** Required inputs of the draft's own steps that nothing feeds. */
  private findHoles(): readonly Hole[] {
    const wired = new Set(this.state.edges.map((e) => e.to));
    const missing: { node: string; port: string; spec: SemanticPort }[] = [];
    for (const node of this.state.nodes) {
      const ref = node.capability;
      const definition = this.host.catalog.get(capabilityId(ref.id), ref.version);
      for (const [port, spec] of definition.inputs) {
        if (spec.required && !wired.has(`${node.id}.${port}`)) {
          missing.push({ node: node.id, port, spec });
        }
      }
    }
    const portCounts = new Map<string, number>();
    for (const { port } of missing) portCounts.set(port, (portCounts.get(port) ?? 0) + 1);
    return missing.map(({ node, port, spec }): Hole => ({
      name: portCounts.get(port) === 1 ? port : `${node}.${port}`,
      node,
      port,
      type: spec.semanticType,
      description: spec.description,
      choices: (text?: string) => this.choicesFor(spec.semanticType, text),
    }));
  }

  private async choicesFor(type: SemanticTypeId, text?: string): Promise<readonly Choice[]> {
    const definition = this.host.types.get(type);
    if (definition.kind !== 'reference' || definition.choices === undefined) return [];
    const { capability, input, output } = definition.choices;
    if (!this.host.catalog.has(capabilityId(capability))) return [];
    const result = await this.host.runOne(this.host.catalog.get(capabilityId(capability)), {
      [input]: text ?? '',
    });
    const matches = result[output];
    return Array.isArray(matches) ? (matches as Choice[]) : [];
  }
}

/** A deep copy of plain data: arrays and records copied, anything else shared. */
function copyOf<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item: unknown) => copyOf(item)) as T;
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyOf(item)])) as T;
  }
  return value;
}
