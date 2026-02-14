import type { PersonaId, RunMode } from '@simvibe/shared';

export interface RunModeConfig {
  mode: RunMode;
  personaIds: PersonaId[];
  maxTokensPerAgent: number;
  temperature: number;
  enableDebate: boolean;
  timeBudgetMs: number;
  description: string;
}

/**
 * Quick mode: 5 core personas, lower tokens, no debate, ~2 min target
 */
const QUICK_MODE: RunModeConfig = {
  mode: 'quick',
  personaIds: [
    'cynical_engineer',
    'passionate_pm',
    'pragmatic_investor',
    'ruthless_marketer',
    'agency_owner',
  ],
  maxTokensPerAgent: 2048,
  temperature: 0.7,
  enableDebate: false,
  timeBudgetMs: 120_000, // 2 minutes
  description: 'Quick scan with 5 core personas (~2 min)',
};

/**
 * Deep mode: 5 core personas with debate enabled, higher tokens, ~10 min target
 */
const DEEP_MODE: RunModeConfig = {
  mode: 'deep',
  personaIds: [
    'cynical_engineer',
    'passionate_pm',
    'pragmatic_investor',
    'ruthless_marketer',
    'agency_owner',
  ],
  maxTokensPerAgent: 4096,
  temperature: 0.7,
  enableDebate: true,
  timeBudgetMs: 600_000, // 10 minutes
  description: 'Deep analysis with debate phase (~10 min)',
};

const MODE_CONFIGS: Record<RunMode, RunModeConfig> = {
  quick: QUICK_MODE,
  deep: DEEP_MODE,
};

export function getRunModeConfig(mode?: RunMode): RunModeConfig {
  return MODE_CONFIGS[mode || 'quick'];
}
