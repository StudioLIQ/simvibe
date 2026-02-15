import type {
  AgentOutput,
  FrictionItem,
  LaunchPack,
  TaglineCandidate,
  DescriptionCandidate,
  MakerCommentRewrite,
  ObjectionSnippet,
  PHSubmission,
  RunInput,
} from '@simvibe/shared';

/**
 * Generate a PH launch report pack from agent outputs and friction findings.
 * Produces submission-ready artifacts traceable to friction findings.
 */
export function generateLaunchPack(
  input: RunInput,
  outputs: AgentOutput[],
  frictionList: FrictionItem[],
  phSubmission?: PHSubmission
): LaunchPack {
  const validOutputs = outputs.filter(o => !o.isFallback);
  const topFrictions = frictionList.slice(0, 5);

  return {
    taglineCandidates: generateTaglineCandidates(input, topFrictions, validOutputs),
    descriptionCandidates: generateDescriptionCandidates(input, topFrictions),
    makerCommentRewrites: generateMakerCommentRewrites(input, topFrictions, phSubmission),
    objectionHandling: generateObjectionSnippets(validOutputs, topFrictions),
    generatedAt: new Date().toISOString(),
  };
}

function generateTaglineCandidates(
  input: RunInput,
  frictions: FrictionItem[],
  outputs: AgentOutput[]
): TaglineCandidate[] {
  const candidates: TaglineCandidate[] = [];
  const original = input.tagline;

  // Candidate 1: ICP-focused variant (address unclear_icp friction)
  const icpFriction = frictions.find(f => f.category === 'unclear_icp');
  candidates.push({
    tagline: addICPSpecificity(original),
    rationale: 'Adds explicit ICP targeting to reduce "who is this for?" bounce',
    addressesFriction: icpFriction?.trigger ?? 'unclear_icp',
  });

  // Candidate 2: Proof-oriented variant (address missing_proof friction)
  const proofFriction = frictions.find(f => f.category === 'missing_proof');
  candidates.push({
    tagline: addProofSignal(original),
    rationale: 'Embeds a credibility signal directly in the tagline',
    addressesFriction: proofFriction?.trigger ?? 'missing_proof',
  });

  // Candidate 3: Outcome-focused variant (based on top one-line fixes)
  const topFixes = outputs.map(o => o.action.oneLineFix).filter(Boolean);
  candidates.push({
    tagline: makeOutcomeFocused(original),
    rationale: 'Reframes around the concrete outcome rather than the tool feature',
    addressesFriction: topFixes[0] ?? 'vague_value_prop',
  });

  return candidates;
}

function addICPSpecificity(tagline: string): string {
  // Heuristic: if tagline doesn't mention "for X", add a target
  if (/\bfor\b/i.test(tagline)) return tagline;
  return `${tagline} — built for teams shipping fast`;
}

function addProofSignal(tagline: string): string {
  // Add a concrete proof point
  if (tagline.length > 50) {
    return tagline.replace(/[.!]?$/, ' — used by 100+ teams');
  }
  return `${tagline}. Trusted by early adopters`;
}

function makeOutcomeFocused(tagline: string): string {
  // Strip feature language and focus on outcome
  const cleaned = tagline.replace(/\b(AI-powered|automated|intelligent)\b/gi, '').trim();
  return cleaned.length < tagline.length
    ? `${cleaned} — measurable results from day one`
    : `${tagline} — see results in minutes`;
}

function generateDescriptionCandidates(
  input: RunInput,
  frictions: FrictionItem[]
): DescriptionCandidate[] {
  const candidates: DescriptionCandidate[] = [];
  const desc = input.description;

  // Candidate 1: Problem-first framing
  candidates.push({
    description: `The problem: ${extractCoreProblem(desc)}. ${desc.slice(0, 200)}`,
    rationale: 'Leads with the pain point to create immediate relevance',
    focusArea: 'problem_framing',
  });

  // Candidate 2: Social proof + specifics
  const topFriction = frictions[0];
  candidates.push({
    description: `${desc.slice(0, 150)}. Built to solve "${topFriction?.trigger ?? 'the core friction'}" that ${topFriction?.agentsCiting?.length ?? 'multiple'} evaluators flagged.`,
    rationale: 'Acknowledges friction findings and shows iteration awareness',
    focusArea: 'credibility',
  });

  // Candidate 3: Differentiation-focused
  candidates.push({
    description: `Unlike other solutions, ${desc.slice(0, 180)}. The difference: concrete outcomes you can measure.`,
    rationale: 'Explicitly positions against alternatives to reduce "yet another X" objection',
    focusArea: 'differentiation',
  });

  return candidates;
}

function extractCoreProblem(description: string): string {
  // Extract first sentence or phrase that sounds like a problem
  const firstSentence = description.split(/[.!?]/)[0] || description.slice(0, 80);
  return firstSentence.trim();
}

