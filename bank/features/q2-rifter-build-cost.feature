@bank @Q2 @phase-5
Feature: Q2 What does a Rifter cost to build at Jita sell prices?

  Forces: SDE blueprint materials, then a price per material (a step run once
  per list item), then a sum.

  Rule: When a person drafts from Rifter and applies blueprint, materials, price per item in The Forge and total, the fabric shall report the per-item call count in the plan before running.

    Scenario: Q2 sums the cheapest sell price of every material
      Given a fabric over the recorded Tranquility fixture
      When I start a draft from the type "Rifter"
      And I apply the move "blueprint"
      And I apply the move "materials"
      And I apply the move "cheapest price each"
      And I fill the hole "region" with "The Forge"
      And I apply the move "total cost"
      Then the draft has no holes
      And the plan reports a per-item step with a call count
      When I run the draft
      Then the answer is an ISK amount
