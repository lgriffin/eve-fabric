import type { Choice } from '../../services/draft-client.js';

const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * What typing into a hole fills it with: the choice of that name when the
 * fabric listed one, else a number when it reads as one, else the text. Blank
 * text fills nothing. The panel's input and the canvas menu agree on this.
 */
export function holeValue(text: string, choices: readonly Choice[]): number | string | null {
  const picked = choices.find((c) => c.name === text);
  const trimmed = text.trim();
  let value: number | string | null = null;
  if (picked !== undefined) value = picked.id;
  else if (trimmed.length > 0) value = NUMBER.test(trimmed) ? Number(trimmed) : trimmed;
  return value;
}

/** How long typing settles before the fabric is asked for choices. */
export const CHOICES_DELAY_MS = 200;
