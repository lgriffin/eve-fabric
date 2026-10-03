/**
 * EVE Fabric — live ESI smoke test
 *
 * Asks the saved questions in examples/questions of Tranquility, the same
 * documents `pnpm fabric ask` runs offline. Names come from the SDE fixture;
 * the prices and the route come from ESI live. Exits non-zero if any answer
 * is missing, so the nightly workflow notices when ESI or ESI.ts moves under
 * us.
 *
 * Run: pnpm run demo:esi
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { tranquilitySde } from '@eve-fabric/fixture';
import { createEsi } from '@lgriffin/esi.ts/client';

const COMPATIBILITY_DATE = '2026-08-18';

const QUESTIONS = join(import.meta.dirname, 'questions');

/** Each saved question, and what a live answer must look like. */
const asks: readonly { file: string; says: string; check: (answer: unknown) => boolean }[] = [
  {
    file: 'market-snapshot.graphql',
    says: 'Tritanium, lowest sell in The Forge (ISK)',
    check: (answer) => typeof answer === 'number' && answer > 0,
  },
  {
    file: 'route-distance.graphql',
    says: 'Jita to Amarr (jumps)',
    check: (answer) => typeof answer === 'number' && answer >= 1,
  },
  {
    file: 'trade-profit.graphql',
    says: 'Tritanium, The Forge to Domain, profit per unit after tax (ISK)',
    check: (answer) => typeof answer === 'number' && Number.isFinite(answer),
  },
];

async function main(): Promise<void> {
  const esi = createEsi({
    userAgent:
      process.env['ESI_USER_AGENT'] ?? 'eve-fabric/0.2 (+https://github.com/lgriffin/eve-fabric)',
    compatibilityDate: COMPATIBILITY_DATE,
  });
  const fabric = createFabric({
    esi,
    esiCompatibilityDate: COMPATIBILITY_DATE,
    sde: tranquilitySde(),
    packs: [corePack],
  });

  try {
    for (const { file, says, check } of asks) {
      const document = readFileSync(join(QUESTIONS, file), 'utf8');
      const { answer } = await fabric.query(fabric.fromGraphQL(document));
      console.log(`${says}: ${JSON.stringify(answer)}`);
      if (!check(answer)) {
        throw new Error(`${file} got no usable answer from Tranquility: ${JSON.stringify(answer)}`);
      }
    }
  } finally {
    esi.shutdown();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
