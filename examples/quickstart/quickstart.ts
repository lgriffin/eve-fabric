/**
 * EVE Fabric quickstart: create a fabric, add your own capability, ask a
 * question, save it, share it, and open it somewhere else.
 *
 * Offline by default, over the Tranquility fixture (ESI.ts's own mock
 * transport and a small SDE), so it runs anywhere, CI included. `--live`
 * asks Tranquility's ESI instead; names still come from the fixture SDE.
 *
 * Run: pnpm quickstart            (or: pnpm quickstart --live)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createFabric, printLine, type Fabric } from '@eve-fabric/fabric';
import type { Pack } from '@eve-fabric/kit';
import { corePack } from '@eve-fabric/pack-core';
import { weaveToYaml } from '@eve-fabric/weave';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { createEsi } from '@lgriffin/esi.ts/client';
import { quickstartPack } from './pack.js';

const COMPATIBILITY_DATE = '2026-08-18';

export interface QuickstartOptions {
  /** Ask Tranquility's ESI instead of the offline fixture. */
  readonly live?: boolean;
  /** Where the saved question and the weave are written. */
  readonly outDir: string;
  /** Where the walkthrough is printed. */
  readonly print?: (line: string) => void;
}

export interface QuickstartResult {
  readonly answer: unknown;
  readonly reopenedAnswer: unknown;
  readonly sharedAnswer: unknown;
  readonly graphqlPath: string;
  readonly weavePath: string;
}

function fabricWith(packs: readonly Pack[], live: boolean): Fabric {
  const esi = live
    ? createEsi({
        userAgent: 'eve-fabric-quickstart/0.2 (+https://github.com/lgriffin/eve-fabric)',
        compatibilityDate: COMPATIBILITY_DATE,
      })
    : tranquilityEsi().esi;
  return createFabric({
    esi,
    esiCompatibilityDate: COMPATIBILITY_DATE,
    sde: tranquilitySde(),
    packs: [...packs],
  });
}

export async function runQuickstart(options: QuickstartOptions): Promise<QuickstartResult> {
  const live = options.live === true;
  const print = options.print ?? printLine;
  const step = (n: number, title: string) => print(`\n${String(n)}. ${title}`);
  mkdirSync(options.outDir, { recursive: true });

  step(1, 'Create a fabric: ESI, the SDE and the packs you install');
  const fabric = fabricWith([corePack, quickstartPack], live);
  print(`   ESI: ${live ? 'Tranquility (live)' : 'the offline Tranquility fixture'}`);
  print(`   Packs: ${corePack.id}, ${quickstartPack.id} (yours, from ./pack.ts)`);

  step(2, 'Start a question from a subject and see the moves it offers');
  const start = fabric.draft({ type: 'Tritanium' });
  print(`   fabric.draft({ type: 'Tritanium' }).moves()`);
  print(
    `   → ${start
      .moves()
      .map((m) => m.name)
      .join(', ')}`,
  );

  step(3, 'Apply a move; it opens a hole, which lists its choices');
  const withOrders = start.apply('orders');
  const [region] = withOrders.holes;
  const choices = region === undefined ? [] : await region.choices('Forge');
  const holes = withOrders.holes.map((h) => h.name + ' (' + h.type + ')');
  print(`   .apply('orders') → holes: ${holes.join(', ')}`);
  print(`   hole.choices('Forge') → ${choices.map((c) => c.name).join(', ')}`);
  const inTheForge = withOrders.fill('region', 'The Forge');

  step(4, 'Use your own capability: `cost to buy` from ./pack.ts is now a move');
  const draft = inTheForge.apply('cost to buy').fill('quantity', 2_000_000);
  const plan = draft.plan();
  print(`   .apply('cost to buy').fill('quantity', 2_000_000)`);
  print(
    `   plan: ${String(plan.steps.length)} steps, ${String(plan.esiCalls)} ESI call(s), scopes: ${plan.scopes.join(', ') || 'none'}`,
  );

  step(5, 'Ask it');
  const { answer } = await fabric.query(draft);
  print(`   2,000,000 Tritanium in The Forge costs ${formatIsk(answer)}`);

  step(6, 'Save it: a question saves as a GraphQL document');
  const graphql = draft.toGraphQL();
  const graphqlPath = join(options.outDir, 'cost-to-buy.graphql');
  writeFileSync(graphqlPath, graphql);
  print(`   wrote ${relative(process.cwd(), graphqlPath)}`);
  print(indent(graphql));
  const reopened = fabric.fromGraphQL(graphql);
  const { answer: reopenedAnswer } = await fabric.query(reopened);
  print(`   fabric.fromGraphQL(saved) asks the same question: ${formatIsk(reopenedAnswer)}`);

  step(7, 'Share it: a weave is a question another fabric can add as a move');
  const weave = fabric.weave(draft, {
    id: 'quickstart.cost.to.buy.in',
    version: '1.0.0',
    as: 'cost to buy in',
  });
  const weaveYaml = weaveToYaml(fabric.export(weave));
  const weavePath = join(options.outDir, 'cost-to-buy-in.weave.yaml');
  writeFileSync(weavePath, weaveYaml);
  print(`   wrote ${relative(process.cwd(), weavePath)} (no code inside: it names what it needs)`);

  step(8, 'Open it in another fabric');
  const withoutYourPack = fabricWith([corePack], live);
  try {
    await withoutYourPack.add(weaveYaml);
  } catch (error) {
    print(`   A fabric without your pack refuses it, adding nothing:`);
    print(`   ${(error as Error).name}: ${(error as Error).message}`);
  }
  const other = fabricWith([corePack, quickstartPack], live);
  await other.add(weaveYaml);
  const shared = other
    .draft({ type: 'Pyerite' })
    .apply('cost to buy in')
    .fill('region', 'The Forge')
    .fill('costToBuyQuantity', 10_000);
  const { answer: sharedAnswer } = await other.query(shared);
  print(`   With it installed, 'cost to buy in' is a move on any item:`);
  print(`   10,000 Pyerite in The Forge costs ${formatIsk(sharedAnswer)}`);

  step(9, 'Mistakes are named, with what was probably meant');
  try {
    start.apply('ordrs');
  } catch (error) {
    print(`   .apply('ordrs') → ${(error as Error).message}`);
  }

  print('\nNext: examples/quickstart/README.md walks through writing your own pack.');
  return { answer, reopenedAnswer, sharedAnswer, graphqlPath, weavePath };
}

function formatIsk(value: unknown): string {
  return typeof value === 'number' ? `${value.toLocaleString('en-US')} ISK` : String(value);
}

function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `     ${line}`)
    .join('\n');
}
