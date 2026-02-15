import type { AgentOutput, NadFunForecast, NadFunRiskItem, AggregatedMetrics, RunInput } from '@simvibe/shared';

/**
 * Compute nad.fun-specific launch forecast from agent outputs and run input.
 * Models: buy intent, hold intent, early churn risk, snipe/dump risk,
 * community spread potential, narrative strength, tokenomics clarity.
 */
export function computeNadFunForecast(
  outputs: AgentOutput[],
  metrics: AggregatedMetrics,
  runInput?: RunInput
): NadFunForecast {
  const validOutputs = outputs.filter(o => !o.isFallback);
  const n = validOutputs.length || 1;

  // --- Buy intent ---
  // Derived from PAY + SIGNUP probabilities (proxy for purchase willingness)
  const avgPayProb = validOutputs.reduce((sum, o) => {
    const pay = o.action.actions.find(a => a.action === 'PAY');
    return sum + (pay?.probability ?? 0);
  }, 0) / n;
  const avgSignupProb = validOutputs.reduce((sum, o) => {
    const signup = o.action.actions.find(a => a.action === 'SIGNUP');
    return sum + (signup?.probability ?? 0);
  }, 0) / n;
  const buyIntent = Math.min(1, avgPayProb * 0.6 + avgSignupProb * 0.4);

  // --- Hold intent ---
  // Inverse of bounce + weight on trust boosters vs killers
  const avgBounceProb = validOutputs.reduce((sum, o) => {
    const bounce = o.action.actions.find(a => a.action === 'BOUNCE');
    return sum + (bounce?.probability ?? 0);
  }, 0) / n;
  const avgTrustBoosterCount = validOutputs.reduce(
    (sum, o) => sum + o.skim.trustBoosters.length, 0
  ) / n;
  const avgTrustKillerCount = validOutputs.reduce(
    (sum, o) => sum + o.skim.trustKillers.length, 0
  ) / n;
  const trustRatio = avgTrustBoosterCount / Math.max(1, avgTrustBoosterCount + avgTrustKillerCount);
  const holdIntent = Math.min(1, Math.max(0,
    (1 - avgBounceProb) * 0.5 + trustRatio * 0.3 + avgPayProb * 0.2
  ));

  // --- Early churn risk ---
  // High bounce + low trust boosters + pricing concerns = early dump
  const pricingFrictionCount = validOutputs.filter(
    o => o.skim.frictionCategory === 'pricing_concern'
  ).length;
  const pricingPenalty = Math.min(0.3, (pricingFrictionCount / n) * 0.4);
  const earlyChurnRisk = Math.min(1, Math.max(0,
    avgBounceProb * 0.5 + (1 - trustRatio) * 0.2 + pricingPenalty + metrics.uncertaintyScore * 0.1
  ));

  // --- Snipe/dump risk ---
  // High if: vague value prop, unclear ICP, weak differentiation, high disagreement
  const vagueCount = validOutputs.filter(
    o => o.skim.frictionCategory === 'vague_value_prop' || o.skim.frictionCategory === 'unclear_icp'
  ).length;
  const vagueRatio = vagueCount / n;
  const snipeDumpRisk = Math.min(1, Math.max(0,
    vagueRatio * 0.4 + metrics.disagreementScore * 0.3 + earlyChurnRisk * 0.2 + (1 - buyIntent) * 0.1
  ));

  // --- Community spread potential ---
  // SHARE + COMMENT + UPVOTE probabilities combined
  const avgShareProb = validOutputs.reduce((sum, o) => {
    const share = o.action.actions.find(a => a.action === 'SHARE');
    return sum + (share?.probability ?? 0);
  }, 0) / n;
  const avgCommentProb = validOutputs.reduce((sum, o) => {
    const comment = o.action.actions.find(a => a.action === 'COMMENT');
    return sum + (comment?.probability ?? 0);
  }, 0) / n;
  const avgUpvoteProb = validOutputs.reduce((sum, o) => {
    const upvote = o.action.actions.find(a => a.action === 'UPVOTE');
    return sum + (upvote?.probability ?? 0);
  }, 0) / n;
  const communitySpreadPotential = Math.min(1, Math.max(0,
    avgShareProb * 0.4 + avgCommentProb * 0.3 + avgUpvoteProb * 0.2 + trustRatio * 0.1
  ));

  // --- Narrative strength ---
  const narrativeStrength = assessNarrativeStrength(validOutputs, runInput);

  // --- Tokenomics clarity ---
  const tokenomicsClarity = assessTokenomicsClarity(validOutputs, runInput);

  // --- Launch viability score (0-100) ---
  // Weighted composite favoring buy+hold and penalizing churn+snipe risk
  const launchViabilityScore = Math.round(Math.max(0, Math.min(100,
    buyIntent * 25 +
    holdIntent * 25 +
    (1 - earlyChurnRisk) * 20 +
    (1 - snipeDumpRisk) * 15 +
    communitySpreadPotential * 15
  )));

  // --- Risk signals ---
  const risks = detectNadFunRisks(
    validOutputs, metrics, buyIntent, holdIntent,
    earlyChurnRisk, snipeDumpRisk, communitySpreadPotential,
    narrativeStrength, tokenomicsClarity
  );

  return {
    buyIntent: round3(buyIntent),
    holdIntent: round3(holdIntent),
    earlyChurnRisk: round3(earlyChurnRisk),
    snipeDumpRisk: round3(snipeDumpRisk),
    communitySpreadPotential: round3(communitySpreadPotential),
    launchViabilityScore,
    risks,
    narrativeStrength,
    tokenomicsClarity: round3(tokenomicsClarity),
  };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function assessNarrativeStrength(
  outputs: AgentOutput[],
  runInput?: RunInput
): NadFunForecast['narrativeStrength'] {
  if (!runInput) return 'none';

  const tagline = runInput.tagline || '';
  const description = runInput.description || '';
  const combined = `${tagline} ${description}`;

  // Quality signals for token launch narrative
  const signals = [
    /\b(problem|solve|fix|unlock|enable)\b/i,
    /\b(community|together|collective|decentralized|dao)\b/i,
    /\b(token|launch|mint|liquidity)\b/i,
    /\b(unique|first|only|novel|innovative)\b/i,
    /\b(roadmap|plan|milestone|phase)\b/i,
  ];
  const signalCount = signals.filter(r => r.test(combined)).length;

  // Factor in trust boosters from agent analysis
  const avgTrustBoosters = outputs.reduce(
    (sum, o) => sum + o.skim.trustBoosters.length, 0
  ) / (outputs.length || 1);

  if (signalCount >= 4 && avgTrustBoosters >= 2 && combined.length >= 200) return 'strong';
  if (signalCount >= 2 && avgTrustBoosters >= 1 && combined.length >= 80) return 'moderate';
  if (signalCount >= 1 || combined.length >= 40) return 'weak';
  return 'none';
}

function assessTokenomicsClarity(
  outputs: AgentOutput[],
  runInput?: RunInput
): number {
  let score = 0.3; // baseline

  if (runInput) {
    const combined = `${runInput.tagline || ''} ${runInput.description || ''}`;
    // Check for pricing/tokenomics mentions
    if (/\b(pric|cost|free|tier|plan|subscription|token(omics)?|supply|burn|utility)\b/i.test(combined)) {
      score += 0.2;
    }
    if (runInput.pricingModel) {
      score += 0.15;
    }
  }

  // Low pricing friction from agents = clearer tokenomics
  const pricingFrictionRatio = outputs.filter(
    o => o.skim.frictionCategory === 'pricing_concern'
  ).length / (outputs.length || 1);
  score += (1 - pricingFrictionRatio) * 0.2;

  // Trust boosters mentioning value clarity
  const boosterCount = outputs.reduce(
    (sum, o) => sum + o.skim.trustBoosters.length, 0
  );
  score += Math.min(0.15, boosterCount * 0.02);

  return Math.min(1, Math.max(0, score));
}

function detectNadFunRisks(
  outputs: AgentOutput[],
  metrics: AggregatedMetrics,
  buyIntent: number,
  holdIntent: number,
  earlyChurnRisk: number,
  snipeDumpRisk: number,
  communitySpreadPotential: number,
  narrativeStrength: string,
  tokenomicsClarity: number,
): NadFunRiskItem[] {
  const risks: NadFunRiskItem[] = [];
  const n = outputs.length || 1;

  // Risk: Low buy intent
  if (buyIntent < 0.2) {
    risks.push({
      flag: 'low_buy_intent',
      severity: 'high',
      detail: `Buy intent at ${(buyIntent * 100).toFixed(0)}% — most participants unlikely to acquire token at launch.`,
    });
  } else if (buyIntent < 0.35) {
    risks.push({
      flag: 'weak_buy_intent',
      severity: 'medium',
      detail: `Buy intent at ${(buyIntent * 100).toFixed(0)}% — below threshold for strong launch momentum.`,
    });
  }

  // Risk: Low hold intent (flip risk)
  if (holdIntent < 0.25) {
    risks.push({
      flag: 'low_hold_intent',
      severity: 'high',
      detail: `Hold intent at ${(holdIntent * 100).toFixed(0)}% — high likelihood of immediate selling after launch.`,
    });
  }

  // Risk: High early churn
  if (earlyChurnRisk > 0.6) {
    risks.push({
      flag: 'high_early_churn',
      severity: 'high',
      detail: `Early churn risk at ${(earlyChurnRisk * 100).toFixed(0)}% — token may face rapid post-launch sell pressure.`,
    });
  } else if (earlyChurnRisk > 0.4) {
    risks.push({
      flag: 'moderate_early_churn',
      severity: 'medium',
      detail: `Early churn risk at ${(earlyChurnRisk * 100).toFixed(0)}% — some post-launch selling pressure expected.`,
    });
  }

  // Risk: High snipe/dump exposure
  if (snipeDumpRisk > 0.5) {
    risks.push({
      flag: 'high_snipe_dump_risk',
      severity: 'high',
      detail: `Snipe/dump risk at ${(snipeDumpRisk * 100).toFixed(0)}% — vague positioning invites speculative sniping.`,
    });
  }

  // Risk: Weak community spread
  if (communitySpreadPotential < 0.15) {
    risks.push({
      flag: 'low_community_spread',
      severity: 'high',
      detail: 'Low community spread potential — launch unlikely to generate organic social amplification.',
    });
  } else if (communitySpreadPotential < 0.3) {
    risks.push({
      flag: 'weak_community_spread',
      severity: 'medium',
      detail: 'Moderate community spread potential — consider strengthening shareable narrative hooks.',
    });
  }

  // Risk: Weak or missing narrative
  if (narrativeStrength === 'none') {
    risks.push({
      flag: 'missing_narrative',
      severity: 'high',
      detail: 'No launch narrative detected — token launches without a story struggle to gain initial attention.',
    });
  } else if (narrativeStrength === 'weak') {
    risks.push({
      flag: 'weak_narrative',
      severity: 'medium',
      detail: 'Launch narrative is thin — add problem framing, community angle, or unique differentiator.',
    });
  }

  // Risk: Unclear tokenomics
  if (tokenomicsClarity < 0.35) {
    risks.push({
      flag: 'unclear_tokenomics',
      severity: 'high',
      detail: 'Token economics are unclear — buyers need to understand utility, supply, and value accrual.',
    });
  } else if (tokenomicsClarity < 0.5) {
    risks.push({
      flag: 'vague_tokenomics',
      severity: 'medium',
      detail: 'Token economics are vague — clarify pricing model and token utility.',
    });
  }

  // Risk: High disagreement among agents
  if (metrics.disagreementScore > 0.6) {
    risks.push({
      flag: 'high_market_disagreement',
      severity: 'medium',
      detail: `Market disagreement at ${(metrics.disagreementScore * 100).toFixed(0)}% — polarized reception predicts volatile early trading.`,
    });
  }

  // Risk: Weak differentiation
  const vagueCount = outputs.filter(
    o => o.skim.frictionCategory === 'vague_value_prop' || o.skim.frictionCategory === 'unclear_icp'
  ).length;
  if (vagueCount >= Math.ceil(n * 0.5)) {
    risks.push({
      flag: 'weak_differentiation',
      severity: 'high',
      detail: 'Majority of participants flagged unclear value prop — token will be seen as yet another memecoin.',
    });
  }

  return risks;
}
