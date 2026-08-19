# Market Snapshot

A simple pipeline that looks up current market prices for an item in a region.

## Capabilities Used

- `universe.resolve.type` (SDE) — Resolve item type
- `market.orders` (ESI) — Fetch market orders
- `market.aggregate` (DERIVED) — Compute lowest sell / highest buy

## Inputs

| Name   | Type                  | Description       |
|--------|-----------------------|-------------------|
| item   | eve.type.reference    | Item type to look up |
| region | eve.region.reference  | Market region     |

## Outputs

| Name       | Type             | Description        |
|------------|------------------|--------------------|
| lowestSell | eve.currency.isk | Lowest sell price  |
| highestBuy | eve.currency.isk | Highest buy price  |
