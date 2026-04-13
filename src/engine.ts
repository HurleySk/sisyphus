import path from 'path';
import { pathToFileURL } from 'url';
import type { Spec, BoulderOutput, RunReport, CheckResult, Layer } from './types.js';
import { stack } from './stack.js';
import { start } from './start.js';
import { CheckRegistry } from './checks.js';
import { loadLessons, filterLessons, formatLessonsForPrompt } from './lessons.js';
import { buildReport } from './report.js';

// Layer discovery — dynamic import from layers/{layerName}/index.js
async function loadLayer(layerName: string): Promise<Layer> {
  const layerPath = path.join(import.meta.dirname, '..', 'layers', layerName, 'index.js');
  const mod = await import(pathToFileURL(layerPath).href);
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
  const verbose = options?.verbose ?? false;
  const log = (msg: string) => { if (verbose) console.log(msg); };

  // Boulder loop (Thanatos enforces)
  for (const boulder of spec.boulders) {
    try {
      const boulderMaxRetries = boulder.maxRetries ?? maxRetries;
      let lastOutput = '';
      let lastFailures: CheckResult[] = [];
      let climbFeedback: string | undefined;
      let passed = false;

      // Stack data (once per boulder)
      log(`[${boulder.name}] Stacking...`);
      const stackResults = await stack(boulder.stack, baseDir);
      log(`[${boulder.name}] Stack complete (${stackResults.length} sources)`);

      for (let attempt = 0; attempt <= boulderMaxRetries; attempt++) {
        log(`[${boulder.name}] Attempt ${attempt + 1}/${boulderMaxRetries + 1} — producing...`);

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
          log(`[${boulder.name}] Evaluating (${structuralCriteria.length} structural, ${customCriteria.length} custom)...`);
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
            } else {
              // Non-array JSON = fail all custom criteria
              customResults = [{
                criterion: 'Hades evaluation',
                pass: false,
                message: `Hades returned non-array JSON: ${evalRaw.slice(0, 200)}`,
              }];
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
          log(`[${boulder.name}] PASS on attempt ${attempt + 1}`);
          outputs.push({ name: boulder.name, content: lastOutput, attempts: attempt + 1, status: 'passed' });
          passed = true;
          break;
        }

        // Prepare climb feedback
        lastFailures = failures;
        climbFeedback = failures.map(f => `FAIL: ${f.criterion} — ${f.message}`).join('\n');
        log(`[${boulder.name}] FAIL — ${failures.length} issue(s): ${failures.map(f => f.criterion).join(', ')}`);
        if (attempt < boulderMaxRetries) {
          log(`[${boulder.name}] Climbing with feedback...`);
        }
      }

      if (!passed) {
        log(`[${boulder.name}] FLAGGED after ${boulderMaxRetries + 1} attempts`);
        outputs.push({
          name: boulder.name, content: lastOutput,
          attempts: boulderMaxRetries + 1, status: 'flagged', failures: lastFailures,
        });
      }
    } catch (err: any) {
      log(`[${boulder.name}] ERROR: ${err.message}`);
      outputs.push({
        name: boulder.name,
        content: '',
        attempts: 1,
        status: 'flagged',
        failures: [{
          criterion: 'execution',
          pass: false,
          message: `Boulder failed with error: ${err.message}`,
        }],
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
