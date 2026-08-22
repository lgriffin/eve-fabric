import type { FastifyInstance } from 'fastify';
import type { PipelineDefinition, ExecutionPlan } from '@eve-fabric/domain';
import { capabilityId as toCapabilityId, capabilityVersion } from '@eve-fabric/domain';
import { compile } from '@eve-fabric/compiler';
import type { GatewayRuntime } from '../runtime.js';

export function createExecutionRoutes(runtime: GatewayRuntime): (app: FastifyInstance) => void {
  return (app: FastifyInstance) => {
    // Single-capability execution via compile -> execute
    app.post<{
      Params: { id: string };
      Body: { inputs: Record<string, { value: unknown; semanticType: string }> };
    }>('/api/capabilities/:id/execute', async (req, reply) => {
      const capId = req.params.id;
      const { inputs } = req.body ?? { inputs: {} };

      const capabilities = runtime.catalog.list();
      const capability = capabilities.find((c) => (c.id as string) === capId);

      if (!capability) {
        return reply.status(404).send({
          error: {
            code: 'CAPABILITY_NOT_FOUND',
            message: `Capability '${capId}' not found`,
            details: null,
          },
        });
      }

      const missingInputs: string[] = [];
      for (const [name, port] of capability.inputs) {
        if (port.required && !(name in inputs)) {
          missingInputs.push(name);
        }
      }

      if (missingInputs.length > 0) {
        return reply.status(400).send({
          error: {
            code: 'MISSING_INPUT',
            message: `Missing required input(s): ${missingInputs.join(', ')}`,
            details: { missingInputs },
          },
        });
      }

      const pipeline: PipelineDefinition = {
        id: `exec-${capId}`,
        version: 1,
        name: `Execute ${capability.name}`,
        inputs: [...capability.inputs.values()].map((p) => ({
          name: p.name,
          semanticType: p.semanticType,
          required: p.required,
        })),
        nodes: [
          {
            id: 'node-1',
            capability: { id: capability.id, version: capability.version },
          },
        ],
        edges: [...capability.inputs.values()].map((p) => ({
          from: `input.${p.name}`,
          to: `node-1.${p.name}`,
        })),
        outputs: [...capability.outputs.values()].map((p) => ({
          name: p.name,
          source: `node-1.${p.name}`,
        })),
      };

      const compileResult = compile(pipeline, runtime.catalog);
      if (!compileResult.success || !compileResult.plan) {
        return reply.status(400).send({
          error: {
            code: 'COMPILE_ERROR',
            message: 'Capability compilation failed',
            details: compileResult.diagnostics,
          },
        });
      }

      const plan = compileResult.plan as unknown as ExecutionPlan;

      if (plan.authRequirements.required) {
        const hasScopes = await runtime.tokenProvider.hasScopes(plan.authRequirements.scopes);
        if (!hasScopes) {
          return reply.status(403).send({
            error: {
              code: 'GATEWAY_AUTH_MISSING_SCOPE',
              message: `Missing required auth scopes: ${plan.authRequirements.scopes.join(', ')}`,
              details: { requiredScopes: plan.authRequirements.scopes },
            },
          });
        }
      }

      const inputMap = new Map<string, unknown>();
      for (const [key, val] of Object.entries(inputs)) {
        inputMap.set(key, val.value);
      }

      const result = await runtime.executor.execute(plan, inputMap);

      const outputs: Record<string, unknown> = {};
      for (const [key, value] of result.outputs) {
        outputs[key] = value;
      }

      const provenance: Record<string, unknown> = {};
      for (const [key, value] of result.provenance) {
        provenance[key] = value;
      }

      return reply.status(200).send({
        status: 'success',
        capabilityId: capId,
        outputs,
        metrics: {
          totalDurationMs: result.metrics.totalDurationMs,
          cacheHits: result.metrics.cacheHits,
          cacheMisses: result.metrics.cacheMisses,
        },
        provenance,
      });
    });

    // Full pipeline execution via compile -> execute
    app.post<{
      Body: {
        pipeline: unknown;
        inputs: Record<string, unknown>;
        nodeConfiguredValues?: Record<string, Record<string, { value: unknown }>>;
      };
    }>('/api/pipelines/execute', async (req, reply) => {
      const { pipeline, inputs, nodeConfiguredValues } = req.body;
      if (!pipeline) {
        return reply.status(400).send({
          error: {
            code: 'PARSE_ERROR',
            message: 'Missing pipeline in request body',
            details: null,
          },
        });
      }

      const rawDef = pipeline as PipelineDefinition;
      const catalog = runtime.catalog;

      const mutableEdges = [...(rawDef.edges ?? [])];
      const mutableInputs = [...(rawDef.inputs ?? [])];
      const configuredInputs: Record<string, Record<string, unknown>> = {};
      const extraInputValues: Record<string, unknown> = {};
      if (nodeConfiguredValues) {
        const nodeMap = new Map(rawDef.nodes.map((n) => [n.id, n]));
        for (const [nodeId, ports] of Object.entries(nodeConfiguredValues)) {
          const portValues: Record<string, unknown> = {};
          const node = nodeMap.get(nodeId);
          let capInputs: ReadonlyMap<string, { semanticType: unknown }> | undefined;
          if (node?.capability) {
            try {
              const cap = catalog.get(
                toCapabilityId(node.capability.id),
                node.capability.version ? capabilityVersion(node.capability.version) : undefined,
              );
              capInputs = cap.inputs;
            } catch {
              // capability not found — fall through with no type info
            }
          }
          for (const [portName, cv] of Object.entries(ports)) {
            portValues[portName] = cv.value;
            const pipelineInputKey = `${nodeId}_${portName}`;
            extraInputValues[pipelineInputKey] = cv.value;
            const edgeExists = mutableEdges.some(
              (e) => e.to === `${nodeId}.${portName}` && e.from.startsWith('input.'),
            );
            if (!edgeExists) {
              const portDef = capInputs?.get(portName);
              mutableEdges.push({
                from: `input.${pipelineInputKey}`,
                to: `${nodeId}.${portName}`,
              });
              mutableInputs.push({
                name: pipelineInputKey,
                semanticType: (portDef?.semanticType ??
                  '') as PipelineDefinition['inputs'][0]['semanticType'],
                required: false,
              });
            }
          }
          configuredInputs[nodeId] = portValues;
        }
      }

      const pipelineDef: PipelineDefinition = {
        ...rawDef,
        edges: mutableEdges,
        inputs: mutableInputs,
      };

      let compileResult: ReturnType<typeof compile>;
      try {
        compileResult = compile(pipelineDef, catalog, { configuredInputs });
      } catch (compileErr) {
        return reply.status(400).send({
          error: {
            code: 'COMPILE_ERROR',
            message: compileErr instanceof Error ? compileErr.message : 'Compilation failed',
            details: null,
          },
        });
      }
      if (!compileResult.success || !compileResult.plan) {
        return reply.status(400).send({
          error: {
            code: 'COMPILE_ERROR',
            message: 'Pipeline compilation failed',
            details: compileResult.diagnostics,
          },
        });
      }

      const plan = compileResult.plan as unknown as ExecutionPlan;

      if (plan.authRequirements.required) {
        const hasScopes = await runtime.tokenProvider.hasScopes(plan.authRequirements.scopes);
        if (!hasScopes) {
          return reply.status(403).send({
            error: {
              code: 'GATEWAY_AUTH_MISSING_SCOPE',
              message: `Missing required auth scopes: ${plan.authRequirements.scopes.join(', ')}`,
              details: { requiredScopes: plan.authRequirements.scopes },
            },
          });
        }
      }

      const inputMap = new Map<string, unknown>(Object.entries(inputs ?? {}));
      for (const [key, val] of Object.entries(extraInputValues)) {
        if (!inputMap.has(key)) {
          inputMap.set(key, val);
        }
      }
      const result = await runtime.executor.execute(plan, inputMap);

      const outputs: Record<string, unknown> = {};
      for (const [key, value] of result.outputs) {
        outputs[key] = value;
      }

      const prov: Record<string, unknown> = {};
      for (const [key, value] of result.provenance) {
        prov[key] = value;
      }

      const stepDurations: Record<string, number> = {};
      for (const [key, value] of result.metrics.stepDurations) {
        stepDurations[key] = value;
      }

      return reply.status(200).send({
        outputs,
        provenance: prov,
        metrics: {
          totalDurationMs: result.metrics.totalDurationMs,
          stepDurations,
          cacheHits: result.metrics.cacheHits,
          cacheMisses: result.metrics.cacheMisses,
        },
      });
    });
  };
}
