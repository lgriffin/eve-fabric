import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CapabilityCatalog, SemanticTypeId } from '@eve-fabric/core';
import { DiscoveryEngine, semanticTypeId } from '@eve-fabric/core';
import type { CapabilityId } from '@eve-fabric/core';

const SEMANTIC_TYPE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

function serializeStep(s: {
  capabilityId: string;
  capabilityName: string;
  inputPort: string;
  inputType: string;
  outputPort: string;
  outputType: string;
}): Record<string, string> {
  return {
    capabilityId: s.capabilityId,
    capabilityName: s.capabilityName,
    inputPort: s.inputPort,
    inputType: s.inputType,
    outputPort: s.outputPort,
    outputType: s.outputType,
  };
}

const pathsBodySchema = z.object({
  sourceType: z.string().regex(SEMANTIC_TYPE_PATTERN),
  targetType: z.string().regex(SEMANTIC_TYPE_PATTERN),
  maxDepth: z.number().int().min(1).max(10).optional().default(5),
  maxResults: z.number().int().min(1).max(20).optional().default(5),
});

const suggestBodySchema = z.object({
  availableOutputTypes: z.array(z.string().regex(SEMANTIC_TYPE_PATTERN)),
  existingCapabilityIds: z.array(z.string()).optional().default([]),
  maxResults: z.number().int().min(1).max(50).optional().default(20),
});

const searchBodySchema = z.object({
  query: z.string().min(1),
  availableOutputTypes: z.array(z.string().regex(SEMANTIC_TYPE_PATTERN)).optional(),
  maxResults: z.number().int().min(1).max(50).optional().default(20),
});

const autoCompleteBodySchema = z.object({
  targetCapabilityId: z.string().min(1),
  availableOutputTypes: z.array(z.string().regex(SEMANTIC_TYPE_PATTERN)),
  existingCapabilityIds: z.array(z.string()).optional().default([]),
  maxDepth: z.number().int().min(1).max(10).optional().default(5),
});

export function createDiscoveryRoutes(catalog: CapabilityCatalog) {
  const engine = new DiscoveryEngine(catalog);

  return async function discoveryRoutes(app: FastifyInstance): Promise<void> {
    app.get<{ Params: { semanticType: string } }>(
      '/api/discovery/consumers/:semanticType',
      async (req, reply) => {
        if (!SEMANTIC_TYPE_PATTERN.test(req.params.semanticType)) {
          return reply.status(400).send({
            error: 'INVALID_SEMANTIC_TYPE',
            message: 'Semantic type must be lowercase dot-notation',
          });
        }

        const type = semanticTypeId(req.params.semanticType);
        const consumers = engine.findConsumers(type);

        return reply.status(200).send({
          semanticType: req.params.semanticType,
          consumers: consumers.map((s) => ({
            id: s.capabilityId,
            version: s.capabilityVersion,
            name: s.capabilityName,
            description: s.capabilityDescription,
            source: s.capabilitySource,
            explanation: s.explanation,
          })),
          count: consumers.length,
        });
      },
    );

    app.get<{ Params: { semanticType: string } }>(
      '/api/discovery/producers/:semanticType',
      async (req, reply) => {
        if (!SEMANTIC_TYPE_PATTERN.test(req.params.semanticType)) {
          return reply.status(400).send({
            error: 'INVALID_SEMANTIC_TYPE',
            message: 'Semantic type must be lowercase dot-notation',
          });
        }

        const type = semanticTypeId(req.params.semanticType);
        const producers = engine.findProducers(type);

        return reply.status(200).send({
          semanticType: req.params.semanticType,
          producers: producers.map((s) => ({
            id: s.capabilityId,
            version: s.capabilityVersion,
            name: s.capabilityName,
            explanation: s.explanation,
          })),
          count: producers.length,
        });
      },
    );

    app.post('/api/discovery/paths', async (req, reply) => {
      const parsed = pathsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      const { sourceType, targetType, maxDepth, maxResults } = parsed.data;
      const paths = engine.findPaths(sourceType as SemanticTypeId, targetType as SemanticTypeId, {
        maxDepth,
        maxResults,
      });

      return reply.status(200).send({
        sourceType,
        targetType,
        paths: paths.map((p) => ({
          steps: p.steps.map(serializeStep),
          length: p.length,
          totalEstimatedCost: p.totalEstimatedCost,
          requiresAuth: p.requiresAuth,
        })),
        count: paths.length,
      });
    });

    app.post('/api/discovery/suggest', async (req, reply) => {
      const parsed = suggestBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      const { availableOutputTypes, existingCapabilityIds, maxResults } = parsed.data;
      const flowContext = {
        availableOutputTypes: new Set(availableOutputTypes.map((t) => t as SemanticTypeId)),
        existingCapabilityIds: new Set(existingCapabilityIds.map((id) => id as CapabilityId)),
        nodeOutputs: new Map<string, readonly SemanticTypeId[]>(),
      };

      const suggestions = engine.suggestNext(flowContext, { maxResults });

      return reply.status(200).send({
        suggestions: suggestions.map((s) => ({
          capabilityId: s.capabilityId,
          capabilityName: s.capabilityName,
          readiness: s.readiness,
          satisfiedInputs: s.satisfiedInputs,
          unsatisfiedInputs: s.unsatisfiedInputs,
          relevance: s.relevance,
          matchReason: s.matchReason,
          explanation: s.explanation,
        })),
        count: suggestions.length,
      });
    });

    app.post('/api/discovery/search', async (req, reply) => {
      const parsed = searchBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      const { query, availableOutputTypes, maxResults } = parsed.data;
      const flowContext = availableOutputTypes
        ? {
            availableOutputTypes: new Set(availableOutputTypes.map((t) => t as SemanticTypeId)),
            existingCapabilityIds: new Set<CapabilityId>(),
            nodeOutputs: new Map<string, readonly SemanticTypeId[]>(),
          }
        : undefined;

      const results = engine.search(query, flowContext);

      return reply.status(200).send({
        query,
        results: results.slice(0, maxResults).map((s) => ({
          capabilityId: s.capabilityId,
          capabilityName: s.capabilityName,
          description: s.capabilityDescription,
          readiness: s.readiness,
          satisfiedInputs: s.satisfiedInputs,
          unsatisfiedInputs: s.unsatisfiedInputs,
          matchReason: s.matchReason,
          explanation: s.explanation,
        })),
        count: Math.min(results.length, maxResults),
      });
    });

    app.post('/api/discovery/auto-complete', async (req, reply) => {
      const parsed = autoCompleteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      const { targetCapabilityId, availableOutputTypes, existingCapabilityIds } = parsed.data;
      const flowContext = {
        availableOutputTypes: new Set(availableOutputTypes.map((t) => t as SemanticTypeId)),
        existingCapabilityIds: new Set(existingCapabilityIds.map((id) => id as CapabilityId)),
        nodeOutputs: new Map<string, readonly SemanticTypeId[]>(),
      };

      const proposal = engine.autoComplete(flowContext, targetCapabilityId as CapabilityId);

      return reply.status(200).send({
        proposal: proposal
          ? {
              proposalType: proposal.proposalType,
              capabilitiesToInsert: proposal.capabilitiesToInsert,
              explanation: proposal.explanation,
            }
          : null,
      });
    });
  };
}
