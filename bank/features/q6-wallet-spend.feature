@bank @Q6 @phase-6
Feature: Q6 What did I spend the most ISK on this week?

  Forces: an identity and a scope (esi-wallet.read_character_wallet.v1); the
  move is unavailable without it.

  Rule: While the caller's identity lacks a scope a move requires, the engine shall mark the move unavailable and name the scope.

    Scenario: Q6 is unavailable without the wallet scope
      Given a fabric over the recorded Tranquility fixture
      And I am a character without the scope "esi-wallet.read_character_wallet.v1"
      When I start a draft from my character
      Then the move "wallet journal" is unavailable for want of "esi-wallet.read_character_wallet.v1"

    Scenario: Q6 answers with the scope
      Given a fabric over the recorded Tranquility fixture
      And I am a character with the scope "esi-wallet.read_character_wallet.v1"
      When I start a draft from my character
      And I apply the move "wallet journal"
      And I apply the move "biggest spend this week"
      Then the draft has no holes
      When I run the draft
      Then the answer is an ISK amount
