# @eve-fabric/persistence

The `Store` port over SQLite: `sqliteStore(source)`. It goes through Drizzle,
its tables come from Drizzle migrations, and it uses Node's own `node:sqlite`,
so there is no native module to build. `source` is a file, `:memory:`, or a
`DatabaseSync` already open, which is left open on close. It keeps the weaves
a fabric was given, as the documents that were added.

```ts
import { createFabric } from '@eve-fabric/fabric';
import { sqliteStore } from '@eve-fabric/persistence';

const fabric = createFabric({ esi, sde, packs: [corePack], store: sqliteStore('fabric.sqlite') });
await fabric.restore(); // adds back every weave the store kept
```

The CLI's `--db <file>` and the gateway use it.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
