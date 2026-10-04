# @eve-fabric/fabric

The composition root as a library: sources and packs in, a fabric out. A
fabric starts a **draft** from a subject, offers the **moves** that keep it
compilable, names the **holes** still to fill, plans it, runs it, saves it as
GraphQL, and shares it as a **weave** another fabric adds.

```ts
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture'; // offline; createEsi for live

const fabric = createFabric({
  esi: tranquilityEsi().esi,
  sde: tranquilitySde(),
  packs: [corePack],
});

let draft = fabric.draft({ type: 'Tritanium' });
draft.moves(); // orders, blueprint, …
draft = draft.apply('orders').fill('region', 'The Forge').apply('cheapest');
draft.plan(); // steps, ESI calls, scopes, before anything runs
const { answer } = await fabric.query(draft);

const saved = draft.toGraphQL(); // and back: fabric.fromGraphQL(saved)
const weave = fabric.export(fabric.weave(draft, { id: 'me.forge.cheapest', version: '1.0.0' }));
await otherFabric.add(weave);
```

Live use takes an ESI.ts client (`createEsi` from `@lgriffin/esi.ts/client`)
and an SDE source (`@eve-fabric/source-sde`); a `Store` from
`@eve-fabric/persistence` keeps added weaves across restarts.

A program built on the fabric writes answers with `printLine` (stdout) and
diagnostics with `stderrLogger()` (stderr, at the level `EVE_FABRIC_LOG` names:
debug, info, warn, error or silent; info by default).

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric); the repository's
README explains drafts, lists and joins, identities and weaves.
