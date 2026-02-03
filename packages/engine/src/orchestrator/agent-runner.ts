import type { PersonaId, AgentOutput } from '@simvibe/shared';
import { validateAgentOutput, createFallbackAgentOutput } from '@simvibe/shared';
import type { LLMClient, LLMMessage } from './llm-client';
import type { SimulationContext, AgentResult } from './types';
import { composePrompt } from '../prompts';

const MAX_RETRIES = 3;

function extractJSON(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    return trimmed.slice(braceStart, braceEnd + 1);
  }

  return trimmed;
}

function parseAgentResponse(
  rawResponse: string,
  personaId: PersonaId,
  runId: string
): { output: AgentOutput; error?: string } {
  try {
    const jsonStr = extractJSON(rawResponse);
    const parsed = JSON.parse(jsonStr);

    const fullOutput = {
      personaId,
      runId,
      timestamp: new Date().toISOString(),
      ...parsed,
      isFallback: false,
    };

    const validation = validateAgentOutput(fullOutput);
    if (validation.success) {
      return { output: validation.data };
    }

    return {
      output: createFallbackAgentOutput(personaId, runId, `Validation failed: ${validation.error}`),
      error: validation.error,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown parse error';
    return {
      output: createFallbackAgentOutput(personaId, runId, `JSON parse error: ${error}`),
      error,
    };
  }
}

export async function runAgent(
  personaId: PersonaId,
  context: SimulationContext,
  llmClient: LLMClient
): Promise<AgentResult> {
  const startTime = Date.now();
  const { runId, input, landingExtract, config } = context;

  const prompt = composePrompt(personaId, input, landingExtract, {
    includeDebate: config.enableDebate ?? false,
  });

  const messages: LLMMessage[] = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ];

  let lastError: string | undefined;
  let retryCount = 0;
  let rawResponse = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await llmClient.complete(messages);
      rawResponse = response.content;

      const { output, error } = parseAgentResponse(rawResponse, personaId, runId);

      if (!output.isFallback) {
        return {
          personaId,
          output,
          rawResponse,
          retryCount: attempt,
          durationMs: Date.now() - startTime,
        };
      }

      lastError = error;
      retryCount = attempt + 1;

      if (attempt < MAX_RETRIES - 1) {
        messages.push({
          role: 'assistant',
          content: rawResponse,
        });
        messages.push({
          role: 'user',
          content: `Your response was not valid JSON or failed validation. Error: ${error}

Please output ONLY valid JSON matching the required schema. Start with { and end with }. No markdown, no explanations.`,
        });
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'LLM call failed';
      retryCount = attempt + 1;

      if (attempt >= MAX_RETRIES - 1) {
        break;
      }
    }
  }

  return {
    personaId,
    output: createFallbackAgentOutput(
      personaId,
      runId,
      `Failed after ${retryCount} retries: ${lastError}`
    ),
    rawResponse,
    retryCount,
    durationMs: Date.now() - startTime,
  };
}
