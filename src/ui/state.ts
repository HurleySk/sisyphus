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
  ProduceThinkingPayload,
  EvaluateStartPayload,
  EvaluateResultsPayload,
  EvaluateEndPayload,
  ClimbPayload,
} from '../events.js';
import type { BoulderStatus, CheckResult, RunReport } from '../types.js';
import { toRelativePath } from '../path-utils.js';

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

export interface PhaseHistoryEntry {
  agent: AgentMode;
  boulderName: string;
  summary: string;
}

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
  checkCount: number;
  sourceCount: number;
  producerStatus: 'idle' | 'thinking' | 'streaming';
  producerStatusStartedAt: number | null;
  boulderDescription: string;
  criteriaDescriptions: string[];
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
  checkCount: 0,
  sourceCount: 0,
  producerStatus: 'idle',
  producerStatusStartedAt: null,
  boulderDescription: '',
  criteriaDescriptions: [],
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
  status: BoulderStatus;
  attempts: number;
  durationMs: number;
  failures?: CheckResult[];
  results?: CheckResult[];
  retryHistory?: RetryRecord[];
}

// --- Top-level UI state ---

export interface UIState {
  title: string;
  layer: string;
  totalBoulders: number;
  baseDir: string;
  activeBoulder: BoulderUIState | null;
  completedBoulders: CompletedBoulder[];
  report: RunReport | null;
  agentPanel: AgentPanelState;
  phaseHistory: PhaseHistoryEntry[];
}

