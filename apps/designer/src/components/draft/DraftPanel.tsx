import { useDraftStore } from '../../stores/draft-store.js';
import type { DraftView } from '../../services/draft-client.js';
import { colors } from '../../tokens.js';
import { SubjectPicker } from './SubjectPicker.js';
import { SaveQuestion } from './SaveQuestion.js';
import { HoleInput } from './HoleInput.js';
import { panel, heading, button, input as panelInput } from './styles.js';
import { dragMove } from '../canvas/composition.js';

function stepLabel(step: DraftView['steps'][number]): string {
  return step.kind === 'move' ? step.move : `${step.hole} = ${JSON.stringify(step.value)}`;
}

function subjectLabel(subject: DraftView['subject']): string {
  return 'start' in subject ? subject.start : `${subject.kind} ${String(subject.value)}`;
}

/** The moves the fabric offers from the cursor, and why one cannot be taken. */
function Moves({ view }: { view: DraftView }) {
  const apply = useDraftStore((s) => s.apply);
  const busy = useDraftStore((s) => s.busy);
  return (
    <>
      <p style={heading}>Next</p>
      {view.moves.length === 0 && <div style={{ color: colors.text.dim }}>No moves from here</div>}
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
            title={available ? `${why}. Click, or drag onto the canvas` : why}
            draggable={available && !busy}
            onDragStart={(e) => dragMove(e.dataTransfer, move.name)}
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
    </>
  );
}

/** The plan the fabric drew up for a complete question, and Run. */
function RunQuestion({ view }: { view: DraftView }) {
  const run = useDraftStore((s) => s.run);
  const busy = useDraftStore((s) => s.busy);
  const answer = useDraftStore((s) => s.answer);
  return (
    <>
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
    </>
  );
}

interface DraftPanelProps {
  /** A saved question under review: its steps, plan and Run, but no way to change it. */
  readOnly?: boolean;
  width?: number;
}

/**
 * The question builder. The designer builds only through the moves the
 * fabric offers and the holes it names; the canvas shows the result.
 */
export function DraftPanel({ readOnly = false, width }: DraftPanelProps) {
  const view = useDraftStore((s) => s.view);
  const error = useDraftStore((s) => s.error);
  const busy = useDraftStore((s) => s.busy);
  const token = useDraftStore((s) => s.token);
  const undo = useDraftStore((s) => s.undo);
  const clear = useDraftStore((s) => s.clear);
  const setToken = useDraftStore((s) => s.setToken);

  return (
    <aside style={width === undefined ? panel : { ...panel, width }} aria-label="Question">
      {view === null ? (
        <SubjectPicker />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={heading}>Question</p>
            <span>
              {!readOnly && (
                <>
                  <button
                    onClick={() => void undo()}
                    disabled={busy || view.steps.length === 0}
                    style={button(view.steps.length > 0 && !busy)}
                  >
                    Undo
                  </button>{' '}
                </>
              )}
              <button onClick={clear} style={button(true)}>
                New
              </button>
            </span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, color: colors.text.secondary }}>
            <li>{subjectLabel(view.subject)}</li>
            {view.steps.map((step, i) => (
              <li key={i}>{stepLabel(step)}</li>
            ))}
          </ol>
          <div style={{ color: colors.text.muted }}>
            At <code>{view.cursor.type}</code>
          </div>

          {!readOnly && view.holes.length > 0 && (
            <>
              <p style={heading}>Still needed</p>
              {view.holes.map((hole) => (
                <HoleInput key={`${hole.node}.${hole.port}`} view={view} hole={hole} />
              ))}
            </>
          )}
          {!readOnly && <Moves view={view} />}
          <RunQuestion view={view} />
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
        style={{ ...panelInput }}
      />
    </aside>
  );
}
