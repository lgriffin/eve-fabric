import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { printSchema } from 'graphql';
import { z } from 'zod';
import { isGatewayError, NameNotFoundError, type CapabilityDefinition } from '@eve-fabric/core';
import {
  Draft,
  draftFrom,
  viewOf,
  type DraftRequest,
  type Fabric,
  type FabricIdentity,
} from '@eve-fabric/fabric';
import {
  eveSsoVerifier,
  identityFromAuthorization,
  type TokenVerifier,
} from '../auth/eve-identity.js';

/** The most changes one draft request replays; each one compiles the draft. */
export const MAX_DRAFT_STEPS = 200;
/** The longest move, hole, kind, start or subject name a draft request may send. */
const MAX_NAME = 200;
/** The longest GraphQL document a draft request may send. */
const MAX_DRAFT_DOCUMENT = 20_000;

const changeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move'), move: z.string().min(1).max(MAX_NAME) }),
  z.object({ kind: z.literal('fill'), hole: z.string().min(1).max(MAX_NAME), value: z.unknown() }),
]);

const subjectSchema = z.union([
  z.object({
    kind: z.string().min(1).max(MAX_NAME),
    value: z.union([z.string().min(1).max(MAX_NAME), z.number().int().positive()]),
  }),
  z.object({ start: z.string().min(1).max(MAX_NAME) }),
]);

/** A draft as the client holds it: a GraphQL document, or a subject and its changes. */
export const draftRequestSchema = z.union([
  z.object({ graphql: z.string().min(1).max(MAX_DRAFT_DOCUMENT) }),
  z.object({
    subject: subjectSchema,
    steps: z.array(changeSchema).max(MAX_DRAFT_STEPS).optional(),
  }),
]);

const choicesRequestSchema = z.intersection(
  draftRequestSchema,
  z.object({ hole: z.string().min(1), text: z.string().max(200).optional() }),
);

/** A draft the fabric refused, or a document that is not one. */
const REFUSALS = new Set([
  'MoveNotOfferedError',
  'MoveUnavailableError',
  'FillRejectedError',
  'UnknownSubjectError',
  'DraftIncompleteError',
  'GraphQLDraftError',
  'GraphQLError',
  'ScopeMissingError',
  'CharacterMismatchError',
]);

/** A body that is not a draft request: 400, naming what is wrong. */
class BadDraftRequestError extends Error {
  constructor(issues: z.ZodIssue[]) {
    super(issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
    this.name = 'BadDraftRequestError';
  }
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadDraftRequestError(parsed.error.issues);
  return parsed.data;
}

function refuse(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof BadDraftRequestError) {
    return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
  }
  if (error instanceof Error && error.name === 'InvalidTokenError') {
    return reply.status(401).send({ error: { code: error.name, message: error.message } });
  }
  if (error instanceof Error && REFUSALS.has(error.name)) {
    return reply.status(422).send({ error: { code: error.name, message: error.message } });
  }
  const failed = failedStep(error);
  if (failed === undefined) throw error;
  if (failed.status >= 500) reply.log.error({ err: error }, 'Draft step failed at its source');
  else reply.log.warn({ err: error }, 'Draft step refused a name');
  return reply.status(failed.status).send({ error: failed });
}

/** The error and what caused it, as far down as the gateway's handler looks. */
function causes(error: Error): Error[] {
  const chain: Error[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

/**
 * A step that failed for a reason the caller can act on. A name or id that
 * names nothing (its message says what was probably meant) is 422, and a
 * source that answered with an HTTP error is 502. Anything else, typed
 * gateway errors included (a rate limit, a missing scope), goes to the
 * gateway's error handler, which answers for it and masks what it must.
 */
function failedStep(
  error: unknown,
): { readonly status: number; readonly code: string; readonly message: string } | undefined {
  if (!(error instanceof Error) || error.name !== 'StepExecutionError') return undefined;
  const chain = causes(error);
  if (chain.some(isGatewayError)) return undefined;
  if (chain.some((e) => e instanceof NameNotFoundError)) {
    return { status: 422, code: 'NOT_FOUND', message: error.message };
  }
  if (chain.some((e) => typeof (e as { statusCode?: unknown }).statusCode === 'number')) {
    return { status: 502, code: 'SOURCE_FAILED', message: error.message };
  }
  return undefined;
}

/** A capability a draft can start from: every input optional. */
function needsNothing(capability: CapabilityDefinition): boolean {
  return [...capability.inputs.values()].every((port) => !port.required);
}

/**
 * Drafts over HTTP. The client sends what a draft started from and the
 * changes made to it; the fabric replays them and answers with what to show.
 * No draft is kept here, so any client holds its own and undo is dropping
 * the last change.
 */
export function createDraftRoutes(
  fabric: Fabric,
  options: { readonly verifier?: TokenVerifier | undefined } = {},
): (app: FastifyInstance) => void {
  const verifier = options.verifier ?? eveSsoVerifier(fabric.clock);
  const caller = (req: FastifyRequest): Promise<FabricIdentity | undefined> =>
    identityFromAuthorization(req.headers.authorization, verifier);
  return (app: FastifyInstance) => {
    app.get('/api/drafts/subjects', async () => ({
      kinds: Draft.subjects(fabric).map((s) => ({ kind: s.kind, type: s.type })),
      starts: fabric
        .describe()
        .capabilities.filter(needsNothing)
        .map((c) => ({ name: c.name, description: c.description })),
    }));

    app.post('/api/drafts', async (req, reply) => {
      try {
        const request = parseBody(draftRequestSchema, req.body) as DraftRequest;
        return viewOf(draftFrom(fabric, request, await caller(req)));
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.post('/api/drafts/choices', async (req, reply) => {
      try {
        const request = parseBody(choicesRequestSchema, req.body);
        const draft = draftFrom(fabric, request as DraftRequest, await caller(req));
        const hole = draft.holes.find((h) => h.name === request.hole);
        if (hole === undefined) {
          return await reply.status(422).send({
            error: { code: 'NO_SUCH_HOLE', message: `"${request.hole}" is not a hole` },
          });
        }
        return { choices: await hole.choices(request.text) };
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.post('/api/drafts/run', async (req, reply) => {
      try {
        const request = parseBody(draftRequestSchema, req.body) as DraftRequest;
        const draft = draftFrom(fabric, request, await caller(req));
        const { answer } = await fabric.query(draft);
        return { answer, view: viewOf(draft) };
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.get('/api/drafts/schema', async (_req, reply) =>
      reply.type('text/plain').send(printSchema(fabric.schema())),
    );
  };
}
