# Route Calculator

A pipeline that calculates the jump distance between two solar systems.

## Capabilities Used

- `universe.resolve.solar.system` (SDE) — Resolve solar system names/IDs
- `route.distance` (ESI) — Calculate jump distance

## Inputs

| Name        | Type                 | Description              |
| ----------- | -------------------- | ------------------------ |
| origin      | eve.system.reference | Origin solar system      |
| destination | eve.system.reference | Destination solar system |

## Outputs

| Name     | Type               | Description |
| -------- | ------------------ | ----------- |
| distance | eve.route.distance | Jump count  |
