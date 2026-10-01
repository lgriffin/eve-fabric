@bank @Q1 @phase-4
Feature: Q1 Where is the cheapest Tritanium in The Forge, and how safe is that system?

  Forces: a subject picked by name, one ESI call, a derived step, and an ESI id
  followed into the SDE.

  Rule: When a person drafts from Tritanium and applies orders, cheapest, location and system with The Forge as the region, the fabric shall plan six steps that make one ESI call and need no scope.

    Scenario: Q1 builds through offered moves and plans before running
      Given a fabric over the recorded Tranquility fixture
      When I start a draft from the type "Tritanium"
      And I apply the move "orders"
      And I fill the hole "region" with "The Forge"
      And I apply the move "cheapest"
      And I apply the move "location"
      And I apply the move "system"
      Then the draft has no holes
      And the plan has 6 steps
      And the plan makes 1 ESI call
      And the plan needs no scopes
      When I run the draft
      Then the answer names a solar system with a security status
