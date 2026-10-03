import { useCallback } from 'react';
import { usePipelineStore } from '../stores/pipeline-store.js';
import { useDraftStore } from '../stores/draft-store.js';
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
import { addWeave } from '../services/draft-client.js';
import { fileKind, OPENABLE } from '../services/file-kind.js';
import { download } from '../services/download.js';

export function useYamlImportExport() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const loadPipeline = usePipelineStore((s) => s.loadPipeline);
  const capabilities = useCatalogStore((s) => s.capabilities);
  const addToast = useToastStore((s) => s.addToast);

  /**
   * A question's saved form is its GraphQL, not the scaffold on the canvas:
   * while one is open, Save and Export give that document. Returns whether
   * a question was open.
   */
  const saveQuestion = useCallback((): boolean => {
    const { subject, view } = useDraftStore.getState();
    if (subject === null) return false;
    if (view?.graphql === undefined) {
      addToast('error', 'Not saved', 'Fill the question’s holes first');
    } else {
      download(view.graphql, 'application/graphql', 'question.graphql');
      addToast('success', 'Saved', 'The question, as GraphQL');
    }
    return true;
  }, [addToast]);

  const handleSave = useCallback(async () => {
    if (saveQuestion()) return;
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
  }, [nodes, edges, pipelineId, pipelineName, pipelineVersion, addToast, saveQuestion]);

  const handleExport = useCallback(() => {
    if (saveQuestion()) return;
    const definition = flowToPipeline(
      nodes,
      edges,
      { id: pipelineId || 'untitled', name: pipelineName, version: pipelineVersion },
      [],
      [],
    );
    download(pipelineToYaml(definition), 'text/yaml', `${definition.id}.yaml`);
  }, [nodes, edges, pipelineId, pipelineName, pipelineVersion, saveQuestion]);

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
        // The canvas now shows this pipeline, not the question, and canvas
        // undo must not bring the question's scaffold back.
        const leaving = useDraftStore.getState().subject !== null;
        useDraftStore.getState().leave();
        loadPipeline(
          laid,
          flowEdges,
          { id: definition.id, name: definition.name, version: definition.version },
          Object.keys(defaults).length > 0 ? defaults : undefined,
        );
        if (leaving) usePipelineStore.getState().clearHistory();
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

  /**
   * Opens what a file holds: a saved question becomes the open draft, a
   * weave is added to the gateway's fabric (and offered as a move from then
   * on), and anything else is read as pipeline YAML.
   */
  const openText = useCallback(
    async (name: string, text: string) => {
      const kind = fileKind(name, text);
      if (kind === 'question') {
        const opened = await useDraftStore.getState().load(text);
        if (opened) addToast('success', 'Opened', `The question in ${name}`);
        else addToast('error', 'Not opened', useDraftStore.getState().error ?? name);
        return;
      }
      if (kind === 'weave') {
        const added = await addWeave(text);
        if (!added.ok) {
          addToast('error', 'Weave not added', added.message);
          return;
        }
        addToast('success', 'Weave added', `${added.data.id}@${added.data.version} is now a move`);
        await useDraftStore.getState().refresh();
        return;
      }
      processImportedYaml(text);
    },
    [processImportedYaml, addToast],
  );

  const openFile = useCallback(
    (file: File) => {
      void file.text().then((text) => openText(file.name, text));
    },
    [openText],
  );

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = OPENABLE;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) openFile(file);
    };
    input.click();
  }, [openFile]);

  /** A file dropped anywhere on the designer is opened as if picked. */
  const handleDrop = useCallback(
    (event: { preventDefault(): void; dataTransfer: DataTransfer | null }) => {
      const file = event.dataTransfer?.files[0];
      if (file === undefined) return;
      event.preventDefault();
      openFile(file);
    },
    [openFile],
  );

  return { handleSave, handleExport, handleImport, handleDrop, openText };
}
