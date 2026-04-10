import type { CheckFn, CheckResult, Criterion } from './types.js';

export class CheckRegistry {
  private checks = new Map<string, CheckFn>();

  register(name: string, fn: CheckFn): void {
    this.checks.set(name, fn);
  }

  registerAll(checks: Map<string, CheckFn>): void {
    for (const [name, fn] of checks) this.checks.set(name, fn);
  }

  has(name: string): boolean {
    return this.checks.has(name);
  }

  get(name: string): CheckFn | undefined {
    return this.checks.get(name);
  }

  runChecks(markdown: string, criteria: Criterion[]): CheckResult[] {
    const results: CheckResult[] = [];
    for (const criterion of criteria) {
      if (criterion.check === 'custom') continue; // Hades handles these
      const checkFn = this.checks.get(criterion.check);
      if (!checkFn) {
        results.push({
          criterion: criterion.description,
          pass: false,
          message: `Unknown check type: "${criterion.check}"`,
        });
        continue;
      }
      results.push(checkFn(markdown, criterion));
    }
    return results;
  }
}
