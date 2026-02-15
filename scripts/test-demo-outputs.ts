#!/usr/bin/env tsx
/**
 * Validates that DemoLLMClient produces schema-valid agent outputs
 * for all default quick/deep personas. Zero fallbacks expected.
 */

import { validateAgentOutput, type RunInput, type LandingExtract } from '../packages/shared/src/schemas';
import { DemoLLMClient } from '../packages/engine/src/orchestrator/llm-client';
import { composePrompt } from '../packages/engine/src/prompts/composer';
import { getPersonaRegistry } from '../packages/engine/src/personas/registry';
import { PERSONA_SETS } from '../packages/engine/src/config/run-modes';

const SAMPLE_INPUT: RunInput = {
  tagline: 'AI-powered code review for teams that ship fast',
  description: 'CodeReviewer AI analyzes pull requests and provides actionable feedback in seconds. Built for teams that want to maintain quality without slowing down.',
  pricingModel: 'freemium',
  url: 'https://example.com',
  category: 'Developer Tools',
  tags: ['AI', 'DevTools', 'Code Review'],
};

const SAMPLE_EXTRACT: LandingExtract = {
  url: 'https://example.com',
  title: 'CodeReviewer AI',
  sections: [
    { type: 'hero', content: 'Ship better code, 10x faster. AI-powered code review for your team.' },
    { type: 'features', content: 'Instant PR feedback. Style enforcement. Bug detection. Security scanning.' },
    { type: 'pricing', content: 'Free for open source. $19/mo per seat for teams.' },
  ],
  confidence: 0.8,
  extractedAt: new Date().toISOString(),
  failed: false,
};

async function main() {
  const client = new DemoLLMClient();
  const registry = getPersonaRegistry();

  // Test all personas from quick + deep sets
  const allPersonaIds = [...new Set([...PERSONA_SETS.quick, ...PERSONA_SETS.deep])];
  console.log(`Testing ${allPersonaIds.length} personas from quick/deep sets`);
  console.log(`Registry loaded: ${registry.size} personas\n`);

  let passed = 0;
  let failed = 0;
  const failures: { personaId: string; error: string }[] = [];

  for (const personaId of allPersonaIds) {
    if (!registry.has(personaId)) {
      console.log(`  SKIP: ${personaId} (not in registry)`);
      continue;
    }

    // Test without debate
    for (const includeDebate of [false, true]) {
      const label = `${personaId} (debate=${includeDebate})`;
      try {
        const prompt = composePrompt(personaId as any, SAMPLE_INPUT, SAMPLE_EXTRACT, { includeDebate });

        const response = await client.complete([
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ]);

        const parsed = JSON.parse(response.content);
        const fullOutput = {
          personaId,
          runId: 'test_run',
          timestamp: new Date().toISOString(),
          ...parsed,
          isFallback: false,
        };

        const validation = validateAgentOutput(fullOutput);
        if (validation.success) {
          // Extra check: all probabilities are 0-1
          const invalidProbs = validation.data.action.actions.filter(
            a => a.probability < 0 || a.probability > 1
          );
          if (invalidProbs.length > 0) {
            failed++;
            const detail = invalidProbs.map(a => `${a.action}=${a.probability}`).join(', ');
            failures.push({ personaId: label, error: `Invalid probabilities: ${detail}` });
            console.log(`  FAIL: ${label} — invalid probabilities: ${detail}`);
          } else {
            passed++;
          }
        } else {
          failed++;
          failures.push({ personaId: label, error: validation.error });
          console.log(`  FAIL: ${label} — ${validation.error}`);
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ personaId: label, error: msg });
        console.log(`  FAIL: ${label} — ${msg}`);
      }
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ${f.personaId}: ${f.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
