import { useState, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { CapabilityPalette } from './components/palette/CapabilityPalette.js';
import { PipelineCanvas } from './components/canvas/PipelineCanvas.js';
import { DiagnosticsPanel } from './components/preview/DiagnosticsPanel.js';
import { GraphQLPreview } from './components/preview/GraphQLPreview.js';
import { ExecutionPlanPreview } from './components/preview/ExecutionPlanPreview.js';
import { ResultsPanel } from './components/preview/ResultsPanel.js';
import { Toolbar } from './components/shared/Toolbar.js';
import { NodeDetailPanel } from './components/detail/NodeDetailPanel.js';
import { PublishDialog } from './components/publish/PublishDialog.js';
import { BreadcrumbNav } from './components/drilldown/BreadcrumbNav.js';
import { CompositeOverlay } from './components/drilldown/CompositeOverlay.js';
import { usePipelineStore } from './stores/pipeline-store.js';
import {
  flowToPipeline,
  pipelineToYaml,
  yamlToPipeline,
  pipelineToFlow,
  enrichNodesWithCatalog,
} from './services/pipeline-serializer.js';
import { useLoadCatalog } from './hooks/useGatewayApi.js';
import { useCompiler, useAutoCompile } from './hooks/useCompiler.js';
import { useExecutor } from './hooks/useExecutor.js';
import { useCatalogStore } from './stores/catalog-store.js';

type PreviewTab = 'diagnostics' | 'graphql' | 'execution' | 'results';

export function App() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('diagnostics');
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const drilldownStack = usePipelineStore((s) => s.drilldownStack);
  const openComposite = usePipelineStore((s) => s.openComposite);
  const closeComposite = usePipelineStore((s) => s.closeComposite);
  const loadPipeline = usePipelineStore((s) => s.loadPipeline);
  const capabilities = useCatalogStore((s) => s.capabilities);

  useLoadCatalog();
  const { compileNow } = useCompiler();
  const { execute, validate } = useExecutor();
  useAutoCompile(true);

  const [validationErrors, setValidationErrors] = useState<
    Array<{ nodeId: string; nodeName: string; message: string }>
  >([]);

  const handleValidate = useCallback(() => {
    compileNow();
    const result = validate();
    setValidationErrors(result.errors);
  }, [compileNow, validate]);

  const handleExecute = useCallback(async () => {
    const valResult = validate();
    setValidationErrors(valResult.errors);
    if (!valResult.valid) return;

    const result = compileNow();
    if (result && result.success) {
      setActiveTab('results');
      await execute();
    }
  }, [compileNow, execute, validate]);

  const handleSave = useCallback(() => {
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

  const handleExport = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const processImportedYaml = useCallback(
    (yaml: string) => {
      try {
        const definition = yamlToPipeline(yaml);
        const { nodes: flowNodes, edges: flowEdges } = pipelineToFlow(definition);
        const catalogMap = new Map(
          capabilities.map((c) => [
            c.id,
            { name: c.name, source: c.source, inputs: c.inputs, outputs: c.outputs },
          ]),
        );
        const enriched = enrichNodesWithCatalog(flowNodes, catalogMap);
        loadPipeline(enriched, flowEdges, {
          id: definition.id,
          name: definition.name,
          version: definition.version,
        });
      } catch {
        // Invalid YAML - ignore
      }
    },
    [capabilities, loadPipeline],
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

  const executionStatusColor = useMemo(() => {
    if (!executionSession) return undefined;
    const colors: Record<string, string> = { running: '#42a5f5', completed: '#81c784' };
    return colors[executionSession.status] ?? '#ef5350';
  }, [executionSession]);

  const tabs: Array<{ key: PreviewTab; label: string }> = [
    { key: 'diagnostics', label: 'Diagnostics' },
    { key: 'graphql', label: 'GraphQL' },
    { key: 'execution', label: 'Execution Plan' },
    { key: 'results', label: 'Results' },
  ];

  return (
    <ReactFlowProvider>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#13131d',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#e0e0e0',
          overflow: 'hidden',
        }}
      >
        <Toolbar
          onValidate={handleValidate}
          onExecute={handleExecute}
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
          onPublish={() => setPublishDialogOpen(true)}
          validationErrors={validationErrors}
        />

        {drilldownStack.length > 0 && (
          <BreadcrumbNav
            pipelineName={pipelineName}
            stack={drilldownStack}
            onNavigate={(depth) => {
              if (depth < 0) {
                while (usePipelineStore.getState().drilldownStack.length > 0) {
                  closeComposite();
                }
              } else {
                const currentLen = usePipelineStore.getState().drilldownStack.length;
                for (let i = currentLen - 1; i > depth; i--) {
                  closeComposite();
                }
              }
            }}
          />
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <CapabilityPalette />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <PipelineCanvas />
            </div>

            <div
              style={{
                height: 200,
                background: '#1e1e2e',
                borderTop: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #333',
                }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      borderBottom:
                        activeTab === tab.key ? '2px solid #7c4dff' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === tab.key ? '#e0e0e0' : '#666',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                    {tab.key === 'results' && executionSession && (
                      <span
                        style={{
                          marginLeft: 4,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          display: 'inline-block',
                          background: executionStatusColor,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'diagnostics' && <DiagnosticsPanel />}
                {activeTab === 'graphql' && <GraphQLPreview />}
                {activeTab === 'execution' && <ExecutionPlanPreview />}
                {activeTab === 'results' && <ResultsPanel />}
              </div>
            </div>
          </div>

          {selectedNodeId && <NodeDetailPanel />}
        </div>
        <PublishDialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} />

        {drilldownStack.length > 0 && (
          <CompositeOverlay
            entry={drilldownStack[drilldownStack.length - 1]!}
            onClose={closeComposite}
            onDrillDown={openComposite}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
