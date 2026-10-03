# @eve-fabric/executor

Runs a compiled plan, one capability's `run` at a time. The `Executor` takes
the capability catalog, the sources capabilities reach through their `uses`,
an optional cache and a clock; `execute(plan, inputs)` runs the steps in the
planner's order, as many at once as `maxConcurrency` allows, and returns the
outputs with the provenance of each step. Every port value is checked against
its semantic type on the way in and out.

A failure says what went wrong: `ScopeMissingError` (the caller's token lacks
a scope), `SourceUnavailableError`, `PortValueError`, `PerItemCapError`, or
`StepExecutionError` wrapping what a capability threw.

You rarely import this directly; `createFabric` wires it, and
`@eve-fabric/fabric` re-exports `ScopeMissingError`.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
