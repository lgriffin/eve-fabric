# @eve-fabric/core

The types, contracts and ports of EVE Fabric: semantic types, capability
definitions, pipelines and execution plans, provenance, the error hierarchy,
and the ports (`Clock`, `Logger`, `Store`, sources) the engine is built against. It
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

The `Logger` port carries diagnostics, never answers. `createLogger({ write,
level })` writes one line per entry to any sink; `memoryLogger()` keeps the
entries for a test to read, and `silentLogger` says nothing. Node programs use
`stderrLogger()` from `@eve-fabric/fabric`.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric); see the
repository's README for the concepts and TESTING.md to try it.
