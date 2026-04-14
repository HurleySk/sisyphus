// src/ui/state.ts
import type {
  RunStartPayload,
  RunEndPayload,
  BoulderStartPayload,
  BoulderEndPayload,
  StackStartPayload,
  StackEndPayload,
  StackFilePayload,
  ProduceStartPayload,
  ProduceStreamPayload,
  ProduceFileChangePayload,
  ProduceDiffPayload,
  ProduceEndPayload,
  EvaluateStartPayload,
  EvaluateResultsPayload,
  EvaluateEndPayload,
  ClimbPayload,
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

// --- Agent panel state (v3 layout) ---

export type AgentMode = 'idle' | 'gathering' | 'sisyphus' | 'hades' | 'retry' | 'done';

export interface RetryRecord {
  attempt: number;
  failedChecks: string[];
}

export interface AgentPanelState {
  agent: AgentMode;
  boulderName: string | null;
  attempt: number;
  maxAttempts: number;
  startedAt: number | null;
  streamingLines: string[];
  stackFiles: StackFileEntry[];
  structuralResults: CheckResult[] | null;
  customResults: CheckResult[] | null;
  climbFeedback: string | undefined;
  retryHistory: RetryRecord[];
}

export const defaultAgentPanel: AgentPanelState = {
  agent: 'idle',
  boulderName: null,
  attempt: 0,
  maxAttempts: 0,
  startedAt: null,
  streamingLines: [],
  stackFiles: [],
  structuralResults: null,
  customResults: null,
  climbFeedback: undefined,
  retryHistory: [],
};

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
  results?: CheckResult[];
}

// --- Top-level UI state ---

export interface UIState {
  title: string;
  layer: string;
  totalBoulders: number;
  activeBoulder: BoulderUIState | null;
  completedBoulders: CompletedBoulder[];
  report: RunReport | null;
  agentPanel: AgentPanelState;
}

export const initialUIState: UIState = {
  title: '',
  layer: '',
  totalBoulders: 0,
  activeBoulder: null,
  completedBoulders: [],
  report: null,
  agentPanel: { ...defaultAgentPanel },
};

// --- Actions ---

export type UIAction =
  | { type: 'run:start'; payload: RunStartPayload }
  | { type: 'run:end'; payload: RunEndPayload }
  | { type: 'boulder:start'; payload: BoulderStartPayload }
  | { type: 'boulder:end'; payload: BoulderEndPayload }
  | { type: 'stack:start'; payload?: StackStartPayload }
  | { type: 'stack:file'; payload: StackFilePayload }
  | { type: 'stack:end'; payload?: StackEndPayload }
  | { type: 'produce:start'; payload: ProduceStartPayload }
  | { type: 'produce:stream'; payload: ProduceStreamPayload }
  | { type: 'produce:file-change'; payload: ProduceFileChangePayload }
  | { type: 'produce:diff'; payload: ProduceDiffPayload }
  | { type: 'produce:end'; payload?: ProduceEndPayload }
  | { type: 'evaluate:start'; payload?: EvaluateStartPayload }
  | { type: 'evaluate:structural'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:custom'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:end'; payload: EvaluateEndPayload }
  | { type: 'climb'; payload?: ClimbPayload };

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
        agentPanel: {
          ...state.agentPanel,
          agent: 'done',
        },
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
        agentPanel: { ...defaultAgentPanel },
      };
    }

    case 'boulder:end': {
      const { name, status, attempts, durationMs, failures } = action.payload;
      const results = state.activeBoulder?.results ?? undefined;
      const completed: CompletedBoulder = { name, status, attempts, durationMs, failures, results };
      return {
        ...state,
        activeBoulder: null,
        completedBoulders: [...state.completedBoulders, completed],
        agentPanel: { ...defaultAgentPanel },
      };
    }

    case 'stack:start': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: { ...state.activeBoulder, phase: 'stack' },
        agentPanel: {
          ...defaultAgentPanel,
          agent: 'gathering',
          boulderName: state.activeBoulder?.name ?? null,
          startedAt: Date.now(),
        },
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
        agentPanel: {
          ...state.agentPanel,
          stackFiles: [...state.agentPanel.stackFiles, entry],
        },
      };
    }

    case 'stack:end': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: state.activeBoulder,
      };
    }

    case 'produce:start': {
      if (!state.activeBoulder) return state;
      const { attempt, climbFeedback, boulderName } = action.payload;
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
        agentPanel: {
          ...defaultAgentPanel,
          agent: 'sisyphus',
          boulderName: boulderName ?? state.activeBoulder?.name ?? null,
          attempt: action.payload.attempt,
          maxAttempts: action.payload.maxAttempts,
          startedAt: Date.now(),
          climbFeedback: action.payload.climbFeedback,
          retryHistory: state.agentPanel.retryHistory,
        },
      };
    }

    case 'produce:stream': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        agentPanel: {
          ...state.agentPanel,
          streamingLines: [...state.agentPanel.streamingLines, action.payload.line],
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
      if (!state.activeBoulder) return state;
      return {
        ...state,
        activeBoulder: state.activeBoulder,
      };
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
        agentPanel: {
          ...state.agentPanel,
          agent: 'hades',
          startedAt: Date.now(),
          streamingLines: [],
          structuralResults: null,
          customResults: null,
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
        agentPanel: {
          ...state.agentPanel,
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
        agentPanel: {
          ...state.agentPanel,
          customResults: action.payload.results,
        },
      };
    }

    case 'evaluate:end': {
      if (!state.activeBoulder) return state;
      const { passed } = action.payload;
      const structural = state.activeBoulder.structuralResults ?? [];
      const custom = state.activeBoulder.customResults ?? [];
      const allResults = [...structural, ...custom];

      return {
        ...state,
        activeBoulder: {
          ...state.activeBoulder,
          phase: passed ? 'evaluate' : 'failed',
          results: allResults.length > 0 ? allResults : action.payload.failures,
        },
      };
    }

    case 'climb': {
      if (!state.activeBoulder) return state;
      const failureSummary = action.payload?.failures
        ?.map((f) => f.message)
        .join(', ') ?? 'evaluation failed';
      return {
        ...state,
        activeBoulder: state.activeBoulder,
        agentPanel: {
          ...state.agentPanel,
          agent: 'retry',
          climbFeedback: failureSummary,
          retryHistory: [
            ...state.agentPanel.retryHistory,
            {
              attempt: state.activeBoulder.attempt,
              failedChecks: (action.payload?.failures ?? []).map(f => f.criterion),
            },
          ],
        },
      };
    }

    default:
      return state;
  }
}
