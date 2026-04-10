import type { Boulder, StackResult, Criterion } from './types.js';

/**
 * Builds the prompt for Sisyphus (producer).
 *
 * Isolation guarantee: criteria are intentionally excluded.
 * Sisyphus receives the boulder description (the "what") and gathered data,
 * but never sees the acceptance criteria (the "how it will be judged").
 */
export function buildProducerPrompt(
  template: string,
  boulder: Boulder,
  stackResults: StackResult[],
  climbFeedback?: string,
  lessons?: string,
): string {
  let prompt = template;

  if (lessons) {
    prompt += `\n\n--- Lessons Learned ---\n${lessons}`;
  }

  prompt += `\n\n--- Boulder Description ---\n${boulder.description}`;
  prompt += `\n\n--- Stacked Data ---\n${JSON.stringify(stackResults, null, 2)}`;

  if (climbFeedback) {
    prompt += `\n\n--- Previous Attempt Failed ---\n${climbFeedback}`;
    prompt += `\nFix the specific issues identified above. Do not start from scratch.`;
  }

  prompt += `\n\n--- Output ---\nProduce the content as described. Output ONLY the content, no commentary.`;

  return prompt;
}

/**
 * Builds the prompt for Hades (evaluator).
 *
 * Isolation guarantee: the boulder description is intentionally excluded.
 * Hades receives the produced output and the acceptance criteria, but never
 * sees the producer's original goal/brief — ensuring adversarial independence.
 */
export function buildEvaluatorPrompt(
  template: string,
  output: string,
  criteria: Criterion[],
  stackResults: StackResult[],
  lessons?: string,
): string {
  let prompt = template;

  if (lessons) {
    prompt += `\n\n--- Lessons Learned ---\n${lessons}`;
  }

  prompt += `\n\n--- Content to Evaluate ---\n${output}`;
  prompt += `\n\n--- Criteria ---\n${criteria.map((c, i) => `${i + 1}. ${c.description}`).join('\n')}`;
  prompt += `\n\n--- Source Data (for cross-reference) ---\n${JSON.stringify(stackResults, null, 2)}`;
  prompt += `\n\n--- Output ---\nReturn a JSON array of results. For each criterion:\n`;
  prompt += `{"criterion": "description", "pass": true/false, "evidence": "quoted text", "reason": "explanation"}\n`;
  prompt += `Be adversarial. Find failures, don't confirm success. Evidence is mandatory for passes.`;

  return prompt;
}
