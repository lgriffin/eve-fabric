# @eve-fabric/fixture

The Tranquility fixture: a small, hand-built slice of New Eden for tests,
examples and the CLI's `--offline`. Ids, names and security values match
Tranquility; prices, volumes and the route are representative, not a
recording. ESI is served by ESI.ts's own mock transport, so every request runs
through the real ESI.ts pipeline and only the network is replaced.

- `tranquilityEsi()` gives ESI.ts's runtime over the mock transport
  (`{ esi, transport }`); `tranquilityTransport()` is the transport alone.
- `tranquilitySde()` gives the in-memory SDE; `tranquilitySdeData()` its data.
- `tranquilityCharacter(id, scopes)` gives a character to ask as.
- `TYPE`, `REGION`, `SYSTEM`, `STATION` and `CHARACTER` name the ids in it;
  `ORDERS`, `JOURNALS`, `CHARACTER_ORDERS`, `INCURSIONS` and `JITA_TO_AMARR`
  are what ESI answers.

```ts
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';

const fabric = createFabric({
  esi: tranquilityEsi().esi,
  sde: tranquilitySde(),
  packs: [corePack],
});
```

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
