Feature: Pipeline Composition & Validation
  As a schema gateway user
  I want to compose capabilities into pipelines with semantic type safety
  So that invalid wiring is caught at compile time with actionable diagnostics

  Background:
    Given a capability catalog with registered capabilities
    And a pipeline builder

  Scenario: Connect capabilities with compatible semantic types
    Given a pipeline with nodes:
      | id       | capability              |
      | resolve  | universe.resolve.region |
      | orders   | market.orders           |
    And an edge from "resolve.region" to "orders.region"
    When I validate the pipeline wiring
    Then there should be 0 diagnostics

  Scenario: Reject incompatible semantic type connection
    Given a pipeline with nodes:
      | id       | capability              |
      | resolve  | universe.resolve.region |
      | orders   | market.orders           |
    And an edge from "resolve.region" to "orders.item"
    When I validate the pipeline wiring
    Then there should be 1 diagnostic
    And the diagnostic should have code "SEMANTIC_TYPE_MISMATCH"

  Scenario: Suggest intermediate capability for type mismatch
    When I request suggestions to bridge "eve.region.reference" to "eve.market.order.collection"
    Then I should receive suggestions

  Scenario: Detect cycle in pipeline graph
    Given a pipeline with nodes:
      | id | capability              |
      | a  | universe.resolve.region |
      | b  | market.orders           |
    And an edge from "a.region" to "b.region"
    And an edge from "b.orders" to "a.query"
    When I check for cycles
    Then a cycle should be detected

  Scenario: Accept acyclic pipeline
    Given a pipeline with nodes:
      | id       | capability              |
      | resolve  | universe.resolve.region |
      | orders   | market.orders           |
    And an edge from "resolve.region" to "orders.region"
    When I check for cycles
    Then no cycle should be detected

  Scenario: Pipeline with pipeline-level inputs
    Given a pipeline with input "region" of type "eve.region.reference"
    And a pipeline with nodes:
      | id     | capability    |
      | orders | market.orders |
    And an edge from "input.region" to "orders.region"
    When I validate the pipeline wiring
    Then there should be 0 diagnostics
