// src/events.ts
import { EventEmitter } from 'events';
import type { BoulderStatus, CheckResult, RunReport } from './types.js';

// --- Event payload types ---

export interface RunStartPayload {
  title: string;
  layer: string;
  totalBoulders: number;
  maxRetries: number;
  baseDir?: string;
}

export interface RunEndPayload {
  report: RunReport;
}

export interface BoulderStartPayload {
  name: string;
  index: number;
  total: number;
  maxAttempts: number;
  description: string;
  criteriaDescriptions: string[];
}

export interface BoulderEndPayload {
  name: string;
  status: BoulderStatus;
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
}

export interface StackStartPayload {
  boulderName: string;
  sourceCount: number;
}

export interface StackFilePayload {
  boulderName: string;
  filePath: string;
  lineCount: number;
  summarized: boolean;
}

export interface StackEndPayload {
  boulderName: string;
  resultCount: number;
}

export interface ProduceStartPayload {
  boulderName: string;
  attempt: number;
  maxAttempts: number;
  climbFeedback?: string;
}

export interface ProduceFileChangePayload {
  boulderName: string;
  filePath: string;
  changeType: 'A' | 'M';
}

export interface ProduceDiffPayload {
  boulderName: string;
  attempt: number;
  diff: string;
}

export interface ProduceEndPayload {
  boulderName: string;
  attempt: number;
  outputLength: number;
}

export interface ProduceStreamPayload {
  boulderName: string;
  line: string;
}

export interface ProduceThinkingPayload {
  boulderName: string;
}

export interface EvaluateStartPayload {
  boulderName: string;
  attempt: number;
  structuralCount: number;
  customCount: number;
}

export interface EvaluateResultsPayload {
  boulderName: string;
  results: CheckResult[];
}

export interface EvaluateEndPayload {
  boulderName: string;
  attempt: number;
  passed: boolean;
  failures: CheckResult[];
}

export interface ClimbPayload {
  boulderName: string;
  attempt: number;
  failures: CheckResult[];
}

// --- Event map ---

export interface SisyphusEvents extends Record<string, unknown> {
  'run:start': RunStartPayload;
  'run:end': RunEndPayload;
  'boulder:start': BoulderStartPayload;
  'boulder:end': BoulderEndPayload;
  'stack:start': StackStartPayload;
  'stack:file': StackFilePayload;
  'stack:end': StackEndPayload;
  'produce:start': ProduceStartPayload;
  'produce:file-change': ProduceFileChangePayload;
  'produce:diff': ProduceDiffPayload;
  'produce:end': ProduceEndPayload;
  'produce:stream': ProduceStreamPayload;
  'produce:thinking': ProduceThinkingPayload;
  'evaluate:start': EvaluateStartPayload;
  'evaluate:structural': EvaluateResultsPayload;
  'evaluate:custom': EvaluateResultsPayload;
  'evaluate:end': EvaluateEndPayload;
  'climb': ClimbPayload;
}

// --- TypedEmitter ---

export class TypedEmitter<TEvents extends Record<string, unknown>> {
  private ee = new EventEmitter();

  on<K extends keyof TEvents & string>(event: K, handler: (payload: TEvents[K]) => void): this {
    this.ee.on(event, handler as (...args: any[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(event: K, handler: (payload: TEvents[K]) => void): this {
    this.ee.off(event, handler as (...args: any[]) => void);
    return this;
  }

  emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): boolean {
    return this.ee.emit(event, payload);
  }

  removeAllListeners(): this {
    this.ee.removeAllListeners();
    return this;
  }
}
