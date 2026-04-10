import fs from 'fs/promises';
import path from 'path';
import type { BoulderOutput } from '../../src/types.js';

export async function assembleDocument(outputs: BoulderOutput[], outputPath: string): Promise<void> {
  const sections = outputs.map(o => {
    if (o.status === 'passed') return o.content;
    return `<!-- FLAGGED: "${o.name}" did not pass after ${o.attempts} attempts. See run report for details. -->`;
  });
  const document = sections.join('\n\n---\n\n');
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, document, 'utf-8');
}
