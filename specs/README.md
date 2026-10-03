# Specifications

One directory per feature, written with spec-kit (`.specify/`) against the
[constitution](../.specify/memory/constitution.md). A spec says what a feature
must do in EARS statements; `plan.md` and `tasks.md`, where present, say how it
was built. What each pull request changed is in the [changelog](../CHANGELOG.md).

| Id  | Feature                                                                      | Status                                                              |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 001 | [Schema gateway MVP](001-schema-gateway-mvp/spec.md)                         | Implemented; its format v1 retired by 007                           |
| 002 | [Visual pipeline designer](002-visual-pipeline-designer/spec.md)             | Superseded by 007 and 008                                           |
| 003 | [Composite flow registry](003-composite-flow-registry/spec.md)               | Implemented; sharing moved to weaves in 007                         |
| 004 | [Semantic discovery](004-semantic-discovery/spec.md)                         | Implemented                                                         |
| 005 | [Intent flow designer](005-intent-flow-designer/spec.md)                     | Superseded by 007 and 008                                           |
| 006 | [Designer DX overhaul](006-designer-dx-overhaul/spec.md)                     | Superseded by 007 and 008                                           |
| 007 | [Retire the legacy pipeline model](007-retire-legacy-pipeline-model/spec.md) | Implemented ([#45](https://github.com/lgriffin/eve-fabric/pull/45)) |
| 008 | Designer as a thin client                                                    | Implemented ([#47](https://github.com/lgriffin/eve-fabric/pull/47)) |
| 009 | Codegen over weaves                                                          | Implemented ([#48](https://github.com/lgriffin/eve-fabric/pull/48)) |
| 010 | A harness for outsiders                                                      | Implemented ([#49](https://github.com/lgriffin/eve-fabric/pull/49)) |
| 011 | Composing on the canvas                                                      | Implemented ([#50](https://github.com/lgriffin/eve-fabric/pull/50)) |

008 to 011 were planned together as phases of one structural plan, with the
fixture package and the publishable CLI ([#46](https://github.com/lgriffin/eve-fabric/pull/46))
between 007 and 008. They have no directory of their own: the behaviour each
added is pinned by its tests (the designer's Playwright journeys, the codegen
and CLI tests, `docs:check` and the gateway's documented-routes test), and
described in the changelog entry for its pull request.
