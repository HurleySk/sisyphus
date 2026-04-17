import { watch, type FSWatcher } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { EventEmitter } from 'events';
import { toForwardSlashes } from './path-utils.js';

const execFileAsync = promisify(execFile);

export async function gitDiffStat(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--stat'], { cwd, timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

export interface FileChangeEvent {
  filePath: string;
  changeType: 'A' | 'M';
}

export interface WatcherOptions {
  ignore?: string[];
}

const DEFAULT_IGNORE = ['.git', 'node_modules', 'dist', '.superpowers'];

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private ee = new EventEmitter();
  private baseDir: string;
  private ignorePatterns: string[];
  private knownFiles = new Set<string>();

  constructor(baseDir: string, options?: WatcherOptions) {
    this.baseDir = baseDir;
    this.ignorePatterns = options?.ignore ?? DEFAULT_IGNORE;
  }

  on(event: 'change', handler: (payload: FileChangeEvent) => void): this {
    this.ee.on(event, handler);
    return this;
  }

  start(): void {
    try {
      this.watcher = watch(this.baseDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const normalized = toForwardSlashes(filename);
        for (const pattern of this.ignorePatterns) {
          if (normalized.startsWith(pattern + '/') || normalized === pattern) return;
        }
        const fullPath = path.join(this.baseDir, filename);
        const changeType = this.knownFiles.has(fullPath) ? 'M' as const : 'A' as const;
        this.knownFiles.add(fullPath);
        this.ee.emit('change', { filePath: normalized, changeType });
      });
    } catch {
      // fs.watch may not support recursive on all platforms — degrade silently
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
