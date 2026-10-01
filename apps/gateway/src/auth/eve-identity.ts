/**
 * The caller's EVE identity, read from an EVE SSO access token sent as
 * `Authorization: Bearer <token>`. The token is a JWT naming the character
 * (`sub: CHARACTER:EVE:<id>`) and its scopes (`scp`). It is read, not
 * verified: it decides which moves a draft offers, and ESI verifies it on
 * every call it is sent with.
 */
import { identityFromToken } from '@lgriffin/esi.ts/client';
import type { FabricIdentity } from '@eve-fabric/fabric';
import { z } from 'zod';

const claimsSchema = z.object({
  sub: z.string().regex(/^CHARACTER:EVE:\d+$/),
  scp: z.union([z.string(), z.array(z.string())]).optional(),
});

/** The identity a bearer token names, or undefined when there is none or it is not an EVE token. */
export function identityFromAuthorization(header: string | undefined): FabricIdentity | undefined {
  const token = /^Bearer (\S+)$/.exec(header ?? '')?.[1];
  if (token === undefined) return undefined;
  const payload = token.split('.')[1];
  if (payload === undefined) return undefined;
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  const parsed = claimsSchema.safeParse(claims);
  if (!parsed.success) return undefined;
  const { sub, scp = [] } = parsed.data;
  return {
    characterId: Number(sub.slice('CHARACTER:EVE:'.length)),
    scopes: typeof scp === 'string' ? [scp] : scp,
    esi: identityFromToken(token),
  };
}
