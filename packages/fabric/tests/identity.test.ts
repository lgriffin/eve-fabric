import { describe, it, expect } from 'vitest';
import { corePack, ORDERS_SCOPE, WALLET_SCOPE } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/core';
import {
  CHARACTER,
  tranquilityCharacter,
  tranquilityEsi,
  tranquilitySde,
} from '@eve-fabric/fixture';
import {
  CharacterMismatchError,
  createFabric,
  MoveUnavailableError,
  ScopeMissingError,
  type Fabric,
  type FabricIdentity,
} from '../src/index.js';

function tranquility() {
  const { esi, transport } = tranquilityEsi();
  const fabric = createFabric({
    esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
  return { fabric, transport };
}

const ava = tranquilityCharacter(CHARACTER.ava, [WALLET_SCOPE, ORDERS_SCOPE]);
const bo = tranquilityCharacter(CHARACTER.bo, [WALLET_SCOPE, ORDERS_SCOPE]);

function biggestSpend(fabric: Fabric, me: FabricIdentity) {
  return fabric
    .draft({ character: me.characterId }, { as: me })
    .apply('wallet journal')
    .apply('biggest spend this week');
}

describe('asking as a character', () => {
  it('Q6: answers what each character spent most on, two identities in one fabric', async () => {
    const { fabric, transport } = tranquility();
    const mine = biggestSpend(fabric, ava);
    expect(mine.plan().scopes).toEqual([WALLET_SCOPE]);
    expect((await fabric.query(mine)).answer).toBe(2_000_000);
    const theirs = biggestSpend(fabric, bo);
    expect((await fabric.query(theirs)).answer).toBe(300_000);
    // What it was spent on is one move away, on the same step.
    expect((await fabric.query(mine.apply('ref_type'))).answer).toBe('market_transaction');

    // Each journal was fetched with its own character's token.
    const journals = transport.sent.filter((r) => r.url.includes('/wallet/journal'));
    expect(
      journals.map((r) => [r.url.match(/characters\/(\d+)/)![1], r.headers['authorization']]),
    ).toEqual([
      [String(CHARACTER.ava), `Bearer fixture-token-${CHARACTER.ava}`],
      [String(CHARACTER.bo), `Bearer fixture-token-${CHARACTER.bo}`],
      [String(CHARACTER.ava), `Bearer fixture-token-${CHARACTER.ava}`],
    ]);
  });

  it('Q7: lists the orders a rival beats, one market lookup per order', async () => {
    const { fabric, transport } = tranquility();
    const draft = fabric
      .draft({ character: CHARACTER.ava }, { as: ava })
      .apply('my orders')
      .apply('undercut');
    const perItem = draft.plan().steps.filter((s) => s.each !== undefined);
    expect(perItem).toHaveLength(1);
    expect(perItem[0]!.each).toMatchObject({ callsPerItem: 1, esiCallsPerItem: 1 });
    const { answer } = await fabric.query(draft);
    // 9003 is a buy order a rival outbids: the question is about sell orders.
    expect((answer as { order_id: number }[]).map((o) => o.order_id)).toEqual([9001]);
    expect(transport.sent.filter((r) => r.url.includes('/markets/'))).toHaveLength(3);
  });

  describe('without the scope (FAB-VAL-07)', () => {
    const walletless = tranquilityCharacter(CHARACTER.ava, [ORDERS_SCOPE]);

    it('offers the move as unavailable, naming the scope', () => {
      const { fabric } = tranquility();
      const moves = fabric.draft({ character: CHARACTER.ava }, { as: walletless }).moves();
      expect(moves.find((m) => m.name === 'wallet journal')?.unavailable).toEqual({
        scopes: [WALLET_SCOPE],
      });
      expect(moves.find((m) => m.name === 'my orders')?.unavailable).toBeUndefined();
    });

    it('offers it as unavailable to nobody at all', () => {
      const { fabric } = tranquility();
      const moves = fabric.draft({ character: CHARACTER.ava }).moves();
      expect(moves.find((m) => m.name === 'my orders')?.unavailable).toEqual({
        scopes: [ORDERS_SCOPE],
      });
    });

    it('refuses to apply it', () => {
      const { fabric } = tranquility();
      const draft = fabric.draft({ character: CHARACTER.ava }, { as: walletless });
      expect(() => draft.apply('wallet journal')).toThrow(MoveUnavailableError);
      expect(() => draft.apply('wallet journal')).toThrow(WALLET_SCOPE);
    });

    it('refuses to run a draft built as someone else before any call', async () => {
      const { fabric, transport } = tranquility();
      const draft = biggestSpend(fabric, ava);
      await expect(fabric.query(draft, { as: walletless })).rejects.toThrow(ScopeMissingError);
      await expect(fabric.query(draft.as(undefined))).rejects.toThrow(/run it as an identity/);
      expect(transport.sent.filter((r) => r.url.includes('/wallet/'))).toEqual([]);
    });
  });

  describe('about another character', () => {
    it('offers their private moves as unavailable, naming them', () => {
      const { fabric } = tranquility();
      const draft = fabric.draft({ character: CHARACTER.bo }, { as: ava });
      expect(draft.moves().find((m) => m.name === 'my orders')?.unavailable).toEqual({
        scopes: [],
        character: CHARACTER.bo,
      });
      expect(draft.moves().find((m) => m.name === 'details')?.unavailable).toBeUndefined();
      expect(() => draft.apply('my orders')).toThrow(MoveUnavailableError);
      expect(() => draft.apply('my orders')).toThrow(/ask as that character/);
    });

    it('refuses to run a draft as someone else before any call', async () => {
      const { fabric, transport } = tranquility();
      const draft = biggestSpend(fabric, bo);
      await expect(fabric.query(draft, { as: ava })).rejects.toThrow(CharacterMismatchError);
      expect(transport.sent.filter((r) => r.url.includes('/wallet/'))).toEqual([]);
    });

    it('refuses a character named by name before the scoped call', async () => {
      const { fabric, transport } = tranquility();
      const draft = fabric.draft({ character: 'Bo Miner' }, { as: ava }).apply('my orders');
      await expect(fabric.query(draft)).rejects.toThrow(/needs that character's token/);
      expect(transport.sent.filter((r) => r.url.includes('/orders/'))).toEqual([]);
    });
  });

  it('runs a scoped capability on its own as an identity', async () => {
    const { fabric } = tranquility();
    const orders = fabric.catalog.get('character.orders' as never);
    const out = await fabric.runOne(orders, { character: CHARACTER.ava }, ava);
    expect((out.orders as unknown[]).length).toBe(3);
    await expect(fabric.runOne(orders, { character: CHARACTER.ava })).rejects.toThrow(
      ScopeMissingError,
    );
  });

  it('starts from a character named by name', async () => {
    const { fabric } = tranquility();
    const draft = fabric.draft({ character: 'Bo Miner' }, { as: bo }).apply('details');
    expect((await fabric.query(draft)).answer).toMatchObject({
      character_id: CHARACTER.bo,
      name: 'Bo Miner',
    });
  });
});
