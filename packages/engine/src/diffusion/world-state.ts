import type { AgentOutput, ActionType } from '@simvibe/shared';

export interface WorldState {
  upvotes: number;
  comments: number;
  negativeSignals: number;
  signups: number;
  pays: number;
  bounces: number;
}

export interface ContagionConfig {
  /** Probability uplift per point of social proof (default: 0.02) */
  socialProofUpliftRate: number;
  /** Probability penalty per negative signal (default: 0.03) */
  negativePenaltyRate: number;
  /** Max positive uplift cap (default: 0.15) */
  maxUplift: number;
  /** Max negative penalty cap (default: 0.20) */
  maxPenalty: number;
}

export const DEFAULT_CONTAGION_CONFIG: ContagionConfig = {
  socialProofUpliftRate: 0.02,
  negativePenaltyRate: 0.03,
  maxUplift: 0.15,
  maxPenalty: 0.20,
};

export function createInitialWorldState(): WorldState {
  return {
    upvotes: 0,
    comments: 0,
    negativeSignals: 0,
    signups: 0,
    pays: 0,
    bounces: 0,
  };
}

/**
 * Compute social proof score from world state.
 * Positive signals: upvotes, comments, signups, pays
 * Negative signals: bounces, negative comments
 */
export function computeSocialProofScore(state: WorldState): number {
  const positiveSignals = state.upvotes * 1.0 + state.comments * 0.5 + state.signups * 2.0 + state.pays * 3.0;
  const negativeSignals = state.bounces * 0.5 + state.negativeSignals * 1.5;
  return positiveSignals - negativeSignals;
}

/**
 * Compute probability adjustment based on social proof.
 * Returns a delta to add to base probabilities.
 */
export function computeProbabilityAdjustment(
  socialProofScore: number,
  config: ContagionConfig = DEFAULT_CONTAGION_CONFIG
): { uplift: number; penalty: number } {
  const uplift = Math.min(
    Math.max(0, socialProofScore * config.socialProofUpliftRate),
    config.maxUplift
  );
  const penalty = Math.min(
    Math.max(0, -socialProofScore * config.negativePenaltyRate),
    config.maxPenalty
  );
  return { uplift, penalty };
}

/**
 * Adjust an agent output's action probabilities based on social proof.
 * Returns a new set of action probabilities (does not mutate input).
 */
export function adjustActionProbabilities(
  actions: AgentOutput['action']['actions'],
  socialProofScore: number,
  config: ContagionConfig = DEFAULT_CONTAGION_CONFIG
): { action: ActionType; probability: number; reasoning?: string }[] {
  const { uplift, penalty } = computeProbabilityAdjustment(socialProofScore, config);

  return actions.map(a => {
    let adjustedProb = a.probability;

    if (isPositiveAction(a.action)) {
      adjustedProb = Math.min(1, adjustedProb + uplift);
    }
    if (a.action === 'BOUNCE') {
      adjustedProb = Math.min(1, adjustedProb + penalty);
      adjustedProb = Math.max(0, adjustedProb - uplift * 0.5); // social proof reduces bounce
    }

    return {
      action: a.action,
      probability: Math.max(0, Math.min(1, adjustedProb)),
      reasoning: a.reasoning,
    };
  });
}

/**
 * Update world state based on an agent's primary action.
 */
export function updateWorldState(state: WorldState, output: AgentOutput): WorldState {
  const newState = { ...state };
  const primaryAction = output.action.primaryAction;

  switch (primaryAction) {
    case 'UPVOTE':
      newState.upvotes++;
      break;
    case 'COMMENT':
      newState.comments++;
      // Check if the comment is negative (trust killers > trust boosters)
      if (output.skim.trustKillers.length > output.skim.trustBoosters.length) {
        newState.negativeSignals++;
      }
      break;
    case 'SIGNUP':
      newState.signups++;
      break;
    case 'PAY':
      newState.pays++;
      break;
    case 'BOUNCE':
      newState.bounces++;
      break;
    case 'SHARE':
      newState.upvotes++; // shares count as social proof
      break;
  }

  return newState;
}

function isPositiveAction(action: ActionType): boolean {
  return ['UPVOTE', 'SIGNUP', 'PAY', 'SHARE', 'COMMENT'].includes(action);
}
