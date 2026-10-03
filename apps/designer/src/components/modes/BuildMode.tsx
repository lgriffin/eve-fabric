import { useDraftStore } from '../../stores/draft-store.js';
import { DraftPanel } from '../draft/DraftPanel.js';
import { PipelineCanvas } from '../canvas/PipelineCanvas.js';
import { PreviewTabs } from '../preview/PreviewTabs.js';
import { NodeDetailPanel } from '../detail/NodeDetailPanel.js';

/** Build: the question panel beside the canvas that shows the scaffold it becomes. */
export function BuildMode({ readOnly = false }: { readOnly?: boolean }) {
  const selectedNodeId = useDraftStore((s) => s.selectedNodeId);
  return (
    <div
      style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
      data-mode={readOnly ? 'review' : 'build'}
    >
      <DraftPanel readOnly={readOnly} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <PipelineCanvas />
        </div>
        <PreviewTabs />
      </div>
      {selectedNodeId && <NodeDetailPanel />}
    </div>
  );
}
