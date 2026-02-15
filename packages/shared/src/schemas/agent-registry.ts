import { z } from 'zod';

// --- External Agent ---
// Represents a third-party agent that can participate in simulation or report refinement.

export const AgentTypeSchema = z.enum(['persona', 'external', 'system']);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentStatusSchema = z.enum(['active', 'disabled', 'revoked']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const ExternalAgentSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, 'Must be lowercase alphanumeric with hyphens/underscores'),
  name: z.string().min(1).max(200),
  owner: z.string().min(1).max(200), // e.g. 'org:acme', 'user:alice'
  endpoint: z.string().url().optional(), // webhook/API URL for the agent
  schemaVersion: z.string().default('1.0'), // protocol version the agent supports
  status: AgentStatusSchema.default('active'),
  reputation: z.number().min(0).max(100).default(50), // trust score
  capabilities: z.array(z.enum([
    'simulation_participant', // can run as persona in simulation
    'report_patcher',        // can submit report patches
    'reviewer',              // can review/approve reports
  ])).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  registeredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExternalAgent = z.infer<typeof ExternalAgentSchema>;

// --- Participant Config ---
// Per-run configuration for which agents participate.

export const ParticipantAgentSchema = z.object({
  agentId: z.string(),
  type: AgentTypeSchema,
  role: z.enum(['persona', 'patcher', 'reviewer']),
});

export type ParticipantAgent = z.infer<typeof ParticipantAgentSchema>;

export const ParticipantConfigSchema = z.object({
  agents: z.array(ParticipantAgentSchema),
  allowExternalPatches: z.boolean().default(false),
  requireReviewForExternal: z.boolean().default(true), // auto-escalate external patches to 'review'
});

export type ParticipantConfig = z.infer<typeof ParticipantConfigSchema>;

// --- Validators ---

export function validateExternalAgent(
  data: unknown
): { success: true; data: ExternalAgent } | { success: false; error: string } {
  const result = ExternalAgentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error: errorMessages };
}

export function validateParticipantConfig(
  data: unknown
): { success: true; data: ParticipantConfig } | { success: false; error: string } {
  const result = ParticipantConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error: errorMessages };
}
