# @eve-fabric/cli

`eve-fabric` on the command line: ask saved questions about New Eden, explore
the moves a fabric offers, move weaves in and out of a fabric, and generate a
runnable package from a weave. `--offline` answers from a recorded slice of
Tranquility and needs no network.

```bash
npx @eve-fabric/cli --offline moves type=Tritanium orders "region=The Forge" cheapest
npx @eve-fabric/cli --offline ask question.graphql
npx @eve-fabric/cli --offline weave export question.graphql --id me.forge.cheapest --version 1.0.0 --out cheapest.weave.yaml
npx @eve-fabric/cli --offline --db fabric.sqlite weave add cheapest.weave.yaml
npx @eve-fabric/cli --offline codegen cheapest.weave.yaml --out ./cheapest
```

Without `--offline` the fabric asks Tranquility's ESI, and names resolve from
the SDE export at `SDE_DATA_PATH`. `--pack <module>` installs a pack you wrote
with `@eve-fabric/kit`: a `.js` module on any supported Node, or a `.ts` one
where Node strips types (22.18 and later, or 22.13 with
`NODE_OPTIONS=--experimental-strip-types`). `--db <file>` (or `FABRIC_DB`)
keeps added weaves across runs. Bad usage exits 2 with the help text; a
failure exits 1 with an `error:` line saying why, sometimes followed by a
hint.

The full reference is
[docs/cli.md](https://github.com/lgriffin/eve-fabric/blob/master/docs/cli.md)
in the repository, generated from this help.
