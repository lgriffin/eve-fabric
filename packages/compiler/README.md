# @eve-fabric/compiler

Compiles an EVE Fabric pipeline into an execution plan. `compile(pipeline,
catalog)` resolves each step's capability, checks the wiring by semantic type,
finds cycles and missing inputs, and works out the sources, scopes, cache
strategy and cost of the plan. It returns the plan, or diagnostics that say
what is wrong and where (`SEMANTIC_TYPE_MISMATCH`, `GRAPH_CYCLE_DETECTED`,
`MISSING_INPUT` and the rest). `resolveComposites` expands composite steps
before that.

You rarely import this directly; `createFabric` wires it, and a draft's
`plan()` is built on it. Reach for it when you type a `CompileResult` or a
`CompilerDiagnostic` the fabric hands you.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
