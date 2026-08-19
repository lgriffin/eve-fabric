import { useState } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';

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
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 600 }}>Generated SDL</span>
        {sdl && (
          <button
            onClick={handleCopy}
            style={{
              padding: '2px 8px',
              fontSize: '10px',
              background: '#333',
              border: 'none',
              borderRadius: 3,
              color: '#aaa',
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
              color: '#81c784',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {sdl}
          </pre>
        ) : (
          <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: 20 }}>
            Validate your pipeline to generate a GraphQL schema preview.
          </div>
        )}
      </div>
    </div>
  );
}
