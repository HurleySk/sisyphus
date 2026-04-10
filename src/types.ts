// --- Core data types ---

export interface StackSource {
  type: string;
  source?: string;
  instruction?: string;
  [key: string]: unknown;
}

export interface Criterion {
  check: string;
  description: string;
  columns?: string[];
  heading?: string;
  level?: number;
  min?: number;
  max?: number;
  source?: string;
  [key: string]: unknown;
}

export interface Boulder {
  name: string;
  description: string;
  stack?: StackSource[];
  criteria: Criterion[];
  maxRetries?: number;
}

export interface Spec {
  title: string;
  description?: string;
  layer: string;
  output: string;
  maxRetries?: number;
  boulders: Boulder[];
}

// --- Result types ---

export interface StackResult {
  type: string;
  source: string;
  data: string;
}

export interface CheckResult {
  criterion: string;
  pass: boolean;
  message: string;
}

export interface BoulderOutput {
  name: string;
  content: string;
  attempts: number;
  status: 'passed' | 'flagged';
  failures?: CheckResult[];
}

export interface RunReport {
  title: string;
  startedAt: string;
  completedAt: string;
  boulders: BoulderOutput[];
  totalBoulders: number;
  passedClean: number;
  passedAfterClimb: number;
  flagged: number;
}

// --- Layer interface ---

export type CheckFn = (markdown: string, criterion: Criterion) => CheckResult;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Layer {
  name: string;
  validateSpec(spec: Spec): ValidationResult;
  getChecks(): Map<string, CheckFn>;
  buildProducerPrompt(boulder: Boulder, stackResults: StackResult[], feedback?: string, lessons?: string): string;
  buildEvaluatorPrompt(output: string, criteria: Criterion[], stackResults: StackResult[], lessons?: string): string;
  assemble(outputs: BoulderOutput[], outputPath: string): Promise<void>;
}

// --- Lesson types ---

export interface Lesson {
  id: string;
  text: string;
  source: 'auto' | 'user';
  layer?: string;
  created: string;
  lastUsed: string;
  useCount: number;
  relevance: string[];
}

// --- Type guards ---

export function isStackSource(value: unknown): value is StackSource {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === 'string';
}

export function isCriterion(value: unknown): value is Criterion {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.check === 'string' && typeof obj.description === 'string';
}

export function isBoulder(value: unknown): value is Boulder {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== 'string' || typeof obj.description !== 'string') return false;
  if (!Array.isArray(obj.criteria) || obj.criteria.length === 0) return false;
  if (obj.stack !== undefined && !Array.isArray(obj.stack)) return false;
  return obj.criteria.every(isCriterion);
}

export function isSpec(value: unknown): value is Spec {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.title !== 'string') return false;
  if (typeof obj.layer !== 'string') return false;
  if (typeof obj.output !== 'string') return false;
  if (!Array.isArray(obj.boulders) || obj.boulders.length === 0) return false;
  return obj.boulders.every(isBoulder);
}
