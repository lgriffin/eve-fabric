export interface TokenInfo {
  readonly token: string;
  readonly scopes: readonly string[];
  readonly expiresAt?: Date | undefined;
}

export interface TokenProvider {
  getToken(): Promise<TokenInfo | undefined>;
  hasScopes(required: readonly string[]): Promise<boolean>;
}
