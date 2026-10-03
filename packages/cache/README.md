# @eve-fabric/cache

The cache port of EVE Fabric, in memory: `MemoryCache`. It keeps each entry
for its TTL in seconds and reads time through the `Clock` port, so a test can
move time with a fixed clock. The executor caches SDE and derived steps in it;
ESI steps use ESI.ts's own cache instead.

You rarely import this directly; `createFabric` wires a `MemoryCache` unless
you pass `cache` (another `CachePort`, or `false` for none).

```ts
import { MemoryCache } from '@eve-fabric/cache';

const cache = new MemoryCache({ clock });
```

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
