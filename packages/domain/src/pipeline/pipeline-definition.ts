import type { PipelineInput, PipelineOutput } from './pipeline-io.js';
import type { PipelineNode } from './pipeline-node.js';
import type { PipelineEdge } from './pipeline-edge.js';

export interface PipelineDefinition {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description?: string | undefined;
  readonly inputs: readonly PipelineInput[];
  readonly nodes: readonly PipelineNode[];
  readonly edges: readonly PipelineEdge[];
  readonly outputs: readonly PipelineOutput[];
}
