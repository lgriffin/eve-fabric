import type { ExecutionPlan } from '@eve-fabric/core';

export interface PackageJsonOptions {
  readonly packageName: string;
  readonly packageScope?: string | undefined;
  readonly version: string;
  readonly description: string;
}

export function emitPackageJson(options: PackageJsonOptions, plan: ExecutionPlan): string {
  const fullName = options.packageScope
    ? `${options.packageScope}/${options.packageName}`
    : options.packageName;

  const sources = new Set(plan.sourceRequirements.map((r) => r.source));

  const dependencies: Record<string, string> = {
    '@eve-fabric/core': '*',
    '@eve-fabric/executor': '*',
    '@eve-fabric/fabric': '*',
    '@eve-fabric/pack-core': '*',
  };

  if (sources.has('ESI')) dependencies['@lgriffin/esi.ts'] = '11.1.1';
  if (sources.has('SDE')) dependencies['@eve-fabric/source-sde'] = '*';

  const pkg = {
    name: fullName,
    version: options.version,
    description: options.description,
    type: 'module',
    main: './index.ts',
    scripts: {
      generate: 'echo "Load pipeline.yaml into eve-fabric designer to regenerate"',
    },
    dependencies,
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}
