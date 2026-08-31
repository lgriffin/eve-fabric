#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '@eve-fabric/domain';
import type { CapabilityDefinition, SemanticPort } from '@eve-fabric/domain';
import { generate } from './generator.js';

interface BundleSpec {
  pipeline: Record<string, unknown>;
  plan: Record<string, unknown>;
  capabilities: Array<{
    id: string;
    version: string;
    name: string;
    description: string;
    source: string;
    inputs: Record<string, { name: string; semanticType: string; required: boolean }>;
    outputs: Record<string, { name: string; semanticType: string; required: boolean }>;
    dependencies: Array<{ id: string; version?: string }>;
    auth: { required: boolean; scopes: string[] };
    cache: {
      cacheable: boolean;
      defaultTtlSeconds: number;
      stalePermitted: boolean;
      identityInKey: boolean;
    };
    cost: { estimatedLatencyMs: number; esiCallCount: number };
  }>;
  packageName: string;
  packageScope?: string;
  version?: string;
  description?: string;
  graphqlSdl?: string;
}

function toCapabilityDefinition(raw: BundleSpec['capabilities'][number]): CapabilityDefinition {
  const inputs = new Map<string, SemanticPort>();
  for (const [key, val] of Object.entries(raw.inputs)) {
    inputs.set(key, {
      name: val.name,
      semanticType: semanticTypeId(val.semanticType),
      required: val.required,
    });
  }
  const outputs = new Map<string, SemanticPort>();
  for (const [key, val] of Object.entries(raw.outputs)) {
    outputs.set(key, {
      name: val.name,
      semanticType: semanticTypeId(val.semanticType),
      required: val.required,
    });
  }
  return {
    id: capabilityId(raw.id),
    version: capabilityVersion(raw.version),
    name: raw.name,
    description: raw.description,
    source: raw.source as CapabilityDefinition['source'],
    inputs,
    outputs,
    dependencies: raw.dependencies.map((d) => ({
      id: capabilityId(d.id),
      ...(d.version !== undefined ? { version: capabilityVersion(d.version) } : {}),
    })),
    auth: raw.auth,
    cache: raw.cache,
    cost: raw.cost,
  };
}

function usage(): never {
  process.stderr.write(
    `Usage: eve-codegen <spec.json> [--out <dir>]\n\nSpec JSON must contain: pipeline, plan, capabilities, packageName\n`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
}

const specPath = args[0]!;
let outDir = '.';
const outIdx = args.indexOf('--out');
if (outIdx !== -1 && args[outIdx + 1]) {
  outDir = args[outIdx + 1]!;
}

const raw = readFileSync(resolve(specPath), 'utf-8');
const spec = JSON.parse(raw) as BundleSpec;

const catalog = new CapabilityCatalog();
for (const cap of spec.capabilities) {
  catalog.register(toCapabilityDefinition(cap));
}

const bundle = generate({
  pipeline: spec.pipeline as never,
  plan: spec.plan as never,
  catalog,
  packageName: spec.packageName,
  packageScope: spec.packageScope,
  version: spec.version,
  description: spec.description,
  graphqlSdl: spec.graphqlSdl,
});

const resolved = resolve(outDir);
mkdirSync(resolved, { recursive: true });

for (const file of bundle.files) {
  const filePath = join(resolved, file.path);
  writeFileSync(filePath, file.content, 'utf-8');
  process.stdout.write(`  ${file.path}\n`);
}

process.stdout.write(`\nGenerated ${String(bundle.files.length)} files in ${resolved}\n`);
