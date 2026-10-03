import { useEffect, useState, type CSSProperties } from 'react';
import { useDraftStore } from '../../stores/draft-store.js';
import {
  exportWeave,
  isWeaveName,
  getChoices,
  getSubjects,
  type Choice,
  type DraftSubjects,
  type DraftView,
} from '../../services/draft-client.js';
import { download } from '../../services/download.js';
import { useOpenFile } from '../../hooks/useOpenFile.js';
import { useToastStore } from '../../stores/toast-store.js';
import { colors, fontSize } from '../../tokens.js';

const panel: CSSProperties = {
  width: 300,
  flexShrink: 0,
  overflowY: 'auto',
  background: colors.surface.raised,
  borderRight: `1px solid ${colors.surface.border}`,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: fontSize.sm,
};

const heading: CSSProperties = {
  color: colors.text.muted,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  margin: 0,
};

const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '5px 8px',
  background: colors.surface.base,
  border: `1px solid ${colors.surface.borderLight}`,
  borderRadius: 4,
  color: colors.text.primary,
};

function button(enabled: boolean, primary = false): CSSProperties {
  return {
    padding: '5px 10px',
    border: 'none',
    borderRadius: 4,
    background: primary ? colors.accent : colors.surface.overlay,
    color: enabled ? colors.text.primary : colors.text.disabled,
    cursor: enabled ? 'pointer' : 'not-allowed',
    textAlign: 'left',
  };
}

/** Pick what the question is about: a kind and a name or id, or something that needs nothing. */
function SubjectPicker() {
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
      <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
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

/**
 * Save a complete question: as its GraphQL, or as a weave another fabric
 * adds as a move. The names typed into the question become the weave's
 * holes, so it works on any item, not just this one.
 */
function SaveQuestion({ view }: { view: DraftView }) {
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

/** A hole: type a value, or pick one of the choices the fabric lists. */
function HoleInput({ view, hole }: { view: DraftView; hole: DraftView['holes'][number] }) {
  const fill = useDraftStore((s) => s.fill);
  const subject = useDraftStore((s) => s.subject);
  const steps = useDraftStore((s) => s.steps);
  const token = useDraftStore((s) => s.token);
  const busy = useDraftStore((s) => s.busy);
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);

  useEffect(() => {
    if (subject === null) return;
    const timer = setTimeout(() => {
      void getChoices({ subject, steps }, hole.name, text, token).then(
        (r) => r.ok && setChoices(r.data.choices),
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [subject, steps, hole.name, text, token]);

  const submit = (value: string) => {
    const picked = choices.find((c) => c.name === value);
    const trimmed = value.trim();
    if (trimmed.length === 0 || busy) return;
    void fill(
      hole.name,
      picked?.id ?? (/^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed),
    );
  };

  const list = `choices-${view.steps.length}-${hole.name}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ color: colors.text.secondary }} title={hole.description}>
        {hole.name} <span style={{ color: colors.text.dim }}>({hole.type})</span>
      </label>
      <input
        aria-label={hole.name}
        list={list}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit(text)}
        style={input}
      />
      <datalist id={list}>
        {choices.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <button
        onClick={() => submit(text)}
        disabled={busy}
        style={button(text.trim().length > 0 && !busy)}
      >
        Fill {hole.name}
      </button>
    </div>
  );
}

function stepLabel(step: DraftView['steps'][number]): string {
  return step.kind === 'move' ? step.move : `${step.hole} = ${JSON.stringify(step.value)}`;
}

/**
 * The question builder. The designer builds only through the moves the
 * fabric offers and the holes it names; the canvas shows the result.
 */
export function DraftPanel() {
  const view = useDraftStore((s) => s.view);
  const error = useDraftStore((s) => s.error);
  const busy = useDraftStore((s) => s.busy);
  const answer = useDraftStore((s) => s.answer);
  const token = useDraftStore((s) => s.token);
  const apply = useDraftStore((s) => s.apply);
  const undo = useDraftStore((s) => s.undo);
  const run = useDraftStore((s) => s.run);
  const clear = useDraftStore((s) => s.clear);
  const setToken = useDraftStore((s) => s.setToken);

  return (
    <aside style={panel} aria-label="Question">
      {view === null ? (
        <SubjectPicker />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={heading}>Question</p>
            <span>
              <button
                onClick={() => void undo()}
                disabled={busy || view.steps.length === 0}
                style={button(view.steps.length > 0 && !busy)}
              >
                Undo
              </button>{' '}
              <button onClick={clear} style={button(true)}>
                New
              </button>
            </span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, color: colors.text.secondary }}>
            <li>
              {'start' in view.subject
                ? view.subject.start
                : `${view.subject.kind} ${String(view.subject.value)}`}
            </li>
            {view.steps.map((step, i) => (
              <li key={i}>{stepLabel(step)}</li>
            ))}
          </ol>
          <div style={{ color: colors.text.muted }}>
            At <code>{view.cursor.type}</code>
          </div>

          {view.holes.length > 0 && (
            <>
              <p style={heading}>Still needed</p>
              {view.holes.map((hole) => (
                <HoleInput key={`${hole.node}.${hole.port}`} view={view} hole={hole} />
              ))}
            </>
          )}

          <p style={heading}>Next</p>
          {view.moves.length === 0 && (
            <div style={{ color: colors.text.dim }}>No moves from here</div>
          )}
          {view.moves.map((move) => {
            const available = move.unavailable === undefined;
            const other = move.unavailable?.character;
            let why = move.description;
            if (other !== undefined) {
              why = `Reads character ${String(other)}'s private data: ask as that character`;
            } else if (!available) {
              why = `Needs ${move.unavailable!.scopes.join(', ')}: add a token that holds it`;
            }
            return (
              <button
                key={move.name}
                disabled={!available || busy}
                title={why}
                onClick={() => void apply(move.name)}
                style={button(available)}
              >
                {move.name}
                {!available && (
                  <span style={{ color: colors.status.warning }}>
                    {other !== undefined ? ' (not your character)' : ' (needs scope)'}
                  </span>
                )}
              </button>
            );
          })}

          {view.plan !== undefined && (
            <>
              <p style={heading}>Plan</p>
              <div style={{ color: colors.text.secondary }}>
                {view.plan.steps.length} steps, {view.plan.esiCalls} ESI calls
                {view.plan.maxEsiCalls > view.plan.esiCalls &&
                  ` (up to ${view.plan.maxEsiCalls} with every list at its cap)`}
                {view.plan.scopes.length > 0 && `, needs ${view.plan.scopes.join(', ')}`}
              </div>
              <button onClick={() => void run()} disabled={busy} style={button(!busy, true)}>
                Run
              </button>
            </>
          )}
          {answer !== undefined && (
            <pre
              aria-label="Answer"
              style={{
                margin: 0,
                padding: 8,
                background: colors.surface.base,
                color: colors.status.successLight,
                whiteSpace: 'pre-wrap',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(answer, null, 2)}
            </pre>
          )}
          <SaveQuestion view={view} />
        </>
      )}
      {error !== null && (
        <div role="alert" style={{ color: colors.status.errorLight }}>
          {error}
        </div>
      )}
      <p style={heading}>EVE SSO token</p>
      <input
        aria-label="EVE SSO token"
        type="password"
        placeholder="For questions about your own character"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={input}
      />
    </aside>
  );
}
