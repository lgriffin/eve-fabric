import { useEffect, useState } from 'react';
import { useDraftStore } from '../../stores/draft-store.js';
import { getChoices, type Choice, type DraftView } from '../../services/draft-client.js';
import { colors } from '../../tokens.js';
import { input, button } from './styles.js';
import { holeValue, CHOICES_DELAY_MS } from './hole-value.js';

/** A hole: type a value, or pick one of the choices the fabric lists. */
export function HoleInput({ view, hole }: { view: DraftView; hole: DraftView['holes'][number] }) {
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
    }, CHOICES_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, steps, hole.name, text, token]);

  const submit = (text: string) => {
    const value = holeValue(text, choices);
    if (value === null || busy) return;
    void fill(hole.name, value);
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
