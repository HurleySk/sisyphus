import path from 'path';
import { pathToFileURL } from 'url';
import type { Spec, BoulderOutput, RunReport, CheckResult, Layer } from './types.js';
import { stack } from './stack.js';
import { start } from './start.js';
import { CheckRegistry } from './checks.js';
import { loadLessons, filterLessons, formatLessonsForPrompt } from './lessons.js';
import { buildReport } from './report.js';
import type { TypedEmitter, SisyphusEvents } from './events.js';

// Layer discovery — dynamic import from layers/{layerName}/index.js
async function loadLayer(layerName: string): Promise<Layer> {
  const layerPath = path.join(import.meta.dirname, '..', 'layers', layerName, 'index.js');
  const mod = await import(pathToFileURL(layerPath).href);
  const LayerClass = mod.DocumentationLayer ?? mod.default;
  return new LayerClass();
}

export async function runSpec(
  spec: Spec,
  options?: {
    baseDir?: string;
    lessonsDir?: string;
    verbose?: boolean;
    emitter?: TypedEmitter<SisyphusEvents>;
  },
): Promise<RunReport> {
  const baseDir = options?.baseDir ?? process.cwd();
  const lessonsDir = options?.lessonsDir ?? path.join(import.meta.dirname, '..', 'lessons');
  const startedAt = new Date().toISOString();
  const emitter = options?.emitter;

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

  emitter?.emit('run:start', { title: spec.title, layer: spec.layer, totalBoulders: spec.boulders.length, maxRetries });

  // Boulder loop (Thanatos enforces)
  for (const boulder of spec.boulders) {
    try {
      const boulderStart = Date.now();
      const boulderMaxRetries = boulder.maxRetries ?? maxRetries;
      let lastOutput = '';
      let lastFailures: CheckResult[] = [];
      let climbFeedback: string | undefined;
      let passed = false;

      emitter?.emit('boulder:start', {
        name: boulder.name,
        index: spec.boulders.indexOf(boulder),
        total: spec.boulders.length,
        maxAttempts: boulderMaxRetries + 1,
      });

      // Stack data (once per boulder)
      log(`[${boulder.name}] Stacking...`);
      emitter?.emit('stack:start', { boulderName: boulder.name, sourceCount: boulder.stack?.length ?? 0 });
      const stackResults = await stack(boulder.stack, baseDir);
      log(`[${boulder.name}] Stack complete (${stackResults.length} sources)`);
      emitter?.emit('stack:end', { boulderName: boulder.name, resultCount: stackResults.length });

      for (let attempt = 0; attempt <= boulderMaxRetries; attempt++) {
        log(`[${boulder.name}] Attempt ${attempt + 1}/${boulderMaxRetries + 1} — producing...`);

        // Start Sisyphus (producer)
        emitter?.emit('produce:start', { boulderName: boulder.name, attempt, maxAttempts: boulderMaxRetries + 1, climbFeedback });
        const producerPrompt = layer.buildProducerPrompt(boulder, stackResults, climbFeedback, lessons || undefined);
        lastOutput = await start({ prompt: producerPrompt, model: 'sonnet' });
        emitter?.emit('produce:end', { boulderName: boulder.name, attempt, outputLength: lastOutput.length });

        // Descend: structural checks
        const structuralCriteria = boulder.criteria.filter(c => c.check !== 'custom');
        const customCriteria = boulder.criteria.filter(c => c.check === 'custom');

        emitter?.emit('evaluate:start', {
          boulderName: boulder.name,
          attempt,
          structuralCount: structuralCriteria.length,
          customCount: customCriteria.length,
        });

        const structuralResults = registry.runChecks(lastOutput, structuralCriteria);
        emitter?.emit('evaluate:structural', { boulderName: boulder.name, results: structuralResults });

        // Descend: Hades (custom criteria)
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

          emitter?.emit('evaluate:custom', { boulderName: boulder.name, results: customResults });
        }

        const allResults = [...structuralResults, ...customResults];
        const failures = allResults.filter(r => !r.pass);

        emitter?.emit('evaluate:end', { boulderName: boulder.name, attempt, passed: failures.length === 0, failures });

        if (failures.length === 0) {
          log(`[${boulder.name}] PASS on attempt ${attempt + 1}`);
          outputs.push({ name: boulder.name, content: lastOutput, attempts: attempt + 1, status: 'passed' });
          passed = true;
          emitter?.emit('boulder:end', { name: boulder.name, status: 'passed', attempts: attempt + 1, durationMs: Date.now() - boulderStart });
          break;
        }

        // Prepare climb feedback
        lastFailures = failures;
        climbFeedback = failures.map(f => `FAIL: ${f.criterion} — ${f.message}`).join('\n');
        log(`[${boulder.name}] FAIL — ${failures.length} issue(s): ${failures.map(f => f.criterion).join(', ')}`);
        if (attempt < boulderMaxRetries) {
          log(`[${boulder.name}] Climbing with feedback...`);
          emitter?.emit('climb', { boulderName: boulder.name, attempt, failures });
        }
      }

      if (!passed) {
        log(`[${boulder.name}] FLAGGED after ${boulderMaxRetries + 1} attempts`);
        outputs.push({
          name: boulder.name, content: lastOutput,
          attempts: boulderMaxRetries + 1, status: 'flagged', failures: lastFailures,
        });
        emitter?.emit('boulder:end', { name: boulder.name, status: 'flagged', attempts: boulderMaxRetries + 1, durationMs: Date.now() - boulderStart, failures: lastFailures });
      }
    } catch (err: any) {
      log(`[${boulder.name}] ERROR: ${err.message}`);
      const errorFailure: CheckResult = {
        criterion: 'execution',
        pass: false,
        message: `Boulder failed with error: ${err.message}`,
      };
      outputs.push({
        name: boulder.name,
        content: '',
        attempts: 1,
        status: 'flagged',
        failures: [errorFailure],
      });
      emitter?.emit('boulder:end', {
        name: boulder.name,
        status: 'flagged',
        attempts: 1,
        durationMs: 0,
        failures: [errorFailure],
      });
    }
  }

  // Assemble
  await layer.assemble(outputs, spec.output);

  // Build report
  const report = buildReport(spec.title, outputs);
  report.startedAt = startedAt;
  report.completedAt = new Date().toISOString();

  emitter?.emit('run:end', { report });

  return report;
}
