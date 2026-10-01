@bank @Q7 @phase-6
Feature: Q7 Which of my sell orders have been undercut?

  Forces: a scope, a per-item ESI call, and a location resolved to its region.

  Rule: When a character with the market scope drafts their orders and applies undercut, the fabric shall look up each order's region market once.

    Scenario: Q7 finds undercut orders
      Given a fabric over the recorded Tranquility fixture
      And I am a character with the scope "esi-markets.read_character_orders.v1"
      When I start a draft from my character
      And I apply the move "my orders"
      And I apply the move "undercut"
      Then the draft has no holes
      And the plan reports a per-item step with a call count
      When I run the draft
      Then the answer is a list of market orders
