import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
import { ContextualPalette } from './ContextualPalette.js';

const nodeTypes = { capability: CapabilityNode };

let nodeCounter = 0;

interface ContextPaletteState {
  semanticType: string;
  position: { x: number; y: number };
  sourceNodeId: string;
  sourcePort: string;
}

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

  const [contextPalette, setContextPalette] = useState<ContextPaletteState | null>(null);
  const connectingFromRef = useRef<{ nodeId: string; handleId: string } | null>(null);

  const nodeExecutionStates = usePipelineStore((s) => s.nodeExecutionStates);

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

      const sourceSuccess =
        nodeExecutionStates[edge.source]?.status === 'success' ||
        executionSession?.stepStatuses[edge.source] === 'completed';
      const targetSuccess =
        nodeExecutionStates[edge.target]?.status === 'success' ||
        executionSession?.stepStatuses[edge.target] === 'completed';

      if (sourceSuccess && targetSuccess) {
        return {
          ...edge,
          animated: true,
          style: { stroke: '#81c784', strokeWidth: isFanOut ? 3 : 2 },
        };
      }
      if (sourceSuccess) {
        return {
          ...edge,
          animated: true,
          style: { stroke: '#42a5f5', strokeWidth: isFanOut ? 2.5 : 1.5 },
        };
      }

      if (isFanOut) {
        return { ...edge, style: { stroke: '#ba68c8', strokeWidth: 2.5 } };
      }

      return edge;
    });
  }, [edges, executionSession, nodeExecutionStates]);

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

  const handleConnectStart = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      params: { nodeId: string | null; handleId: string | null },
    ) => {
      if (params.nodeId && params.handleId) {
        connectingFromRef.current = { nodeId: params.nodeId, handleId: params.handleId };
      }
    },
    [],
  );

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from = connectingFromRef.current;
      connectingFromRef.current = null;
      if (!from || !reactFlowRef.current) return;

      const target =
        event instanceof MouseEvent ? event.target : (event as TouchEvent).touches[0]?.target;
      if (!target || !(target instanceof HTMLElement)) return;

      const isPane = target.classList.contains('react-flow__pane');
      if (!isPane) return;

      const sourceNode = nodes.find((n) => n.id === from.nodeId);
      if (!sourceNode) return;

      const sourceOutput = sourceNode.data.outputs.find((o) => o.name === from.handleId);
      if (!sourceOutput) return;

      const clientX =
        event instanceof MouseEvent
          ? event.clientX
          : ((event as TouchEvent).changedTouches[0]?.clientX ?? 0);
      const clientY =
        event instanceof MouseEvent
          ? event.clientY
          : ((event as TouchEvent).changedTouches[0]?.clientY ?? 0);

      const flowPosition = reactFlowRef.current.screenToFlowPosition({ x: clientX, y: clientY });

      setContextPalette({
        semanticType: sourceOutput.semanticType,
        position: flowPosition,
        sourceNodeId: from.nodeId,
        sourcePort: from.handleId,
      });
    },
    [nodes],
  );

  const handleContextPaletteSelect = useCallback(
    (capabilityId: string, _capabilityName: string) => {
      if (!contextPalette) return;
      const cap = useCatalogStore.getState().capabilities.find((c) => c.id === capabilityId);
      if (!cap) {
        setContextPalette(null);
        return;
      }

      const nodeId = `${capabilityId.replace(/\./g, '-')}-${++nodeCounter}`;
      const newNode: CapabilityFlowNode = {
        id: nodeId,
        type: 'capability',
        position: contextPalette.position,
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

      const matchingInput = cap.inputs.find((i) => i.semanticType === contextPalette.semanticType);
      if (matchingInput) {
        onConnect({
          source: contextPalette.sourceNodeId,
          sourceHandle: contextPalette.sourcePort,
          target: nodeId,
          targetHandle: matchingInput.name,
        });
      }

      setContextPalette(null);
    },
    [contextPalette, addNode, onConnect],
  );

  useEffect(() => {
    function handleShowPalette(e: Event) {
      const detail = (e as CustomEvent).detail as {
        semanticType: string;
        sourceNodeId: string;
        sourcePort: string;
        position: { x: number; y: number };
      };
      if (reactFlowRef.current) {
        const flowPos = reactFlowRef.current.screenToFlowPosition(detail.position);
        setContextPalette({
          semanticType: detail.semanticType,
          sourceNodeId: detail.sourceNodeId,
          sourcePort: detail.sourcePort,
          position: flowPos,
        });
      }
    }
    window.addEventListener('fabric:show-contextual-palette', handleShowPalette);
    return () => window.removeEventListener('fabric:show-contextual-palette', handleShowPalette);
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
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeClick={(_event, node) => setSelectedNode(node.id)}
        onPaneClick={() => {
          setSelectedNode(null);
          setContextPalette(null);
        }}
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
      {contextPalette && (
        <ContextualPalette
          semanticType={contextPalette.semanticType}
          position={contextPalette.position}
          onSelect={handleContextPaletteSelect}
          onClose={() => setContextPalette(null)}
        />
      )}
    </div>
  );
}
