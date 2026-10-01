import { useState, useMemo } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { ShortcutsOverlay } from './components/shared/ShortcutsOverlay.js';
import { ReactFlowProvider } from '@xyflow/react';
import { DraftPanel } from './components/draft/DraftPanel.js';
import { PipelineCanvas } from './components/canvas/PipelineCanvas.js';
import { DiagnosticsPanel } from './components/preview/DiagnosticsPanel.js';
import { GraphQLPreview } from './components/preview/GraphQLPreview.js';
import { ExecutionPlanPreview } from './components/preview/ExecutionPlanPreview.js';
import { ResultsPanel } from './components/preview/ResultsPanel.js';
import { Toolbar } from './components/shared/Toolbar.js';
import { ToastContainer } from './components/shared/ToastContainer.js';
import { ExecutionInputDialog } from './components/shared/ExecutionInputDialog.js';
import { NodeDetailPanel } from './components/detail/NodeDetailPanel.js';
import { PublishDialog } from './components/publish/PublishDialog.js';
import { BreadcrumbNav } from './components/drilldown/BreadcrumbNav.js';
import { CompositeOverlay } from './components/drilldown/CompositeOverlay.js';
import { usePipelineStore } from './stores/pipeline-store.js';
import { useDraftStore } from './stores/draft-store.js';
import { colors, fontFamily, fontSize } from './tokens.js';
import { useLoadCatalog } from './hooks/useGatewayApi.js';
import { useYamlImportExport } from './hooks/useYamlImportExport.js';
import { usePipelineActions } from './hooks/usePipelineActions.js';

export function App() {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const drilldownStack = usePipelineStore((s) => s.drilldownStack);
  const openComposite = usePipelineStore((s) => s.openComposite);
  const closeComposite = usePipelineStore((s) => s.closeComposite);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const undoCanvas = usePipelineStore((s) => s.undo);
  const redoCanvas = usePipelineStore((s) => s.redo);
  const drafting = useDraftStore((s) => s.subject !== null);
  const undoChange = useDraftStore((s) => s.undo);
  // While a question is open the canvas only shows it, so undo takes back
  // the question's last change and there is no canvas history to redo.
  const undo = useMemo(
    () => (drafting ? () => void undoChange() : undoCanvas),
    [drafting, undoChange, undoCanvas],
  );
  const redo = useMemo(() => (drafting ? () => {} : redoCanvas), [drafting, redoCanvas]);

  useLoadCatalog();
  const { handleSave, handleExport, handleImport } = useYamlImportExport();
  const {
    validationErrors,
    activeTab,
    setActiveTab,
    inputDialogOpen,
    setInputDialogOpen,
    pendingInputs,
    handleValidate,
    handleExecute,
    handleInputSubmit,
    handleRelayout,
    handleNavigate,
  } = usePipelineActions();

  useKeyboardShortcuts(
    useMemo(
      () => ({
        onUndo: undo,
        onRedo: redo,
        onSave: () => void handleSave(),
        onDelete: () => {
          if (selectedNodeId) removeNode(selectedNodeId);
        },
        onSelectAll: () => {
          /* handled by React Flow */
        },
        onEscape: () => {
          setSelectedNode(null);
          setShowShortcuts(false);
          setPublishDialogOpen(false);
          setInputDialogOpen(false);
        },
        onToggleHelp: () => setShowShortcuts((v) => !v),
      }),
      [undo, redo, handleSave, selectedNodeId, removeNode, setSelectedNode, setInputDialogOpen],
    ),
  );

  const executionStatusColor = useMemo(() => {
    if (!executionSession) return undefined;
    const statusColors: Record<string, string> = {
      running: colors.status.info,
      completed: colors.status.successLight,
    };
    return statusColors[executionSession.status] ?? colors.status.error;
  }, [executionSession]);

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
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
          background: colors.surface.base,
          fontFamily,
          color: colors.text.primary,
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
          onRelayout={handleRelayout}
          validationErrors={validationErrors}
        />

        {drilldownStack.length > 0 && (
          <BreadcrumbNav
            pipelineName={pipelineName}
            stack={drilldownStack}
            onNavigate={handleNavigate}
          />
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <DraftPanel />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <PipelineCanvas />
            </div>

            <div
              style={{
                height: 200,
                background: colors.surface.raised,
                borderTop: `1px solid ${colors.surface.border}`,
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${colors.surface.border}`,
                }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '6px 14px',
                      fontSize: fontSize.sm,
                      fontWeight: 600,
                      border: 'none',
                      borderBottom:
                        activeTab === tab.key
                          ? `2px solid ${colors.accent}`
                          : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === tab.key ? colors.text.primary : colors.text.dim,
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
      <ExecutionInputDialog
        open={inputDialogOpen}
        inputs={pendingInputs}
        pipelineId={pipelineId || 'untitled'}
        onSubmit={handleInputSubmit}
        onCancel={() => setInputDialogOpen(false)}
      />
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      <ToastContainer />
    </ReactFlowProvider>
  );
}
