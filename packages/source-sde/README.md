# @eve-fabric/source-sde

The fabric's SDE source: the `StaticSource` port over ESI.ts's static data
provider. A configured export that will not load is an error, never an empty
provider (FAB-SRC-01): `loadSdeDirectory(path)` throws `SdeLoadError`, which
API clients see as `GATEWAY_SOURCE_UNAVAILABLE`. `lazySdeDirectory(path)` loads
on first use, so a fabric starts quickly and a bad path fails the first step
that reaches the SDE, and every one after it. `memoryStaticSource(data)` is an
in-memory SDE for tests.

```ts
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { lazySdeDirectory } from '@eve-fabric/source-sde';

const fabric = createFabric({
  esi,
  sde: lazySdeDirectory(process.env.SDE_DATA_PATH!),
  packs: [corePack],
});
```

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
