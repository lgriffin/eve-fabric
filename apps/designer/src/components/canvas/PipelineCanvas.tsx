import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type FinalConnectionState,
  type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDraftStore } from '../../stores/draft-store.js';
import { useToastStore } from '../../stores/toast-store.js';
import { CapabilityNode } from './CapabilityNode.js';
import { CanvasMenu } from './CanvasMenu.js';
import { accepts, dropped, holeAt, menuFor, type CanvasMenuModel } from './composition.js';
import { colors, fontSize } from '../../tokens.js';

const nodeTypes = { capability: CapabilityNode };

interface OpenMenu {
  readonly model: CanvasMenuModel;
  readonly at: { readonly x: number; readonly y: number };
}

/** Where a pointer or touch event is, relative to an element. */
function pointIn(event: MouseEvent | TouchEvent, element: HTMLElement | null) {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event;
  const box = element?.getBoundingClientRect();
  return {
    x: (point?.clientX ?? 0) - (box?.left ?? 0),
    y: (point?.clientY ?? 0) - (box?.top ?? 0),
  };
}

/**
 * The canvas is a view of the question's scaffold: the steps the fabric built
 * and how they connect. When composable, it also takes gestures, each of which
 * becomes a change the fabric is asked for, as the panel's buttons are: a move
 * dropped on it is applied, a subject dropped on an empty canvas starts the
 * question, a connection drawn from the cursor step opens the moves offered
 * there, and one landing on a hole opens that hole's choices. Nothing is
 * wired by hand, and the canvas holds nothing the question does not.
 */
export function PipelineCanvas({ composable = false }: { composable?: boolean }) {
  const nodes = useDraftStore((s) => s.nodes);
  const edges = useDraftStore((s) => s.edges);
  const view = useDraftStore((s) => s.view);
  const onNodesChange = useDraftStore((s) => s.onNodesChange);
  const setSelectedNode = useDraftStore((s) => s.selectNode);
  const apply = useDraftStore((s) => s.apply);
  const start = useDraftStore((s) => s.start);
  const addToast = useToastStore((s) => s.addToast);
  const container = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // A port read by more than one step is drawn heavier, so the fan-out shows.
  const styledEdges = useMemo(() => {
    const portCounts = new Map<string, number>();
    for (const edge of edges) {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      portCounts.set(key, (portCounts.get(key) ?? 0) + 1);
    }
    return edges.map((edge) => {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      if ((portCounts.get(key) ?? 0) > 1) {
        return { ...edge, style: { stroke: colors.source.DERIVED, strokeWidth: 2.5 } };
      }
      return edge;
    });
  }, [edges]);

  /** A connection may land only on an open hole. */
  const isValidConnection: IsValidConnection = useCallback(
    (connection) =>
      view !== null && holeAt(view, connection.target, connection.targetHandle) !== undefined,
    [view],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (view === null || state.fromNode === null) return;
      const to =
        state.toNode === null ? null : { nodeId: state.toNode.id, handle: state.toHandle?.id };
      const model = menuFor(view, { nodeId: state.fromNode.id }, to);
      if (model === null) return;
      setMenu({ model, at: pointIn(event, container.current) });
    },
    [view],
  );

  const onDrop = (event: React.DragEvent) => {
    const taken = dropped(event.dataTransfer);
    if (taken === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (taken.kind === 'move') {
      void apply(taken.move);
      return;
    }
    if (view !== null) {
      addToast('info', 'Not started', 'Press New first to ask about something else');
      return;
    }
    void start(taken.subject);
  };

  return (
    <div
      ref={container}
      style={{ flex: 1, height: '100%', position: 'relative' }}
      data-testid="canvas"
      onDragOver={(e) => {
        if (composable && accepts(e.dataTransfer)) e.preventDefault();
      }}
      onDrop={composable ? onDrop : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onNodeClick={(_event, node) => setSelectedNode(node.id)}
        onPaneClick={() => {
          setSelectedNode(null);
          closeMenu();
        }}
        nodesConnectable={composable}
        isValidConnection={isValidConnection}
        onConnectStart={closeMenu}
        onConnectEnd={onConnectEnd}
        edgesFocusable={false}
        deleteKeyCode={null}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: colors.surface.base }}
      >
        <Background color={colors.surface.border} gap={20} />
        <Controls position="bottom-right" />
        <MiniMap
          nodeColor={colors.accent}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: colors.surface.raised }}
        />
      </ReactFlow>
      {composable && view === null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: colors.text.dim,
            fontSize: fontSize.lg,
          }}
        >
          Drop a subject here to start, or pick one in the panel
        </div>
      )}
      {menu !== null && <CanvasMenu model={menu.model} at={menu.at} onClose={closeMenu} />}
    </div>
  );
}
