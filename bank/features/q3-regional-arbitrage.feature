@bank @Q3 @phase-5
Feature: Q3 Buy in The Forge, sell in Domain: what is the profit per unit after tax?

  Forces: two branches from one subject joined by a derived step.

  Rule: When a person drafts two branches from one subject and joins them, the fabric shall plan both branches in parallel and the join after both.

    Scenario: Q3 joins a buy branch and a sell branch
      Given a fabric over the recorded Tranquility fixture
      When I start a draft from the type "Tritanium"
      And I apply the move "trade profit after tax"
      And I fill the hole "from" with "The Forge"
      And I fill the hole "to" with "Domain"
      Then the draft has no holes
      And the plan runs the two order lookups in parallel
      When I run the draft
      Then the answer is an ISK amount
