import { useState } from 'react';
import { GraphQLPreview } from './GraphQLPreview.js';
import { ExecutionPlanPreview } from './ExecutionPlanPreview.js';
import { colors, fontSize } from '../../tokens.js';

type Tab = 'graphql' | 'plan';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'graphql', label: 'GraphQL' },
  { key: 'plan', label: 'Plan' },
];

/** The question's saved form and its plan, one at a time. */
export function PreviewTabs({ height }: { height?: number | string }) {
  const [activeTab, setActiveTab] = useState<Tab>('graphql');
  return (
    <div
      style={{
        height: height ?? 200,
        background: colors.surface.raised,
        borderTop: `1px solid ${colors.surface.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        role="tablist"
        style={{ display: 'flex', borderBottom: `1px solid ${colors.surface.border}` }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 14px',
              fontSize: fontSize.sm,
              fontWeight: 600,
              border: 'none',
              borderBottom:
                activeTab === tab.key ? `2px solid ${colors.accent}` : '2px solid transparent',
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
  );
}
