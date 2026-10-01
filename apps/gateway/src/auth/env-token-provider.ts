import { z } from 'zod';
import type { TokenInfo, TokenProvider } from '@eve-fabric/core';

const envSchema = z.object({
  ESI_TOKEN: z.string().min(1).optional(),
  ESI_SCOPES: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .default(''),
});

export class EnvTokenProvider implements TokenProvider {
  private readonly token: string | undefined;
  private readonly availableScopes: ReadonlySet<string>;

  constructor() {
    const parsed = envSchema.parse({
      ESI_TOKEN: process.env['ESI_TOKEN'],
      ESI_SCOPES: process.env['ESI_SCOPES'],
    });
    this.token = parsed.ESI_TOKEN;
    this.availableScopes = new Set(parsed.ESI_SCOPES);
  }

  async getToken(): Promise<TokenInfo | undefined> {
    if (!this.token) return undefined;
    return {
      token: this.token,
      scopes: [...this.availableScopes],
    };
  }

  async hasScopes(required: readonly string[]): Promise<boolean> {
    if (required.length === 0) return true;
    if (!this.token) return false;
    return required.every((s) => this.availableScopes.has(s));
  }
}
