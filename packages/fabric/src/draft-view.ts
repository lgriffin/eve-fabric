/**
 * A draft over the wire. A front end (the designer, a chat, a CLI) holds only
 * what a draft started from and the changes made to it; the fabric replays
 * them and answers with a plain view. Nothing is built anywhere else, so a
 * front end never needs rules of its own about what connects to what.
 */
import type { PipelineDefinition } from '@eve-fabric/domain';
import {
  Draft,
  type DraftStep,
  type DraftSubject,
  type FabricIdentity,
  type Move,
  type PlannedStep,
} from './draft.js';
import type { Fabric } from './fabric.js';

/** One change, as a front end sends it. */
export type DraftChange =
  | { readonly kind: 'move'; readonly move: string }
  | { readonly kind: 'fill'; readonly hole: string; readonly value: unknown };

/** A draft to rebuild: from a subject and changes, or from a GraphQL document. */
export type DraftRequest =
  | { readonly subject: DraftSubject; readonly steps?: readonly DraftChange[] | undefined }
  | { readonly graphql: string };

export interface HoleView {
  readonly name: string;
  readonly node: string;
  readonly port: string;
  readonly type: string;
  readonly description?: string | undefined;
}

/** Everything a front end shows of a draft. */
export interface DraftView {
  readonly subject: DraftSubject;
  readonly steps: readonly DraftStep[];
  readonly cursor: { readonly ref: string; readonly type: string };
  readonly complete: boolean;
  readonly moves: readonly Move[];
  readonly holes: readonly HoleView[];
  readonly pipeline: PipelineDefinition;
  readonly values: Readonly<Record<string, unknown>>;
  /** The saved form; present once the draft is complete. */
  readonly graphql?: string | undefined;
  /** Present once the draft is complete. */
  readonly plan?:
    | {
        readonly steps: readonly PlannedStep[];
        readonly esiCalls: number;
        readonly maxEsiCalls: number;
        readonly scopes: readonly string[];
      }
    | undefined;
}

/** The draft a request describes, held to the same rules as one built by hand. */
export function draftFrom(fabric: Fabric, request: DraftRequest, identity?: FabricIdentity): Draft {
  if ('graphql' in request) return fabric.fromGraphQL(request.graphql, { as: identity });
  return Draft.replay(fabric, request.subject, request.steps ?? [], identity);
}

export function viewOf(draft: Draft): DraftView {
  const base = {
    subject: draft.subject,
    steps: draft.steps,
    cursor: { ref: draft.cursor.ref, type: draft.cursor.type },
    complete: draft.complete,
    moves: draft.moves(),
    holes: draft.holes.map((h) => ({
      name: h.name,
      node: h.node,
      port: h.port,
      type: h.type,
      description: h.description,
    })),
    pipeline: draft.pipeline(),
    values: draft.values,
  };
  if (!draft.complete) return base;
  const { steps, esiCalls, maxEsiCalls, scopes } = draft.plan();
  return {
    ...base,
    graphql: draft.toGraphQL(),
    plan: { steps, esiCalls, maxEsiCalls, scopes },
  };
}
