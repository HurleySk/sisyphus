import { Args, Command, Flags } from '@oclif/core';
import path from 'path';
import { loadSpec } from '../spec.js';
import { runSpec } from '../engine.js';
import { writeReport } from '../report.js';

export default class Run extends Command {
  static override args = {
    'spec-file': Args.string({
      description: 'Path to the spec file',
      required: true,
    }),
  };

  static override description = 'Execute a spec - stack, produce, evaluate, climb';

  static override flags = {
    'dry-run': Flags.boolean({
      description: 'Parse spec and show plan without executing',
    }),
    model: Flags.string({
      description: 'Override model for producer/evaluator',
    }),
    output: Flags.string({
      description: 'Override output path from spec',
    }),
    section: Flags.string({
      description: 'Run only a specific boulder',
    }),
    verbose: Flags.boolean({
      description: 'Show full prompts and responses',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const specFile = args['spec-file'];

    try {
      const spec = await loadSpec(specFile);
      if (flags.output) spec.output = flags.output;
      if (flags.section) {
        spec.boulders = spec.boulders.filter(b => b.name === flags.section);
        if (spec.boulders.length === 0) {
          console.error(`No boulder named "${flags.section}" found in spec`);
          process.exit(1);
        }
      }

      // Resolve baseDir: spec.baseDir (relative to spec file) -> cwd fallback
      const specDir = path.dirname(path.resolve(specFile));
      const baseDir = spec.baseDir
        ? path.resolve(specDir, spec.baseDir)
        : process.cwd();

      const reportPath = spec.output.replace(/\.[^.]+$/, '') + '-report.json';

      if (flags['dry-run']) {
        this.log(`Spec: ${spec.title}`);
        this.log(`Layer: ${spec.layer}`);
        this.log(`Output: ${spec.output}`);
        this.log(`Max retries: ${spec.maxRetries ?? 3}`);
        this.log(`\nBoulders:`);
        for (const b of spec.boulders) {
          this.log(`  - ${b.name}: ${b.criteria.length} criteria, ${b.stack?.length ?? 0} stack sources`);
        }
        return;
      }

      const useInkUI = !flags.verbose && process.stdout.isTTY;

      let report;
      if (useInkUI) {
        const { renderUI } = await import('../ui/render.js');
        report = await renderUI(spec, { baseDir }, spec.output, reportPath);
      } else {
        this.log(`Starting: ${spec.title}`);
        this.log(`Layer: ${spec.layer} | Boulders: ${spec.boulders.length}\n`);

        report = await runSpec(spec, {
          baseDir,
          verbose: flags.verbose,
        });

        this.log(`\n--- Run Complete ---`);
        this.log(`Passed clean:       ${report.passedClean}`);
        this.log(`Passed after climb: ${report.passedAfterClimb}`);
        this.log(`Flagged:            ${report.flagged}`);
        this.log(`\nArtifact: ${spec.output}`);
        this.log(`Report:   ${reportPath}`);
      }

      await writeReport(report, reportPath);

      if (report.flagged > 0) {
        this.log(`\nFlagged boulders:`);
        report.boulders
          .filter(b => b.status === 'flagged')
          .forEach(b => {
            this.log(`  - ${b.name}: ${b.failures?.map(f => f.message).join('; ')}`);
          });
        process.exit(1);
      }
    } catch (err: any) {
      this.error(err.message);
    }
  }
}
