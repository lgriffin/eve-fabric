import type { Fabric } from '@eve-fabric/fabric';
import { readWeave, weaveToYaml, type WeaveFile } from '@eve-fabric/weave';
import { emitIndexTs } from './emit-index-ts.js';
import { emitPackageJson } from './emit-package-json.js';

export interface GenerateOptions {
  /** The generated package's name; the weave's id with hyphens by default. */
  readonly packageName?: string | undefined;
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export interface GeneratedBundle {
  readonly files: readonly GeneratedFile[];
}

/** What the emitters read off a weave once the fabric has resolved it. */
export interface ResolvedWeave {
  readonly file: WeaveFile;
  readonly yaml: string;
  /** The sources the weave's steps run against, as the compiler planned them. */
  readonly sources: ReadonlySet<string>;
}

/**
 * A weave in, a runnable package out. The fabric checks the weave as `add`
 * would: its digest, that its id is not reserved, that every capability it
 * requires is here in a version it accepts, that it compiles, and that what
 * it declares is what it compiles to. The module emitted carries the weave
 * and no capability code; at run time it builds a fabric, adds the weave,
 * and asks.
 */
export function generate(
  weave: WeaveFile,
  fabric: Fabric,
  options: GenerateOptions = {},
): GeneratedBundle {
  const file = readWeave(weave);
  const { plan } = fabric.check(file);
  const resolved: ResolvedWeave = {
    file,
    yaml: weaveToYaml(file),
    sources: new Set(plan.sourceRequirements.map((r) => r.source)),
  };
  const packageName = options.packageName ?? file.id.replaceAll('.', '-');
  return {
    files: [
      { path: `${file.id}.weave.yaml`, content: resolved.yaml },
      { path: 'index.ts', content: emitIndexTs(resolved, fabric.types) },
      { path: 'package.json', content: emitPackageJson(resolved, packageName) },
    ],
  };
}
