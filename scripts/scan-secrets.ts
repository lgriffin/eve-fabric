/**
 * Secret scanning for what this repository shares: the weaves in the git
 * index and the examples. JSON files and weave files (`weave.yaml`,
 * `*.weave.yaml`) are scanned field by field (FAB-SEC-01). Runs as the pre-commit hook and in CI.
 *
 * Usage:
 *   tsx scripts/scan-secrets.ts [directory...]
 *
 * Defaults to examples/, weaves/ and bank/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { scanForSecrets, type SecretFinding } from '@eve-fabric/weave';
import { log, print } from './lib/terminal.js';

const DEFAULT_SCAN_DIRS = ['examples', 'weaves', 'bank'];

interface FileFinding {
  readonly filePath: string;
  readonly findings: SecretFinding[];
}

function isWeaveFile(name: string): boolean {
  return name === 'weave.yaml' || name.endsWith('.weave.yaml');
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      results.push(...collectFiles(fullPath));
    } else if (
      entry.isFile() &&
      (isWeaveFile(entry.name) ||
        (entry.name.endsWith('.json') &&
          entry.name !== 'package.json' &&
          entry.name !== 'tsconfig.json'))
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function scanFile(filePath: string): FileFinding | null {
  const content = fs.readFileSync(filePath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = isWeaveFile(path.basename(filePath)) ? parseYaml(content) : JSON.parse(content);
  } catch {
    // A file that does not parse cannot be shown to be clean, so it fails.
    return {
      filePath,
      findings: [{ fieldPath: '(file)', patternName: 'does not parse', matchedValue: '-' }],
    };
  }

  const findings = scanForSecrets(parsed);
  if (findings.length > 0) {
    return { filePath, findings };
  }

  return null;
}

function main(): void {
  const args = process.argv.slice(2);
  const rootDir = process.cwd();

  const dirsToScan =
    args.length > 0
      ? args.map((d) => path.resolve(rootDir, d))
      : DEFAULT_SCAN_DIRS.map((d) => path.resolve(rootDir, d));

  const jsonFiles: string[] = [];
  for (const dir of dirsToScan) {
    jsonFiles.push(...collectFiles(dir));
  }

  if (jsonFiles.length === 0) {
    print('No files found to scan.');
    process.exit(0);
  }

  print(`Scanning ${jsonFiles.length} file(s) for secrets...`);

  const allFindings: FileFinding[] = [];

  for (const file of jsonFiles) {
    const result = scanFile(file);
    if (result) {
      allFindings.push(result);
    }
  }

  if (allFindings.length === 0) {
    print('No secrets detected. All clean.');
    process.exit(0);
  }

  for (const { filePath, findings } of allFindings) {
    const file = path.relative(rootDir, filePath);
    for (const finding of findings) {
      log.error('potential secret', {
        file,
        field: finding.fieldPath,
        pattern: finding.patternName,
        value: finding.matchedValue,
      });
    }
  }

  const totalFindings = allFindings.reduce((sum, f) => sum + f.findings.length, 0);
  log.error(
    `SECRET SCAN FAILED: ${totalFindings} potential secret(s) in ${allFindings.length} file(s)`,
  );
  process.exit(1);
}

main();
