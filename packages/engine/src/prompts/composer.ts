import type { RunInput, LandingExtract, PersonaId } from '@simvibe/shared';
import { WORLD_PROTOCOL, PH_PROTOCOL_EXTENSION, OUTPUT_JSON_REMINDER } from './world-protocol';
import { getPersona, type PersonaDefinition } from './personas';

export interface ComposedPrompt {
  system: string;
  user: string;
}

function formatPersonaPrompt(persona: PersonaDefinition): string {
  return `
# Your Persona: ${persona.name}

## Role
${persona.role}

## Background
${persona.context}

## Your Priorities (what you care about most)
${persona.priorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Your Red Flags (things that make you skeptical)
${persona.redFlags.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Your Budget
Monthly software budget: $${persona.budgetRange.min} - $${persona.budgetRange.max}

## Your Skepticism Level
${persona.skepticismLevel.toUpperCase()} - ${persona.decisionStyle}
`;
}

function formatRunInput(input: RunInput): string {
  let text = `
# Product Information

## Tagline
${input.tagline}

## Description
${input.description}

## Pricing Model
${input.pricingModel}
`;

  if (input.pricePoints && input.pricePoints.length > 0) {
    text += `\n## Price Points\n`;
    for (const pp of input.pricePoints) {
      text += `- ${pp.tier}: $${pp.price}${pp.period ? `/${pp.period}` : ''} ${pp.currency}\n`;
    }
  }

  if (input.category) {
    text += `\n## Category\n${input.category}\n`;
  }

  if (input.tags && input.tags.length > 0) {
    text += `\n## Tags\n${input.tags.join(', ')}\n`;
  }

  if (input.competitors && input.competitors.length > 0) {
    text += `\n## Competitors\n`;
    for (const c of input.competitors) {
      text += `- ${c.name}${c.summary ? `: ${c.summary}` : ''}\n`;
    }
  }

  if (input.phSubmission) {
    const ph = input.phSubmission;
    text += `\n## Product Hunt Listing\n`;
    if (ph.productName) text += `**Product Name:** ${ph.productName}\n`;
    if (ph.phTagline) text += `**PH Tagline:** ${ph.phTagline}\n`;
    if (ph.phDescription) text += `**PH Description:** ${ph.phDescription}\n`;
    if (ph.topics && ph.topics.length > 0) text += `**Topics:** ${ph.topics.join(', ')}\n`;
    if (ph.makerFirstComment) text += `\n### Maker First Comment\n${ph.makerFirstComment}\n`;
    if (ph.mediaAssets) {
      if (ph.mediaAssets.thumbnailUrl) text += `**Thumbnail:** ${ph.mediaAssets.thumbnailUrl}\n`;
      if (ph.mediaAssets.videoUrl) text += `**Video:** ${ph.mediaAssets.videoUrl}\n`;
    }
  }

  return text;
}

function formatLandingExtract(extract: LandingExtract): string {
  if (extract.failed) {
    return `
# Landing Page Content

[EXTRACTION FAILED: ${extract.failureReason || 'Unknown error'}]

Unable to extract landing page content. Evaluate based on the tagline and description only.
`;
  }

  let text = `
# Landing Page Content
`;

  if (extract.title) {
    text += `\n## Page Title\n${extract.title}\n`;
  }

  for (const section of extract.sections) {
    text += `\n## ${section.type.toUpperCase()}\n${section.content}\n`;
  }

  if (extract.warnings && extract.warnings.length > 0) {
    text += `\n## Extraction Warnings\n${extract.warnings.join('\n')}\n`;
  }

  return text;
}

export function composePrompt(
  personaId: PersonaId,
  input: RunInput,
  extract: LandingExtract,
  options: { includeDebate?: boolean } = {}
): ComposedPrompt {
  const persona = getPersona(personaId);
  const isPH = input.platformMode === 'product_hunt';

  const systemPrompt = `${WORLD_PROTOCOL}
${isPH ? PH_PROTOCOL_EXTENSION : ''}
${formatPersonaPrompt(persona)}

${OUTPUT_JSON_REMINDER}`;

  let userPrompt = `Evaluate this product as ${persona.name}.

${formatRunInput(input)}

${formatLandingExtract(extract)}

Now provide your evaluation. ${options.includeDebate ? 'Include the debate phase.' : 'Skip the debate phase (set debate to null).'}

Remember: Output ONLY valid JSON. Start with { and end with }`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}

export function composeDebatePrompt(
  personaId: PersonaId,
  otherAgentOutputs: { personaId: PersonaId; question: string; challenge: string }[]
): ComposedPrompt {
  const persona = getPersona(personaId);

  const systemPrompt = `${WORLD_PROTOCOL}

${formatPersonaPrompt(persona)}

You are in the DEBATE phase. Other agents have shared their perspectives.

${OUTPUT_JSON_REMINDER}`;

  let otherPerspectives = '';
  for (const other of otherAgentOutputs) {
    const otherPersona = getPersona(other.personaId);
    otherPerspectives += `
### ${otherPersona.name}
Question: "${other.question}"
Challenge: "${other.challenge}"
`;
  }

  const userPrompt = `Review other agents' perspectives and update your stance if needed.

## Other Agents' Input
${otherPerspectives}

Now provide your debate response. Consider whether their points change your view.

Output ONLY the debate JSON:
{
  "debate": {
    "phase": "debate",
    "question": "your clarifying question",
    "challengedClaim": "what you challenge",
    "stanceUpdate": "how (if at all) your view changed based on others"
  }
}

Start with { and end with }`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
