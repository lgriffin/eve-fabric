import { useCallback } from 'react';
import { usePipelineStore } from '../stores/pipeline-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { useCatalogStore } from '../stores/catalog-store.js';
import { savePipeline } from '../services/gateway-client.js';
import {
  flowToPipeline,
  pipelineToYaml,
  yamlToPipeline,
  pipelineToFlow,
  enrichNodesWithCatalog,
  extractDefaultsFromYaml,
} from '../services/pipeline-serializer.js';
import { applyAutoLayout } from '../services/layout-engine.js';

export function useYamlImportExport() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const loadPipeline = usePipelineStore((s) => s.loadPipeline);
  const capabilities = useCatalogStore((s) => s.capabilities);
  const addToast = useToastStore((s) => s.addToast);

  const handleSave = useCallback(async () => {
    const definition = flowToPipeline(
      nodes,
      edges,
      { id: pipelineId || 'untitled', name: pipelineName, version: pipelineVersion },
      [],
      [],
    );
    const result = await savePipeline(definition);
    if (result.ok) {
      addToast('success', 'Saved', `Pipeline "${pipelineName}" saved to gateway`);
    } else {
      addToast('error', 'Save failed', result.error.message);
    }
  }, [nodes, edges, pipelineId, pipelineName, pipelineVersion, addToast]);

  const handleExport = useCallback(() => {
    const definition = flowToPipeline(
      nodes,
      edges,
      { id: pipelineId || 'untitled', name: pipelineName, version: pipelineVersion },
      [],
      [],
    );
    const yaml = pipelineToYaml(definition);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definition.id}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, pipelineId, pipelineName, pipelineVersion]);

  const processImportedYaml = useCallback(
    (yaml: string) => {
      try {
        const definition = yamlToPipeline(yaml);
        const defaults = extractDefaultsFromYaml(yaml);
        const { nodes: flowNodes, edges: flowEdges } = pipelineToFlow(definition);
        const catalogMap = new Map(
          capabilities.map((c) => [
            c.id,
            { name: c.name, source: c.source, inputs: c.inputs, outputs: c.outputs },
          ]),
        );
        const enriched = enrichNodesWithCatalog(flowNodes, catalogMap);
        const laid = applyAutoLayout(enriched, flowEdges);
        loadPipeline(
          laid,
          flowEdges,
          { id: definition.id, name: definition.name, version: definition.version },
          Object.keys(defaults).length > 0 ? defaults : undefined,
        );
      } catch (err) {
        addToast(
          'error',
          'Import failed',
          err instanceof Error ? err.message : 'Invalid YAML file',
        );
      }
    },
    [capabilities, loadPipeline, addToast],
  );

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const yaml = e.target?.result;
        if (typeof yaml === 'string') processImportedYaml(yaml);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [processImportedYaml]);

  return { handleSave, handleExport, handleImport };
}
