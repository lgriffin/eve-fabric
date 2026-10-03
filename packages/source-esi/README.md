# @eve-fabric/source-esi

The fabric's ESI source: the `EsiSource` port over ESI.ts's shared runtime.
`createEsiSource(esi)` hands capabilities ESI.ts's public view, and `as(identity)`
gives the view for a character, sharing the runtime's budgets and cache. It
holds no per-capability code; capabilities call ESI.ts's generated operations
through it. The compatibility date (`DEFAULT_COMPATIBILITY_DATE` unless you
pass one) is recorded in every ESI step's provenance.

You rarely import this directly; `createFabric({ esi })` wires it from an
ESI.ts client (`createEsi` from `@lgriffin/esi.ts/client`).

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
