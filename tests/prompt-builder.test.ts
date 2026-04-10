import { describe, it, expect } from 'vitest';
import { buildProducerPrompt, buildEvaluatorPrompt } from '../src/prompt-builder.js';
import type { Boulder, StackResult, Criterion } from '../src/types.js';

const template = 'You are Sisyphus, the producer.';

const boulder: Boulder = {
  name: 'migration-overview',
  description: 'Write a high-level overview of the data migration.',
  criteria: [
    { check: 'word-count', description: 'Must be at least 200 words', min: 200 },
    { check: 'contains-heading', description: 'Must include a heading for each phase', heading: 'Phase' },
  ],
};

const stackResults: StackResult[] = [
  { type: 'analysis', source: 'docs/migration-plan.md', data: 'Migration has three phases: Extract, Transform, Load.' },
];

const criterion: Criterion[] = boulder.criteria;

// --- buildProducerPrompt ---

describe('buildProducerPrompt', () => {
  it('includes template content', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    expect(result).toContain(template);
  });

  it('includes boulder description', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    expect(result).toContain(boulder.description);
  });

  it('includes stacked data', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    expect(result).toContain('Migration has three phases');
  });

  it('does NOT include criteria descriptions (isolation boundary)', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    // Neither criterion description must appear — Sisyphus must not see eval criteria
    for (const c of boulder.criteria) {
      expect(result).not.toContain(c.description);
    }
  });

  it('does NOT include criteria check names (isolation boundary)', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    // Check names like "word-count" must also be absent
    for (const c of boulder.criteria) {
      expect(result).not.toContain(c.check);
    }
  });

  it('includes climb feedback when retrying', () => {
    const feedback = 'The heading for Phase 2 was missing.';
    const result = buildProducerPrompt(template, boulder, stackResults, feedback);
    expect(result).toContain(feedback);
    expect(result).toContain('Previous Attempt Failed');
  });

  it('does NOT include climb feedback section when no feedback provided', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    expect(result).not.toContain('Previous Attempt Failed');
  });

  it('includes lessons when provided', () => {
    const lessons = 'Always include a heading for each migration phase.';
    const result = buildProducerPrompt(template, boulder, stackResults, undefined, lessons);
    expect(result).toContain(lessons);
    expect(result).toContain('Lessons Learned');
  });

  it('does NOT include lessons section when lessons are omitted', () => {
    const result = buildProducerPrompt(template, boulder, stackResults);
    expect(result).not.toContain('Lessons Learned');
  });
});

// --- buildEvaluatorPrompt ---

describe('buildEvaluatorPrompt', () => {
  const producedOutput = '# Migration Overview\n\nPhase 1: Extract data from source systems.\n\nPhase 2: Transform...';

  it('includes template content', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    expect(result).toContain(template);
  });

  it('includes the produced output', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    expect(result).toContain(producedOutput);
  });

  it('includes criteria descriptions', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    for (const c of criterion) {
      expect(result).toContain(c.description);
    }
  });

  it('does NOT include boulder description (isolation boundary)', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    // Hades must not see the producer's goal/brief
    expect(result).not.toContain(boulder.description);
  });

  it('includes stacked data for cross-reference', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    expect(result).toContain('Migration has three phases');
  });

  it('includes lessons when provided', () => {
    const lessons = 'Be adversarial about missing headings.';
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults, lessons);
    expect(result).toContain(lessons);
    expect(result).toContain('Lessons Learned');
  });

  it('does NOT include lessons section when lessons are omitted', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    expect(result).not.toContain('Lessons Learned');
  });

  it('instructs Hades to return a JSON array', () => {
    const result = buildEvaluatorPrompt(template, producedOutput, criterion, stackResults);
    expect(result).toContain('JSON array');
  });
});
