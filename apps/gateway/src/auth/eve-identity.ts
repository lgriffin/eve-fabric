/**
 * The caller's EVE identity, from an EVE SSO access token sent as
 * `Authorization: Bearer <token>`. The token is a JWT naming the character
 * (`sub: CHARACTER:EVE:<id>`) and its scopes (`scp`). Its signature, issuer,
 * audience and expiry are checked against EVE SSO's published keys before
 * any of that is believed: the identity decides which moves a draft offers
 * and which cached private data a request may read.
 */
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';
import { identityFromToken } from '@lgriffin/esi.ts/client';
import type { Clock } from '@eve-fabric/core';
import type { FabricIdentity } from '@eve-fabric/fabric';
import { z } from 'zod';

/** Where EVE SSO publishes the keys it signs access tokens with. */
const EVE_SSO_JWKS_URL = 'https://login.eveonline.com/oauth/jwks';
const ISSUERS = ['login.eveonline.com', 'https://login.eveonline.com'];
const AUDIENCE = 'EVE Online';
/** How long a fetched key set is trusted before an unknown key id refetches it. */
const KEYS_MIN_AGE_MS = 5 * 60 * 1000;

/** A bearer token was sent that is not a valid, current EVE SSO access token. */
export class InvalidTokenError extends Error {
  constructor(reason: string) {
    super(`The bearer token is not a valid EVE SSO access token: ${reason}`);
    this.name = 'InvalidTokenError';
  }
}

/** Checks a token and gives its claims, or says why it is refused. */
export interface TokenVerifier {
  verify(token: string): Promise<SsoClaims>;
}

const bearerSchema = z
  .string()
  .regex(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
  .transform((header) => header.slice('Bearer '.length));

const headerSchema = z.object({ alg: z.literal('RS256'), kid: z.string().optional() });

const claimsSchema = z.object({
  sub: z.string().regex(/^CHARACTER:EVE:\d+$/),
  scp: z.union([z.string(), z.array(z.string())]).optional(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
});

export type SsoClaims = z.infer<typeof claimsSchema>;

const jwksSchema = z.object({
  keys: z.array(z.object({ kid: z.string().optional(), kty: z.string() }).passthrough()),
});

function decodePart(part: string): unknown {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidTokenError('it is not a JWT');
  }
}

/**
 * A verifier for RS256 tokens signed by one of `keys`, as EVE SSO issues
 * them. `keys(true)` asks for a fresh set, when a token names a key id the
 * set does not have.
 */
export function jwtVerifier(options: {
  readonly keys: (refresh: boolean) => Promise<readonly JsonWebKey[]>;
  readonly clock: Clock;
}): TokenVerifier {
  const keyFor = async (kid: string | undefined): Promise<JsonWebKey | undefined> => {
    const pick = (keys: readonly JsonWebKey[]) =>
      keys.find((k) => k['kty'] === 'RSA' && (kid === undefined || k['kid'] === kid));
    return pick(await options.keys(false)) ?? pick(await options.keys(true));
  };
  return {
    async verify(token) {
      const [head = '', body = '', signature = ''] = token.split('.');
      const header = headerSchema.safeParse(decodePart(head));
      if (!header.success) throw new InvalidTokenError('it is not signed with RS256');
      const jwk = await keyFor(header.data.kid);
      if (jwk === undefined) throw new InvalidTokenError('no EVE SSO key signed it');
      const signed = verify(
        'RSA-SHA256',
        Buffer.from(`${head}.${body}`),
        createPublicKey({ key: jwk, format: 'jwk' }),
        Buffer.from(signature, 'base64url'),
      );
      if (!signed) throw new InvalidTokenError('its signature does not match');
      const claims = claimsSchema.safeParse(decodePart(body));
      if (!claims.success) throw new InvalidTokenError('it does not name a character');
      const { iss, aud, exp } = claims.data;
      if (!ISSUERS.includes(iss)) throw new InvalidTokenError(`it was issued by ${iss}`);
      if (!(typeof aud === 'string' ? [aud] : aud).includes(AUDIENCE)) {
        throw new InvalidTokenError('it is not meant for EVE Online');
      }
      if (exp * 1000 <= options.clock.now()) throw new InvalidTokenError('it has expired');
      return claims.data;
    },
  };
}

/** A verifier against EVE SSO's published keys, fetched once and refetched for a new key id. */
export function eveSsoVerifier(clock: Clock, url = EVE_SSO_JWKS_URL): TokenVerifier {
  let cached: { keys: readonly JsonWebKey[]; at: number } | undefined;
  return jwtVerifier({
    clock,
    keys: async (refresh) => {
      const stale = cached === undefined || (refresh && clock.now() - cached.at > KEYS_MIN_AGE_MS);
      if (stale) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`EVE SSO keys: HTTP ${response.status}`);
        const { keys } = jwksSchema.parse(await response.json());
        cached = { keys, at: clock.now() };
      }
      return cached!.keys;
    },
  });
}

/**
 * The identity a request's bearer token names: undefined with no bearer
 * token, and {@link InvalidTokenError} for one that does not verify.
 */
export async function identityFromAuthorization(
  header: string | undefined,
  verifier: TokenVerifier,
): Promise<FabricIdentity | undefined> {
  if (header === undefined || !header.startsWith('Bearer ')) return undefined;
  const bearer = bearerSchema.safeParse(header);
  if (!bearer.success) throw new InvalidTokenError('it is not a JWT');
  const token = bearer.data;
  const { sub, scp = [] } = await verifier.verify(token);
  return {
    characterId: Number(sub.slice('CHARACTER:EVE:'.length)),
    scopes: typeof scp === 'string' ? [scp] : scp,
    esi: identityFromToken(token),
  };
}
