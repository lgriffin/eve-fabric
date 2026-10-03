import { memo, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CapabilityFlowNode } from '../../stores/types.js';
import { useDraftStore } from '../../stores/draft-store.js';
import { SemanticHandle } from './SemanticHandle.js';
import { colors, fontSize, borderRadius, fontFamily, SOURCE_BADGES } from '../../tokens.js';

const pulseKeyframes = `
@keyframes unconnected-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 167, 38, 0.4); }
  50% { box-shadow: 0 0 6px 2px rgba(255, 167, 38, 0.6); }
}
`;

let styleInjected = false;
function injectPulseStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
}

/**
 * One step of the scaffold: its capability, its ports and what feeds them.
 * A required input nothing feeds is a hole the question still needs filled.
 */
export const CapabilityNode = memo(function CapabilityNode({
  id,
  data,
  selected,
}: NodeProps<CapabilityFlowNode>) {
  injectPulseStyle();

  // The question says which of this step's inputs are still holes; a filled
  // one has no edge on the canvas either, so edges cannot tell them apart.
  const holes = useDraftStore((s) => s.view?.holes);
  const openHoles = useMemo(
    () => new Set((holes ?? []).filter((h) => h.node === id).map((h) => h.port)),
    [holes, id],
  );

  const [showAdvanced, setShowAdvanced] = useState(false);

  const badge = SOURCE_BADGES[data.source] ?? {
    color: colors.source.fallback,
    label: data.source || '?',
  };

  return (
    <div
      style={{
        background: colors.surface.raised,
        border: `2px solid ${selected ? colors.accent : colors.surface.border}`,
        borderRadius: borderRadius.xl,
        minWidth: 200,
        fontFamily,
        boxShadow: selected ? '0 0 12px rgba(124,77,255,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
          background: colors.surface.overlay,
          borderRadius: '6px 6px 0 0',
          gap: 4,
        }}
      >
        <span
          style={{ color: colors.text.primary, fontWeight: 600, fontSize: fontSize.md, flex: 1 }}
        >
          {data.label}
        </span>
        <button
          className="nopan nodrag"
          onClick={(e) => {
            e.stopPropagation();
            setShowAdvanced((v) => !v);
          }}
          style={{
            background: 'transparent',
            color: colors.text.dim,
            border: 'none',
            cursor: 'pointer',
            fontSize: '9px',
            padding: '0 2px',
            flexShrink: 0,
          }}
          title={showAdvanced ? 'Hide details' : 'Show details'}
        >
          {showAdvanced ? '▴' : '⋯'}
        </button>
        <span
          style={{
            background: badge.color,
            color: colors.surface.raised,
            padding: '1px 6px',
            borderRadius: borderRadius.md,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
      </div>

      <div style={{ padding: '4px 0' }}>
        {data.inputs.length > 0 && (
          <div style={{ padding: '2px 10px 4px' }}>
            {data.inputs.map((input) => {
              const isHole = openHoles.has(input.name);
              return (
                <div
                  key={input.name}
                  title={isHole ? 'Still needed: fill it in the question panel' : undefined}
                  style={{
                    marginBottom: 4,
                    ...(isHole
                      ? { borderRadius: 4, animation: 'unconnected-pulse 2s ease-in-out infinite' }
                      : {}),
                  }}
                >
                  <SemanticHandle
                    type="target"
                    id={input.name}
                    semanticType={input.semanticType}
                    label={input.name}
                    required={input.required}
                  />
                </div>
              );
            })}
          </div>
        )}

        {data.outputs.length > 0 && (
          <div
            style={{
              borderTop: data.inputs.length > 0 ? `1px solid ${colors.surface.border}` : undefined,
              padding: '2px 0',
            }}
          >
            {data.outputs.map((output) => (
              <SemanticHandle
                key={output.name}
                type="source"
                id={output.name}
                semanticType={output.semanticType}
                label={output.name}
              />
            ))}
          </div>
        )}
      </div>

      {showAdvanced && (
        <div
          style={{
            padding: '4px 10px 6px',
            borderTop: `1px solid ${colors.surface.border}`,
            fontSize: '9px',
            color: colors.text.dim,
            background: colors.surface.base,
          }}
        >
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: colors.text.disabled }}>ID: </span>
            <span>
              {data.capabilityId}@{data.capabilityVersion}
            </span>
          </div>
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: colors.text.disabled }}>Source: </span>
            <span>{data.source}</span>
          </div>
          {data.inputs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: colors.text.disabled, fontWeight: 600, marginBottom: 1 }}>
                Input Types
              </div>
              {data.inputs.map((input) => (
                <div key={input.name} style={{ paddingLeft: 6, marginBottom: 1 }}>
                  <span style={{ color: colors.text.dim }}>{input.name}</span>
                  <span style={{ color: colors.text.disabled }}>{' → '}</span>
                  <span style={{ color: colors.accent }}>{input.semanticType}</span>
                </div>
              ))}
            </div>
          )}
          {data.outputs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: colors.text.disabled, fontWeight: 600, marginBottom: 1 }}>
                Output Types
              </div>
              {data.outputs.map((output) => (
                <div key={output.name} style={{ paddingLeft: 6, marginBottom: 1 }}>
                  <span style={{ color: colors.text.dim }}>{output.name}</span>
                  <span style={{ color: colors.text.disabled }}>{' → '}</span>
                  <span style={{ color: colors.status.successLight }}>{output.semanticType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          padding: '3px 10px',
          borderTop: `1px solid ${colors.surface.border}`,
          fontSize: fontSize.xs,
          color: colors.text.dim,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {data.capabilityId}@{data.capabilityVersion}
        </span>
      </div>
    </div>
  );
});
