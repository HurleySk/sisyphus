import { readFileSync } from 'fs';
import path from 'path';
import type { Spec, Boulder, StackResult, Criterion, BoulderOutput, Layer, ValidationResult, CheckFn } from '../../src/types.js';
import { getDocumentationChecks } from './checks/index.js';
import { assembleDocument } from './assembler.js';
import { buildProducerPrompt as coreBuildProducer, buildEvaluatorPrompt as coreBuildEvaluator } from '../../src/prompt-builder.js';

const promptsDir = path.join(import.meta.dirname, 'prompts');

function loadTemplate(name: string): string {
  return readFileSync(path.join(promptsDir, name), 'utf-8');
}

export class DocumentationLayer implements Layer {
  name = 'documentation';
  private producerTemplate: string;
  private evaluatorTemplate: string;

  constructor() {
    this.producerTemplate = loadTemplate('sisyphus.md');
    this.evaluatorTemplate = loadTemplate('hades.md');
  }

  validateSpec(spec: Spec): ValidationResult {
    const errors: string[] = [];
    for (const boulder of spec.boulders) {
      if (boulder.criteria.length === 0) {
        errors.push(`Boulder "${boulder.name}" has no criteria`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  getChecks(): Map<string, CheckFn> {
    return getDocumentationChecks();
  }

  buildProducerPrompt(boulder: Boulder, stackResults: StackResult[], feedback?: string, lessons?: string): string {
    return coreBuildProducer(this.producerTemplate, boulder, stackResults, feedback, lessons);
  }

  buildEvaluatorPrompt(output: string, criteria: Criterion[], stackResults: StackResult[], lessons?: string): string {
    return coreBuildEvaluator(this.evaluatorTemplate, output, criteria, stackResults, lessons);
  }

  async assemble(outputs: BoulderOutput[], outputPath: string): Promise<void> {
    await assembleDocument(outputs, outputPath);
  }
}
