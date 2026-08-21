import { useCallback } from 'react';
import { usePipelineStore } from '../stores/pipeline-store.js';
import type { NodeExecutionState } from '../stores/types.js';

export function useNodeExecution() {
  const setNodeExecutionState = usePipelineStore((s) => s.setNodeExecutionState);
  const nodeConfiguredValues = usePipelineStore((s) => s.nodeConfiguredValues);
  const nodes = usePipelineStore((s) => s.nodes);

  const executeNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      setNodeExecutionState(nodeId, {
        status: 'running',
        resultCount: null,
        durationMs: null,
        source: null,
        cached: false,
        error: null,
        preview: null,
      });

      try {
        const configured = nodeConfiguredValues[nodeId] ?? {};
        const inputs: Record<string, { value: unknown; semanticType: string }> = {};
        for (const input of node.data.inputs) {
          const conf = configured[input.name];
          if (conf) {
            inputs[input.name] = {
              value: conf.value,
              semanticType: input.semanticType,
            };
          }
        }

        const res = await fetch(
          `/api/capabilities/${encodeURIComponent(node.data.capabilityId)}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs }),
          },
        );

        const result = (await res.json()) as Record<string, unknown>;

        if (result.status === 'error') {
          const errorMsg = (result.error as string) ?? 'Execution failed';
          const debug = result.debug as Record<string, unknown> | undefined;
          console.error(
            `[useNodeExecution] ${node.data.capabilityId} execution failed:`,
            errorMsg,
            debug
              ? `\nCatalog has ${String(debug.catalogSize)} capabilities: ${JSON.stringify(debug.registeredIds)}`
              : '',
          );
          setNodeExecutionState(nodeId, {
            status: 'error',
            resultCount: null,
            durationMs: null,
            source: null,
            cached: false,
            error: errorMsg,
            preview: null,
          });
          return;
        }

        const state: NodeExecutionState = {
          status: 'success',
          resultCount: (result.resultCount as number) ?? null,
          durationMs: (result.durationMs as number) ?? null,
          source: (result.source as string) ?? null,
          cached: (result.cached as boolean) ?? false,
          error: null,
          preview: result.preview ?? null,
        };
        setNodeExecutionState(nodeId, state);
      } catch (err) {
        setNodeExecutionState(nodeId, {
          status: 'error',
          resultCount: null,
          durationMs: null,
          source: null,
          cached: false,
          error: err instanceof Error ? err.message : 'Network error',
          preview: null,
        });
      }
    },
    [nodes, nodeConfiguredValues, setNodeExecutionState],
  );

  return { executeNode };
}
