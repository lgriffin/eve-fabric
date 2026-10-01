/**
 * Weaves: a complete draft or a published composite, as data someone else
 * can add to their fabric. A weave carries a pipeline and what it needs; no
 * code, so adding one runs nothing the operator did not already install.
 */
import {
  capabilityId,
  capabilityVersion,
  type CapabilityCatalog,
  type CapabilityDefinition,
  type PipelineDefinition,
  type PipelineInput,
  type SemanticTypeId,
  type SemanticTypeRegistry,
} from '@eve-fabric/core';
import type { Weave } from '@eve-fabric/kit';
import { highestSatisfying, type WeaveBody, type WeaveFile } from '@eve-fabric/weave';
import { DraftIncompleteError, type Draft } from './draft.js';

/** What a draft is published as. */
export interface WeaveOptions {
  readonly id: string;
  readonly version: string;
  /** The move name it is offered under on what the draft started from. */
  readonly as?: string | undefined;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
}

/** A capability the weave requires is not here in a version its range accepts. */
export class WeaveRequirementError extends Error {
  constructor(
    readonly capability: string,
    readonly range: string,
    found: readonly string[],
  ) {
    super(
      `The weave requires ${capability} ${range}; this fabric has ${
        found.length === 0 ? 'none' : found.join(', ')
      }`,
    );
    this.name = 'WeaveRequirementError';
  }
}

/** What the weave says about itself is not what compiling it here finds. */
export class WeaveMismatchError extends Error {
  constructor(
    readonly field: string,
    declared: unknown,
    computed: unknown,
  ) {
    super(
      `The weave declares ${field} ${JSON.stringify(declared)} but compiles here to ${JSON.stringify(computed)}`,
    );
    this.name = 'WeaveMismatchError';
  }
}

/** A weave this fabric will not make or take. */
export class WeaveRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'WeaveRefusedError';
  }
}

interface Lookup {
  /** The pipeline input the name was typed into. */
  readonly input: string;
  readonly output: string;
  readonly type: SemanticTypeId;
}

/**
 * The nodes that look a name up: fed only by a pipeline input, on a port that
 * takes a name. A weave takes what they find instead, as a reference.
 */
function lookupsOf(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
): ReadonlyMap<string, Lookup> {
  const lookups = new Map<string, Lookup>();
  for (const node of pipeline.nodes) {
    const incoming = pipeline.edges.filter((e) => e.to.startsWith(`${node.id}.`));
    const [edge] = incoming;
    if (incoming.length !== 1 || !edge!.from.startsWith('input.')) continue;
    const capability = catalog.get(node.capability.id, node.capability.version);
    const port = edge!.to.slice(node.id.length + 1);
    if (capability.inputs.get(port)?.acceptsName !== true) continue;
    const input = edge!.from.slice('input.'.length);
    const declared = pipeline.inputs.find((i) => i.name === input);
    const [output] = [...capability.outputs.keys()];
    if (declared === undefined || output === undefined) continue;
    lookups.set(node.id, { input, output, type: declared.semanticType });
  }
  return lookups;
}

function rewrite(ref: string, lookups: ReadonlyMap<string, Lookup>): string {
  const [node, port, ...fields] = ref.split('.');
  const lookup = lookups.get(node!);
  if (lookup === undefined || lookup.output !== port) return ref;
  return ['input', node!, ...fields].join('.');
}

