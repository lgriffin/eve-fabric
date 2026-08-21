import { useCallback, useEffect, useRef } from 'react';
import { compile, type CompileResult } from '@eve-fabric/compiler';
import { CapabilityCatalog, semanticTypeId } from '@eve-fabric/domain';
import { usePipelineStore } from '../stores/pipeline-store.js';
import { useCatalogStore } from '../stores/catalog-store.js';
import { flowToPipeline } from '../services/pipeline-serializer.js';

function buildCatalog(
  capabilities: ReturnType<typeof useCatalogStore.getState>['capabilities'],
): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  for (const cap of capabilities) {
    const inputs = new Map(
      cap.inputs.map((i) => [
        i.name,
        {
          name: i.name,
          semanticType: i.semanticType,
          required: i.required,
        },
      ]),
    );
    const outputs = new Map(
      cap.outputs.map((o) => [
        o.name,
        {
          name: o.name,
          semanticType: o.semanticType,
          required: false,
        },
      ]),
    );

    try {
      catalog.register({
        id: cap.id,
        version: cap.version,
        name: cap.name,
        description: cap.description,
        source: cap.source,
        inputs,
        outputs,
        dependencies: [],
        auth: { required: false, scopes: [] },
        cache: {
          cacheable: false,
          defaultTtlSeconds: 0,
          stalePermitted: false,
          identityInKey: false,
        },
        cost: { estimatedLatencyMs: 100, esiCallCount: cap.source === 'ESI' ? 1 : 0 },
      });
    } catch {
      // Skip capabilities that fail validation (e.g., invalid id format)
    }
  }
  return catalog;
}

function collectUnconnectedInputs(
  nodes: ReturnType<typeof usePipelineStore.getState>['nodes'],
  edges: ReturnType<typeof usePipelineStore.getState>['edges'],
) {
  return nodes.flatMap((n) => {
    const unconnected = n.data.inputs.filter(
      (input) => !edges.some((e) => e.target === n.id && e.targetHandle === input.name),
    );
    return unconnected.map((input) => ({
      name: `${n.id}.${input.name}`,
      semanticType: semanticTypeId(input.semanticType),
      required: input.required,
    }));
  });
}

function collectUnconnectedOutputs(
  nodes: ReturnType<typeof usePipelineStore.getState>['nodes'],
  edges: ReturnType<typeof usePipelineStore.getState>['edges'],
) {
  return nodes.flatMap((n) => {
    const unconnected = n.data.outputs.filter(
      (output) => !edges.some((e) => e.source === n.id && e.sourceHandle === output.name),
    );
    return unconnected.map((output) => ({
      name: `${n.id}.${output.name}`,
      source: `${n.id}.${output.name}`,
    }));
  });
}

export function useCompiler() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const setDiagnostics = usePipelineStore((s) => s.setDiagnostics);
  const setCompiledPlan = usePipelineStore((s) => s.setCompiledPlan);
  const setGraphqlSdl = usePipelineStore((s) => s.setGraphqlSdl);
  const capabilities = useCatalogStore((s) => s.capabilities);
  const nodeConfiguredValues = usePipelineStore((s) => s.nodeConfiguredValues);

  const compileNow = useCallback((): CompileResult | null => {
    if (nodes.length === 0) {
      setDiagnostics([
        {
          code: 'EMPTY_PIPELINE',
          severity: 'warning',
          message: 'Pipeline has no nodes. Add capabilities from the palette.',
        },
      ]);
      setCompiledPlan(null);
      setGraphqlSdl(null);
      return null;
    }

    const pipelineInputs = collectUnconnectedInputs(nodes, edges);
    const pipelineOutputs = collectUnconnectedOutputs(nodes, edges);

    const definition = flowToPipeline(
      nodes,
      edges,
      { id: pipelineId || 'untitled', name: pipelineName, version: pipelineVersion },
      pipelineInputs,
      pipelineOutputs.length > 0
        ? pipelineOutputs
        : [
            {
              name: 'result',
              source: `${nodes[nodes.length - 1]!.id}.${nodes[nodes.length - 1]!.data.outputs[0]?.name ?? 'output'}`,
            },
          ],
    );

    const catalog = buildCatalog(capabilities);

    const configuredInputs: Record<string, Record<string, unknown>> = {};
    for (const [nodeId, ports] of Object.entries(nodeConfiguredValues)) {
      const portValues: Record<string, unknown> = {};
      for (const [portName, cv] of Object.entries(ports)) {
        portValues[portName] = cv.value;
      }
      configuredInputs[nodeId] = portValues;
    }

    const result = compile(definition, catalog, { configuredInputs });

    setDiagnostics(result.diagnostics);
    setCompiledPlan(result.plan ?? null);

    if (result.success && result.plan) {
      try {
        const sdlLines: string[] = [];
        sdlLines.push('type Query {');
        sdlLines.push(
          `  ${definition.id.replace(/-/g, '_')}(input: ${definition.id.replace(/-/g, '_')}Input): ${definition.id.replace(/-/g, '_')}Result`,
        );
        sdlLines.push('}');
        sdlLines.push('');
        sdlLines.push(`input ${definition.id.replace(/-/g, '_')}Input {`);
        for (const inp of definition.inputs) {
          sdlLines.push(`  ${inp.name.replace(/\./g, '_')}: String${inp.required ? '!' : ''}`);
        }
        sdlLines.push('}');
        sdlLines.push('');
        sdlLines.push(`type ${definition.id.replace(/-/g, '_')}Result {`);
        for (const out of definition.outputs) {
          sdlLines.push(`  ${out.name.replace(/\./g, '_')}: String`);
        }
        sdlLines.push('}');
        setGraphqlSdl(sdlLines.join('\n'));
      } catch {
        setGraphqlSdl(null);
      }
    } else {
      setGraphqlSdl(null);
    }

    return result;
  }, [
    nodes,
    edges,
    pipelineId,
    pipelineName,
    pipelineVersion,
    capabilities,
    nodeConfiguredValues,
    setDiagnostics,
    setCompiledPlan,
    setGraphqlSdl,
  ]);

  return { compileNow };
}

export function useAutoCompile(enabled: boolean) {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const { compileNow } = useCompiler();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || nodes.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      compileNow();
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, enabled, compileNow]);
}
