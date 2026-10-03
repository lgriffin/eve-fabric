# @eve-fabric/weave

Package format v2 (`WEAVE_FORMAT`): a weave as data, its digest, and an index
to find it in. A weave is a saved question as a pipeline, what it requires, and
a digest over all of it.

- `sealWeave` normalises a weave, refuses one that carries a secret
  (`scanForSecrets`, `WeaveSecretError`), and adds its digest over
  `canonicalJson`.
- `readWeave` and `weaveFromYaml` check the shape, the digest
  (`WeaveDigestError`) and that no secret is in it; `weaveToYaml` writes the
  same bytes for the same weave wherever it runs.
- A weave states the versions it requires as ranges (`^1.2.0`, `~1.2.0`,
  `>=1.2.0`, `1.2`, `*`); `satisfies` and `highestSatisfying` read them.
- `directoryIndex(root)` and `gitIndex(url, ref)` find a weave by `id@range`;
  `publishWeave` writes one into a directory index and `buildIndex` regenerates
  its `index.json`.

```ts
import { gitIndex } from '@eve-fabric/weave';

const index = await gitIndex('https://github.com/me/weaves.git');
const weave = await index.resolve('me.forge.cheapest@^1.0.0');
```

Most people reach this through `@eve-fabric/fabric` (`fabric.weave`,
`fabric.export`, `fabric.add`) or `eve-fabric weave` on the command line.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
