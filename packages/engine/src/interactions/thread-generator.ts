import type {
  AgentOutput,
  PersonaId,
  ConversationDynamics,
  ThreadComment,
  InfluenceEdge,
  SentimentShift,
  CascadeTrigger,
} from '@simvibe/shared';

/**
 * Influence profile for a persona based on their agent output.
 * Higher skepticism = more influential objections.
 */
interface PersonaProfile {
  id: PersonaId;
  sentiment: 'positive' | 'neutral' | 'negative';
  influence: number; // 0-1 base influence weight
  concerns: string[];
  boosters: string[];
  primaryFriction: string;
  primaryAction: string;
  bounceProb: number;
}

function hashForSeed(a: string, b: string): number {
  let hash = 5381;
  const combined = `${a}|${b}`;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildProfile(output: AgentOutput): PersonaProfile {
  const bounceProb = output.action.actions.find(a => a.action === 'BOUNCE')?.probability ?? 0.5;
  const upvoteProb = output.action.actions.find(a => a.action === 'UPVOTE')?.probability ?? 0;

  // Determine overall sentiment from action probabilities
  let sentiment: PersonaProfile['sentiment'] = 'neutral';
  if (bounceProb > 0.5) sentiment = 'negative';
  else if (upvoteProb > 0.4 || bounceProb < 0.2) sentiment = 'positive';

  // Influence correlates with having strong concerns (more critical = more influential in discussions)
  const concernCount = output.skim.trustKillers.length;
  const influence = Math.min(1, 0.3 + concernCount * 0.15 + (bounceProb > 0.3 ? 0.1 : 0));

  return {
    id: output.personaId,
    sentiment,
    influence,
    concerns: output.skim.trustKillers,
    boosters: output.skim.trustBoosters,
    primaryFriction: output.skim.primaryFriction,
    primaryAction: output.action.primaryAction,
    bounceProb,
  };
}

function generateInitialComment(profile: PersonaProfile, idx: number): ThreadComment {
  // Initial comment is based on their primary evaluation
  const content = profile.sentiment === 'negative'
    ? `My main concern: ${profile.primaryFriction}`
    : profile.sentiment === 'positive'
      ? `This looks promising. ${profile.boosters[0] || 'Interesting approach.'} Though I wonder about ${profile.concerns[0] || 'long-term viability'}.`
      : `Mixed feelings. ${profile.boosters[0] || 'Has potential'}, but ${profile.concerns[0] || 'needs more evidence'}.`;

  return {
    id: `comment_${profile.id}_${idx}`,
    personaId: profile.id,
    parentId: null,
    content,
    sentiment: profile.sentiment,
    trigger: profile.primaryFriction,
    timestamp: idx,
  };
}

function generateReply(
  replier: PersonaProfile,
  target: ThreadComment,
  targetProfile: PersonaProfile,
  commentIdx: number
): ThreadComment | null {
  // Skip self-replies
  if (replier.id === target.personaId) return null;

  // Determine if replier would engage with this comment
  const seed = hashForSeed(replier.id, target.id);
  const engagementThreshold = 0.4;
  const engagementScore = (seed % 100) / 100;
  if (engagementScore > engagementThreshold + replier.influence * 0.3) return null;

  // Determine reply sentiment based on agreement/disagreement
  const agrees = replier.sentiment === target.sentiment;
  const replySentiment = agrees
    ? target.sentiment
    : (replier.sentiment === 'negative' ? 'negative' : 'neutral');

  let content: string;
  if (agrees && target.sentiment === 'negative') {
    content = `Agree with @${targetProfile.id} — ${replier.concerns[0] || replier.primaryFriction} is a real blocker.`;
  } else if (agrees && target.sentiment === 'positive') {
    content = `+1 to @${targetProfile.id}. ${replier.boosters[0] || 'The approach is solid'} stands out.`;
  } else if (!agrees && replier.sentiment === 'positive') {
    content = `Counterpoint to @${targetProfile.id}: ${replier.boosters[0] || 'there are strong signals here'}. The concern about "${target.trigger}" may be addressable.`;
  } else {
    content = `Pushing back on @${targetProfile.id}: ${replier.concerns[0] || replier.primaryFriction}. That matters more than the positives mentioned.`;
  }

  return {
    id: `reply_${replier.id}_${target.id}_${commentIdx}`,
    personaId: replier.id,
    parentId: target.id,
    content,
    sentiment: replySentiment as ThreadComment['sentiment'],
    trigger: agrees ? target.trigger : replier.primaryFriction,
    timestamp: commentIdx,
  };
}

function computeInfluenceEdges(
  profiles: PersonaProfile[],
  comments: ThreadComment[]
): InfluenceEdge[] {
  const edges: InfluenceEdge[] = [];
  const replies = comments.filter(c => c.parentId !== null);

  for (const reply of replies) {
    const parent = comments.find(c => c.id === reply.parentId);
    if (!parent) continue;

    const replierProfile = profiles.find(p => p.id === reply.personaId);
    const parentProfile = profiles.find(p => p.id === parent.personaId);
    if (!replierProfile || !parentProfile) continue;

    const agrees = reply.sentiment === parent.sentiment;
    const weight = agrees
      ? replierProfile.influence * 0.5
      : -replierProfile.influence * 0.7;

    edges.push({
      from: reply.personaId,
      to: parent.personaId,
      weight: Math.max(-1, Math.min(1, weight)),
      reason: agrees
        ? `${reply.personaId} reinforced ${parent.personaId}'s position`
        : `${reply.personaId} challenged ${parent.personaId}'s stance`,
    });
  }

  return edges;
}

function detectSentimentShifts(
  profiles: PersonaProfile[],
  influenceEdges: InfluenceEdge[],
  comments: ThreadComment[]
): SentimentShift[] {
  const shifts: SentimentShift[] = [];

  // Group influence by target persona
  const influenceByTarget = new Map<string, InfluenceEdge[]>();
  for (const edge of influenceEdges) {
    const existing = influenceByTarget.get(edge.to) ?? [];
    existing.push(edge);
    influenceByTarget.set(edge.to, existing);
  }

  for (const [targetId, edges] of influenceByTarget) {
    const totalInfluence = edges.reduce((sum, e) => sum + e.weight, 0);
    if (Math.abs(totalInfluence) < 0.2) continue; // too small to shift

    const strongestEdge = edges.reduce((best, e) =>
      Math.abs(e.weight) > Math.abs(best.weight) ? e : best
    );

    const relatedComment = comments.find(
      c => c.personaId === strongestEdge.from && c.parentId !== null
    );

    shifts.push({
      personaId: targetId as PersonaId,
      triggeredBy: strongestEdge.from,
      commentId: relatedComment?.id ?? strongestEdge.from,
      direction: totalInfluence > 0 ? 'more_positive' : 'more_negative',
      magnitude: Math.min(1, Math.abs(totalInfluence)),
      reason: strongestEdge.reason,
    });
  }

  return shifts;
}

function detectCascadeTriggers(
  comments: ThreadComment[],
  influenceEdges: InfluenceEdge[],
  profiles: PersonaProfile[]
): CascadeTrigger[] {
  const triggers: CascadeTrigger[] = [];

  // Find comments that generated the most replies/influence
  const rootComments = comments.filter(c => c.parentId === null);
  for (const root of rootComments) {
    const replies = comments.filter(c => c.parentId === root.id);
    if (replies.length < 2) continue;

    const affectedPersonas = replies.map(r => r.personaId);
    const negativeReplies = replies.filter(r => r.sentiment === 'negative').length;
    const impact = negativeReplies > replies.length / 2 ? 'negative' : 'positive';

    triggers.push({
      commentId: root.id,
      personaId: root.personaId,
      impact,
      affectedPersonas,
      description: `${root.personaId}'s comment about "${root.trigger}" triggered ${replies.length} responses (${impact} cascade)`,
    });
  }

  // Sort by number of affected personas
  triggers.sort((a, b) => b.affectedPersonas.length - a.affectedPersonas.length);

  return triggers;
}

function identifyDisagreements(
  profiles: PersonaProfile[],
  comments: ThreadComment[]
): ConversationDynamics['disagreementResolution'] {
  // Group by friction category/trigger and detect disagreement
  const frictionGroups = new Map<string, PersonaProfile[]>();
  for (const p of profiles) {
    const key = p.primaryFriction.slice(0, 50);
    const existing = frictionGroups.get(key) ?? [];
    existing.push(p);
    frictionGroups.set(key, existing);
  }

  const resolutions: ConversationDynamics['disagreementResolution'] = [];
  for (const [topic, personas] of frictionGroups) {
    if (personas.length < 2) continue;

    const positives = personas.filter(p => p.sentiment === 'positive');
    const negatives = personas.filter(p => p.sentiment === 'negative');

    if (positives.length > 0 && negatives.length > 0) {
      // Real disagreement
      const resolvedToward = negatives.length > positives.length ? 'negative' : 'positive';
      const keyComment = comments.find(c =>
        personas.some(p => p.id === c.personaId) && c.parentId !== null
      );

      resolutions.push({
        topic,
        initialDisagreement: personas.map(p => p.id),
        resolvedToward: resolvedToward as 'positive' | 'negative',
        keyComment: keyComment?.content,
      });
    }
  }

  return resolutions;
}

/**
 * Generate conversation dynamics from agent outputs.
 * Models threaded comment interactions, influence, sentiment shifts, and cascades.
 */
export function generateConversationDynamics(
  outputs: AgentOutput[]
): ConversationDynamics {
  if (outputs.length < 2) {
    return {
      comments: [],
      influenceEdges: [],
      sentimentShifts: [],
      cascadeTriggers: [],
      topPersuasiveComments: [],
      disagreementResolution: [],
    };
  }

  const profiles = outputs.filter(o => !o.isFallback).map(buildProfile);
  const comments: ThreadComment[] = [];
  let commentIdx = 0;

  // Phase 1: Each persona posts an initial comment
  for (const profile of profiles) {
    comments.push(generateInitialComment(profile, commentIdx++));
  }

  // Phase 2: Personas reply to each other's comments
  const rootComments = [...comments];
  for (const root of rootComments) {
    const targetProfile = profiles.find(p => p.id === root.personaId);
    if (!targetProfile) continue;

    for (const replier of profiles) {
      const reply = generateReply(replier, root, targetProfile, commentIdx);
      if (reply) {
        comments.push(reply);
        commentIdx++;
      }
    }
  }

  // Phase 3: Compute influence edges
  const influenceEdges = computeInfluenceEdges(profiles, comments);

  // Phase 4: Detect sentiment shifts
  const sentimentShifts = detectSentimentShifts(profiles, influenceEdges, comments);

  // Phase 5: Detect cascade triggers
  const cascadeTriggers = detectCascadeTriggers(comments, influenceEdges, profiles);

  // Phase 6: Identify top persuasive comments
  const commentInfluence = new Map<string, number>();
  for (const edge of influenceEdges) {
    const reply = comments.find(c =>
      c.personaId === edge.from && c.parentId !== null
    );
    if (reply) {
      commentInfluence.set(
        reply.id,
        (commentInfluence.get(reply.id) ?? 0) + Math.abs(edge.weight)
      );
    }
  }

  const topPersuasiveComments = Array.from(commentInfluence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([commentId, score]) => {
      const comment = comments.find(c => c.id === commentId)!;
      return {
        commentId,
        personaId: comment.personaId,
        influenceScore: Math.round(score * 100) / 100,
        content: comment.content,
      };
    });

  // Phase 7: Disagreement resolution
  const disagreementResolution = identifyDisagreements(profiles, comments);

  return {
    comments,
    influenceEdges,
    sentimentShifts,
    cascadeTriggers,
    topPersuasiveComments,
    disagreementResolution,
  };
}
