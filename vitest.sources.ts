/**
 * `@eve-fabric/<package>` resolved to that package's source, so `pnpm test`
 * runs on a fresh checkout with no build. Node resolves the workspace packages
 * through their `exports`, which name `dist`; everything that runs through
 * tsx (the bank, the BDD suite, the examples) still needs `pnpm run build`.
 */
import { fileURLToPath } from 'node:url';

const PACKAGES = fileURLToPath(new URL('./packages/', import.meta.url));

export const fabricSources = [
  { find: /^@eve-fabric\/([a-z-]+)$/, replacement: `${PACKAGES}$1/src/index.ts` },
];
