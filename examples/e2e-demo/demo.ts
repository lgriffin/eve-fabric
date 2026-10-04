/**
 * EVE Fabric: the gateway end to end, over HTTP.
 *
 * The gateway is the workbench: the designer and any HTTP client build
 * questions through it, save them as GraphQL, and share them as weaves. What
 * you ship is the question (or a pack); the gateway is not needed to run it.
 *
 * Offline by default, over the Tranquility fixture, so it runs anywhere.
 * `--live` asks Tranquility's ESI instead.
 *
 *   1. List what a question can start from
 *   2. Start a draft and see its moves and holes
 *   3. Look up a hole's choices
 *   4. Fill it and run the question
 *   5. Run the saved GraphQL form of the same question
 *   6. Export it as a weave and add the weave back as a move
 *   7. Ask the new move about another item
 *   8. See how a mistake is refused
 *
 * Run: pnpm run demo   (or: pnpm demo --live)
 */
import { createEsi } from '@lgriffin/esi.ts/client';
import { createStaticSource } from '@eve-fabric/source-sde';
import { printLine, stderrLogger } from '@eve-fabric/fabric';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { createServer } from '../../apps/gateway/src/server.js';

const live = process.argv.includes('--live');
/** The ESI schema the gateway's own client pins. */
const COMPATIBILITY_DATE = '2026-08-18';
const WEAVE = { id: 'demo.forge.prices', version: '1.0.0', as: 'forge prices' };

interface Response<T> {
  readonly status: number;
  readonly data: T;
}

interface DraftView {
  readonly moves: readonly { readonly name: string }[];
  readonly holes: readonly { readonly name: string; readonly type: string }[];
  readonly graphql?: string;
  readonly plan?: { readonly steps: readonly unknown[]; readonly esiCalls: number };
}

type Step = { kind: 'move'; move: string } | { kind: 'fill'; hole: string; value: unknown };

function section(n: number, title: string): void {
  printLine(`\n${String(n)}. ${title}`);
}

function show(line: string): void {
  printLine(`   ${line}`);
}

