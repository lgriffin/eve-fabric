import { useEffect, useState } from 'react';
import { useDraftStore } from '../../stores/draft-store.js';
import { getSubjects, type DraftSubjects } from '../../services/draft-client.js';
import { useOpenFile } from '../../hooks/useOpenFile.js';
import { heading, input, button } from './styles.js';

/** Pick what the question is about: a kind and a name or id, or something that needs nothing. */
export function SubjectPicker() {
  const start = useDraftStore((s) => s.start);
  const load = useDraftStore((s) => s.load);
  const [subjects, setSubjects] = useState<DraftSubjects | null>(null);
  const [kind, setKind] = useState('type');
  const [value, setValue] = useState('');
  const [graphql, setGraphql] = useState('');
  const { handleOpen } = useOpenFile();

  useEffect(() => {
    void getSubjects().then((r) => r.ok && setSubjects(r.data));
  }, []);

  const begin = () => {
    const text = value.trim();
    if (text.length === 0) return;
    void start({ kind, value: /^\d+$/.test(text) ? Number(text) : text });
  };

  return (
    <>
      <p style={heading}>Ask about</p>
      <select
        aria-label="Kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        style={input}
      >
        {(subjects?.kinds ?? [{ kind: 'type', type: '' }]).map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.kind}
          </option>
        ))}
      </select>
      <input
        aria-label="Name or id"
        placeholder="Name or id, such as Tritanium"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && begin()}
        style={input}
      />
      <button onClick={begin} style={button(value.trim().length > 0, true)}>
        Start
      </button>
      {subjects !== null && subjects.starts.length > 0 && (
        <>
          <p style={heading}>Or start from</p>
          {subjects.starts.map((s) => (
            <button
              key={s.name}
              title={s.description}
              onClick={() => void start({ start: s.name })}
              style={button(true)}
            >
              {s.name}
            </button>
          ))}
        </>
      )}
      <p style={heading}>Or open a saved question</p>
      <textarea
        aria-label="GraphQL"
        placeholder="Paste its GraphQL"
        value={graphql}
        onChange={(e) => setGraphql(e.target.value)}
        rows={4}
        style={{ ...input, fontFamily: 'monospace' }}
      />
      <button
        onClick={() => void load(graphql)}
        style={button(graphql.trim().length > 0)}
        disabled={graphql.trim().length === 0}
      >
        Open
      </button>
      <button onClick={handleOpen} style={button(true)} title="Or drop a file anywhere">
        Open a file… (.graphql or .weave.yaml)
      </button>
    </>
  );
}
