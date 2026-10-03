/**
 * Question-bank steps, written against the draft API (fabric.draft, moves,
 * holes, fill, plan). A step whose phase has not landed stays pending; a
 * pending step fails its scenario, so the bank count only rises when the
 * system can really answer.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { AfterAll, Given, When, Then, World, setWorldConstructor } from '@cucumber/cucumber';
import {
  createFabric,
  type Draft,
  type DraftPlan,
  type Fabric,
  type FabricIdentity,
} from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/core';
import {
  CHARACTER,
  tranquilityCharacter,
  tranquilityEsi,
  tranquilitySde,
} from '@eve-fabric/fixture';
import { lazySdeDirectory } from '@eve-fabric/source-sde';
import { directoryIndex, type WeaveFile } from '@eve-fabric/weave';
import { createEsi, type Esi } from '@lgriffin/esi.ts/client';
import { incursionsPack } from '../../examples/incursions-pack/pack.js';

const COMPATIBILITY_DATE = '2026-08-18';

/**
 * BANK_LIVE=1 (set by `pnpm run test:bank --live`) asks Tranquility's ESI
 * instead of the recorded fixture; the answers are checked for shape, never
 * for the figures a recording has. Names come from the SDE export at
 * SDE_DATA_PATH when there is one, else from the fixture's SDE, which knows
 * only the questions' own names: the runner then skips the questions that
 * follow a live id (a station, a route's systems) into the SDE.
 */
const LIVE = process.env['BANK_LIVE'] === '1';
const SDE_DATA_PATH = process.env['SDE_DATA_PATH'];
let liveEsi: Esi | undefined;

function sdeFor() {
  return LIVE && SDE_DATA_PATH !== undefined ? lazySdeDirectory(SDE_DATA_PATH) : tranquilitySde();
}

function esiFor(): Esi {
  if (!LIVE) return tranquilityEsi().esi;
  liveEsi ??= createEsi({
    userAgent:
      process.env['ESI_USER_AGENT'] ?? 'eve-fabric/0.2 (+https://github.com/lgriffin/eve-fabric)',
    compatibilityDate: COMPATIBILITY_DATE,
  });
  return liveEsi;
}

AfterAll(() => {
  liveEsi?.shutdown();
});

/**
 * Where Q8's weave comes from: the index committed under weaves/, exported by
 * a fabric in another checkout, or WEAVE_INDEX when CI hands one across jobs.
 */
const WEAVE_INDEX = process.env['WEAVE_INDEX'] ?? join(process.cwd(), 'weaves');

class BankWorld extends World {
  fabric: Fabric | undefined;
  draft: Draft | undefined;
  me: FabricIdentity | undefined;
  answer: unknown;
  weave: WeaveFile | undefined;

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
  this.fabric = createFabric({
    esi: esiFor(),
    esiCompatibilityDate: COMPATIBILITY_DATE,
    sde: sdeFor(),
    packs: [corePack],
    // A recording is read at the moment it was made; live ESI is read now.
    ...(LIVE ? {} : { clock: fixedClock(Date.UTC(2026, 9, 1)) }),
  });
});
Given('the example incursions pack is installed', function (this: BankWorld) {
  this.theFabric.install(incursionsPack);
});
Given('I am a character with the scope {string}', function (this: BankWorld, scope: string) {
  this.me = tranquilityCharacter(CHARACTER.ava, [scope]);
});
Given('I am a character without the scope {string}', function (this: BankWorld, scope: string) {
  this.me = tranquilityCharacter(
    CHARACTER.ava,
    ['esi-markets.read_character_orders.v1', 'esi-wallet.read_character_wallet.v1'].filter(
      (s) => s !== scope,
    ),
  );
});
Given('a weave exported from Q3 by another fabric', async function (this: BankWorld) {
  this.weave = await directoryIndex(WEAVE_INDEX).resolve('lgriffin.trade.opportunity@^1');
});

When('I start a draft from the type {string}', function (this: BankWorld, name: string) {
  this.draft = this.theFabric.draft({ type: name });
});
When('I start a draft from the system {string}', function (this: BankWorld, name: string) {
  this.draft = this.theFabric.draft({ system: name });
});
When('I start a draft from {string}', function (this: BankWorld, subject: string) {
  this.draft = this.theFabric.draft(subject);
});
When('I start a draft from my character', function (this: BankWorld) {
  assert.ok(this.me, 'no character: start with "Given I am a character ..."');
  this.draft = this.theFabric.draft({ character: this.me.characterId }, { as: this.me });
});
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
When('I import the weave', async function (this: BankWorld) {
  assert.ok(this.weave, 'no weave: start with "Given a weave exported ..."');
  await this.theFabric.add(this.weave);
});

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
Then('the plan reports a per-item step with a call count', function (this: BankWorld) {
  const perItem = this.plan().steps.filter((s) => s.each !== undefined);
  assert.ok(perItem.length > 0, 'no step runs per item');
  for (const step of perItem) {
    assert.equal(typeof step.each!.callsPerItem, 'number');
    assert.ok(step.each!.cap > 0);
  }
});
Then('the plan runs the two order lookups in parallel', function (this: BankWorld) {
  const { plan } = this.plan();
  const lookups = plan.steps
    .filter((s) => (s.capability.id as string) === 'market.orders')
    .map((s) => s.id);
  assert.equal(lookups.length, 2, 'expected two order lookups');
  assert.ok(
    plan.parallelGroups.some((g) => lookups.every((id) => g.steps.includes(id))),
    'the order lookups are not in one parallel group',
  );
});
Then('the answer names a solar system with a security status', function (this: BankWorld) {
  const answer = this.answer as { name?: unknown; security_status?: unknown } | undefined;
  assert.equal(typeof answer?.name, 'string');
  assert.equal(typeof answer?.security_status, 'number');
});
Then('the answer is an ISK amount', function (this: BankWorld) {
  assert.equal(typeof this.answer, 'number');
  assert.ok(Number.isFinite(this.answer));
});
Then('the answer has a jump count and a security status', function (this: BankWorld) {
  const answer = this.answer as { jumps?: unknown; security_status?: unknown } | undefined;
  assert.equal(typeof answer?.jumps, 'number');
  assert.equal(typeof answer?.security_status, 'number');
});
Then('the answer is a list of solar systems', function (this: BankWorld) {
  assert.ok(Array.isArray(this.answer), 'the answer is not a list');
  for (const system of this.answer as { system_id?: unknown; name?: unknown }[]) {
    assert.equal(typeof system.system_id, 'number');
    assert.equal(typeof system.name, 'string');
  }
});
Then('the answer is a list of market orders', function (this: BankWorld) {
  assert.ok(Array.isArray(this.answer), 'the answer is not a list');
  for (const order of this.answer as { order_id?: unknown; price?: unknown }[]) {
    assert.equal(typeof order.order_id, 'number');
    assert.equal(typeof order.price, 'number');
  }
});
Then(
  'the move {string} is unavailable for want of {string}',
  function (this: BankWorld, name: string, scope: string) {
    const move = this.theDraft.moves().find((m) => m.name === name);
    assert.ok(move, `"${name}" is not offered at all`);
    assert.deepEqual(move.unavailable?.scopes, [scope]);
  },
);
Then('the move {string} is offered', function (this: BankWorld, name: string) {
  const move = this.theDraft.moves().find((m) => m.name === name);
  assert.ok(move && move.unavailable === undefined, `"${name}" is not offered`);
});