function generateMakerCommentRewrites(
  input: RunInput,
  frictions: FrictionItem[],
  phSubmission?: PHSubmission
): MakerCommentRewrite[] {
  const rewrites: MakerCommentRewrite[] = [];
  const topFrictions = frictions.slice(0, 3);

  // Rewrite 1: Friction-aware intro
  rewrites.push({
    comment: buildFrictionAwareComment(input, topFrictions),
    strategy: 'Address top friction points proactively in the first comment',
    strengthens: 'trust + transparency',
  });

  // Rewrite 2: Story-driven
  rewrites.push({
    comment: buildStoryComment(input),
    strategy: 'Lead with personal story and specific problem to build emotional connection',
    strengthens: 'authenticity + relatability',
  });

  // Rewrite 3: Roadmap-forward
  rewrites.push({
    comment: buildRoadmapComment(input, topFrictions),
    strategy: 'Show awareness of gaps and concrete plans to address them',
    strengthens: 'credibility + long-term trust',
  });

  return rewrites;
}

function buildFrictionAwareComment(input: RunInput, frictions: FrictionItem[]): string {
  const frictionPoints = frictions.map(f => f.trigger).slice(0, 3);
  return [
    `Hey PH! I built ${input.tagline} because I kept running into the same problem.`,
    '',
    `I know you might be thinking:`,
    ...frictionPoints.map(f => `- "${f}" — fair point, and here's how we address it...`),
    '',
    `Would love your honest feedback. What would make this a must-try for you?`,
  ].join('\n');
}

function buildStoryComment(input: RunInput): string {
  return [
    `The story behind ${input.tagline}:`,
    '',
    `I started building this after experiencing the exact pain our users face.`,
    `${input.description.slice(0, 150)}`,
    '',
    `The key insight: solving this problem shouldn't require [the old way].`,
    `We'd love to hear what you think — especially what's missing.`,
  ].join('\n');
}

function buildRoadmapComment(input: RunInput, frictions: FrictionItem[]): string {
  const topFriction = frictions[0]?.trigger ?? 'the main concern';
  return [
    `Launching ${input.tagline} today!`,
    '',
    `What we have now: ${input.description.slice(0, 100)}`,
    '',
    `What's next (based on early feedback):`,
    `1. Addressing "${topFriction}" — this is our top priority`,
    `2. Adding more proof points and case studies`,
    `3. Improving onboarding for first-time users`,
    '',
    `Feedback? Concerns? Drop them below — we're reading everything.`,
  ].join('\n');
}

function generateObjectionSnippets(
  outputs: AgentOutput[],
  frictions: FrictionItem[]
): ObjectionSnippet[] {
  const snippets: ObjectionSnippet[] = [];

  // Generate objection/response pairs from friction items and trust killers
  for (const friction of frictions.slice(0, 5)) {
    const relatedOutput = outputs.find(o =>
      friction.agentsCiting.includes(o.personaId)
    );

    snippets.push({
      objection: friction.trigger,
      response: generateResponse(friction, relatedOutput),
      source: `Friction #${friction.rank} (cited by ${friction.agentsCiting.join(', ')})`,
    });
  }

  // Add trust-killer specific objections
  const allTrustKillers = outputs.flatMap(o =>
    o.skim.trustKillers.map(tk => ({ killer: tk, personaId: o.personaId }))
  );
  const uniqueKillers = new Map<string, typeof allTrustKillers[0]>();
  for (const tk of allTrustKillers) {
    const key = tk.killer.slice(0, 50).toLowerCase();
    if (!uniqueKillers.has(key)) uniqueKillers.set(key, tk);
  }

  for (const [, tk] of Array.from(uniqueKillers.entries()).slice(0, 3)) {
    if (snippets.some(s => s.objection.toLowerCase().includes(tk.killer.slice(0, 30).toLowerCase()))) continue;
    snippets.push({
      objection: tk.killer,
      response: `We hear this concern. Here's what we're doing about it: [specific action]. We'd love to share more details if you're interested.`,
      source: `Trust killer flagged by ${tk.personaId}`,
    });
  }

  return snippets;
}

function generateResponse(friction: FrictionItem, output?: AgentOutput): string {
  const fix = output?.action.oneLineFix;
  if (fix) {
    return `Great question. We're addressing this by: ${fix}. We'd love your feedback on this approach.`;
  }

  switch (friction.category) {
    case 'missing_proof':
      return 'We\'re gathering case studies now. Would you be open to trying it? Your experience would help us build the proof points the community needs.';
    case 'pricing_concern':
      return 'We hear you on pricing. We\'re exploring options to make this more accessible. What would feel fair for the value you\'d expect?';
    case 'vague_value_prop':
      return 'You\'re right that we need to be more specific. Here\'s what it does concretely: [specific outcome]. Does that resonate?';
    case 'trust_gap':
      return 'Trust is earned, not claimed. Here\'s what we can share: [concrete evidence]. Happy to provide more details.';
    default:
      return `We appreciate this feedback. Here's how we're thinking about it: [specific plan]. Would love your input on the approach.`;
  }
}
