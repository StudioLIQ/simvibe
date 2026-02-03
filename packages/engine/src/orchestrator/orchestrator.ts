import type { RunInput, LandingExtract, SimEvent, PersonaId } from '@simvibe/shared';
import { createSimEvent, getAllPersonaIds } from '@simvibe/shared';
import type {
  OrchestratorConfig,
  SimulationContext,
  SimulationEventHandler,
  SimulationResult,
  AgentResult,
} from './types';
import { createLLMClient, type LLMClient } from './llm-client';
import { runAgent } from './agent-runner';

export class Orchestrator {
  private config: OrchestratorConfig;
  private llmClient: LLMClient;
  private eventHandlers: SimulationEventHandler[] = [];

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.llmClient = createLLMClient(config.llm);
  }

  onEvent(handler: SimulationEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private async emitEvent(event: SimEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      await handler(event);
    }
  }

  async runSimulation(
    runId: string,
    input: RunInput,
    landingExtract: LandingExtract
  ): Promise<SimulationResult> {
    const startTime = Date.now();
    const events: SimEvent[] = [];
    const agentResults: AgentResult[] = [];

    const context: SimulationContext = {
      runId,
      input,
      landingExtract,
      config: this.config,
    };

    const emit = async (event: SimEvent) => {
      events.push(event);
      await this.emitEvent(event);
    };

    try {
      await emit(createSimEvent(runId, 'RUN_STARTED', {
        message: 'Simulation started',
        payload: { input, landingExtract: { title: landingExtract.title, failed: landingExtract.failed } },
      }));

      const personaIds = getAllPersonaIds();

      await emit(createSimEvent(runId, 'PHASE_START', {
        phase: 'scan',
        message: 'Starting scan phase',
      }));

      for (const personaId of personaIds) {
        await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
          phase: 'scan',
          agentId: personaId,
          message: `${personaId} is scanning the product...`,
        }));
      }

      await emit(createSimEvent(runId, 'PHASE_END', {
        phase: 'scan',
        message: 'Scan phase complete',
      }));

      await emit(createSimEvent(runId, 'PHASE_START', {
        phase: 'skim',
        message: 'Starting skim phase',
      }));

      for (const personaId of personaIds) {
        await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
          phase: 'skim',
          agentId: personaId,
          message: `${personaId} is analyzing the landing page...`,
        }));
      }

      await emit(createSimEvent(runId, 'PHASE_END', {
        phase: 'skim',
        message: 'Skim phase complete',
      }));

      await emit(createSimEvent(runId, 'PHASE_START', {
        phase: 'action',
        message: 'Starting action phase - running all agents',
      }));

      const agentPromises = personaIds.map(async (personaId) => {
        await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
          phase: 'action',
          agentId: personaId,
          message: `Running ${personaId} agent...`,
        }));

        const result = await runAgent(personaId, context, this.llmClient);

        await emit(createSimEvent(runId, 'AGENT_ACTION', {
          phase: 'action',
          agentId: personaId,
          action: result.output.action.primaryAction,
          probability: result.output.action.actions.find(
            a => a.action === result.output.action.primaryAction
          )?.probability,
          message: `${personaId} completed evaluation`,
          payload: {
            primaryFriction: result.output.skim.primaryFriction,
            oneLineFix: result.output.action.oneLineFix,
            isFallback: result.output.isFallback,
          },
        }));

        if (result.output.isFallback) {
          await emit(createSimEvent(runId, 'VALIDATION_ERROR', {
            agentId: personaId,
            message: `${personaId} output required fallback: ${result.output.fallbackReason}`,
          }));
        }

        return result;
      });

      const results = await Promise.all(agentPromises);
      agentResults.push(...results);

      await emit(createSimEvent(runId, 'PHASE_END', {
        phase: 'action',
        message: 'Action phase complete',
      }));

      await emit(createSimEvent(runId, 'RUN_COMPLETED', {
        message: 'Simulation completed successfully',
        payload: {
          agentCount: agentResults.length,
          fallbackCount: agentResults.filter(r => r.output.isFallback).length,
          durationMs: Date.now() - startTime,
        },
      }));

      return {
        runId,
        agentResults,
        events,
        durationMs: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await emit(createSimEvent(runId, 'RUN_FAILED', {
        message: `Simulation failed: ${errorMessage}`,
        payload: { error: errorMessage },
      }));

      return {
        runId,
        agentResults,
        events,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}
