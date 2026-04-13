// src/ui/state.ts
import type {
  RunStartPayload,
  RunEndPayload,
  BoulderStartPayload,
  BoulderEndPayload,
  StackFilePayload,
  ProduceStartPayload,
  ProduceFileChangePayload,
  ProduceDiffPayload,
  EvaluateResultsPayload,
  EvaluateEndPayload,
} from '../events.js';
import type { CheckResult, RunReport } from '../types.js';

// --- Sub-types ---

export type Phase = 'idle' | 'stack' | 'produce' | 'evaluate' | 'failed';

export interface StackFileEntry {
  path: string;
  lines: number;
  summarized: boolean;
}

export interface FileChangeEntry {
  filePath: string;
  changeType: 'A' | 'M';
}

// --- Active boulder state ---

export interface BoulderUIState {
  name: string;
  phase: Phase;
  attempt: number;
  maxAttempts: number;
  stackFiles: StackFileEntry[];
  fileChanges: FileChangeEntry[];
  diffStat: string | null;
  climbFeedback: string | undefined;
  structuralResults: CheckResult[] | null;
  customResults: CheckResult[] | null;
  results: CheckResult[] | null;
  startedAt: number;
}

// --- Completed boulder ---

export interface CompletedBoulder {
  name: string;
  status: 'passed' | 'flagged';
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
}

// --- Top-level UI state ---

export interface UIState {
  title: string;
  layer: string;
  totalBoulders: number;
  activeBoulder: BoulderUIState | null;
  completedBoulders: CompletedBoulder[];
  report: RunReport | null;
}

export const initialUIState: UIState = {
  title: '',
  layer: '',
  totalBoulders: 0,
  activeBoulder: null,
  completedBoulders: [],
  report: null,
};

// --- Actions ---

export type UIAction =
  | { type: 'run:start'; payload: RunStartPayload }
  | { type: 'run:end'; payload: RunEndPayload }
  | { type: 'boulder:start'; payload: BoulderStartPayload }
  | { type: 'boulder:end'; payload: BoulderEndPayload }
  | { type: 'stack:start' }
  | { type: 'stack:file'; payload: StackFilePayload }
  | { type: 'stack:end' }
  | { type: 'produce:start'; payload: ProduceStartPayload }
  | { type: 'produce:file-change'; payload: ProduceFileChangePayload }
  | { type: 'produce:diff'; payload: ProduceDiffPayload }
  | { type: 'produce:end' }
  | { type: 'evaluate:start' }
  | { type: 'evaluate:structural'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:custom'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:end'; payload: EvaluateEndPayload }
  | { type: 'climb' };

// --- Reducer ---

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'run:start': {
      const { title, layer, totalBoulders } = action.payload;
      return {
        ...state,
        title,
        layer,
        totalBoulders,
      };
    }

    case 'run:end': {
      return {
        ...state,
        report: action.payload.report,
      };
    }

    case 'boulder:start': {
      const { name, maxAttempts } = action.payload;
      const fresh: BoulderUIState = {
        name,
        phase: 'idle',
        attempt: 0,
        maxAttempts,
        stackFiles: [],
        fileChanges: [],
        diffStat: null,
        climbFeedback: undefined,
        structuralResults: null,
        customResults: null,
        results: null,
        startedAt: Date.now(),
      };
      return {
        ...state,
        activeBoulder: fresh,
      };
    }

    case 'boulder:end': {
      const { name, status, attempts, durationMs, failures } = action.payload;
      const completed: CompletedBoulder = { name, status, attempts, durationMs, failures };
      return {
        ...state,
        activeBoulder: null,
        completedBoulders: [...state.completedBoulders, completed],
      };
    }

    case 'stack:start': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: { ...state.activeBoulder, phase: 'stack' },
      };
    }

    case 'stack:file': {
      if (!state.activeBoulder) return state;
      const entry: StackFileEntry = {
        path: action.payload.filePath,
        lines: action.payload.lineCount,
        summarized: action.payload.summarized,
      };
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          stackFiles: [...state.activeBoulder.stackFiles, entry],
        },
      };
    }

    case 'stack:end': {
      // no-op: phase transitions on the next event
      return state;
    }

    case 'produce:start': {
      if (!state.activeBoulder) return state;
      const { attempt, climbFeedback } = action.payload;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: 'produce',
          attempt,
          climbFeedback,
          fileChanges: [],
          diffStat: null,
        },
      };
    }

    case 'produce:file-change': {
      if (!state.activeBoulder) return state;
      const entry: FileChangeEntry = {
        filePath: action.payload.filePath,
        changeType: action.payload.changeType,
      };
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          fileChanges: [...state.activeBoulder.fileChanges, entry],
        },
      };
    }

    case 'produce:diff': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          diffStat: action.payload.diff,
        },
      };
    }

    case 'produce:end': {
      // no-op
      return state;
    }

    case 'evaluate:start': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: 'evaluate',
          structuralResults: null,
          customResults: null,
          results: null,
        },
      };
    }

    case 'evaluate:structural': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          structuralResults: action.payload.results,
        },
      };
    }

    case 'evaluate:custom': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          customResults: action.payload.results,
        },
      };
    }

    case 'evaluate:end': {
      if (!state.activeBoulder) return state;
      const { passed, failures } = action.payload;
      const structural = state.activeBoulder.structuralResults ?? [];
      const custom = state.activeBoulder.customResults ?? [];
      const allResults = [...structural, ...custom];
      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: passed ? 'evaluate' : 'failed',
          results: allResults.length > 0 ? allResults : failures,
        },
      };
    }

    case 'climb': {
      // no-op: feedback comes via next produce:start
      return state;
    }

    default:
      return state;
  }
}
