# The gateway's HTTP API

The gateway (`apps/gateway`, port 3456 by default) is the workbench the
designer and HTTP clients build questions through. It holds no drafts: a client
sends what a draft started from and the changes made to it, and the fabric
replays them. `pnpm workbench --no-designer` starts one over the offline
fixture; `pnpm --filter @eve-fabric/gateway run dev` starts one over live ESI.

A test (`apps/gateway/tests/routes/documented.test.ts`) checks that every
route under `/api/drafts` and `/api/weaves` has a heading on this page, and that
every heading here names a route the server has.

## Requests and responses

Bodies are JSON unless a route says otherwise. A request made as a character
carries an EVE SSO token in `Authorization: Bearer <token>`; the gateway checks
its signature against EVE SSO's published keys, along with its issuer, audience
and expiry, and refuses a token that fails any check with a 401.

A **draft request** is one of:

```json
{
  "graphql": "{ type(name: \"Tritanium\") { orders(region: \"The Forge\") { cheapest { location { system { name security_status } } } } } }"
}
```

```json
{
  "subject": { "kind": "type", "value": "Tritanium" },
  "steps": [
    { "kind": "move", "move": "orders" },
    { "kind": "fill", "hole": "region", "value": "The Forge" }
  ]
}
```

A subject is `{ kind, value }` (a name or a positive integer id) or
`{ start }`, a capability that needs nothing. Names are at most 200 characters,
a document at most 20,000, and a request replays at most 200 steps.

A **draft view** is what every draft route answers with: the subject, the
changes so far, the cursor's type, the moves offered (an unavailable one names
the scopes it needs), the holes still open with their types, the plan when the
draft is complete, and the saved GraphQL form.

## Errors

Every refusal is `{ "error": { "code", "message" } }`; the gateway's own
handler adds `"details"`.

| Status | Code                                              | When                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400    | `BAD_REQUEST`                                     | The body is not a draft or weave request; the message names each field that is wrong.                                                                                                                                                                                                                                                                                                                        |
| 400    | a compiler error code                             | A saved question that does not compile against the schema.                                                                                                                                                                                                                                                                                                                                                   |
| 401    | `InvalidTokenError`                               | The bearer token failed a check.                                                                                                                                                                                                                                                                                                                                                                             |
| 403    | `GATEWAY_AUTH_MISSING_SCOPE`                      | The question needs a scope the token lacks.                                                                                                                                                                                                                                                                                                                                                                  |
| 404    | `NOT_FOUND`                                       | No weave with that id (and version).                                                                                                                                                                                                                                                                                                                                                                         |
| 422    | the fabric's refusal, by name                     | The draft was refused: `MoveNotOfferedError`, `MoveUnavailableError`, `FillRejectedError`, `UnknownSubjectError`, `DraftIncompleteError`, `GraphQLDraftError`, `ScopeMissingError`, `CharacterMismatchError`; or the weave was: `WeaveFormatError`, `WeaveDigestError`, `WeaveSecretError`, `WeaveRequirementError`, `WeaveMismatchError`, `WeaveRefusedError`, `PublishRefusedError`, `InvalidAttachError`. |
| 422    | `NOT_FOUND`                                       | A step ran and a name named nothing in the SDE; the message says what was probably meant.                                                                                                                                                                                                                                                                                                                    |
| 422    | `NO_SUCH_HOLE`                                    | `/api/drafts/choices` was asked about a hole the draft does not have.                                                                                                                                                                                                                                                                                                                                        |
| 502    | `SOURCE_FAILED`                                   | A step's source answered with an HTTP error; the message carries the status and URL.                                                                                                                                                                                                                                                                                                                         |
| 502    | `GATEWAY_SOURCE_UNAVAILABLE`, other runtime codes | A typed runtime error from the gateway's own handler, such as a configured SDE export that will not load.                                                                                                                                                                                                                                                                                                    |
| 503    | `GATEWAY_SOURCE_RATE_LIMITED`                     | ESI rate-limited the request; `Retry-After` says when to try again.                                                                                                                                                                                                                                                                                                                                          |
| 500    | `INTERNAL_ERROR`                                  | Anything else, masked as `Internal server error` and logged.                                                                                                                                                                                                                                                                                                                                                 |

## Health

### `GET /health`

`{ "status": "ok" }`.

## Drafts

### `GET /api/drafts/subjects`

What a draft can start from: `kinds`, each `{ kind, type }` (such as `type`,
`region`, `system`, `character`), and `starts`, capabilities that need no
input, each `{ name, description }`.

### `POST /api/drafts`

A draft request in; its draft view out. This is how a client applies a move or
fills a hole: it sends the draft with the change appended. Undo is dropping the
last change.

### `POST /api/drafts/choices`

A draft request plus `hole` (its name) and an optional `text` (at most 200
characters) in; `{ "choices": [ { name, value, … } ] }` out, from the hole
type's `choices` capability (SDE search, for types, regions and systems).

### `POST /api/drafts/run`

A complete draft request in; `{ "answer", "view" }` out, the answer being the
value at the draft's cursor. Runs as the character the bearer token names.

### `GET /api/drafts/schema`

The GraphQL schema questions are written against, as `text/plain` SDL: the one
`eve-fabric schema` prints, derived from what the fabric has installed.

### `POST /api/drafts/weave`

A draft request plus `weave: { id, version, as?, name?, description? }` in; the
draft shared as a weave, `application/yaml` out. `id` is two or more
lowercase, dot-separated parts (`me.forge.prices`), `version` is `x.y.z`, and
`as` is the move name other fabrics see.

## Weaves

### `GET /api/weaves`

`{ "weaves": [ { id, version, digest, … } ] }`: what this fabric has added,
restored from the store named by `FABRIC_DB` when there is one.

### `POST /api/weaves`

`{ "document": "<weave yaml>" }` or `{ "ref": "id@range" }` (resolved from the
fabric's weave index) in; `201 { id, version }` out. The weave is checked as
`eve-fabric weave add` checks it: digest, no secrets, every requirement present
in a version it accepts, compiles, declared ports match.

### `GET /api/weaves/:id`

The weave as `application/yaml`; `?version=x.y.z` picks one, the latest
otherwise. 404 when there is none.

### `DELETE /api/weaves/:id`

`?version=x.y.z` is required. 204 when removed.

## GraphQL

### `POST /graphql`

`{ "query": "<a saved question>" }` runs the question through the fabric, as
`eve-fabric ask` does, and answers in the shape the document asked for
(`{ "data": … }`). Variables are refused: a saved question names its subject
and fills its holes in the document. Errors come back as GraphQL errors with
`extensions.code` (`UNAUTHORIZED` for a bad token). Introspection, `GET` and
GraphiQL are served by GraphQL Yoga over the derived schema.

## Also served

`/api/registry/*`, `/api/discovery/*` and `/api/reference/*` describe the
installed capabilities, search them by semantic type and serve reference data
to the designer. They are read-only and are not part of the contract this page
makes; the draft routes above are the way to build a question.
