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
  SemanticTypeId,
  SemanticTypeRegistry,
} from '@eve-fabric/domain';
import { capabilityId, semanticTypeId } from '@eve-fabric/domain';
import type { CompileResult, CompilerDiagnostic } from '@eve-fabric/compiler';

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
  /** `attach`: a capability hung on the cursor's type. `follow`: a reference field, resolved. */
  readonly kind: 'attach' | 'follow' | 'details';
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
}

/** What a complete draft would do, before anything is sent. */
export interface DraftPlan {
  readonly steps: readonly PlannedStep[];
  /** ESI calls the plan makes. */
  readonly esiCalls: number;
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

  /** A draft from a subject picked by name or id: `{ type: 'Tritanium' }`. */
  static start(host: DraftHost, subject: Readonly<Record<string, string | number>>): Draft {
    const entries = Object.entries(subject);
    if (entries.length !== 1) {
      throw new UnknownSubjectError(
        'A draft starts from one subject, such as { type: "Tritanium" }',
      );
    }
    const [kind, value] = entries[0]!;
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
    return {
      id: 'draft',
      version: 1,
      name: 'Draft',
      inputs: this.state.inputs,
      nodes: this.state.nodes,
      edges: this.state.edges,
      outputs: [{ name: 'answer', source: this.state.cursor.ref }],
    };
  }

  /** The values filled into the draft, by pipeline input name. */
  get values(): Readonly<Record<string, unknown>> {
    return this.state.values;
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
    const lookup = typeof value === 'string' ? Draft.lookupFor(this.host, hole.type) : undefined;
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
      const check = this.host.types.check(hole.type, value);
      if (!check.ok) throw new FillRejectedError(name, `not a ${hole.type}: ${check.message}`);
      const parsed = check.value;
      const input = inputName(this.state, hole.node, hole.port);
      next = {
        ...this.state,
        edges: [...this.state.edges, { from: `input.${input}`, to: target }],
        inputs: [...this.state.inputs, { name: input, semanticType: hole.type, required: true }],
        values: { ...this.state.values, [input]: parsed },
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
    const steps = plan.steps.map((step): PlannedStep => {
      const capability = this.host.catalog.get(step.capability.id, step.capability.version);
      if (capability.source === 'ESI') esiCalls += capability.cost.esiCallCount;
      return {
        id: step.id,
        capability: keyOf(capability),
        source: capability.source,
        waitsFor: [...step.dependsOn],
      };
    });
    return { steps, esiCalls, scopes: [...plan.authRequirements.scopes], plan };
  }

  /** The complete draft as a pipeline and the values that go with it, for publishing or export. */
  toPipeline(): {
    readonly pipeline: PipelineDefinition;
    readonly values: Readonly<Record<string, unknown>>;
  } {
    this.requireComplete('export');
    return { pipeline: this.pipeline(), values: this.state.values };
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
    for (const candidate of [...this.attachCandidates(), ...this.followCandidates()]) {
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

  // ── Holes ───────────────────────────────────────────────────────────────

  private findHoles(): readonly Hole[] {
    const compiled = this.host.compile(this.pipeline());
    const missing = compiled.diagnostics.filter(
      (d) => d.code === 'MISSING_INPUT' && d.location?.nodeId !== undefined,
    );
    const nodes = new Map(this.state.nodes.map((n) => [n.id, n]));
    const portCounts = new Map<string, number>();
    for (const d of missing) {
      const port = d.location!.field!;
      portCounts.set(port, (portCounts.get(port) ?? 0) + 1);
    }
    return missing.map((d): Hole => {
      const node = d.location!.nodeId!;
      const port = d.location!.field!;
      const ref = nodes.get(node)!.capability;
      const definition = this.host.catalog.get(capabilityId(ref.id), ref.version);
      const spec = definition.inputs.get(port)!;
      return {
        name: portCounts.get(port) === 1 ? port : `${node}.${port}`,
        node,
        port,
        type: spec.semanticType,
        description: spec.description,
        choices: (text?: string) => this.choicesFor(spec.semanticType, text),
      };
    });
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
