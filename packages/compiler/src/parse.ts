import type { PipelineDefinition } from '@eve-fabric/core';
import type { CompilerDiagnostic } from './diagnostics.js';

export interface ParseResult {
  readonly pipeline: PipelineDefinition;
  readonly diagnostics: CompilerDiagnostic[];
}

export function parsePipeline(pipeline: PipelineDefinition): ParseResult {
  const diagnostics: CompilerDiagnostic[] = [];

  if (pipeline.nodes.length === 0) {
    diagnostics.push({
      code: 'EMPTY_PIPELINE',
      severity: 'error',
      message: 'Pipeline must contain at least one node',
    });
  }

  const nodeIds = new Set(pipeline.nodes.map((n) => n.id));
  for (const edge of pipeline.edges) {
    const fromNode = edge.from.substring(0, edge.from.indexOf('.'));
    const toNode = edge.to.substring(0, edge.to.indexOf('.'));

    if (fromNode !== 'input' && fromNode !== 'output' && !nodeIds.has(fromNode)) {
      diagnostics.push({
        code: 'UNKNOWN_NODE_REF',
        severity: 'error',
        message: `Edge references unknown node "${fromNode}" in "${edge.from}"`,
        location: { edgeFrom: edge.from, edgeTo: edge.to },
      });
    }

    if (toNode !== 'input' && toNode !== 'output' && !nodeIds.has(toNode)) {
      diagnostics.push({
        code: 'UNKNOWN_NODE_REF',
        severity: 'error',
        message: `Edge references unknown node "${toNode}" in "${edge.to}"`,
        location: { edgeFrom: edge.from, edgeTo: edge.to },
      });
    }
  }

  return { pipeline, diagnostics };
}
