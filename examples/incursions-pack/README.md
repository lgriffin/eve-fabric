# Incursions pack

A pack written the way a third party would write one. It depends only on `@eve-fabric/kit`, defines its types under its own `incursions.*` namespace (`eve.*` is reserved for the core pack), and reaches ESI through `uses: ['esi.public']`.

```ts
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { incursionsPack } from './pack.js';

const fabric = createFabric({ esi, sde, packs: [corePack, incursionsPack] });
const draft = fabric.draft('incursions').apply('systems').apply('high-sec only');
const { answer } = await fabric.query(draft); // the high-sec systems under incursion
```

`systems` is this pack's own move. `high-sec only` comes from the core pack, and the draft offers it on the infested systems by resolving each one through the SDE.

## Run it

Offline, through the CLI, with a saved question that starts from the pack's
own subject:

```bash
printf '{ incursions { systems { highSecOnly { _value } } } }' > incursions.graphql
pnpm fabric --offline --pack ./examples/incursions-pack/pack.ts ask incursions.graphql
```

The question bank asks the same thing as Q5 (`pnpm run test:bank`).
