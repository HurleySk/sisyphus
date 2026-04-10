import fs from 'fs/promises';
import path from 'path';
import type { BoulderOutput } from '../../src/types.js';

export async function assembleDocument(outputs: BoulderOutput[], outputPath: string): Promise<void> {
  const sections = outputs
    .filter(o => o.status === 'passed')
    .map(o => o.content);
  const document = sections.join('\n\n---\n\n');
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, document, 'utf-8');
}
