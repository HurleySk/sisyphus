import path from 'path';
import type { Spec, BoulderOutput, RunReport, CheckResult, Layer } from './types.js';
import { stack } from './stack.js';
import { start } from './start.js';
import { CheckRegistry } from './checks.js';
import { loadLessons, filterLessons, formatLessonsForPrompt } from './lessons.js';
import { buildReport } from './report.js';

// Layer discovery — dynamic import from layers/{layerName}/index.js
async function loadLayer(layerName: string): Promise<Layer> {
  const layerPath = path.join(import.meta.dirname, '..', 'layers', layerName, 'index.js');
  const mod = await import(layerPath);
  const LayerClass = mod.DocumentationLayer ?? mod.default;
  return new LayerClass();
}

export async function runSpec(spec: Spec, options?: { baseDir?: string; lessonsDir?: string; verbose?: boolean }): Promise<RunReport> {
  const baseDir = options?.baseDir ?? process.cwd();
  const lessonsDir = options?.lessonsDir ?? path.join(import.meta.dirname, '..', 'lessons');
  const startedAt = new Date().toISOString();

  // Load layer
  const layer = await loadLayer(spec.layer);

  // Validate with layer
  const validation = layer.validateSpec(spec);
  if (!validation.valid) throw new Error(`Layer validation failed:\n${validation.errors.join('\n')}`);

  // Set up check registry
  const registry = new CheckRegistry();
  registry.registerAll(layer.getChecks());

  // Load lessons
  let lessons = '';
  try {
    const allLessons = await loadLessons(lessonsDir, spec.layer);
    if (allLessons.length > 0) {
      const sorted = filterLessons(allLessons, []);
      lessons = formatLessonsForPrompt(sorted);
    }
  } catch { /* No lessons — continue */ }

  const maxRetries = spec.maxRetries ?? 3;
  const outputs: BoulderOutput[] = [];

  // Boulder loop (Thanatos enforces)
  for (const boulder of spec.boulders) {
    const boulderMaxRetries = boulder.maxRetries ?? maxRetries;
    let lastOutput = '';
    let lastFailures: CheckResult[] = [];
    let climbFeedback: string | undefined;
    let passed = false;

    // Stack data (once per boulder)
    const stackResults = await stack(boulder.stack, baseDir);

    for (let attempt = 0; attempt <= boulderMaxRetries; attempt++) {
      // Start Sisyphus (producer)
      const producerPrompt = layer.buildProducerPrompt(boulder, stackResults, climbFeedback, lessons || undefined);
      lastOutput = await start({ prompt: producerPrompt, model: 'sonnet' });

      // Descend: structural checks
      const structuralCriteria = boulder.criteria.filter(c => c.check !== 'custom');
      const structuralResults = registry.runChecks(lastOutput, structuralCriteria);

      // Descend: Hades (custom criteria)
      const customCriteria = boulder.criteria.filter(c => c.check === 'custom');
      let customResults: CheckResult[] = [];

      if (customCriteria.length > 0) {
        const evaluatorPrompt = layer.buildEvaluatorPrompt(lastOutput, customCriteria, stackResults, lessons || undefined);
        const evalRaw = await start({ prompt: evaluatorPrompt, model: 'sonnet', outputFormat: 'json' });

        try {
          const evalParsed = JSON.parse(evalRaw);
          if (Array.isArray(evalParsed)) {
            customResults = evalParsed.map((r: any) => ({
              criterion: r.criterion ?? 'unknown',
              pass: Boolean(r.pass),
              message: r.reason ?? r.message ?? '',
            }));
          }
        } catch {
          customResults = [{
            criterion: 'Hades evaluation',
            pass: false,
            message: `Failed to parse Hades response: ${evalRaw.slice(0, 200)}`,
          }];
        }
      }

      const allResults = [...structuralResults, ...customResults];
      const failures = allResults.filter(r => !r.pass);

      if (failures.length === 0) {
        outputs.push({ name: boulder.name, content: lastOutput, attempts: attempt + 1, status: 'passed' });
        passed = true;
        break;
      }

      // Prepare climb feedback
      lastFailures = failures;
      climbFeedback = failures.map(f => `FAIL: ${f.criterion} — ${f.message}`).join('\n');
    }

    if (!passed) {
      outputs.push({
        name: boulder.name, content: lastOutput,
        attempts: boulderMaxRetries + 1, status: 'flagged', failures: lastFailures,
      });
    }
  }

  // Assemble
  await layer.assemble(outputs, spec.output);

  // Build report
  const report = buildReport(spec.title, outputs);
  report.startedAt = startedAt;
  report.completedAt = new Date().toISOString();

  return report;
}
