export interface SecretFinding {
  readonly fieldPath: string;
  readonly patternName: string;
  readonly matchedValue: string;
}

const SECRET_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i }, // eslint-disable-line sonarjs/duplicates-in-character-class
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/ },
  { name: 'API Key Header', pattern: /[Aa]pi[_-]?[Kk]ey\s*[:=]\s*['"]?[A-Za-z0-9\-._~+/]{16,}/ },
  { name: 'Password Field', pattern: /[Pp]assword\s*[:=]\s*['"]?[^\s'"]{4,}/ },
  { name: 'Secret Field', pattern: /[Ss]ecret\s*[:=]\s*['"]?[^\s'"]{4,}/ },
  { name: 'Token Field', pattern: /[Tt]oken\s*[:=]\s*['"]?[A-Za-z0-9\-._~+/]{16,}/ },
  { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s]+/ },
  { name: 'Private Key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/ },
  { name: 'Base64 Credentials', pattern: /Basic\s+[A-Za-z0-9+/]{20,}={0,2}/ },
];

function redact(value: string): string {
  if (value.length <= 4) return '***';
  return value.substring(0, 4) + '***';
}

function scanString(value: string, path: string, findings: SecretFinding[]): void {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(value)) {
      findings.push({ fieldPath: path, patternName: name, matchedValue: redact(value) });
    }
  }
}

function walk(obj: unknown, path: string, findings: SecretFinding[]): void {
  if (typeof obj === 'string') {
    scanString(obj, path, findings);
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      walk(obj[i], `${path}[${i}]`, findings);
    }
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      walk(value, path ? `${path}.${key}` : key, findings);
    }
  }
}

/**
 * Scan an object tree for common secret patterns.
 * Recursively walks all string values checking against known patterns.
 */
export function scanForSecrets(obj: unknown): SecretFinding[] {
  const findings: SecretFinding[] = [];
  walk(obj, '', findings);
  return findings;
}
