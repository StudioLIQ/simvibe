import type {
  AgentOutput,
  AggregatedMetrics,
  FrictionItem,
  PersonaId,
  TractionBand,
  ConfidenceLevel,
  ScoreBreakdown,
} from '@simvibe/shared';

export interface AggregationResult {
  metrics: AggregatedMetrics;
  tractionBand: TractionBand;
  confidence: ConfidenceLevel;
  scores: ScoreBreakdown;
  overallScore: number;
  frictionList: FrictionItem[];
  warnings: string[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => (v - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}

function extractActionProbability(output: AgentOutput, action: string): number {
  const found = output.action.actions.find(a => a.action === action);
  return found?.probability ?? 0;
}

export function aggregateMetrics(outputs: AgentOutput[]): AggregatedMetrics {
  const validOutputs = outputs.filter(o => !o.isFallback);

  if (validOutputs.length === 0) {
    return {
      expectedUpvotes: 0,
      expectedSignups: 0,
      expectedPays: 0,
      bounceRate: 1,
      shareRate: 0,
      disagreementScore: 1,
      uncertaintyScore: 1,
    };
  }

  const upvoteProbs = validOutputs.map(o => extractActionProbability(o, 'UPVOTE'));
  const signupProbs = validOutputs.map(o => extractActionProbability(o, 'SIGNUP'));
  const payProbs = validOutputs.map(o => extractActionProbability(o, 'PAY'));
  const bounceProbs = validOutputs.map(o => extractActionProbability(o, 'BOUNCE'));
  const shareProbs = validOutputs.map(o => extractActionProbability(o, 'SHARE'));

  const expectedUpvotes = upvoteProbs.reduce((sum, p) => sum + p, 0);
  const expectedSignups = mean(signupProbs);
  const expectedPays = mean(payProbs);
  const bounceRate = mean(bounceProbs);
  const shareRate = mean(shareProbs);

  const allProbs = [
    ...upvoteProbs,
    ...signupProbs,
    ...payProbs,
  ];
  const disagreementScore = Math.min(1, stdDev(allProbs) * 2);

  const fallbackCount = outputs.filter(o => o.isFallback).length;
  const uncertaintyScore = Math.min(1, (fallbackCount / outputs.length) + disagreementScore * 0.5);

  return {
    expectedUpvotes,
    expectedSignups,
    expectedPays,
    bounceRate,
    shareRate,
    disagreementScore,
    uncertaintyScore,
  };
}

export function determineTractionBand(metrics: AggregatedMetrics): TractionBand {
  const score = (
    metrics.expectedUpvotes * 0.2 +
    metrics.expectedSignups * 0.4 +
    metrics.expectedPays * 0.3 -
    metrics.bounceRate * 0.3
  );

  if (score >= 0.7) return 'very_high';
  if (score >= 0.5) return 'high';
  if (score >= 0.3) return 'moderate';
  if (score >= 0.1) return 'low';
  return 'very_low';
}

export function determineConfidence(metrics: AggregatedMetrics, outputs: AgentOutput[]): ConfidenceLevel {
  const fallbackRatio = outputs.filter(o => o.isFallback).length / outputs.length;

  if (fallbackRatio > 0.5 || metrics.uncertaintyScore > 0.7) {
    return 'low';
  }
  if (fallbackRatio > 0.2 || metrics.uncertaintyScore > 0.4) {
    return 'medium';
  }
  return 'high';
}

export function extractFrictions(outputs: AgentOutput[]): FrictionItem[] {
  const frictionMap = new Map<string, {
    trigger: string;
    category: string;
    evidence: string[];
    agentsCiting: PersonaId[];
    count: number;
  }>();

  for (const output of outputs) {
    if (output.isFallback) continue;

    const key = `${output.skim.frictionCategory}:${output.skim.primaryFriction.toLowerCase().trim().slice(0, 50)}`;

    const existing = frictionMap.get(key);
    if (existing) {
      existing.evidence.push(`${output.personaId}: "${output.skim.primaryFriction}"`);
      existing.agentsCiting.push(output.personaId);
      existing.count++;
    } else {
      frictionMap.set(key, {
        trigger: output.skim.primaryFriction,
        category: output.skim.frictionCategory,
        evidence: [`${output.personaId}: "${output.skim.primaryFriction}"`],
        agentsCiting: [output.personaId],
        count: 1,
      });
    }

    for (const killer of output.skim.trustKillers) {
      const killerKey = `trust_gap:${killer.toLowerCase().trim().slice(0, 50)}`;
      const existingKiller = frictionMap.get(killerKey);
      if (existingKiller) {
        existingKiller.evidence.push(`${output.personaId}: "${killer}"`);
        if (!existingKiller.agentsCiting.includes(output.personaId)) {
          existingKiller.agentsCiting.push(output.personaId);
        }
        existingKiller.count++;
      } else {
        frictionMap.set(killerKey, {
          trigger: killer,
          category: 'trust_gap',
          evidence: [`${output.personaId}: "${killer}"`],
          agentsCiting: [output.personaId],
          count: 1,
        });
      }
    }
  }

  const frictions = Array.from(frictionMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((f, i): FrictionItem => ({
      rank: i + 1,
      trigger: f.trigger,
      category: f.category,
      evidence: f.evidence,
      agentsCiting: f.agentsCiting,
      severity: Math.min(1, f.count / outputs.length + 0.2),
    }));

  return frictions;
}

export function calculateScores(outputs: AgentOutput[], metrics: AggregatedMetrics): ScoreBreakdown {
  const validOutputs = outputs.filter(o => !o.isFallback);

  if (validOutputs.length === 0) {
    return {
      clarity: 30,
      credibility: 30,
      differentiation: 30,
      pricingFraming: 30,
      conversionReadiness: 30,
    };
  }

  const frictionCategories = validOutputs.map(o => o.skim.frictionCategory);

  const clarityPenalty = frictionCategories.filter(c =>
    c === 'unclear_icp' || c === 'vague_value_prop'
  ).length * 15;

  const credibilityPenalty = frictionCategories.filter(c =>
    c === 'missing_proof' || c === 'trust_gap'
  ).length * 15;

  const pricingPenalty = frictionCategories.filter(c =>
    c === 'pricing_concern'
  ).length * 20;

  const technicalPenalty = frictionCategories.filter(c =>
    c === 'technical_doubt'
  ).length * 10;

  const onboardingPenalty = frictionCategories.filter(c =>
    c === 'onboarding_friction'
  ).length * 10;

  const trustBoosterCount = validOutputs.reduce(
    (sum, o) => sum + o.skim.trustBoosters.length,
    0
  );
  const trustBoost = Math.min(30, trustBoosterCount * 5);

  return {
    clarity: Math.max(0, Math.min(100, 70 - clarityPenalty + trustBoost * 0.3)),
    credibility: Math.max(0, Math.min(100, 70 - credibilityPenalty + trustBoost * 0.5)),
    differentiation: Math.max(0, Math.min(100, 60 - technicalPenalty + (1 - metrics.bounceRate) * 30)),
    pricingFraming: Math.max(0, Math.min(100, 70 - pricingPenalty + metrics.expectedPays * 30)),
    conversionReadiness: Math.max(0, Math.min(100, 50 - onboardingPenalty + metrics.expectedSignups * 40)),
  };
}

export function aggregateOutputs(outputs: AgentOutput[]): AggregationResult {
  const metrics = aggregateMetrics(outputs);
  const tractionBand = determineTractionBand(metrics);
  const confidence = determineConfidence(metrics, outputs);
  const frictionList = extractFrictions(outputs);
  const scores = calculateScores(outputs, metrics);

  const overallScore = Math.round(
    (scores.clarity + scores.credibility + scores.differentiation +
     scores.pricingFraming + scores.conversionReadiness) / 5
  );

  const warnings: string[] = [];
  const fallbackCount = outputs.filter(o => o.isFallback).length;
  if (fallbackCount > 0) {
    warnings.push(`${fallbackCount} of ${outputs.length} agents used fallback output`);
  }
  if (metrics.uncertaintyScore > 0.5) {
    warnings.push('High uncertainty in results - interpret with caution');
  }
  if (frictionList.length === 0) {
    warnings.push('No friction points identified - results may be incomplete');
  }

  return {
    metrics,
    tractionBand,
    confidence,
    scores,
    overallScore,
    frictionList,
    warnings,
  };
}
