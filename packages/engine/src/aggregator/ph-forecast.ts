import type { AgentOutput, PHForecast, MomentumRisk, PHSubmission, AggregatedMetrics } from '@simvibe/shared';

/**
 * Compute PH-specific forecast from agent outputs and run input.
 * Models: upvote timeline, comment velocity, momentum risks, maker comment impact.
 */
export function computePHForecast(
  outputs: AgentOutput[],
  metrics: AggregatedMetrics,
  phSubmission?: PHSubmission
): PHForecast {
  const validOutputs = outputs.filter(o => !o.isFallback);
  const n = validOutputs.length || 1;

  // --- Upvote timeline ---
  // PH upvote distribution roughly follows: 30% first hour, 60% first 4h, 100% 24h
  const avgUpvoteProb = validOutputs.reduce((sum, o) => {
    const upvote = o.action.actions.find(a => a.action === 'UPVOTE');
    return sum + (upvote?.probability ?? 0);
  }, 0) / n;

  // Scale to approximate PH range: assume 200-agent virtual audience for quick mode
  const virtualAudience = 200;
  const totalExpectedUpvotes = avgUpvoteProb * virtualAudience;
  const firstHour = Math.round(totalExpectedUpvotes * 0.30);
  const first4Hours = Math.round(totalExpectedUpvotes * 0.60);
  const first24Hours = Math.round(totalExpectedUpvotes);

  // --- Comment velocity ---
  const avgCommentProb = validOutputs.reduce((sum, o) => {
    const comment = o.action.actions.find(a => a.action === 'COMMENT');
    return sum + (comment?.probability ?? 0);
  }, 0) / n;

  const expectedComments24h = Math.round(avgCommentProb * virtualAudience);
  // Peak activity hour: PH launches at midnight PT, peak around 9-10 AM PT
  const peakHour = 10;

  // --- Maker comment impact ---
  const makerCommentImpact = assessMakerComment(phSubmission?.makerFirstComment);

  // --- Topic fit ---
  const topicFitScore = assessTopicFit(phSubmission?.topics, validOutputs);

  // --- Momentum risks ---
  const momentumRisks = detectMomentumRisks(
    validOutputs, metrics, phSubmission, makerCommentImpact, topicFitScore
  );

  return {
    upvotesByWindow: { firstHour, first4Hours, first24Hours },
    commentVelocity: { expectedComments24h, peakHour },
    momentumRisks,
    makerCommentImpact,
    topicFitScore,
  };
}

function assessMakerComment(comment?: string): PHForecast['makerCommentImpact'] {
  if (!comment || comment.trim().length === 0) return 'none';
  const length = comment.trim().length;
  if (length < 100) return 'weak';
  // Quality signals: personal pronouns, problem framing, future plans
  const qualitySignals = [
    /\b(I|we|my|our)\b/i,
    /\b(problem|pain|struggle|challenge)\b/i,
    /\b(roadmap|plan|next|future|soon)\b/i,
    /\b(feedback|thoughts|let me know|would love)\b/i,
  ];
  const signalCount = qualitySignals.filter(r => r.test(comment)).length;
  if (length >= 300 && signalCount >= 3) return 'strong';
  if (length >= 150 && signalCount >= 2) return 'moderate';
  return 'weak';
}

function assessTopicFit(
  topics?: string[],
  _outputs?: AgentOutput[]
): number {
  if (!topics || topics.length === 0) return 0.5; // neutral if not specified
  // Simple heuristic: having topics is better than not, 1-3 topics is optimal
  const count = Math.min(topics.length, 3);
  const hasSubstance = topics.every(t => t.trim().length >= 3);
  return hasSubstance ? 0.5 + (count * 0.15) : 0.4 + (count * 0.1);
}

function detectMomentumRisks(
  outputs: AgentOutput[],
  metrics: AggregatedMetrics,
  phSubmission?: PHSubmission,
  makerCommentImpact?: string,
  topicFitScore?: number
): MomentumRisk[] {
  const risks: MomentumRisk[] = [];

  // Risk: No or weak maker comment
  if (!makerCommentImpact || makerCommentImpact === 'none') {
    risks.push({
      flag: 'missing_maker_comment',
      severity: 'high',
      detail: 'No maker first comment provided. PH launches without a personal maker comment get significantly fewer upvotes and comments.',
    });
  } else if (makerCommentImpact === 'weak') {
    risks.push({
      flag: 'weak_maker_comment',
      severity: 'medium',
      detail: 'Maker comment is too short or lacks key elements (personal story, problem framing, roadmap). Strengthen it to boost engagement.',
    });
  }

  // Risk: High bounce rate
  if (metrics.bounceRate > 0.5) {
    risks.push({
      flag: 'high_bounce_risk',
      severity: 'high',
      detail: `Predicted bounce rate ${(metrics.bounceRate * 100).toFixed(0)}% suggests the product card fails to capture initial attention.`,
    });
  }

  // Risk: Low comment engagement
  const avgComment = outputs.reduce((sum, o) => {
    const c = o.action.actions.find(a => a.action === 'COMMENT');
    return sum + (c?.probability ?? 0);
  }, 0) / (outputs.length || 1);
  if (avgComment < 0.15) {
    risks.push({
      flag: 'low_comment_engagement',
      severity: 'medium',
      detail: 'Low expected comment engagement. PH ranking favors products with active discussion threads.',
    });
  }

  // Risk: No topics
  if (!phSubmission?.topics || phSubmission.topics.length === 0) {
    risks.push({
      flag: 'missing_topics',
      severity: 'medium',
      detail: 'No PH topics specified. Topic tagging improves discoverability in PH daily digest and category rankings.',
    });
  }

  // Risk: Low topic fit
  if (topicFitScore !== undefined && topicFitScore < 0.5) {
    risks.push({
      flag: 'weak_topic_fit',
      severity: 'low',
      detail: 'Topic coverage appears thin. Ensure selected topics match the core product category.',
    });
  }

  // Risk: Missing media
  if (!phSubmission?.mediaAssets?.thumbnailUrl && !phSubmission?.mediaAssets?.videoUrl) {
    risks.push({
      flag: 'missing_media',
      severity: 'medium',
      detail: 'No thumbnail or video provided. Visual assets significantly improve PH feed card click-through rates.',
    });
  }

  // Risk: Weak differentiation (lots of "vague_value_prop" friction)
  const vagueCount = outputs.filter(o =>
    o.skim.frictionCategory === 'vague_value_prop' || o.skim.frictionCategory === 'unclear_icp'
  ).length;
  if (vagueCount >= Math.ceil(outputs.length * 0.5)) {
    risks.push({
      flag: 'weak_differentiation',
      severity: 'high',
      detail: 'Majority of personas flagged unclear value prop or ICP. This predicts poor early-momentum on PH.',
    });
  }

  return risks;
}
