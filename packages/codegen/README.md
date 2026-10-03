# @eve-fabric/codegen

A weave in, a runnable package out. `generate(weave, fabric)` checks the weave
as `fabric.add` would (its digest, that its id is not reserved, that every capability it requires is
here in a version it accepts, and that it compiles to what it declares), then
returns the files of a package: the weave as YAML, an `index.ts` that builds a
fabric, adds the weave and asks its question, and a `package.json` on the
published packages. The package carries the weave and no capability code.

```ts
import { generate } from '@eve-fabric/codegen';

const { files } = generate(weave, fabric, { packageName: 'forge-cheapest' });
```

From the command line, `eve-fabric codegen <weave> --out <dir>` writes the
package (`--name` sets its name; the weave's id with hyphens by default).

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
