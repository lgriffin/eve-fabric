import type { FastifyInstance, FastifyReply } from 'fastify';
import { printSchema } from 'graphql';
import type { CapabilityDefinition } from '@eve-fabric/domain';
import { Draft, draftFrom, viewOf, type DraftRequest, type Fabric } from '@eve-fabric/fabric';
import { identityFromAuthorization } from '../auth/eve-identity.js';

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
]);

function refuse(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof Error && REFUSALS.has(error.name)) {
    return reply.status(422).send({ error: { code: error.name, message: error.message } });
  }
  throw error;
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
export function createDraftRoutes(fabric: Fabric): (app: FastifyInstance) => void {
  return (app: FastifyInstance) => {
    app.get('/api/drafts/subjects', async () => ({
      kinds: Draft.subjects(fabric).map((s) => ({ kind: s.kind, type: s.type })),
      starts: fabric
        .describe()
        .capabilities.filter(needsNothing)
        .map((c) => ({ name: c.name, description: c.description })),
    }));

    app.post<{ Body: DraftRequest }>('/api/drafts', async (req, reply) => {
      try {
        const as = identityFromAuthorization(req.headers.authorization);
        return viewOf(draftFrom(fabric, req.body, as));
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.post<{ Body: DraftRequest & { hole: string; text?: string } }>(
      '/api/drafts/choices',
      async (req, reply) => {
        try {
          const draft = draftFrom(fabric, req.body);
          const hole = draft.holes.find((h) => h.name === req.body.hole);
          if (hole === undefined) {
            return await reply.status(422).send({
              error: { code: 'NO_SUCH_HOLE', message: `"${req.body.hole}" is not a hole` },
            });
          }
          return { choices: await hole.choices(req.body.text) };
        } catch (error) {
          return refuse(reply, error);
        }
      },
    );

    app.post<{ Body: DraftRequest }>('/api/drafts/run', async (req, reply) => {
      try {
        const as = identityFromAuthorization(req.headers.authorization);
        const draft = draftFrom(fabric, req.body, as);
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
