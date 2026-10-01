import type { FastifyInstance, FastifyReply } from 'fastify';
import { draftFrom, type DraftRequest, type Fabric, type WeaveOptions } from '@eve-fabric/fabric';
import { weaveToYaml } from '@eve-fabric/weave';

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
  'DraftIncompleteError',
  'MoveNotOfferedError',
  'FillRejectedError',
  'UnknownSubjectError',
  'GraphQLDraftError',
]);

function refuse(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof Error && REFUSALS.has(error.name)) {
    return reply.status(422).send({ error: { code: error.name, message: error.message } });
  }
  throw error;
}

const YAML = 'application/yaml';

/**
 * Weaves over HTTP: add one (its YAML, or `id@range` from the fabric's
 * index), list what was added, and export a published weave or a draft.
 */
export function createWeaveRoutes(fabric: Fabric): (app: FastifyInstance) => void {
  return (app: FastifyInstance) => {
    app.get('/api/weaves', async () => ({ weaves: fabric.weaves() }));

    app.post<{ Body: { document?: string; ref?: string } }>('/api/weaves', async (req, reply) => {
      const source = req.body.document ?? req.body.ref;
      if (source === undefined) {
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: 'Send the weave as `document`, or `ref`' },
        });
      }
      try {
        const capability = await fabric.add(source);
        return await reply.status(201).send({ id: capability.id, version: capability.version });
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.get<{ Params: { id: string }; Querystring: { version?: string } }>(
      '/api/weaves/:id',
      async (req, reply) => {
        try {
          const text = weaveToYaml(fabric.export(req.params.id, req.query.version));
          return await reply.type(YAML).send(text);
        } catch (error) {
          if (error instanceof Error && /not found/i.test(error.message)) {
            return reply.status(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
          }
          return refuse(reply, error);
        }
      },
    );

    app.post<{ Body: DraftRequest & { weave: WeaveOptions } }>(
      '/api/drafts/weave',
      async (req, reply) => {
        try {
          const draft = draftFrom(fabric, req.body);
          // Made before the reply is typed, so a refusal still goes out as JSON.
          const text = weaveToYaml(fabric.export(fabric.weave(draft, req.body.weave)));
          return await reply.type(YAML).send(text);
        } catch (error) {
          return refuse(reply, error);
        }
      },
    );
  };
}
