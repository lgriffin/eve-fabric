Feature: Composite Capabilities
  As a schema developer
  I want to publish validated pipelines as composite capabilities
  So that I can reuse them as single nodes in other pipelines

  Background:
    Given a capability catalog with standard EVE capabilities
    And a pipeline registry

  Scenario: Publish a validated pipeline as a composite capability
    Given a pipeline "market.snapshot" with nodes:
      | nodeId    | capability       |
      | resolve   | universe.resolve.type |
      | orders    | market.orders    |
      | aggregate | market.aggregate |
    And the pipeline has inputs:
      | name   | semanticType        | required |
      | item   | eve.type.reference  | true     |
      | region | eve.region.reference| true     |
    And the pipeline has outputs:
      | name       | source             |
      | lowestSell | aggregate.lowestSell |
      | highestBuy | aggregate.highestBuy |
    When I publish the pipeline as composite capability "market.snapshot" version 1
    Then the composite capability should be registered in the catalog
    And the composite capability source should be "COMPOSITE"
    And the composite capability should have a pipeline reference
    And the composite capability inputs should match the pipeline inputs
    And the composite capability outputs should have resolved semantic types

  Scenario: Use a composite capability as a node in another pipeline
    Given a composite capability "market.snapshot" is published
    And a pipeline "trade.opportunity" with nodes:
      | nodeId   | capability       |
      | snapshot | market.snapshot  |
      | filter   | collection.filter|
    And the pipeline has inputs:
      | name   | semanticType        | required |
      | item   | eve.type.reference  | true     |
      | region | eve.region.reference| true     |
    And edges connecting:
      | from          | to              |
      | input.item    | snapshot.item   |
      | input.region  | snapshot.region |
    When I compile the pipeline
    Then compilation should succeed

  Scenario: Nested composite resolution
    Given a composite capability "market.snapshot" is published
    And a composite capability "trade.analysis" is published using "market.snapshot"
    When I resolve composites for "trade.analysis"
    Then the expanded pipeline should contain sub-steps prefixed with the parent node ID

  Scenario: Composite capability aggregates auth requirements
    Given capabilities with auth requirements:
      | capability     | scopes                              |
      | market.orders  | esi-markets.structure_markets.v1    |
    When I publish a pipeline containing "market.orders" as a composite
    Then the composite capability auth should require scope "esi-markets.structure_markets.v1"

  Scenario: Composite capability version pinning
    Given a composite capability "market.snapshot" version 1 is published
    And a composite capability "market.snapshot" version 2 is published
    When I reference "market.snapshot" version 1 in a pipeline
    Then version resolution should resolve to version 1

  Scenario: Reject publishing empty pipeline as composite
    Given an empty pipeline with no nodes
    When I attempt to publish the pipeline as a composite capability
    Then publishing should fail with error "Pipeline must contain at least one node"
