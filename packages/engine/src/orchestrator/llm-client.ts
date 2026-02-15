import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { LLMConfig } from './types';
import { isDemoMode } from '../demo';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  finishReason: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMClient {
  complete(messages: LLMMessage[]): Promise<LLMResponse>;
}

const DEMO_FRICTION_CATEGORIES = [
  'unclear_icp',
  'vague_value_prop',
  'missing_proof',
  'pricing_concern',
  'trust_gap',
  'technical_doubt',
  'onboarding_friction',
  'other',
] as const;

const DEMO_PRIMARY_ACTIONS = ['UPVOTE', 'COMMENT', 'SIGNUP', 'PAY', 'SHARE', 'BOUNCE'] as const;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function extractPersonaName(systemPrompt: string): string {
  const match = systemPrompt.match(/# Your Persona:\s*(.+)/i);
  return match?.[1]?.trim() || 'Unknown Persona';
}

function extractSection(userPrompt: string, sectionName: string): string {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(\\n## |$)`, 'i');
  const match = userPrompt.match(regex);
  return match?.[1]?.trim() || '';
}

function buildDemoOutput(systemPrompt: string, userPrompt: string): Record<string, unknown> {
  const personaName = extractPersonaName(systemPrompt);
  const tagline = extractSection(userPrompt, 'Tagline') || 'Product';
  const description = extractSection(userPrompt, 'Description') || 'No description provided.';
  const peerReactions = extractSection(userPrompt, 'Peer Reactions');
  const seed = hashString(`${personaName}|${tagline}|${description}|${peerReactions}`);

  const frictionCategory = DEMO_FRICTION_CATEGORIES[seed % DEMO_FRICTION_CATEGORIES.length];
  const primaryAction = DEMO_PRIMARY_ACTIONS[seed % DEMO_PRIMARY_ACTIONS.length];
  const includeDebate = /Include the debate phase/i.test(userPrompt);

  // Use unsigned right shift (>>>) to avoid negative results from signed bit shift
  const weights: Record<typeof DEMO_PRIMARY_ACTIONS[number], number> = {
    UPVOTE: 0.15 + ((seed % 20) / 100),
    COMMENT: 0.1 + (((seed >>> 2) % 20) / 100),
    SIGNUP: 0.2 + (((seed >>> 4) % 30) / 100),
    PAY: 0.05 + (((seed >>> 6) % 20) / 100),
    SHARE: 0.08 + (((seed >>> 8) % 15) / 100),
    BOUNCE: 0.1 + (((seed >>> 10) % 25) / 100),
  };

  const peerNegativeSignals = (peerReactions.match(/primaryAction=BOUNCE/g) || []).length;
  const peerPositiveSignals = (
    (peerReactions.match(/primaryAction=UPVOTE/g) || []).length +
    (peerReactions.match(/primaryAction=SIGNUP/g) || []).length +
    (peerReactions.match(/primaryAction=PAY/g) || []).length
  );

  if (peerReactions.trim().length > 0) {
    const positiveLift = Math.min(0.18, peerPositiveSignals * 0.03);
    const negativeDrag = Math.min(0.18, peerNegativeSignals * 0.03);
    weights.UPVOTE += positiveLift * 0.7;
    weights.SIGNUP += positiveLift * 0.8;
    weights.PAY += positiveLift * 0.5;
    weights.BOUNCE += negativeDrag * 1.1;
    weights.COMMENT += (peerPositiveSignals + peerNegativeSignals) > 0 ? 0.04 : 0;
  }

  const maxAction = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0] as typeof DEMO_PRIMARY_ACTIONS[number];
  weights[maxAction] = Math.max(weights[maxAction], weights[primaryAction]);

  const actions = DEMO_PRIMARY_ACTIONS.map((action) => ({
    action,
    probability: Math.min(0.95, Number(weights[action].toFixed(2))),
    reasoning: `${personaName} evaluates ${action.toLowerCase()} likelihood based on clarity, trust, and price fit.`,
  }));

  const output: Record<string, unknown> = {
    scan: {
      phase: 'scan',
      productDefinition: `${tagline} — ${description.slice(0, 120)}`,
      suspicions: [
        'Is the value proposition specific enough for the target user?',
        'Do the trust signals justify trying this right now?',
        'Is pricing aligned with perceived immediate value?',
      ],
    },
    skim: {
      phase: 'skim',
      trustBoosters: [
        'Concrete outcome is presented in the tagline',
        'Clear pricing model is provided',
      ],
      trustKillers: [
        'Evidence depth is limited in this draft',
        'Differentiation vs alternatives is not explicit enough',
      ],
      primaryFriction: `Core friction for ${personaName}: messaging clarity and proof are not yet fully aligned.`,
      frictionCategory,
    },
    action: {
      phase: 'action',
      actions,
      primaryAction: maxAction,
      oneLineFix: 'Add one specific proof point and one ICP-specific CTA directly above the fold.',
    },
  };

  if (includeDebate) {
    output.debate = {
      phase: 'debate',
      question: 'What hard evidence most increases trust in this claim?',
      challengedClaim: 'The current copy implies strong outcomes without concrete support.',
      stanceUpdate: peerReactions.trim().length > 0
        ? `Adjusted after peer feedback (${peerPositiveSignals} positive vs ${peerNegativeSignals} negative signals); confidence shifted but proof gap remains decisive.`
        : 'Slightly more positive after considering broader market need, but proof gap remains.',
    };
  }

  return output;
}

export class DemoLLMClient implements LLMClient {
  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const output = buildDemoOutput(systemMessage, userMessage);

    return {
      content: JSON.stringify(output),
      finishReason: 'demo_stop',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }
}

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature ?? 0.7;
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemMessage?.content,
      messages: nonSystemMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find(c => c.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      content,
      finishReason: response.stop_reason || 'unknown',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4o';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature ?? 0.7;
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      finishReason: choice.finish_reason || 'unknown',
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      } : undefined,
    };
  }
}

export function createLLMClient(config: LLMConfig): LLMClient {
  if (isDemoMode()) {
    return new DemoLLMClient();
  }

  switch (config.provider) {
    case 'anthropic':
      return new AnthropicClient(config);
    case 'openai':
      return new OpenAIClient(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
