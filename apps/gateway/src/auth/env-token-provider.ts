import type { TokenInfo, TokenProvider } from '@eve-fabric/domain';

export class EnvTokenProvider implements TokenProvider {
  private readonly token: string | undefined;
  private readonly availableScopes: ReadonlySet<string>;

  constructor() {
    this.token = process.env['ESI_TOKEN'];
    this.availableScopes = new Set((process.env['ESI_SCOPES'] ?? '').split(',').filter(Boolean));
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