/** The weave a complete draft makes: its typed names become reference inputs. */
export function weaveFromDraft(
  draft: Draft,
  catalog: CapabilityCatalog,
  types: SemanticTypeRegistry,
  options: WeaveOptions,
): Weave {
  if (!draft.complete)
    throw new DraftIncompleteError(
      'export',
      draft.holes.map((h) => h.name),
    );
  const pipeline = draft.pipeline();
  const lookups = lookupsOf(pipeline, catalog);
  const cursor = draft.cursor.ref.split('.');
  if (lookups.has(cursor[0]!) || cursor.length !== 2) {
    throw new WeaveRefusedError(
      'A weave ends on what a move gives, not on the subject or a field of a record',
    );
  }
  const typed = new Set([...lookups.values()].map((l) => l.input));
  const inputs: PipelineInput[] = [
    ...pipeline.inputs.filter((i) => !typed.has(i.name)),
    ...[...lookups].map(([node, l]) => ({ name: node, semanticType: l.type, required: true })),
  ];
  // The subject is a typed name the draft looked up, or the input it was started at.
  const [originNode, originPort] = draft.origin.split('.');
  const started =
    originNode === 'input' ? pipeline.inputs.find((i) => i.name === originPort) : undefined;
  const subject = started?.name ?? originNode!;
  const subjectType = lookups.get(subject)?.type ?? started?.semanticType;
  if (subjectType === undefined) {
    throw new WeaveRefusedError(`A weave cannot start from ${draft.origin}`);
  }
  const reference = types.get(subjectType);
  const attach =
    options.as === undefined || reference.kind !== 'reference'
      ? undefined
      : { on: reference.entity as string, as: options.as, subject };
  const name = options.name ?? options.as ?? options.id;
  return {
    pipeline: {
      // Pipeline ids take hyphens where capability ids take dots.
      id: options.id.replaceAll('.', '-'),
      version: 1,
      name,
      description: options.description,
      inputs,
      nodes: pipeline.nodes.filter((n) => !lookups.has(n.id)),
      edges: pipeline.edges
        .filter((e) => !lookups.has(e.to.split('.')[0]!))
        .map((e) => ({ ...e, from: rewrite(e.from, lookups) })),
      outputs: [{ name: cursor[1]!, source: draft.cursor.ref }],
    },
    capability: {
      id: options.id,
      version: options.version,
      name,
      description: options.description ?? name,
      ...(attach === undefined ? {} : { attach }),
    },
  };
}

/** The capability a node runs, at the version it names or the newest. */
function capabilityOf(
  catalog: CapabilityCatalog,
  node: PipelineDefinition['nodes'][number],
): CapabilityDefinition {
  return catalog.get(node.capability.id, node.capability.version);
}

/** What a weave gives: each output's type, as the composite will declare it. */
function outputsOf(weave: Weave, catalog: CapabilityCatalog): Record<string, string> {
  const out: Record<string, string> = {};
  for (const output of weave.pipeline.outputs) {
    const [nodeId, port] = output.source.split('.');
    const node = weave.pipeline.nodes.find((n) => n.id === nodeId);
    if (node === undefined) continue;
    const type = capabilityOf(catalog, node).outputs.get(port!)?.semanticType;
    if (type !== undefined) {
      out[output.name] = node.each === undefined ? type : `${type}.collection`;
    }
  }
  return out;
}

/** Everything about a weave this fabric can compute: all of the file but its digest. */
export function describeWeave(
  weave: Weave,
  catalog: CapabilityCatalog,
  scopes: readonly string[],
  verifiedAgainst: WeaveBody['verifiedAgainst'],
): WeaveBody {
  const requires: Record<string, string> = {};
  for (const node of weave.pipeline.nodes) {
    requires[node.capability.id] = `^${capabilityOf(catalog, node).version}`;
  }
  return {
    format: 2,
    id: weave.capability.id,
    version: weave.capability.version,
    name: weave.capability.name,
    description: weave.capability.description,
    provides: {
      ...(weave.capability.attach === undefined ? {} : { attach: weave.capability.attach }),
      in: Object.fromEntries(weave.pipeline.inputs.map((i) => [i.name, i.semanticType as string])),
      out: outputsOf(weave, catalog),
    },
    requires,
    scopes: [...scopes].sort((a, b) => a.localeCompare(b)),
    verifiedAgainst,
    pipeline: weave.pipeline,
  };
}

/**
 * The weave as it will run here: each node at the newest local version its
 * requirement accepts. Throws when a requirement has no such version.
 */
export function localWeave(file: WeaveFile, catalog: CapabilityCatalog): Weave {
  const pinned = new Map<string, string>();
  for (const [id, range] of Object.entries(file.requires)) {
    const versions = catalog.has(capabilityId(id))
      ? catalog
          .list()
          .filter((c) => c.id === id)
          .map((c) => c.version as string)
      : [];
    const version = highestSatisfying(versions, range);
    if (version === undefined) throw new WeaveRequirementError(id, range, versions);
    pinned.set(id, version);
  }
  const nodes = file.pipeline.nodes.map((node) => {
    const version = pinned.get(node.capability.id);
    if (version === undefined) {
      throw new WeaveRequirementError(node.capability.id, '(not listed in requires)', []);
    }
    return { ...node, capability: { ...node.capability, version: capabilityVersion(version) } };
  });
  return {
    pipeline: { ...file.pipeline, nodes },
    capability: {
      id: file.id,
      version: file.version,
      name: file.name,
      description: file.description,
      ...(file.provides.attach === undefined ? {} : { attach: file.provides.attach }),
    },
  };
}
