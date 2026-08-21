/**
 * Compiler front-end: parse and resolve capability references.
 *
 * Resolves all capability references in a pipeline against the catalog,
 * verifying that each referenced capability exists and that all required
 * inputs have incoming edges wired to them.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import { type CompilerDiagnostic, capabilityNotFound, missingInput } from './diagnostics.js';

/**
 * Resolves all capability references in a pipeline against the catalog.
 *
 * For each node:
 * 1. Verifies the capability exists in the catalog
 * 2. Verifies all required capability inputs have incoming edges
 *
 * Returns diagnostics for CAPABILITY_NOT_FOUND and MISSING_INPUT errors.
 */
export interface ResolveOptions {
  readonly configuredInputs?: Record<string, Record<string, unknown>>;
}

export function resolveCapabilities(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
  options?: ResolveOptions,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const configured = options?.configuredInputs ?? {};

  // Build a map of wired input ports per node
  const wiredInputs = new Map<string, Set<string>>();
  for (const edge of pipeline.edges) {
    const dotIdx = edge.to.indexOf('.');
    if (dotIdx === -1) continue;
    const nodeId = edge.to.substring(0, dotIdx);
    const portName = edge.to.substring(dotIdx + 1);
    if (nodeId === 'output') continue;

    let ports = wiredInputs.get(nodeId);
    if (!ports) {
      ports = new Set<string>();
      wiredInputs.set(nodeId, ports);
    }
    ports.add(portName);
  }

  for (const node of pipeline.nodes) {
    try {
      const capId = capabilityId(node.capability.id);
      const capVer =
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version)
          : undefined;
      const def = catalog.get(capId, capVer);

      // Check that all required inputs have incoming edges or configured values
      const nodeWired = wiredInputs.get(node.id) ?? new Set<string>();
      const nodeConfigured = configured[node.id] ?? {};
      const configuredPorts = new Set(Object.keys(nodeConfigured));
      for (const [portName, port] of def.inputs) {
        if (port.required && !nodeWired.has(portName) && !configuredPorts.has(portName)) {
          diagnostics.push(missingInput(node.capability.id, portName));
        }
      }
    } catch {
      diagnostics.push(capabilityNotFound(node.capability.id));
    }
  }

  return diagnostics;
}
