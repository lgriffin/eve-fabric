import type { DraftChange, DraftRequest, DraftView } from '@eve-fabric/fabric';

/**
 * The gateway's draft routes. The designer keeps only what a draft started
 * from and the changes made to it; the fabric replays them and says what
 * the draft offers next, so nothing here decides what connects to what.
 */
type DraftResult<T> = { ok: true; data: T } | { ok: false; message: string };

export interface DraftSubjects {
  readonly kinds: readonly { readonly kind: string; readonly type: string }[];
  readonly starts: readonly { readonly name: string; readonly description: string }[];
}

export interface Choice {
  readonly id: number;
  readonly name: string;
}

export type { DraftChange, DraftRequest, DraftView };

async function call<T>(
  path: string,
  init: RequestInit | undefined,
  token: string | undefined,
): Promise<DraftResult<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== undefined && token.length > 0) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { ...init, headers });
    const body = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
  }
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export function getSubjects(): Promise<DraftResult<DraftSubjects>> {
  return call('/api/drafts/subjects', undefined, undefined);
}

export function postDraft(request: DraftRequest, token?: string): Promise<DraftResult<DraftView>> {
  return call('/api/drafts', post(request), token);
}

export function getChoices(
  request: DraftRequest,
  hole: string,
  text: string,
): Promise<DraftResult<{ choices: Choice[] }>> {
  return call('/api/drafts/choices', post({ ...request, hole, text }), undefined);
}

export function runDraft(
  request: DraftRequest,
  token?: string,
): Promise<DraftResult<{ answer: unknown; view: DraftView }>> {
  return call('/api/drafts/run', post(request), token);
}
