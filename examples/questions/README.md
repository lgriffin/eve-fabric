# Saved questions

A question's saved form is GraphQL against the schema the fabric derives from
what is installed (`pnpm fabric schema`). Each file here is one complete
question; the CLI runs it, the designer opens it, and `pnpm fabric weave export`
shares it as a weave.

| File                      | Asks                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ |
| `market-snapshot.graphql` | The lowest sell price for Tritanium in The Forge                               |
| `route-distance.graphql`  | How many jumps from Jita to Amarr                                              |
| `trade-profit.graphql`    | Profit per unit buying Tritanium in The Forge and selling in Domain, after tax |

```bash
pnpm fabric ask examples/questions/market-snapshot.graphql --offline
pnpm fabric ask examples/questions/route-distance.graphql --offline
pnpm fabric ask examples/questions/trade-profit.graphql --offline
```

`--offline` answers from the Tranquility fixture; without it the fabric asks
live ESI and reads names from the SDE export at `SDE_DATA_PATH`.

To write one of your own, start from a subject and follow the moves the
fabric offers; the last line of `moves` is the saved form:

```bash
pnpm fabric moves type=Tritanium orders "region=The Forge" prices --offline
```
