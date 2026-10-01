@bank @Q8 @phase-8
Feature: Q8 Someone else's Q3, imported, used as a move on any item

  Forces: a weave round-trips and shows up as an offered move.

  Rule: If an imported weave does not compile against the local catalog, then the fabric shall refuse it and add nothing.

    Scenario: Q8 a weave exported by one fabric is a move in another
      Given a fabric over the recorded Tranquility fixture
      And a weave exported from Q3 by another fabric
      When I import the weave
      And I start a draft from the type "Pyerite"
      Then the move "trade opportunity" is offered
      When I apply the move "trade opportunity"
      And I fill the hole "from" with "The Forge"
      And I fill the hole "to" with "Domain"
      Then the draft has no holes
