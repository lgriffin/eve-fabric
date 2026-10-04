/**
 * pnpm workbench: the gateway over the offline Tranquility fixture, and the
 * designer against it, so the whole designer works with no ESI access and no
 * SDE download. `--live` uses Tranquility's ESI (names still come from the
 * fixture); `--no-designer` starts the gateway alone.
 *
 * Gateway: http://localhost:3456 (PORT to change). Designer: http://localhost:5173
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { z } from 'zod';
import { createStaticSource } from '@eve-fabric/source-sde';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { createServer } from '../apps/gateway/src/server.js';
import { log, print } from './lib/terminal.js';

const live = process.argv.includes('--live');
const DESIGNER = join(import.meta.dirname, '..', 'apps', 'designer');

async function main(): Promise<void> {
  const parsedPort = z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .safeParse(process.env['PORT'] ?? 3456);
  if (!parsedPort.success) {
    throw new Error(
      `PORT must be a port number from 1 to 65535, not "${String(process.env['PORT'])}"`,
    );
  }
  const port = parsedPort.data;
  const app = createServer({
    logger: false,
    ...(live ? {} : { esi: tranquilityEsi().esi }),
    sde: createStaticSource(tranquilitySde()),
  });
  await app.listen({ port, host: '127.0.0.1' });
  print(
    `Gateway on http://localhost:${String(port)} (${live ? 'live ESI' : 'offline Tranquility fixture'})`,
  );
  print('  The fixture knows Tritanium, Pyerite, Mexallon, Isogen, Rifter; The Forge, Domain;');
  print('  Jita, Perimeter, Urlen, Sivala, Amarr.');

  const designer = process.argv.includes('--no-designer')
    ? undefined
    : spawn(process.execPath, [join(DESIGNER, 'node_modules', 'vite', 'bin', 'vite.js')], {
        cwd: DESIGNER,
        stdio: 'inherit',
        // The designer's /api proxy goes wherever the gateway listens.
        env: { ...process.env, GATEWAY_URL: `http://127.0.0.1:${String(port)}` },
      });

  let stopping = false;
  /** Stops both, once; a designer that crashed makes the workbench fail too. */
  const stop = (code: number): void => {
    if (stopping) return;
    stopping = true;
    designer?.kill();
    void app.close().then(() => process.exit(code));
  };
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  designer?.on('exit', (code) => stop(code ?? 0));
}

main().catch((error: unknown) => {
  log.error('the workbench did not start', { error });
  process.exitCode = 1;
});
