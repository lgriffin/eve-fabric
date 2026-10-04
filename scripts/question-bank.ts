/**
 * The question bank: the project's progress number (constitution 2.0.0, FAB-BANK-01).
 *
 * Runs bank/features through cucumber, then counts the questions (Q1..Q8)
 * whose every scenario passed. bank/baseline.json lists the questions that
 * passed last time; the list is a ratchet. A listed question that stops
 * passing fails the run, and so does a newly passing question until the
 * baseline is regenerated with --update, so each gain is recorded in review.
 *
 * Run: pnpm run test:bank [--update]
 *
 * --live asks Tranquility's ESI instead of the fixture. The questions asked as
 * a character (Q6, Q7) need a token the fixture records and ESI will not take,
 * so they are skipped. The questions that follow a live id into the SDE (Q1 a
 * station, Q4 a route's systems, Q5 incursion systems) need a real SDE export
 * at SDE_DATA_PATH, and are skipped without one; the fixture's SDE knows only
 * the questions' own names. The rest must pass, and the baseline is not
 * touched. The nightly workflow runs it.
 */
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { log, print } from './lib/terminal.js';

const ROOT = join(import.meta.dirname, '..');
const MESSAGES = join(ROOT, 'reports', 'bank', 'messages.ndjson');
const BASELINE = join(ROOT, 'bank', 'baseline.json');
const QUESTIONS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
const LIVE = process.argv.includes('--live');
/** Asked as a character: the fixture's token means nothing to live ESI. */
const CHARACTER_QUESTIONS = ['Q6', 'Q7'];
/** Follow a live id into the SDE, so live they need a real export at SDE_DATA_PATH. */
const SDE_QUESTIONS = ['Q1', 'Q4', 'Q5'];
const HAS_SDE = process.env['SDE_DATA_PATH'] !== undefined;
const SKIPPED = new Map<string, string>(
  LIVE
    ? [
        ...CHARACTER_QUESTIONS.map((q) => [q, 'skipped (asked as a character)'] as const),
        ...(HAS_SDE
          ? []
          : SDE_QUESTIONS.map(
              (q) => [q, 'skipped (needs an SDE export: set SDE_DATA_PATH)'] as const,
            )),
      ]
    : [],
);
const ASKED = QUESTIONS.filter((q) => !SKIPPED.has(q));

interface Envelope {
  pickle?: { id: string; name: string; tags: { name: string }[] };
  testCase?: { id: string; pickleId: string };
  testCaseStarted?: { id: string; testCaseId: string };
  testStepFinished?: { testCaseStartedId: string; testStepResult: { status: string } };
}

function runCucumber(): void {
  mkdirSync(join(ROOT, 'reports', 'bank'), { recursive: true });
  // Never count a previous run's report.
  rmSync(MESSAGES, { force: true });
  const bin = join(ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');
  // Scenarios fail until every question passes, so exit 1 is expected; stderr
  // still reaches the log so a load error shows why.
  const skipped = [...SKIPPED.keys()].map((q) => '@' + q).join(' or ');
  const tags = SKIPPED.size > 0 ? ['--tags', `not (${skipped})`] : [];
  const result = spawnSync(process.execPath, [bin, '-c', 'cucumber.cjs', '-p', 'bank', ...tags], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: LIVE ? { ...process.env, BANK_LIVE: '1' } : process.env,
  });
  if (result.error !== undefined || result.signal !== null || (result.status ?? 2) > 1) {
    log.error(
      `question bank: cucumber did not complete (status ${String(result.status)}, signal ${String(result.signal)})`,
    );
    process.exit(1);
  }
  if (!existsSync(MESSAGES)) {
    log.error('question bank: cucumber produced no messages');
    process.exit(1);
  }
  const finished = readFileSync(MESSAGES, 'utf8')
    .split('\n')
    .some((line) => line.startsWith('{"testRunFinished"'));
  if (!finished) {
    log.error('question bank: cucumber report has no testRunFinished; the run was cut short');
    process.exit(1);
  }
}

