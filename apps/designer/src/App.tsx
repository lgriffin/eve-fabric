import { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { DraftSubject } from '@eve-fabric/fabric';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useMode } from './hooks/useMode.js';
import { useOpenFile } from './hooks/useOpenFile.js';
import { useDraftStore } from './stores/draft-store.js';
import { useToastStore } from './stores/toast-store.js';
import { download } from './services/download.js';
import { ShortcutsOverlay } from './components/shared/ShortcutsOverlay.js';
import { Toolbar } from './components/shared/Toolbar.js';
import { ToastContainer } from './components/shared/ToastContainer.js';
import { ExploreMode } from './components/modes/ExploreMode.js';
import { BuildMode } from './components/modes/BuildMode.js';
import { ReviewMode } from './components/modes/ReviewMode.js';
import { colors, fontFamily } from './tokens.js';

function titleOf(subject: DraftSubject | null): string {
  if (subject === null) return 'No question yet';
  return 'start' in subject ? subject.start : `${subject.kind} ${String(subject.value)}`;
}

const VIEWS = { explore: ExploreMode, build: BuildMode, review: ReviewMode } as const;

/**
 * The designer: a question built from the moves and holes the fabric
 * offers, shown in one of three layouts over the same store.
 */
export function App() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const mode = useMode();
  const subject = useDraftStore((s) => s.subject);
  const loadCatalog = useDraftStore((s) => s.loadCatalog);
  const addToast = useToastStore((s) => s.addToast);
  const { handleOpen, handleDrop } = useOpenFile();
  const View = VIEWS[mode];

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useKeyboardShortcuts(
    useMemo(
      () => ({
        // Nothing to take back before a question starts, so nothing to say either.
        onUndo: () => {
          const { subject: open, steps, mode: now, undo } = useDraftStore.getState();
          if (open !== null && steps.length > 0 && now !== 'review') void undo();
        },
        // A question's saved form is its GraphQL, which it has once its holes are filled.
        onSave: () => {
          const { subject: open, view } = useDraftStore.getState();
          if (open === null) return;
          if (view?.graphql === undefined) {
            addToast('error', 'Not saved', 'Fill the question’s holes first');
            return;
          }
          download(view.graphql, 'application/graphql', 'question.graphql');
          addToast('success', 'Saved', 'The question, as GraphQL');
        },
        onSelectAll: () => {
          /* handled by React Flow */
        },
        onEscape: () => {
          useDraftStore.getState().selectNode(null);
          setShowShortcuts(false);
        },
        onToggleHelp: () => setShowShortcuts((v) => !v),
      }),
      [addToast],
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
        <Toolbar title={titleOf(subject)} onOpen={handleOpen} />
        <View />
      </div>
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      <ToastContainer />
    </ReactFlowProvider>
  );
}
