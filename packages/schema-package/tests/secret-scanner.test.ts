import { describe, it, expect } from 'vitest';
import { scanForSecrets } from '../src/secret-scanner.js';

describe('scanForSecrets', () => {
  it('returns clean result for safe content', () => {
    const result = scanForSecrets({
      schema: 'type Query { hello: String }',
      pipeline: 'id: my-pipeline',
    });
    expect(result).toHaveLength(0);
  });

  it('detects Bearer tokens', () => {
    const result = scanForSecrets({
      auth: 'Bearer abcdef1234567890abcdef',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'Bearer Token')).toBe(true);
  });

  it('detects JWT tokens', () => {
    const result = scanForSecrets({
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.rTCH8cLoGxAm_xw68z-zXVKi9ie6xJn9tnVWjd_9ftE',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'JWT')).toBe(true);
  });

  it('detects postgres connection strings', () => {
    const result = scanForSecrets({
      db: 'postgres://user:pass@localhost:5432/mydb',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'Connection String')).toBe(true);
  });

  it('detects mongodb connection strings', () => {
    const result = scanForSecrets({
      db: 'mongodb://admin:secret@mongo.example.com:27017/app',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('detects redis connection strings', () => {
    const result = scanForSecrets({
      cache: 'redis://default:mypassword@redis.example.com:6379',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('detects private keys', () => {
    const result = scanForSecrets({
      key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'Private Key')).toBe(true);
  });

  it('detects password patterns', () => {
    const result = scanForSecrets({
      config: 'password=my_super_secret_password_value123',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'Password Field')).toBe(true);
  });

  it('scans nested objects', () => {
    const result = scanForSecrets({
      level1: {
        level2: {
          secret: 'Bearer supersecrettokenvalue1234',
        },
      },
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.fieldPath).toContain('level1');
    expect(result[0]!.fieldPath).toContain('level2');
  });

  it('scans arrays', () => {
    const result = scanForSecrets({
      items: ['safe', 'Bearer tokentokentokentokentoken'],
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.fieldPath).toContain('[');
  });

  it('redacts matched values', () => {
    const result = scanForSecrets({
      db: 'postgres://user:pass@host:5432/db',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.matchedValue).toContain('***');
    expect(result[0]!.matchedValue).not.toContain('user:pass@host');
  });

  it('detects HTTP Basic credentials', () => {
    const result = scanForSecrets({
      auth: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'Base64 Credentials')).toBe(true);
  });

  it('detects API key patterns', () => {
    const result = scanForSecrets({
      config: 'apiKey=abcdef1234567890abcdef1234567890',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'API Key Header')).toBe(true);
  });

  it('detects token fields', () => {
    const result = scanForSecrets({
      config: 'token=abcdef1234567890abcdef1234567890',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.patternName === 'Token Field')).toBe(true);
  });
});
