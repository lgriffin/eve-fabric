# Trying EVE Fabric

This page takes you from an empty directory to an answered question, offline,
in well under fifteen minutes, and then names five things worth trying, what
is known not to work yet, and where to say what you found. Nothing here needs
an EVE account, ESI access or an SDE download.

## You need

- Node.js 22.12 or newer (`node --version`)
- pnpm 9 or newer (`corepack enable` gives you one if you have none)
- A terminal and about 2 GB of disk for the dependencies and the build

## From empty directory to an answer

```bash
git clone https://github.com/lgriffin/eve-fabric.git && cd eve-fabric
pnpm install
pnpm run build
pnpm fabric --offline ask examples/questions/route-distance.graphql
```

The last line prints the answer: Jita to Amarr is 4 jumps.

```text
4
```

`--offline` answers from a recorded slice of Tranquility
(`@eve-fabric/fixture`). Everything on this page works with it. Without it,
the same commands ask Tranquility's ESI, and names such as "Jita" resolve only
when `SDE_DATA_PATH` points at an SDE export.

## Five things to try

1. **See what a question can do next.** Start from an item and follow the moves
   the fabric offers; the last block it prints is the saved GraphQL form.

   ```bash
   pnpm fabric --offline moves type=Tritanium
   pnpm fabric --offline moves type=Tritanium orders "region=The Forge" cheapest location system
   ```

2. **Run the quickstart.** Nine printed steps: a fabric, a capability you
   wrote, a question, its GraphQL form, a weave, and a second fabric adding
   it. The code is [`examples/quickstart`](examples/quickstart/README.md).

   ```bash
   pnpm quickstart
   ```

3. **Build a question in the browser.** `pnpm workbench` starts the gateway
   over the fixture and the designer against it, at
   `http://localhost:5173`. Pick a subject in Explore, apply moves in Build
   (click them, or drag them onto the canvas), run it, then Save as GraphQL or
   Share as weave.

   ```bash
   pnpm workbench
   ```

4. **Share a question as a weave, and turn it into a package.** A weave is a
   versioned, code-free package another fabric can add. `codegen` makes a
   runnable package from one.

   ```bash
   pnpm fabric --offline weave export examples/questions/trade-profit.graphql \
     --id me.trade.profit --version 1.0.0 --as "my trade profit" --out trade-profit.weave.yaml
   pnpm fabric --offline --db fabric.sqlite weave add trade-profit.weave.yaml
   pnpm fabric --offline codegen trade-profit.weave.yaml --out ./trade-profit
   ```

5. **Write a capability.** Copy [`examples/quickstart/pack.ts`](examples/quickstart/pack.ts),
   change the id, inputs, outputs and `run`, and install it with `--pack`; the
   fabric offers it as a move wherever its `attach` says.

   ```bash
   pnpm fabric --offline --pack ./examples/quickstart/pack.ts moves type=Tritanium orders "region=The Forge"
   ```

## The checks

`pnpm test` runs the unit tests from source, so it works on a fresh checkout
with no build. The rest run through `tsx` over the built packages, so run
`pnpm run build` first.

```bash
pnpm test                 # unit tests, from source
pnpm run build
pnpm run test:bdd         # the BDD scenarios
pnpm run test:bank        # the question bank: prints "bank: 8 of 8"
pnpm run test:e2e         # the designer's two browser journeys over pnpm workbench
pnpm run validate         # the full gate CI runs: lint, format, typecheck, coverage, knip
```

`pnpm run test:bank --live` asks Tranquility's ESI instead of the fixture. The
questions asked as a character are skipped, and so are the ones that follow a
live id into the SDE unless `SDE_DATA_PATH` names a real export. The nightly
workflow runs it.

## What is known not to work yet

- **Nothing is on npm yet.** `npx @eve-fabric/cli` works once a `v0.1.0`
  tag is pushed; until then, run `pnpm fabric` from a checkout.
- **Live use needs an SDE export.** Without `SDE_DATA_PATH`, a live run takes
  ids only, and says so. The workbench and the quickstart use the fixture's
  names even with `--live`.
- **Asking as a character needs a real EVE SSO token** in the designer or the
  `Authorization` header; the fixture's two characters exist only offline.
- **The canvas takes only what the fabric offers.** You can drop a subject or
  a move on it, and draw a connection from the cursor step or onto a hole, but
  there is no free wiring of ports and no hand-set inputs: a connection opens
  the moves or choices the fabric lists, and nothing else.
- **One fabric, one gateway.** Added weaves are kept in the SQLite file
  `FABRIC_DB` names; there is no shared registry across gateways.

## Where to say what you found

Open an issue at <https://github.com/lgriffin/eve-fabric/issues> with the
command you ran, what it printed, and `node --version`. A question the fabric
should have offered a move for, and did not, is as useful as a crash.

## Further reading

- [The `eve-fabric` command line](docs/cli.md), generated from the CLI's help
- [The gateway's HTTP API](docs/gateway-api.md)
- [CHANGELOG](CHANGELOG.md)
- [README](README.md), for the architecture and the key concepts
