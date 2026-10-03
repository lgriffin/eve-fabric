import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFabric } from '@eve-fabric/fabric';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { corePack } from '@eve-fabric/pack-core';
import { describe, expect, it } from 'vitest';

/**
 * The saved questions are what a newcomer runs first with `pnpm fabric ask`,
 * so each one is asked here over the offline fixture, and its answer is the
 * one the README shows.
 */
describe('saved questions', () => {
  const fabric = createFabric({
    esi: tranquilityEsi().esi,
    sde: tranquilitySde(),
    packs: [corePack],
  });
  const ask = async (file: string): Promise<unknown> =>
    (await fabric.query(fabric.fromGraphQL(readFileSync(join(import.meta.dirname, file), 'utf8'))))
      .answer;

  it.each([
    ['market-snapshot.graphql', 3.98],
    ['route-distance.graphql', 4],
    ['trade-profit.graphql', 0.25],
  ])('%s answers %s', async (file, answer) => {
    expect(await ask(file)).toBe(answer);
  });
});
