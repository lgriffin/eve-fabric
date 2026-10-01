#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '@eve-fabric/core';
import type { CapabilityDefinition, SemanticPort } from '@eve-fabric/core';
import { generate } from './generator.js';

const portSchema = z.object({
  name: z.string().min(1),
  semanticType: z.string().min(1),
  required: z.boolean(),
});

const capabilitySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  source: z.string().min(1),
  inputs: z.record(portSchema),
  outputs: z.record(portSchema),
  dependencies: z.array(z.object({ id: z.string().min(1), version: z.string().optional() })),
  auth: z.object({ required: z.boolean(), scopes: z.array(z.string()) }),
  cache: z.object({
    cacheable: z.boolean(),
    defaultTtlSeconds: z.number(),
    stalePermitted: z.boolean(),
    identityInKey: z.boolean(),
  }),
  cost: z.object({ estimatedLatencyMs: z.number(), esiCallCount: z.number() }),
});

const bundleSpecSchema = z.object({
  pipeline: z.record(z.unknown()),
  plan: z
    .record(z.unknown())
    .refine((p) => typeof p['createdAt'] === 'string' || p['createdAt'] instanceof Date, {
      message: 'plan.createdAt must be a date string or Date',
    }),
  capabilities: z.array(capabilitySchema).min(1),
  packageName: z.string().min(1),
  packageScope: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  graphqlSdl: z.string().optional(),
});

type BundleSpec = z.infer<typeof bundleSpecSchema>;

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

function revivePlanDates(plan: Record<string, unknown>): Record<string, unknown> {
  if (typeof plan['createdAt'] === 'string') {
    return { ...plan, createdAt: new Date(plan['createdAt']) };
  }
  return plan;
}

const USAGE = `Usage: eve-codegen <spec.json> [--out <dir>]\n\nSpec JSON must contain: pipeline, plan, capabilities, packageName\n`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (args.length === 0) {
  process.stderr.write(USAGE);
  process.exit(1);
}

const specPath = args[0]!;
let outDir = '.';
const outIdx = args.indexOf('--out');
if (outIdx !== -1 && args[outIdx + 1]) {
  outDir = args[outIdx + 1]!;
}

const rawJson = readFileSync(resolve(specPath), 'utf-8');
const parsed = bundleSpecSchema.safeParse(JSON.parse(rawJson));
if (!parsed.success) {
  process.stderr.write(`Invalid spec file:\n`);
  for (const issue of parsed.error.issues) {
    process.stderr.write(`  ${issue.path.join('.')}: ${issue.message}\n`);
  }
  process.exit(1);
}
const spec = parsed.data;

const catalog = new CapabilityCatalog();
for (const cap of spec.capabilities) {
  catalog.register(toCapabilityDefinition(cap));
}

const bundle = generate({
  pipeline: spec.pipeline as never,
  plan: revivePlanDates(spec.plan) as never,
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
