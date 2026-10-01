import { defineCapability } from '@eve-fabric/kit';
import { collect, num, requireId } from '../support.js';
import {
  EveCharacter,
  EveCharacterOrders,
  EveCharacterRef,
  EveCurrencyIsk,
  EveText,
  EveWalletEntries,
} from '../types.js';

// A character's own data needs an identity holding the scope: these
// capabilities declare it in `uses`, so a draft offers them as unavailable
// to a caller without it (FAB-VAL-07) and they run on that caller's view.

export const WALLET_SCOPE = 'esi-wallet.read_character_wallet.v1';
export const ORDERS_SCOPE = 'esi-markets.read_character_orders.v1';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const resolveCharacter = defineCapability({
  id: 'character.resolve',
  version: '2.0.0',
  name: 'Resolve Character',
  description: 'Find a character by exact name or id',
  inputs: {
    query: { type: EveCharacterRef, acceptsName: true, description: 'Character id or name' },
  },
  outputs: { character: { type: EveCharacterRef, description: 'The character' } },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 300 },
  async run({ query }, { esi }) {
    if (typeof query === 'number') return { character: query };
    if (typeof query !== 'string') {
      throw new Error('character.resolve requires a numeric ID or string name as "query"');
    }
    const found = await esi.universe.ids.post([query]);
    const wanted = query.toLowerCase();
    const match = (found.characters ?? []).find((c) => c.name?.toLowerCase() === wanted);
    if (match === undefined) throw new Error(`No character named "${query}"`);
    return { character: match.id };
  },
});

export const characterDetails = defineCapability({
  id: 'character.details',
  version: '2.0.0',
  name: 'Character',
  description: "A character's public record: name and corporation",
  inputs: { id: { type: EveCharacterRef, description: 'The character' } },
  outputs: { character: { type: EveCharacter, description: 'The character record' } },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 300 },
  async run({ id }, { esi }) {
    const characterId = requireId(id, 'id');
    const found = await esi.character(characterId).get();
    return {
      character: {
        character_id: characterId,
        name: found.name,
        corporation_id: found.corporation_id,
      },
    };
  },
});

export const walletJournal = defineCapability({
  id: 'character.wallet.journal',
  version: '2.0.0',
  name: 'Wallet Journal',
  description: "Every line of a character's wallet journal ESI still holds",
  inputs: { character: { type: EveCharacterRef, description: 'Whose wallet' } },
  outputs: { journal: { type: EveWalletEntries, description: 'The journal, newest first' } },
  attach: { on: EveCharacter, as: 'wallet journal', subject: 'character' },
  uses: [`esi:${WALLET_SCOPE}`],
  cost: { estimatedLatencyMs: 500 },
  async run({ character }, { esi }) {
    const journal = await collect(
      esi.character(requireId(character, 'character')).wallet.journal.get(),
    );
    return { journal };
  },
});

export const biggestSpendThisWeek = defineCapability({
  id: 'analysis.wallet.biggest.spend',
  version: '2.0.0',
  name: 'Biggest Spend This Week',
  description:
    'What took the most ISK out of the wallet in the last seven days: the total and the kind of entry it was',
  inputs: { journal: { type: EveWalletEntries, description: 'A wallet journal' } },
  outputs: {
    amount: { type: EveCurrencyIsk, description: 'ISK spent on it' },
    ref_type: { type: EveText, description: 'What it was spent on' },
  },
  attach: { on: EveWalletEntries, as: 'biggest spend this week', subject: 'journal' },
  run({ journal }, { clock }) {
    const since = clock.now() - WEEK_MS;
    const spent = new Map<string, number>();
    for (const entry of journal as readonly {
      date: string;
      ref_type: string;
      amount?: number;
    }[]) {
      const amount = num(entry.amount);
      if (amount >= 0 || Date.parse(entry.date) < since) continue;
      spent.set(entry.ref_type, (spent.get(entry.ref_type) ?? 0) - amount);
    }
    let best: [string, number] | undefined;
    for (const pair of spent) if (best === undefined || pair[1] > best[1]) best = pair;
    return { amount: best?.[1] ?? 0, ref_type: best?.[0] ?? null };
  },
});

export const characterOrders = defineCapability({
  id: 'character.orders',
  version: '2.0.0',
  name: 'My Orders',
  description: "A character's open market orders",
  inputs: { character: { type: EveCharacterRef, description: 'Whose orders' } },
  outputs: { orders: { type: EveCharacterOrders, description: 'Open orders' } },
  attach: { on: EveCharacter, as: 'my orders', subject: 'character' },
  uses: [`esi:${ORDERS_SCOPE}`],
  cost: { estimatedLatencyMs: 500 },
  async run({ character }, { esi }) {
    const orders = await esi.character(requireId(character, 'character')).orders.get();
    return { orders };
  },
});
