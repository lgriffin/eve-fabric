import { useState, useMemo, useCallback } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { ShortcutsOverlay } from './components/shared/ShortcutsOverlay.js';
import { ReactFlowProvider } from '@xyflow/react';
import { DraftPanel } from './components/draft/DraftPanel.js';
import { PipelineCanvas } from './components/canvas/PipelineCanvas.js';
import { GraphQLPreview } from './components/preview/GraphQLPreview.js';
import { ExecutionPlanPreview } from './components/preview/ExecutionPlanPreview.js';
import { Toolbar } from './components/shared/Toolbar.js';
import { ToastContainer } from './components/shared/ToastContainer.js';
import { NodeDetailPanel } from './components/detail/NodeDetailPanel.js';
import { BreadcrumbNav } from './components/drilldown/BreadcrumbNav.js';
import { CompositeOverlay } from './components/drilldown/CompositeOverlay.js';
import { usePipelineStore } from './stores/pipeline-store.js';
import { useDraftStore } from './stores/draft-store.js';
import { useToastStore } from './stores/toast-store.js';
import { colors, fontFamily, fontSize } from './tokens.js';
import { useLoadCatalog } from './hooks/useGatewayApi.js';
import { useOpenFile } from './hooks/useOpenFile.js';
import { applyAutoLayout } from './services/layout-engine.js';
import { download } from './services/download.js';
import type { DraftSubject } from '@eve-fabric/fabric';

type Tab = 'graphql' | 'plan';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'graphql', label: 'GraphQL' },
  { key: 'plan', label: 'Plan' },
];

function titleOf(subject: DraftSubject | null): string {
  if (subject === null) return 'No question yet';
  return 'start' in subject ? subject.start : `${subject.kind} ${String(subject.value)}`;
}

/**
 * The designer: a question built from the moves and holes the fabric
 * offers, and a canvas that shows the scaffold the question becomes.
 */
export function App() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('graphql');

  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const drilldownStack = usePipelineStore((s) => s.drilldownStack);
  const openComposite = usePipelineStore((s) => s.openComposite);
  const closeComposite = usePipelineStore((s) => s.closeComposite);
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const subject = useDraftStore((s) => s.subject);
  const undoChange = useDraftStore((s) => s.undo);
  const addToast = useToastStore((s) => s.addToast);
  const title = titleOf(subject);

  useLoadCatalog();
  const { handleOpen, handleDrop } = useOpenFile();

  // A question's saved form is its GraphQL, which it has once its holes are filled.
  const handleSave = useCallback(() => {
    const { subject: open, view } = useDraftStore.getState();
    if (open === null) return;
    if (view?.graphql === undefined) {
      addToast('error', 'Not saved', 'Fill the question’s holes first');
      return;
    }
    download(view.graphql, 'application/graphql', 'question.graphql');
    addToast('success', 'Saved', 'The question, as GraphQL');
  }, [addToast]);

  const handleRelayout = useCallback(() => {
    const { nodes, edges, loadPipeline } = usePipelineStore.getState();
    loadPipeline(applyAutoLayout(nodes, edges), edges);
  }, []);

  const handleNavigate = useCallback(
    (depth: number) => {
      const target = depth < 0 ? 0 : depth + 1;
      while (usePipelineStore.getState().drilldownStack.length > target) closeComposite();
    },
    [closeComposite],
  );

  useKeyboardShortcuts(
    useMemo(
      () => ({
        onUndo: () => void undoChange(),
        onSave: handleSave,
        onSelectAll: () => {
          /* handled by React Flow */
        },
        onEscape: () => {
          setSelectedNode(null);
          setShowShortcuts(false);
        },
        onToggleHelp: () => setShowShortcuts((v) => !v),
      }),
      [undoChange, handleSave, setSelectedNode],
    ),
  );

  return (
    <ReactFlowProvider>
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={handleDrop}
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
        <Toolbar title={title} onOpen={handleOpen} onRelayout={handleRelayout} />

        {drilldownStack.length > 0 && (
          <BreadcrumbNav pipelineName={title} stack={drilldownStack} onNavigate={handleNavigate} />
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
                {TABS.map((tab) => (
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
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'graphql' && <GraphQLPreview />}
                {activeTab === 'plan' && <ExecutionPlanPreview />}
              </div>
            </div>
          </div>

          {selectedNodeId && <NodeDetailPanel />}
        </div>

        {drilldownStack.length > 0 && (
          <CompositeOverlay
            entry={drilldownStack[drilldownStack.length - 1]!}
            onClose={closeComposite}
            onDrillDown={openComposite}
          />
        )}
      </div>
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      <ToastContainer />
    </ReactFlowProvider>
  );
}
