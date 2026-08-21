import type { ExecutionPlan } from '@eve-fabric/domain';

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
    '@eve-fabric/domain': '*',
    '@eve-fabric/executor': '*',
    '@eve-fabric/capability-sdk': '*',
  };

  if (sources.has('ESI')) dependencies['@eve-fabric/esi-adapter'] = '*';
  if (sources.has('SDE')) dependencies['@eve-fabric/sde-adapter'] = '*';
  if (sources.has('DERIVED')) dependencies['@eve-fabric/executor'] = '*';

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
