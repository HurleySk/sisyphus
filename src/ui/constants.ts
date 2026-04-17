import type { AgentMode } from './state.js';

// --- Agent configuration ---

export const AGENT_CONFIG: Record<AgentMode, { label: string; color: string }> = {
  idle: { label: '', color: 'dim' },
  gathering: { label: 'GATHERING', color: 'cyan' },
  sisyphus: { label: 'SISYPHUS', color: 'magenta' },
  hades: { label: 'HADES', color: 'red' },
  retry: { label: 'RETRY', color: 'yellow' },
  done: { label: 'DONE', color: 'green' },
};

export function agentColor(agent: AgentMode): string {
  return AGENT_CONFIG[agent].color;
}

// --- Layout ---

export const MAX_VISIBLE_PHASES = 6;
export const STATUS_BAR_HEIGHT = 3;
export const KEY_HINT_HEIGHT = 1;
export const BATCH_FLUSH_MS = 50;

// --- Separators ---

export const SEPARATOR_DOTTED = '╌';
export const SEPARATOR_SOLID = '━';
