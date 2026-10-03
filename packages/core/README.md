# @eve-fabric/core

The types, contracts and ports of EVE Fabric: semantic types, capability
definitions, pipelines and execution plans, provenance, the error hierarchy,
and the ports (`Clock`, `Store`, sources) the engine is built against. It
imports `zod` and nothing else, so a pack or a tool can depend on it alone.

Most people do not import this directly: a pack is written with
[`@eve-fabric/kit`](https://www.npmjs.com/package/@eve-fabric/kit), and a
fabric is built with
[`@eve-fabric/fabric`](https://www.npmjs.com/package/@eve-fabric/fabric). Reach
for `core` when you implement a port (a store, a clock, a static source) or
type a value the fabric hands you.

```ts
import { fixedClock, memoryStore, type Store } from '@eve-fabric/core';
```

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric); see the
repository's README for the concepts and TESTING.md to try it.
