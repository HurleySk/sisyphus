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

// --- Worker panel state (bottom panel) ---

export type WorkerAgent = 'sisyphus' | 'hades' | null;

export interface WorkerPanelState {
  agent: WorkerAgent;
  boulderName: string | null;
  climbFeedback?: string;
  fileChanges: FileChangeEntry[];
  diffStat: string | null;
  startedAt: number | null;
  structuralResults: CheckResult[] | null;
  customResults: CheckResult[] | null;
  structuralCount: number;
  customCount: number;
  evaluatePassed: boolean | null;
}

// --- Dispatch log (top panel) ---

export interface DispatchEntry {
  timestamp: number;
  type: 'gathered' | 'dispatched-sisyphus' | 'dispatched-hades' | 'retry' | 'evaluated-pass' | 'evaluated-fail';
  message: string;
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
  dispatchLog: DispatchEntry[];
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
  workerPanel: WorkerPanelState;
}

export const defaultWorkerPanel: WorkerPanelState = {
  agent: null,
  boulderName: null,
  climbFeedback: undefined,
  fileChanges: [],
  diffStat: null,
  startedAt: null,
  structuralResults: null,
  customResults: null,
  structuralCount: 0,
  customCount: 0,
  evaluatePassed: null,
};

export const initialUIState: UIState = {
  title: '',
  layer: '',
  totalBoulders: 0,
  activeBoulder: null,
  completedBoulders: [],
  report: null,
  workerPanel: { ...defaultWorkerPanel },
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
  | { type: 'produce:file-change'; payload: ProduceFileChangePayload }
  | { type: 'produce:diff'; payload: ProduceDiffPayload }
  | { type: 'produce:end'; payload?: ProduceEndPayload }
  | { type: 'evaluate:start'; payload?: EvaluateStartPayload }
  | { type: 'evaluate:structural'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:custom'; payload: EvaluateResultsPayload }
  | { type: 'evaluate:end'; payload: EvaluateEndPayload }
  | { type: 'climb'; payload?: ClimbPayload };

// --- Helpers ---

function addDispatch(
  boulder: BoulderUIState,
  type: DispatchEntry['type'],
  message: string,
): BoulderUIState {
  const entry: DispatchEntry = { timestamp: Date.now(), type, message };
  return { ...boulder, dispatchLog: [...boulder.dispatchLog, entry] };
}

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
        workerPanel: { ...defaultWorkerPanel },
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
        dispatchLog: [],
      };
      return {
        ...state,
        activeBoulder: fresh,
        workerPanel: { ...defaultWorkerPanel },
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
        workerPanel: { ...defaultWorkerPanel },
      };
    }

    case 'stack:start': {
      if (!state.activeBoulder) return state;
      const sourceCount = action.payload?.sourceCount;
      const msg = sourceCount != null
        ? `gathering ${sourceCount} sources...`
        : 'gathering sources...';
      const updated = addDispatch(state.activeBoulder, 'gathered', msg);
      return {
        ...state,
        activeBoulder: { ...updated, phase: 'stack' },
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
      if (!state.activeBoulder) return state;
      const resultCount = action.payload?.resultCount;
      const msg = resultCount != null
        ? `\u2713 gathered ${resultCount} files`
        : '\u2713 gathered files';
      const updated = addDispatch(state.activeBoulder, 'gathered', msg);
      return {
        ...state,
        activeBoulder: updated,
      };
    }

    case 'produce:start': {
      if (!state.activeBoulder) return state;
      const { attempt, climbFeedback, boulderName } = action.payload;
      const updated = addDispatch(
        state.activeBoulder,
        'dispatched-sisyphus',
        `\u2192 dispatched sisyphus (attempt ${attempt})`,
      );
      return {
        ...state,
        activeBoulder: {
          ...updated,
          phase: 'produce',
          attempt,
          climbFeedback,
          fileChanges: [],
          diffStat: null,
        },
        workerPanel: {
          agent: 'sisyphus',
          boulderName: boulderName ?? state.activeBoulder.name,
          climbFeedback,
          fileChanges: [],
          diffStat: null,
          startedAt: Date.now(),
          structuralResults: null,
          customResults: null,
          structuralCount: 0,
          customCount: 0,
          evaluatePassed: null,
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
        workerPanel: {
          ...state.workerPanel,
          fileChanges: [...state.workerPanel.fileChanges, entry],
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
        workerPanel: {
          ...state.workerPanel,
          diffStat: action.payload.diff,
        },
      };
    }

    case 'produce:end': {
      if (!state.activeBoulder) return state;
      const fileCount = state.activeBoulder.fileChanges.length;
      const updated = addDispatch(
        state.activeBoulder,
        'dispatched-sisyphus',
        `\u2713 sisyphus produced ${fileCount} changes`,
      );
      return {
        ...state,
        activeBoulder: updated,
      };
    }

    case 'evaluate:start': {
      if (!state.activeBoulder) return state;
      const structuralCount = action.payload?.structuralCount ?? 0;
      const customCount = action.payload?.customCount ?? 0;
      const updated = addDispatch(
        state.activeBoulder,
        'dispatched-hades',
        '\u2192 dispatched hades',
      );
      return {
        ...state,
        activeBoulder: {
          ...updated,
          phase: 'evaluate',
          structuralResults: null,
          customResults: null,
          results: null,
        },
        workerPanel: {
          agent: 'hades',
          boulderName: action.payload?.boulderName ?? state.activeBoulder.name,
          fileChanges: state.workerPanel.fileChanges,
          diffStat: state.workerPanel.diffStat,
          startedAt: Date.now(),
          structuralResults: null,
          customResults: null,
          structuralCount,
          customCount,
          evaluatePassed: null,
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
        workerPanel: {
          ...state.workerPanel,
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
        workerPanel: {
          ...state.workerPanel,
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

      let updated: BoulderUIState;
      if (passed) {
        updated = addDispatch(state.activeBoulder, 'evaluated-pass', '\u2713 hades passed');
      } else {
        const issueCount = failures.length;
        updated = addDispatch(state.activeBoulder, 'evaluated-fail', `\u2717 hades failed (${issueCount} issues)`);
      }

      return {
        ...state,
        activeBoulder: {
          ...updated,
          phase: passed ? 'evaluate' : 'failed',
          results: allResults.length > 0 ? allResults : failures,
        },
        workerPanel: {
          ...state.workerPanel,
          evaluatePassed: passed,
        },
      };
    }

    case 'climb': {
      if (!state.activeBoulder) return state;
      const failureSummary = action.payload?.failures
        ?.map((f) => f.message)
        .join(', ') ?? 'evaluation failed';
      const updated = addDispatch(
        state.activeBoulder,
        'retry',
        `\u21bb retry \u2014 ${failureSummary}`,
      );
      return {
        ...state,
        activeBoulder: updated,
        workerPanel: { ...defaultWorkerPanel },
      };
    }

    default:
      return state;
  }
}
