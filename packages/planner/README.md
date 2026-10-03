# @eve-fabric/planner

Plans the execution of a compiled pipeline. `planExecution(plan)` orders the
steps, groups the ones that can run in parallel, coalesces requests, and merges
identical steps so each runs once (`deduplicateSteps`). `prunePlan` drops the
steps no requested output needs.

You rarely import this directly; the executor calls it, and `createFabric`
wires the executor.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric).
