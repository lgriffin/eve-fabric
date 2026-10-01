import type { ExecutionPlan, PipelineDefinition, CapabilityDefinition } from '@eve-fabric/core';
import { CapabilityCatalog } from '@eve-fabric/core';
import { emitIndexTs } from './emit-index-ts.js';
import { emitPackageJson } from './emit-package-json.js';
import { emitPipelineYaml } from './emit-pipeline-yaml.js';

export interface CodegenOptions {
  readonly pipeline: PipelineDefinition;
  readonly plan: ExecutionPlan;
  readonly catalog: CapabilityCatalog;
  readonly packageName: string;
  readonly packageScope?: string | undefined;
  readonly version?: string | undefined;
  readonly description?: string | undefined;
  readonly graphqlSdl?: string | undefined;
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export interface GeneratedBundle {
  readonly files: readonly GeneratedFile[];
}

function collectCapabilities(
  plan: ExecutionPlan,
  catalog: CapabilityCatalog,
): CapabilityDefinition[] {
  const seen = new Set<string>();
  const result: CapabilityDefinition[] = [];

  for (const step of plan.steps) {
    const key = `${step.capability.id as string}@${(step.capability.version as string) ?? 'latest'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const def = catalog.get(step.capability.id, step.capability.version);
    result.push(def);
  }

  return result;
}

export function generate(options: CodegenOptions): GeneratedBundle {
  const {
    pipeline,
    plan,
    catalog,
    packageName,
    packageScope,
    version = '1.0.0',
    description = pipeline.description ?? pipeline.name,
    graphqlSdl,
  } = options;

  const capabilities = collectCapabilities(plan, catalog);

  const files: GeneratedFile[] = [
    {
      path: 'pipeline.yaml',
      content: emitPipelineYaml(pipeline),
    },
    {
      path: 'index.ts',
      content: emitIndexTs(pipeline, plan, capabilities, graphqlSdl),
    },
    {
      path: 'package.json',
      content: emitPackageJson({ packageName, packageScope, version, description }, plan),
    },
  ];

  if (graphqlSdl) {
    files.push({
      path: 'schema.graphql',
      content: graphqlSdl,
    });
  }

  return { files };
}
