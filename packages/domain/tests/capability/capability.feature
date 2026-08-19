Feature: Capability Definition and Catalog
  As a schema gateway developer
  I want to define and catalog data capabilities with semantic types
  So that pipelines can compose capabilities based on type compatibility

  Background:
    Given a capability catalog

  Scenario: Register a capability with semantic inputs and outputs
    When I register a capability "market.orders" with:
      | field       | value                      |
      | version     | 1                          |
      | name        | Market Orders              |
      | source      | ESI                        |
    And the capability has a semantic input "regionId" of type "eve.region.reference"
    And the capability has a semantic output "orders" of type "eve.market.order.collection"
    Then the catalog should contain "market.orders"
    And the capability should have 1 input
    And the capability should have 1 output

  Scenario: Reject duplicate capability registration
    Given a registered capability "market.orders" version 1
    When I try to register "market.orders" version 1 again
    Then the registration should fail with "already registered"

  Scenario: Retrieve latest version of a capability
    Given a registered capability "market.orders" version 1
    And a registered capability "market.orders" version 2
    When I retrieve "market.orders" without specifying a version
    Then I should get version 2

  Scenario: Find capabilities by semantic input type
    Given a registered capability "market.orders" with input type "eve.region.reference"
    And a registered capability "sde.types.lookup" with input type "eve.type.reference"
    When I search for capabilities accepting "eve.region.reference"
    Then I should find 1 capability
    And the result should include "market.orders"

  Scenario: Find capabilities by semantic output type
    Given a registered capability "market.orders" with output type "eve.market.order.collection"
    When I search for capabilities producing "eve.market.order.collection"
    Then I should find 1 capability

  Scenario: Filter capabilities by source
    Given a registered capability "market.orders" from source "ESI"
    And a registered capability "sde.types.lookup" from source "SDE"
    When I filter capabilities by source "ESI"
    Then I should find 1 capability
    And the result should include "market.orders"

  Scenario: Search capabilities by text query
    Given a registered capability "market.orders" named "Market Orders"
    When I search for "market"
    Then I should find 1 capability

  Scenario: Validate capability definition schema
    When I try to register a capability with an invalid ID "INVALID"
    Then the registration should fail with "Invalid capability definition"

  Scenario: Capability with dependencies
    Given a registered capability "sde.types.lookup" version 1
    When I register a capability "market.enriched" that depends on "sde.types.lookup"
    Then the catalog should contain "market.enriched"
    And the capability should have 1 dependency