function passingQuestions(): { passing: string[]; scenarios: Map<string, string[]> } {
  const pickles = new Map<string, { name: string; question: string }>();
  const caseToPickle = new Map<string, string>();
  const startedToCase = new Map<string, string>();
  const failedPickles = new Set<string>();
  const ranPickles = new Set<string>();

  for (const line of readFileSync(MESSAGES, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    const msg = JSON.parse(line) as Envelope;
    if (msg.pickle) {
      const question = msg.pickle.tags.map((t) => t.name.slice(1)).find((t) => /^Q\d+$/.test(t));
      if (question !== undefined) pickles.set(msg.pickle.id, { name: msg.pickle.name, question });
    } else if (msg.testCase) {
      caseToPickle.set(msg.testCase.id, msg.testCase.pickleId);
    } else if (msg.testCaseStarted) {
      startedToCase.set(msg.testCaseStarted.id, msg.testCaseStarted.testCaseId);
    } else if (msg.testStepFinished) {
      const pickleId = caseToPickle.get(
        startedToCase.get(msg.testStepFinished.testCaseStartedId) ?? '',
      );
      if (pickleId === undefined) continue;
      ranPickles.add(pickleId);
      if (msg.testStepFinished.testStepResult.status !== 'PASSED') failedPickles.add(pickleId);
    }
  }

  const scenarios = new Map<string, string[]>();
  const failing = new Set<string>();
  for (const [id, { name, question }] of pickles) {
    scenarios.set(question, [...(scenarios.get(question) ?? []), name]);
    if (failedPickles.has(id) || !ranPickles.has(id)) failing.add(question);
  }
  const passing = ASKED.filter((q) => scenarios.has(q) && !failing.has(q));
  return { passing, scenarios };
}

function main(): void {
  runCucumber();
  const { passing, scenarios } = passingQuestions();
  const missing = ASKED.filter((q) => !scenarios.has(q));
  if (missing.length > 0) {
    log.error(`question bank: no scenarios for ${missing.join(', ')}`);
    process.exit(1);
  }

  const state = (q: string): string => {
    const skipped = SKIPPED.get(q);
    if (skipped !== undefined) return skipped;
    if (passing.includes(q)) return 'passes';
    return LIVE ? 'fails' : 'not yet';
  };
  const title = LIVE ? 'bank (live ESI)' : 'bank';
  const line = `${title}: ${passing.length} of ${ASKED.length}`;
  const table = QUESTIONS.map((q) => `| ${q} | ${state(q)} |`);
  print(line);
  for (const row of table) print(row);
  const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryPath !== undefined) {
    appendFileSync(
      summaryPath,
      [
        `## Question ${title}: ${passing.length} of ${ASKED.length}`,
        '',
        '| Question | State |',
        '|---|---|',
        ...table,
        '',
      ].join('\n'),
    );
  }

  if (LIVE) {
    // Live answers are checked for shape, not recorded: every question asked must pass.
    const failed = ASKED.filter((q) => !passing.includes(q));
    for (const q of failed) log.error(`question bank: ${q} fails against live ESI`);
    if (failed.length > 0) process.exit(1);
    return;
  }

  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify({ passing }, null, 2)}\n`);
    print('question bank: baseline updated');
    return;
  }

  const baseline = (JSON.parse(readFileSync(BASELINE, 'utf8')) as { passing: string[] }).passing;
  const lost = baseline.filter((q) => !passing.includes(q));
  const gained = passing.filter((q) => !baseline.includes(q));
  for (const q of lost) log.error(`question bank: ${q} passed before and fails now`);
  for (const q of gained) log.error(`question bank: ${q} passes now; record it with --update`);
  if (lost.length > 0 || gained.length > 0) process.exit(1);
}

main();
