import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { draftFrom, type DraftRequest, type Fabric } from '@eve-fabric/fabric';
import { weaveToYaml } from '@eve-fabric/weave';
import { draftRequestSchema } from './draft-routes.js';
import {
  eveSsoVerifier,
  identityFromAuthorization,
  type TokenVerifier,
} from '../auth/eve-identity.js';

/** A weave the fabric refused, or a draft it cannot make one of. */
const REFUSALS = new Set([
  'WeaveFormatError',
  'WeaveDigestError',
  'WeaveSecretError',
  'WeaveNotFoundError',
  'WeaveRequirementError',
  'WeaveMismatchError',
  'WeaveRefusedError',
  'PublishRefusedError',
  'InvalidAttachError',
  'DraftIncompleteError',
  'MoveNotOfferedError',
  'MoveUnavailableError',
  'FillRejectedError',
  'UnknownSubjectError',
  'GraphQLDraftError',
  'GraphQLError',
  'ScopeMissingError',
  'CharacterMismatchError',
]);

/** The longest weave document the gateway reads. */
const MAX_WEAVE_DOCUMENT = 200_000;

const ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const VERSION = /^\d+\.\d+\.\d+$/;

const addSchema = z.union([
  z.object({ document: z.string().min(1).max(MAX_WEAVE_DOCUMENT) }),
  z.object({ ref: z.string().min(1).max(200) }),
]);

const idParamsSchema = z.object({ id: z.string().regex(ID, 'Must be a dot-notation weave id') });
const versionQuerySchema = z.object({
  version: z.string().regex(VERSION, 'Must be x.y.z').optional(),
});
const versionRequiredSchema = z.object({ version: z.string().regex(VERSION, 'Must be x.y.z') });

const weaveOptionsSchema = z.object({
  id: z.string().regex(ID, 'Must be a dot-notation weave id'),
  version: z.string().regex(VERSION, 'Must be x.y.z'),
  as: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const draftWeaveSchema = z.intersection(
  draftRequestSchema,
  z.object({ weave: weaveOptionsSchema }),
);

/** A request that is not one these routes take: 400, naming what is wrong. */
class BadWeaveRequestError extends Error {
  constructor(issues: z.ZodIssue[]) {
    super(issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
    this.name = 'BadWeaveRequestError';
  }
}

function parsed<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadWeaveRequestError(result.error.issues);
  return result.data;
}

function refuse(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof BadWeaveRequestError) {
    return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
  }
  if (error instanceof Error && error.name === 'InvalidTokenError') {
    return reply.status(401).send({ error: { code: error.name, message: error.message } });
  }
  if (error instanceof Error && error.name === 'WeaveNotFoundError') {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
  }
  if (error instanceof Error && REFUSALS.has(error.name)) {
    return reply.status(422).send({ error: { code: error.name, message: error.message } });
  }
  throw error;
}

const YAML = 'application/yaml';

/**
 * Weaves over HTTP: add one (its YAML, or `id@range` from the fabric's
 * index), list what was added, remove one, and export a published weave or
 * a draft. A draft is replayed as the character its bearer token names, as
 * the draft routes do, so a question that used a scoped move still shares.
 */
export function createWeaveRoutes(
  fabric: Fabric,
  options: { readonly verifier?: TokenVerifier | undefined } = {},
): (app: FastifyInstance) => void {
  const verifier = options.verifier ?? eveSsoVerifier(fabric.clock);
  return (app: FastifyInstance) => {
    app.get('/api/weaves', async () => ({ weaves: fabric.weaves() }));

    app.post('/api/weaves', async (req, reply) => {
      try {
        const body = parsed(addSchema, req.body);
        const capability = await fabric.add('document' in body ? body.document : body.ref);
        return await reply.status(201).send({ id: capability.id, version: capability.version });
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.get('/api/weaves/:id', async (req, reply) => {
      try {
        const { id } = parsed(idParamsSchema, req.params);
        const { version } = parsed(versionQuerySchema, req.query);
        const text = weaveToYaml(fabric.export(id, version));
        return await reply.type(YAML).send(text);
      } catch (error) {
        if (error instanceof Error && /not found/i.test(error.message)) {
          return reply.status(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
        }
        return refuse(reply, error);
      }
    });

    app.delete('/api/weaves/:id', async (req, reply) => {
      try {
        const { id } = parsed(idParamsSchema, req.params);
        const { version } = parsed(versionRequiredSchema, req.query);
        await fabric.remove(id, version);
        return await reply.status(204).send();
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.post('/api/drafts/weave', async (req, reply) => {
      try {
        const body = parsed(draftWeaveSchema, req.body);
        const identity = await identityFromAuthorization(req.headers.authorization, verifier);
        const draft = draftFrom(fabric, body as DraftRequest, identity);
        // Made before the reply is typed, so a refusal still goes out as JSON.
        const text = weaveToYaml(fabric.export(fabric.weave(draft, body.weave)));
        return await reply.type(YAML).send(text);
      } catch (error) {
        return refuse(reply, error);
      }
    });
  };
}
