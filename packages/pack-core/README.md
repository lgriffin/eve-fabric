# @eve-fabric/pack-core

The built-in capabilities, as a pack: `corePack`. It defines the `eve.*` types
(items, regions, systems, market orders, ISK, routes, characters, wallet
entries) and the capabilities over them: resolving names through the SDE,
market orders and their aggregates, blueprint materials and build cost, routes
and their safety, a character's orders and wallet journal, and the analysis
steps (profit after tax, biggest spend, undercut orders) that join them. Each
capability's `run` sits beside its contract.

```ts
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';

const fabric = createFabric({ esi, sde, packs: [corePack] });
```

A pack of your own attaches to these types, so its capabilities are offered as
moves next to the built-in ones. `eve.*` ids are reserved for this pack.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
