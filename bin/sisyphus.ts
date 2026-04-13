#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { loadSpec } from '../src/spec.js';
import { runSpec } from '../src/engine.js';
import { writeReport } from '../src/report.js';

const program = new Command();

program
  .name('sisyphus')
  .description('Spec-driven artifact engine with adversarial evaluation')
  .version('0.1.0');

program
  .command('validate <spec-file>')
  .description('Validate a spec file against the schema without running')
  .action(async (specFile: string) => {
    try {
      const spec = await loadSpec(specFile);
      console.log(`Spec "${spec.title}" is valid`);
      console.log(`  Layer: ${spec.layer}`);
      console.log(`  Boulders: ${spec.boulders.length}`);
      console.log(`  Output: ${spec.output}`);
    } catch (err: any) {
      console.error(`Validation failed:\n${err.message}`);
      process.exit(1);
    }
  });

program
  .command('run <spec-file>')
  .description('Execute a spec - stack, produce, evaluate, climb')
  .option('--dry-run', 'Parse spec and show plan without executing')
  .option('--section <name>', 'Run only a specific boulder')
  .option('--model <model>', 'Override model for producer/evaluator')
  .option('--verbose', 'Show full prompts and responses')
  .option('--output <path>', 'Override output path from spec')
  .action(async (specFile: string, opts: any) => {
    try {
      const spec = await loadSpec(specFile);
      if (opts.output) spec.output = opts.output;
      if (opts.section) {
        spec.boulders = spec.boulders.filter(b => b.name === opts.section);
        if (spec.boulders.length === 0) {
          console.error(`No boulder named "${opts.section}" found in spec`);
          process.exit(1);
        }
      }

      // Resolve baseDir: spec.baseDir (relative to spec file) → cwd fallback
      const specDir = path.dirname(path.resolve(specFile));
      const baseDir = spec.baseDir
        ? path.resolve(specDir, spec.baseDir)
        : process.cwd();

      const reportPath = spec.output.replace(/\.[^.]+$/, '') + '-report.json';

      if (opts.dryRun) {
        console.log(`Spec: ${spec.title}`);
        console.log(`Layer: ${spec.layer}`);
        console.log(`Output: ${spec.output}`);
        console.log(`Max retries: ${spec.maxRetries ?? 3}`);
        console.log(`\nBoulders:`);
        for (const b of spec.boulders) {
          console.log(`  - ${b.name}: ${b.criteria.length} criteria, ${b.stack?.length ?? 0} stack sources`);
        }
        return;
      }

      const useInkUI = !opts.verbose && process.stdout.isTTY;

      let report;
      if (useInkUI) {
        const { renderUI } = await import('../src/ui/render.js');
        report = await renderUI(spec, { baseDir }, spec.output, reportPath);
      } else {
        console.log(`Starting: ${spec.title}`);
        console.log(`Layer: ${spec.layer} | Boulders: ${spec.boulders.length}\n`);

        report = await runSpec(spec, {
          baseDir,
          verbose: opts.verbose,
        });

        console.log(`\n--- Run Complete ---`);
        console.log(`Passed clean:       ${report.passedClean}`);
        console.log(`Passed after climb: ${report.passedAfterClimb}`);
        console.log(`Flagged:            ${report.flagged}`);
        console.log(`\nArtifact: ${spec.output}`);
        console.log(`Report:   ${reportPath}`);
      }

      await writeReport(report, reportPath);

      if (report.flagged > 0) {
        console.log(`\nFlagged boulders:`);
        report.boulders
          .filter(b => b.status === 'flagged')
          .forEach(b => {
            console.log(`  - ${b.name}: ${b.failures?.map(f => f.message).join('; ')}`);
          });
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
