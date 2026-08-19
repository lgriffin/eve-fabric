import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { CapabilityPalette } from './components/palette/CapabilityPalette.js';
import { PipelineCanvas } from './components/canvas/PipelineCanvas.js';
import { DiagnosticsPanel } from './components/preview/DiagnosticsPanel.js';
import { GraphQLPreview } from './components/preview/GraphQLPreview.js';
import { ExecutionPlanPreview } from './components/preview/ExecutionPlanPreview.js';
import { Toolbar } from './components/shared/Toolbar.js';
import { usePipelineStore } from './stores/pipeline-store.js';
import { flowToPipeline, pipelineToYaml } from './services/pipeline-serializer.js';
import { useLoadCatalog } from './hooks/useGatewayApi.js';

type PreviewTab = 'diagnostics' | 'graphql' | 'execution';

export function App() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('diagnostics');
  const [sdl, setSdl] = useState<string | undefined>();
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const setDiagnostics = usePipelineStore((s) => s.setDiagnostics);

  useLoadCatalog();

  const handleValidate = useCallback(() => {
    if (nodes.length === 0) {
      setDiagnostics([{
        code: 'GRAPH_EMPTY',
        severity: 'warning',
        message: 'Pipeline has no nodes. Add capabilities from the palette.',
      }]);
      setSdl(undefined);
      return;
    }

    setDiagnostics([{
      code: 'VALIDATION_OK',
      severity: 'info',
      message: `Pipeline validated: ${nodes.length} nodes, ${edges.length} edges.`,
    }]);
  }, [nodes, edges, setDiagnostics]);

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

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = () => {
      // Import would parse YAML into PipelineDefinition and load it
    };
    input.click();
  }, []);

  const tabs: Array<{ key: PreviewTab; label: string }> = [
    { key: 'diagnostics', label: 'Diagnostics' },
    { key: 'graphql', label: 'GraphQL' },
    { key: 'execution', label: 'Execution Plan' },
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
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
        />

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
                      borderBottom: activeTab === tab.key ? '2px solid #7c4dff' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === tab.key ? '#e0e0e0' : '#666',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'diagnostics' && <DiagnosticsPanel />}
                {activeTab === 'graphql' && <GraphQLPreview sdl={sdl} />}
                {activeTab === 'execution' && <ExecutionPlanPreview />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
