import path from 'path';
import { pathToFileURL } from 'url';
import type { Spec, Boulder, BoulderOutput, RunReport, CheckResult, Layer } from './types.js';
import { stack } from './stack.js';
import { start } from './start.js';
import { CheckRegistry } from './checks.js';
import { loadLessons, filterLessons, formatLessonsForPrompt } from './lessons.js';
import { buildReport } from './report.js';
import type { TypedEmitter, SisyphusEvents } from './events.js';
import { FileWatcher, gitDiffStat } from './watcher.js';

/** Parse Hades' JSON response into structured CheckResults. */
function parseEvaluatorResponse(raw: string): CheckResult[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [{
        criterion: 'Hades evaluation',
        pass: false,
        message: `Hades returned non-array JSON: ${raw.slice(0, 200)}`,
      }];
    }
    return parsed.map((r: Record<string, unknown>) => ({
      criterion: (r.criterion as string) ?? 'unknown',
      pass: Boolean(r.pass),
      message: String(r.reason ?? r.message ?? ''),
    }));
  } catch {
    return [{
      criterion: 'Hades evaluation',
      pass: false,
      message: `Failed to parse Hades response: ${raw.slice(0, 200)}`,
    }];
  }
}

// Layer discovery — dynamic import from layers/{layerName}/index.js
async function loadLayer(layerName: string): Promise<Layer> {
  const layerPath = path.join(import.meta.dirname, '..', 'layers', layerName, 'index.js');
  const mod = await import(pathToFileURL(layerPath).href);
  const LayerClass = mod.DocumentationLayer ?? mod.default;
  return new LayerClass();
}

interface BoulderContext {
  index: number;
  total: number;
  maxRetries: number;
  baseDir: string;
  lessons: string;
  layer: Layer;
  registry: CheckRegistry;
  emitter?: TypedEmitter<SisyphusEvents>;
  log: (msg: string) => void;
}

async function processBoulder(boulder: Boulder, ctx: BoulderContext): Promise<BoulderOutput> {
  const { maxRetries, baseDir, lessons, layer, registry, emitter, log } = ctx;
  const boulderStart = Date.now();

  try {
    emitter?.emit('boulder:start', {
      name: boulder.name,
      index: ctx.index,
      total: ctx.total,
      maxAttempts: maxRetries + 1,
      description: boulder.description,
      criteriaDescriptions: boulder.criteria.map(c => c.description),
    });

    // Stack data (once per boulder)
    log(`[${boulder.name}] Stacking...`);
    emitter?.emit('stack:start', { boulderName: boulder.name, sourceCount: boulder.stack?.length ?? 0 });
    const stackResults = await stack(boulder.stack, baseDir, emitter, boulder.name);
    log(`[${boulder.name}] Stack complete (${stackResults.length} sources)`);
    emitter?.emit('stack:end', { boulderName: boulder.name, resultCount: stackResults.length });

    let lastOutput = '';
    let lastFailures: CheckResult[] = [];
    let climbFeedback: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      log(`[${boulder.name}] Attempt ${attempt + 1}/${maxRetries + 1} — producing...`);

      // Start Sisyphus (producer)
      emitter?.emit('produce:start', { boulderName: boulder.name, attempt, maxAttempts: maxRetries + 1, climbFeedback });
      const producerPrompt = layer.buildProducerPrompt(boulder, stackResults, climbFeedback, lessons || undefined);

      // Start file watcher (if emitter)
      let fileWatcher: FileWatcher | undefined;
      if (emitter) {
        fileWatcher = new FileWatcher(baseDir);
        fileWatcher.on('change', (event) => {
          emitter.emit('produce:file-change', {
            boulderName: boulder.name,
            filePath: event.filePath,
            changeType: event.changeType,
          });
        });
        fileWatcher.start();
      }

      let streamBuf = '';
      lastOutput = await start({
        prompt: producerPrompt,
        model: 'sonnet',
        onStream: emitter ? (event) => {
          if (event.type === 'thinking') {
            emitter.emit('produce:thinking', { boulderName: boulder.name });
          } else if (event.type === 'text') {
            streamBuf += event.text;
            const parts = streamBuf.split('\n');
            streamBuf = parts.pop()!;
            for (const line of parts) {
              emitter.emit('produce:stream', { boulderName: boulder.name, line });
            }
          }
        } : undefined,
      });

      // Flush remaining buffer
      if (emitter && streamBuf.length > 0) {
        emitter.emit('produce:stream', { boulderName: boulder.name, line: streamBuf });
      }

      // Stop file watcher + emit diff
      if (fileWatcher) {
        fileWatcher.stop();
        const diff = await gitDiffStat(baseDir);
        if (diff) {
          emitter?.emit('produce:diff', { boulderName: boulder.name, attempt, diff });
        }
      }

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
        customResults = parseEvaluatorResponse(evalRaw);
        emitter?.emit('evaluate:custom', { boulderName: boulder.name, results: customResults });
      }

      const allResults = [...structuralResults, ...customResults];
      const failures = allResults.filter(r => !r.pass);

      emitter?.emit('evaluate:end', { boulderName: boulder.name, attempt, passed: failures.length === 0, failures });

      if (failures.length === 0) {
        log(`[${boulder.name}] PASS on attempt ${attempt + 1}`);
        emitter?.emit('boulder:end', { name: boulder.name, status: 'passed', attempts: attempt + 1, durationMs: Date.now() - boulderStart });
        return { name: boulder.name, content: lastOutput, attempts: attempt + 1, status: 'passed' };
      }

      // Prepare climb feedback
      lastFailures = failures;
      climbFeedback = failures.map(f => `FAIL: ${f.criterion} — ${f.message}`).join('\n');
      log(`[${boulder.name}] FAIL — ${failures.length} issue(s): ${failures.map(f => f.criterion).join(', ')}`);
      if (attempt < maxRetries) {
        log(`[${boulder.name}] Climbing with feedback...`);
        emitter?.emit('climb', { boulderName: boulder.name, attempt, failures });
      }
    }

    // All attempts exhausted
    log(`[${boulder.name}] FLAGGED after ${maxRetries + 1} attempts`);
    emitter?.emit('boulder:end', { name: boulder.name, status: 'flagged', attempts: maxRetries + 1, durationMs: Date.now() - boulderStart, failures: lastFailures });
    return { name: boulder.name, content: lastOutput, attempts: maxRetries + 1, status: 'flagged', failures: lastFailures };

  } catch (err: any) {
    log(`[${boulder.name}] ERROR: ${err.message}`);
    const errorFailure: CheckResult = {
      criterion: 'execution',
      pass: false,
      message: `Boulder failed with error: ${err.message}`,
    };
    emitter?.emit('boulder:end', { name: boulder.name, status: 'flagged', attempts: 1, durationMs: 0, failures: [errorFailure] });
    return { name: boulder.name, content: '', attempts: 1, status: 'flagged', failures: [errorFailure] };
  }
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
  for (const [index, boulder] of spec.boulders.entries()) {
    const output = await processBoulder(boulder, {
      index,
      total: spec.boulders.length,
      maxRetries: boulder.maxRetries ?? maxRetries,
      baseDir,
      lessons,
      layer,
      registry,
      emitter,
      log,
    });
    outputs.push(output);
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
