import type { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import type { ExecutionStep, InputBinding, StepGroup } from './execution-types.js';
import type { CompilerDiagnostic } from './diagnostics.js';

export interface PipelineRegistry {
  get(id: string, version: number): PipelineDefinition | undefined;
}

export interface CompositeExpansion {
  readonly expandedSteps: ExecutionStep[];
  readonly expandedGroups: StepGroup[];
  readonly diagnostics: CompilerDiagnostic[];
}

const MAX_NESTING_DEPTH = 10;

function extractNodeId(portRef: string): string {
  const dotIndex = portRef.indexOf('.');
  return dotIndex === -1 ? portRef : portRef.substring(0, dotIndex);
}

function extractPortName(portRef: string): string {
  const dotIndex = portRef.indexOf('.');
  return dotIndex === -1 ? portRef : portRef.substring(dotIndex + 1);
}

function prefixId(parentNodeId: string, childId: string): string {
  return `${parentNodeId}/${childId}`;
}

export function expandCompositeNode(
  nodeId: string,
  capabilityIdStr: string,
  capabilityVersionNum: number | undefined,
  parentInputBindings: readonly InputBinding[],
  catalog: CapabilityCatalog,
  registry: PipelineRegistry,
  depth: number,
): CompositeExpansion {
  const diagnostics: CompilerDiagnostic[] = [];

  if (depth > MAX_NESTING_DEPTH) {
    diagnostics.push({
      code: 'COMPOSITE_MAX_DEPTH',
      severity: 'error',
      message: `Composite capability "${capabilityIdStr}" exceeds maximum nesting depth of ${MAX_NESTING_DEPTH}`,
      context: { capability: capabilityIdStr },
    });
    return { expandedSteps: [], expandedGroups: [], diagnostics };
  }

  const capId = capabilityId(capabilityIdStr);
  const capVer = capabilityVersionNum !== undefined
    ? capabilityVersion(capabilityVersionNum)
    : undefined;

  let def;
  try {
    def = catalog.get(capId, capVer);
  } catch {
    diagnostics.push({
      code: 'CAPABILITY_NOT_FOUND',
      severity: 'error',
      message: `Composite capability "${capabilityIdStr}" not found in catalog`,
      context: { capability: capabilityIdStr },
    });
    return { expandedSteps: [], expandedGroups: [], diagnostics };
  }

  if (def.source !== 'COMPOSITE' || !def.pipelineRef) {
    diagnostics.push({
      code: 'COMPOSITE_NOT_COMPOSITE',
      severity: 'error',
      message: `Capability "${capabilityIdStr}" is not a COMPOSITE capability`,
      context: { capability: capabilityIdStr },
    });
    return { expandedSteps: [], expandedGroups: [], diagnostics };
  }

  const subPipeline = registry.get(def.pipelineRef.id, def.pipelineRef.version);
  if (!subPipeline) {
    diagnostics.push({
      code: 'COMPOSITE_PIPELINE_NOT_FOUND',
      severity: 'error',
      message: `Pipeline "${def.pipelineRef.id}" v${def.pipelineRef.version} referenced by composite capability "${capabilityIdStr}" not found`,
      context: { capability: capabilityIdStr },
    });
    return { expandedSteps: [], expandedGroups: [], diagnostics };
  }

  const parentInputMap = new Map<string, InputBinding>();
  for (const binding of parentInputBindings) {
    parentInputMap.set(binding.portName, binding);
  }

  const allSteps: ExecutionStep[] = [];
  const allGroups: StepGroup[] = [];

  const subDependencies = new Map<string, Set<string>>();
  const subBindings = new Map<string, InputBinding[]>();

  for (const subNode of subPipeline.nodes) {
    subDependencies.set(subNode.id, new Set());
    subBindings.set(subNode.id, []);
  }

  for (const edge of subPipeline.edges) {
    const fromNode = extractNodeId(edge.from);
    const toNode = extractNodeId(edge.to);
    const toPort = extractPortName(edge.to);

    if (toNode === 'output' || toNode === 'input') continue;

    if (fromNode === 'input') {
      const fromPort = extractPortName(edge.from);
      const parentBinding = parentInputMap.get(fromPort);
      if (parentBinding) {
        subBindings.get(toNode)?.push({
          ...parentBinding,
          portName: toPort,
        });
      } else {
        subBindings.get(toNode)?.push({
          portName: toPort,
          source: 'pipeline-input' as const,
          pipelineInputName: fromPort,
        });
      }
    } else if (fromNode !== 'output') {
      const fromPort = extractPortName(edge.from);
      subDependencies.get(toNode)?.add(fromNode);
      subBindings.get(toNode)?.push({
        portName: toPort,
        source: 'step-output' as const,
        stepId: prefixId(nodeId, fromNode),
        outputPortName: fromPort,
      });
    }
  }

  for (const subNode of subPipeline.nodes) {
    const subCapId = subNode.capability.id as string;
    const subCapVer = subNode.capability.version as number | undefined;

    let subDef;
    try {
      subDef = catalog.get(
        capabilityId(subCapId),
        subCapVer !== undefined ? capabilityVersion(subCapVer) : undefined,
      );
    } catch {
      diagnostics.push({
        code: 'CAPABILITY_NOT_FOUND',
        severity: 'error',
        message: `Capability "${subCapId}" within composite "${capabilityIdStr}" not found`,
        context: { capability: subCapId },
      });
      continue;
    }

    if (subDef.source === 'COMPOSITE' && subDef.pipelineRef) {
      const nestedExpansion = expandCompositeNode(
        prefixId(nodeId, subNode.id),
        subCapId,
        subCapVer,
        subBindings.get(subNode.id) ?? [],
        catalog,
        registry,
        depth + 1,
      );
      allSteps.push(...nestedExpansion.expandedSteps);
      allGroups.push(...nestedExpansion.expandedGroups);
      diagnostics.push(...nestedExpansion.diagnostics);
    } else {
      const deps = subDependencies.get(subNode.id) ?? new Set<string>();
      const prefixedDeps = [...deps].map((d) => prefixId(nodeId, d));

      allSteps.push({
        id: prefixId(nodeId, subNode.id),
        capability: {
          id: subCapId,
          version: subCapVer,
        },
        inputs: subBindings.get(subNode.id) ?? [],
        dependsOn: prefixedDeps,
        canParallelize: true,
      });
    }
  }

  if (allSteps.length > 0) {
    const stepIds = allSteps.map((s) => s.id);
    allGroups.push({
      steps: stepIds,
      canParallelize: stepIds.length > 1,
    });
  }

  return { expandedSteps: allSteps, expandedGroups: allGroups, diagnostics };
}

export function resolveComposites(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
  registry: PipelineRegistry,
): {
  expandedPipeline: PipelineDefinition;
  diagnostics: CompilerDiagnostic[];
} {
  const diagnostics: CompilerDiagnostic[] = [];
  const expandedNodes: PipelineDefinition['nodes'][number][] = [];
  const expandedEdges: PipelineDefinition['edges'][number][] = [];
  const compositeSteps: ExecutionStep[] = [];

  const compositeNodeIds = new Set<string>();

  for (const node of pipeline.nodes) {
    const capIdStr = node.capability.id as string;
    const capVerNum = node.capability.version as number | undefined;

    let def;
    try {
      def = catalog.get(
        capabilityId(capIdStr),
        capVerNum !== undefined ? capabilityVersion(capVerNum) : undefined,
      );
    } catch {
      expandedNodes.push(node);
      continue;
    }

    if (def.source === 'COMPOSITE' && def.pipelineRef) {
      compositeNodeIds.add(node.id);

      const inputBindings: InputBinding[] = [];
      for (const edge of pipeline.edges) {
        const toNode = extractNodeId(edge.to);
        const toPort = extractPortName(edge.to);
        if (toNode !== node.id) continue;

        const fromNode = extractNodeId(edge.from);
        if (fromNode === 'input') {
          const fromPort = extractPortName(edge.from);
          inputBindings.push({
            portName: toPort,
            source: 'pipeline-input' as const,
            pipelineInputName: fromPort,
          });
        } else {
          const fromPort = extractPortName(edge.from);
          inputBindings.push({
            portName: toPort,
            source: 'step-output' as const,
            stepId: fromNode,
            outputPortName: fromPort,
          });
        }
      }

      const expansion = expandCompositeNode(
        node.id,
        capIdStr,
        capVerNum,
        inputBindings,
        catalog,
        registry,
        1,
      );

      diagnostics.push(...expansion.diagnostics);
      compositeSteps.push(...expansion.expandedSteps);

      const subPipeline = registry.get(def.pipelineRef.id, def.pipelineRef.version);
      if (subPipeline) {
        for (const subNode of subPipeline.nodes) {
          const prefixed = `${node.id}/${subNode.id}`;
          expandedNodes.push({
            id: prefixed,
            capability: subNode.capability,
            config: subNode.config,
          });
        }

        for (const subEdge of subPipeline.edges) {
          const fromNode = extractNodeId(subEdge.from);
          const fromPort = extractPortName(subEdge.from);
          const toNode = extractNodeId(subEdge.to);
          const toPort = extractPortName(subEdge.to);

          if (fromNode === 'input' || toNode === 'output') continue;

          expandedEdges.push({
            from: `${node.id}/${fromNode}.${fromPort}`,
            to: `${node.id}/${toNode}.${toPort}`,
          });
        }
      }
    } else {
      expandedNodes.push(node);
    }
  }

  // Build input and output maps for each composite node
  const compositeInputTargets = new Map<string, Map<string, string[]>>();
  const compositeOutputSources = new Map<string, Map<string, string>>();

  for (const nodeId of compositeNodeIds) {
    const node = pipeline.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    let def;
    try {
      def = catalog.get(
        capabilityId(node.capability.id as string),
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version as number)
          : undefined,
      );
    } catch {
      continue;
    }

    if (!def.pipelineRef) continue;
    const subPipeline = registry.get(def.pipelineRef.id, def.pipelineRef.version);
    if (!subPipeline) continue;

    // Build input target map: portName -> list of prefixed internal targets
    const inputTargets = new Map<string, string[]>();
    for (const subEdge of subPipeline.edges) {
      if (subEdge.from.startsWith('input.')) {
        const portName = extractPortName(subEdge.from);
        const targets = inputTargets.get(portName) ?? [];
        const toNode = extractNodeId(subEdge.to);
        const toPort = extractPortName(subEdge.to);
        targets.push(`${nodeId}/${toNode}.${toPort}`);
        inputTargets.set(portName, targets);
      }
    }
    compositeInputTargets.set(nodeId, inputTargets);

    // Build output source map: portName -> prefixed source port
    const outputSources = new Map<string, string>();
    for (const output of subPipeline.outputs) {
      const sourceNode = extractNodeId(output.source);
      const sourcePort = extractPortName(output.source);
      outputSources.set(output.name, `${nodeId}/${sourceNode}.${sourcePort}`);
    }
    compositeOutputSources.set(nodeId, outputSources);
  }

  // Rewire parent edges
  for (const edge of pipeline.edges) {
    const fromNode = extractNodeId(edge.from);
    const toNode = extractNodeId(edge.to);
    const fromPort = extractPortName(edge.from);
    const toPort = extractPortName(edge.to);

    const fromIsComposite = compositeNodeIds.has(fromNode);
    const toIsComposite = compositeNodeIds.has(toNode);

    if (!fromIsComposite && !toIsComposite) {
      // Neither side is composite — keep as-is
      expandedEdges.push(edge);
      continue;
    }

    // Resolve the 'from' side
    let resolvedFroms: string[];
    if (fromIsComposite) {
      const outputSources = compositeOutputSources.get(fromNode);
      const source = outputSources?.get(fromPort);
      resolvedFroms = source ? [source] : [edge.from];
    } else {
      resolvedFroms = [edge.from];
    }

    // Resolve the 'to' side (may fan out to multiple internal targets)
    let resolvedTos: string[];
    if (toIsComposite) {
      const inputTargets = compositeInputTargets.get(toNode);
      const targets = inputTargets?.get(toPort);
      resolvedTos = targets && targets.length > 0 ? targets : [edge.to];
    } else {
      resolvedTos = [edge.to];
    }

    // Create edges for all combinations
    for (const from of resolvedFroms) {
      for (const to of resolvedTos) {
        expandedEdges.push({ from, to });
      }
    }
  }

  const expandedPipeline: PipelineDefinition = {
    id: pipeline.id,
    version: pipeline.version,
    name: pipeline.name,
    description: pipeline.description,
    inputs: pipeline.inputs,
    nodes: expandedNodes,
    edges: expandedEdges,
    outputs: pipeline.outputs,
  };

  return { expandedPipeline, diagnostics };
}
