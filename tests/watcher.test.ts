import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileWatcher } from '../src/watcher.js';

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
