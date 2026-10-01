@bank @Q4 @phase-5
Feature: Q4 How many jumps from Jita to Amarr, and what is the lowest security on the way?

  Forces: an ESI route, each system id resolved in the SDE, a minimum over the list.

  Rule: When a person drafts a route from Jita to Amarr and applies lowest security, the fabric shall resolve each system on the route once.

    Scenario: Q4 resolves every system on the route
      Given a fabric over the recorded Tranquility fixture
      When I start a draft from the system "Jita"
      And I apply the move "route"
      And I fill the hole "destination" with "Amarr"
      And I apply the move "lowest security"
      Then the draft has no holes
      And the plan reports a per-item step with a call count
      When I run the draft
      Then the answer has a jump count and a security status
