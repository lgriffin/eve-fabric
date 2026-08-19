import { parse as parseYaml } from 'yaml';
import type { CapabilityDefinition } from '@eve-fabric/domain';
import { defineCapability, type DefineCapabilityConfig } from './define-capability.js';

interface RawManifest {
  id: string;
  version: string | number;
  name?: string;
  description?: string;
  inputs?: Record<string, { type: string; description?: string; required?: boolean }>;
  outputs?: Record<string, { type: string; description?: string }>;
  source: string;
  dependencies?: string[];
  requires?: string[];
  auth?: { required?: boolean; scopes?: string[] };
  cache?: {
    cacheable?: boolean;
    defaultTtlSeconds?: number;
    stalePermitted?: boolean;
    identityInKey?: boolean;
  };
  cost?: { estimatedLatencyMs?: number; esiCallCount?: number };
}

function toConfig(raw: RawManifest): DefineCapabilityConfig {
  if (!raw.id) throw new Error('Capability manifest missing required field: id');
  if (!raw.version) throw new Error('Capability manifest missing required field: version');
  if (!raw.source) throw new Error('Capability manifest missing required field: source');
  if (!raw.outputs || Object.keys(raw.outputs).length === 0) {
    throw new Error('Capability manifest must have at least one output');
  }

  const deps = raw.dependencies ?? raw.requires;

  const config: DefineCapabilityConfig = {
    id: raw.id,
    version: raw.version,
    name: raw.name ?? raw.id,
    description: raw.description ?? '',
    inputs: raw.inputs ?? {},
    outputs: raw.outputs,
    source: raw.source as DefineCapabilityConfig['source'],
  };

  if (deps) config.dependencies = deps;
  if (raw.auth) config.auth = raw.auth;
  if (raw.cache) config.cache = raw.cache;
  if (raw.cost) config.cost = raw.cost;

  return config;
}

export function parseCapabilityManifest(yamlContent: string): CapabilityDefinition {
  const raw = parseYaml(yamlContent) as RawManifest;
  return defineCapability(toConfig(raw));
}

export function parseCapabilityManifests(yamlContent: string): CapabilityDefinition[] {
  const docs = yamlContent
    .split(/^---$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return docs.map((doc) => parseCapabilityManifest(doc));
}
