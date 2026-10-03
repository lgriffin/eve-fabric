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

/** JSON, and the bearer token that a character's scoped moves need, if one is given. */
function headersFor(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined && token.length > 0) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function call<T>(
  path: string,
  init: RequestInit | undefined,
  token: string | undefined,
): Promise<DraftResult<T>> {
  try {
    const res = await fetch(path, { ...init, headers: headersFor(token) });
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
  token?: string,
): Promise<DraftResult<{ choices: Choice[] }>> {
  return call('/api/drafts/choices', post({ ...request, hole, text }), token);
}

export function runDraft(
  request: DraftRequest,
  token?: string,
): Promise<DraftResult<{ answer: unknown; view: DraftView }>> {
  return call('/api/drafts/run', post(request), token);
}

/** A weave as the gateway lists it. */
interface WeaveRef {
  readonly id: string;
  readonly version: string;
}

const WEAVE_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const VERSION = /^\d+\.\d+\.\d+$/;

/**
 * An id and version the gateway takes for a weave: two or more lowercase,
 * dot-separated parts, such as me.forge.prices, and x.y.z.
 */
export function isWeaveName(id: string, version: string): boolean {
  return WEAVE_ID.test(id) && VERSION.test(version);
}

/** The fields a draft is shared under as a weave. */
interface WeaveOptions {
  readonly id: string;
  readonly version: string;
  /** The move it is offered under on what the draft started from. */
  readonly as?: string;
}

/**
 * A draft as a weave: its YAML, ready to save and add to another fabric. The
 * token replays it as the character whose scoped moves it used.
 */
export async function exportWeave(
  request: DraftRequest,
  weave: WeaveOptions,
  token?: string,
): Promise<DraftResult<string>> {
  try {
    const res = await fetch('/api/drafts/weave', {
      method: 'POST',
      headers: headersFor(token),
      body: JSON.stringify({ ...request, weave }),
    });
    const text = await res.text();
    if (res.ok) return { ok: true, data: text };
    const body = JSON.parse(text) as { error?: { message?: string } };
    return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
  }
}

/** Adds a weave, from its YAML, to the gateway's fabric. */
export function addWeave(document: string): Promise<DraftResult<WeaveRef>> {
  return call('/api/weaves', post({ document }), undefined);
}

/** A capability as the fabric describes it: what the canvas names a step and its ports by. */
export interface CatalogCapability {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly inputs: readonly { name: string; semanticType: string; required: boolean }[];
  readonly outputs: readonly { name: string; semanticType: string }[];
  readonly isComposite: boolean;
}

/** The fabric's capabilities, for the canvas's node labels and ports. */
export function getCatalog(): Promise<DraftResult<{ capabilities: CatalogCapability[] }>> {
  return call('/api/registry', undefined, undefined);
}
