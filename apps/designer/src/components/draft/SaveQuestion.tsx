import { useState } from 'react';
import { useDraftStore } from '../../stores/draft-store.js';
import { exportWeave, isWeaveName, type DraftView } from '../../services/draft-client.js';
import { download } from '../../services/download.js';
import { useToastStore } from '../../stores/toast-store.js';
import { heading, input, button } from './styles.js';

/**
 * Save a complete question: as its GraphQL, or as a weave another fabric
 * adds as a move. The names typed into the question become the weave's
 * holes, so it works on any item, not just this one.
 */
export function SaveQuestion({ view }: { view: DraftView }) {
  const complete = view.graphql !== undefined;
  const subject = useDraftStore((s) => s.subject);
  const steps = useDraftStore((s) => s.steps);
  const token = useDraftStore((s) => s.token);
  const addToast = useToastStore((s) => s.addToast);
  const [id, setId] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [as, setAs] = useState('');
  const [sharing, setSharing] = useState(false);
  const valid = complete && isWeaveName(id, version);

  const share = async () => {
    if (subject === null || !valid) return;
    setSharing(true);
    const result = await exportWeave(
      { subject, steps },
      { id, version, ...(as.trim().length > 0 ? { as: as.trim() } : {}) },
      token,
    );
    setSharing(false);
    if (!result.ok) {
      addToast('error', 'Not shared', result.message);
      return;
    }
    download(result.data, 'application/yaml', `${id}.weave.yaml`);
    addToast('success', 'Shared', `${id}@${version}, as a weave`);
  };

  return (
    <>
      <p style={heading}>Save</p>
      <button
        onClick={() => download(view.graphql ?? '', 'application/graphql', 'question.graphql')}
        disabled={!complete}
        title={complete ? 'Download it as a .graphql' : 'Fill the holes first'}
        style={button(complete)}
      >
        Save as GraphQL
      </button>
      <input
        aria-label="Weave id"
        placeholder="Weave id, such as me.forge.prices"
        value={id}
        onChange={(e) => setId(e.target.value)}
        style={input}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          aria-label="Weave version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          style={{ ...input, width: 80 }}
        />
        <input
          aria-label="Move name"
          placeholder="Offered as (move name)"
          value={as}
          onChange={(e) => setAs(e.target.value)}
          style={input}
        />
      </div>
      <button
        onClick={() => void share()}
        disabled={!valid || sharing}
        title={
          valid
            ? 'Download it as a .weave.yaml'
            : 'Fill the holes, then give an id like me.forge.prices and a version like 1.0.0'
        }
        style={button(valid && !sharing)}
      >
        Share as weave
      </button>
    </>
  );
}
