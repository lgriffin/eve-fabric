/**
 * Semantic wiring validator for pipeline graphs.
 *
 * Validates that all edges in a pipeline connect semantically compatible ports.
 * For each edge, resolves the semantic type of the source and target ports
 * and verifies they match.
 */

import type { CapabilityCatalog, PipelineDefinition, PipelineNode } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import {
  type CompilerDiagnostic,
  semanticTypeMismatch,
  capabilityNotFound,
  unknownField,
  fieldOnInput,
} from './diagnostics.js';
import { splitPortPath } from './port-path.js';

/**
 * Parses a port reference into its node identifier and port name.
 *
 * Port references follow the format "nodeId.portName" for node ports
 * or "input.portName" for pipeline-level inputs.
 */
function parsePortRef(ref: string): { nodeId: string; portName: string } {
  const dotIndex = ref.indexOf('.');
  if (dotIndex === -1) {
    return { nodeId: ref, portName: ref };
  }
  return {
    nodeId: ref.substring(0, dotIndex),
    portName: ref.substring(dotIndex + 1),
  };
}

/**
 * The type of a field read inside a record output. Unchecked (undefined)
 * when the catalog holds no types; a field the record does not have is an
 * error.
 */
function fieldType(
  ref: string,
  portType: string,
  fieldPath: readonly string[],
  catalog: CapabilityCatalog,
  diagnostics: CompilerDiagnostic[],
): string | undefined {
  const types = catalog.types;
  if (types === undefined) return undefined;
  let current = portType;
  for (const field of fieldPath) {
    const type = types.has(current) ? types.get(current) : undefined;
    const next = type?.kind === 'record' ? type.fields.get(field) : undefined;
    if (next === undefined) {
      diagnostics.push(unknownField(ref, current, field));
      return undefined;
    }
    current = next.type;
  }
  return current;
}

/**
 * Resolves the semantic type of a port reference within the pipeline context.
 *
 * For pipeline inputs ("input.name"), looks up the semantic type from the
 * pipeline's input definitions. For node ports ("nodeId.portName"), looks
 * up the capability in the catalog and finds the port's semantic type.
 *
 * Returns undefined if the port cannot be resolved (missing capability, etc.).
 * Any resolution errors are appended to the diagnostics array.
 */
function resolvePortType(
  ref: string,
  side: 'output' | 'input',
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
  nodeMap: ReadonlyMap<string, PipelineNode>,
  diagnostics: CompilerDiagnostic[],
): string | undefined {
  const parsed = parsePortRef(ref);

  // Pipeline-level input
  if (parsed.nodeId === 'input') {
    const pipelineInput = pipeline.inputs.find((inp) => inp.name === parsed.portName);
    if (pipelineInput) {
      return pipelineInput.semanticType;
    }
    return undefined;
  }

  // Pipeline-level output
  if (parsed.nodeId === 'output') {
    // Output references point to node outputs; the semantic type comes from the source
    return undefined;
  }

  // Node port
  const node = nodeMap.get(parsed.nodeId);
  if (!node) {
    return undefined;
  }

  try {
    const capId = capabilityId(node.capability.id);
    const capVer =
      node.capability.version !== undefined
        ? capabilityVersion(node.capability.version)
        : undefined;
    const def = catalog.get(capId, capVer);

    // For "from" side, look at capability outputs; for "to" side, look at inputs
    if (side === 'input') return def.inputs.get(parsed.portName)?.semanticType;
    const { port: portName, fieldPath } = splitPortPath(parsed.portName);
    const port = def.outputs.get(portName);
    if (!port) return undefined;
    return fieldPath.length === 0
      ? port.semanticType
      : fieldType(ref, port.semanticType, fieldPath, catalog, diagnostics);
  } catch {
    diagnostics.push(capabilityNotFound(node.capability.id));
    return undefined;
  }
}

/**
 * Validates that all edges in a pipeline connect semantically compatible ports.
 *
 * For each edge:
 * 1. Parses the from/to port references
 * 2. Resolves the semantic type of each port
 * 3. Checks that the types match
 * 4. Produces CompilerDiagnostic errors for mismatches
 */
export function validateSemanticWiring(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  // Build node lookup map
  const nodeMap = new Map<string, PipelineNode>();
  for (const node of pipeline.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const edge of pipeline.edges) {
    if (parsePortRef(edge.to).portName.includes('.')) diagnostics.push(fieldOnInput(edge.to));
    const fromType = resolvePortType(edge.from, 'output', pipeline, catalog, nodeMap, diagnostics);

    const toType = resolvePortType(edge.to, 'input', pipeline, catalog, nodeMap, diagnostics);

    // Only check mismatch when both types are resolved
    if (fromType !== undefined && toType !== undefined && fromType !== toType) {
      diagnostics.push(semanticTypeMismatch(edge.from, edge.to, fromType, toType));
    }
  }

  // An output may read a field of a record too; the field must exist.
  for (const output of pipeline.outputs) {
    resolvePortType(output.source, 'output', pipeline, catalog, nodeMap, diagnostics);
  }

  return diagnostics;
}
