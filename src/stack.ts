import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { start } from './start.js';
import type { StackSource, StackResult } from './types.js';

const LARGE_FILE_THRESHOLD = 200;

export async function stack(
  sources: StackSource[] | undefined,
  baseDir: string,
): Promise<StackResult[]> {
  if (!sources || sources.length === 0) return [];

  const results: StackResult[] = [];

  for (const source of sources) {
    if (source.type === 'analysis') {
      const sourcePattern = source.source ?? '';
      const resolvedPattern = path.isAbsolute(sourcePattern)
        ? sourcePattern
        : path.join(baseDir, sourcePattern);

      // Glob requires forward slashes on all platforms (Windows uses backslashes)
      const globPattern = resolvedPattern.split(path.sep).join('/');
      const matches = await glob(globPattern, { nodir: true });

      for (const filePath of matches) {
        const content = await fs.readFile(filePath, 'utf8');
        const lineCount = content.split('\n').length;

        let data: string;
        if (lineCount <= LARGE_FILE_THRESHOLD) {
          data = content;
        } else {
          const instruction = source.instruction ?? 'Extract all relevant information from this file.';
          const prompt = `${instruction}\n\nFile: ${filePath}\n\n${content}`;
          data = await start({ prompt, model: 'haiku' });
        }

        results.push({ type: 'analysis', source: filePath, data });
      }
    } else {
      console.warn(`[stack] Stack type "${source.type}" is not supported — skipping.`);
      results.push({
        type: source.type,
        source: String(source.source ?? source.type),
        data: `Stack type "${source.type}" is not supported in this engine version.`,
      });
    }
  }

  return results;
}
