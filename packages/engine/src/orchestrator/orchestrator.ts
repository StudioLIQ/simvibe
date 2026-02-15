import type { RunInput, LandingExtract, SimEvent, PersonaId } from '@simvibe/shared';
import { createSimEvent } from '@simvibe/shared';
import { createFallbackAgentOutput } from '@simvibe/shared';
import { getAllPersonaIds } from '../prompts/personas';
import type {
  OrchestratorConfig,
  SimulationContext,
  SimulationEventHandler,
  SimulationResult,
  AgentResult,
} from './types';
import { createLLMClient, type LLMClient } from './llm-client';
import { runAgent, type RunAgentOptions } from './agent-runner';

const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_PER_AGENT_TIMEOUT_MS = 120_000; // 2 minutes per agent
const DEFAULT_DEBATE_ROUNDS = 1;
const DEFAULT_PEER_CONTEXT_LIMIT = 8;

interface BatchRunOptions {
  phase: 'action' | 'debate';
  runOptionsForPersona?: (personaId: PersonaId) => RunAgentOptions;
}

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
    let earlyStopReason: string | undefined;

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

      const personaIds = (this.config.personaIds ?? getAllPersonaIds()) as PersonaId[];
      const maxConcurrency = this.config.maxAgentConcurrency ?? DEFAULT_MAX_CONCURRENCY;
      const perAgentTimeout = this.config.perAgentTimeoutMs ?? DEFAULT_PER_AGENT_TIMEOUT_MS;

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
        message: `Starting action phase - ${personaIds.length} agents, concurrency ${maxConcurrency}`,
      }));

      // Run agents in batches with concurrency control + time budget
      const initialBatchResult = await this.runAgentsBatched(
        personaIds,
        context,
        maxConcurrency,
        perAgentTimeout,
        runId,
        emit,
        startTime,
        this.config.timeBudgetMs,
        {
          phase: 'action',
          runOptionsForPersona: () => ({
            includeDebate: this.config.enableDebate ?? false,
          }),
        }
      );
      agentResults.push(...initialBatchResult.results);
      earlyStopReason = initialBatchResult.earlyStopReason;

      const debateEnabled = this.config.enableDebate ?? false;
      const debateRounds = Math.max(0, this.config.debateRounds ?? DEFAULT_DEBATE_ROUNDS);

      if (debateEnabled && debateRounds > 0 && agentResults.length > 1 && !earlyStopReason) {
        await emit(createSimEvent(runId, 'PHASE_START', {
          phase: 'debate',
          message: `Starting debate phase - ${debateRounds} round(s) of persona-to-persona reaction`,
          payload: { debateRounds },
        }));

        let currentResults = [...agentResults];
        let completedDebateRounds = 0;

        for (let round = 1; round <= debateRounds; round++) {
          const previousRound = currentResults;

          await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
            phase: 'debate',
            message: `Debate round ${round}/${debateRounds}: personas react to peer feedback`,
            payload: { round, debateRounds },
          }));

          const debateRoundResult = await this.runAgentsBatched(
            personaIds,
            context,
            maxConcurrency,
            perAgentTimeout,
            runId,
            emit,
            startTime,
            this.config.timeBudgetMs,
            {
              phase: 'debate',
              runOptionsForPersona: (personaId) => ({
                includeDebate: true,
                debateRound: round,
                debateTotalRounds: debateRounds,
                peerReactionContext: this.buildPeerReactionContext(personaId, previousRound, round, debateRounds),
              }),
            }
          );

          currentResults = debateRoundResult.results;
          completedDebateRounds = round;
          if (debateRoundResult.earlyStopReason) {
            earlyStopReason = debateRoundResult.earlyStopReason;
            break;
          }

          const stanceShifts = this.countStanceShifts(previousRound, currentResults);
          await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
            phase: 'debate',
            message: `Debate round ${round}/${debateRounds} complete: ${stanceShifts} persona stance update(s)`,
            payload: { round, debateRounds, stanceShifts },
          }));
        }

        agentResults.length = 0;
        agentResults.push(...currentResults);

        await emit(createSimEvent(runId, 'PHASE_END', {
          phase: 'debate',
          message: earlyStopReason ? `Debate phase stopped early: ${earlyStopReason}` : 'Debate phase complete',
          payload: { debateRoundsCompleted: completedDebateRounds, earlyStopReason },
        }));
      }

      const fallbackCount = agentResults.filter(r => r.output.isFallback).length;
      const timeoutCount = agentResults.filter(r =>
        r.output.isFallback && r.output.fallbackReason?.includes('timed out')
      ).length;

      await emit(createSimEvent(runId, 'PHASE_END', {
        phase: 'action',
        message: earlyStopReason ? `Action phase stopped early: ${earlyStopReason}` : 'Action phase complete',
        payload: { fallbackCount, timeoutCount, earlyStopReason, debateEnabled, debateRounds },
      }));

      if (earlyStopReason) {
        await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
          phase: 'action',
          message: `Time budget warning: ${earlyStopReason}`,
          payload: { type: 'time_budget_warning' },
        }));
      }

      await emit(createSimEvent(runId, 'RUN_COMPLETED', {
        message: earlyStopReason
          ? `Simulation completed with early stop: ${earlyStopReason}`
          : 'Simulation completed successfully',
        payload: {
          agentCount: agentResults.length,
          totalRequested: personaIds.length,
          fallbackCount,
          timeoutCount,
          earlyStopReason,
          durationMs: Date.now() - startTime,
        },
      }));

      return {
        runId,
        agentResults,
        events,
        earlyStopReason,
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

  /**
   * Run agents in batches with concurrency control, per-agent timeouts, and time budget.
   * Single-agent failures produce fallback outputs rather than aborting the run.
   * Stops launching new batches if the time budget is nearly exhausted.
   */
  private async runAgentsBatched(
    personaIds: PersonaId[],
    context: SimulationContext,
    maxConcurrency: number,
    perAgentTimeoutMs: number,
    runId: string,
    emit: (event: SimEvent) => Promise<void>,
    runStartTime: number,
    timeBudgetMs?: number,
    options: BatchRunOptions = { phase: 'action' }
  ): Promise<{ results: AgentResult[]; earlyStopReason?: string }> {
    const results: AgentResult[] = [];
    const totalBatches = Math.ceil(personaIds.length / maxConcurrency);
    let earlyStopReason: string | undefined;
    const phase = options.phase;

    // Reserve 10% of budget (min 10s) for report generation
    const budgetReserveMs = timeBudgetMs ? Math.max(timeBudgetMs * 0.1, 10_000) : 0;

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      // Check time budget before launching a new batch
      if (timeBudgetMs) {
        const elapsed = Date.now() - runStartTime;
        const remaining = timeBudgetMs - elapsed;

        if (remaining <= budgetReserveMs) {
          const completedAgents = results.length;
          const totalAgents = personaIds.length;
          earlyStopReason = `Time budget nearly exhausted (${Math.round(elapsed / 1000)}s / ${Math.round(timeBudgetMs / 1000)}s). ` +
            `Completed ${completedAgents}/${totalAgents} agents. ` +
            `Skipped batches ${batchIdx + 1}-${totalBatches}.`;

          await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
            phase,
            message: `Time budget warning: stopping before batch ${batchIdx + 1}/${totalBatches} — ${Math.round(remaining / 1000)}s remaining`,
            payload: { type: 'time_budget_stop', elapsed, remaining, completedAgents, totalAgents },
          }));

          break;
        }
      }

      const batchStart = batchIdx * maxConcurrency;
      const batchPersonaIds = personaIds.slice(batchStart, batchStart + maxConcurrency);

      if (totalBatches > 1) {
        await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
          phase,
          message: `Running batch ${batchIdx + 1}/${totalBatches} (${batchPersonaIds.length} agents)`,
          payload: { batch: batchIdx + 1, totalBatches, personas: batchPersonaIds },
        }));
      }

      const batchPromises = batchPersonaIds.map(async (personaId) => {
        const runOptions = options.runOptionsForPersona?.(personaId);

        await emit(createSimEvent(runId, 'AGENT_MESSAGE', {
          phase,
          agentId: personaId,
          message: phase === 'debate'
            ? `Running ${personaId} debate evaluation...`
            : `Running ${personaId} agent...`,
        }));

        const result = await this.runAgentWithTimeout(personaId, context, perAgentTimeoutMs, runOptions);

        await emit(createSimEvent(runId, 'AGENT_ACTION', {
          phase,
          agentId: personaId,
          action: result.output.action.primaryAction,
          probability: result.output.action.actions.find(
            a => a.action === result.output.action.primaryAction
          )?.probability,
          message: phase === 'debate'
            ? `${personaId} completed peer-reactive evaluation`
            : `${personaId} completed evaluation`,
          payload: {
            primaryFriction: result.output.skim.primaryFriction,
            oneLineFix: result.output.action.oneLineFix,
            isFallback: result.output.isFallback,
            durationMs: result.durationMs,
            debateRound: runOptions?.debateRound,
          },
        }));

        if (result.output.isFallback) {
          await emit(createSimEvent(runId, 'VALIDATION_ERROR', {
            phase,
            agentId: personaId,
            message: `${personaId} output required fallback: ${result.output.fallbackReason}`,
          }));
        }

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return { results, earlyStopReason };
  }

  /**
   * Run a single agent with a timeout. On timeout, returns a fallback output.
   */
  private async runAgentWithTimeout(
    personaId: PersonaId,
    context: SimulationContext,
    timeoutMs: number,
    runOptions?: RunAgentOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        runAgent(personaId, context, this.llmClient, runOptions),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Agent ${personaId} timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        personaId,
        output: createFallbackAgentOutput(
          personaId,
          context.runId,
          errorMessage
        ),
        retryCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private countStanceShifts(previous: AgentResult[], next: AgentResult[]): number {
    const prevMap = new Map(previous.map((r) => [r.personaId, r]));
    let shifts = 0;

    for (const current of next) {
      const prior = prevMap.get(current.personaId);
      if (!prior) continue;

      const actionChanged = prior.output.action.primaryAction !== current.output.action.primaryAction;
      const frictionChanged = prior.output.skim.primaryFriction !== current.output.skim.primaryFriction;
      const debateChanged = (prior.output.debate?.stanceUpdate || '') !== (current.output.debate?.stanceUpdate || '');

      if (actionChanged || frictionChanged || debateChanged) {
        shifts++;
      }
    }

    return shifts;
  }

  private buildPeerReactionContext(
    personaId: PersonaId,
    priorResults: AgentResult[],
    round: number,
    totalRounds: number
  ): string {
    const peers = priorResults
      .filter((r) => r.personaId !== personaId)
      .map((r) => {
        const bounce = r.output.action.actions.find((a) => a.action === 'BOUNCE')?.probability ?? 0;
        const upvote = r.output.action.actions.find((a) => a.action === 'UPVOTE')?.probability ?? 0;
        const signalStrength = Math.max(bounce, upvote);

        return {
          personaId: r.personaId,
          primaryAction: r.output.action.primaryAction,
          upvote,
          bounce,
          primaryFriction: r.output.skim.primaryFriction,
          challengedClaim: r.output.debate?.challengedClaim,
          question: r.output.debate?.question,
          oneLineFix: r.output.action.oneLineFix,
          signalStrength,
        };
      })
      .sort((a, b) => b.signalStrength - a.signalStrength)
      .slice(0, DEFAULT_PEER_CONTEXT_LIMIT);

    if (peers.length === 0) {
      return `No peer reactions available for round ${round}/${totalRounds}.`;
    }

    const lines: string[] = [];
    lines.push(`Round ${round}/${totalRounds}. Consider the following peer reactions before finalizing your output:`);
    for (let i = 0; i < peers.length; i++) {
      const peer = peers[i];
      lines.push(
        `${i + 1}. ${peer.personaId}: primaryAction=${peer.primaryAction}, upvote=${peer.upvote.toFixed(2)}, bounce=${peer.bounce.toFixed(2)}, primaryFriction="${peer.primaryFriction}"`
      );
      if (peer.question) lines.push(`   - debateQuestion: "${peer.question}"`);
      if (peer.challengedClaim) lines.push(`   - challengedClaim: "${peer.challengedClaim}"`);
      lines.push(`   - suggestedFix: "${peer.oneLineFix}"`);
    }
    lines.push('Update your stance if peer evidence materially changes your confidence or primary action.');

    return lines.join('\n');
  }
}

export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}
