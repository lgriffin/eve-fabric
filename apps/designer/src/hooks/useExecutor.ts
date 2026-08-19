import { useCallback } from 'react';
import {
  usePipelineStore,
  type ExecutionNodeState,
  type ExecutionStepMetrics,
} from '../stores/pipeline-store.js';
import { flowToPipeline } from '../services/pipeline-serializer.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3456';

function gatewayUrl(): string {
  if (typeof window !== 'undefined') {
    const url = (window as unknown as Record<string, unknown>)['__GATEWAY_URL__'];
    if (typeof url === 'string') return url;
  }
  return DEFAULT_GATEWAY_URL;
}

interface ExecuteOptions {
  inputs?: Record<string, unknown>;
  stream?: boolean;
}

export function useExecutor() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const setExecutionSession = usePipelineStore((s) => s.setExecutionSession);
  const updateStepStatus = usePipelineStore((s) => s.updateStepStatus);
  const setExecutionOutputs = usePipelineStore((s) => s.setExecutionOutputs);

  const execute = useCallback(
    async (options?: ExecuteOptions) => {
      const definition = flowToPipeline(
        nodes,
        edges,
        { id: pipelineId || 'untitled', name: pipelineName, version: pipelineVersion },
        [],
        nodes.length > 0
          ? [
              {
                name: 'result',
                source: `${nodes[nodes.length - 1]!.id}.${nodes[nodes.length - 1]!.data.outputs[0]?.name ?? 'output'}`,
              },
            ]
          : [],
      );

      const sessionId = `exec-${Date.now()}`;
      const stepStatuses: Record<string, ExecutionNodeState> = {};
      for (const node of nodes) {
        stepStatuses[node.id] = 'queued';
      }

      setExecutionSession({
        id: sessionId,
        status: 'running',
        stepStatuses,
        stepResults: {},
        stepMetrics: {},
        outputs: {},
        errors: [],
      });

      if (options?.stream !== false) {
        try {
          const res = await fetch(`${gatewayUrl()}/api/pipelines/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pipeline: definition, inputs: options?.inputs ?? {} }),
          });

          if (!res.ok) {
            const errorData = (await res
              .json()
              .catch(() => ({ error: { message: `HTTP ${res.status}` } }))) as {
              error?: { message?: string };
            };
            setExecutionSession({
              id: sessionId,
              status: 'failed',
              stepStatuses,
              stepResults: {},
              stepMetrics: {},
              outputs: {},
              errors: [
                {
                  stepId: '',
                  message: errorData.error?.message ?? `Execution failed: ${res.status}`,
                  code: 'EXECUTION_FAILED',
                },
              ],
            });
            return;
          }

          const data = (await res.json()) as {
            outputs: Record<string, unknown>;
            metrics?: {
              stepDurations?: Record<string, number>;
              cacheHits?: number;
              cacheMisses?: number;
            };
            stepStatuses?: Record<string, string>;
            errors?: Array<{ stepId: string; message: string; code: string }>;
          };

          if (data.stepStatuses) {
            for (const [stepId, status] of Object.entries(data.stepStatuses)) {
              const metrics: ExecutionStepMetrics = {
                durationMs: data.metrics?.stepDurations?.[stepId] ?? 0,
                cached: false,
              };
              updateStepStatus(stepId, status as ExecutionNodeState, metrics);
            }
          }

          for (const node of nodes) {
            if (!data.stepStatuses?.[node.id] || data.stepStatuses[node.id] === 'completed') {
              updateStepStatus(node.id, 'completed', {
                durationMs: data.metrics?.stepDurations?.[node.id] ?? 0,
                cached: false,
              });
            }
          }

          if (data.errors && data.errors.length > 0) {
            for (const err of data.errors) {
              updateStepStatus(err.stepId, 'failed', {
                durationMs: 0,
                cached: false,
                error: err.message,
              });
            }
          }

          setExecutionOutputs(data.outputs ?? {});
        } catch (err) {
          setExecutionSession({
            id: sessionId,
            status: 'failed',
            stepStatuses,
            stepResults: {},
            stepMetrics: {},
            outputs: {},
            errors: [
              {
                stepId: '',
                message: err instanceof Error ? err.message : 'Network error',
                code: 'NETWORK_ERROR',
              },
            ],
          });
        }
      }
    },
    [
      nodes,
      edges,
      pipelineId,
      pipelineName,
      pipelineVersion,
      setExecutionSession,
      updateStepStatus,
      setExecutionOutputs,
    ],
  );

  const cancelExecution = useCallback(() => {
    const session = usePipelineStore.getState().executionSession;
    if (session && session.status === 'running') {
      setExecutionSession({ ...session, status: 'cancelled' });
    }
  }, [setExecutionSession]);

  return { execute, cancelExecution };
}
