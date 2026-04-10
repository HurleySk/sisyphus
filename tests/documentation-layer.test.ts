import { describe, it, expect } from 'vitest';
import { DocumentationLayer } from '../layers/documentation/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const layer = new DocumentationLayer();

describe('DocumentationLayer', () => {
  it('has name "documentation"', () => { expect(layer.name).toBe('documentation'); });

  it('validates a valid spec', () => {
    const result = layer.validateSpec({
      title: 'T', layer: 'documentation', output: 'o.md',
      boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'contains-table', description: 'ok' }] }],
    });
    expect(result.valid).toBe(true);
  });

  it('registers all structural checks', () => {
    const checks = layer.getChecks();
    expect(checks.has('contains-table')).toBe(true);
    expect(checks.has('row-count-gte')).toBe(true);
    expect(checks.has('row-count-lte')).toBe(true);
    expect(checks.has('contains-heading')).toBe(true);
    expect(checks.has('word-count-gte')).toBe(true);
    expect(checks.has('word-count-lte')).toBe(true);
  });

  it('builds producer prompt without criteria', () => {
    const boulder = { name: 'Test', description: 'Write a test section',
      criteria: [{ check: 'custom', description: 'SECRET CRITERION' }] };
    const stack = [{ type: 'analysis', source: 'f.json', data: '{}' }];
    const prompt = layer.buildProducerPrompt(boulder, stack);
    expect(prompt).toContain('Write a test section');
    expect(prompt).not.toContain('SECRET CRITERION');
  });

  it('builds evaluator prompt with criteria but without description', () => {
    const criteria = [{ check: 'custom', description: 'Content must be accurate' }];
    const stack = [{ type: 'analysis', source: 'f.json', data: '{}' }];
    const prompt = layer.buildEvaluatorPrompt('some markdown', criteria, stack);
    expect(prompt).toContain('Content must be accurate');
    expect(prompt).toContain('some markdown');
  });

  it('assembles boulder outputs into a document', async () => {
    const outputs = [
      { name: 'Intro', content: '# Introduction\n\nHello world.', attempts: 1, status: 'passed' as const },
      { name: 'Details', content: '# Details\n\nMore info.', attempts: 1, status: 'passed' as const },
    ];
    const outPath = path.join(os.tmpdir(), `sisyphus-test-doc-${Date.now()}.md`);
    await layer.assemble(outputs, outPath);
    const content = await fs.readFile(outPath, 'utf-8');
    expect(content).toContain('# Introduction');
    expect(content).toContain('# Details');
    await fs.unlink(outPath);
  });

  it('inserts placeholder comment for flagged boulders in assembled output', async () => {
    const outputs = [
      { name: 'Intro', content: '# Introduction\n\nHello world.', attempts: 1, status: 'passed' as const },
      { name: 'Broken Section', content: '', attempts: 3, status: 'flagged' as const },
      { name: 'Details', content: '# Details\n\nMore info.', attempts: 1, status: 'passed' as const },
    ];
    const outPath = path.join(os.tmpdir(), `sisyphus-test-doc-flagged-${Date.now()}.md`);
    await layer.assemble(outputs, outPath);
    const content = await fs.readFile(outPath, 'utf-8');
    // Passed sections appear as content
    expect(content).toContain('# Introduction');
    expect(content).toContain('# Details');
    // Flagged section appears as a placeholder HTML comment
    expect(content).toContain('<!-- FLAGGED:');
    expect(content).toContain('"Broken Section"');
    expect(content).toContain('3 attempts');
    await fs.unlink(outPath);
  });
});
