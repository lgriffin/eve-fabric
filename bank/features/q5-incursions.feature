@bank @Q5 @phase-5
Feature: Q5 Where are the incursions, and which are in high-sec?

  Forces: a capability added by a pack outside the repo, then a per-item SDE lookup.

  Rule: When a pack defined outside the repository is installed, the fabric shall offer its capabilities as moves like any built-in.

    Scenario: Q5 uses a capability from an external pack
      Given a fabric over the recorded Tranquility fixture
      And the example incursions pack is installed
      When I start a draft from "incursions"
      And I apply the move "systems"
      And I apply the move "high-sec only"
      Then the draft has no holes
      When I run the draft
      Then the answer is a list of solar systems
