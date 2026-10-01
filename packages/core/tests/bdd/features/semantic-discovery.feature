Feature: Semantic Discovery
  As a Fabric Studio user
  I want the system to discover compatible capabilities and bridging paths
  So that I can build flows without knowing every capability's requirements

  Background:
    Given a discovery engine with the following capabilities:
      | id                        | name             | inputType              | outputType              |
      | market.orders             | Market Orders    | eve.region.reference   | eve.location.reference  |
      | universe.resolve.location | Resolve Location | eve.location.reference | eve.system.reference    |
      | routing.distance          | Route Distance   | eve.system.reference   | eve.route.distance      |
      | universe.security         | Security Status  | eve.system.reference   | eve.security.status     |

  Scenario: Port-based discovery finds all consumers
    When I query consumers for semantic type "eve.location.reference"
    Then I should get 1 suggestion
    And the first suggestion should be "Resolve Location"

  Scenario: Port-based discovery for shared type
    When I query consumers for semantic type "eve.system.reference"
    Then I should get 2 suggestions

  Scenario: Port-based discovery returns empty for unknown type
    When I query consumers for semantic type "eve.unknown.type"
    Then I should get 0 suggestions

  Scenario: Single-hop bridging path
    When I find paths from "eve.location.reference" to "eve.system.reference"
    Then I should get 1 path
    And the first path should have 1 step via "Resolve Location"

  Scenario: Multi-hop bridging path
    When I find paths from "eve.location.reference" to "eve.route.distance"
    Then I should get at least 1 path
    And the first path should have 2 steps

  Scenario: No bridging path exists
    When I find paths from "eve.route.distance" to "eve.region.reference"
    Then I should get 0 paths
