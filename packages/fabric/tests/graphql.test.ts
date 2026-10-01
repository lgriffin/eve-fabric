import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getNamedType, isNonNullType, parse, validate, type GraphQLObjectType } from 'graphql';
import { corePack, ORDERS_SCOPE, WALLET_SCOPE } from '@eve-fabric/pack-core';
import { defineCapability, definePack } from '@eve-fabric/kit';
import { fixedClock } from '@eve-fabric/core';
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
  DraftIncompleteError,
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
    // The fields read are kept, printed back, and are what the answer carries.
    expect(draft.selection).toEqual(['name', 'security_status']);
    expect(draft.toGraphQL()).toContain(
      'system {\n              name\n              security_status\n',
    );
    expect(fabric.fromGraphQL(draft.toGraphQL()).selection).toEqual(['name', 'security_status']);
    expect(Object.keys((await fabric.query(draft)).answer as object)).toEqual([
      'name',
      'security_status',
    ]);
  });

  it('starts from a subject given by id', () => {
    const fabric = tranquilityFabric();
    const draft = fabric
      .draft({ type: TYPE.tritanium })
      .apply('orders')
      .fill('region', REGION.theForge);
    const document = draft.toGraphQL();
    expect(document).toContain(`typeById(id: ${TYPE.tritanium})`);
    expect(validate(fabric.schema(), parse(document))).toEqual([]);
    expectSame(fabric.fromGraphQL(document), draft);
  });

  it('reads _value and __typename anywhere, as nothing', () => {
    const fabric = tranquilityFabric();
    const draft = fabric.fromGraphQL('{ type(name: "Tritanium") { _value __typename } }');
    expectSame(draft, fabric.draft({ type: 'Tritanium' }));
  });

  it('reopens a hole filled after a later move as the same draft', () => {
    const fabric = tranquilityFabric();
    const draft = fabric
      .draft({ type: 'Tritanium' })
      .apply('orders')
      .apply('cheapest')
      .fill('region', 'The Forge');
    expect(draft.steps.map((s) => s.kind)).toEqual(['move', 'fill', 'move']);
    const back = fabric.fromGraphQL(draft.toGraphQL());
    expectSame(back, draft);
    expect(back.steps).toEqual(draft.steps);
  });

  it('has no saved form while a hole is open', () => {
    const draft = tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders');
    expect(() => draft.toGraphQL()).toThrow(DraftIncompleteError);
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
      expect(error.message).toMatch(/Cannot query field "cheapest"/);
    });

    it.each([
      ['no argument', '{ type { __typename } }'],
      ['an id given as a name', '{ type(id: 34) { __typename } }'],
      ['a null name', '{ type(name: null) { __typename } }'],
      ['a hole left open', '{ type(name: "Tritanium") { orders { __typename } } }'],
      [
        'a hole given an object',
        '{ type(name: "Tritanium") { orders(region: {a: 1}) { __typename } } }',
      ],
    ])('one with %s, as the schema does', (_why, document) => {
      const error = refusal(document);
      expect(error).toBeInstanceOf(GraphQLDraftError);
      expect(validate(tranquilityFabric().schema(), parse(document))).not.toEqual([]);
    });

    it('one that reads fields before its path ends', () => {
      const error = refusal(
        '{ type(name: "Tritanium") { orders(region: "The Forge") { cheapest { cheapest { location { system { name } } } } } } }'.replace(
          'location {',
          'location { name',
        ),
      );
      expect(error).toBeInstanceOf(GraphQLDraftError);
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
  it('builds when a pack hangs a move on a value type', () => {
    const shout = defineCapability({
      id: 'test.text.shout',
      version: '1.0.0',
      name: 'Shout',
      description: 'The text in capitals',
      inputs: { text: { type: 'eve.text', description: 'Some text' } },
      outputs: { shouted: { type: 'eve.text', description: 'The same, louder' } },
      attach: { on: 'eve.text', as: 'shouted', subject: 'text' },
      run: ({ text }) => ({ shouted: String(text).toUpperCase() }),
    });
    const fabric = createFabric({
      sde: tranquilitySde(),
      packs: [corePack, definePack({ id: '@test/shout', capabilities: [shout] })],
      clock: fixedClock(0),
    });
    const schema = fabric.schema();
    expect(schema.getType('EveText')).toBeDefined();
    expect(schema.getType('EveTextValue')).toBeDefined();
  });

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
