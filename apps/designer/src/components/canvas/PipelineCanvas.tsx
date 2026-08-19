import { useCallback, useMemo, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePipelineStore, type CapabilityFlowNode } from '../../stores/pipeline-store.js';
import { useCatalogStore } from '../../stores/catalog-store.js';
import { useConnectionValidator } from '../../hooks/useConnectionValidator.js';
import { CapabilityNode } from './CapabilityNode.js';

const nodeTypes = { capability: CapabilityNode };

let nodeCounter = 0;

export function PipelineCanvas() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange);
  const onConnect = usePipelineStore((s) => s.onConnect);
  const addNode = usePipelineStore((s) => s.addNode);
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const setBridgingSuggestions = usePipelineStore((s) => s.setBridgingSuggestions);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const capabilities = useCatalogStore((s) => s.capabilities);

  const styledEdges = useMemo(() => {
    const portCounts = new Map<string, number>();
    for (const edge of edges) {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      portCounts.set(key, (portCounts.get(key) ?? 0) + 1);
    }

    return edges.map((edge) => {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      const isFanOut = (portCounts.get(key) ?? 0) > 1;

      if (executionSession?.status === 'running') {
        const statuses = executionSession.stepStatuses;
        const sourceState = statuses[edge.source];
        const targetState = statuses[edge.target];
        const isActive =
          sourceState === 'executing' || sourceState === 'completed' || targetState === 'executing';
        if (isActive) {
          return {
            ...edge,
            animated: true,
            style: { stroke: '#42a5f5', strokeWidth: isFanOut ? 3 : 2 },
          };
        }
      }

      if (isFanOut) {
        return { ...edge, style: { stroke: '#ba68c8', strokeWidth: 2.5 } };
      }

      return edge;
    });
  }, [edges, executionSession]);

  const { validate, getBridgingSuggestions } = useConnectionValidator();

  const reactFlowRef = useRef<ReactFlowInstance<CapabilityFlowNode, Edge> | null>(null);

  const isValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      const conn: Connection = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      };
      return validate(conn);
    },
    [validate],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      // Self-loop rejection (T009)
      if (connection.source === connection.target) return;

      if (validate(connection)) {
        onConnect(connection);
        setBridgingSuggestions([]);
      } else {
        const suggestions = getBridgingSuggestions(connection);
        setBridgingSuggestions(suggestions);
      }
    },
    [validate, getBridgingSuggestions, onConnect, setBridgingSuggestions],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const capabilityId = event.dataTransfer.getData('application/capability-id');
      if (!capabilityId || !reactFlowRef.current) return;

      const cap = capabilities.find((c) => c.id === capabilityId);
      if (!cap) return;

      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: CapabilityFlowNode = {
        id: `${capabilityId.replace(/\./g, '-')}-${++nodeCounter}`,
        type: 'capability',
        position,
        data: {
          capabilityId: cap.id,
          capabilityVersion: cap.version,
          label: cap.name,
          source: cap.source,
          inputs: cap.inputs,
          outputs: cap.outputs,
        },
      };

      addNode(newNode);
    },
    [addNode, capabilities],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div style={{ flex: 1, height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => {
          reactFlowRef.current = instance;
        }}
        onNodeClick={(_event, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: '#13131d' }}
      >
        <Background color="#333" gap={20} />
        <Controls position="bottom-right" />
        <MiniMap
          nodeColor="#7c4dff"
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: '#1e1e2e' }}
        />
      </ReactFlow>
    </div>
  );
}
