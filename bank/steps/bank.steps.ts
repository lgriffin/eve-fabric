/**
 * Question-bank steps, written against the draft API (fabric.draft, moves,
 * holes, fill, plan). A step whose phase has not landed stays pending; a
 * pending step fails its scenario, so the bank count only rises when the
 * system can really answer.
 */
import assert from 'node:assert/strict';
import { Given, When, Then, World, setWorldConstructor } from '@cucumber/cucumber';
import { createFabric, type Draft, type DraftPlan, type Fabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/domain';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';

const PENDING = 'pending';

class BankWorld extends World {
  fabric: Fabric | undefined;
  draft: Draft | undefined;
  answer: unknown;

  get theFabric(): Fabric {
    assert.ok(this.fabric, 'no fabric: start with "Given a fabric over ..."');
    return this.fabric;
  }

  get theDraft(): Draft {
    assert.ok(this.draft, 'no draft: start one first');
    return this.draft;
  }

  plan(): DraftPlan {
    return this.theDraft.plan();
  }
}

setWorldConstructor(BankWorld);

Given('a fabric over the recorded Tranquility fixture', function (this: BankWorld) {
  const { esi } = tranquilityEsi();
  this.fabric = createFabric({
    esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
});
Given('the example incursions pack is installed', () => PENDING);
Given('I am a character with the scope {string}', (_scope: string) => PENDING);
Given('I am a character without the scope {string}', (_scope: string) => PENDING);
Given('a weave exported from Q3 by another fabric', () => PENDING);

When('I start a draft from the type {string}', function (this: BankWorld, name: string) {
  this.draft = this.theFabric.draft({ type: name });
});
When('I start a draft from the system {string}', function (this: BankWorld, name: string) {
  this.draft = this.theFabric.draft({ system: name });
});
When('I start a draft from {string}', (_subject: string) => PENDING);
When('I start a draft from my character', () => PENDING);
When('I apply the move {string}', function (this: BankWorld, move: string) {
  this.draft = this.theDraft.apply(move);
});
When(
  'I fill the hole {string} with {string}',
  function (this: BankWorld, hole: string, value: string) {
    this.draft = this.theDraft.fill(hole, value);
  },
);
When('I run the draft', async function (this: BankWorld) {
  this.answer = (await this.theFabric.query(this.theDraft)).answer;
});
When('I import the weave', () => PENDING);

Then('the draft has no holes', function (this: BankWorld) {
  assert.deepEqual(
    this.theDraft.holes.map((h) => h.name),
    [],
  );
});
Then('the plan has {int} steps', function (this: BankWorld, n: number) {
  assert.equal(this.plan().steps.length, n);
});
Then('the plan makes {int} ESI call', function (this: BankWorld, n: number) {
  assert.equal(this.plan().esiCalls, n);
});
Then('the plan needs no scopes', function (this: BankWorld) {
  assert.deepEqual(this.plan().scopes, []);
});
Then('the plan reports a per-item step with a call count', () => PENDING);
Then('the plan runs the two order lookups in parallel', () => PENDING);
Then('the answer names a solar system with a security status', function (this: BankWorld) {
  const answer = this.answer as { name?: unknown; security_status?: unknown } | undefined;
  assert.equal(typeof answer?.name, 'string');
  assert.equal(typeof answer?.security_status, 'number');
});
Then('the answer is an ISK amount', () => PENDING);
Then('the answer has a jump count and a security status', () => PENDING);
Then('the answer is a list of solar systems', () => PENDING);
Then('the answer is a list of market orders', () => PENDING);
Then('the move {string} is unavailable for want of {string}', (_m: string, _s: string) => PENDING);
Then('the move {string} is offered', (_move: string) => PENDING);
