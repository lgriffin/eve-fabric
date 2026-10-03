# Saved questions

A question's saved form is GraphQL against the schema the fabric derives from
what is installed (`pnpm fabric schema`). Each file here is one complete
question; the CLI runs it, the designer opens it, and `pnpm fabric weave export`
shares it as a weave.

| File                      | Asks                                                                           | Offline answer |
| ------------------------- | ------------------------------------------------------------------------------ | -------------- |
| `market-snapshot.graphql` | The lowest sell price for Tritanium in The Forge                               | `3.98`         |
| `route-distance.graphql`  | How many jumps from Jita to Amarr                                              | `4`            |
| `trade-profit.graphql`    | Profit per unit buying Tritanium in The Forge and selling in Domain, after tax | `0.25`         |

```bash
pnpm fabric ask examples/questions/market-snapshot.graphql --offline
pnpm fabric ask examples/questions/route-distance.graphql --offline
pnpm fabric ask examples/questions/trade-profit.graphql --offline
```

`--offline` answers from the Tranquility fixture; without it the fabric asks
live ESI and reads names from the SDE export at `SDE_DATA_PATH`.
`questions.test.ts` asks each one over the fixture and checks the answers
above; `pnpm run demo:esi` asks them of Tranquility every night.

To write one of your own, start from a subject and follow the moves the
fabric offers; `moves` ends with the saved form:

```bash
pnpm fabric moves type=Tritanium orders "region=The Forge" prices --offline
```
