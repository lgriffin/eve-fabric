/**
 * Re-exports pipeline types from the domain package.
 *
 * This module exists so that internal compiler files can import
 * pipeline types from a single local path.
 */

export type {
  PipelineDefinition,
  PipelineNode,
  PipelineEdge,
  PipelineInput,
  PipelineOutput,
} from '@eve-fabric/domain';
