import { createRequire } from 'node:module';
import type { ResolvedWeave } from './generator.js';

/** The version this package was built as: the published packages share one version line. */
const { version: PUBLISHED_VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

/** ESI.ts, as the kit and the fabric pin it. */
const ESI_TS_VERSION = '11.1.1';

/**
 * The generated package depends on the published packages: the fabric and
 * the core pack always, the sources the weave's steps run against as well.
 */
export function emitPackageJson(weave: ResolvedWeave, packageName: string): string {
  const dependencies: Record<string, string> = {
    '@eve-fabric/fabric': `^${PUBLISHED_VERSION}`,
    '@eve-fabric/pack-core': `^${PUBLISHED_VERSION}`,
  };
  if (weave.sources.has('ESI')) dependencies['@lgriffin/esi.ts'] = ESI_TS_VERSION;
  if (weave.sources.has('SDE')) dependencies['@eve-fabric/source-sde'] = `^${PUBLISHED_VERSION}`;
  const pkg = {
    name: packageName,
    version: weave.file.version,
    description: weave.file.description,
    type: 'module',
    main: './index.ts',
    dependencies,
    'eve-fabric': {
      weave: `${weave.file.id}@${weave.file.version}`,
      digest: weave.file.digest,
      generator: `@eve-fabric/codegen@${PUBLISHED_VERSION}`,
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}