async function main(): Promise<void> {
  const app = createServer({
    logger: false,
    esi: live
      ? createEsi({
          userAgent: 'eve-fabric-demo/0.2 (+https://github.com/lgriffin/eve-fabric)',
          compatibilityDate: COMPATIBILITY_DATE,
        })
      : tranquilityEsi().esi,
    sde: createStaticSource(tranquilitySde()),
  });
  const base = await app.listen({ port: 0, host: '127.0.0.1' });
  printLine(`Gateway on ${base} (${live ? 'live ESI' : 'offline Tranquility fixture'})`);

  async function api<T>(method: string, path: string, body?: unknown): Promise<Response<T>> {
    const res = await fetch(
      `${base}${path}`,
      body === undefined
        ? { method }
        : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    );
    const text = await res.text();
    const json = res.headers.get('content-type')?.includes('json') === true;
    return { status: res.status, data: (json ? JSON.parse(text) : text) as T };
  }

  function expectOk<T>(what: string, res: Response<T>): T {
    if (res.status >= 300) {
      throw new Error(`${what} answered ${String(res.status)}: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  }

  const subject = { kind: 'type', value: 'Tritanium' };
  const orders: Step[] = [{ kind: 'move', move: 'orders' }];

  try {
    section(1, 'GET /api/drafts/subjects');
    const subjects = expectOk(
      'subjects',
      await api<{ kinds: { kind: string }[] }>('GET', '/api/drafts/subjects'),
    );
    show(`a question starts from a ${subjects.kinds.map((k) => k.kind).join(', a ')}`);

    section(2, 'POST /api/drafts  { subject: Tritanium, steps: [orders] }');
    const draft = expectOk(
      'draft',
      await api<DraftView>('POST', '/api/drafts', { subject, steps: orders }),
    );
    show(`moves: ${draft.moves.map((m) => m.name).join(', ')}`);
    show(`holes: ${draft.holes.map((h) => h.name + ' (' + h.type + ')').join(', ')}`);

    section(3, 'POST /api/drafts/choices  { hole: region, text: "Forge" }');
    const { choices } = expectOk(
      'choices',
      await api<{ choices: { id: number; name: string }[] }>('POST', '/api/drafts/choices', {
        subject,
        steps: orders,
        hole: 'region',
        text: 'Forge',
      }),
    );
    show(choices.map((c) => `${c.name} (${String(c.id)})`).join(', '));

    section(4, 'POST /api/drafts/run  { …, fill region, apply prices }');
    const steps: Step[] = [
      ...orders,
      { kind: 'fill', hole: 'region', value: 'The Forge' },
      { kind: 'move', move: 'prices' },
    ];
    const run = expectOk(
      'run',
      await api<{ answer: unknown; view: DraftView }>('POST', '/api/drafts/run', {
        subject,
        steps,
      }),
    );
    show(`answer: ${JSON.stringify(run.answer)}`);
    show(
      `plan: ${String(run.view.plan?.steps.length)} steps, ${String(run.view.plan?.esiCalls)} ESI call(s)`,
    );
    const graphql = run.view.graphql ?? '';

    section(5, 'POST /api/drafts/run  { graphql }  (the saved form)');
    printLine(
      graphql
        .trimEnd()
        .split('\n')
        .map((l) => `     ${l}`)
        .join('\n'),
    );
    const again = expectOk(
      'run graphql',
      await api<{ answer: unknown }>('POST', '/api/drafts/run', { graphql }),
    );
    show(`same answer: ${JSON.stringify(again.answer)}`);

    section(6, 'POST /api/drafts/weave, then POST /api/weaves');
    const weave = expectOk(
      'weave',
      await api<string>('POST', '/api/drafts/weave', {
        graphql,
        weave: WEAVE,
      }),
    );
    show(`exported ${String(weave.split('\n').length)} lines of weave YAML`);
    // With FABRIC_DB set, a previous run's copy comes back on start; take it
    // out so this run adds the weave it just exported.
    const kept = await api<{ weaves: { id: string; version: string }[] }>('GET', '/api/weaves');
    if (kept.data.weaves.some((w) => w.id === WEAVE.id && w.version === WEAVE.version)) {
      expectOk('remove', await api('DELETE', `/api/weaves/${WEAVE.id}?version=${WEAVE.version}`));
      show(`removed the ${WEAVE.id}@${WEAVE.version} kept from an earlier run`);
    }
    const added = expectOk(
      'add',
      await api<{ id: string }>('POST', '/api/weaves', { document: weave }),
    );
    show(
      `added ${added.id}; GET /api/weaves lists ${JSON.stringify((await api<unknown>('GET', '/api/weaves')).data)}`,
    );

    section(7, "POST /api/drafts/run  { Pyerite, 'forge prices' }");
    const shared = expectOk(
      'shared',
      await api<{ answer: unknown }>('POST', '/api/drafts/run', {
        subject: { kind: 'type', value: 'Pyerite' },
        steps: [
          { kind: 'move', move: 'forge prices' },
          { kind: 'fill', hole: 'region', value: 'The Forge' },
        ],
      }),
    );
    show(`answer: ${JSON.stringify(shared.answer)}`);

    section(8, 'POST /api/drafts  { steps: [ordrs] }  (a typo)');
    const refused = await api<{ error: { code: string; message: string } }>('POST', '/api/drafts', {
      subject,
      steps: [{ kind: 'move', move: 'ordrs' }],
    });
    show(`${String(refused.status)} ${refused.data.error.code}: ${refused.data.error.message}`);

    printLine('\nThe same calls by hand are in examples/e2e-demo/README.md.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const log = stderrLogger();
  log.error(`The demo stopped: ${error instanceof Error ? error.message : String(error)}`);
  if (live) log.info('Run without --live to use the offline fixture.');
  process.exitCode = 1;
});
