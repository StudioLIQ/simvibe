import type { PersonaId, RunMode, PersonaSetName } from '@simvibe/shared';
import { CORE_PERSONA_IDS } from '@simvibe/shared';

export interface RunModeConfig {
  mode: RunMode;
  personaIds: PersonaId[];
  personaSetName: PersonaSetName;
  maxTokensPerAgent: number;
  temperature: number;
  enableDebate: boolean;
  debateRounds: number;
  timeBudgetMs: number;
  maxAgentConcurrency: number;
  perAgentTimeoutMs: number;
  description: string;
}

/**
 * Extended persona IDs for deep mode: diverse perspectives beyond the core 5.
 * These provide end-user, indie founder, community, maker, and frontend architect angles.
 */
const DEEP_EXTRA_PERSONA_IDS: PersonaId[] = [
  'indie_fullstack_builder' as PersonaId,         // Budget-conscious indie hacker
  'scrappy_startup_ops' as PersonaId,              // Early-stage startup operator
  'elite_growth_focused_founder' as PersonaId,     // GTM-first growth founder
  'elite_community_builder_high_signal' as PersonaId, // Community/social perspective
  'ph_grinder_no_code_builder_maker_cosplayer' as PersonaId, // No-code maker/trend follower
  'elite_frontend_architect_perf_a11y' as PersonaId, // Technical quality authority
];

/**
 * nad.fun quick persona IDs: crypto-native core set for token launch evaluation.
 * Covers: smart contract skeptic, crypto community, crypto marketer, pragmatic investor, cynical engineer.
 */
const NAD_FUN_QUICK_PERSONA_IDS: PersonaId[] = [
  'cynical_engineer' as PersonaId,                         // Technical skeptic (shared with core)
  'pragmatic_investor' as PersonaId,                       // Investment/ROI evaluator (shared with core)
  'community_manager_web3' as PersonaId,                   // Web3 community perspective
  'smart_contract_dev' as PersonaId,                       // Onchain skeptic / DeFi engineer
  'ph_grinder_crypto_marketer_comment_grinder' as PersonaId, // Crypto marketing/hype evaluator
];

/**
 * nad.fun deep persona IDs: expanded set with more diverse launch-day archetypes.
 * Adds: early-buyer maker, whale/VC, skeptical economist, security auditor, growth founder, community builder.
 */
const NAD_FUN_DEEP_EXTRA_IDS: PersonaId[] = [
  'ruthless_marketer' as PersonaId,                        // Growth/distribution angle
  'agency_owner' as PersonaId,                             // Business model evaluator
  'skeptical_economist' as PersonaId,                      // Economic skeptic
  'elite_security_engineer_threat_modeler' as PersonaId,   // Security/audit perspective
  'elite_community_builder_high_signal' as PersonaId,      // Community quality signal
  'elite_growth_focused_founder' as PersonaId,             // GTM / launch momentum
  'ph_grinder_crypto_marketer_maker_cosplayer' as PersonaId, // Degen/trend follower
];

/**
 * Named persona sets: curated bundles of persona IDs for each run mode.
 * Adding a new set only requires adding an entry here + referencing it in a mode config.
 */
export const PERSONA_SETS: Record<string, PersonaId[]> = {
  quick: [...CORE_PERSONA_IDS],
  deep: [...CORE_PERSONA_IDS, ...DEEP_EXTRA_PERSONA_IDS],
  nad_fun_quick: [...NAD_FUN_QUICK_PERSONA_IDS],
  nad_fun_deep: [...NAD_FUN_QUICK_PERSONA_IDS, ...NAD_FUN_DEEP_EXTRA_IDS],
};

/**
 * Resolve persona IDs from a set name.
 * Returns undefined if the set name is not found (e.g. 'custom').
 */
export function getPersonaSetIds(setName: PersonaSetName): PersonaId[] | undefined {
  return PERSONA_SETS[setName] ? [...PERSONA_SETS[setName]] : undefined;
}

/**
 * Quick mode: 5 core personas, lower tokens, no debate, ~2 min target
 */
const QUICK_MODE: RunModeConfig = {
  mode: 'quick',
  personaIds: PERSONA_SETS['quick'],
  personaSetName: 'quick',
  maxTokensPerAgent: 2048,
  temperature: 0.7,
  enableDebate: false,
  debateRounds: 0,
  timeBudgetMs: 120_000, // 2 minutes
  maxAgentConcurrency: 5,
  perAgentTimeoutMs: 60_000, // 1 minute per agent
  description: 'Quick scan with 5 core personas (~2 min)',
};

/**
 * Deep mode: 11 personas (5 core + 6 extended) with debate, higher tokens, ~10 min target
 */
const DEEP_MODE: RunModeConfig = {
  mode: 'deep',
  personaIds: PERSONA_SETS['deep'],
  personaSetName: 'deep',
  maxTokensPerAgent: 4096,
  temperature: 0.7,
  enableDebate: true,
  debateRounds: 2,
  timeBudgetMs: 600_000, // 10 minutes
  maxAgentConcurrency: 10,
  perAgentTimeoutMs: 120_000, // 2 minutes per agent
  description: 'Deep analysis with 11 personas + multi-round debate (~10 min)',
};

const MODE_CONFIGS: Record<RunMode, RunModeConfig> = {
  quick: QUICK_MODE,
  deep: DEEP_MODE,
};

export function getRunModeConfig(mode?: RunMode): RunModeConfig {
  return MODE_CONFIGS[mode || 'quick'];
}