export const initialUIState: UIState = {
  title: '',
  layer: '',
  totalBoulders: 0,
  baseDir: '',
  activeBoulder: null,
  completedBoulders: [],
  report: null,
  agentPanel: { ...defaultAgentPanel },
  phaseHistory: [],
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
  | { type: 'produce:stream-batch'; payload: { lines: string[] } }
  | { type: 'produce:thinking'; payload: ProduceThinkingPayload }
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
        baseDir: action.payload.baseDir ?? '',
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
      const { name, maxAttempts, description, criteriaDescriptions } = action.payload;
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
        agentPanel: {
          ...defaultAgentPanel,
          boulderDescription: description,
          criteriaDescriptions: criteriaDescriptions,
        },
      };
    }

    case 'boulder:end': {
      const { name, status, attempts, durationMs, failures } = action.payload;
      const results = state.activeBoulder?.results ?? undefined;
      const retryHistory = state.agentPanel.retryHistory;
      const completed: CompletedBoulder = {
        name, status, attempts, durationMs, failures, results,
        retryHistory: retryHistory.length > 0 ? retryHistory : undefined,
      };

      // Append hades evaluation summary
      const structural = state.agentPanel.structuralResults ?? [];
      const custom = state.agentPanel.customResults ?? [];
      const allChecks = [...structural, ...custom];
      const passedCount = allChecks.filter(c => c.pass).length;
      const totalChecks = allChecks.length;
      const hadesEntry: PhaseHistoryEntry = {
        agent: 'hades',
        boulderName: name,
        summary: totalChecks > 0
          ? `${passedCount}/${totalChecks} checks passed`
          : 'evaluation complete',
      };

      return {
        ...state,
        activeBoulder: null,
        completedBoulders: [...state.completedBoulders, completed],
        agentPanel: { ...defaultAgentPanel, agent: 'done' },
        phaseHistory: [...state.phaseHistory, hadesEntry],
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
          sourceCount: action.payload?.sourceCount ?? 0,
          boulderDescription: state.agentPanel.boulderDescription,
          criteriaDescriptions: state.agentPanel.criteriaDescriptions,
        },
      };
    }

    case 'stack:file': {
      if (!state.activeBoulder) return state;
      const entry: StackFileEntry = {
        path: toRelativePath(action.payload.filePath, state.baseDir),
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
      return state;
    }

    case 'produce:start': {
      if (!state.activeBoulder) return state;
      const { attempt, climbFeedback, boulderName } = action.payload;
      const resolvedName = boulderName ?? state.activeBoulder?.name ?? 'unknown';

      // Append gathering phase summary if transitioning from gathering
      const historyAdditions: PhaseHistoryEntry[] = [];
      if (state.agentPanel.agent === 'gathering') {
        const files = state.agentPanel.stackFiles;
        const fileCount = files.length;
        if (fileCount > 0) {
          const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
          historyAdditions.push({
            agent: 'gathering',
            boulderName: resolvedName,
            summary: `${fileCount} file${fileCount !== 1 ? 's' : ''} (${totalLines} lines)`,
          });
        }
      }

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
          boulderName: resolvedName,
          attempt: action.payload.attempt,
          maxAttempts: action.payload.maxAttempts,
          startedAt: Date.now(),
          climbFeedback: action.payload.climbFeedback,
          retryHistory: state.agentPanel.retryHistory,
          producerStatusStartedAt: Date.now(),
          boulderDescription: state.agentPanel.boulderDescription,
          criteriaDescriptions: state.agentPanel.criteriaDescriptions,
        },
        phaseHistory: [...state.phaseHistory, ...historyAdditions],
      };
    }

    case 'produce:thinking': {
      if (!state.activeBoulder) return state;
      return {
        ...state,
        agentPanel: {
          ...state.agentPanel,
          producerStatus: 'thinking',
          producerStatusStartedAt: Date.now(),
        },
      };
    }

    case 'produce:stream': {
      if (!state.activeBoulder) return state;
      const isTransition = state.agentPanel.producerStatus !== 'streaming';
      return {
        ...state,
        agentPanel: {
          ...state.agentPanel,
          producerStatus: 'streaming',
          producerStatusStartedAt: isTransition ? Date.now() : state.agentPanel.producerStatusStartedAt,
          streamingLines: [...state.agentPanel.streamingLines, action.payload.line],
        },
      };
    }

    case 'produce:stream-batch': {
      if (!state.activeBoulder) return state;
      const isTransition = state.agentPanel.producerStatus !== 'streaming';
      return {
        ...state,
        agentPanel: {
          ...state.agentPanel,
          producerStatus: 'streaming',
          producerStatusStartedAt: isTransition ? Date.now() : state.agentPanel.producerStatusStartedAt,
          streamingLines: [...state.agentPanel.streamingLines, ...action.payload.lines],
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
      return state;
    }

    case 'evaluate:start': {
      if (!state.activeBoulder) return state;
      const bName = state.agentPanel.boulderName ?? state.activeBoulder.name;
      const lineCount = state.agentPanel.streamingLines.length;
      const attemptNum = state.agentPanel.attempt;
      const evalPayload = action.payload as EvaluateStartPayload | undefined;
      const sisyphusEntry: PhaseHistoryEntry = {
        agent: 'sisyphus',
        boulderName: bName,
        summary: `attempt ${attemptNum + 1} \u00b7 ${lineCount} lines`,
      };
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
          ...defaultAgentPanel,
          agent: 'hades',
          boulderName: state.agentPanel.boulderName,
          attempt: state.agentPanel.attempt,
          maxAttempts: state.agentPanel.maxAttempts,
          startedAt: Date.now(),
          retryHistory: state.agentPanel.retryHistory,
          checkCount: (evalPayload?.structuralCount ?? 0) + (evalPayload?.customCount ?? 0),
        },
        phaseHistory: [...state.phaseHistory, sisyphusEntry],
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

      // Merge hades failure info into the preceding sisyphus phase entry
      const climbStructural = state.agentPanel.structuralResults ?? [];
      const climbCustom = state.agentPanel.customResults ?? [];
      const climbAllChecks = [...climbStructural, ...climbCustom];
      const climbFailedCount = climbAllChecks.filter(c => !c.pass).length;
      const climbTotalChecks = climbAllChecks.length;
      const failSuffix = climbTotalChecks > 0
        ? ` \u2192 ${climbFailedCount}/${climbTotalChecks} failed`
        : ' \u2192 failed';

      // Update the last phase history entry (should be the sisyphus entry from evaluate:start)
      const updatedHistory = [...state.phaseHistory];
      const lastIdx = updatedHistory.length - 1;
      if (lastIdx >= 0 && updatedHistory[lastIdx].agent === 'sisyphus') {
        updatedHistory[lastIdx] = {
          ...updatedHistory[lastIdx],
          summary: updatedHistory[lastIdx].summary + failSuffix,
        };
      }

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
        phaseHistory: updatedHistory,
      };
    }

    default:
      return state;
  }
}
