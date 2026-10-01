import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildIndex,
  directoryIndex,
  gitIndex,
  publishWeave,
  sealWeave,
  WeaveNotFoundError,
} from '../src/index.js';
import { body } from './fixtures.js';

const scratch = () => mkdtempSync(join(tmpdir(), 'index-'));

describe('a directory of weaves as the index', () => {
  it('finds the newest version a range accepts', async () => {
    const root = scratch();
    await publishWeave(root, sealWeave(body));
    await publishWeave(root, sealWeave({ ...body, version: '1.4.0' }));
    await publishWeave(root, sealWeave({ ...body, version: '2.0.0' }));
    const index = directoryIndex(root);
    expect((await index.resolve('someone.spread@^1')).version).toBe('1.4.0');
    expect((await index.resolve('someone.spread@1.0.0')).version).toBe('1.0.0');
    expect((await index.resolve('someone.spread')).version).toBe('2.0.0');
    await expect(index.resolve('someone.spread@^3')).rejects.toThrow(WeaveNotFoundError);
    await expect(index.resolve('someone.else')).rejects.toThrow(WeaveNotFoundError);
    const listed = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')) as {
      weaves: Record<string, Record<string, unknown>>;
    };
    expect(Object.keys(listed.weaves['someone.spread']!)).toEqual(['1.0.0', '1.4.0', '2.0.0']);
  });

  it('refuses a file the index does not vouch for', async () => {
    const root = scratch();
    const path = await publishWeave(root, sealWeave(body));
    // Replaced by another, self-consistent weave without regenerating the index.
    const other = sealWeave({ ...body, description: 'Something else' });
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(/digest: .*/, `digest: ${other.digest}`),
    );
    writeFileSync(path, readFileSync(path, 'utf8').replace(body.description, 'Something else'));
    await expect(directoryIndex(root).resolve('someone.spread')).rejects.toThrow(/disagree/);
    await buildIndex(root);
    expect((await directoryIndex(root).resolve('someone.spread')).description).toBe(
      'Something else',
    );
  });

  it('reads a git repository as the index', async () => {
    const root = scratch();
    await publishWeave(root, sealWeave(body));
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the git on PATH, as gitIndex uses
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root });
    git('init', '--quiet', '--initial-branch', 'main');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '--quiet', '-m', 'w');
    const index = await gitIndex(root, 'main');
    expect((await index.resolve('someone.spread@^1')).digest).toBe(sealWeave(body).digest);
  });
});
