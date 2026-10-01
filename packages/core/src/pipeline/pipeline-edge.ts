export { parsePortReference } from '../validation/helpers.js';

/**
 * An edge connects two ports in a pipeline.
 * PortReference format: "input.{name}" for pipeline inputs or "{nodeId}.{portName}" for node ports.
 */
export interface PipelineEdge {
  readonly from: string; // PortReference string
  readonly to: string; // PortReference string
}
