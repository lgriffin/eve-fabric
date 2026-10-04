import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runQuickstart } from './quickstart.js';

/**
 * The quickstart is the first thing a newcomer runs, so it runs here too:
 * compose, ask, save as GraphQL, reopen, share as a weave and add it to a
 * second fabric, all over the offline Tranquility fixture.
 */
describe('quickstart', () => {
  let outDir: string | undefined;
  afterEach(() => {
    if (outDir !== undefined) rmSync(outDir, { recursive: true, force: true });
  });

  it('asks, saves, reopens and shares a question end to end', async () => {
    outDir = mkdtempSync(join(tmpdir(), 'quickstart-'));
    const lines: string[] = [];
    const result = await runQuickstart({ outDir, print: (line) => lines.push(line) });

    expect(result.answer).toBe(8_100_000);
    expect(result.reopenedAnswer).toBe(result.answer);
    expect(result.sharedAnswer).toBe(95_000);
    expect(readFileSync(result.graphqlPath, 'utf8')).toContain('costToBuy(quantity: 2000000)');
    expect(readFileSync(result.weavePath, 'utf8')).toContain('quickstart.cost.to.buy: ^1.0.0');
    // The refusals it shows are named and say what would work.
    const output = lines.join('\n');
    expect(output).toContain('WeaveRequirementError: The weave requires quickstart.cost.to.buy');
    expect(output).toContain('"ordrs" is not a move this draft offers. Did you mean "orders"?');
  });
});
