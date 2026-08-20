import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
  rankDir?: 'LR' | 'TB';
}

export function applyAutoLayout<T extends Node>(
  nodes: T[],
  edges: Edge[],
  options?: LayoutOptions,
): T[] {
  if (nodes.length === 0) return nodes;

  const nodeWidth = options?.nodeWidth ?? 200;
  const nodeHeight = options?.nodeHeight ?? 80;
  const rankSep = options?.rankSep ?? 100;
  const nodeSep = options?.nodeSep ?? 60;
  const rankDir = options?.rankDir ?? 'LR';

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: rankDir, ranksep: rankSep, nodesep: nodeSep });

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
    };
  });
}
