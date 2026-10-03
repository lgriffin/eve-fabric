# The gateway, end to end

The gateway is the workbench: the designer and any HTTP client build questions
through it, save them as GraphQL and share them as weaves. A saved question or
a pack runs without it.

```bash
pnpm install && pnpm run build
pnpm demo              # offline, over the Tranquility fixture
pnpm demo -- --live    # Tranquility's ESI
```

`pnpm demo` starts a gateway on a free port, makes the calls below and stops
it. For the same calls by hand, start a gateway first. With no `SDE_DATA_PATH`
it has an empty SDE, so names such as "Tritanium" only resolve when it points
at an SDE export:

```bash
SDE_DATA_PATH=/path/to/sde pnpm --filter @eve-fabric/gateway run dev   # port 3456
```

## 1. What a question can start from

```bash
curl -s localhost:3456/api/drafts/subjects
```

## 2. Start a draft

A draft is a subject and the changes made to it. The gateway keeps nothing, so
the client sends the whole draft each time, and undo means dropping the last
change.

```bash
curl -s localhost:3456/api/drafts -H 'content-type: application/json' -d '{
  "subject": { "kind": "type", "value": "Tritanium" },
  "steps": [{ "kind": "move", "move": "orders" }]
}'
```

The reply lists the `moves` on offer and the `holes` to fill (here `region`).

## 3. A hole's choices

```bash
curl -s localhost:3456/api/drafts/choices -H 'content-type: application/json' -d '{
  "subject": { "kind": "type", "value": "Tritanium" },
  "steps": [{ "kind": "move", "move": "orders" }],
  "hole": "region", "text": "Forge"
}'
```

## 4. Run it

```bash
curl -s localhost:3456/api/drafts/run -H 'content-type: application/json' -d '{
  "subject": { "kind": "type", "value": "Tritanium" },
  "steps": [
    { "kind": "move", "move": "orders" },
    { "kind": "fill", "hole": "region", "value": "The Forge" },
    { "kind": "move", "move": "prices" }
  ]
}'
```

The reply has the `answer`, and in `view.graphql` the question's saved form.

## 5. Run the saved form

```bash
curl -s localhost:3456/api/drafts/run -H 'content-type: application/json' -d '{
  "graphql": "{ type(name: \"Tritanium\") { orders(region: \"The Forge\") { prices { lowestSell } } } }"
}'
```

## 6. Share it as a weave and add it

```bash
curl -s localhost:3456/api/drafts/weave -H 'content-type: application/json' -d '{
  "graphql": "{ type(name: \"Tritanium\") { orders(region: \"The Forge\") { prices { lowestSell } } } }",
  "weave": { "id": "demo.forge.prices", "version": "1.0.0", "as": "forge prices" }
}' > forge-prices.weave.yaml

jq -Rs '{document: .}' forge-prices.weave.yaml |
  curl -s localhost:3456/api/weaves -H 'content-type: application/json' -d @-
curl -s localhost:3456/api/weaves
```

`forge prices` is now a move on any item. `GET /api/weaves/demo.forge.prices`
exports it again, and `DELETE /api/weaves/demo.forge.prices?version=1.0.0`
removes it. Set `FABRIC_DB` to keep added weaves across restarts.

## 7. Mistakes

A move the draft does not offer, a hole that does not exist, or a document that
is not a question is refused with `422`. The error's `code` names what went
wrong and its `message` says what is offered instead.
