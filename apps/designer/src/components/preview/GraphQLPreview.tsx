import { useState } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { colors } from '../../tokens.js';

export function GraphQLPreview() {
  const sdl = usePipelineStore((s) => s.graphqlSdl);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!sdl) return;
    await navigator.clipboard.writeText(sdl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: colors.text.secondary, fontSize: '11px', fontWeight: 600 }}>
          Generated SDL
        </span>
        {sdl && (
          <button
            onClick={handleCopy}
            style={{
              padding: '2px 8px',
              fontSize: '10px',
              background: colors.surface.border,
              border: 'none',
              borderRadius: 3,
              color: colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {sdl ? (
          <pre
            style={{
              margin: 0,
              color: colors.status.successLight,
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {sdl}
          </pre>
        ) : (
          <div
            style={{
              color: colors.text.disabled,
              fontSize: '12px',
              textAlign: 'center',
              padding: 20,
            }}
          >
            Validate your pipeline to generate a GraphQL schema preview.
          </div>
        )}
      </div>
    </div>
  );
}
