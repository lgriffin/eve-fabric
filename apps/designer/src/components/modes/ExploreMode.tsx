import { DraftPanel } from '../draft/DraftPanel.js';
import { PreviewTabs } from '../preview/PreviewTabs.js';

/** Explore: the subjects and the moves they offer, with the question's saved form beside them. No canvas. */
export function ExploreMode() {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} data-mode="explore">
      <DraftPanel width={420} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PreviewTabs height="100%" />
      </div>
    </div>
  );
}
