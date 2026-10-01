import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getNamedType, isNonNullType, parse, validate, type GraphQLObjectType } from 'graphql';
import { corePack, ORDERS_SCOPE, WALLET_SCOPE } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/domain';
import {
  CHARACTER,
  REGION,
  SYSTEM,
  TYPE,
  tranquilityCharacter,
  tranquilityEsi,
  tranquilitySde,
} from '@eve-fabric/test-support';
import { incursionsPack } from '../../../examples/incursions-pack/pack.js';
import {
  createFabric,
  GraphQLDraftError,
  type Draft,
  type Fabric,
  type Hole,
} from '../src/index.js';

function tranquilityFabric(): Fabric {
  const { esi } = tranquilityEsi();
  return createFabric({
    esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack, incursionsPack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
}

const me = tranquilityCharacter(CHARACTER.ava, [WALLET_SCOPE, ORDERS_SCOPE]);

/** Q1 to Q7 as drafts. */
function bank(fabric: Fabric): Record<string, Draft> {
  return {
    Q1: fabric
      .draft({ type: 'Tritanium' })
      .apply('orders')
      .fill('region', 'The Forge')
      .apply('cheapest')
      .apply('location')
      .apply('system'),
    Q2: fabric
      .draft({ type: 'Rifter' })
      .apply('blueprint')
      .apply('materials')
      .apply('cheapest price each')
      .fill('region', 'The Forge')
      .apply('total cost'),
    Q3: fabric
      .draft({ type: 'Tritanium' })
      .apply('trade profit after tax')
      .fill('from', 'The Forge')
      .fill('to', 'Domain'),
    Q4: fabric
      .draft({ system: 'Jita' })
      .apply('route')
      .fill('destination', 'Amarr')
      .apply('lowest security'),
    Q5: fabric.draft('incursions').apply('systems').apply('high-sec only'),
    Q6: fabric
      .draft({ character: CHARACTER.ava }, { as: me })
      .apply('wallet journal')
      .apply('biggest spend this week'),
    Q7: fabric.draft({ character: CHARACTER.ava }, { as: me }).apply('my orders').apply('undercut'),
  };
}

function expectSame(back: Draft, draft: Draft): void {
  expect(back.pipeline()).toEqual(draft.pipeline());
  expect(back.values).toEqual(draft.values);
}

describe('a draft as GraphQL', () => {
  it('prints Q1 as a path of moves, the fill an argument', () => {
    const { Q1 } = bank(tranquilityFabric());
    expect(Q1.toGraphQL()).toBe(`{
  type(name: "Tritanium") {
    orders(region: "The Forge") {
      cheapest {
        cheapest {
          location {
            system {
              __typename
            }
          }
        }
      }
    }
  }
}`);
  });

  it.each(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'])(
    '%s: draft to GraphQL to draft is identical, and the document is valid (FAB-VAL-06)',
    (question) => {
      const fabric = tranquilityFabric();
      const draft = bank(fabric)[question]!;
      const document = draft.toGraphQL();
      expect(validate(fabric.schema(), parse(document))).toEqual([]);
      const back = fabric.fromGraphQL(document, { as: me });
      expectSame(back, draft);
      expect(back.toGraphQL()).toBe(document);
      expect(back.plan().steps.length).toBeGreaterThan(0);
    },
  );

  it('selects another output of a step', () => {
    const fabric = tranquilityFabric();
    const draft = fabric
      .draft({ type: TYPE.tritanium })
      .apply('orders')
      .fill('region', REGION.theForge)
      .apply('prices')
      .apply('highestBuy');
    const document = draft.toGraphQL();
    expect(document).toContain('prices {\n        highestBuy\n      }');
    expectSame(fabric.fromGraphQL(document), draft);
  });

  it('takes a hand-written document that reads the record at the end', async () => {
    const fabric = tranquilityFabric();
    const draft = fabric.fromGraphQL(`
      query {
        type(name: "Tritanium") {
          orders(region: "The Forge") {
            cheapest { cheapest { location { system { name security_status } } } }
          }
        }
      }`);
    expectSame(draft, bank(fabric).Q1!);
    expect((await fabric.query(draft)).answer).toMatchObject({ system_id: SYSTEM.perimeter });
  });

  describe('refuses a document that is not a draft', () => {
    /** The error a document is refused with. */
    const refusal = (document: string): Error => {
      try {
        tranquilityFabric().fromGraphQL(document);
      } catch (error) {
        return error as Error;
      }
      throw new Error('the document was accepted');
    };

    it('one that branches', () => {
      const error = refusal(
        '{ type(name: "Tritanium") { orders(region: 10000002) { cheapest { __typename } spread { __typename } } } }',
      );
      expect(error).toBeInstanceOf(GraphQLDraftError);
      expect(error.message).toMatch(/one path/);
    });

    it('one that names a move not offered', () => {
      const error = refusal('{ type(name: "Tritanium") { cheapest { __typename } } }');
      expect(error).toBeInstanceOf(GraphQLDraftError);
      expect(error.message).toMatch(/not a move here/);
    });

    it('one with variables', () => {
      const error = refusal(
        'query ($r: NameOrId!) { type(name: "Tritanium") { orders(region: $r) { __typename } } }',
      );
      expect(error).toBeInstanceOf(GraphQLDraftError);
      expect(error.message).toMatch(/variable/);
    });

    it('one that starts from two subjects', () => {
      const error = refusal(
        '{ type(name: "Tritanium") { __typename } system(name: "Jita") { __typename } }',
      );
      expect(error).toBeInstanceOf(GraphQLDraftError);
      expect(error.message).toMatch(/one subject/);
    });
  });
});

describe('the derived schema (FAB-VAL-05)', () => {
  it('makes a move a field whose arguments are the holes it opens', () => {
    const schema = tranquilityFabric().schema();
    const type = schema.getQueryType()!.getFields()['type']!;
    const reference = getNamedType(type.type) as GraphQLObjectType;
    const orders = reference.getFields()['orders']!;
    expect(orders.args.map((a) => a.name)).toEqual(['region']);
    expect(isNonNullType(orders.args[0]!.type)).toBe(true);
    // The item is the subject the move hangs on, so it is no argument.
    expect(orders.args.map((a) => a.name)).not.toContain('item');
  });

  it('names the scope a move needs', () => {
    const schema = tranquilityFabric().schema();
    const character = getNamedType(
      schema.getQueryType()!.getFields()['character']!.type,
    ) as GraphQLObjectType;
    expect(character.getFields()['walletJournal']!.description).toContain(WALLET_SCOPE);
  });
});

/** A value for a hole: a choice where the type lists them, else a sample of the type. */
async function fillFor(hole: Hole): Promise<unknown> {
  const [choice] = await hole.choices();
  if (choice !== undefined) return choice.id;
  const samples: Record<string, unknown> = {
    'eve.type.reference': TYPE.tritanium,
    'eve.region.reference': REGION.theForge,
    'eve.system.reference': SYSTEM.jita,
    'eve.isk': 1000,
    'eve.quantity': 10,
    'eve.percentage': 5,
    'eve.text': 'Tritanium',
    'eve.flag': true,
  };
  if (!(hole.type in samples)) throw new Error(`No sample for a ${hole.type} hole`);
  return samples[hole.type];
}

describe('any walk of offered moves, as GraphQL (FAB-VAL-06)', () => {
  it('prints a valid document that parses back to the same draft', async () => {
    const fabric = tranquilityFabric();
    const schema = fabric.schema();
    const subjects = [{ type: 'Tritanium' }, { region: 'The Forge' }, { system: 'Jita' }];
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...subjects),
        fc.array(fc.nat(), { maxLength: 5 }),
        async (subject, picks) => {
          let draft = fabric.draft(subject);
          for (const pick of picks) {
            const moves = draft.moves();
            if (moves.length === 0) break;
            draft = draft.apply(moves[pick % moves.length]!.name);
            for (const hole of draft.holes) draft = draft.fill(hole.name, await fillFor(hole));
          }
          const document = draft.toGraphQL();
          expect(validate(schema, parse(document))).toEqual([]);
          expectSame(fabric.fromGraphQL(document), draft);
        },
      ),
      { numRuns: 100 },
    );
  });
});
