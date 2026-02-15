import type { ExternalAgent, AgentStatus, ParticipantAgent } from '@simvibe/shared';

/**
 * Unified agent identity — wraps both internal personas and external agents.
 */
export interface UnifiedAgent {
  id: string;
  type: 'persona' | 'external' | 'system';
  name: string;
  status: AgentStatus;
  capabilities: string[];
  // For persona type — references persona registry
  personaId?: string;
  // For external type — references agent registry
  externalAgent?: ExternalAgent;
}

/**
 * In-memory registry for external agents.
 * Production deployments should back this with Postgres (future ticket).
 */
class AgentRegistry {
  private agents: Map<string, ExternalAgent> = new Map();

  register(agent: ExternalAgent): void {
    this.agents.set(agent.id, agent);
  }

  get(agentId: string): ExternalAgent | undefined {
    return this.agents.get(agentId);
  }

  getActive(agentId: string): ExternalAgent | undefined {
    const agent = this.agents.get(agentId);
    return agent?.status === 'active' ? agent : undefined;
  }

  update(agentId: string, updates: Partial<ExternalAgent>): ExternalAgent | null {
    const existing = this.agents.get(agentId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.agents.set(agentId, updated);
    return updated;
  }

  disable(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.status = 'disabled';
    agent.updatedAt = new Date().toISOString();
    return true;
  }

  revoke(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.status = 'revoked';
    agent.updatedAt = new Date().toISOString();
    return true;
  }

  listActive(): ExternalAgent[] {
    return Array.from(this.agents.values()).filter(a => a.status === 'active');
  }

  listAll(): ExternalAgent[] {
    return Array.from(this.agents.values());
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  size(): number {
    return this.agents.size;
  }

  clear(): void {
    this.agents.clear();
  }
}

// Singleton instance
const REGISTRY_KEY = '__simvibe_agent_registry__';

function getGlobalRegistry(): AgentRegistry {
  const scope = globalThis as typeof globalThis & { [REGISTRY_KEY]?: AgentRegistry };
  if (!scope[REGISTRY_KEY]) {
    scope[REGISTRY_KEY] = new AgentRegistry();
  }
  return scope[REGISTRY_KEY]!;
}

export function getAgentRegistry(): AgentRegistry {
  return getGlobalRegistry();
}

export function resetAgentRegistry(): void {
  getGlobalRegistry().clear();
}

/**
 * Build a unified agent list from persona IDs and participant config.
 * This bridges internal personas and external agents into a single interface.
 */
export function resolveParticipants(
  personaIds: string[],
  externalParticipants: ParticipantAgent[] = []
): UnifiedAgent[] {
  const agents: UnifiedAgent[] = [];

  // Internal personas
  for (const personaId of personaIds) {
    agents.push({
      id: personaId,
      type: 'persona',
      name: personaId,
      status: 'active',
      capabilities: ['simulation_participant'],
      personaId,
    });
  }

  // External agents
  const registry = getAgentRegistry();
  for (const participant of externalParticipants) {
    if (participant.type === 'external') {
      const externalAgent = registry.getActive(participant.agentId);
      if (externalAgent) {
        agents.push({
          id: participant.agentId,
          type: 'external',
          name: externalAgent.name,
          status: externalAgent.status,
          capabilities: externalAgent.capabilities,
          externalAgent,
        });
      }
    }
  }

  return agents;
}

/**
 * Validate that a patch author is authorized based on participant config.
 */
export function isAuthorizedPatcher(
  agentId: string,
  agentType: 'persona' | 'external' | 'system',
  allowExternalPatches: boolean
): boolean {
  // System and persona agents are always authorized
  if (agentType === 'system' || agentType === 'persona') return true;

  // External agents need explicit permission
  if (agentType === 'external') {
    if (!allowExternalPatches) return false;
    const registry = getAgentRegistry();
    const agent = registry.getActive(agentId);
    return !!agent && agent.capabilities.includes('report_patcher');
  }

  return false;
}
