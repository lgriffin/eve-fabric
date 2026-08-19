import { useCallback, useRef, type DragEvent } from 'react';
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
  const capabilities = useCatalogStore((s) => s.capabilities);

  const reactFlowRef = useRef<ReactFlowInstance<CapabilityFlowNode, Edge> | null>(null);

  const isValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      const source = 'source' in connection ? connection.source : undefined;
      const target = 'target' in connection ? connection.target : undefined;
      if (!source || !target) return false;
      if (source === target) return false;

      const sourceHandle = connection.sourceHandle ?? null;
      const targetHandle = connection.targetHandle ?? null;

      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return false;
      if (!sourceHandle || !targetHandle) return true;

      const sourcePort = sourceNode.data.outputs.find((o) => o.name === sourceHandle);
      const targetPort = targetNode.data.inputs.find((i) => i.name === targetHandle);
      if (!sourcePort || !targetPort) return false;

      return sourcePort.semanticType === targetPort.semanticType;
    },
    [nodes],
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
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => { reactFlowRef.current = instance; }}
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
