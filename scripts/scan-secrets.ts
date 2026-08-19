/**
 * Secret-scanning check for schema package exports.
 * Can be used as a pre-commit hook or CI check.
 *
 * Usage:
 *   tsx scripts/scan-secrets.ts [directory...]
 *
 * Defaults to scanning examples/ and any exported schema packages
 * under packages that contain JSON files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanForSecrets, type SecretFinding } from '@eve-fabric/schema-package';

const DEFAULT_SCAN_DIRS = ['examples', 'packages/schema-package'];

interface FileFinding {
  readonly filePath: string;
  readonly findings: SecretFinding[];
}

function collectJsonFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      results.push(...collectJsonFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.json') &&
      entry.name !== 'package.json' &&
      entry.name !== 'tsconfig.json'
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
    parsed = JSON.parse(content);
  } catch {
    // Skip files that are not valid JSON
    return null;
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
    jsonFiles.push(...collectJsonFiles(dir));
  }

  if (jsonFiles.length === 0) {
    console.log('No JSON files found to scan.');
    process.exit(0);
  }

  console.log(`Scanning ${jsonFiles.length} JSON file(s) for secrets...\n`);

  const allFindings: FileFinding[] = [];

  for (const file of jsonFiles) {
    const result = scanFile(file);
    if (result) {
      allFindings.push(result);
    }
  }

  if (allFindings.length === 0) {
    console.log('No secrets detected. All clean.');
    process.exit(0);
  }

  console.error('SECRET SCAN FAILED: Potential secrets detected!\n');

  for (const { filePath, findings } of allFindings) {
    const relativePath = path.relative(rootDir, filePath);
    console.error(`  File: ${relativePath}`);
    for (const finding of findings) {
      console.error(`    - Field: ${finding.fieldPath}`);
      console.error(`      Pattern: ${finding.patternName}`);
      console.error(`      Value: ${finding.matchedValue}`);
    }
    console.error('');
  }

  const totalFindings = allFindings.reduce((sum, f) => sum + f.findings.length, 0);
  console.error(`Found ${totalFindings} potential secret(s) in ${allFindings.length} file(s).`);
  process.exit(1);
}

main();
