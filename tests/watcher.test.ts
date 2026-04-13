import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileWatcher, gitDiffStat } from '../src/watcher.js';

describe('FileWatcher', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects new file creation', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-watcher-'));
    const watcher = new FileWatcher(tmpDir);
    const changes: any[] = [];
    watcher.on('change', (event) => changes.push(event));
    watcher.start();

    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'hello');
    await new Promise(r => setTimeout(r, 300));
    watcher.stop();

    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some(c => c.filePath.includes('test.txt'))).toBe(true);
  });

  it('ignores files matching ignore patterns', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-watcher-'));
    const gitDir = path.join(tmpDir, '.git');
    await fs.mkdir(gitDir);

    const watcher = new FileWatcher(tmpDir, { ignore: ['.git'] });
    const changes: any[] = [];
    watcher.on('change', (event) => changes.push(event));
    watcher.start();

    await fs.writeFile(path.join(gitDir, 'index'), 'data');
    await fs.writeFile(path.join(tmpDir, 'real.txt'), 'data');
    await new Promise(r => setTimeout(r, 300));
    watcher.stop();

    const gitChanges = changes.filter(c => c.filePath.includes('.git'));
    expect(gitChanges).toHaveLength(0);
  });

  it('stop() prevents further events', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-watcher-'));
    const watcher = new FileWatcher(tmpDir);
    const changes: any[] = [];
    watcher.on('change', (event) => changes.push(event));
    watcher.start();
    watcher.stop();

    await fs.writeFile(path.join(tmpDir, 'after-stop.txt'), 'data');
    await new Promise(r => setTimeout(r, 300));

    const afterStopChanges = changes.filter(c => c.filePath.includes('after-stop'));
    expect(afterStopChanges).toHaveLength(0);
  });
});

describe('gitDiffStat', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns a string without throwing', async () => {
    const result = await gitDiffStat(import.meta.dirname);
    expect(typeof result).toBe('string');
  });

  it('returns diff stat output for changed files', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sisyphus-diff-'));
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line 1\n');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line 1\nline 2\n');
    const result = await gitDiffStat(tmpDir);
    expect(result).toContain('file.txt');
  });
});
