import { Args, Command } from '@oclif/core';
import { loadSpec } from '../spec.js';

export default class Validate extends Command {
  static override args = {
    'spec-file': Args.string({
      description: 'Path to the spec file to validate',
      required: true,
    }),
  };

  static override description = 'Validate a spec file against the schema without running';

  async run(): Promise<void> {
    const { args } = await this.parse(Validate);
    const specFile = args['spec-file'];

    try {
      const spec = await loadSpec(specFile);
      this.log(`Spec "${spec.title}" is valid`);
      this.log(`  Layer: ${spec.layer}`);
      this.log(`  Boulders: ${spec.boulders.length}`);
      this.log(`  Output: ${spec.output}`);
    } catch (err: any) {
      this.error(`Validation failed:\n${err.message}`);
    }
  }
}
